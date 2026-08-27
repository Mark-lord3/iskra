# Running the server tests

    npm test

Most of these tests exercise the real API over HTTP against the real database,
so a server must already be listening on `:4310`.

Start it with a raised login limit, or the auth tests will fail with `429`:

    ADMIN_LOGIN_RATE_LIMIT_MAX=500 node src/index.js

The suite makes far more than the production budget of 10 login attempts per
15 minutes — the lockout test alone burns most of it — and the limiter counts
every request from `127.0.0.1` together. A `429` where a test expected `401`
or `200` means the limiter, not a broken assertion. Rate limiting itself stays
fully enforced; only the test server's ceiling is raised.

The suite runs with `--test-concurrency=1`: the files share one server and one
database, so running them in parallel makes them interfere.

The poker tests (`poker-*.test.js`) are pure and need neither a server nor a
database.
