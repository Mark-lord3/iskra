import { connectDatabase } from "./db";
import { Event } from "./models/Event";
import { Venue } from "./models/Venue";
import { VenueZone } from "./models/VenueZone";
import { getCleanupAt } from "./services/cleanup-service";

export async function seed() {
  await connectDatabase();

  const venue = await Venue.findOneAndUpdate(
    { slug: "club-iskra" },
    {
      slug: "club-iskra",
      name: "Club Iskra",
      description: "An electric late-night social experience.",
      locationLabel: "Toronto",
      defaultPriceCents: 500,
      zones: ["Entrance", "Main Bar", "Dance Floor", "Patio", "VIP Lounge"]
    },
    { upsert: true, new: true }
  );

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 6 * 60 * 60_000);

  await Event.findOneAndUpdate(
    { slug: "club-iskra-tonight" },
    {
      venueId: venue._id,
      slug: "club-iskra-tonight",
      name: "Iskra Tonight",
      startsAt,
      endsAt,
      cleanupAt: getCleanupAt(endsAt),
      priceCents: 500,
      status: "active"
    },
    { upsert: true, new: true }
  );

  const venueZones = [
    { slug: "entrance", name: "Entrance", floor: 1, x: 8, y: 48 },
    { slug: "main-bar", name: "Main Bar", floor: 1, x: 34, y: 25 },
    { slug: "dance-floor", name: "Dance Floor", floor: 1, x: 60, y: 48 },
    { slug: "patio", name: "Patio", floor: 1, x: 88, y: 72 },
    { slug: "vip-lounge", name: "VIP Lounge", floor: 2, x: 58, y: 28 }
  ];
  await Promise.all(venueZones.map((zone) => VenueZone.findOneAndUpdate(
    { venueId: venue._id, slug: zone.slug },
    { ...zone, venueId: venue._id, active: true, visible: true, freshnessSeconds: 90 },
    { upsert: true, new: true }
  )));

  console.log("Iskra seed complete.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
