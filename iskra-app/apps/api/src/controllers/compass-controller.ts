import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { CompassSession } from "../models/CompassSession";
import { Event } from "../models/Event";
import { EventProfile } from "../models/EventProfile";
import { Match } from "../models/Match";
import { User } from "../models/User";
import { VenueZone } from "../models/VenueZone";
import { bearingBetween, freshness, proximityLabel, zoneDistance } from "../lib/compass";
import { verifyZoneToken } from "../lib/zone-token";
import { requirePaidEventAccess } from "../lib/event-access";
import { requireDatingApp } from "../lib/feature-config";

const objectId = z.string().refine(Types.ObjectId.isValid, "Invalid identifier.");
const zoneInput = z.object({ zoneId: objectId, token: z.string().optional() });
const responseInput = z.object({ accepted: z.boolean() });
const patterns = ["ember", "plasma", "signal"] as const;
const sameId = (left: unknown, right: unknown) => String(left) === String(right);
const asDate = (value: unknown) => value instanceof Date ? value : value ? new Date(String(value)) : null;

function emit(req: Request, matchId: string, event: string, payload: unknown) {
  req.app.get("io")?.to(`match:${matchId}`).emit(event, payload);
}

async function authorizedMatch(req: Request, res: Response) {
  await requireDatingApp();
  const matchId = String(req.params.matchId || "");
  if (!Types.ObjectId.isValid(matchId)) {
    res.status(404).json({ message: "Match not found." });
    return null;
  }

  const match = await Match.findOne({ _id: matchId, status: "matched", expiresAt: { $gt: new Date() } });
  if (!match || !match.participants.some((id) => sameId(id, req.auth?.userId))) {
    res.status(404).json({ message: "Match not found." });
    return null;
  }

  const event = await Event.findOne({
    _id: match.eventId,
    venueId: match.venueId,
    status: { $in: ["active", "ending"] },
    endsAt: { $gt: new Date() }
  });
  if (!event) {
    res.status(409).json({ message: "This venue session has ended." });
    return null;
  }
  await requirePaidEventAccess(req.auth!.userId, String(event._id));

  const activeProfiles = await EventProfile.countDocuments({
    eventId: match.eventId,
    venueId: match.venueId,
    userId: { $in: match.participants },
    visibility: { $ne: "hidden" },
    expiresAt: { $gt: new Date() }
  });
  if (activeProfiles !== 2) {
    res.status(409).json({ message: "Both matches must be checked into this venue." });
    return null;
  }

  return { match, event };
}

async function serialize(match: InstanceType<typeof Match>, userId: string) {
  const session = await CompassSession.findOne({ matchId: match._id, expiresAt: { $gt: new Date() } }).lean();
  const isA = sameId(match.participants[0], userId);
  const peerId = isA ? match.participants[1] : match.participants[0];
  const [peer, peerProfile, zones] = await Promise.all([
    User.findById(peerId).select("firstName").lean(),
    EventProfile.findOne({ eventId: match.eventId, userId: peerId }).select("displayName photos").lean(),
    VenueZone.find({ venueId: match.venueId, active: true, visible: true }).sort({ floor: 1, name: 1 }).lean()
  ]);

  if (!session) {
    return { matchId: String(match._id), status: "idle", peer: { name: peerProfile?.displayName || peer?.firstName || "Your match", photo: peerProfile?.photos?.[0] || null }, zones };
  }

  const ownZoneId = isA ? session.participantAZoneId : session.participantBZoneId;
  const peerZoneId = isA ? session.participantBZoneId : session.participantAZoneId;
  const ownUpdatedAt = isA ? session.participantAZoneUpdatedAt : session.participantBZoneUpdatedAt;
  const peerUpdatedAt = isA ? session.participantBZoneUpdatedAt : session.participantAZoneUpdatedAt;
  const ownZone = zones.find((zone) => sameId(zone._id, ownZoneId)) || null;
  const peerZone = zones.find((zone) => sameId(zone._id, peerZoneId)) || null;
  const peerFreshness = freshness(asDate(peerUpdatedAt));
  const sameFloor = Boolean(ownZone && peerZone && ownZone.floor === peerZone.floor);
  const distance = ownZone && peerZone ? zoneDistance(ownZone, peerZone) : null;
  const bearing = ownZone && peerZone && sameFloor && peerFreshness.state !== "stale"
    ? bearingBetween(ownZone, peerZone)
    : null;

  return {
    matchId: String(match._id),
    status: session.status,
    requestedByMe: sameId(session.requestedBy, userId),
    acceptedByMe: session.acceptedBy.some((id) => sameId(id, userId)),
    expiresAt: session.expiresAt,
    pattern: session.pattern,
    peer: { name: peerProfile?.displayName || peer?.firstName || "Your match", photo: peerProfile?.photos?.[0] || null },
    ownZone,
    peerZone,
    ownFreshness: freshness(asDate(ownUpdatedAt)),
    peerFreshness,
    sameFloor,
    bearing,
    proximity: distance === null ? "unknown" : proximityLabel(distance, sameId(ownZoneId, peerZoneId)),
    foundByMe: session.foundBy.some((id) => sameId(id, userId)),
    zones
  };
}

export async function getCompass(req: Request, res: Response) {
  const context = await authorizedMatch(req, res);
  if (!context) return;
  res.json(await serialize(context.match, req.auth!.userId));
}

export async function requestCompass(req: Request, res: Response) {
  const context = await authorizedMatch(req, res);
  if (!context) return;
  const now = new Date();
  const existing = await CompassSession.findOne({ matchId: context.match._id });
  if (existing?.status === "declined" && existing.updatedAt.getTime() > now.getTime() - 120_000) {
    return res.status(429).json({ message: "Give your match a little space before asking again." });
  }
  if (existing && ["requested", "active"].includes(String(existing.status))) {
    return res.status(409).json({ message: "A Find My Match session is already open." });
  }

  const matchExpiry = asDate(context.match.expiresAt) || context.event.endsAt;
  const expiresAt = new Date(Math.min(matchExpiry.getTime(), now.getTime() + 15 * 60_000));
  const session = await CompassSession.findOneAndUpdate(
    { matchId: context.match._id },
    {
      matchId: context.match._id,
      eventId: context.match.eventId,
      venueId: context.match.venueId,
      participantA: context.match.participants[0],
      participantB: context.match.participants[1],
      requestedBy: req.auth!.userId,
      acceptedBy: [req.auth!.userId],
      status: "requested",
      participantAZoneId: null,
      participantBZoneId: null,
      participantAZoneUpdatedAt: null,
      participantBZoneUpdatedAt: null,
      foundBy: [],
      stoppedBy: null,
      pattern: patterns[Math.floor(Math.random() * patterns.length)],
      expiresAt
    },
    { upsert: true, new: true }
  );
  emit(req, String(context.match._id), "compass:requested", { matchId: String(context.match._id) });
  res.status(201).json(await serialize(context.match, req.auth!.userId));
}

export async function respondCompass(req: Request, res: Response) {
  const input = responseInput.parse(req.body);
  const context = await authorizedMatch(req, res);
  if (!context) return;
  const session = await CompassSession.findOne({ matchId: context.match._id, status: "requested", expiresAt: { $gt: new Date() } });
  if (!session) return res.status(409).json({ message: "This request is no longer active." });
  if (sameId(session.requestedBy, req.auth!.userId)) return res.status(409).json({ message: "Your match must answer this request." });

  if (!input.accepted) {
    session.status = "declined";
  } else {
    session.acceptedBy.addToSet(new Types.ObjectId(req.auth!.userId));
    session.status = session.acceptedBy.length === 2 ? "active" : "requested";
  }
  await session.save();
  emit(req, String(context.match._id), input.accepted ? "compass:accepted" : "compass:declined", { matchId: String(context.match._id) });
  res.json(await serialize(context.match, req.auth!.userId));
}

export async function updateZone(req: Request, res: Response) {
  const input = zoneInput.parse(req.body);
  const context = await authorizedMatch(req, res);
  if (!context) return;
  const session = await CompassSession.findOne({ matchId: context.match._id, status: "active", expiresAt: { $gt: new Date() } });
  if (!session || !session.acceptedBy.some((id) => sameId(id, req.auth!.userId))) return res.status(403).json({ message: "Mutual consent is required." });
  const zone = await VenueZone.findOne({ _id: input.zoneId, venueId: context.match.venueId, active: true, visible: true });
  if (!zone) return res.status(400).json({ message: "That area is not available in this venue." });
  if (input.token) {
    try {
      const token = verifyZoneToken(input.token);
      if (!sameId(token.zoneId, zone._id) || !sameId(token.venueId, zone.venueId) || token.version !== zone.tokenVersion) throw new Error();
    } catch {
      return res.status(400).json({ message: "This zone QR is invalid or expired." });
    }
  }

  const isA = sameId(session.participantA, req.auth!.userId);
  session.set(isA ? "participantAZoneId" : "participantBZoneId", zone._id);
  session.set(isA ? "participantAZoneUpdatedAt" : "participantBZoneUpdatedAt", new Date());
  await session.save();
  emit(req, String(context.match._id), "compass:zone", { matchId: String(context.match._id) });
  res.json(await serialize(context.match, req.auth!.userId));
}

export async function wave(req: Request, res: Response) {
  const context = await authorizedMatch(req, res);
  if (!context) return;
  const session = await CompassSession.findOne({ matchId: context.match._id, status: "active", expiresAt: { $gt: new Date() } });
  if (!session) return res.status(409).json({ message: "Find My Match is not active." });
  const isA = sameId(session.participantA, req.auth!.userId);
  const key = isA ? "participantALastWaveAt" : "participantBLastWaveAt";
  const lastWave = session.get(key) as Date | null;
  if (lastWave && lastWave.getTime() > Date.now() - 10_000) return res.status(429).json({ message: "Wait a moment before waving again." });
  session.set(key, new Date());
  await session.save();
  emit(req, String(context.match._id), "compass:wave", { matchId: String(context.match._id), from: req.auth!.userId, pattern: session.pattern });
  res.json({ ok: true });
}

export async function stopCompass(req: Request, res: Response) {
  const context = await authorizedMatch(req, res);
  if (!context) return;
  await CompassSession.updateOne({ matchId: context.match._id }, { $set: { status: "stopped", stoppedBy: req.auth!.userId, expiresAt: new Date(Date.now() + 60_000) } });
  emit(req, String(context.match._id), "compass:stopped", { matchId: String(context.match._id) });
  res.json({ ok: true });
}

export async function foundMatch(req: Request, res: Response) {
  const context = await authorizedMatch(req, res);
  if (!context) return;
  const session = await CompassSession.findOne({ matchId: context.match._id, status: "active", expiresAt: { $gt: new Date() } });
  if (!session || !session.participantAZoneId || !sameId(session.participantAZoneId, session.participantBZoneId)) return res.status(409).json({ message: "Both people must confirm the same venue area first." });
  if (freshness(asDate(session.participantAZoneUpdatedAt)).state === "stale" || freshness(asDate(session.participantBZoneUpdatedAt)).state === "stale") return res.status(409).json({ message: "Refresh both areas before confirming." });
  session.foundBy.addToSet(new Types.ObjectId(req.auth!.userId));
  if (session.foundBy.length === 2) {
    session.status = "found";
    session.expiresAt = new Date(Date.now() + 60_000);
  }
  await session.save();
  emit(req, String(context.match._id), "compass:found", { matchId: String(context.match._id), complete: session.status === "found" });
  res.json(await serialize(context.match, req.auth!.userId));
}
