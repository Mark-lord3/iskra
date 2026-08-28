import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { assertStagingTarget } from "./staging-guard";
import { buildPeople, portraitSvg, STAGING_EMAIL_DOMAIN, type SyntheticPerson } from "./synthetic-people";
import { connectDatabase } from "../db";
import { Event } from "../models/Event";
import { User } from "../models/User";
import { EventAccessPass } from "../models/EventAccessPass";
import { EventProfile } from "../models/EventProfile";
import { ProfileSignal } from "../models/ProfileSignal";
import { Match } from "../models/Match";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { Group } from "../models/Group";
import { GroupMember } from "../models/GroupMember";
import { GroupMessage } from "../models/GroupMessage";
import { ProfileImpression } from "../models/ProfileImpression";
import { Block } from "../models/Block";
import { Report } from "../models/Report";
import { Media } from "../models/Media";
import { mediaStorageService } from "../services/media-storage";

/**
 * Fills the active staging event with synthetic guests.
 *
 * Everything is keyed on a stable identity — the email, the user pair, the
 * group title — so running this twice updates rather than duplicates. That is
 * checked by counting before and after in the test suite.
 */
export const STAGING_PASSWORD = "StagingGuest!2026";
const DEFAULT_COUNT = 84;

export const pairKeyOf = (a: Types.ObjectId | string, b: Types.ObjectId | string) =>
  [String(a), String(b)].sort().join(":");

export type SeedReport = {
  database: string;
  eventId: string;
  users: number;
  profiles: number;
  waves: number;
  passes: number;
  matches: number;
  conversations: number;
  messages: number;
  unreadThreads: number;
  groups: number;
  groupMembers: number;
  competitionEntrants: number;
};

export async function seedDatingStaging(options: { count?: number; allowOverride?: boolean } = {}): Promise<SeedReport> {
  const target = assertStagingTarget({ allowOverride: options.allowOverride });
  const count = Math.min(100, Math.max(75, options.count ?? DEFAULT_COUNT));

  await connectDatabase();

  // The Event status enum is draft|active|ending|ended|cleaned. Only a live
  // room accepts new guests.
  const event = await Event.findOne({ status: "active" }).sort({ startsAt: -1 });
  if (!event) throw new Error("No active staging event found (status: \"active\"). Run the venue seed first.");

  const expiresAt: Date = (event as unknown as { cleanupAt?: Date; endsAt?: Date }).cleanupAt
    ?? (event as unknown as { endsAt?: Date }).endsAt
    ?? new Date(Date.now() + 12 * 3600_000);
  const venueId = (event as unknown as { venueId: Types.ObjectId }).venueId;
  const eventId = event._id as Types.ObjectId;

  /* The upload endpoint stores absolute URLs, so the fixture must too — a
     relative path resolves against the web origin, not the API, and 404s. */
  const mediaBase = (process.env.PUBLIC_API_URL || "http://localhost:4311/api/v1").replace(/\/$/, "");

  const people = buildPeople(count);
  const passwordHash = await bcrypt.hash(STAGING_PASSWORD, 10);
  const userIds: Types.ObjectId[] = [];

  /* ---- people, access and profiles ------------------------------------ */
  for (const person of people) {
    const user = await User.findOneAndUpdate(
      { email: person.email },
      {
        $set: {
          firstName: person.firstName,
          dateOfBirth: person.dateOfBirth,
          gender: person.gender,
          lookingFor: person.intentions
        },
        $setOnInsert: { passwordHash }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const userId = user._id as Types.ObjectId;
    userIds.push(userId);

    await EventAccessPass.findOneAndUpdate(
      { userId, eventId },
      { $set: { venueId, status: "paid", paidAt: new Date(), expiresAt }, $setOnInsert: { amountCents: 500 } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // One portrait per person, reused on re-runs rather than piling up files.
    const existingPhoto = await Media.findOne({ eventId, userId, kind: "profile" });
    const media = existingPhoto ?? await mediaStorageService.saveEventImage({
      eventId: String(eventId),
      venueId: String(venueId),
      userId: String(userId),
      kind: "profile",
      fileBuffer: portraitSvg(person),
      mimeType: "image/svg+xml"
    });

    await EventProfile.findOneAndUpdate(
      { userId, eventId },
      {
        $set: {
          venueId,
          displayName: person.displayName,
          bio: person.bio,
          intentions: person.intentions,
          photos: [`${mediaBase}/media/${media._id}`],
          zone: person.zone,
          competitionEligible: person.competitionConsent,
          competitionConsentAt: person.competitionConsent ? new Date() : null,
          expiresAt
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  /* ---- signals: waves, passes, and the mutual ones ---------------------- */
  let waves = 0;
  let passes = 0;
  const mutualPairs: Array<[Types.ObjectId, Types.ObjectId]> = [];

  for (let i = 0; i < userIds.length; i += 1) {
    const from = userIds[i]!;
    // A deterministic spread of targets so the fixture is reproducible.
    const targets = [(i + 1) % userIds.length, (i + 4) % userIds.length, (i + 9) % userIds.length];

    for (const [slot, targetIndex] of targets.entries()) {
      if (targetIndex === i) continue;
      const to = userIds[targetIndex]!;
      const kind = slot === 2 ? "pass" : "wave";

      await ProfileSignal.findOneAndUpdate(
        { eventId, fromUserId: from, toUserId: to },
        { $set: { venueId, kind, expiresAt } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      if (kind === "wave") waves += 1; else passes += 1;
    }

    // Every fourth pair waves back, creating a real mutual match.
    if (i % 4 === 0) {
      const partner = userIds[(i + 1) % userIds.length]!;
      if (String(partner) !== String(from)) {
        await ProfileSignal.findOneAndUpdate(
          { eventId, fromUserId: partner, toUserId: from },
          { $set: { venueId, kind: "wave", expiresAt } },
          { upsert: true, setDefaultsOnInsert: true }
        );
        waves += 1;
        mutualPairs.push([from, partner]);
      }
    }
  }

  /* ---- matches, threads and history ------------------------------------ */
  let conversations = 0;
  let messages = 0;
  let unreadThreads = 0;

  for (const [index, [a, b]] of mutualPairs.entries()) {
    const pairKey = pairKeyOf(a, b);
    const match = await Match.findOneAndUpdate(
      { eventId, pairKey },
      { $set: { venueId, participants: [a, b], status: "matched", expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const conversation = await Conversation.findOneAndUpdate(
      { eventId, pairKey },
      { $set: { venueId, matchId: match._id, participants: [a, b], expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    conversations += 1;

    // Two thirds of threads carry history; the rest are fresh matches.
    if (index % 3 !== 2) {
      const lines = [
        { from: a, body: "Hey — you were near the speakers earlier, right?" },
        { from: b, body: "Ha, guilty. Best spot in the room." },
        { from: a, body: "Agreed. Grabbing a drink if you want to join." }
      ];
      let last: { from: Types.ObjectId; body: string } | null = null;

      for (const [lineIndex, line] of lines.entries()) {
        const clientId = `seed-${pairKey}-${lineIndex}`;
        await Message.findOneAndUpdate(
          { conversationId: conversation._id, clientId },
          {
            $set: {
              eventId,
              senderId: line.from,
              body: line.body,
              expiresAt,
              createdAt: new Date(Date.now() - (lines.length - lineIndex) * 60_000)
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
        messages += 1;
        last = line;
      }

      // Every other thread leaves the last message unread for its recipient.
      const unreadFor = index % 2 === 0 ? String(b) : "";
      if (unreadFor) unreadThreads += 1;

      await Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessageAt: new Date(),
            lastMessagePreview: last!.body.slice(0, 120),
            lastMessageFrom: last!.from,
            unread: unreadFor ? { [unreadFor]: 1 } : {}
          }
        }
      );
    }
  }

  /* ---- groups ----------------------------------------------------------- */
  const groupPlans = [
    { title: "Front left, all night", category: "dancing", meetingArea: "dance-floor", maxMembers: 8 },
    { title: "Negroni committee", category: "drinks", meetingArea: "main-bar", maxMembers: 6 },
    { title: "New in Montréal", category: "new-friends", meetingArea: "patio", maxMembers: 10 },
    { title: "Creative freelancers", category: "networking", meetingArea: "vip-lounge", maxMembers: 8 },
    { title: "Smoke break crew", category: "hangout", meetingArea: "entrance", maxMembers: 5 }
  ] as const;

  let groupCount = 0;
  let groupMembers = 0;

  for (const [index, plan] of groupPlans.entries()) {
    const hostId = userIds[index * 5]!;
    const group = await Group.findOneAndUpdate(
      { eventId, title: plan.title },
      {
        $set: {
          venueId,
          description: "Synthetic staging group for testing discovery and joining.",
          category: plan.category,
          meetingArea: plan.meetingArea,
          maxMembers: plan.maxMembers,
          mode: "open",
          hostId,
          expiresAt
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    groupCount += 1;

    // The last group is deliberately filled, so the "full" state has a subject.
    const wanted = index === groupPlans.length - 1 ? plan.maxMembers : Math.max(2, plan.maxMembers - 3);
    for (let slot = 0; slot < wanted; slot += 1) {
      const memberId = userIds[(index * 5 + slot) % userIds.length]!;
      await GroupMember.findOneAndUpdate(
        { groupId: group._id, userId: memberId },
        { $set: { eventId, role: slot === 0 ? "host" : "member", expiresAt } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    const total = await GroupMember.countDocuments({ groupId: group._id });
    await Group.updateOne(
      { _id: group._id },
      { $set: { memberCount: total, status: total >= plan.maxMembers ? "full" : "open" } }
    );
    groupMembers += total;
  }

  const report: SeedReport = {
    database: target.database,
    eventId: String(eventId),
    users: userIds.length,
    profiles: await EventProfile.countDocuments({ eventId }),
    waves,
    passes,
    matches: await Match.countDocuments({ eventId }),
    conversations,
    messages,
    unreadThreads,
    groups: groupCount,
    groupMembers,
    competitionEntrants: people.filter((p) => p.competitionConsent).length
  };

  return report;
}

/** Removes only what this script created, leaving real staging data alone. */
export async function resetDatingStaging(options: { allowOverride?: boolean } = {}) {
  assertStagingTarget({ allowOverride: options.allowOverride });
  await connectDatabase();

  const seeded = await User.find({ email: new RegExp(`@${STAGING_EMAIL_DOMAIN}$`) }).select("_id");
  const ids = seeded.map((u) => u._id);
  if (!ids.length) return { removed: 0 };

  const conversations = await Conversation.find({ participants: { $in: ids } }).select("_id");
  const conversationIds = conversations.map((c) => c._id);

  await Message.deleteMany({ conversationId: { $in: conversationIds } });
  await GroupMessage.deleteMany({ senderId: { $in: ids } });
  await Conversation.deleteMany({ _id: { $in: conversationIds } });
  await Match.deleteMany({ participants: { $in: ids } });
  await ProfileSignal.deleteMany({ $or: [{ fromUserId: { $in: ids } }, { toUserId: { $in: ids } }] });
  await ProfileImpression.deleteMany({ $or: [{ userId: { $in: ids } }, { seenUserId: { $in: ids } }] });
  await Block.deleteMany({ $or: [{ blockerId: { $in: ids } }, { blockedId: { $in: ids } }] });
  await Report.deleteMany({ $or: [{ reporterId: { $in: ids } }, { subjectUserId: { $in: ids } }] });
  await GroupMember.deleteMany({ userId: { $in: ids } });
  await Group.deleteMany({ hostId: { $in: ids } });
  await EventProfile.deleteMany({ userId: { $in: ids } });
  await EventAccessPass.deleteMany({ userId: { $in: ids } });
  await Media.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });

  return { removed: ids.length };
}

/* Entry point for the npm scripts. */
const invokedDirectly = process.argv[1]?.includes("seed-dating");
if (invokedDirectly) {
  const allowOverride = process.argv.includes("--i-know-what-i-am-doing");
  const reset = process.argv.includes("--reset");
  const run = reset
    ? resetDatingStaging({ allowOverride }).then((r) => console.log(`removed ${r.removed} synthetic guests`))
    : seedDatingStaging({ allowOverride }).then((r) => console.table(r));

  run
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`\n${error instanceof Error ? error.message : error}\n`);
      process.exit(1);
    });
}
