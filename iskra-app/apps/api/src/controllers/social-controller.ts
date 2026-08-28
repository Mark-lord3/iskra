import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Block } from "../models/Block";
import { Conversation } from "../models/Conversation";
import { Event } from "../models/Event";
import { EventProfile } from "../models/EventProfile";
import { Match } from "../models/Match";
import { Message } from "../models/Message";
import { ProfileImpression } from "../models/ProfileImpression";
import { ProfileSignal } from "../models/ProfileSignal";
import { Report } from "../models/Report";
import { User } from "../models/User";
import { assertSafeText } from "../lib/content-safety";
import { requirePaidEventAccess } from "../lib/event-access";
import { requireDatingApp } from "../lib/feature-config";

const objectId = z.string().refine(Types.ObjectId.isValid, "Invalid identifier.");
const decisionSchema = z.object({ decision: z.enum(["wave", "pass"]) });
const messageSchema = z.object({ body: z.string().trim().min(1).max(2000), clientId: z.string().trim().min(8).max(100) });
const reportSchema = z.object({ category: z.enum(["harassment", "impersonation", "explicit", "underage", "spam", "other"]), note: z.string().trim().max(1000).optional() });

function ageFrom(dateOfBirth: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  if (now.getUTCMonth() < dateOfBirth.getUTCMonth() || (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

async function activeEvent(eventId: string) {
  if (!Types.ObjectId.isValid(eventId)) throw Object.assign(new Error("Invalid event."), { status: 400 });
  const event = await Event.findOne({ _id: eventId, status: { $in: ["active", "ending"] }, endsAt: { $gt: new Date() } });
  if (!event) throw Object.assign(new Error("This venue session has ended."), { status: 409 });
  return event;
}

async function blockedPair(eventId: unknown, one: unknown, two: unknown) {
  return Block.exists({ eventId, $or: [{ blockerId: one, blockedId: two }, { blockerId: two, blockedId: one }] });
}

export async function discoverDeck(req: Request, res: Response) {
  await requireDatingApp();
  const event = await activeEvent(String(req.params.eventId));
  const userId = req.auth!.userId;
  await requirePaidEventAccess(userId, event._id);
  const [decided, seen, blocked] = await Promise.all([
    /* ProfileSignal is the authoritative record of a like or a pass, so it is
       what decides who has been dealt with. ProfileImpression only records who
       was put on screen, and is written by the decision handler alone - anything
       that recorded a decision by another route left no impression behind and
       the person came round again. Excluding the union of the two means a
       decision always sticks, whichever row survives. */
    ProfileSignal.distinct("toUserId", { eventId: event._id, fromUserId: userId }),
    ProfileImpression.distinct("seenUserId", { eventId: event._id, userId }),
    Block.find({ eventId: event._id, $or: [{ blockerId: userId }, { blockedId: userId }] }).select("blockerId blockedId").lean()
  ]);
  const excluded = new Set([userId, ...decided.map(String), ...seen.map(String)]);
  blocked.forEach((item) => { excluded.add(String(item.blockerId)); excluded.add(String(item.blockedId)); });
  const profiles = await EventProfile.find({ eventId: event._id, userId: { $nin: [...excluded] }, visibility: "everyone", expiresAt: { $gt: new Date() } }).sort({ updatedAt: -1 }).limit(30).lean();
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.userId) } }).select("dateOfBirth").lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  res.json({ profiles: profiles.map((profile) => ({ id: String(profile._id), userId: String(profile.userId), name: profile.displayName, age: userMap.get(String(profile.userId))?.dateOfBirth ? ageFrom(userMap.get(String(profile.userId))!.dateOfBirth) : null, zone: profile.zone || "Around the venue", intentions: profile.intentions, bio: profile.bio || "Here for tonight's energy.", image: profile.photos[0] || null })), remaining: profiles.length });
}

export async function decideProfile(req: Request, res: Response) {
  await requireDatingApp();
  const profileId = objectId.parse(String(req.params.profileId));
  const { decision } = decisionSchema.parse(req.body);
  const target = await EventProfile.findOne({ _id: profileId, userId: { $ne: req.auth!.userId }, expiresAt: { $gt: new Date() } });
  if (!target) return res.status(404).json({ message: "Profile not found." });
  const event = await activeEvent(String(target.eventId));
  await requirePaidEventAccess(req.auth!.userId, event._id);
  if (await blockedPair(event._id, req.auth!.userId, target.userId)) return res.status(403).json({ message: "This profile is unavailable." });
  await Promise.all([
    ProfileImpression.updateOne({ eventId: event._id, userId: req.auth!.userId, seenUserId: target.userId }, { expiresAt: event.cleanupAt }, { upsert: true }),
    ProfileSignal.findOneAndUpdate({ eventId: event._id, fromUserId: req.auth!.userId, toUserId: target.userId }, { venueId: event.venueId, kind: decision, expiresAt: event.cleanupAt }, { upsert: true, new: true })
  ]);
  if (decision === "pass") return res.json({ matched: false, decision });
  const reciprocal = await ProfileSignal.exists({ eventId: event._id, fromUserId: target.userId, toUserId: req.auth!.userId, kind: "wave" });
  if (!reciprocal) return res.json({ matched: false, decision, message: "Private like sent." });
  const participants = [String(req.auth!.userId), String(target.userId)].sort();
  const pairKey = participants.join(":");
  const match = await Match.findOneAndUpdate({ eventId: event._id, pairKey }, { eventId: event._id, venueId: event.venueId, pairKey, participants, status: "matched", matchedAt: new Date(), expiresAt: event.cleanupAt }, { upsert: true, new: true });
  const conversation = await Conversation.findOneAndUpdate({ eventId: event._id, pairKey }, { $set: { eventId: event._id, venueId: event.venueId, matchId: match._id, pairKey, participants, expiresAt: event.cleanupAt }, $setOnInsert: { unread: {} }, $pull: { closedBy: { $in: participants } } }, { upsert: true, new: true });
  req.app.get("io")?.to(`user:${String(target.userId)}`).emit("match:created", { matchId: String(match._id), conversationId: String(conversation._id) });
  res.json({ matched: true, matchId: String(match._id), conversationId: String(conversation._id), person: { name: target.displayName, image: target.photos[0] || null } });
}

export async function undoPass(req: Request, res: Response) {
  const profileId = objectId.parse(String(req.params.profileId));
  const target = await EventProfile.findById(profileId).lean();
  if (!target) return res.status(404).json({ message: "Profile not found." });
  const signal = await ProfileSignal.findOne({ eventId: target.eventId, fromUserId: req.auth!.userId, toUserId: target.userId, kind: "pass" });
  if (!signal) return res.status(409).json({ message: "Only your latest pass can be undone." });
  await Promise.all([signal.deleteOne(), ProfileImpression.deleteOne({ eventId: target.eventId, userId: req.auth!.userId, seenUserId: target.userId })]);
  res.json({ undone: true });
}

async function conversationContext(req: Request) {
  const conversationId = objectId.parse(String(req.params.conversationId));
  const conversation = await Conversation.findOne({ _id: conversationId, participants: req.auth!.userId, closedBy: { $ne: req.auth!.userId }, expiresAt: { $gt: new Date() } });
  if (!conversation) throw Object.assign(new Error("Conversation not found."), { status: 404 });
  await requirePaidEventAccess(req.auth!.userId, String(conversation.eventId));
  const peerId = conversation.participants.find((id) => String(id) !== req.auth!.userId)!;
  if (await blockedPair(conversation.eventId, req.auth!.userId, peerId)) throw Object.assign(new Error("This conversation is unavailable."), { status: 403 });
  return { conversation, peerId };
}

export async function listConversations(req: Request, res: Response) {
  await requireDatingApp();
  const event = await activeEvent(String(req.params.eventId));
  await requirePaidEventAccess(req.auth!.userId, event._id);
  const conversations = await Conversation.find({ eventId: event._id, participants: req.auth!.userId, closedBy: { $ne: req.auth!.userId }, expiresAt: { $gt: new Date() } }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(100).lean();
  const peerIds = conversations.map((item) => item.participants.find((id) => String(id) !== req.auth!.userId)!);
  const profiles = await EventProfile.find({ eventId: event._id, userId: { $in: peerIds } }).lean();
  const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  res.json(conversations.map((item) => { const peerId = item.participants.find((id) => String(id) !== req.auth!.userId)!; const profile = profileMap.get(String(peerId)); const unread = item.unread as unknown as Record<string, number>; return { id: String(item._id), matchId: String(item.matchId), peer: { id: String(peerId), name: profile?.displayName || "Guest", image: profile?.photos[0] || null, zone: profile?.zone || "In the venue" }, preview: item.lastMessagePreview || "You matched. Say hello.", lastMessageAt: item.lastMessageAt || item.createdAt, unread: Number(unread?.[req.auth!.userId] || 0) }; }));
}

export async function listMessages(req: Request, res: Response) {
  await requireDatingApp();
  const { conversation, peerId } = await conversationContext(req);
  const cursor = req.query.cursor && Types.ObjectId.isValid(String(req.query.cursor)) ? String(req.query.cursor) : null;
  const messages = await Message.find({ conversationId: conversation._id, ...(cursor ? { _id: { $lt: cursor } } : {}) }).sort({ _id: -1 }).limit(30).lean();
  const profile = await EventProfile.findOne({ eventId: conversation.eventId, userId: peerId }).lean();
  res.json({ conversation: { id: String(conversation._id), matchId: String(conversation.matchId), peer: { id: String(peerId), name: profile?.displayName || "Guest", image: profile?.photos[0] || null, zone: profile?.zone || "In the venue" } }, messages: messages.reverse().map((message) => ({ id: String(message._id), clientId: message.clientId, body: message.body, mine: String(message.senderId) === req.auth!.userId, createdAt: message.createdAt, readAt: message.readAt })), nextCursor: messages.length === 30 ? String(messages[0]._id) : null });
}

export async function sendMessage(req: Request, res: Response) {
  await requireDatingApp();
  const { conversation, peerId } = await conversationContext(req);
  const input = messageSchema.parse(req.body);
  assertSafeText(input.body);
  const message = await Message.findOneAndUpdate({ conversationId: conversation._id, clientId: input.clientId }, { $setOnInsert: { eventId: conversation.eventId, senderId: req.auth!.userId, body: input.body, expiresAt: conversation.expiresAt } }, { upsert: true, new: true });
  await Conversation.updateOne({ _id: conversation._id }, { lastMessageAt: message.createdAt, lastMessagePreview: input.body.slice(0, 120), lastMessageFrom: req.auth!.userId, $inc: { [`unread.${String(peerId)}`]: 1 } });
  const payload = { id: String(message._id), clientId: message.clientId, body: message.body, mine: false, createdAt: message.createdAt, readAt: null };
  req.app.get("io")?.to(`user:${String(peerId)}`).emit("message:created", { conversationId: String(conversation._id), message: payload });
  res.status(201).json({ ...payload, mine: true });
}

export async function markConversationRead(req: Request, res: Response) {
  const { conversation } = await conversationContext(req);
  await Promise.all([Conversation.updateOne({ _id: conversation._id }, { $set: { [`unread.${req.auth!.userId}`]: 0 } }), Message.updateMany({ conversationId: conversation._id, senderId: { $ne: req.auth!.userId }, readAt: null }, { readAt: new Date() })]);
  res.json({ read: true });
}

export async function blockConversation(req: Request, res: Response) {
  const { conversation, peerId } = await conversationContext(req);
  await Block.updateOne({ eventId: conversation.eventId, blockerId: req.auth!.userId, blockedId: peerId }, { reason: String(req.body?.reason || ""), expiresAt: conversation.expiresAt }, { upsert: true });
  await Match.updateOne({ _id: conversation.matchId }, { status: "blocked" });
  res.json({ blocked: true });
}

export async function unmatchConversation(req: Request, res: Response) {
  const { conversation } = await conversationContext(req);
  await Match.updateOne({ _id: conversation.matchId }, { status: "unmatched" });
  await Conversation.updateOne({ _id: conversation._id }, { $addToSet: { closedBy: req.auth!.userId } });
  res.json({ unmatched: true });
}

export async function reportConversation(req: Request, res: Response) {
  const { conversation, peerId } = await conversationContext(req);
  const input = reportSchema.parse(req.body);
  await Report.findOneAndUpdate({ eventId: conversation.eventId, reporterId: req.auth!.userId, subjectType: "user", subjectUserId: peerId, status: "open" }, { category: input.category, note: input.note || "" }, { upsert: true });
  res.status(201).json({ reported: true });
}
