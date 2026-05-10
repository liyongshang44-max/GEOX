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

export type FlightTableOperationRunInputV1 = {
  operation_plan_id?: string;
  prescription_id?: string;
  approval_request_id?: string;
  device_id?: string;
  field_id?: string;
};

export type FlightTableOperationRunResultV1 = {
  ok: true;
  operation_plan_id: string;
  operation_id: string;
  act_task_id: string;
  dispatch_status: string;
  receipt_id: string;
  receipt_status: string;
  as_executed_status: "READY" | "PARTIAL" | "MISSING";
  as_applied_status: "READY" | "PARTIAL" | "MISSING";
  planned_vs_actual_summary: Record<string, unknown>;
  worklist_visible: boolean;
  customer_operation_url: string;
  operator_dispatch_url: string;
  receipt_is_acceptance: false;
  run: FlightTableRunV1;
};

type InternalFetchResult = { ok: boolean; status: number; json: any };

function nowIso(): string { return new Date().toISOString(); }
function nowTs(): number { return Date.now(); }
function runFilePath(run_id: string): string { return path.join(flightTableRunDirV1(run_id), "run.json"); }
function safeText(v: unknown): string { return String(v ?? "").trim(); }
function normalizeId(v: unknown): string | null { const s = safeText(v); return /^[A-Za-z0-9_.:-]{1,200}$/.test(s) ? s : null; }
function shortHash(seed: string): string { return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16); }
function uniqueStrings(values: Array<string | null | undefined>): string[] { return Array.from(new Set(values.map((v) => safeText(v)).filter(Boolean))); }

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

async function latestApprovalStatus(pool: Pool, run: FlightTableRunV1, approvalRequestId: string): Promise<string | null> {
  if (!approvalRequestId) return null;
  const decision = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='approval_decision_v1'
        AND (record_json::jsonb#>>'{payload,request_id}')=$1
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
        AND (record_json::jsonb#>>'{payload,project_id}')=$3
        AND (record_json::jsonb#>>'{payload,group_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [approvalRequestId, run.tenant_id, run.project_id, run.group_id],
  );
  const decisionValue = safeText(decision.rows?.[0]?.record_json?.payload?.decision).toUpperCase();
  if (decisionValue) return decisionValue;
  const request = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='approval_request_v1'
        AND (record_json::jsonb#>>'{payload,request_id}')=$1
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
        AND (record_json::jsonb#>>'{payload,project_id}')=$3
        AND (record_json::jsonb#>>'{payload,group_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [approvalRequestId, run.tenant_id, run.project_id, run.group_id],
  );
  return safeText(request.rows?.[0]?.record_json?.payload?.status).toUpperCase() || null;
}

async function ensureOperationPlanFromPrescriptionV1(params: {
  pool: Pool;
  run: FlightTableRunV1;
  prescription: any;
  operation_plan_id: string;
  approval_request_id: string;
  auth: AoActAuthContextV0;
  approval_status: string | null;
}): Promise<{ operation_plan_id: string; operation_id: string; source: string; created: boolean }> {
  const { pool, run, prescription, operation_plan_id, approval_request_id, auth, approval_status } = params;
  const existing = await pool.query(
    `SELECT fact_id
       FROM facts
      WHERE (record_json::jsonb->>'type')='operation_plan_v1'
        AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$1
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
        AND (record_json::jsonb#>>'{payload,project_id}')=$3
        AND (record_json::jsonb#>>'{payload,group_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [operation_plan_id, run.tenant_id, run.project_id, run.group_id],
  );
  if ((existing.rowCount ?? 0) > 0) return { operation_plan_id, operation_id: operation_plan_id, source: "EXISTING_OPERATION_PLAN_FACT", created: false };

  const ts = nowTs();
  const amount = prescription?.operation_amount ?? {};
  const record = {
    type: "operation_plan_v1",
    payload: {
      tenant_id: run.tenant_id,
      project_id: run.project_id,
      group_id: run.group_id,
      operation_plan_id,
      operation_id: operation_plan_id,
      approval_request_id,
      prescription_id: safeText(prescription?.prescription_id),
      recommendation_id: safeText(prescription?.recommendation_id),
      field_id: safeText(prescription?.field_id ?? run.manifest.field_id),
      season_id: prescription?.season_id ?? run.manifest.season_id ?? null,
      operation_type: safeText(prescription?.operation_type) || "IRRIGATION",
      action_type: "IRRIGATE",
      status: approval_status === "APPROVED" ? "APPROVED_FOR_EXECUTION" : "APPROVAL_UNCONFIRMED",
      operation_amount: amount,
      spatial_scope: prescription?.spatial_scope ?? prescription?.planned_area ?? null,
      planned_area: prescription?.planned_area ?? prescription?.spatial_scope ?? null,
      planned_rate: prescription?.planned_rate ?? amount?.rate ?? null,
      planned_amount: prescription?.planned_amount ?? amount?.amount ?? 25,
      acceptance_conditions: prescription?.acceptance_conditions ?? {},
      device_requirements: prescription?.device_requirements ?? {},
      source: "FLIGHT_TABLE_OPERATION_PLAN_HELPER_FROM_APPROVED_PRESCRIPTION",
      approval_status,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      created_at_ts: ts,
      updated_at_ts: ts,
      meta: {
        run_id: run.run_id,
        helper_source: "FLIGHT_TABLE_OPERATION_PLAN_HELPER",
        receipt_success_is_not_acceptance_pass: true,
      },
    },
  };
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [`ft_op_${shortHash(operation_plan_id)}`, "api/v1/dev/flight-table/operation", record],
  );
  return { operation_plan_id, operation_id: operation_plan_id, source: "FLIGHT_TABLE_OPERATION_PLAN_HELPER", created: true };
}

async function writeAsExecutedAndAppliedV1(params: {
  pool: Pool;
  run: FlightTableRunV1;
  operation_plan_id: string;
  act_task_id: string;
  receipt_id: string;
  field_id: string;
  device_id: string;
  actual_params: Record<string, unknown>;
}): Promise<{ as_executed_id: string; as_applied_id: string; as_executed_status: "READY"; as_applied_status: "PARTIAL"; planned_vs_actual_summary: Record<string, unknown> }> {
  const { pool, run, operation_plan_id, act_task_id, receipt_id, field_id, device_id, actual_params } = params;
  const started = nowTs() - 20 * 60 * 1000;
  const finished = nowTs() - 2 * 60 * 1000;
  const trajectory = [
    { lat: 31.234567, lng: 121.567890, ts_ms: started },
    { lat: 31.235067, lng: 121.568390, ts_ms: started + 7 * 60 * 1000 },
    { lat: 31.234867, lng: 121.568990, ts_ms: finished },
  ];
  const coverage_geojson = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { source: "flight_table_as_applied_partial", coverage_percent: 92 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [121.567890, 31.234567],
          [121.568990, 31.234567],
          [121.568990, 31.235067],
          [121.567890, 31.235067],
          [121.567890, 31.234567],
        ]],
      },
    }],
  };
  const planned_vs_actual_summary = {
    planned_amount: 25,
    actual_amount: actual_params.amount ?? 25,
    planned_duration_min: 20,
    actual_duration_min: actual_params.duration_min ?? 20,
    coverage_percent: actual_params.coverage_percent ?? 92,
    amount_delta: Number(actual_params.amount ?? 25) - 25,
    as_applied_status: "PARTIAL",
  };
  const as_executed_id = `as_exec_${act_task_id}`;
  const as_applied_id = `as_applied_${act_task_id}`;
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING",
    [`ft_asexec_${shortHash(as_executed_id)}`, "api/v1/dev/flight-table/operation", {
      type: "as_executed_v1",
      payload: {
        tenant_id: run.tenant_id,
        project_id: run.project_id,
        group_id: run.group_id,
        as_executed_id,
        operation_plan_id,
        operation_id: operation_plan_id,
        act_task_id,
        receipt_id,
        field_id,
        device_id,
        execution_started_at: new Date(started).toISOString(),
        execution_finished_at: new Date(finished).toISOString(),
        actual_params,
        trajectory,
        status: "READY",
      },
    }],
  );
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING",
    [`ft_asapplied_${shortHash(as_applied_id)}`, "api/v1/dev/flight-table/operation", {
      type: "as_applied_v1",
      payload: {
        tenant_id: run.tenant_id,
        project_id: run.project_id,
        group_id: run.group_id,
        as_applied_id,
        operation_plan_id,
        operation_id: operation_plan_id,
        act_task_id,
        receipt_id,
        field_id,
        device_id,
        coverage_geojson,
        planned_vs_actual_summary,
        status: "PARTIAL",
        reason: "V1 flight table has coverage_geojson and summary but no full commercial as-applied projection yet.",
      },
    }],
  );
  return { as_executed_id, as_applied_id, as_executed_status: "READY", as_applied_status: "PARTIAL", planned_vs_actual_summary };
}

function extractWorklistItem(worklist: any, actTaskId: string): any | null {
  const items = Array.isArray(worklist?.items) ? worklist.items : Array.isArray(worklist?.data?.items) ? worklist.data.items : [];
  return items.find((item: any) => safeText(item?.act_task_id ?? item?.task_id) === actTaskId) ?? null;
}

export async function runFlightTableOperationAoActReceiptV1(args: {
  pool: Pool;
  run: FlightTableRunV1;
  input: FlightTableOperationRunInputV1;
  auth: AoActAuthContextV0;
  baseUrl: string;
  bearerToken: string;
}): Promise<FlightTableOperationRunResultV1> {
  const { pool, run, input, auth, baseUrl, bearerToken } = args;
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  const prescription_id = normalizeId(input.prescription_id) ?? run.manifest.prescription_ids.at(-1);
  const approval_request_id = normalizeId(input.approval_request_id) ?? run.manifest.approval_request_ids.at(-1);
  if (!prescription_id) throw new Error("FLIGHT_TABLE_PRESCRIPTION_ID_MISSING");
  if (!approval_request_id) throw new Error("FLIGHT_TABLE_APPROVAL_REQUEST_ID_MISSING");

  const prescriptionRead = await callJson(`${baseUrl}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(run.tenant_id)}&project_id=${encodeURIComponent(run.project_id)}&group_id=${encodeURIComponent(run.group_id)}`, "GET", bearerToken);
  if (!prescriptionRead.ok) throw new Error(`FLIGHT_TABLE_PRESCRIPTION_READ_FAILED:${prescriptionRead.status}:${safeText(prescriptionRead.json?.error)}`);
  const prescription = prescriptionRead.json?.prescription ?? {};
  const field_id = normalizeId(input.field_id) ?? safeText(prescription.field_id) ?? run.manifest.field_id;
  const device_id = normalizeId(input.device_id) ?? run.manifest.device_ids[0] ?? `ft_irrigation_controller_${run.run_id}`;
  if (!field_id) throw new Error("FLIGHT_TABLE_FIELD_NOT_FOUND");
  const approval_status = await latestApprovalStatus(pool, run, approval_request_id);
  const operation_plan_id = normalizeId(input.operation_plan_id)
    ?? run.manifest.operation_plan_ids.at(-1)
    ?? `op_${shortHash(`${run.run_id}|${prescription_id}|${approval_request_id}`)}`;
  const operation = await ensureOperationPlanFromPrescriptionV1({ pool, run, prescription, operation_plan_id, approval_request_id, auth, approval_status });

  const taskBody = {
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    operation_plan_id: operation.operation_plan_id,
    approval_request_id,
    field_id,
    season_id: prescription.season_id ?? run.manifest.season_id ?? null,
    device_id,
    issuer: { kind: "flight_table", id: auth.actor_id, namespace: "dev" },
    action_type: "IRRIGATE",
    target: { kind: "field", ref: field_id },
    time_window: { start_ts: nowTs() - 60_000, end_ts: nowTs() + 30 * 60_000 },
    parameter_schema: {
      keys: [
        { name: "duration_sec", type: "number", min: 1, max: 7200 },
        { name: "duration_min", type: "number", min: 1, max: 720 },
        { name: "amount", type: "number", min: 1, max: 1000 },
        { name: "coverage_percent", type: "number", min: 0, max: 100 },
      ],
    },
    parameters: { duration_sec: 1200, duration_min: 20, amount: 25, coverage_percent: 92 },
    constraints: {},
    meta: {
      run_id: run.run_id,
      recommendation_id: prescription.recommendation_id ?? run.manifest.recommendation_ids.at(-1) ?? null,
      prescription_id,
      approval_request_id,
      task_type: "IRRIGATION",
      device_id,
      adapter_type: "irrigation_simulator",
      device_type: "IRRIGATION_CONTROLLER",
      required_capabilities: ["device.irrigation.valve.open"],
      receipt_success_is_not_acceptance_pass: true,
    },
  };
  const taskResp = await callJson(`${baseUrl}/api/v1/actions/task`, "POST", bearerToken, taskBody);
  if (!taskResp.ok) throw new Error(`FLIGHT_TABLE_ACTION_TASK_FAILED:${taskResp.status}:${safeText(taskResp.json?.error)}`);
  const act_task_id = safeText(taskResp.json?.act_task_id ?? taskResp.json?.task_id);
  if (!act_task_id) throw new Error("FLIGHT_TABLE_ACT_TASK_ID_MISSING");

  const dispatchResp = await callJson(`${baseUrl}/api/v1/operator/dispatch/${encodeURIComponent(act_task_id)}/dispatch`, "POST", bearerToken, { note: "flight-table FT-H dispatch" });
  const dispatch_status = dispatchResp.ok ? safeText(dispatchResp.json?.status_after) || "DISPATCHED" : `DISPATCH_FAILED:${safeText(dispatchResp.json?.error_code ?? dispatchResp.json?.error ?? dispatchResp.status)}`;
  const worklist = await callJson(`${baseUrl}/api/v1/operator/dispatch/worklist?limit=300`, "GET", bearerToken);
  const worklistItem = extractWorklistItem(worklist.json, act_task_id);

  const receiptBody = {
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    operation_plan_id: operation.operation_plan_id,
    act_task_id,
    executor_id: { kind: "flight_table", id: "ft_executor", namespace: "dev" },
    execution_time: { start_ts: nowTs() - 20 * 60_000, end_ts: nowTs() - 2 * 60_000 },
    execution_coverage: { kind: "field", ref: field_id },
    resource_usage: { fuel_l: 0, electric_kwh: 0.8, water_l: 25000, chemical_ml: 0 },
    observed_parameters: { duration_sec: 1200, duration_min: 20, amount: 25, coverage_percent: 92 },
    evidence_refs: [{ kind: "sensor", ref: `ft_sensor_${act_task_id}` }],
    logs_refs: [
      { kind: "dispatch_ack", ref: `ack_${act_task_id}` },
      { kind: "valve_open_confirmation", ref: `valve_${act_task_id}` },
      { kind: "water_delivery_receipt", ref: `water_${act_task_id}` },
    ],
    status: "executed",
    constraint_check: { violated: false, violations: [] },
    meta: {
      run_id: run.run_id,
      command_id: act_task_id,
      idempotency_key: `ft_receipt_${act_task_id}`,
      recommendation_id: prescription.recommendation_id ?? run.manifest.recommendation_ids.at(-1) ?? null,
      prescription_id,
      approval_request_id,
      operation_plan_id: operation.operation_plan_id,
      receipt_success_is_not_acceptance_pass: true,
    },
  };
  const receiptResp = await callJson(`${baseUrl}/api/v1/actions/receipt`, "POST", bearerToken, receiptBody);
  if (!receiptResp.ok) throw new Error(`FLIGHT_TABLE_ACTION_RECEIPT_FAILED:${receiptResp.status}:${safeText(receiptResp.json?.error)}`);
  const receipt_id = safeText(receiptResp.json?.receipt_id ?? receiptResp.json?.fact_id);
  if (!receipt_id) throw new Error("FLIGHT_TABLE_RECEIPT_ID_MISSING");

  const actionIndex = await callJson(`${baseUrl}/api/v1/actions/index?tenant_id=${encodeURIComponent(run.tenant_id)}&project_id=${encodeURIComponent(run.project_id)}&group_id=${encodeURIComponent(run.group_id)}`, "GET", bearerToken);
  const asExec = await writeAsExecutedAndAppliedV1({
    pool,
    run,
    operation_plan_id: operation.operation_plan_id,
    act_task_id,
    receipt_id,
    field_id,
    device_id,
    actual_params: receiptBody.observed_parameters,
  });

  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/operation/run`,
    ok: Boolean(operation.operation_plan_id && act_task_id && receipt_id),
    status_code: 200,
    label: "operation ao-act dispatch receipt flight",
    request: { prescription_id, approval_request_id, operation_plan_id: operation.operation_plan_id, device_id, field_id },
    response: {
      operation_plan_id: operation.operation_plan_id,
      operation_plan_source: operation.source,
      approval_status,
      act_task_id,
      dispatch_status,
      worklist_visible: Boolean(worklistItem),
      receipt_id,
      receipt_status: "SUCCESS_RECEIPT_ONLY_NOT_ACCEPTANCE",
      action_index_visible: actionIndex.ok,
      as_executed_status: asExec.as_executed_status,
      as_applied_status: asExec.as_applied_status,
      planned_vs_actual_summary: asExec.planned_vs_actual_summary,
    },
  });

  const stepPass = Boolean(operation.operation_plan_id && act_task_id && receipt_id && worklistItem);
  const steps = updateStep(run.steps, "F", stepPass ? "PASS" : "FAIL", `operation=${operation.operation_plan_id}; task=${act_task_id}; dispatch=${dispatch_status}; receipt=${receipt_id}; as_applied=${asExec.as_applied_status}; receipt_is_acceptance=false`);
  const customerUrl = `/customer/operations/${encodeURIComponent(operation.operation_plan_id)}`;
  const dispatchUrl = `/operator/dispatch?operation_id=${encodeURIComponent(operation.operation_plan_id)}`;
  const nextRun = await writeRun({
    ...run,
    current_step: "F",
    status: stepPass ? run.status : "FAIL",
    steps,
    manifest: {
      ...run.manifest,
      field_id,
      device_ids: uniqueStrings([...run.manifest.device_ids, device_id]),
      operation_plan_ids: uniqueStrings([...run.manifest.operation_plan_ids, operation.operation_plan_id]),
      act_task_ids: uniqueStrings([...run.manifest.act_task_ids, act_task_id]),
      receipt_ids: uniqueStrings([...run.manifest.receipt_ids, receipt_id]),
      evidence_ids: uniqueStrings([...run.manifest.evidence_ids, asExec.as_executed_id, asExec.as_applied_id]),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      ui_urls: uniqueStrings([...run.manifest.ui_urls, customerUrl, dispatchUrl]),
    },
  });

  return {
    ok: true,
    operation_plan_id: operation.operation_plan_id,
    operation_id: operation.operation_id,
    act_task_id,
    dispatch_status,
    receipt_id,
    receipt_status: "SUCCESS_RECEIPT_ONLY_NOT_ACCEPTANCE",
    as_executed_status: asExec.as_executed_status,
    as_applied_status: asExec.as_applied_status,
    planned_vs_actual_summary: asExec.planned_vs_actual_summary,
    worklist_visible: Boolean(worklistItem),
    customer_operation_url: customerUrl,
    operator_dispatch_url: dispatchUrl,
    receipt_is_acceptance: false,
    run: nextRun,
  };
}
