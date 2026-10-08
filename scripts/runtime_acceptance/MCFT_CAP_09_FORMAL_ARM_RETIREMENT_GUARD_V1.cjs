"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const LEGACY = Object.freeze({
  identity: "sha256:8826cccdbb9aebd8c5e563119fdd3f52772f77cd9d12c718270655c3f03e940f",
  subject: "a60aa6858662ce87b989ff752c50969f21ad4619",
  epoch: "mcft_cap09_external_formal_window_epoch_20261010t060000000z_v5",
  host: "fae5f756-ef25-40d5-9777-5b2c3d4837a1",
  image: "sha256:9ff1b452cbb426f0a9bc70e2f38419fb8dd992cb2ff8ead8d090be8618da1288",
  database: "geox_mcft_cap09_s6_formal_t4r1_24h_v5",
});
const TABLES = `facts twin_action_feedback_cycle_projection_v1 twin_action_feedback_evidence_index_v1 twin_action_feedback_projection_v1 twin_active_lineage_index_v1 twin_approved_plan_binding_projection_v1 twin_decision_record_projection_v1 twin_external_formal_forcing_base_cursor_v1 twin_external_formal_forcing_base_target_v1 twin_external_formal_forcing_controller_lease_v1 twin_forecast_point_projection_v1 twin_forecast_residual_projection_v1 twin_forecast_result_latest_index_v1 twin_forecast_run_projection_v1 twin_forecast_success_latest_index_v1 twin_object_idempotency_index_v1 twin_runtime_authority_snapshot_v1 twin_runtime_checkpoint_latest_index_v1 twin_runtime_health_latest_index_v1 twin_runtime_lease_v1 twin_scenario_latest_index_v1 twin_scenario_point_projection_v1 twin_scenario_set_projection_v1 twin_scenario_set_uniqueness_v1 twin_shadow_online_scheduler_cursor_v1 twin_shadow_online_scheduler_slot_v1 twin_state_history_projection_v1 twin_state_latest_index_v1 twin_terminal_tick_uniqueness_v1`.split(" ").sort();
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
function digest(value) { return "sha256:" + crypto.createHash("sha256").update(canonical(value)).digest("hex"); }
function fileDigest(file) { return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function requireCondition(ok, code) { if (!ok) throw new Error(code); }
function validateReceipt(receipt) {
  requireCondition(receipt?.schema_version === "geox_mcft_cap09_formal_arm_retirement_receipt_v1", "ARM_RETIREMENT_RECEIPT_SCHEMA_INVALID");
  const { receipt_sha256, ...body } = receipt;
  requireCondition(receipt_sha256 === digest(body), "ARM_RETIREMENT_RECEIPT_DIGEST_INVALID");
  requireCondition(receipt.status === "RETIRED" && receipt.retired_arm_identity === LEGACY.identity && receipt.retired_subject === LEGACY.subject && receipt.retired_epoch === LEGACY.epoch && receipt.host_id === LEGACY.host, "ARM_RETIREMENT_RECEIPT_BINDING_INVALID");
  requireCondition(receipt.database_name === LEGACY.database && Array.isArray(receipt.formal_tables) && JSON.stringify(receipt.formal_tables.map(x => x.table_name).sort()) === JSON.stringify(TABLES) && receipt.formal_tables.every(x => Number(x.row_count) === 0), "ARM_RETIREMENT_FORMAL_EFFECT_PRESENT");
  requireCondition(receipt.active_formal_container_count === 0 && receipt.formal_launcher_process_count === 0, "ARM_RETIREMENT_FORMAL_WRITER_PRESENT");
  requireCondition(Number.isFinite(Date.parse(receipt.database_checked_at_utc)) && /^sha256:[0-9a-f]{64}$/.test(receipt.original_arm_file_sha256) && /^sha256:[0-9a-f]{64}$/.test(receipt.live_owner_proof_sha256), "ARM_RETIREMENT_EVIDENCE_INVALID");
  for (const role of ["evidence", "twin"]) {
    const c = receipt.owner_containers?.[role];
    requireCondition(c?.running === true && c.image_id === LEGACY.image && /^[0-9a-f]{64}$/.test(c.container_id), "ARM_RETIREMENT_OWNER_CONTAINER_INVALID");
  }
  requireCondition(receipt.database_write_count === 0 && receipt.service_stop_count === 0 && receipt.original_arm_preserved === true, "ARM_RETIREMENT_EFFECT_BOUNDARY_INVALID");
  return receipt;
}
function retirementDirectory(home = os.homedir()) { return path.join(home, ".geox", "mcft-cap09", "formal-v5", "arm-retirements-v1"); }
function receiptPath(home = os.homedir()) { return path.join(retirementDirectory(home), LEGACY.identity.slice(7) + ".json"); }
function assertArmNotRetired(arm, directory = retirementDirectory()) {
  requireCondition(arm && typeof arm === "object", "FORMAL_ARM_INPUT_INVALID");
  // The operator NO-GO is source-pinned. Deleting a host receipt cannot revive it.
  requireCondition(arm.schema_version !== "geox_mcft_cap09_formal_arm_retired_marker_v1" && arm.retired_arm_identity !== LEGACY.identity && arm.arm_identity_hash !== LEGACY.identity && !(arm.subject_sha === LEGACY.subject && arm.epoch_id === LEGACY.epoch), "FORMAL_ARM_RETIRED_OPERATOR_NO_GO");
  requireCondition(/^sha256:[0-9a-f]{64}$/.test(String(arm.arm_identity_hash || "")), "FORMAL_ARM_IDENTITY_REQUIRED");
  const marker = path.join(directory, arm.arm_identity_hash.slice(7) + ".json");
  // Any marker blocks execution, including a malformed marker. Never fail open.
  requireCondition(!fs.existsSync(marker), "FORMAL_ARM_HOST_RETIREMENT_MARKER_PRESENT");
  return { status: "NOT_RETIRED", start_authorized: false };
}
module.exports = { LEGACY, TABLES, canonical, digest, fileDigest, requireCondition, validateReceipt, retirementDirectory, receiptPath, assertArmNotRetired };
if (require.main === module) {
  try {
    const arg = process.argv.slice(2).find(x => x.startsWith("--arm="));
    requireCondition(Boolean(arg?.slice(6)), "FORMAL_ARM_PATH_REQUIRED");
    assertArmNotRetired(JSON.parse(fs.readFileSync(path.resolve(arg.slice(6)), "utf8")));
  } catch (error) {
    // No raw command, database URL, or arm contents in diagnostic output.
    console.error(/^(FORMAL_ARM_)/.test(error.message) ? error.message : "FORMAL_ARM_INPUT_READ_FAILED");
    process.exitCode = 1;
  }
}
