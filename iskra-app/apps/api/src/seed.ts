import mongoose from "mongoose";
import { connectDatabase } from "./db";
import { VenueZone } from "./models/VenueZone";
import { syncCurrentPromoEvent } from "./services/promo-event-sync";

export async function seed() {
  await connectDatabase();

  const { venue } = await syncCurrentPromoEvent({ force: true });

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

seed()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
