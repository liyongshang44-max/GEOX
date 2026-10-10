#!/usr/bin/env node
"use strict";
// A new-window canonical rebootstrap, NOT retrying/resetting the exhausted historical target.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process");
const {ROOT, authorize} = require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
const {safeRepoRef, selectA0, MEASUREMENT_LEAD_MS, AUTHORITY_MATERIALIZATION_MARGIN_MS} = require("./MCFT_CAP_09_AM22_GFS_BOOTSTRAP_V1.cjs");
const hash = b => "sha256:" + crypto.createHash("sha256").update(b).digest("hex");
function reconcile(failed, a, bytes) {
  assert.equal(hash(bytes), a.source_failed_receipt_sha256, "RECOVERY_V2_FAILED_RECEIPT_DIGEST_MISMATCH");
  assert.equal(failed.status, "FAIL"); assert.equal(failed.phase, "GFS_PAIR_WAIT");
  assert.equal(failed.owner_verified, true); assert.equal(failed.operator_reconciliation_required, true);
  for (const k of ["formal_v5_arm", "a0_execution", "o00_started"]) assert.equal(failed[k], false);
  assert.equal(failed.image_id, "sha256:b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456");
  return {previous_owner_proof_required: true, current_evidence_health_required_before_rebootstrap: false,
    current_owner_health_and_renewal_required_after_rebootstrap: true, historical_target_retry: false};
}
function execute(a, receipt, bytes, stageRef, out, runner) {
  assert.equal(a.armed, true, "RECOVERY_V2_NOT_ARMED");
  assert.equal(a.mode, "CANONICAL_RECOVERY_REBOOTSTRAP");
  assert.equal(a.production_recovery_authorized, true);
  assert.equal(a.new_image_build_and_two_role_cutover_authorized, true);
  for (const k of ["formal_v5_arm_authorized", "a0_authorized", "o00_authorized", "historical_attempt_reset_authorized"]) assert.equal(a[k], false);
  const failed = JSON.parse(bytes.toString("utf8"));
  reconcile(failed, a, bytes);
  assert(!fs.existsSync(out), "RECOVERY_V2_NEW_OUTPUT_REQUIRED");
  assert(path.relative(ROOT, out).startsWith(".." + path.sep), "RECOVERY_V2_OUTPUT_OUTSIDE_REPO_REQUIRED");
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, "source-failed-receipt.json"), bytes, {flag: "wx", mode: 0o600});
  // Preserve the complete existing log before calling any production-mutating executor.
  const logRoot = process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT;
  assert(logRoot, "RECOVERY_V2_DURABLE_LOG_ROOT_REQUIRED");
  const sourceLog = path.join(logRoot, "evidence", "runtime.log");
  assert(fs.statSync(sourceLog).size <= 64 * 1024 * 1024, "RECOVERY_V2_HISTORICAL_LOG_SIZE_LIMIT");
  const data = fs.readFileSync(sourceLog);
  const count = data.toString("utf8").split(/\r?\n/).filter(line => {
    try { const x = JSON.parse(line); return x.runtime_role === "EVIDENCE_RUNTIME" && x.failure_token === "PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW"; } catch { return false; }
  }).length;
  assert(count >= 3, "RECOVERY_V2_THREE_HISTORICAL_FAILURE_RECORDS_REQUIRED");
  fs.writeFileSync(path.join(out, "historical-evidence-runtime.log"), data, {flag: "wx", mode: 0o600});
  fs.writeFileSync(path.join(out, "preservation.json"), JSON.stringify({source_failed_receipt_sha256: hash(bytes), historical_log_sha256: hash(data), missed_window_record_count: count, historical_attempt_reset: false}), {flag: "wx", mode: 0o600});
  const result = runner(["scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs", "--operator-authorized", "--stage-ref=" + stageRef, "--out=" + path.join(out, "new-window")]);
  assert.equal(hash(fs.readFileSync(receipt)), hash(bytes), "RECOVERY_V2_SOURCE_RECEIPT_CHANGED");
  const after = fs.readFileSync(sourceLog);
  assert(after.length >= data.length && after.subarray(0, data.length).equals(data), "RECOVERY_V2_HISTORY_NOT_APPEND_ONLY");
  assert.equal(result, 0, "RECOVERY_V2_CANONICAL_REBOOTSTRAP_FAILED_REQUIRES_RECONCILIATION");
  const proof = JSON.parse(fs.readFileSync(path.join(out, "new-window", "result.json")));
  assert.equal(proof.status, "PASS");
  assert.equal(proof.subject_sha, a.execution_subject_sha);
  assert.equal(proof.stage_ref, stageRef);
  assert.equal(proof.production_owner_cutover_observed, true);
  assert.equal(proof.evidence_acquisition_observed, true);
  for (const k of ["formal_v5_arm", "a0_execution", "o00_started"]) assert.equal(proof[k], false);
  return {status: "CANONICAL_REBOOTSTRAP_COMPLETED_NOT_FORMAL_AUTHORIZATION", historical_attempt_reset: false, formal_v5_arm: false, a0_execution: false, o00_started: false};
}
function main() {
  const args = process.argv.slice(2), value = key => args.find(a => a.startsWith(key + "="))?.slice(key.length + 1);
  assert(args.includes("--operator-authorized"), "RECOVERY_V2_OPERATOR_AUTHORIZATION_REQUIRED");
  assert(args.includes("--execute") !== args.includes("--preflight-only"), "RECOVERY_V2_SELECT_ONE_MODE");
  const a = authorize("CANONICAL_RECOVERY_REBOOTSTRAP");
  const receipt = path.resolve(value("--failed") || "");
  const bytes = fs.readFileSync(receipt);
  reconcile(JSON.parse(bytes.toString("utf8")), a, bytes);
  const stage = safeRepoRef(a.stage_ref);
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json")));
  const now = new Date().toISOString(), entry = registry.entries.find(e => e.authority_ref === stage.ref && e.authority_sha256 === hash(fs.readFileSync(stage.resolved)) && ["EFFECTIVE_FOR_RUNTIME_CONSUMPTION", "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"].includes(e.graduation_status) && Date.parse(e.authority_as_of) <= Date.parse(now));
  assert(entry, "RECOVERY_V2_ADOPTED_STAGE_REQUIRED");
  const budget = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json")));
  const planning = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json")));
  const selected = Number(budget.qualified_budget?.selected_budget_ms);
  assert(budget.timing_budget_qualified === true && budget.timing_budget_frozen === true && Number.isSafeInteger(selected) && selected > 0, "RECOVERY_V2_FROZEN_BUDGET_REQUIRED");
  const combined = selected + MEASUREMENT_LEAD_MS + AUTHORITY_MATERIALIZATION_MARGIN_MS;
  assert.equal(planning.selection_policy?.selected_acquisition_budget_ms, selected, "RECOVERY_V2_BUDGET_BINDING_MISMATCH");
  assert.equal(planning.selection_policy?.combined_minimum_lead_ms, combined, "RECOVERY_V2_COMBINED_LEAD_MISMATCH");
  const window = selectA0({source_now: now, budget_ms: combined, stage: JSON.parse(fs.readFileSync(stage.resolved))});
  assert(Date.parse(entry.authority_valid_until) >= Date.parse(window.o23), "RECOVERY_V2_FULL_25_CONTEXTS_REQUIRED");
  if (args.includes("--preflight-only")) { console.log(JSON.stringify({status: "PRECHECK_PASS_NOT_OWNER_PROOF_OR_RECOVERY", window, production_writes: 0, owner_qualified: false})); return; }
  const out = path.resolve(value("--out") || "");
  console.log(JSON.stringify(execute(a, receipt, bytes, stage.ref, out, argv => {
    const r = cp.spawnSync(process.execPath, argv, {cwd: ROOT, env: process.env, stdio: "inherit"}); return r.status;
  })));
}
module.exports = {reconcile, execute};
if (require.main === module) { try { main(); } catch (e) { console.error(JSON.stringify({status: "RECOVERY_V2_BLOCKED", reason: e.message, formal_v5_arm: false, a0_execution: false, historical_attempt_reset: false})); process.exitCode = 1; } }
