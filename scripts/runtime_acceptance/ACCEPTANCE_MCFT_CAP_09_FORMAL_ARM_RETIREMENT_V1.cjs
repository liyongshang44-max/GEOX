"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const G = require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const H = require("./RETIRE_MCFT_CAP_09_FORMAL_ARM_HOST_V1.cjs");
const { verify } = require("./VERIFY_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geox-arm-retirement-test-"));
let cases = 0;
const check = fn => { fn(); cases++; };
try {
  const arm = { arm_identity_hash: G.LEGACY.identity, subject_sha: G.LEGACY.subject, epoch_id: G.LEGACY.epoch };
  check(() => assert.throws(() => G.assertArmNotRetired(arm, dir), /RETIRED_OPERATOR_NO_GO/));
  check(() => assert.throws(() => G.assertArmNotRetired({ ...arm, arm_identity_hash: "sha256:" + "a".repeat(64) }, dir), /RETIRED_OPERATOR_NO_GO/));
  const different = { arm_identity_hash: "sha256:" + "b".repeat(64), subject_sha: "c".repeat(40), epoch_id: "future" };
  check(() => assert.equal(G.assertArmNotRetired(different, dir).start_authorized, false));
  fs.writeFileSync(path.join(dir, "b".repeat(64) + ".json"), "broken");
  check(() => assert.throws(() => G.assertArmNotRetired(different, dir), /HOST_RETIREMENT_MARKER_PRESENT/));
  check(() => assert.throws(() => G.assertArmNotRetired({}), /IDENTITY_REQUIRED/));
  check(() => assert.throws(() => H.validateArm(arm), /ORIGINAL_ARM_DIGEST_MISMATCH/));
  const original = path.join(dir, "arm.json");
  const archive = path.join(dir, "audit", "original.json");
  const ownerFile = path.join(dir, "owners.json");
  const receiptFile = path.join(dir, "receipt.json");
  const bytes = Buffer.from(JSON.stringify(arm, null, 4) + "\r\n");
  fs.writeFileSync(original, bytes);
  fs.writeFileSync(ownerFile, "{}");
  const body = { schema_version: "geox_mcft_cap09_formal_arm_retirement_receipt_v1", status: "RETIRED", retired_arm_identity: G.LEGACY.identity, retired_subject: G.LEGACY.subject, retired_epoch: G.LEGACY.epoch, host_id: G.LEGACY.host, database_name: G.LEGACY.database, formal_tables: H.TABLES.map(table_name => ({ table_name, row_count: 0 })), database_checked_at_utc: new Date().toISOString(), active_formal_container_count: 0, formal_launcher_process_count: 0, original_arm_path: original, original_arm_archive_path: archive, original_arm_file_sha256: G.fileDigest(original), live_owner_proof_archive_path: ownerFile, live_owner_proof_sha256: G.fileDigest(ownerFile), owner_containers: { evidence: { running: true, image_id: G.LEGACY.image, container_id: "1".repeat(64) }, twin: { running: true, image_id: G.LEGACY.image, container_id: "2".repeat(64) } }, original_arm_preserved: true, database_write_count: 0, service_stop_count: 0 };
  const seal = x => ({ ...x, receipt_sha256: G.digest(x) });
  let receipt = seal(body);
  check(() => G.validateReceipt(receipt));
  check(() => assert.throws(() => G.validateReceipt({ ...receipt, host_id: "wrong" }), /DIGEST_INVALID/));
  check(() => assert.throws(() => G.validateReceipt(seal({ ...body, host_id: "wrong" })), /BINDING_INVALID/));
  check(() => assert.throws(() => G.validateReceipt(seal({ ...body, formal_tables: body.formal_tables.map((x, i) => ({ ...x, row_count: i === 0 ? 1 : 0 })) })), /FORMAL_EFFECT_PRESENT/));
  check(() => assert.throws(() => G.validateReceipt(seal({ ...body, active_formal_container_count: 1 })), /FORMAL_WRITER_PRESENT/));
  check(() => assert.throws(() => G.validateReceipt(seal({ ...body, formal_launcher_process_count: 1 })), /FORMAL_WRITER_PRESENT/));
  check(() => assert.throws(() => G.validateReceipt(seal({ ...body, service_stop_count: 1 })), /EFFECT_BOUNDARY_INVALID/));
  check(() => assert.throws(() => G.validateReceipt(seal({ ...body, formal_tables: body.formal_tables.map((x, i) => ({ ...x, table_name: i === 0 ? "wrong_table" : x.table_name })) })), /FORMAL_EFFECT_PRESENT/));
  const now = new Date().toISOString();
  const sample = role => ({ renewal: { status: "PASS" }, t1: { status: "PASS", container_id: body.owner_containers[role].container_id, lease_owner: role, fencing_token: "1" }, t2: { status: "PASS", container_running: true, container_image_id: G.LEGACY.image, container_id: body.owner_containers[role].container_id, lease_owner: role, fencing_token: "1", database_now: now } });
  const live = { status: "PASS", actual_host_id: G.LEGACY.host, subject_main_sha: G.LEGACY.subject, authorized_image_id: G.LEGACY.image, repository_clean: true, evidence_runtime: sample("evidence"), twin_runtime_scheduler: sample("twin") };
  check(() => H.validateOwnerProof(live, Date.now() - 1000));
  check(() => assert.throws(() => H.validateOwnerProof({ ...live, actual_host_id: "wrong" }, Date.now() - 1000), /BINDING_INVALID/));
  check(() => assert.throws(() => H.validateOwnerProof({ ...live, twin_runtime_scheduler: { ...live.twin_runtime_scheduler, t2: { ...live.twin_runtime_scheduler.t2, container_id: "3".repeat(64) } } }, Date.now() - 1000), /OWNER_CHANGED/));
  check(() => assert.throws(() => H.validateOwnerProof(live, Date.now() + 1000), /PROOF_NOT_FRESH/));
  const containers = ["evidence", "twin"].map(role => ({ Id: body.owner_containers[role].container_id, Image: G.LEGACY.image, State: { Running: true }, Config: { Labels: { "com.docker.compose.service": "geox-mcft-cap09-" + role + "-runtime-v1" } } }));
  check(() => H.validateContainers(containers, body.owner_containers));
  check(() => assert.throws(() => H.validateContainers([...containers, containers[0]], body.owner_containers), /CONTINUITY_FAILED/));
  check(() => assert.throws(() => H.validateContainers([...containers, { Args: ["mcft_cap09_formal_v5_twin_runtime_process_v1.js"] }], body.owner_containers), /ACTIVE_FORMAL_CONTAINER_PRESENT/));
  check(() => assert.throws(() => H.validateContainers([...containers, { Config: { Env: ["DATABASE_URL=postgres://example:example@localhost/" + G.LEGACY.database] } }], body.owner_containers), /ACTIVE_FORMAL_CONTAINER_PRESENT/));
  fs.writeFileSync(ownerFile, JSON.stringify(live));
  body.live_owner_proof_sha256 = G.fileDigest(ownerFile);
  for (const role of ["evidence", "twin"]) Object.assign(body.owner_containers[role], { lease_owner: role, fencing_token: "1" });
  receipt = seal(body);
  check(() => H.publish(original, receiptFile, receipt));
  check(() => assert.deepEqual(fs.readFileSync(archive), bytes));
  check(() => assert.deepEqual(fs.readFileSync(archive + ".original"), bytes));
  check(() => H.publish(original, receiptFile, receipt));
  check(() => assert.equal(verify(receiptFile).old_identity_rejected, true));
  // Crash after receipt publication / removal of execution path recovers without reviving the arm.
  fs.unlinkSync(original);
  check(() => H.publish(original, receiptFile, receipt));
  check(() => assert.equal(verify(receiptFile).status, "PASS"));
  if (process.argv.includes("--entrypoints")) {
    const env = { ...process.env };
    delete env.CI; delete env.GITHUB_ACTIONS;
    const root = path.resolve(__dirname, "../..");
    for (const name of ["A0_BOOTSTRAP", "A0_PRODUCTION_REPLAY_PROMOTION", "ACTIVE_PRODUCTION_CUTOVER"]) {
      check(() => {
        let rejected = false;
        try {
          require("node:child_process").execFileSync(process.execPath, ["--import", "tsx", path.join(__dirname, "RUN_MCFT_CAP_09_FORMAL_V5_" + name + "_V1.ts"), "--operator-authorized", "--arm=" + archive], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
        } catch (e) { rejected = e.status !== 0 && String(e.stderr).includes("FORMAL_ARM_RETIRED_OPERATOR_NO_GO"); }
        assert.equal(rejected, true, name + ":MUST_REJECT_BEFORE_EXTERNAL_ACTIONS");
      });
    }
  }
  fs.appendFileSync(archive, " ");
  check(() => assert.throws(() => verify(receiptFile), /ARCHIVE_DIGEST_INVALID/));
  console.log(JSON.stringify({ status: "PASS", cases, real_host_retirement: false, database_write_count: 0, service_stop_count: 0 }));
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
