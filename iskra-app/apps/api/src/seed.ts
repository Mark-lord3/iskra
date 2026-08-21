import { connectDatabase } from "./db";
import { Event } from "./models/Event";
import { Venue } from "./models/Venue";
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

  console.log("Iskra seed complete.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

