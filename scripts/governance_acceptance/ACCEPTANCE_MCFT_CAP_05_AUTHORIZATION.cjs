// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_AUTHORIZATION.cjs
// Purpose: verify the MCFT-CAP-05 S0 authorization candidate and its PostgreSQL-derived CAP-04 predecessor lock.
// Boundary: static repository checks only; no Runtime execution, database mutation, migration, canonical write, route, web, AO-ACT, scheduler, or CAP-06 authorization.

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const repoRoot = process.cwd();
const baseline = process.env.MCFT_CAP_05_S0_BASELINE || "2d4d00aec8cd1e925687ee67e5de429c324cc1b2";
const postmerge = process.argv.includes("--postmerge");
const s0 = "MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1";
const s1 = "MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1";

const files = {
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  matrix: "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  task: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  authorization: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION.md",
  authorizationStatus: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  predecessorLock: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json",
  deliveryStatus: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  alignment: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S0-ALIGNMENT-REVIEW.md",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_AUTHORIZATION.cjs",
  preflight: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PREDECESSOR_PREFLIGHT.ts",
};
const expectedChangedFiles = Object.values(files).sort();
let passCount = 0;
let failCount = 0;
function pass(label) { passCount += 1; console.log(`PASS ${label}`); }
function fail(label, detail = "") { failCount += 1; console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`); }
function check(condition, label, detail = "") { if (condition) pass(label); else fail(label, detail); }
function read(relativePath) { return fs.readFileSync(path.join(repoRoot, relativePath), "utf8"); }
function json(relativePath) { return JSON.parse(read(relativePath)); }
function git(args) { return childProcess.execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim(); }
function cap(matrix, id) { return matrix.capability_lines.find((entry) => entry.capability_line_id === id); }

for (const relativePath of expectedChangedFiles) check(fs.existsSync(path.join(repoRoot, relativePath)), `file exists ${relativePath}`);

const matrix = json(files.matrix);
const task = read(files.task);
const authorization = read(files.authorization);
const authorizationStatus = json(files.authorizationStatus);
const lock = json(files.predecessorLock);
const delivery = json(files.deliveryStatus);
const alignment = read(files.alignment);
const implementationMap = read(files.map);
const cap04 = cap(matrix, "MCFT-CAP-04");
const cap05 = cap(matrix, "MCFT-CAP-05");

check(task.includes("完整任务线 v0.4"), "task v0.4 authority retained");
check(task.includes(`active_delivery_slice_id:\n${s0}`), "task active S0 candidate exact");
check(task.includes("S0 status:\nREADY_FOR_MERGE"), "task records S0 readiness");
check(task.includes("predecessor checkpoint sequence:\n72"), "task locks checkpoint 72");
check(task.includes("canonical next logical tick:\n2026-06-04T02:00:00.000Z"), "task locks next tick");
check(task.includes("S1 authorized:\nfalse"), "task preserves S1 block");

check(lock.schema_version === "geox_mcft_cap_05_predecessor_lock_v1", "predecessor lock schema exact");
check(lock.status === "COMPLETE", "predecessor lock complete");
check(lock.baseline_main_commit === baseline, "predecessor lock baseline exact");
check(lock.identity_extraction_source === "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH", "PostgreSQL canonical read authority exact");
check(lock.expected_checkpoint.checkpoint_sequence === 72, "checkpoint sequence 72");
check(lock.expected_checkpoint.last_logical_time === "2026-06-04T01:00:00.000Z", "latest logical time exact");
check(lock.expected_checkpoint.next_tick_logical_time === "2026-06-04T02:00:00.000Z", "next logical tick exact");
const identity = lock.canonical_identity;
for (const key of [
  "active_lineage_ref", "active_lineage_hash", "lineage_id", "revision_id",
  "latest_posterior_state_ref", "latest_posterior_state_hash",
  "latest_checkpoint_ref", "latest_checkpoint_hash",
  "latest_forecast_result_ref", "latest_forecast_result_hash",
  "latest_successful_forecast_ref", "latest_successful_forecast_hash",
  "latest_scenario_set_ref", "latest_scenario_set_hash",
  "predecessor_state_runtime_config_ref", "predecessor_state_runtime_config_hash",
  "reality_binding_ref", "reality_binding_hash",
]) check(typeof identity[key] === "string" && identity[key].length > 0, `lock identity ${key} present`);
check(identity.latest_forecast_result_ref === identity.latest_successful_forecast_ref, "latest Forecast equals latest successful Forecast");
check(identity.latest_forecast_result_hash === identity.latest_successful_forecast_hash, "latest Forecast hash equals successful Forecast hash");
check(lock.validated_relations.includes("latest_scenario_source_forecast_ref_hash_matches_latest_successful_forecast"), "Scenario-to-Forecast relation locked");
check(lock.failure_policy.active_config_pointer_substitution === "FORBIDDEN", "active-config substitution forbidden");
check(lock.failure_policy.fixture_object_id_substitution === "FORBIDDEN", "fixture identity substitution forbidden");
check(lock.failure_policy.predecessor_fact_mutation === "FORBIDDEN", "predecessor mutation forbidden");

check(authorizationStatus.status === "READY_FOR_MERGE", "authorization status READY_FOR_MERGE");
check(authorizationStatus.design_status === "DESIGN_FROZEN_CANDIDATE_V0_4", "design candidate frozen");
check(authorizationStatus.implementation_status === "NOT_AUTHORIZED", "implementation not authorized");
check(authorizationStatus.authorization_effective === false, "authorization not effective premerge");
check(authorizationStatus.runtime_source_authorized === false, "Runtime source unauthorized premerge");
check(authorizationStatus.active_delivery_slice_id === s0, "authorization active S0 exact");
check(authorizationStatus.predecessor.postgresql_canonical_lock_status === "COMPLETE", "authorization sees complete predecessor lock");
check(authorizationStatus.predecessor.checkpoint_sequence === 72, "authorization checkpoint exact");
check(authorizationStatus.predecessor.latest_successful_forecast_ref === identity.latest_successful_forecast_ref, "authorization Forecast ref matches lock");
check(authorizationStatus.predecessor.latest_scenario_set_ref === identity.latest_scenario_set_ref, "authorization Scenario ref matches lock");
check(authorizationStatus.next_authorized_slice_id_after_effectiveness === s1, "authorization next slice exact");
check(authorizationStatus.successor_authorized === false, "CAP-06 unauthorized");
check(JSON.stringify([...authorizationStatus.exact_changed_file_boundary].sort()) === JSON.stringify(expectedChangedFiles), "authorization exact changed-file boundary");

check(delivery.status === "S0_READY_FOR_MERGE", "delivery status S0 ready");
check(delivery.active_delivery_slice_id === s0, "delivery active S0 exact");
check(delivery.runtime_source_authorized === false, "delivery Runtime source unauthorized");
check(delivery.authorization_effective === false, "delivery authorization premerge false");
check(delivery.next_authorized_slice_ids.length === 0, "no premerge authorized downstream slice");
check(delivery.next_authorized_slice_id_after_merge_and_postmerge_gate === s1, "delivery next slice exact");
check(delivery.slices.some((slice) => slice.delivery_slice_id === s0 && slice.status === "READY_FOR_MERGE"), "S0 slice present and ready");
check(delivery.slices.some((slice) => slice.delivery_slice_id === s1 && slice.status === "BLOCKED"), "S1 remains blocked");

check(cap04.status === "COMPLETE" && cap04.implementation_status === "COMPLETE", "CAP-04 remains complete");
check(cap04.active_delivery_slice_id === null, "CAP-04 active slice remains null");
check(cap05.status === "NOT_AUTHORIZED", "CAP-05 matrix status not authorized");
check(cap05.authorization_status === "READY_FOR_MERGE", "CAP-05 matrix authorization ready");
check(cap05.authorization_effective === false, "CAP-05 matrix authorization not effective");
check(cap05.runtime_source_authorized === false, "CAP-05 matrix Runtime source unauthorized");
check(cap05.active_delivery_slice_id === s0, "CAP-05 matrix active S0");
check(cap05.next_delivery_slice_id === s1 && cap05.next_delivery_slice_authorized === false, "CAP-05 matrix S1 blocked");
check(cap05.predecessor_lock_ref === files.predecessorLock, "CAP-05 matrix predecessor lock ref exact");
check(cap05.successor_authorized === false, "CAP-05 matrix CAP-06 blocked");

check(authorization.includes("P0 postmerge workflow: 29305450785 SUCCESS"), "authorization pins P0 postmerge Gate");
check(authorization.includes(`latest_successful_forecast_ref: ${identity.latest_successful_forecast_ref}`), "authorization pins successful Forecast");
check(authorization.includes(`latest_scenario_set_ref: ${identity.latest_scenario_set_ref}`), "authorization pins Scenario Set");
check(alignment.includes("PostgreSQL canonical predecessor lock: PASS"), "alignment PostgreSQL lock PASS");
check(alignment.includes("Runtime source exclusion: PASS"), "alignment Runtime exclusion PASS");
check(implementationMap.includes("MCFT-CAP-05-S0-AUTHORIZATION-START"), "implementation map contains S0 section");
check(implementationMap.includes("S0 authorization: READY_FOR_MERGE"), "implementation map S0 readiness exact");
check(implementationMap.includes("successor MCFT-CAP-06 authorized: false"), "implementation map successor block exact");

let changedFiles = [];
try {
  const range = postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`;
  changedFiles = git(["diff", "--name-only", range]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changedFiles) === JSON.stringify(expectedChangedFiles), "git exact changed-file boundary", JSON.stringify(changedFiles));
} catch (error) { fail("git exact changed-file boundary", error.message); }

const forbiddenPrefixes = ["apps/server/src/", "apps/server/db/migrations/", "apps/web/", "fixtures/", "apps/server/scripts/mcft/"];
for (const changed of changedFiles) check(!forbiddenPrefixes.some((prefix) => changed.startsWith(prefix)), `no forbidden path ${changed}`);
try { git(["diff", "--check", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]); pass("git diff --check"); } catch (error) { fail("git diff --check", error.message); }

console.log(`SUMMARY ${passCount} PASS, ${failCount} FAIL`);
if (failCount > 0) process.exit(1);
