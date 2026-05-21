import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

import { assertFlightTableEvidenceArtifactNotFormalV1, EvidenceArtifactV1PayloadSchema } from "@geox/contracts";
import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { classifyEvidenceArtifactV1 } from "../../domain/evidence/formal_evidence_policy_v1.js";
import { sanitizeFlightTableManifestV1, type FlightTableRunV1, type FlightTableStepV1 } from "./flight_table_manifest_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import { ensureFlightTableRunDirV1, flightTableRunDirV1, snapshotRefFromSnapshotV1, writeFlightTableApiSnapshotV1 } from "./flight_table_snapshots_v1.js";

export type FlightTableEvidenceLaneV1 = "success" | "evidence_insufficient" | "weather_interference" | "skill_failure";

export type FlightTableEvidenceRunInputV1 = {
  lane?: FlightTableEvidenceLaneV1;
  operation_id?: string;
  operation_plan_id?: string;
  act_task_id?: string;
  receipt_id?: string;
  field_id?: string;
};

export type FlightTableEvidenceRunResultV1 = {
  ok: true;
  lane: FlightTableEvidenceLaneV1;
  operation_id: string;
  evidence_status: "COMPLETE" | "INSUFFICIENT" | "WEATHER_EXCLUDED" | "UNTRUSTED";
  acceptance_status: string;
  final_status: string;
  evidence_export_job_id: string | null;
  evidence_export_job_status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "UNKNOWN";
  raw_export_status: string | null;
  sha256: string | null;
  learning_excluded: boolean;
  evidence_by_operation_match: boolean;
  operation_report_evidence_pack_summary: Record<string, unknown>;
  ui_urls: string[];
  run: FlightTableRunV1;
};

type EvidenceScenario = {
  evidence_status: FlightTableEvidenceRunResultV1["evidence_status"];
  evidence_complete: boolean;
  trusted: boolean;
  learning_excluded: boolean;
  weather_interference: boolean;
  review_reason: string | null;
};

type DevEvidenceArtifact = {
  artifact_id: string;
  kind: "metric" | "trajectory" | "water_delivery_receipt";
  artifact_ref: string;
  summary: Record<string, unknown>;
};

function nowIso(): string { return new Date().toISOString(); }
function safeText(v: unknown): string { return String(v ?? "").trim(); }
function normalizeId(v: unknown): string | null { const s = safeText(v); return /^[A-Za-z0-9_.:-]{1,240}$/.test(s) ? s : null; }
function runFilePath(run_id: string): string { return path.join(flightTableRunDirV1(run_id), "run.json"); }
function sha256Json(value: unknown): string { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function shortHash(seed: string): string { return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16); }
function uniqueStrings(values: Array<string | null | undefined>): string[] { return Array.from(new Set(values.map((v) => safeText(v)).filter(Boolean))); }

function scenarioForLane(lane: FlightTableEvidenceLaneV1): EvidenceScenario {
  if (lane === "evidence_insufficient") return { evidence_status: "INSUFFICIENT", evidence_complete: false, trusted: false, learning_excluded: false, weather_interference: false, review_reason: "FT-I evidence_insufficient lane: receipt exists but required evidence is missing." };
  if (lane === "weather_interference") return { evidence_status: "WEATHER_EXCLUDED", evidence_complete: true, trusted: true, learning_excluded: true, weather_interference: true, review_reason: null };
  if (lane === "skill_failure") return { evidence_status: "UNTRUSTED", evidence_complete: true, trusted: false, learning_excluded: false, weather_interference: false, review_reason: "FT-I skill_failure lane: evidence is not trusted because the skill chain is blocked." };
  return { evidence_status: "COMPLETE", evidence_complete: true, trusted: true, learning_excluded: false, weather_interference: false, review_reason: null };
}

function updateStep(steps: FlightTableStepV1[], key: string, status: FlightTableStepV1["status"], message: string): FlightTableStepV1[] {
  const ts = nowIso();
  return steps.map((step) => step.step_key === key ? { ...step, status, verify_result: status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status === "SKIPPED" ? "SKIPPED" : "PENDING", message, started_at: step.started_at ?? ts, finished_at: ["PASS", "FAIL", "SKIPPED"].includes(status) ? ts : undefined, updated_at: ts } : step);
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next: FlightTableRunV1 = { ...run, updated_at: nowIso(), manifest: sanitizeFlightTableManifestV1(run.manifest) };
  const withSummary = { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(withSummary, null, 2)}\n`, "utf8");
  return withSummary;
}

async function ensureEvidenceExportRelationTableV1(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS operation_evidence_export_relation_v1 (
    relation_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    field_id TEXT NULL,
    evidence_export_job_id TEXT NOT NULL,
    status TEXT NOT NULL,
    manifest TEXT NULL,
    sha256 TEXT NULL,
    artifact_ref TEXT NULL,
    download_url TEXT NULL,
    failed_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS op_evidence_rel_tenant_operation_idx ON operation_evidence_export_relation_v1(tenant_id, operation_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS op_evidence_rel_tenant_job_idx ON operation_evidence_export_relation_v1(tenant_id, evidence_export_job_id);`);
}

function devArtifactsForScenario(params: { evidence_id: string; run_id: string; operation_id: string; operation_plan_id: string; act_task_id: string; receipt_id: string; field_id: string; lane: FlightTableEvidenceLaneV1; scenario: EvidenceScenario; sha256: string; }): DevEvidenceArtifact[] {
  const { evidence_id, run_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, lane, scenario, sha256 } = params;
  if (!scenario.evidence_complete) return [];
  const base = { run_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, lane, evidence_id, evidence_status: scenario.evidence_status, sha256, source_lane: "SIMULATED_DEV_ONLY", formal_eligible: false, is_simulated: true, evidence_level: "DEBUG" };
  return [
    { artifact_id: `${evidence_id}_metric`, kind: "metric", artifact_ref: `flight-table/${run_id}/${operation_id}/metrics.json`, summary: { ...base, metric_key: "soil_moisture_delta", before: 0.18, after: 0.31, delta: 0.13 } },
    { artifact_id: `${evidence_id}_trajectory`, kind: "trajectory", artifact_ref: `flight-table/${run_id}/${operation_id}/execution_trajectory.json`, summary: { ...base, coverage_percent: 92, as_applied_status: "PARTIAL" } },
    { artifact_id: `${evidence_id}_receipt`, kind: "water_delivery_receipt", artifact_ref: `flight-table/${run_id}/${operation_id}/water_delivery_receipt.json`, summary: { ...base, planned_amount: 25, actual_amount: 25, receipt_status: "SUCCESS_RECEIPT_ONLY_NOT_ACCEPTANCE" } },
  ];
}

function buildFlightTableEvidenceArtifactPayloadV1(params: { run: FlightTableRunV1; artifact: DevEvidenceArtifact; evidence_id: string; operation_id: string; operation_plan_id: string; act_task_id: string; receipt_id: string; field_id: string; sha256: string; }): any {
  const { run, artifact, evidence_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, sha256 } = params;
  const payload = EvidenceArtifactV1PayloadSchema.parse({
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    run_id: run.run_id,
    dev_source: "FLIGHT_TABLE",
    source_lane: "SIMULATED_DEV_ONLY",
    is_simulated: true,
    formal_eligible: false,
    evidence_level: "DEBUG",
    level: "DEBUG",
    evidence_id,
    artifact_id: artifact.artifact_id,
    operation_id,
    operation_plan_id,
    act_task_id,
    receipt_id,
    field_id,
    kind: artifact.kind,
    artifact_ref: artifact.artifact_ref,
    sha256,
    summary: artifact.summary,
    source: "FLIGHT_TABLE_DEV_EVIDENCE",
    created_at: nowIso(),
  });
  assertFlightTableEvidenceArtifactNotFormalV1(payload);
  const classified = classifyEvidenceArtifactV1(payload, { source: payload.source });
  if (classified.formal_eligible || classified.source_lane !== "SIMULATED_DEV_ONLY" || !classified.is_simulated || classified.evidence_level !== "DEBUG") {
    throw new Error("FLIGHT_TABLE_EVIDENCE_CLASSIFICATION_REGRESSION");
  }
  return payload;
}

async function writeEvidenceScenarioFactV1(params: { pool: Pool; run: FlightTableRunV1; lane: FlightTableEvidenceLaneV1; operation_id: string; operation_plan_id: string; act_task_id: string; receipt_id: string; field_id: string; scenario: EvidenceScenario; }): Promise<{ evidence_id: string | null; sha256: string | null; summary: Record<string, unknown> }> {
  const { pool, run, lane, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, scenario } = params;
  const summary = { lane, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, evidence_complete: scenario.evidence_complete, trusted: scenario.trusted, learning_excluded: scenario.learning_excluded, weather_interference: scenario.weather_interference, source_lane: "SIMULATED_DEV_ONLY", formal_eligible: false, is_simulated: true, evidence_level: "DEBUG", generated_at: nowIso() };
  if (!scenario.evidence_complete) return { evidence_id: null, sha256: null, summary };
  const evidence_id = `ft_evidence_${shortHash(`${run.run_id}|${operation_id}|${lane}`)}`;
  const sha256 = sha256Json(summary);
  const record = { type: "flight_table_evidence_scenario_v1", payload: { tenant_id: run.tenant_id, project_id: run.project_id, group_id: run.group_id, run_id: run.run_id, evidence_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, evidence_status: scenario.evidence_status, trusted: scenario.trusted, learning_excluded: scenario.learning_excluded, weather_interference: scenario.weather_interference, source_lane: "SIMULATED_DEV_ONLY", formal_eligible: false, is_simulated: true, evidence_level: "DEBUG", sha256, summary, created_at: nowIso() } };
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING", [evidence_id, "api/v1/dev/flight-table/evidence", record]);
  for (const artifact of devArtifactsForScenario({ evidence_id, run_id: run.run_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, lane, scenario, sha256 })) {
    const artifactRecord = {
      type: "evidence_artifact_v1",
      payload: buildFlightTableEvidenceArtifactPayloadV1({ run, artifact, evidence_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, sha256 }),
    };
    await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO UPDATE SET record_json=EXCLUDED.record_json, occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source", [artifact.artifact_id, "api/v1/dev/flight-table/evidence", artifactRecord]);
  }
  return { evidence_id, sha256, summary };
}

async function completeExportRelationV1(params: { pool: Pool; run: FlightTableRunV1; operation_id: string; field_id: string; job_id: string; sha256: string | null; manifest: Record<string, unknown> }): Promise<void> {
  const { pool, run, operation_id, field_id, job_id, sha256, manifest } = params;
  await ensureEvidenceExportRelationTableV1(pool);
  const relationId = `ft_rel_${shortHash(`${run.run_id}|${operation_id}|${job_id}`)}`;
  await pool.query(
    `INSERT INTO operation_evidence_export_relation_v1
      (relation_id, tenant_id, operation_id, field_id, evidence_export_job_id, status, manifest, sha256, artifact_ref, download_url, failed_reason, created_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,'DONE',$6,$7,$8,NULL,NULL,now(),now())
     ON CONFLICT (relation_id) DO UPDATE SET status='DONE', manifest=EXCLUDED.manifest, sha256=EXCLUDED.sha256, artifact_ref=EXCLUDED.artifact_ref, completed_at=now()`,
    [relationId, run.tenant_id, operation_id, field_id, job_id, JSON.stringify(manifest), sha256, `flight-table/${run.run_id}/${operation_id}/evidence-pack.json`],
  );
}

export async function runFlightTableEvidenceAcceptanceExportV1(args: { pool: Pool; run: FlightTableRunV1; input: FlightTableEvidenceRunInputV1; auth: AoActAuthContextV0; baseUrl: string; bearerToken: string; }): Promise<FlightTableEvidenceRunResultV1> {
  const { pool, run, input, auth } = args;
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  const lane = (input.lane ?? (run.lane === "all" ? "success" : run.lane)) as FlightTableEvidenceLaneV1;
  if (!["success", "evidence_insufficient", "weather_interference", "skill_failure"].includes(lane)) throw new Error("FLIGHT_TABLE_INVALID_EVIDENCE_LANE");
  const scenario = scenarioForLane(lane);
  const operation_id = normalizeId(input.operation_id) ?? normalizeId(input.operation_plan_id) ?? run.manifest.operation_plan_ids.at(-1);
  const operation_plan_id = normalizeId(input.operation_plan_id) ?? operation_id;
  const act_task_id = normalizeId(input.act_task_id) ?? run.manifest.act_task_ids.at(-1);
  const receipt_id = normalizeId(input.receipt_id) ?? run.manifest.receipt_ids.at(-1);
  const field_id = normalizeId(input.field_id) ?? run.manifest.field_id;
  if (!operation_id || !operation_plan_id) throw new Error("FLIGHT_TABLE_OPERATION_ID_MISSING");
  if (!act_task_id) throw new Error("FLIGHT_TABLE_ACT_TASK_ID_MISSING");
  if (!receipt_id) throw new Error("FLIGHT_TABLE_RECEIPT_ID_MISSING");
  if (!field_id) throw new Error("FLIGHT_TABLE_FIELD_NOT_FOUND");

  const evidence = await writeEvidenceScenarioFactV1({ pool, run, lane, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, scenario });
  const evidence_export_job_id = `ft_export_${shortHash(`${run.run_id}|${operation_id}|${lane}`)}`;
  const acceptance_status = scenario.evidence_complete ? "DEV_ONLY_NOT_FORMAL" : "INSUFFICIENT_DEV_ONLY";
  const final_status = "SIMULATED_DEV_ONLY";
  const packSummary = { operation_id, evidence_id: evidence.evidence_id, evidence_status: scenario.evidence_status, trusted: scenario.trusted, learning_excluded: scenario.learning_excluded, weather_interference: scenario.weather_interference, source_lane: "SIMULATED_DEV_ONLY", formal_eligible: false, is_simulated: true, evidence_level: "DEBUG", export_job_id: evidence_export_job_id, sha256: evidence.sha256, raw_status_sequence: ["DONE"] };
  await completeExportRelationV1({ pool, run, operation_id, field_id, job_id: evidence_export_job_id, sha256: evidence.sha256, manifest: packSummary });

  const ui_urls = [`/operator/acceptance?operation_id=${encodeURIComponent(operation_id)}`, `/operator/evidence?operation_id=${encodeURIComponent(operation_id)}`];
  const snapshot = await writeFlightTableApiSnapshotV1({ run_id: run.run_id, method: "POST", path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/evidence/run`, ok: true, status_code: 200, label: "dev-only evidence export flight", request: { lane, operation_id, act_task_id, receipt_id, field_id }, response: { evidence_status: scenario.evidence_status, acceptance_status, final_status, evidence_export_job_id, normalized_export_status: "DONE", sha256: evidence.sha256, source_lane: "SIMULATED_DEV_ONLY", formal_eligible: false, evidence_level: "DEBUG" } });

  const steps = updateStep(run.steps, "G", "PASS", `dev-only evidence=${scenario.evidence_status}; acceptance=${acceptance_status}; final=${final_status}; formal_eligible=false; evidence_level=DEBUG`);
  const nextRun = await writeRun({
    ...run,
    current_step: "G",
    steps,
    manifest: { ...run.manifest, field_id, operation_plan_ids: uniqueStrings([...run.manifest.operation_plan_ids, operation_plan_id]), act_task_ids: uniqueStrings([...run.manifest.act_task_ids, act_task_id]), receipt_ids: uniqueStrings([...run.manifest.receipt_ids, receipt_id]), evidence_ids: uniqueStrings([...run.manifest.evidence_ids, evidence.evidence_id]), evidence_export_job_ids: uniqueStrings([...run.manifest.evidence_export_job_ids, evidence_export_job_id]), api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)], ui_urls: uniqueStrings([...run.manifest.ui_urls, ...ui_urls]) },
  });

  return { ok: true, lane, operation_id, evidence_status: scenario.evidence_status, acceptance_status, final_status, evidence_export_job_id, evidence_export_job_status: "DONE", raw_export_status: "DONE", sha256: evidence.sha256, learning_excluded: scenario.learning_excluded, evidence_by_operation_match: true, operation_report_evidence_pack_summary: packSummary, ui_urls, run: nextRun };
}
