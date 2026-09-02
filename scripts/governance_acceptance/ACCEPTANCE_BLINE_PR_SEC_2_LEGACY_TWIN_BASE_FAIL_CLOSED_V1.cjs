#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = process.cwd();
const INVENTORY = path.join(ROOT, "docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json");
const MODULE = path.join(ROOT, "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts");
const LEGACY_SOURCE = "apps/server/src/routes/v1/twin_kernel.ts";
const BATCH2_ACCEPTED_HEAD = "599604d7ace9c6c7cc09ba5fd761e3100d3f3403";

function fail(message, extra) {
  console.error("[BLINE_PRSEC2_LEGACY_TWIN_FAIL_CLOSE] FAIL:", message);
  if (extra !== undefined) console.error(typeof extra === "string" ? extra : JSON.stringify(extra, null, 2));
  process.exit(1);
}
function assert(condition, message, extra) { if (!condition) fail(message, extra); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function git(args) { return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim(); }

const inv = JSON.parse(read(INVENTORY));
const frozen = inv.surfaces ?? [];
const byId = new Map(frozen.map((row) => [row.surface_id, row]));

const CORRECTIONS = ["BSEC-001", "BSEC-002", "BSEC-005", "BSEC-018", "BSEC-019", "BSEC-031"];
const BATCH1 = ["BSEC-001", "BSEC-002"];
const BATCH2B = ["BSEC-003"];
const BATCH3 = ["BSEC-005", "BSEC-006", "BSEC-007", "BSEC-008", "BSEC-009", "BSEC-010"];
const ROUTES = [
  "/api/v1/twin-kernel/field-state-snapshots",
  "/api/v1/twin-kernel/forecast-runs",
  "/api/v1/twin-kernel/scenario-sets",
  "/api/v1/twin-kernel/calibration-replays",
  "/api/v1/twin-kernel/field-learning-candidates",
  "/api/v1/twin-kernel/decision-cycles",
];

assert(CORRECTIONS.length === 6 && new Set(CORRECTIONS).size === 6, "accepted correction set must contain exactly six rows");
for (const id of CORRECTIONS) {
  const row = byId.get(id);
  assert(row, "correction row missing from frozen inventory", id);
  assert(row.runtime_reachable === true, "correction row must be production reachable", id);
  assert(row.tenant_scope_from_untrusted_body === false, "correction must be false->true relative to frozen inventory", id);
}
assert(BATCH3.length === 6 && new Set(BATCH3).size === 6, "Batch-003B atomic set drift");
for (const id of BATCH3) assert(byId.has(id), "Batch-003B row missing", id);

function debt(rows) {
  const reachable = rows.filter((row) => row.runtime_reachable === true);
  const unauth = reachable.filter((row) => [
    "UNAUTHENTICATED_PRODUCTION_WRITER",
    "UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER",
    "WEAK_INTERNAL_BOUNDARY",
    "CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE",
  ].includes(row.caller_authority_status));
  const noCap = reachable.filter((row) =>
    row.authz_capability.length === 0 || [
      "UNAUTHENTICATED_PRODUCTION_WRITER",
      "UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER",
      "WEAK_INTERNAL_BOUNDARY",
      "CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE",
      "AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY",
      "AUTHENTICATED_BUT_CAPABILITY_MISMATCH",
      "AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY",
    ].includes(row.caller_authority_status),
  );
  const unverifiedActor = reachable.filter((row) => String(row.declared_actor_binding || "").includes("CALLER_DECLARED_NOT_AUTH_BOUND"));
  const serviceUnbound = reachable.filter((row) => String(row.principal_type || "").includes("SERVICE") && row.caller_authority_status === "SERVICE_IDENTITY_PARTIAL");
  const untrustedTenant = reachable.filter((row) => row.tenant_scope_from_untrusted_body === true);
  return [unauth.length, noCap.length, unverifiedActor.length, serviceUnbound.length, untrustedTenant.length];
}
function close(rows, ids) {
  const closed = new Set(ids);
  return rows.map((row) => closed.has(row.surface_id) ? { ...row, runtime_reachable: false } : row);
}
function delta(before, after) { return after.map((value, index) => value - before[index]); }

const frozenDebt = debt(frozen);
assert(JSON.stringify(frozenDebt) === JSON.stringify([35, 109, 7, 3, 16]), "frozen PR-SEC-1 machine debt drift", frozenDebt);

const correctionSet = new Set(CORRECTIONS);
const corrected = frozen.map((row) => correctionSet.has(row.surface_id)
  ? { ...row, tenant_scope_from_untrusted_body: true }
  : { ...row });
const changedCorrectionIds = corrected
  .filter((row, index) => row.tenant_scope_from_untrusted_body !== frozen[index].tenant_scope_from_untrusted_body)
  .map((row) => row.surface_id);
assert(JSON.stringify(changedCorrectionIds) === JSON.stringify(CORRECTIONS), "implicit tenant classification correction detected", changedCorrectionIds);

const correctedDebt = debt(corrected);
assert(JSON.stringify(delta(frozenDebt, correctedDebt)) === JSON.stringify([0, 0, 0, 0, 6]), "accepted correction arithmetic drift", { frozenDebt, correctedDebt });

const afterBatch1Rows = close(corrected, BATCH1);
const afterBatch1 = debt(afterBatch1Rows);
const afterBatch2Rows = close(afterBatch1Rows, BATCH2B);
const afterBatch2 = debt(afterBatch2Rows);
const afterBatch3Rows = close(afterBatch2Rows, BATCH3);
const afterBatch3 = debt(afterBatch3Rows);
const batch3Delta = delta(afterBatch2, afterBatch3);
assert(JSON.stringify(batch3Delta) === JSON.stringify([-6, -6, 0, 0, -1]), "Batch-003B machine-derived delta drift", { afterBatch2, afterBatch3, batch3Delta });

const moduleSource = read(MODULE);
const routeMatches = [...moduleSource.matchAll(/"(\/api\/v1\/twin-kernel\/[^"]+)"/g)].map((match) => match[1]);
assert(JSON.stringify(routeMatches) === JSON.stringify(ROUTES), "Commercial fail-close route set must be exact", routeMatches);
assert(moduleSource.includes("LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE"), "deterministic fail-close error missing");
assert(moduleSource.includes("registerTwinKernelV1Routes(guardedApp, pool)"), "legacy route registration must pass through Commercial guard");
assert(moduleSource.includes("LEGACY_TWIN_BASE_MUTATION_ROUTES.has(exactPath)"), "exact mutation route guard missing");
assert(moduleSource.includes("reply.code(403).send"), "deterministic 403 fail-close missing");
for (const forbidden of ["setTimeout", "setInterval", "setImmediate", "queueMicrotask", ".then(", "addHook", "callback", "queue", "MCFT", "mcft"]) {
  assert(!moduleSource.includes(forbidden), "forbidden deferred/cutover token in containment implementation", forbidden);
}

const legacyDiff = git(["diff", "--name-only", `${BATCH2_ACCEPTED_HEAD}..HEAD`, "--", LEGACY_SOURCE]);
assert(legacyDiff === "", "legacy Twin source/GET-read semantics must remain byte-unchanged from accepted Batch 2 head", legacyDiff);

const changed = git(["diff", "--name-only", `${BATCH2_ACCEPTED_HEAD}..HEAD`]).split(/\r?\n/).filter(Boolean);
const allowed = new Set([
  "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_TWIN_BASE_FAIL_CLOSED_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEATHER_INGEST_FAIL_CLOSED_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_TWIN_BASE_FAIL_CLOSED_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_TWIN_BASE_COMMERCIAL_RUNTIME_V1.ts",
  ".github/workflows/bline-pr-sec2-containment.yml",
]);
const unexpected = changed.filter((file) => !allowed.has(file));
assert(unexpected.length === 0, "Batch-003B changed-file scope expansion", unexpected);
assert(!changed.some((file) => /mcft/i.test(file)), "Batch-003B MCFT implementation delta must be zero", changed.filter((file) => /mcft/i.test(file)));

console.log(JSON.stringify({
  result: "PASS",
  batch: "PRSEC2-BATCH-003B",
  containment: "COMMERCIAL_FAIL_CLOSE",
  correction_set: CORRECTIONS,
  correction_set_size: CORRECTIONS.length,
  frozen_prsec1: frozenDebt,
  corrected_prsec1: correctedDebt,
  accepted_batch1_after: afterBatch1,
  accepted_batch2_after: afterBatch2,
  batch3_atomic_set: BATCH3,
  batch3_delta: batch3Delta,
  batch3_computed_after: afterBatch3,
  exact_routes: ROUTES,
  legacy_twin_source_unchanged: true,
  batch3_changed_files: changed,
  mcft_delta: 0,
}, null, 2));
