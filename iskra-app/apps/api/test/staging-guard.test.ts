import test from "node:test";
import assert from "node:assert/strict";
import { assertStagingTarget, databaseNameFrom, ProductionGuardError } from "../src/seeds/staging-guard";

const guard = (mongoUri: string, clientOrigin: string, nodeEnv = "development") =>
  assertStagingTarget({ mongoUri, clientOrigin, nodeEnv });

const STAGING_URI = "mongodb://127.0.0.1:27018/iskra_dating_staging";
const STAGING_ORIGIN = "https://dating-staging.orvadora.com";

test("a staging database and origin are accepted", () => {
  const result = guard(STAGING_URI, STAGING_ORIGIN);
  assert.equal(result.database, "iskra_dating_staging");
});

test("the database name is read from the URI, not the host", () => {
  assert.equal(databaseNameFrom("mongodb://127.0.0.1:27018/iskra_app"), "iskra_app");
  assert.equal(databaseNameFrom("mongodb+srv://u:p@cluster0.example.net/iskra_staging?retryWrites=true"), "iskra_staging");
  assert.equal(databaseNameFrom("mongodb://host:27017/"), "");
});

test("a production database name is refused", () => {
  for (const name of ["iskra_production", "iskra_prod", "dating_live"]) {
    assert.throws(
      () => guard(`mongodb://127.0.0.1:27018/${name}`, STAGING_ORIGIN),
      ProductionGuardError,
      name
    );
  }
});

test("a production client origin is refused even with a staging database", () => {
  assert.throws(
    () => guard(STAGING_URI, "https://dating.orvadora.com/prod"),
    ProductionGuardError
  );
});

test("NODE_ENV=production is refused outright", () => {
  assert.throws(() => guard(STAGING_URI, STAGING_ORIGIN, "production"), ProductionGuardError);
});

test("a URI naming no database is refused", () => {
  assert.throws(() => guard("mongodb://127.0.0.1:27018/", STAGING_ORIGIN), ProductionGuardError);
});

test("an unlabelled database is refused rather than assumed safe", () => {
  // Nothing here says production, but nothing says staging either.
  assert.throws(
    () => guard("mongodb://127.0.0.1:27018/iskra_app", "https://app.orvadora.com"),
    ProductionGuardError
  );
});

test("the refusal explains every reason it found, not just the first", () => {
  try {
    guard("mongodb://127.0.0.1:27018/iskra_production", "https://dating.orvadora.com/production", "production");
    assert.fail("should have refused");
  } catch (error) {
    const message = (error as Error).message;
    assert.match(message, /NODE_ENV is production/);
    assert.match(message, /looks like production/);
    assert.match(message, /MONGODB_URI and CLIENT_ORIGIN/);
  }
});

test("an explicit override is honoured, so the guard is not a dead end", () => {
  const result = assertStagingTarget({
    mongoUri: "mongodb://127.0.0.1:27018/iskra_production",
    clientOrigin: "https://dating.orvadora.com",
    nodeEnv: "development",
    allowOverride: true
  });
  assert.equal(result.database, "iskra_production");
});
