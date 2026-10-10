#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const path = require("node:path");
const p = require("./PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs");
const source = p.verifySources();
assert.equal(source.deployment_binding.frozen_source_runtime_matches_current_baseline, true);
assert.equal(source.deployment_binding.image_contents_attested, false);
assert.equal(source.deployment_binding.owner_qualified, false);
for (const [key, value] of [
  ["deployment_subject", source.contract.adopted_baseline],
  ["image_id", "sha256:" + "a".repeat(64)],
  ["image_tag", "geox-mcft-cap09-runtime:" + source.contract.adopted_baseline],
  ["image_contents_attested", true],
  ["qualification_subject_equals_deployment_subject_required", true],
  ["qualification_subject_retagging_allowed", true],
  ["production_recovery_authorized", true]
]) {
  const altered = structuredClone(source.contract);
  altered.deployment_observation[key] = value;
  assert.throws(() => p.verifyDeploymentBinding(altered, []));
}
const record = (role, status, age) => ({log_age_seconds: age,
  recent_health_records: [{runtime_role: role, status}]});
assert.equal(p.diagnoseHealth().status, "NOT_OBSERVED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "DEGRADED", 42901)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "HEALTHY", 181)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "HEALTHY", -6)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("UNKNOWN_ROLE", "HEALTHY", 0)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "STARTING", 0)).status, "BLOCKED");
for (const [role, status] of [["EVIDENCE_RUNTIME", "HEALTHY"], ["EVIDENCE_RUNTIME", "STANDBY"],
  ["TWIN_RUNTIME", "OWNER_LEASE_HEALTHY"]]) {
  const health = p.diagnoseHealth(record(role, status, 11));
  assert.equal(health.status, "HEALTH_PRECONDITION_ONLY");
  assert.equal(health.owner_qualified, false);
}
const observed = p.prepare({source, now: new Date("2026-10-10T02:34:00.000Z"),
  evidence: record("EVIDENCE_RUNTIME", "DEGRADED", 42901),
  twin: record("TWIN_RUNTIME", "OWNER_LEASE_HEALTHY", 11)});
assert.equal(observed.recovery.evidence.status, "BLOCKED");
assert.equal(observed.recovery.twin.status, "HEALTH_PRECONDITION_ONLY");
assert.equal(observed.qualification.historical_producer_arm_currently_future, false);
assert.equal(observed.qualification.lead_applies_to, "QUALIFICATION_FIRST_BASE_TARGET_NOT_PROGRAM_START");
assert.equal(observed.qualification.first_base_must_be_after, "2026-10-10T08:34:00.000Z");
assert.equal(observed.recovery.all_25_context_coverage_verified, false);
for (const now of ["2026-10-10T02:34:00.000Z", "2026-10-10T04:00:00.000Z", "2026-10-11T04:00:00.000Z"]) {
  const plan = p.prepare({source, now: new Date(now)});
  assert.equal(plan.status, "PREPARATION_COMPLETE_EXECUTION_BLOCKED");
  assert.equal(plan.qualification_pass, false);
  assert.equal(plan.recovery.recovery_executor_authorized, false);
  assert.equal(plan.qualification.historical_producer_arm_reused, false);
  for (const allowed of Object.values(plan.effects_authorized)) assert.equal(allowed, false);
}
assert.throws(() => p.prepare({source, now: new Date("invalid")}), /PREPARATION_CLOCK_INVALID/);
const forbidden = cp.spawnSync(process.execPath,
  [path.join(__dirname, "PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs"), "--execute"], {encoding: "utf8"});
assert.equal(forbidden.status, 1);
assert.match(forbidden.stderr, /ONLY_PLAN_ONLY_SUPPORTED_NO_EXECUTION_AUTHORITY/);
console.log(JSON.stringify({status: "PASS", qualification: "READ_ONLY_PREPARATION_BOUNDARY_ONLY",
  frozen_runtime_paths_verified: source.frozen_runtime_paths_verified,
  owner_qualified: false, producer_qualified: false, timing_qualified: false,
  production_effects_authorized: false}, null, 2));
