import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Event } from "../models/Event";
import { EventProfile } from "../models/EventProfile";
import { PartyVote } from "../models/PartyVote";
import { User } from "../models/User";
import { requirePaidEventAccess } from "../lib/event-access";
import { getDatingAppConfig, requireDatingApp } from "../lib/feature-config";

const voteSchema = z.object({
  candidateProfileId: z.string().refine(Types.ObjectId.isValid, "Invalid candidate."),
  direction: z.enum(["left", "right"])
});

async function competitionContext(userId: string, eventId: string) {
  const config = await requireDatingApp();
  if (!config.competitionEnabled) throw Object.assign(new Error("King & Queen voting is not open."), { status: 409 });
  if (!Types.ObjectId.isValid(eventId)) throw Object.assign(new Error("Invalid event."), { status: 400 });
  const event = await Event.findOne({ _id: eventId, status: { $in: ["active", "ending"] }, endsAt: { $gt: new Date() } });
  if (!event) throw Object.assign(new Error("This event is not active."), { status: 404 });
  await requirePaidEventAccess(userId, event._id);
  return event;
}

export async function getRandomCandidate(req: Request, res: Response) {
  const eventId = String(req.params.eventId);
  await competitionContext(req.auth!.userId, eventId);
  const voted = await PartyVote.distinct("candidateProfileId", { eventId, voterUserId: req.auth!.userId });
  const [candidate] = await EventProfile.aggregate([
    { $match: {
      eventId: new Types.ObjectId(eventId),
      userId: { $ne: new Types.ObjectId(req.auth!.userId) },
      _id: { $nin: voted },
      competitionEligible: true,
      "photos.0": { $exists: true },
      expiresAt: { $gt: new Date() }
    } },
    { $sample: { size: 1 } },
    { $project: { displayName: 1, photos: 1 } }
  ]);
  const remaining = await EventProfile.countDocuments({
    eventId, userId: { $ne: req.auth!.userId }, _id: { $nin: voted }, competitionEligible: true,
    "photos.0": { $exists: true }, expiresAt: { $gt: new Date() }
  });
  res.json({ candidate: candidate ? { id: String(candidate._id), displayName: candidate.displayName, image: candidate.photos[0] } : null, remaining });
}

export async function castPartyVote(req: Request, res: Response) {
  const eventId = String(req.params.eventId);
  const event = await competitionContext(req.auth!.userId, eventId);
  const input = voteSchema.parse(req.body);
  const candidate = await EventProfile.findOne({
    _id: input.candidateProfileId, eventId, userId: { $ne: req.auth!.userId }, competitionEligible: true,
    "photos.0": { $exists: true }, expiresAt: { $gt: new Date() }
  });
  if (!candidate) return res.status(404).json({ message: "Candidate is no longer available." });
  const user = await User.findById(candidate.userId).select("gender");
  if (!user || !["woman", "man"].includes(String(user.gender))) return res.status(409).json({ message: "Candidate is not eligible." });
  await PartyVote.create({
    eventId: event._id,
    voterUserId: req.auth!.userId,
    candidateProfileId: candidate._id,
    candidateUserId: candidate.userId,
    candidateGender: user.gender,
    direction: input.direction,
    expiresAt: event.cleanupAt
  });
  res.status(201).json({ recorded: true });
}

export async function getCompetitionResults(req: Request, res: Response) {
  const eventId = String(req.params.eventId);
  if (!Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid event." });
  await requireDatingApp();
  await requirePaidEventAccess(req.auth!.userId, eventId);
  const config = await getDatingAppConfig();
  const totalVotes = await PartyVote.countDocuments({ eventId });
  if (config.competitionEnabled) return res.json({ votingOpen: true, totalVotes, winners: null });
  const leaders = await PartyVote.aggregate([
    { $match: { eventId: new Types.ObjectId(eventId), direction: "right" } },
    { $group: { _id: { userId: "$candidateUserId", gender: "$candidateGender" }, votes: { $sum: 1 }, profileId: { $first: "$candidateProfileId" } } },
    { $sort: { votes: -1, profileId: 1 } },
    { $group: { _id: "$_id.gender", winner: { $first: "$$ROOT" } } }
  ]);
  const winnerProfiles = await EventProfile.find({ _id: { $in: leaders.map((item) => item.winner.profileId) } }).select("displayName photos").lean();
  const profiles = new Map(winnerProfiles.map((profile) => [String(profile._id), profile]));
  const winners = Object.fromEntries(leaders.map((item) => {
    const profile = profiles.get(String(item.winner.profileId));
    return [item._id === "woman" ? "queen" : "king", profile ? { displayName: profile.displayName, image: profile.photos[0], votes: item.winner.votes } : null];
  }));
  res.json({ votingOpen: false, totalVotes, winners });
}
