import { env } from "../config/env";
import { Event } from "../models/Event";
import { Venue } from "../models/Venue";
import { getCleanupAt } from "./cleanup-service";

type PromoEvent = {
  slug?: string;
  title?: string;
  date?: string;
  room?: string;
  address?: string;
  active?: boolean;
};

const ACTIVE_EVENT_SLUG = "club-iskra-tonight";
const EVENT_DURATION_MS = 5 * 60 * 60_000;
let lastSyncAt = 0;

function promoEventsUrl() {
  return `${env.PROMO_API_URL.replace(/\/$/, "")}/events`;
}

function selectEvent(events: PromoEvent[]) {
  const oldestAllowed = Date.now() - EVENT_DURATION_MS;
  return events
    .filter((event) => event.active !== false && event.date && new Date(event.date).getTime() > oldestAllowed)
    .sort((left, right) => new Date(left.date!).getTime() - new Date(right.date!).getTime())[0];
}

export async function syncCurrentPromoEvent(options: { force?: boolean } = {}) {
  const existing = await Event.findOne({ slug: ACTIVE_EVENT_SLUG });
  if (!options.force && existing && Date.now() - lastSyncAt < 60_000) {
    const venue = await Venue.findById(existing.venueId);
    if (venue) return { event: existing, venue };
  }

  const response = await fetch(promoEventsUrl(), { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw Object.assign(new Error("The event schedule is temporarily unavailable."), { status: 503 });
  const selected = selectEvent(await response.json() as PromoEvent[]);
  if (!selected) throw Object.assign(new Error("No active ISKRA event is scheduled."), { status: 503 });

  const venue = await Venue.findOneAndUpdate(
    { slug: "project-iskra-venue" },
    {
      slug: "project-iskra-venue",
      name: selected.room || "Project ISKRA",
      description: selected.address || "Montréal, Québec",
      locationLabel: selected.address || "Montréal, Québec",
      defaultPriceCents: 500,
      zones: ["Entrance", "Main Bar", "Dance Floor", "Patio", "VIP Lounge"]
    },
    { upsert: true, new: true }
  );
  const startsAt = new Date(selected.date!);
  const endsAt = new Date(startsAt.getTime() + EVENT_DURATION_MS);
  const event = await Event.findOneAndUpdate(
    { slug: ACTIVE_EVENT_SLUG },
    {
      venueId: venue._id,
      sourceEventSlug: selected.slug,
      slug: ACTIVE_EVENT_SLUG,
      name: selected.title || "Project ISKRA",
      startsAt,
      endsAt,
      cleanupAt: getCleanupAt(endsAt),
      priceCents: 500,
      status: "active"
    },
    { upsert: true, new: true }
  );
  lastSyncAt = Date.now();
  return { event, venue };
}
