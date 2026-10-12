"use strict";
// Qualification-only exact endpoint binding. No production or shared-instance fallback.
const assert = require("node:assert/strict");
const RUN = "800c023cf337";
const HOST = "127.0.0.1";
const PORT = 55434;
function assertDedicatedPgEndpoint(runId, resource) {
  assert.equal(runId, RUN, "DEDICATED_PG_RUN_ID_REQUIRED");
  assert(resource && typeof resource === "object", "DEDICATED_PG_RESOURCE_REQUIRED");
  assert.equal(resource.database_host, HOST, "DEDICATED_PG_LOOPBACK_REQUIRED");
  assert.equal(resource.database_port, PORT, "DEDICATED_PG_PORT_REQUIRED");
  return true;
}
function assertDedicatedPgUrl(runId, raw, dbName) {
  assert.equal(runId, RUN, "DEDICATED_PG_RUN_ID_REQUIRED");
  const u = new URL(raw);
  assert(["postgres:", "postgresql:"].includes(u.protocol), "DEDICATED_PG_SCHEME_REQUIRED");
  assert.equal(u.hostname, HOST, "DEDICATED_PG_LOOPBACK_REQUIRED");
  assert.equal(u.port, String(PORT), "DEDICATED_PG_PORT_REQUIRED");
  assert.equal(u.search, "", "DEDICATED_PG_QUERY_FORBIDDEN");
  assert.equal(u.hash, "", "DEDICATED_PG_FRAGMENT_FORBIDDEN");
  assert.equal(decodeURIComponent(u.pathname.slice(1)), dbName, "DEDICATED_PG_DATABASE_REQUIRED");
  return true;
}
module.exports = {RUN, HOST, PORT, assertDedicatedPgEndpoint, assertDedicatedPgUrl};
