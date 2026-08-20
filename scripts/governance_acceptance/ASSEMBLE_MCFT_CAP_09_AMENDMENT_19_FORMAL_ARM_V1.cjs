#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const FORMAL_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h_v3";
const FAILED_FORMAL_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";
const MIN_ARM_TO_O00_LEAD_MINUTES = 35;
const EXPECTED_RECORD_TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function readJson(file, code) {
  if (!fs.existsSync(file)) fail(code);
  return JSON.parse(fs.readFileSync(file, "utf8"));
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
function canonicalHour(value, code) {
  const text = canonicalIso(value, code);
  if (!text.endsWith(":00:00.000Z")) fail(code);
  return text;
}
function positiveInteger(value, code) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) fail(code);
  return n;
}
function digestValue(value, code) {
  const text = String(value || "").trim();
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) fail(code);
  return text;
}
function addHours(value, hours) {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}
function semanticDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
function exactRecordTypes(value) {
  return Array.isArray(value) && JSON.stringify([...value].sort()) === JSON.stringify(EXPECTED_RECORD_TYPES);
}

function assemble(gate, candidate, metadata) {
  const currentMain = exactSha(metadata.current_protected_main_sha, "AM19_FORMAL_ARM_CURRENT_MAIN_SHA_REQUIRED");
  const gateSubject = exactSha(gate?.subject_sha, "AM19_FORMAL_ARM_GATE_SUBJECT_REQUIRED");
  const rollingSubject = exactSha(candidate?.producer_subject_sha, "AM19_FORMAL_ARM_ROLLING_SUBJECT_REQUIRED");
  need(candidate.subject_sha === rollingSubject, "AM19_FORMAL_ARM_CANDIDATE_SUBJECT_ALIAS_MISMATCH");
  need(gateSubject === rollingSubject && gateSubject === currentMain, "AM19_FORMAL_ARM_EXACT_SUBJECT_CHAIN_REQUIRED");

  need(gate?.schema_version === "geox_mcft_cap09_amendment19_formal_graduation_envelope_v1", "AM19_FORMAL_ARM_GATE_ENVELOPE_SCHEMA_REQUIRED");
  need(gate.status === "PASS" && gate.formal_epoch_creation_gate === "OPEN", "AM19_FORMAL_ARM_GATE_OPEN_REQUIRED");
  need(gate.machine_status_count === 13 && gate.static_blocker_count === 0 && gate.human_override_used === false, "AM19_FORMAL_ARM_MACHINE_GATE_REQUIRED");
  need(gate.final_actual_24h_still_required === true && gate.future_formal_epoch_selected === false && gate.formal_o00_started === false && gate.mcft_cap09_completed === false, "AM19_FORMAL_ARM_GATE_PREMATURE_FORMAL_EFFECT");
  need(Number(gate.formal_database_write_count) === 0, "AM19_FORMAL_ARM_GATE_FORMAL_DB_ZERO_REQUIRED");

  need(candidate?.schema_version === "geox_mcft_cap09_rolling_preboundary_candidate_v1", "AM19_FORMAL_ARM_CANDIDATE_SCHEMA_REQUIRED");
  need(candidate.status === "PASS" && candidate.temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "AM19_FORMAL_ARM_CANDIDATE_PASS_REQUIRED");
  need(exactRecordTypes(candidate.record_types), "AM19_FORMAL_ARM_EXACT_THREE_RECORD_TYPES_REQUIRED");
  need(candidate.causal_contract?.soil_observation_inside_t_minus_15_to_t === true
    && candidate.causal_contract?.future_weather_available_and_ingested_by_t === true
    && candidate.causal_contract?.future_et0_available_and_ingested_by_t === true
    && candidate.causal_contract?.same_cycle_future_weather_et0 === true
    && candidate.causal_contract?.no_future_leakage === true
    && candidate.causal_contract?.raw_retained_before_canonicalization === true,
  "AM19_FORMAL_ARM_CAUSAL_CANDIDATE_REQUIRED");
  need(candidate.side_effects?.formal_database_write_count === 0
    && candidate.side_effects?.formal_r2_prefix_write_count === 0
    && candidate.side_effects?.scheduler_write_count === 0
    && candidate.side_effects?.runtime_write_count === 0
    && candidate.side_effects?.formal_effect === false,
  "AM19_FORMAL_ARM_CANDIDATE_FORMAL_ZERO_REQUIRED");
  need(Array.isArray(candidate.raw_retention_refs) && candidate.raw_retention_refs.length >= 2, "AM19_FORMAL_ARM_RAW_RETENTION_REFS_REQUIRED");
  need(typeof candidate.semantic_manifest_digest === "string" && /^sha256:[0-9a-f]{64}$/.test(candidate.semantic_manifest_digest), "AM19_FORMAL_ARM_CANDIDATE_MANIFEST_DIGEST_REQUIRED");

  const gateOpenedAt = canonicalIso(gate.opened_at, "AM19_FORMAL_ARM_GATE_OPENED_AT_REQUIRED");
  const rollingCompletedAt = canonicalIso(metadata.rolling_workflow_completed_at, "AM19_FORMAL_ARM_ROLLING_COMPLETED_AT_REQUIRED");
  const evaluatedAt = canonicalIso(metadata.arm_evaluated_at, "AM19_FORMAL_ARM_EVALUATED_AT_REQUIRED");
  need(Date.parse(rollingCompletedAt) > Date.parse(gateOpenedAt), "AM19_FORMAL_ARM_POST_GATE_ROLLING_REQUIRED");
  need(Date.parse(evaluatedAt) >= Date.parse(rollingCompletedAt), "AM19_FORMAL_ARM_EVALUATION_BEFORE_ROLLING_COMPLETION_FORBIDDEN");

  const a0 = canonicalHour(candidate.target_t, "AM19_FORMAL_ARM_A0_EXACT_HOUR_REQUIRED");
  const capturedAt = canonicalIso(candidate.captured_at, "AM19_FORMAL_ARM_CAPTURED_AT_REQUIRED");
  const expiresAt = canonicalIso(candidate.candidate_expires_at, "AM19_FORMAL_ARM_CANDIDATE_EXPIRY_REQUIRED");
  need(Date.parse(capturedAt) <= Date.parse(a0), "AM19_FORMAL_ARM_CAPTURE_AFTER_A0_FORBIDDEN");
  need(Date.parse(evaluatedAt) < Date.parse(a0), "AM19_FORMAL_ARM_A0_MUST_BE_FUTURE");
  need(Date.parse(evaluatedAt) < Date.parse(expiresAt), "AM19_FORMAL_ARM_CANDIDATE_EXPIRED");
  const o00 = addHours(a0, 1);
  const o23 = addHours(a0, 24);
  const leadMinutes = (Date.parse(o00) - Date.parse(evaluatedAt)) / 60_000;
  need(leadMinutes >= MIN_ARM_TO_O00_LEAD_MINUTES, `AM19_FORMAL_ARM_INSUFFICIENT_O00_LEAD:${leadMinutes.toFixed(3)}`);

  const gateArtifactId = positiveInteger(metadata.gate_artifact_id, "AM19_FORMAL_ARM_GATE_ARTIFACT_ID_REQUIRED");
  const gateArtifactDigest = digestValue(metadata.gate_artifact_digest, "AM19_FORMAL_ARM_GATE_ARTIFACT_DIGEST_REQUIRED");
  const gateArtifactName = String(metadata.gate_artifact_name || "").trim();
  need(gateArtifactName.startsWith(`mcft-cap09-am19-formal-graduation-${currentMain}-`), "AM19_FORMAL_ARM_GATE_ARTIFACT_NAME_REQUIRED");
  const rollingRunId = positiveInteger(metadata.rolling_workflow_run_id, "AM19_FORMAL_ARM_ROLLING_RUN_ID_REQUIRED");
  const rollingArtifactId = positiveInteger(metadata.rolling_artifact_id, "AM19_FORMAL_ARM_ROLLING_ARTIFACT_ID_REQUIRED");
  const rollingArtifactDigest = digestValue(metadata.rolling_artifact_digest, "AM19_FORMAL_ARM_ROLLING_ARTIFACT_DIGEST_REQUIRED");
  const rollingArtifactName = String(metadata.rolling_artifact_name || "").trim();
  need(rollingArtifactName.startsWith("mcft-cap09-rolling-preboundary-") && rollingArtifactName.endsWith(`-${currentMain}`), "AM19_FORMAL_ARM_ROLLING_ARTIFACT_NAME_REQUIRED");

  need(FORMAL_DATABASE !== FAILED_FORMAL_DATABASE, "AM19_FORMAL_ARM_FAILED_DATABASE_REUSE_FORBIDDEN");
  const epochId = `mcft_cap09_am19_formal_${a0.replace(/[^0-9]/g, "")}_${currentMain.slice(0, 12)}`;
  const manifestRef = `formal-arm://mcft-cap09/amendment19/${epochId}/${FORMAL_DATABASE}`;
  const armIdentity = {
    subject_sha: currentMain,
    gate_artifact_id: gateArtifactId,
    gate_artifact_digest: gateArtifactDigest,
    rolling_workflow_run_id: rollingRunId,
    rolling_artifact_id: rollingArtifactId,
    rolling_artifact_digest: rollingArtifactDigest,
    candidate_semantic_manifest_digest: candidate.semantic_manifest_digest,
    a0,
    o00,
    o23,
    formal_database_name: FORMAL_DATABASE,
    epoch_id: epochId,
    manifest_ref: manifestRef,
  };

  return {
    schema_version: "geox_mcft_cap09_amendment19_formal_arm_v1",
    status: "PASS",
    subject_sha: currentMain,
    arm_identity_hash: semanticDigest(armIdentity),
    gate: {
      opened_at: gateOpenedAt,
      graduation_workflow_run_id: gate.graduation_workflow_run_id,
      artifact_id: gateArtifactId,
      artifact_name: gateArtifactName,
      artifact_digest: gateArtifactDigest,
      source_persistent_workflow_run_id: gate.source_persistent_workflow_run_id,
      source_persistent_artifact_id: gate.source_persistent_artifact_id,
      source_persistent_artifact_digest: gate.source_persistent_artifact_digest,
      graduation_input_sha256: gate.graduation_input_sha256,
      gate_result_sha256: gate.gate_result_sha256,
    },
    rolling: {
      workflow_run_id: rollingRunId,
      workflow_completed_at: rollingCompletedAt,
      artifact_id: rollingArtifactId,
      artifact_name: rollingArtifactName,
      artifact_digest: rollingArtifactDigest,
      target_t: a0,
      captured_at: capturedAt,
      candidate_expires_at: expiresAt,
      semantic_manifest_digest: candidate.semantic_manifest_digest,
      record_types: [...candidate.record_types].sort(),
      raw_retention_refs: [...candidate.raw_retention_refs].sort(),
      raw_ref_ledger: candidate.raw_ref_ledger,
      rehydration_manifest: candidate.rehydration_manifest,
    },
    epoch_id: epochId,
    formal_database_name: FORMAL_DATABASE,
    a0,
    o00,
    o23,
    manifest_ref: manifestRef,
    arm_evaluated_at: evaluatedAt,
    arm_to_o00_lead_minutes: leadMinutes,
    minimum_arm_to_o00_lead_minutes: MIN_ARM_TO_O00_LEAD_MINUTES,
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    bootstrap_lease_clock_required: "REAL_DATABASE_TRANSACTION_TIMESTAMP",
    bootstrap_lease_expiry_must_be_lte_o00: true,
    formal_clock_mode_required: "SYSTEM_DATABASE_UTC",
    accelerated_clock_authorized_for_formal: false,
    provider_fetch_authorized_in_runtime: false,
    formal_database_write_count: 0,
    formal_r2_write_count: 0,
    scheduler_write_count: 0,
    runtime_write_count: 0,
    future_formal_epoch_selected: true,
    formal_a0_bootstrapped: false,
    formal_o00_started: false,
    final_actual_24h_still_required: true,
    human_override_used: false,
    mcft_cap09_completed: false,
  };
}

function selftest() {
  const subject = "1".repeat(40);
  const gate = {
    schema_version: "geox_mcft_cap09_amendment19_formal_graduation_envelope_v1",
    status: "PASS", formal_epoch_creation_gate: "OPEN", subject_sha: subject,
    opened_at: "2026-08-20T05:10:00.000Z", machine_status_count: 13, static_blocker_count: 0,
    human_override_used: false, final_actual_24h_still_required: true, future_formal_epoch_selected: false,
    formal_o00_started: false, formal_database_write_count: 0, mcft_cap09_completed: false,
    graduation_workflow_run_id: 12, source_persistent_workflow_run_id: 10, source_persistent_artifact_id: 11,
    source_persistent_artifact_digest: `sha256:${"a".repeat(64)}`, graduation_input_sha256: `sha256:${"b".repeat(64)}`,
    gate_result_sha256: `sha256:${"c".repeat(64)}`,
  };
  const candidate = {
    schema_version: "geox_mcft_cap09_rolling_preboundary_candidate_v1", status: "PASS",
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1", producer_subject_sha: subject, subject_sha: subject,
    target_t: "2026-08-20T07:00:00.000Z", captured_at: "2026-08-20T06:30:00.000Z",
    candidate_expires_at: "2026-08-21T18:00:00.000Z", record_types: EXPECTED_RECORD_TYPES,
    semantic_manifest_digest: `sha256:${"d".repeat(64)}`, raw_retention_refs: ["r1", "r2"], raw_ref_ledger: [], rehydration_manifest: {},
    causal_contract: { soil_observation_inside_t_minus_15_to_t: true, future_weather_available_and_ingested_by_t: true, future_et0_available_and_ingested_by_t: true, same_cycle_future_weather_et0: true, no_future_leakage: true, raw_retained_before_canonicalization: true },
    side_effects: { formal_database_write_count: 0, formal_r2_prefix_write_count: 0, scheduler_write_count: 0, runtime_write_count: 0, formal_effect: false },
  };
  const metadata = {
    current_protected_main_sha: subject, rolling_workflow_completed_at: "2026-08-20T06:31:00.000Z", arm_evaluated_at: "2026-08-20T06:32:00.000Z",
    gate_artifact_id: 20, gate_artifact_name: `mcft-cap09-am19-formal-graduation-${subject}-12`, gate_artifact_digest: `sha256:${"e".repeat(64)}`,
    rolling_workflow_run_id: 21, rolling_artifact_id: 22, rolling_artifact_name: `mcft-cap09-rolling-preboundary-20260820t070000z-${subject}`, rolling_artifact_digest: `sha256:${"f".repeat(64)}`,
  };
  const pass = assemble(gate, candidate, metadata);
  need(pass.status === "PASS" && pass.a0 === candidate.target_t && pass.formal_o00_started === false && pass.formal_database_write_count === 0, "AM19_FORMAL_ARM_SELFTEST_PASS_FAILED");
  const negatives = [
    ["subject", gate, candidate, { ...metadata, current_protected_main_sha: "2".repeat(40) }, "AM19_FORMAL_ARM_EXACT_SUBJECT_CHAIN_REQUIRED"],
    ["pre_gate", gate, candidate, { ...metadata, rolling_workflow_completed_at: "2026-08-20T05:09:00.000Z", arm_evaluated_at: "2026-08-20T05:09:30.000Z" }, "AM19_FORMAL_ARM_POST_GATE_ROLLING_REQUIRED"],
    ["nonfuture_a0", gate, candidate, { ...metadata, arm_evaluated_at: "2026-08-20T07:00:00.000Z" }, "AM19_FORMAL_ARM_A0_MUST_BE_FUTURE"],
  ];
  for (const [name, g, c, meta, expected] of negatives) {
    let observed = "";
    try { assemble(g, c, meta); } catch (error) { observed = error instanceof Error ? error.message : String(error); }
    need(observed === expected, `AM19_FORMAL_ARM_SELFTEST_NEGATIVE_FAILED:${name}:${observed}`);
  }
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_amendment19_formal_arm_selftest_v1",
    status: "PASS",
    post_gate_order_required: true,
    future_a0_required: true,
    minimum_o00_lead_minutes: MIN_ARM_TO_O00_LEAD_MINUTES,
    formal_effect: false,
  }));
}

function main() {
  if (process.argv.includes("--selftest")) return selftest();
  const [gatePath, candidatePath, metadataPath, outPath] = process.argv.slice(2);
  if (![gatePath, candidatePath, metadataPath, outPath].every(Boolean)) fail("AM19_FORMAL_ARM_USAGE: gate-envelope candidate metadata output");
  const value = assemble(
    readJson(path.resolve(gatePath), "AM19_FORMAL_ARM_GATE_FILE_REQUIRED"),
    readJson(path.resolve(candidatePath), "AM19_FORMAL_ARM_CANDIDATE_FILE_REQUIRED"),
    readJson(path.resolve(metadataPath), "AM19_FORMAL_ARM_METADATA_FILE_REQUIRED"),
  );
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
