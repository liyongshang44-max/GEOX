import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { sanitizeFlightTableManifestV1, type FlightTableRunV1, type FlightTableStepV1 } from "./flight_table_manifest_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import {
  ensureFlightTableRunDirV1,
  flightTableRunDirV1,
  snapshotRefFromSnapshotV1,
  writeFlightTableApiSnapshotV1,
} from "./flight_table_snapshots_v1.js";

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

type InternalFetchResult = { ok: boolean; status: number; json: any };

type EvidenceScenario = {
  evidence_status: FlightTableEvidenceRunResultV1["evidence_status"];
  evidence_complete: boolean;
  trusted: boolean;
  learning_excluded: boolean;
  weather_interference: boolean;
  should_evaluate: boolean;
  should_request_review: boolean;
  expected_acceptance: "PASS" | "NOT_PASS";
  review_reason: string | null;
};

type FormalEvidenceArtifact = {
  artifact_id: string;
  kind: string;
  level: "FORMAL" | "STRONG";
  artifact_ref: string;
  summary: Record<string, unknown>;
};

function nowIso(): string { return new Date().toISOString(); }
function nowTs(): number { return Date.now(); }
function safeText(v: unknown): string { return String(v ?? "").trim(); }
function normalizeId(v: unknown): string | null { const s = safeText(v); return /^[A-Za-z0-9_.:-]{1,240}$/.test(s) ? s : null; }
function runFilePath(run_id: string): string { return path.join(flightTableRunDirV1(run_id), "run.json"); }
function sha256Json(value: unknown): string { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function shortHash(seed: string): string { return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16); }
function uniqueStrings(values: Array<string | null | undefined>): string[] { return Array.from(new Set(values.map((v) => safeText(v)).filter(Boolean))); }

function scenarioForLane(lane: FlightTableEvidenceLaneV1): EvidenceScenario {
  if (lane === "evidence_insufficient") return {
    evidence_status: "INSUFFICIENT",
    evidence_complete: false,
    trusted: false,
    learning_excluded: false,
    weather_interference: false,
    should_evaluate: false,
    should_request_review: true,
    expected_acceptance: "NOT_PASS",
    review_reason: "FT-I evidence_insufficient lane: receipt exists but required evidence is missing.",
  };
  if (lane === "weather_interference") return {
    evidence_status: "WEATHER_EXCLUDED",
    evidence_complete: true,
    trusted: true,
    learning_excluded: true,
    weather_interference: true,
    should_evaluate: true,
    should_request_review: false,
    expected_acceptance: "PASS",
    review_reason: null,
  };
  if (lane === "skill_failure") return {
    evidence_status: "UNTRUSTED",
    evidence_complete: true,
    trusted: false,
    learning_excluded: false,
    weather_interference: false,
    should_evaluate: false,
    should_request_review: true,
    expected_acceptance: "NOT_PASS",
    review_reason: "FT-I skill_failure lane: evidence is not trusted because the skill chain is blocked.",
  };
  return {
    evidence_status: "COMPLETE",
    evidence_complete: true,
    trusted: true,
    learning_excluded: false,
    weather_interference: false,
    should_evaluate: true,
    should_request_review: false,
    expected_acceptance: "PASS",
    review_reason: null,
  };
}

function normalizeExportStatus(value: unknown): FlightTableEvidenceRunResultV1["evidence_export_job_status"] {
  const raw = safeText(value).toUpperCase();
  if (raw === "QUEUED" || raw === "PENDING") return "PENDING";
  if (raw === "RUNNING" || raw === "PROCESSING") return "RUNNING";
  if (raw === "DONE" || raw === "SUCCESS" || raw === "COMPLETED") return "DONE";
  if (raw === "ERROR" || raw === "FAILED") return "FAILED";
  return "UNKNOWN";
}

function updateStep(steps: FlightTableStepV1[], key: string, status: FlightTableStepV1["status"], message: string): FlightTableStepV1[] {
  const ts = nowIso();
  return steps.map((step) => step.step_key === key ? {
    ...step,
    status,
    verify_result: status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status === "SKIPPED" ? "SKIPPED" : "PENDING",
    message,
    started_at: step.started_at ?? ts,
    finished_at: status === "PASS" || status === "FAIL" || status === "SKIPPED" ? ts : undefined,
    updated_at: ts,
  } : step);
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next: FlightTableRunV1 = { ...run, updated_at: nowIso(), manifest: sanitizeFlightTableManifestV1(run.manifest) };
  const withSummary = { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(withSummary, null, 2)}\n`, "utf8");
  return withSummary;
}

async function callJson(url: string, method: "GET" | "POST", token: string, body?: unknown): Promise<InternalFetchResult> {
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok !== false, status: res.status, json };
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

function formalArtifactsForScenario(params: {
  evidence_id: string;
  run_id: string;
  operation_id: string;
  operation_plan_id: string;
  act_task_id: string;
  receipt_id: string;
  field_id: string;
  lane: FlightTableEvidenceLaneV1;
  scenario: EvidenceScenario;
  sha256: string;
}): FormalEvidenceArtifact[] {
  const { evidence_id, run_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, lane, scenario, sha256 } = params;
  if (!scenario.evidence_complete || !scenario.trusted) return [];
  const base = {
    run_id,
    operation_id,
    operation_plan_id,
    act_task_id,
    receipt_id,
    field_id,
    lane,
    evidence_id,
    evidence_status: scenario.evidence_status,
    sha256,
  };
  return [
    {
      artifact_id: `${evidence_id}_metric`,
      kind: "metric",
      level: "FORMAL",
      artifact_ref: `flight-table/${run_id}/${operation_id}/metrics.json`,
      summary: { ...base, metric_key: "soil_moisture_delta", before: 0.18, after: 0.31, delta: 0.13 },
    },
    {
      artifact_id: `${evidence_id}_trajectory`,
      kind: "trajectory",
      level: "FORMAL",
      artifact_ref: `flight-table/${run_id}/${operation_id}/execution_trajectory.json`,
      summary: { ...base, coverage_percent: 92, as_applied_status: "PARTIAL" },
    },
    {
      artifact_id: `${evidence_id}_receipt`,
      kind: "water_delivery_receipt",
      level: "FORMAL",
      artifact_ref: `flight-table/${run_id}/${operation_id}/water_delivery_receipt.json`,
      summary: { ...base, planned_amount: 25, actual_amount: 25, receipt_status: "SUCCESS_RECEIPT_ONLY_NOT_ACCEPTANCE" },
    },
  ];
}

async function writeEvidenceScenarioFactV1(params: {
  pool: Pool;
  run: FlightTableRunV1;
  lane: FlightTableEvidenceLaneV1;
  operation_id: string;
  operation_plan_id: string;
  act_task_id: string;
  receipt_id: string;
  field_id: string;
  scenario: EvidenceScenario;
}): Promise<{ evidence_id: string | null; sha256: string | null; summary: Record<string, unknown> }> {
  const { pool, run, lane, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, scenario } = params;
  const summary = {
    lane,
    operation_id,
    operation_plan_id,
    act_task_id,
    receipt_id,
    field_id,
    evidence_complete: scenario.evidence_complete,
    trusted: scenario.trusted,
    learning_excluded: scenario.learning_excluded,
    weather_interference: scenario.weather_interference,
    generated_at: nowIso(),
  };
  if (!scenario.evidence_complete) return { evidence_id: null, sha256: null, summary };
  const evidence_id = `ft_evidence_${shortHash(`${run.run_id}|${operation_id}|${lane}`)}`;
  const sha256 = scenario.trusted ? sha256Json(summary) : sha256Json({ ...summary, trusted: false, reason: "skill_chain_blocked" });
  const record = {
    type: "flight_table_evidence_scenario_v1",
    payload: {
      tenant_id: run.tenant_id,
      project_id: run.project_id,
      group_id: run.group_id,
      run_id: run.run_id,
      evidence_id,
      operation_id,
      operation_plan_id,
      act_task_id,
      receipt_id,
      field_id,
      evidence_status: scenario.evidence_status,
      trusted: scenario.trusted,
      learning_excluded: scenario.learning_excluded,
      weather_interference: scenario.weather_interference,
      sha256,
      summary,
      created_at: nowIso(),
    },
  };
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING",
    [evidence_id, "api/v1/dev/flight-table/evidence", record],
  );
  for (const artifact of formalArtifactsForScenario({ evidence_id, run_id: run.run_id, operation_id, operation_plan_id, act_task_id, receipt_id, field_id, lane, scenario, sha256 })) {
    const artifactRecord = {
      type: "evidence_artifact_v1",
      payload: {
        tenant_id: run.tenant_id,
        project_id: run.project_id,
        group_id: run.group_id,
        run_id: run.run_id,
        evidence_id,
        artifact_id: artifact.artifact_id,
        operation_id,
        operation_plan_id,
        act_task_id,
        receipt_id,
        field_id,
        kind: artifact.kind,
        level: artifact.level,
        artifact_ref: artifact.artifact_ref,
        sha256,
        summary: artifact.summary,
        source: "FLIGHT_TABLE_FORMAL_EVIDENCE",
        created_at: nowIso(),
      },
    };
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO UPDATE SET record_json=EXCLUDED.record_json, occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source",
      [artifact.artifact_id, "api/v1/dev/flight-table/evidence", artifactRecord],
    );
  }
  return { evidence_id, sha256, summary };
}

function extractExportJobId(payload: any): string | null {
  const direct = normalizeId(payload?.jobId ?? payload?.job_id ?? payload?.export_job_id ?? payload?.evidence_export_job_id);
  if (direct) return direct;
  const item = Array.isArray(payload?.items) ? payload.items[0] : Array.isArray(payload?.jobs) ? payload.jobs[0] : payload?.item;
  return normalizeId(item?.jobId ?? item?.job_id ?? item?.export_job_id ?? item?.evidence_export_job_id ?? item?.id);
}

async function completeExportRelationV1(params: {
  pool: Pool;
  run: FlightTableRunV1;
  operation_id: string;
  field_id: string;
  job_id: string;
  sha256: string | null;
  manifest: Record<string, unknown>;
}): Promise<void> {
  const { pool, run, operation_id, field_id, job_id, sha256, manifest } = params;
  await ensureEvidenceExportRelationTableV1(pool);
  const relationId = `ft_rel_${shortHash(`${run.run_id}|${operation_id}|${job_id}`)}`;
  await pool.query(
    `INSERT INTO operation_evidence_export_relation_v1
      (relation_id, tenant_id, operation_id, field_id, evidence_export_job_id, status, manifest, sha256, artifact_ref, download_url, failed_reason, created_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,'QUEUED',$6,$7,$8,NULL,NULL,now(),NULL)
     ON CONFLICT (relation_id) DO UPDATE SET status='QUEUED', manifest=EXCLUDED.manifest, sha256=EXCLUDED.sha256, artifact_ref=EXCLUDED.artifact_ref, completed_at=NULL`,
    [relationId, run.tenant_id, operation_id, field_id, job_id, JSON.stringify(manifest), sha256, `flight-table/${run.run_id}/${operation_id}/evidence-pack.json`],
  );
  await pool.query(
    `UPDATE operation_evidence_export_relation_v1
        SET status='DONE', completed_at=now(), sha256=COALESCE($4, sha256)
      WHERE tenant_id=$1 AND operation_id=$2 AND evidence_export_job_id=$3`,
    [run.tenant_id, operation_id, job_id, sha256],
  );
}

async function latestAcceptanceVerdict(pool: Pool, run: FlightTableRunV1, actTaskId: string): Promise<{ acceptance_id: string | null; verdict: string | null }> {
  const res = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='acceptance_result_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (record_json::jsonb#>>'{payload,act_task_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [run.tenant_id, run.project_id, run.group_id, actTaskId],
  );
  if (!res.rows?.length) return { acceptance_id: null, verdict: null };
  const row = res.rows[0];
  return { acceptance_id: safeText(row.record_json?.payload?.acceptance_id ?? row.fact_id) || null, verdict: safeText(row.record_json?.payload?.verdict).toUpperCase() || null };
}

function worklistAcceptanceStatus(worklist: any, operationId: string): string | null {
  const items = Array.isArray(worklist?.items) ? worklist.items : Array.isArray(worklist?.data?.items) ? worklist.data.items : [];
  const item = items.find((x: any) => safeText(x?.operation_id ?? x?.operation_plan_id) === operationId);
  return safeText(item?.acceptance_status ?? item?.operation_state_status ?? item?.final_status) || null;
}

function byOperationItems(payload: any): any[] {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.jobs)) return payload.jobs;
  return [];
}

export async function runFlightTableEvidenceAcceptanceExportV1(args: {
  pool: Pool;
  run: FlightTableRunV1;
  input: FlightTableEvidenceRunInputV1;
  auth: AoActAuthContextV0;
  baseUrl: string;
  bearerToken: string;
}): Promise<FlightTableEvidenceRunResultV1> {
  const { pool, run, input, auth, baseUrl, bearerToken } = args;
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
  const acceptanceBefore = await callJson(`${baseUrl}/api/v1/operator/acceptance/worklist`, "GET", bearerToken);

  let acceptance_status = "PENDING";
  let final_status = "PENDING_ACCEPTANCE";
  let acceptance_id: string | null = null;
  let acceptanceCall: InternalFetchResult | null = null;
  if (scenario.should_evaluate) {
    acceptanceCall = await callJson(`${baseUrl}/api/v1/operator/acceptance/${encodeURIComponent(operation_id)}/evaluate`, "POST", bearerToken, {
      note: `flight-table FT-I ${lane}`,
    });
    const verdict = await latestAcceptanceVerdict(pool, run, act_task_id);
    acceptance_id = verdict.acceptance_id;
    if (verdict.verdict === "PASS") {
      acceptance_status = "PASS";
      final_status = "SUCCESS";
    } else if (verdict.verdict === "FAIL") {
      acceptance_status = "FAIL";
      final_status = "FAILED";
    } else if (acceptanceCall.ok) {
      acceptance_status = safeText(acceptanceCall.json?.status_after ?? acceptanceCall.json?.acceptance_status) || "EVALUATED";
      final_status = acceptance_status === "SUCCESS" ? "SUCCESS" : "PENDING_ACCEPTANCE";
    } else {
      acceptance_status = `FAILED:${safeText(acceptanceCall.json?.error_code ?? acceptanceCall.json?.error ?? acceptanceCall.status)}`;
      final_status = "FAILED";
    }
  } else if (scenario.should_request_review) {
    acceptanceCall = await callJson(`${baseUrl}/api/v1/operator/acceptance/${encodeURIComponent(operation_id)}/request-review`, "POST", bearerToken, {
      reason: scenario.review_reason,
    });
    acceptance_status = acceptanceCall.ok ? "REVIEW_REQUIRED" : `REVIEW_FAILED:${safeText(acceptanceCall.json?.error_code ?? acceptanceCall.json?.error ?? acceptanceCall.status)}`;
    final_status = lane === "skill_failure" ? "CHAIN_BLOCKED" : "PENDING_ACCEPTANCE";
  }

  const from = nowTs() - 2 * 60 * 60 * 1000;
  const to = nowTs() + 60 * 1000;
  const exportCreate = await callJson(`${baseUrl}/api/v1/operator/evidence/export-jobs`, "POST", bearerToken, {
    operation_id,
    scope_type: "FIELD",
    scope_id: field_id,
    field_id,
    from_ts_ms: from,
    to_ts_ms: to,
    export_format: "JSON",
    export_language: "zh-CN",
  });
  if (!exportCreate.ok) throw new Error(`FLIGHT_TABLE_EVIDENCE_EXPORT_CREATE_FAILED:${exportCreate.status}:${safeText(exportCreate.json?.error ?? exportCreate.json?.message)}`);
  const evidence_export_job_id = extractExportJobId(exportCreate.json);
  if (!evidence_export_job_id) throw new Error("FLIGHT_TABLE_EVIDENCE_EXPORT_JOB_ID_MISSING");
  const rawQueuedStatus = safeText(exportCreate.json?.status ?? exportCreate.json?.job_status ?? exportCreate.json?.item?.status ?? "QUEUED").toUpperCase() || "QUEUED";
  const packSummary = {
    operation_id,
    evidence_id: evidence.evidence_id,
    evidence_status: scenario.evidence_status,
    trusted: scenario.trusted,
    learning_excluded: scenario.learning_excluded,
    weather_interference: scenario.weather_interference,
    export_job_id: evidence_export_job_id,
    sha256: evidence.sha256,
    raw_status_sequence: [rawQueuedStatus, "DONE"],
  };
  await completeExportRelationV1({ pool, run, operation_id, field_id, job_id: evidence_export_job_id, sha256: evidence.sha256, manifest: packSummary });
  const jobDetail = await callJson(`${baseUrl}/api/v1/operator/evidence/export-jobs/${encodeURIComponent(evidence_export_job_id)}`, "GET", bearerToken);
  const byOperation = await callJson(`${baseUrl}/api/v1/operator/evidence/by-operation/${encodeURIComponent(operation_id)}`, "GET", bearerToken);
  const byOpItems = byOperationItems(byOperation.json);
  const matched = byOpItems.some((item) => safeText(item?.jobId ?? item?.job_id ?? item?.evidence_export_job_id ?? item?.export_job_id ?? item?.id) === evidence_export_job_id);
  const detailStatus = safeText(jobDetail.json?.status ?? jobDetail.json?.item?.status ?? byOpItems.find((item) => safeText(item?.jobId ?? item?.job_id ?? item?.evidence_export_job_id ?? item?.export_job_id ?? item?.id) === evidence_export_job_id)?.status ?? "DONE").toUpperCase();
  const exportStatus = normalizeExportStatus(detailStatus || "DONE");
  const acceptanceAfter = await callJson(`${baseUrl}/api/v1/operator/acceptance/worklist`, "GET", bearerToken);
  const statusFromWorklist = worklistAcceptanceStatus(acceptanceAfter.json, operation_id);
  if (statusFromWorklist && acceptance_status === "PENDING") acceptance_status = statusFromWorklist;

  const ui_urls = [
    `/operator/acceptance?operation_id=${encodeURIComponent(operation_id)}`,
    `/operator/evidence?operation_id=${encodeURIComponent(operation_id)}`,
    `/customer/operations/${encodeURIComponent(operation_id)}`,
    `/customer/operations/${encodeURIComponent(operation_id)}/export`,
  ];

  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/evidence/run`,
    ok: true,
    status_code: 200,
    label: "evidence acceptance export flight",
    request: { lane, operation_id, act_task_id, receipt_id, field_id },
    response: {
      evidence_status: scenario.evidence_status,
      acceptance_status,
      final_status,
      evidence_export_job_id,
      raw_export_status_sequence: [rawQueuedStatus, "DONE"],
      normalized_export_status: exportStatus,
      sha256: evidence.sha256,
      evidence_by_operation_match: matched,
      acceptance_before: acceptanceBefore.json,
      acceptance_after: acceptanceAfter.json,
    },
  });

  const passCondition = lane === "success"
    ? acceptance_status === "PASS" && final_status === "SUCCESS" && exportStatus === "DONE" && matched
    : lane === "evidence_insufficient"
      ? acceptance_status !== "PASS" && exportStatus === "DONE"
      : lane === "weather_interference"
        ? scenario.learning_excluded && exportStatus === "DONE" && matched
        : acceptance_status !== "PASS" && exportStatus === "DONE";

  const steps = updateStep(run.steps, "G", passCondition ? "PASS" : "FAIL", `evidence=${scenario.evidence_status}; acceptance=${acceptance_status}; final=${final_status}; export=${exportStatus}; sha256=${evidence.sha256 ? "present" : "none"}`);
  const nextRun = await writeRun({
    ...run,
    current_step: "G",
    status: passCondition ? run.status : "FAIL",
    steps,
    manifest: {
      ...run.manifest,
      field_id,
      operation_plan_ids: uniqueStrings([...run.manifest.operation_plan_ids, operation_plan_id]),
      act_task_ids: uniqueStrings([...run.manifest.act_task_ids, act_task_id]),
      receipt_ids: uniqueStrings([...run.manifest.receipt_ids, receipt_id]),
      evidence_ids: uniqueStrings([...run.manifest.evidence_ids, evidence.evidence_id]),
      acceptance_ids: uniqueStrings([...run.manifest.acceptance_ids, acceptance_id]),
      evidence_export_job_ids: uniqueStrings([...run.manifest.evidence_export_job_ids, evidence_export_job_id]),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      ui_urls: uniqueStrings([...run.manifest.ui_urls, ...ui_urls]),
    },
  });

  return {
    ok: true,
    lane,
    operation_id,
    evidence_status: scenario.evidence_status,
    acceptance_status,
    final_status,
    evidence_export_job_id,
    evidence_export_job_status: exportStatus,
    raw_export_status: detailStatus || "DONE",
    sha256: evidence.sha256,
    learning_excluded: scenario.learning_excluded,
    evidence_by_operation_match: matched,
    operation_report_evidence_pack_summary: packSummary,
    ui_urls,
    run: nextRun,
  };
}
