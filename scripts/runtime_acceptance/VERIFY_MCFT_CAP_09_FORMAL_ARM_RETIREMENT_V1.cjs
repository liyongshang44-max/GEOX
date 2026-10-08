"use strict";
const fs = require("node:fs");
const path = require("node:path");
const G = require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
function verify(file) {
  const receipt = G.validateReceipt(JSON.parse(fs.readFileSync(file, "utf8")));
  G.requireCondition(G.fileDigest(receipt.original_arm_archive_path) === receipt.original_arm_file_sha256, "ARM_RETIREMENT_ARCHIVE_DIGEST_INVALID");
  G.requireCondition(G.fileDigest(receipt.live_owner_proof_archive_path) === receipt.live_owner_proof_sha256, "ARM_RETIREMENT_OWNER_ARCHIVE_DIGEST_INVALID");
  const proof = JSON.parse(fs.readFileSync(receipt.live_owner_proof_archive_path, "utf8"));
  G.requireCondition(proof.status === "PASS" && proof.actual_host_id === G.LEGACY.host && proof.subject_main_sha === G.LEGACY.subject && proof.authorized_image_id === G.LEGACY.image && proof.repository_clean === true, "ARM_RETIREMENT_OWNER_ARCHIVE_BINDING_INVALID");
  for (const [role, key] of [["evidence", "evidence_runtime"], ["twin", "twin_runtime_scheduler"]]) {
    const p = proof[key];
    const c = receipt.owner_containers[role];
    G.requireCondition(p?.renewal?.status === "PASS" && p.t1?.status === "PASS" && p.t2?.status === "PASS" && p.t1.container_id === p.t2.container_id && p.t2.container_id === c.container_id && p.t2.container_image_id === c.image_id && p.t2.lease_owner === c.lease_owner && p.t2.fencing_token === c.fencing_token, "ARM_RETIREMENT_OWNER_ARCHIVE_CORRELATION_INVALID");
  }
  const marker = JSON.parse(fs.readFileSync(receipt.original_arm_path, "utf8"));
  G.requireCondition(marker.schema_version === "geox_mcft_cap09_formal_arm_retired_marker_v1" && marker.retired_arm_identity === G.LEGACY.identity && marker.receipt_sha256 === receipt.receipt_sha256 && marker.formal_v5_arm === false, "ARM_RETIREMENT_EXECUTION_PATH_NOT_RETIRED");
  let rejected = false;
  try { G.assertArmNotRetired(JSON.parse(fs.readFileSync(receipt.original_arm_archive_path, "utf8"))); } catch (e) { rejected = e.message === "FORMAL_ARM_RETIRED_OPERATOR_NO_GO"; }
  G.requireCondition(rejected, "ARM_RETIREMENT_ARCHIVED_COPY_NOT_REJECTED");
  return { status: "PASS", retired_arm_identity: receipt.retired_arm_identity, receipt_sha256: receipt.receipt_sha256, original_bytes_preserved: true, old_identity_rejected: true, database_write_count: 0, service_stop_count: 0, new_start_authorized: false };
}
module.exports = { verify };
if (require.main === module) {
  try {
    const file = process.argv.slice(2).find(x => x.startsWith("--receipt="))?.slice(10) || G.receiptPath();
    console.log(JSON.stringify(verify(path.resolve(file)), null, 2));
  } catch (error) { console.error(/^ARM_RETIREMENT_[A-Z_]+$/.test(error.message) ? error.message : "ARM_RETIREMENT_VERIFICATION_FAILED"); process.exitCode = 1; }
}
