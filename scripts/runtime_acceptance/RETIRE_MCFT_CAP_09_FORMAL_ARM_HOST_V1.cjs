"use strict";
// Local operator tool. No SQL mutations, provider requests, or service lifecycle commands.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const G = require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const req = G.requireCondition;
const TABLES = G.TABLES;
const arg = name => process.argv.slice(2).find(x => x.startsWith(name + "="))?.slice(name.length + 1);
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
function run(cmd, args, cwd) { return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900000 }).trim(); }
function validateArm(arm) {
  req(arm.arm_identity_hash === G.LEGACY.identity && arm.subject_sha === G.LEGACY.subject && arm.epoch_id === G.LEGACY.epoch, "ARM_RETIREMENT_OLD_IDENTITY_MISMATCH");
  const { arm_identity_hash, formal_v5_arm, formal_v5_epoch_selected, ...core } = arm;
  req(G.digest(core) === arm_identity_hash, "ARM_RETIREMENT_ORIGINAL_ARM_DIGEST_MISMATCH");
}
function validateOwnerProof(proof, started) {
  req(proof.status === "PASS" && proof.actual_host_id === G.LEGACY.host && proof.subject_main_sha === G.LEGACY.subject && proof.authorized_image_id === G.LEGACY.image && proof.repository_clean === true, "ARM_RETIREMENT_LIVE_OWNER_BINDING_INVALID");
  const owners = {};
  for (const [role, key] of [["evidence", "evidence_runtime"], ["twin", "twin_runtime_scheduler"]]) {
    const p = proof[key];
    req(p?.renewal?.status === "PASS" && p.t1?.status === "PASS" && p.t2?.status === "PASS", "ARM_RETIREMENT_OWNER_RENEWAL_INVALID");
    const c = p.t2;
    req(c.container_running && c.container_image_id === G.LEGACY.image && c.container_id === p.t1.container_id && c.lease_owner === p.t1.lease_owner && c.fencing_token === p.t1.fencing_token, "ARM_RETIREMENT_OWNER_CHANGED");
    req(Date.parse(c.database_now) >= started && Date.parse(c.database_now) <= Date.now() + 30000 && Date.now() - Date.parse(c.database_now) < 300000, "ARM_RETIREMENT_LIVE_PROOF_NOT_FRESH");
    owners[role] = { running: true, image_id: c.container_image_id, container_id: c.container_id, lease_owner: c.lease_owner, fencing_token: c.fencing_token, heartbeat_at: c.heartbeat_at, expires_at: c.expires_at };
  }
  return owners;
}
function validateContainers(containers, owners) {
  const formal = containers.filter(c => /mcft_cap09_formal_v5_twin_runtime_process_v1|mcft_cap09_v13_forcing_production_process_v1/.test(JSON.stringify([c.Path, c.Args, c.Config?.Cmd])) || c.Config?.Labels?.["com.docker.compose.service"] === "geox-mcft-cap09-formal-v5-forcing-runtime-v1" || (c.Config?.Env || []).some(entry => {
    const equal = entry.indexOf("=");
    if (!/DATABASE_URL/.test(entry.slice(0, equal))) return false;
    try { return decodeURIComponent(new URL(entry.slice(equal + 1)).pathname.slice(1)) === G.LEGACY.database; } catch { return false; }
  }));
  req(formal.length === 0, "ARM_RETIREMENT_ACTIVE_FORMAL_CONTAINER_PRESENT");
  for (const [role, name] of [["evidence", "geox-mcft-cap09-evidence-runtime-v1"], ["twin", "geox-mcft-cap09-twin-runtime-v1"]]) {
    const matches = containers.filter(c => c.Config?.Labels?.["com.docker.compose.service"] === name);
    req(matches.length === 1 && matches[0].Id === owners[role].container_id && matches[0].State?.Running && matches[0].Image === G.LEGACY.image, "ARM_RETIREMENT_OWNER_CONTAINER_CONTINUITY_FAILED");
  }
}
function inventory(owners) {
  const ids = run("docker", ["ps", "--quiet", "--no-trunc"]).split(/\s+/).filter(Boolean);
  req(ids.length > 0, "ARM_RETIREMENT_DOCKER_NO_RUNNING_CONTAINERS");
  const containers = JSON.parse(run("docker", ["inspect", ...ids]));
  validateContainers(containers, owners);
  // Only PIDs leave PowerShell. Never emit command lines or environment secrets.
  const script = "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|nodejs|tsx)(\\.exe)?$' -and $_.CommandLine -match 'RUN_MCFT_CAP_09_FORMAL_V5_(A0_BOOTSTRAP|A0_PRODUCTION_REPLAY_PROMOTION|ACTIVE_PRODUCTION_CUTOVER)|mcft_cap09_formal_v5_twin_runtime_process_v1|mcft_cap09_v13_forcing_production_process_v1' } | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress";
  const output = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  const processes = output ? [].concat(JSON.parse(output)) : [];
  req(processes.length === 0, "ARM_RETIREMENT_FORMAL_LAUNCHER_PROCESS_PRESENT");
  return { active_formal_container_count: 0, formal_launcher_process_count: 0 };
}
async function databaseSnapshot(repo) {
  const url = process.env.GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL || process.env.FORMAL_V5_ADMIN_DATABASE_URL;
  req(Boolean(url), "ARM_RETIREMENT_FORMAL_ADMIN_URL_REQUIRED");
  const { Client } = createRequire(path.join(repo, "package.json"))("pg");
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const meta = (await client.query("SELECT current_database() database_name, clock_timestamp() checked_at_utc, current_setting('transaction_read_only') read_only")).rows[0];
    req(meta.database_name === G.LEGACY.database && meta.read_only === "on", "ARM_RETIREMENT_FORMAL_DATABASE_BINDING_INVALID");
    const names = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(x => x.table_name);
    req(JSON.stringify(names) === JSON.stringify(TABLES), "ARM_RETIREMENT_FORMAL_SCHEMA_MISMATCH");
    const rows = [];
    for (const table of TABLES) {
      const count = (await client.query(`SELECT count(*)::text n FROM public."${table}"`)).rows[0].n;
      req(count === "0", "ARM_RETIREMENT_PARTIAL_FORMAL_EFFECT_PRESENT");
      rows.push({ table_name: table, row_count: 0 });
    }
    const checked = (await client.query("SELECT clock_timestamp() checked_at_utc")).rows[0].checked_at_utc;
    await client.query("ROLLBACK");
    return { database_name: meta.database_name, database_checked_at_utc: checked.toISOString(), formal_tables: rows };
  } finally { await client.end(); }
}
function publish(original, receiptFile, receipt) {
  G.validateReceipt(receipt);
  fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
  const archive = receipt.original_arm_archive_path;
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  // Store exact bytes first. All audit files use exclusive creation; retries verify rather than overwrite.
  if (!fs.existsSync(archive)) fs.copyFileSync(original, archive, fs.constants.COPYFILE_EXCL);
  req(G.fileDigest(archive) === receipt.original_arm_file_sha256, "ARM_RETIREMENT_ARCHIVE_DIGEST_INVALID");
  if (!fs.existsSync(receiptFile)) fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  const saved = G.validateReceipt(read(receiptFile));
  req(saved.receipt_sha256 === receipt.receipt_sha256, "ARM_RETIREMENT_RECEIPT_CONFLICT");
  const marker = { schema_version: "geox_mcft_cap09_formal_arm_retired_marker_v1", status: "RETIRED", retired_arm_identity: G.LEGACY.identity, receipt_path: receiptFile, receipt_sha256: receipt.receipt_sha256, original_arm_archive_path: archive, formal_v5_arm: false, a0_execution_authorized: false };
  if (fs.existsSync(original)) {
    const current = read(original);
    if (current.schema_version === marker.schema_version) {
      req(current.receipt_sha256 === receipt.receipt_sha256, "ARM_RETIREMENT_MARKER_CONFLICT");
      return;
    }
    req(G.fileDigest(original) === receipt.original_arm_file_sha256, "ARM_RETIREMENT_ORIGINAL_CHANGED");
    // Move the original inode to audit; keep the prior exact-byte copy as crash recovery evidence.
    fs.renameSync(original, archive + ".original");
  }
  fs.writeFileSync(original, JSON.stringify(marker, null, 2) + "\n", { flag: "wx" });
}
async function main() {
  req(process.platform === "win32" && !process.env.CI && !process.env.GITHUB_ACTIONS, "ARM_RETIREMENT_WINDOWS_LOCAL_HOST_ONLY");
  req(process.argv.includes("--operator-authorized"), "ARM_RETIREMENT_OPERATOR_AUTHORIZATION_REQUIRED");
  const repo = path.resolve(arg("--repo-root") || process.cwd());
  const home = os.homedir();
  const original = path.resolve(arg("--arm") || path.join(home, ".geox/mcft-cap09/formal-v5/arm-rearm-a60aa685-v1.json"));
  req(fs.readFileSync(path.join(home, ".geox/mcft-cap09/local-host-id-v1"), "utf8").trim() === G.LEGACY.host, "ARM_RETIREMENT_HOST_BINDING_INVALID");
  const target = G.receiptPath(home);
  if (fs.existsSync(target)) {
    const saved = G.validateReceipt(read(target));
    req(saved.original_arm_path === original, "ARM_RETIREMENT_PATH_CONFLICT");
    req(G.fileDigest(saved.original_arm_archive_path) === saved.original_arm_file_sha256, "ARM_RETIREMENT_ARCHIVE_DIGEST_INVALID");
    req(G.fileDigest(saved.live_owner_proof_archive_path) === saved.live_owner_proof_sha256, "ARM_RETIREMENT_OWNER_ARCHIVE_INVALID");
    publish(original, target, saved);
    console.log(JSON.stringify({ status: "ALREADY_RETIRED", receipt_path: target, receipt_sha256: saved.receipt_sha256, new_start_authorized: false }, null, 2));
    return;
  }
  req(run("git", ["rev-parse", "HEAD"], repo) === G.LEGACY.subject && run("git", ["status", "--porcelain"], repo) === "", "ARM_RETIREMENT_EXACT_CLEAN_SOURCE_REQUIRED");
  validateArm(read(original));
  const originalHash = G.fileDigest(original);
  const started = Date.now();
  const proofFile = path.join(repo, "acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json");
  if (fs.existsSync(proofFile)) {
    const history = path.join(home, ".geox/mcft-cap09/owner-health-history");
    fs.mkdirSync(history, { recursive: true });
    fs.copyFileSync(proofFile, path.join(history, "before-arm-retirement-" + started + ".json"), fs.constants.COPYFILE_EXCL);
  }
  run(process.execPath, [path.join(repo, "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs"), "--live"], repo);
  const proof = read(proofFile);
  const owners = validateOwnerProof(proof, started);
  inventory(owners);
  const database = await databaseSnapshot(repo);
  inventory(owners);
  validateOwnerProof(proof, started);
  const directory = path.join(G.retirementDirectory(home), "audit", G.LEGACY.identity.slice(7));
  fs.mkdirSync(directory, { recursive: true });
  const ownerArchive = path.join(directory, "live-owner-proof-" + new Date().toISOString().replace(/[^0-9]/g, "") + ".json");
  fs.copyFileSync(proofFile, ownerArchive, fs.constants.COPYFILE_EXCL);
  const body = { schema_version: "geox_mcft_cap09_formal_arm_retirement_receipt_v1", status: "RETIRED", retired_at_utc: new Date().toISOString(), retired_arm_identity: G.LEGACY.identity, retired_subject: G.LEGACY.subject, retired_epoch: G.LEGACY.epoch, host_id: G.LEGACY.host, original_arm_path: original, original_arm_archive_path: path.join(directory, "original-arm.json"), original_arm_file_sha256: originalHash, live_owner_proof_archive_path: ownerArchive, live_owner_proof_sha256: G.fileDigest(ownerArchive), owner_containers: owners, ...database, active_formal_container_count: 0, formal_launcher_process_count: 0, operator_authorized: true, original_arm_preserved: true, database_write_count: 0, service_stop_count: 0, provider_request_count: 0, new_start_authorized: false, tool_file_sha256: G.fileDigest(__filename), guard_file_sha256: G.fileDigest(path.join(__dirname, "MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs")), evidence_scope: "LOCAL_HOST_OBSERVED_READ_ONLY_SNAPSHOT; NOT_A_DISTRIBUTED_LOCK" };
  const receipt = { ...body, receipt_sha256: G.digest(body) };
  publish(original, target, receipt);
  console.log(JSON.stringify({ status: "RETIRED", receipt_path: target, receipt_sha256: receipt.receipt_sha256, original_arm_archive_path: receipt.original_arm_archive_path, database_checked_at_utc: receipt.database_checked_at_utc, database_write_count: 0, service_stop_count: 0, evidence_twin_preserved: true, new_start_authorized: false }, null, 2));
}
module.exports = { TABLES, validateArm, validateOwnerProof, validateContainers, publish, databaseSnapshot };
if (require.main === module) main().catch(error => { console.error(/^ARM_RETIREMENT_[A-Z_]+$/.test(error.message) ? error.message : "ARM_RETIREMENT_FAILED_CLOSED_COMMAND_OR_CONNECTION_ERROR"); console.error("Database writes: 0; service stops: 0. Keep audit files; no new start is authorized."); process.exitCode = 1; });
