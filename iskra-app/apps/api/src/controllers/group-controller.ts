import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { assertSafeText } from "../lib/content-safety";
import { requirePaidEventAccess } from "../lib/event-access";
import { requireDatingApp } from "../lib/feature-config";
import { Event } from "../models/Event";
import { EventProfile } from "../models/EventProfile";
import { Group } from "../models/Group";
import { GroupMember } from "../models/GroupMember";
import { GroupMessage } from "../models/GroupMessage";
import { Report } from "../models/Report";

const objectId = z.string().refine(Types.ObjectId.isValid, "Invalid identifier.");
const groupSchema = z.object({ eventId: objectId, title: z.string().trim().min(3).max(50), description: z.string().trim().min(8).max(240), maxMembers: z.number().int().min(2).max(30).default(8), meetingArea: z.string().trim().min(2).max(60), mode: z.enum(["open", "private"]).default("open"), category: z.enum(["dancing", "drinks", "networking", "new-friends", "hangout"]) });

async function eventContext(eventId: string, userId: string) {
  const event = await Event.findOne({ _id: objectId.parse(eventId), status: { $in: ["active", "ending"] }, endsAt: { $gt: new Date() } });
  if (!event) throw Object.assign(new Error("This event is no longer active."), { status: 409 });
  await requirePaidEventAccess(userId, event._id);
  return event;
}

async function presentGroups(groups: any[], userId: string) {
  const [memberships, hosts] = await Promise.all([GroupMember.find({ groupId: { $in: groups.map((group) => group._id) }, userId }).lean(), EventProfile.find({ userId: { $in: groups.map((group) => group.hostId) }, eventId: { $in: groups.map((group) => group.eventId) } }).lean()]);
  const joined = new Set(memberships.map((item) => String(item.groupId)));
  const hostMap = new Map(hosts.map((profile) => [`${profile.eventId}:${profile.userId}`, profile]));
  return groups.map((group) => { const host = hostMap.get(`${group.eventId}:${group.hostId}`); return { ...group, _id: String(group._id), joined: joined.has(String(group._id)), isHost: String(group.hostId) === userId, full: group.memberCount >= group.maxMembers, host: { name: host?.displayName || "ISKRA guest", image: host?.photos?.[0] || null } }; });
}

export async function createGroup(req: Request, res: Response) {
  await requireDatingApp();
  const input = groupSchema.parse(req.body);
  assertSafeText(input.title, input.description);
  const event = await eventContext(input.eventId, req.auth!.userId);
  const group = await Group.create({ ...input, venueId: event.venueId, hostId: req.auth!.userId, memberCount: 1, expiresAt: event.cleanupAt });
  await GroupMember.create({ groupId: group._id, eventId: event._id, userId: req.auth!.userId, role: "host", expiresAt: event.cleanupAt });
  res.status(201).json((await presentGroups([group.toObject()], req.auth!.userId))[0]);
}

export async function listGroups(req: Request, res: Response) {
  await requireDatingApp();
  const event = await eventContext(String(req.params.eventId), req.auth!.userId);
  const category = String(req.query.category || "");
  const groups = await Group.find({ eventId: event._id, status: { $ne: "closed" }, expiresAt: { $gt: new Date() }, ...(category ? { category } : {}) }).sort({ memberCount: -1, createdAt: -1 }).lean();
  res.json(await presentGroups(groups, req.auth!.userId));
}

export async function getGroup(req: Request, res: Response) {
  const group = await Group.findOne({ _id: objectId.parse(String(req.params.groupId)), expiresAt: { $gt: new Date() } }).lean();
  if (!group) return res.status(404).json({ message: "Group not found." });
  await eventContext(String(group.eventId), req.auth!.userId);
  const members = await GroupMember.find({ groupId: group._id }).sort({ role: 1, joinedAt: 1 }).lean();
  const profiles = await EventProfile.find({ eventId: group.eventId, userId: { $in: members.map((item) => item.userId) } }).lean();
  const map = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  res.json({ ...(await presentGroups([group], req.auth!.userId))[0], members: members.map((item) => ({ id: String(item.userId), role: item.role, name: map.get(String(item.userId))?.displayName || "Guest", image: map.get(String(item.userId))?.photos?.[0] || null })) });
}

export async function joinGroup(req: Request, res: Response) {
  const groupId = objectId.parse(String(req.params.groupId));
  if (await GroupMember.exists({ groupId, userId: req.auth!.userId })) return res.json({ joined: true });
  const group = await Group.findOneAndUpdate({ _id: groupId, mode: "open", status: "open", expiresAt: { $gt: new Date() }, $expr: { $lt: ["$memberCount", "$maxMembers"] } }, { $inc: { memberCount: 1 } }, { new: true });
  if (!group) return res.status(409).json({ message: "This group is full or requires approval." });
  try {
    await eventContext(String(group.eventId), req.auth!.userId);
    await GroupMember.create({ groupId, eventId: group.eventId, userId: req.auth!.userId, expiresAt: group.expiresAt });
  } catch (error) {
    await Group.updateOne({ _id: groupId }, { $inc: { memberCount: -1 } });
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return res.json({ joined: true });
    throw error;
  }
  if (group.memberCount >= group.maxMembers) await Group.updateOne({ _id: groupId }, { status: "full" });
  res.json({ joined: true, memberCount: group.memberCount });
}

export async function leaveGroup(req: Request, res: Response) {
  const groupId = objectId.parse(String(req.params.groupId));
  const member = await GroupMember.findOne({ groupId, userId: req.auth!.userId });
  if (!member) return res.json({ joined: false });
  if (member.role === "host") return res.status(409).json({ message: "The host must close the group instead of leaving it." });
  await member.deleteOne();
  await Group.updateOne({ _id: groupId }, { $inc: { memberCount: -1 }, $set: { status: "open" } });
  res.json({ joined: false });
}

export async function listGroupMessages(req: Request, res: Response) {
  const groupId = objectId.parse(String(req.params.groupId));
  if (!await GroupMember.exists({ groupId, userId: req.auth!.userId })) return res.status(403).json({ message: "Join this group to see its chat." });
  const messages = await GroupMessage.find({ groupId }).sort({ _id: -1 }).limit(50).lean();
  const profiles = await EventProfile.find({ userId: { $in: messages.map((item) => item.senderId) } }).lean();
  const map = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  res.json(messages.reverse().map((item) => ({ id: String(item._id), body: item.body, mine: String(item.senderId) === req.auth!.userId, createdAt: item.createdAt, sender: map.get(String(item.senderId))?.displayName || "Guest" })));
}

export async function sendGroupMessage(req: Request, res: Response) {
  const groupId = objectId.parse(String(req.params.groupId));
  const input = z.object({ body: z.string().trim().min(1).max(1000), clientId: z.string().min(8).max(100) }).parse(req.body);
  assertSafeText(input.body);
  const [membership, group] = await Promise.all([GroupMember.exists({ groupId, userId: req.auth!.userId }), Group.findById(groupId)]);
  if (!membership || !group) return res.status(403).json({ message: "Join this group before messaging." });
  const message = await GroupMessage.findOneAndUpdate({ groupId, clientId: input.clientId }, { $setOnInsert: { eventId: group.eventId, senderId: req.auth!.userId, body: input.body, expiresAt: group.expiresAt } }, { upsert: true, new: true });
  req.app.get("io")?.to(`event:${String(group.eventId)}`).emit("group:message", { groupId });
  res.status(201).json({ id: String(message._id), body: message.body, mine: true, createdAt: message.createdAt, sender: "You" });
}

export async function reportGroup(req: Request, res: Response) {
  const group = await Group.findById(objectId.parse(String(req.params.groupId)));
  if (!group) return res.status(404).json({ message: "Group not found." });
  await Report.findOneAndUpdate({ eventId: group.eventId, reporterId: req.auth!.userId, subjectType: "group", subjectGroupId: group._id, status: "open" }, { category: "other", note: String(req.body?.note || "").slice(0, 1000) }, { upsert: true });
  res.status(201).json({ reported: true });
}
