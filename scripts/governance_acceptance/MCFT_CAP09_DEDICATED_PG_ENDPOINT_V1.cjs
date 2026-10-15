"use strict";
// Qualification-only exact endpoint binding. No production or shared-instance fallback.
const assert = require("node:assert/strict");
const RUN = "800c023cf337";
const HOST = "127.0.0.1";
const PORT = 55434;
// Reviewed resource contracts only: registration does not adopt or authorize a run.
const CONTRACTS = Object.freeze({
  [RUN]: Object.freeze({database_port: PORT, audit_user: "qual_dedicated_admin", bucket_endpoint: "http://127.0.0.1:59000"}),
  da9db7129607: Object.freeze({database_port: 55445, audit_user: "qual_admin", bucket_endpoint: "http://127.0.0.1:59005"})
});
function dedicatedContract(runId) {
  return Object.hasOwn(CONTRACTS, runId) ? CONTRACTS[runId] : null;
}
function requireContract(runId) {
  const contract = dedicatedContract(runId);
  assert(contract, "DEDICATED_PG_RUN_ID_REQUIRED");
  return contract;
}
function assertDedicatedPgEndpoint(runId, resource) {
  const contract = requireContract(runId);
  assert(resource && typeof resource === "object", "DEDICATED_PG_RESOURCE_REQUIRED");
  assert.equal(resource.database_host, HOST, "DEDICATED_PG_LOOPBACK_REQUIRED");
  assert.equal(resource.database_port, contract.database_port, "DEDICATED_PG_PORT_REQUIRED");
  return true;
}
function assertDedicatedPgUrl(runId, raw, dbName) {
  const contract = requireContract(runId);
  assert(["positive", "negative"].some(side => dbName === `mcft_cap09_requal_${runId}_${side}`), "DEDICATED_PG_DATABASE_RUN_REQUIRED");
  const u = new URL(raw);
  assert(["postgres:", "postgresql:"].includes(u.protocol), "DEDICATED_PG_SCHEME_REQUIRED");
  assert.equal(u.hostname, HOST, "DEDICATED_PG_LOOPBACK_REQUIRED");
  assert.equal(u.port, String(contract.database_port), "DEDICATED_PG_PORT_REQUIRED");
  assert.equal(u.search, "", "DEDICATED_PG_QUERY_FORBIDDEN");
  assert.equal(u.hash, "", "DEDICATED_PG_FRAGMENT_FORBIDDEN");
  assert.equal(decodeURIComponent(u.pathname.slice(1)), dbName, "DEDICATED_PG_DATABASE_REQUIRED");
  return true;
}
module.exports = {RUN, HOST, PORT, dedicatedContract, assertDedicatedPgEndpoint, assertDedicatedPgUrl};
