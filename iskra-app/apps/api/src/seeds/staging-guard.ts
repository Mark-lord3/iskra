import { env } from "../config/env";

/**
 * Refuse to touch anything that looks like production.
 *
 * This runs before a connection is opened, not after, so a mistake costs
 * nothing. The checks are deliberately broad: a seed script that wrongly
 * refuses is a minor annoyance, one that wrongly proceeds is unrecoverable.
 */
export class ProductionGuardError extends Error {}

const PRODUCTION_HINTS = [/prod/i, /production/i, /live/i];
const STAGING_HINTS = [/stag/i, /test/i, /dev/i, /local/i];

/** The database name from a Mongo URI, ignoring any query string. */
export function databaseNameFrom(uri: string): string {
  const withoutQuery = uri.split("?")[0] ?? "";
  const afterHost = withoutQuery.split("/").slice(3).join("/");
  return afterHost || "";
}

export type GuardInput = {
  mongoUri?: string;
  clientOrigin?: string;
  nodeEnv?: string;
  allowOverride?: boolean;
};

export function assertStagingTarget(input: GuardInput = {}): { database: string; origin: string } {
  const mongoUri = input.mongoUri ?? env.MONGODB_URI;
  const clientOrigin = input.clientOrigin ?? env.CLIENT_ORIGIN;
  const nodeEnv = input.nodeEnv ?? env.NODE_ENV;
  const database = databaseNameFrom(mongoUri);
  const reasons: string[] = [];

  if (nodeEnv === "production") reasons.push("NODE_ENV is production");
  if (!database) reasons.push("the MongoDB URI names no database");
  if (PRODUCTION_HINTS.some((r) => r.test(database))) reasons.push(`database "${database}" looks like production`);
  if (PRODUCTION_HINTS.some((r) => r.test(clientOrigin))) reasons.push(`CLIENT_ORIGIN "${clientOrigin}" looks like production`);

  /* A name that says nothing either way is refused too. Seeding a hundred
     fake people into a database nobody has labelled is not worth the risk. */
  const looksLikeStaging =
    STAGING_HINTS.some((r) => r.test(database)) || STAGING_HINTS.some((r) => r.test(clientOrigin));
  if (!looksLikeStaging) {
    reasons.push(`neither database "${database}" nor origin "${clientOrigin}" is identifiably staging`);
  }

  if (reasons.length && !input.allowOverride) {
    throw new ProductionGuardError(
      `Refusing to seed. ${reasons.join("; ")}. ` +
        "Point MONGODB_URI and CLIENT_ORIGIN at staging, or pass --i-know-what-i-am-doing."
    );
  }

  return { database, origin: clientOrigin };
}
