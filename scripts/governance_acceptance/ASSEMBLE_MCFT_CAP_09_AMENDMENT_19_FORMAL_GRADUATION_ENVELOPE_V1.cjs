#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function readJson(file, code) {
  if (!fs.existsSync(file)) fail(code);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function sha256File(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}
function exactSha(value, code) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/.test(text)) fail(code);
  return text;
}
function canonicalIso(value, code) {
  const text = String(value || "").trim();
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) fail(code);
  return text;
}
function positiveInteger(value, code) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) fail(code);
  return n;
}
function artifactDigest(value) {
  const text = String(value || "").trim();
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) fail("AM19_GRADUATION_ENVELOPE_ARTIFACT_DIGEST_REQUIRED");
  return text;
}

function assemble(input) {
  const subject = exactSha(input.subject_sha, "AM19_GRADUATION_ENVELOPE_SUBJECT_REQUIRED");
  const graduation = input.graduation;
  const gate = input.gate;
  const persistent = input.persistent;
  const persistenceFree = input.persistence_free;
  const rehydration = input.rehydration;
  const cutover = input.cutover;
  const meta = input.metadata;

  need(graduation?.schema_version === "geox_mcft_cap09_amendment19_formal_graduation_input_v1", "AM19_GRADUATION_ENVELOPE_INPUT_SCHEMA_REQUIRED");
  need(graduation.status === "PASS" && graduation.subject_sha === subject && graduation.static_blocker_count === 0, "AM19_GRADUATION_ENVELOPE_INPUT_PASS_REQUIRED");
  need(graduation.future_formal_epoch_selected === false && graduation.formal_o00_started === false && graduation.mcft_cap09_completed === false, "AM19_GRADUATION_ENVELOPE_PREMATURE_FORMAL_EFFECT_FORBIDDEN");
  need(graduation.final_actual_24h_still_required === true, "AM19_GRADUATION_ENVELOPE_FINAL_24H_REQUIRED");

  need(gate?.schema_version === "geox_mcft_cap09_formal_epoch_graduation_gate_result_v1", "AM19_GRADUATION_ENVELOPE_GATE_SCHEMA_REQUIRED");
  need(gate.status === "PASS" && gate.formal_epoch_creation_gate === "OPEN", "AM19_GRADUATION_ENVELOPE_GATE_OPEN_REQUIRED");
  need(gate.required_status_count === 13 && gate.static_blocker_count === 0 && gate.human_override_used === false, "AM19_GRADUATION_ENVELOPE_GATE_MACHINE_ONLY_REQUIRED");

  need(persistent?.schema_version === "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1", "AM19_GRADUATION_ENVELOPE_PERSISTENT_SCHEMA_REQUIRED");
  need(persistent.status === "PASS" && persistent.subject_sha === subject, "AM19_GRADUATION_ENVELOPE_PERSISTENT_CONSUMER_SUBJECT_REQUIRED");
  const producerSubject = exactSha(persistent.producer_subject_sha, "AM19_GRADUATION_ENVELOPE_PERSISTENT_PRODUCER_SUBJECT_REQUIRED");
  need(persistent.static_blocker_count === 0 && persistent.final_actual_24h_still_required === true && persistent.formal_o00_started === false, "AM19_GRADUATION_ENVELOPE_PERSISTENT_BOUNDARY_REQUIRED");
  need(persistenceFree?.status === "PASS" && persistenceFree.machine_statuses?.PERSISTENCE_FREE_24T === "PASS", "AM19_GRADUATION_ENVELOPE_PERSISTENCE_FREE_REQUIRED");
  need(rehydration?.status === "PASS" && rehydration.consumer_subject_sha === subject, "AM19_GRADUATION_ENVELOPE_REHYDRATION_CONSUMER_SUBJECT_REQUIRED");
  need(rehydration.producer_subject_sha === producerSubject, "AM19_GRADUATION_ENVELOPE_REHYDRATION_PRODUCER_SUBJECT_REQUIRED");
  need(rehydration.cross_head_rehydration === (producerSubject !== subject), "AM19_GRADUATION_ENVELOPE_REHYDRATION_CROSS_HEAD_FLAG_REQUIRED");
  need(cutover?.status === "PASS" && cutover.shared_canonical_core_bound === true && cutover.formal_effect === false, "AM19_GRADUATION_ENVELOPE_CUTOVER_REQUIRED");

  const sourceRunId = positiveInteger(meta.source_persistent_workflow_run_id, "AM19_GRADUATION_ENVELOPE_SOURCE_RUN_ID_REQUIRED");
  const sourceArtifactId = positiveInteger(meta.source_persistent_artifact_id, "AM19_GRADUATION_ENVELOPE_SOURCE_ARTIFACT_ID_REQUIRED");
  const sourceArtifactName = String(meta.source_persistent_artifact_name || "").trim();
  need(sourceArtifactName.startsWith(`mcft-cap09-am19-persistent24-${subject}-`), "AM19_GRADUATION_ENVELOPE_SOURCE_ARTIFACT_NAME_REQUIRED");
  const sourceArtifactDigest = artifactDigest(meta.source_persistent_artifact_digest);
  const graduationRunId = positiveInteger(meta.graduation_workflow_run_id, "AM19_GRADUATION_ENVELOPE_GRADUATION_RUN_ID_REQUIRED");
  const openedAt = canonicalIso(meta.opened_at, "AM19_GRADUATION_ENVELOPE_OPENED_AT_REQUIRED");

  return {
    schema_version: "geox_mcft_cap09_amendment19_formal_graduation_envelope_v1",
    status: "PASS",
    formal_epoch_creation_gate: "OPEN",
    subject_sha: subject,
    producer_subject_sha: producerSubject,
    cross_head_rehydration: rehydration.cross_head_rehydration,
    opened_at: openedAt,
    source_persistent_workflow_run_id: sourceRunId,
    source_persistent_artifact_id: sourceArtifactId,
    source_persistent_artifact_name: sourceArtifactName,
    source_persistent_artifact_digest: sourceArtifactDigest,
    graduation_workflow_run_id: graduationRunId,
    graduation_input_sha256: sha256File(input.paths.graduation),
    gate_result_sha256: sha256File(input.paths.gate),
    persistent_qualification_result_sha256: sha256File(input.paths.persistent),
    persistence_free_result_sha256: sha256File(input.paths.persistence_free),
    rehydration_result_sha256: sha256File(input.paths.rehydration),
    production_cutover_result_sha256: sha256File(input.paths.cutover),
    qualification_a0: persistent.a0,
    qualification_o00: persistent.o00,
    qualification_o23: persistent.o23,
    machine_status_count: 13,
    static_blocker_count: 0,
    temporal_authority: persistent.temporal_authority,
    same_canonical_core_engineering_and_production: true,
    final_actual_24h_still_required: true,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    formal_database_write_count: 0,
    human_override_used: false,
    mcft_cap09_completed: false,
  };
}

function selftest() {
  const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "am19-gate-envelope-"));
  const subject = "1".repeat(40);
  const producer = "2".repeat(40);
  const write = (name, value) => {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, JSON.stringify(value) + "\n");
    return file;
  };
  const graduation = { schema_version: "geox_mcft_cap09_amendment19_formal_graduation_input_v1", status: "PASS", subject_sha: subject, static_blocker_count: 0, future_formal_epoch_selected: false, formal_o00_started: false, mcft_cap09_completed: false, final_actual_24h_still_required: true };
  const gate = { schema_version: "geox_mcft_cap09_formal_epoch_graduation_gate_result_v1", status: "PASS", formal_epoch_creation_gate: "OPEN", required_status_count: 13, static_blocker_count: 0, human_override_used: false };
  const persistent = { schema_version: "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1", status: "PASS", subject_sha: subject, producer_subject_sha: producer, static_blocker_count: 0, final_actual_24h_still_required: true, formal_o00_started: false, temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1", a0: "2026-08-20T05:00:00.000Z", o00: "2026-08-20T06:00:00.000Z", o23: "2026-08-21T05:00:00.000Z" };
  const persistenceFree = { status: "PASS", machine_statuses: { PERSISTENCE_FREE_24T: "PASS" } };
  const rehydration = { status: "PASS", consumer_subject_sha: subject, producer_subject_sha: producer, cross_head_rehydration: true };
  const cutover = { status: "PASS", shared_canonical_core_bound: true, formal_effect: false };
  const paths = {
    graduation: write("graduation.json", graduation),
    gate: write("gate.json", gate),
    persistent: write("persistent.json", persistent),
    persistence_free: write("persistence-free.json", persistenceFree),
    rehydration: write("rehydration.json", rehydration),
    cutover: write("cutover.json", cutover),
  };
  const base = {
    subject_sha: subject,
    graduation, gate, persistent, persistence_free: persistenceFree, rehydration, cutover, paths,
    metadata: {
      source_persistent_workflow_run_id: 10,
      source_persistent_artifact_id: 11,
      source_persistent_artifact_name: `mcft-cap09-am19-persistent24-${subject}-10`,
      source_persistent_artifact_digest: `sha256:${"a".repeat(64)}`,
      graduation_workflow_run_id: 12,
      opened_at: "2026-08-20T05:10:00.000Z",
    },
  };
  const pass = assemble(base);
  need(pass.status === "PASS" && pass.formal_epoch_creation_gate === "OPEN" && pass.subject_sha === subject && pass.producer_subject_sha === producer && pass.cross_head_rehydration === true, "AM19_GRADUATION_ENVELOPE_SELFTEST_PASS_FAILED");

  const negatives = [
    ["consumer", { ...base, persistent: { ...persistent, subject_sha: "3".repeat(40) } }, "AM19_GRADUATION_ENVELOPE_PERSISTENT_CONSUMER_SUBJECT_REQUIRED"],
    ["producer", { ...base, rehydration: { ...rehydration, producer_subject_sha: "3".repeat(40) } }, "AM19_GRADUATION_ENVELOPE_REHYDRATION_PRODUCER_SUBJECT_REQUIRED"],
    ["cross_head", { ...base, rehydration: { ...rehydration, cross_head_rehydration: false } }, "AM19_GRADUATION_ENVELOPE_REHYDRATION_CROSS_HEAD_FLAG_REQUIRED"],
  ];
  for (const [name, value, expected] of negatives) {
    let observed = "";
    try { assemble(value); } catch (error) { observed = error.message; }
    need(observed === expected, `AM19_GRADUATION_ENVELOPE_SELFTEST_NEGATIVE_FAILED:${name}:${observed}`);
  }
  console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_amendment19_formal_graduation_envelope_selftest_v1", status: "PASS", cross_run_identity_bound: true, cross_head_provenance_bound: true, artifact_digest_bound: true, formal_effect: false }));
}

function main() {
  if (process.argv.includes("--selftest")) return selftest();
  const [persistentPath, persistenceFreePath, rehydrationPath, cutoverPath, graduationPath, gatePath, subject, metadataPath, outPath] = process.argv.slice(2);
  if (![persistentPath, persistenceFreePath, rehydrationPath, cutoverPath, graduationPath, gatePath, subject, metadataPath, outPath].every(Boolean)) {
    fail("AM19_GRADUATION_ENVELOPE_USAGE: persistent persistence-free rehydration cutover graduation gate subject metadata output");
  }
  const paths = {
    persistent: path.resolve(persistentPath),
    persistence_free: path.resolve(persistenceFreePath),
    rehydration: path.resolve(rehydrationPath),
    cutover: path.resolve(cutoverPath),
    graduation: path.resolve(graduationPath),
    gate: path.resolve(gatePath),
  };
  const value = assemble({
    subject_sha: subject,
    persistent: readJson(paths.persistent, "AM19_GRADUATION_ENVELOPE_PERSISTENT_REQUIRED"),
    persistence_free: readJson(paths.persistence_free, "AM19_GRADUATION_ENVELOPE_PERSISTENCE_FREE_REQUIRED"),
    rehydration: readJson(paths.rehydration, "AM19_GRADUATION_ENVELOPE_REHYDRATION_REQUIRED"),
    cutover: readJson(paths.cutover, "AM19_GRADUATION_ENVELOPE_CUTOVER_REQUIRED"),
    graduation: readJson(paths.graduation, "AM19_GRADUATION_ENVELOPE_INPUT_REQUIRED"),
    gate: readJson(paths.gate, "AM19_GRADUATION_ENVELOPE_GATE_REQUIRED"),
    metadata: readJson(path.resolve(metadataPath), "AM19_GRADUATION_ENVELOPE_METADATA_REQUIRED"),
    paths,
  });
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
