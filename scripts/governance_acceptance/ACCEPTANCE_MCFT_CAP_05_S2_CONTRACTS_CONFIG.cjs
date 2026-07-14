// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S2_CONTRACTS_CONFIG.cjs
// Purpose: verify the exact MCFT-CAP-05 S2 pure-contract, projection-math and Runtime Config candidate boundary.
// Boundary: static governance checks only; no database, migration, canonical append, route, web, scheduler or network mutation.

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = process.cwd();
const baseline = process.env.MCFT_CAP_05_S2_BASELINE || "552d19505f0cd93584c899665b7d7b339f67e9fe";
const postmerge = process.argv.includes("--postmerge");
const s2 = "MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1";
const s3 = "MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1";
const files = {
  decision: "apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.ts",
  adapter: "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
  decisionPolicy: "apps/server/src/domain/twin_runtime/decision_second_write_policy_v1.ts",
  cycle: "apps/server/src/domain/twin_runtime/feedback_cycle_projection_v1.ts",
  config: "apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.ts",
  residual: "apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts",
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  matrix: "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  auth: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  delivery: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  contract: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md",
  status: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-STATUS.json",
  task: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S2_CONTRACTS_CONFIG.cjs",
  runtimeAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts",
};
const expected = Object.values(files).sort();
let pass = 0;
let fail = 0;
function check(condition, label, detail = "") { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`); } }
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function git(args) { return cp.execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
function cap(matrix, id) { return matrix.capability_lines.find((entry) => entry.capability_line_id === id); }
for (const file of expected) check(fs.existsSync(path.join(root, file)), `file exists ${file}`);
const status = json(files.status);
const matrix = json(files.matrix);
const auth = json(files.auth);
const delivery = json(files.delivery);
const task = read(files.task);
const map = read(files.map);
const contract = read(files.contract);
const decision = read(files.decision);
const adapter = read(files.adapter);
const config = read(files.config);
const residual = read(files.residual);
const cycle = read(files.cycle);
const cap05 = cap(matrix, "MCFT-CAP-05");
check(status.schema_version === "geox_mcft_cap_05_s2_status_v1", "S2 status schema exact");
check(status.status === "IMPLEMENTATION_CANDIDATE" && status.baseline_main_commit === baseline, "S2 status and baseline exact");
check(status.s1_effectiveness.effective === true && status.s1_effectiveness.merged_main_gate === "PASS", "S1 effectiveness recorded");
check(status.contracts.new_canonical_object_types.length === 0 && status.contracts.new_transaction_families.length === 0, "no new DT-02 object or transaction family");
check(status.math.projection_method_id === "FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1", "H1 projection method exact");
check(status.math.fixed_point_authority === true, "fixed-point math authority");
check(status.runtime_config.chain_length === 8 && status.runtime_config.parent_ref_authority === "PREDECESSOR_STATE_BOUND_RUNTIME_CONFIG", "Runtime Config chain authority exact");
check(status.canonical_twin_object_fact_delta === 0 && status.migration_delta === 0, "S2 fact and migration delta zero");
check(status.next_delivery_slice_id === s3 && status.next_delivery_slice_authorized === false, "S3 remains blocked");
check(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(expected), "status exact changed-file boundary");
check(auth.active_delivery_slice_id === s2 && auth.implementation_status === "S2_IMPLEMENTATION_CANDIDATE", "authorization status active S2");
check(delivery.active_delivery_slice_id === s2 && delivery.status === "S2_IMPLEMENTATION_CANDIDATE", "delivery status active S2");
check(delivery.slices.some((item) => item.delivery_slice_id === s2 && item.status === "IMPLEMENTATION_CANDIDATE"), "S2 delivery candidate present");
check(delivery.slices.some((item) => item.delivery_slice_id === s3 && item.status === "BLOCKED"), "S3 delivery remains blocked");
check(cap05.active_delivery_slice_id === s2 && cap05.next_delivery_slice_id === s3 && cap05.next_delivery_slice_authorized === false, "matrix S2 active S3 blocked");
check(task.includes(s2) && /S2 status:\s*IMPLEMENTATION_CANDIDATE/s.test(task), "task records S2 candidate");
check(/S3 authorized:\s*false/s.test(task), "task preserves S3 block");
check(map.includes("MCFT-CAP-05-S2-CONTRACTS-CONFIG-START") && map.includes("canonical fact delta: 0"), "implementation map S2 section exact");
check(contract.includes("Forecast Residual") && contract.includes("remains distinct from") && contract.includes("Assimilation Innovation"), "contract separates residual and innovation");
check(decision.includes("G_HUMAN_DECISION_LINK_COMMIT") && decision.includes("H_ACTION_FEEDBACK_COMMIT"), "Decision and Action Feedback reuse G/H");
check(decision.includes("GEOX_SCENARIO_OPTION_MEMBER_REF_BY_OPTION_ID_V1"), "semantic option member reference policy frozen");
check(adapter.includes("ExecutedIrrigationCandidateV1") && adapter.includes("EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1"), "adapter and single-event guard frozen");
check(config.includes("HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1") && config.includes("CAP05_CONFIG_CHAIN_LENGTH_V1 = 8"), "CAP-05 Runtime Config purpose and length exact");
check(config.includes("CAP04_CONFIG_SELECTION_MODE_V1") && config.includes("PERSISTED_PREDECESSOR_CHAIN_ONLY_V1"), "inherited and CAP-05 config selection semantics separated");
check(residual.includes("FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1"), "production residual code uses root-zone-mean projection");
check(!residual.includes("ROOT_ZONE_STORAGE_TO_POINT_200MM_VWC_V1"), "withdrawn point-200mm projection absent from production code");
check(residual.includes("DISTINCT_UNLESS_EXPLICIT_EQUIVALENCE_PROOF_V1") && residual.includes("equivalence_claimed: false"), "residual/innovation distinction frozen");
check(residual.includes("\"assimilation_gain\" in object.payload") && residual.includes("\"posterior_state_ref\" in object.payload") && residual.includes("\"posterior_mean\" in object.payload") && residual.includes("CAP05_RESIDUAL_ASSIMILATION_AUTHORITY_FORBIDDEN"), "Residual explicitly rejects gain and posterior authority fields");
check(cycle.includes("dispatch_disposition") || cycle.includes("disposition"), "feedback-cycle projection exposes Dispatch disposition");
let changed = [];
try {
  changed = git(["diff", "--name-only", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expected), "git exact changed-file boundary", JSON.stringify(changed));
} catch (error) { check(false, "git exact changed-file boundary", error.message); }
for (const file of changed) check(!file.startsWith("apps/server/db/migrations/") && !file.startsWith("apps/web/") && !file.includes("route"), `no forbidden path ${file}`);
try { git(["diff", "--check", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]); check(true, "git diff --check"); } catch (error) { check(false, "git diff --check", error.message); }
console.log(`MCFT-CAP-05 S2 governance: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
