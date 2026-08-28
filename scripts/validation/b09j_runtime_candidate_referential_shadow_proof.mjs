import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const base = "http://127.0.0.1:3001";
const token = "admin_token";
const productHead = "03490b4ce54cdb35f2a2965193ed87fdcab24523";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const runId = "b09j_" + Date.now();
const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_" + runId,
  season_id: "season_" + runId,
  device_id: "dev_" + runId,
  credential_id: "cred_" + runId,
};

const sha = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const moduleUrl = (relative) => pathToFileURL(path.resolve(process.cwd(), relative)).href;

async function call(apiPath, method = "GET", body) {
  const res = await fetch(base + apiPath, {
    method,
    headers: {
      authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  assert.equal(res.ok, true, method + " " + apiPath + " failed " + res.status + " " + text);
  assert.equal(json?.ok, true, method + " " + apiPath + " json.ok!=true " + text);
  return json;
}

async function upsertDevice() {
  const ts = Date.now();
  await pool.query("ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'physical'").catch(() => undefined);
  await pool.query("ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_id TEXT NULL").catch(() => undefined);
  await pool.query("ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_status TEXT NULL").catch(() => undefined);
  await pool.query("CREATE TABLE IF NOT EXISTS device_capability (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, capabilities JSONB NOT NULL DEFAULT '[]'::jsonb, updated_ts_ms BIGINT NOT NULL, PRIMARY KEY (tenant_id, device_id))");
  await pool.query("CREATE TABLE IF NOT EXISTS device_binding_index_v1 (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, field_id TEXT NOT NULL, bound_ts_ms BIGINT NULL, PRIMARY KEY (tenant_id, device_id, field_id))");
  await pool.query("CREATE TABLE IF NOT EXISTS device_credential_index_v1 (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, credential_id TEXT NOT NULL, credential_hash TEXT NOT NULL, status TEXT NOT NULL, issued_ts_ms BIGINT NOT NULL, revoked_ts_ms BIGINT NULL, created_ts_ms BIGINT NULL, updated_ts_ms BIGINT NULL, PRIMARY KEY (tenant_id, device_id, credential_id))");
  await pool.query("CREATE TABLE IF NOT EXISTS device_status_index_v1 (tenant_id TEXT NOT NULL, project_id TEXT NULL, group_id TEXT NULL, field_id TEXT NULL, device_id TEXT NOT NULL, status TEXT NULL, last_telemetry_ts_ms BIGINT NULL, last_heartbeat_ts_ms BIGINT NULL, battery_percent INTEGER NULL, rssi_dbm INTEGER NULL, fw_ver TEXT NULL, updated_ts_ms BIGINT NOT NULL, PRIMARY KEY (tenant_id, device_id))");

  await pool.query(
    "INSERT INTO device_index_v1 (tenant_id,device_id,display_name,device_mode,created_ts_ms,last_credential_id,last_credential_status) VALUES ($1,$2,$3,'physical',$4,$5,'ACTIVE') ON CONFLICT (tenant_id,device_id) DO UPDATE SET display_name=EXCLUDED.display_name,device_mode='physical',last_credential_id=EXCLUDED.last_credential_id,last_credential_status='ACTIVE'",
    [scope.tenant_id, scope.device_id, "B09j referential shadow device", ts, scope.credential_id],
  );
  await pool.query(
    "INSERT INTO device_capability (tenant_id,device_id,capabilities,updated_ts_ms) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (tenant_id,device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities,updated_ts_ms=EXCLUDED.updated_ts_ms",
    [scope.tenant_id, scope.device_id, JSON.stringify([
      "telemetry.soil_moisture",
      "telemetry.water_pressure",
      "telemetry.inlet_flow_lpm",
      "telemetry.outlet_flow_lpm",
      "telemetry.pressure_drop_kpa",
      "device.irrigation.valve.open",
    ]), ts],
  );
  await pool.query(
    "INSERT INTO device_binding_index_v1 (tenant_id,device_id,field_id,bound_ts_ms) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,device_id,field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms",
    [scope.tenant_id, scope.device_id, scope.field_id, ts],
  );
  await pool.query(
    "INSERT INTO device_credential_index_v1 (tenant_id,device_id,credential_id,credential_hash,status,issued_ts_ms,revoked_ts_ms,created_ts_ms,updated_ts_ms) VALUES ($1,$2,$3,$4,'ACTIVE',$5,NULL,$5,$5) ON CONFLICT (tenant_id,device_id,credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash,status='ACTIVE',revoked_ts_ms=NULL,updated_ts_ms=EXCLUDED.updated_ts_ms",
    [scope.tenant_id, scope.device_id, scope.credential_id, sha(runId + ":" + scope.device_id + ":credential"), ts],
  );
  await pool.query(
    "INSERT INTO device_status_index_v1 (tenant_id,project_id,group_id,field_id,device_id,status,last_telemetry_ts_ms,last_heartbeat_ts_ms,battery_percent,rssi_dbm,fw_ver,updated_ts_ms) VALUES ($1,$2,$3,$4,$5,'ONLINE',$6,$6,84,-52,'b09j',$6) ON CONFLICT (tenant_id,device_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,status='ONLINE',last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms,last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms,battery_percent=EXCLUDED.battery_percent,rssi_dbm=EXCLUDED.rssi_dbm,updated_ts_ms=EXCLUDED.updated_ts_ms",
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.device_id, ts - 30_000],
  );
}

let writeObservationRunPipelineAndRefreshFieldV1;
let appendRawSampleV1;

async function appendCanonicalRaw(metric, unit, value, tsMs, seq) {
  return appendRawSampleV1(pool, {
    sample_id: "rs_" + runId + "_" + metric + "_" + String(seq).padStart(3, "0"),
    sensor_id: scope.device_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    ts_ms: tsMs,
    metric,
    value,
    unit,
    qc_quality: "ok",
    source: "device",
    sample_kind: "raw",
    interpolated: false,
    synthetic: false,
    fake_sample: false,
    payload: {
      tenant_id: scope.tenant_id,
      project_id: scope.project_id,
      group_id: scope.group_id,
      field_id: scope.field_id,
      device_id: scope.device_id,
      credential_id: scope.credential_id,
      formal_scenario_run_id: runId,
    },
  }, {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
  });
}

async function postObservation(metric, unit, value, tsMs) {
  const client = await pool.connect();
  try {
    return await writeObservationRunPipelineAndRefreshFieldV1(client, {
      tenant_id: scope.tenant_id,
      project_id: scope.project_id,
      group_id: scope.group_id,
      device_id: scope.device_id,
      field_id: scope.field_id,
      metric,
      value,
      unit,
      quality_flags: ["OK"],
      confidence: 0.95,
      observed_at_ts_ms: tsMs,
      source_fact_id: "b09j_fixture:" + runId + ":" + metric + ":" + tsMs,
      source_lane: "FORMAL_OPERATION",
      is_simulated: false,
      formal_eligible: true,
      evidence_level: "FORMAL",
      dev_source: "B09J_VALIDATION_FIXTURE",
    });
  } finally {
    client.release();
  }
}

function legacySemantic(judgeResult) {
  const outputs = { ...(judgeResult.outputs ?? {}) };
  delete outputs.agronomy_evidence_dependency_shadow_v1;
  delete outputs.agronomy_qualified_evidence_criterion_shadow_v1;
  delete outputs.decision_recommendation_candidate_criterion_shadow_binding_v1;
  return {
    judge_kind: judgeResult.judge_kind,
    tenant_id: judgeResult.tenant_id,
    project_id: judgeResult.project_id,
    group_id: judgeResult.group_id,
    field_id: judgeResult.field_id,
    season_id: judgeResult.season_id,
    device_id: judgeResult.device_id,
    recommendation_id: judgeResult.recommendation_id,
    prescription_id: judgeResult.prescription_id,
    verdict: judgeResult.verdict,
    severity: judgeResult.severity,
    reasons: judgeResult.reasons,
    inputs: judgeResult.inputs,
    outputs,
    confidence: judgeResult.confidence,
    evidence_refs: judgeResult.evidence_refs,
    source_refs: judgeResult.source_refs,
  };
}

function expectedIdentity(sourceFactId) {
  const material = [
    "SOURCE_FACT_SCOPE_SHA256_V1",
    "decision_recommendation_v1",
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    sourceFactId,
  ];
  const digest = crypto.createHash("sha256").update(material.join("\u001f")).digest("hex");
  return {
    digest,
    candidate_id: "candidate_sfsha256_" + digest,
    candidate_ref: "candidate_decision_v1:candidate_sfsha256_" + digest,
  };
}

async function main() {
  ({ writeObservationRunPipelineAndRefreshFieldV1 } = await import(moduleUrl("apps/server/src/services/device_observation_service_v1.ts")));
  ({ appendRawSampleV1 } = await import(moduleUrl("apps/server/src/domain/sensing/raw_sample_fact_envelope_v1.ts")));

  await upsertDevice();

  await call("/api/v1/programs", "POST", {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    program_id: "prg_" + runId,
    field_id: scope.field_id,
    season_id: scope.season_id,
    crop_code: "corn",
    status: "ACTIVE",
    goal_profile: {
      yield_priority: "high",
      quality_priority: "medium",
      residue_priority: "low",
      water_saving_priority: "medium",
      cost_priority: "medium",
    },
    constraints: {
      forbid_pesticide_classes: [],
      forbid_fertilizer_types: [],
      max_irrigation_mm_per_day: null,
      manual_approval_required_for: [],
      allow_night_irrigation: true,
      max_irrigation_rounds_per_day: 3,
    },
    budget: { max_cost_total: null, currency: "USD" },
    execution_policy: { mode: "approval_required", auto_execute_allowed_task_types: [] },
  });

  const rawMetrics = [
    ["soil_moisture", "%", 19],
    ["inlet_flow_lpm", "L/min", 36],
    ["outlet_flow_lpm", "L/min", 20],
    ["pressure_drop_kpa", "kPa", 38],
  ];
  const rawStartTs = Date.now() - 6 * 60 * 60 * 1000 + 60 * 1000;
  let rawSeq = 0;
  for (const [metric, unit, baseValue] of rawMetrics) {
    for (let i = 0; i < 19; i += 1) {
      rawSeq += 1;
      await appendCanonicalRaw(metric, unit, Number(baseValue) + i * 0.01, rawStartTs + i * 20 * 60 * 1000, rawSeq);
    }
  }

  const markerCount = await pool.query(
    "SELECT count(*)::int AS n FROM markers WHERE kind='raw_sample_runtime_available_v1' AND payload_json->>'field_id'=$1",
    [scope.field_id],
  );
  assert.equal(Number(markerCount.rows[0]?.n ?? 0), 76, "post-commit availability markers missing");

  const observations = [
    ["soil_moisture", "%", 19.18],
    ["signal_strength_dbm", "dBm", -52],
    ["battery_level_pct", "%", 84],
    ["packet_loss_rate_pct", "%", 0.5],
    ["inlet_flow_lpm", "L/min", 36.18],
    ["outlet_flow_lpm", "L/min", 20.18],
    ["pressure_drop_kpa", "kPa", 38.18],
  ];
  const observationStartTs = Date.now() - 7 * 60 * 1000;
  for (let i = 0; i < observations.length; i += 1) {
    const [metric, unit, value] = observations[i];
    await postObservation(metric, unit, value, observationStartTs + i * 60 * 1000);
  }

  const recommendation = await call("/api/v1/recommendations/generate", "POST", {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: scope.season_id,
    device_id: scope.device_id,
    crop_code: "corn",
  });
  const recommendationId = String(recommendation?.recommendations?.[0]?.recommendation_id ?? "").trim();
  assert.ok(recommendationId, "generated recommendation_id missing");

  const recommendationRows = await pool.query(
    "SELECT fact_id,occurred_at,source,record_json FROM facts WHERE (record_json::jsonb->>'type')='decision_recommendation_v1' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,project_id}')=$2 AND (record_json::jsonb#>>'{payload,group_id}')=$3 AND (record_json::jsonb#>>'{payload,recommendation_id}')=$4 ORDER BY occurred_at DESC,fact_id DESC",
    [scope.tenant_id, scope.project_id, scope.group_id, recommendationId],
  );
  assert.equal(recommendationRows.rows.length, 1, "generated recommendation must resolve to exactly one source fact");
  const recRow = recommendationRows.rows[0];
  const recPayload = recRow.record_json?.payload ?? {};
  assert.equal(String(recRow.source), "api/v1/recommendations/generate");
  assert.equal(String(recPayload.field_id), scope.field_id);
  assert.equal(String(recPayload.season_id), scope.season_id);
  assert.equal(String(recPayload.device_id), scope.device_id);
  assert.ok(String(recPayload.action_type ?? "").trim());
  assert.ok(["proposed", "candidate"].includes(String(recPayload.status ?? "").trim().toLowerCase()));

  const forbiddenGenerateWrites = await pool.query(
    "SELECT record_json::jsonb->>'type' AS type,count(*)::int AS n FROM facts WHERE source='api/v1/recommendations/generate' AND (record_json::jsonb->>'type') = ANY($1::text[]) GROUP BY type ORDER BY type",
    [["approval_request_v1", "approval_decision_v1", "operation_plan_v1", "operation_plan_transition_v1", "ao_act_task_v0", "ao_act_receipt_v1"]],
  );
  assert.deepEqual(forbiddenGenerateWrites.rows, []);

  const decisionTime = Date.now() + 1000;
  const evidence = await call("/api/v1/judge/evidence/evaluate", "POST", {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    device_id: scope.device_id,
    soil_moisture: 0.5,
    observed_at_ts_ms: Date.now() - 60_000,
    now_ts_ms: decisionTime,
    last_heartbeat_ts_ms: decisionTime - 30_000,
    last_telemetry_ts_ms: decisionTime - 30_000,
    evidence_refs: ["b09j:runtime"],
  });

  const canonicalEvidence = evidence.judge_result.outputs?.canonical_evidence_sufficiency_shadow_v1;
  assert.ok(canonicalEvidence, "canonical Evidence Judge shadow missing");
  assert.notEqual(canonicalEvidence.status, "UNKNOWN");
  assert.equal(canonicalEvidence.canonical_evidence_qualification_refs_state, "AVAILABLE");
  const canonicalRefs = [...(canonicalEvidence.canonical_evidence_qualification_refs ?? [])].map(String).sort();
  assert.ok(canonicalRefs.length > 0, "canonical EvidenceQualification refs missing");

  const agronomyBody = {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    recommendation_id: recommendationId,
    field_id: scope.field_id,
    season_id: scope.season_id,
    device_id: scope.device_id,
    evidence_judge_verdict: evidence.judge_result.verdict,
    soil_moisture: 0.7,
    target_soil_moisture: 0.5,
    root_zone_depth_mm: 300,
    rain_forecast_mm_72h: 0,
    et0_mm_72h: 0,
    crop_stage: "V6",
    application_efficiency: 0.8,
    evidence_refs: ["b09j:runtime"],
  };

  const baseline = await call("/api/v1/judge/agronomy/evaluate", "POST", agronomyBody);
  const baselineShadow = baseline.judge_result.outputs?.decision_recommendation_candidate_criterion_shadow_binding_v1;
  assert.equal(baselineShadow?.binding_state, "CRITERION_NOT_READY");
  assert.equal(baselineShadow?.candidate_ref, null);

  const bound = await call("/api/v1/judge/agronomy/evaluate", "POST", {
    ...agronomyBody,
    evidence_judge_id: evidence.judge_result.judge_id,
  });

  assert.deepEqual(
    legacySemantic(bound.judge_result),
    legacySemantic(baseline.judge_result),
    "B09j shadow attachment changed historical Agronomy semantics",
  );

  const evidenceBinding = bound.judge_result.outputs?.agronomy_evidence_dependency_shadow_v1;
  const criterion = bound.judge_result.outputs?.agronomy_qualified_evidence_criterion_shadow_v1;
  const candidateShadow = bound.judge_result.outputs?.decision_recommendation_candidate_criterion_shadow_binding_v1;

  assert.equal(evidenceBinding?.binding_state, "BOUND");
  assert.equal(evidenceBinding?.criterion_shadow_provenance_readiness, "READY_FOR_CRITERION_SHADOW");
  assert.deepEqual([...(evidenceBinding?.canonical_evidence_qualification_refs ?? [])].map(String).sort(), canonicalRefs);

  assert.equal(criterion?.projection_state, "CRITERION_PROJECTED");
  assert.equal(criterion?.candidate_binding_state, "NOT_BOUND");
  assert.equal(criterion?.candidate_ref, null);
  const criterionRefs = [...(criterion?.criterion_assessment?.support_refs ?? [])].map(String).sort();
  assert.deepEqual(criterionRefs, canonicalRefs);

  const identity = expectedIdentity(String(recRow.fact_id));
  assert.equal(candidateShadow?.binding_state, "BOUND");
  assert.equal(candidateShadow?.authority_mode, "SHADOW_NON_AUTHORITATIVE");
  assert.equal(candidateShadow?.source_fact_count, 1);
  assert.equal(candidateShadow?.source_fact_id, String(recRow.fact_id));
  assert.equal(candidateShadow?.source_fact_ref, String(recRow.fact_id));
  assert.equal(candidateShadow?.source_fact_source, "api/v1/recommendations/generate");
  assert.equal(candidateShadow?.candidate_identity_policy, "SOURCE_FACT_SCOPE_SHA256_V1");
  assert.equal(candidateShadow?.candidate_identity_digest_sha256, identity.digest);
  assert.equal(candidateShadow?.candidate_id, identity.candidate_id);
  assert.equal(candidateShadow?.candidate_ref, identity.candidate_ref);
  assert.equal(candidateShadow?.candidate_projection_state, "PROJECTED");
  assert.equal(candidateShadow?.candidate_decision?.authority_state, "CANDIDATE_ONLY");
  assert.equal(candidateShadow?.candidate_decision?.source_ref, String(recRow.fact_id));
  assert.equal(candidateShadow?.candidate_decision?.scope?.field_id, scope.field_id);
  assert.equal(candidateShadow?.candidate_decision?.basis?.context_snapshot_ref, null);
  assert.equal(candidateShadow?.candidate_decision?.basis?.crop_stage_state_ref, null);
  assert.deepEqual(candidateShadow?.candidate_decision?.basis?.calculation_result_refs, []);
  assert.deepEqual([...(candidateShadow?.candidate_evidence_qualification_refs ?? [])].map(String).sort(), canonicalRefs);
  assert.deepEqual([...(candidateShadow?.criterion_support_refs ?? [])].map(String).sort(), canonicalRefs);
  assert.equal(candidateShadow?.canonical_evidence_continuity_state, "EXACT_REF_SET_MATCH");
  assert.equal(candidateShadow?.criterion_candidate_binding_state, "BOUND_TO_SAME_CANDIDATE");
  assert.equal(candidateShadow?.decision_eligibility_input_materialization_state, "NOT_READY_CANONICAL_EVIDENCE_OBJECTS_NOT_BOUND");
  assert.equal(candidateShadow?.decision_eligibility_runtime_connected, false);
  assert.equal(candidateShadow?.legacy_agronomy_result_unchanged, true);
  assert.equal(candidateShadow?.consumer_migration_performed, false);
  assert.equal(candidateShadow?.authority_removal_permitted, false);
  assert.equal(candidateShadow?.candidate_decision?.basis?.evidence_qualification_refs?.includes("b09j:runtime"), false);

  const boundAgain = await call("/api/v1/judge/agronomy/evaluate", "POST", {
    ...agronomyBody,
    evidence_judge_id: evidence.judge_result.judge_id,
  });
  const shadowAgain = boundAgain.judge_result.outputs?.decision_recommendation_candidate_criterion_shadow_binding_v1;
  assert.equal(shadowAgain?.binding_state, "BOUND");
  assert.equal(shadowAgain?.candidate_id, candidateShadow.candidate_id);
  assert.equal(shadowAgain?.candidate_ref, candidateShadow.candidate_ref);

  const candidateFacts = await pool.query(
    "SELECT count(*)::int AS n FROM facts WHERE (record_json::jsonb->>'type')='candidate_decision_v1'",
  );
  assert.equal(Number(candidateFacts.rows[0]?.n ?? 0), 0, "B09j shadow must not persist CandidateDecision facts");

  const downstream = await pool.query(
    "SELECT count(*)::int AS n FROM facts WHERE (record_json::jsonb->>'type') IN ('decision_recommendation_approval_link_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1') AND ((record_json::jsonb#>>'{payload,recommendation_id}')=$1 OR (record_json::jsonb#>>'{payload,source_recommendation_id}')=$1)",
    [recommendationId],
  );
  assert.equal(Number(downstream.rows[0]?.n ?? 0), 0, "B09j bounded recommendation unexpectedly gained downstream authority");

  const duplicateFactId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,NOW(),$2,$3::jsonb)",
    [duplicateFactId, "api/v1/recommendations/generate", JSON.stringify(recRow.record_json)],
  );
  const ambiguous = await call("/api/v1/judge/agronomy/evaluate", "POST", {
    ...agronomyBody,
    evidence_judge_id: evidence.judge_result.judge_id,
  });
  const ambiguousShadow = ambiguous.judge_result.outputs?.decision_recommendation_candidate_criterion_shadow_binding_v1;
  assert.equal(ambiguousShadow?.binding_state, "SOURCE_AMBIGUOUS");
  assert.equal(ambiguousShadow?.source_fact_count, 2);
  assert.equal(ambiguousShadow?.candidate_id, null);
  assert.equal(ambiguousShadow?.candidate_ref, null);
  assert.equal(ambiguousShadow?.candidate_decision, null);
  assert.equal(ambiguousShadow?.decision_eligibility_runtime_connected, false);
  assert.equal(ambiguousShadow?.consumer_migration_performed, false);
  assert.equal(ambiguousShadow?.authority_removal_permitted, false);

  const persisted = await call(
    "/api/v1/judge/results/" + encodeURIComponent(bound.judge_result.judge_id) + "?" + new URLSearchParams({
      tenant_id: scope.tenant_id,
      project_id: scope.project_id,
      group_id: scope.group_id,
    }).toString(),
  );
  const persistedShadow = persisted.judge_result.outputs?.decision_recommendation_candidate_criterion_shadow_binding_v1;
  assert.equal(persistedShadow?.binding_state, "BOUND");
  assert.equal(persistedShadow?.candidate_id, candidateShadow.candidate_id);
  assert.deepEqual([...(persistedShadow?.criterion_support_refs ?? [])].map(String).sort(), canonicalRefs);

  const out = {
    schema_version: "b09j_runtime_candidate_referential_shadow_proof_v1",
    product_head: productHead,
    observation_scope_class: "SYNTHETIC_ACCEPTANCE_RUNTIME",
    runtime_path: "PRODUCT_RAW_PERSISTENCE_PLUS_OBSERVATION_PIPELINE_TO_HTTP_RECOMMENDATION_THEN_EVIDENCE_AGRONOMY_SHADOW",
    recommendation_source_fact_id: String(recRow.fact_id),
    recommendation_id: recommendationId,
    recommendation_source: "api/v1/recommendations/generate",
    recommendation_field_id: scope.field_id,
    recommendation_season_id: scope.season_id,
    recommendation_device_id: scope.device_id,
    candidate_identity_policy: candidateShadow.candidate_identity_policy,
    candidate_identity_digest_sha256: candidateShadow.candidate_identity_digest_sha256,
    candidate_id: candidateShadow.candidate_id,
    candidate_ref: candidateShadow.candidate_ref,
    evidence_judge_id: evidence.judge_result.judge_id,
    agronomy_judge_id: bound.judge_result.judge_id,
    canonical_evidence_qualification_ref_count: canonicalRefs.length,
    canonical_evidence_qualification_refs: canonicalRefs,
    criterion_status: criterion.criterion_assessment.status,
    candidate_evidence_qualification_refs: [...candidateShadow.candidate_evidence_qualification_refs].map(String).sort(),
    criterion_support_refs: [...candidateShadow.criterion_support_refs].map(String).sort(),
    canonical_evidence_continuity_state: candidateShadow.canonical_evidence_continuity_state,
    criterion_candidate_binding_state: candidateShadow.criterion_candidate_binding_state,
    deterministic_repeat_candidate_id: shadowAgain.candidate_id,
    duplicate_source_fail_closed_state: ambiguousShadow.binding_state,
    candidate_decision_fact_count: Number(candidateFacts.rows[0]?.n ?? 0),
    downstream_authority_fact_count: Number(downstream.rows[0]?.n ?? 0),
    decision_eligibility_input_materialization_state: candidateShadow.decision_eligibility_input_materialization_state,
    decision_eligibility_runtime_connected: candidateShadow.decision_eligibility_runtime_connected,
    consumer_migration_performed: candidateShadow.consumer_migration_performed,
    authority_removal_permitted: candidateShadow.authority_removal_permitted,
    legacy_agronomy_semantics_unchanged: true,
    b09h_original_candidate_binding_state: criterion.candidate_binding_state,
    b09h_original_candidate_ref: criterion.candidate_ref,
    nonclaims: [
      "CANDIDATE_BINDING_DOES_NOT_MEAN_FINAL_DECISION_ELIGIBILITY",
      "FULL_CANONICAL_EVIDENCE_QUALIFICATION_OBJECTS_NOT_BOUND_FOR_B07E",
      "NO_CANDIDATE_DECISION_PERSISTENCE",
      "NO_CONSUMER_MIGRATION",
      "NO_AUTHORITY_REMOVAL",
    ],
  };

  fs.mkdirSync(path.resolve(process.cwd(), "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.resolve(process.cwd(), "acceptance-output/b09j-runtime-candidate-referential-shadow-proof.json"),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(JSON.stringify(out, null, 2));
  console.log("B09J_RUNTIME_CANDIDATE_REFERENTIAL_SHADOW_PROOF_PASS");
}

try {
  await main();
} finally {
  await pool.end();
}
