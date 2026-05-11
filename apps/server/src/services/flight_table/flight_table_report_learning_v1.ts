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

export type FlightTableReportLearningRunInputV1 = {
  operation_id?: string;
  field_id?: string;
  acceptance_id?: string;
  evidence_id?: string;
};

export type FlightTableReportLearningRunResultV1 = {
  ok: true;
  operation_id: string;
  field_id: string;
  operation_report_ready: boolean;
  field_report_ready: boolean;
  customer_reports_ready: boolean;
  weather_status: "ok" | "unavailable" | "stub" | "error" | "unknown";
  weather_source: string | null;
  weather_learning_excluded_reason: string | null;
  roi_status: "READY" | "ESTIMATED" | "EMPTY" | "ERROR";
  roi_ids: string[];
  roi_reason: string | null;
  field_memory_status: "READY" | "EMPTY" | "ERROR";
  field_memory_ids: string[];
  field_memory_reason: string | null;
  skill_trace_status: "READY" | "EMPTY" | "ERROR";
  skill_performance_status: "READY" | "EMPTY" | "ERROR";
  learning_closure: "CLOSED" | "EXCLUDED_WEATHER" | "BLOCKED_SKILL_FAILURE" | "PARTIAL" | "OPEN";
  learning_excluded_reason: string | null;
  diagnostic_suggestions: string[];
  ui_urls: string[];
  run: FlightTableRunV1;
};

type InternalFetchResult = { ok: boolean; status: number; json: any; error?: string };

type StatusResult = { ok: boolean; status: number; json: any; source: string };

function nowIso(): string { return new Date().toISOString(); }
function nowTs(): number { return Date.now(); }
function safeText(v: unknown): string { return String(v ?? "").trim(); }
function normalizeId(v: unknown): string | null { const s = safeText(v); return /^[A-Za-z0-9_.:-]{1,240}$/.test(s) ? s : null; }
function runFilePath(run_id: string): string { return path.join(flightTableRunDirV1(run_id), "run.json"); }
function shortHash(seed: string): string { return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16); }
function uniqueStrings(values: Array<string | null | undefined>): string[] { return Array.from(new Set(values.map((v) => safeText(v)).filter(Boolean))); }

function arrayFrom(payload: any, keys: string[]): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  if (payload.data) return arrayFrom(payload.data, keys);
  return [];
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
  try {
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
  } catch (err) {
    return { ok: false, status: 0, json: null, error: String((err as any)?.message ?? err ?? "FETCH_FAILED") };
  }
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const res = await pool.query("SELECT to_regclass($1)::text AS table_name", [`public.${table}`]);
  return Boolean(res.rows?.[0]?.table_name);
}

async function latestAcceptancePass(pool: Pool, run: FlightTableRunV1, actTaskId: string | null, operationId: string): Promise<{ acceptance_id: string | null; pass: boolean }> {
  const res = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='acceptance_result_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (
          ($4::text IS NOT NULL AND (record_json::jsonb#>>'{payload,act_task_id}')=$4)
          OR (record_json::jsonb#>>'{payload,operation_plan_id}')=$5
        )
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [run.tenant_id, run.project_id, run.group_id, actTaskId, operationId],
  );
  if (!res.rows?.length) return { acceptance_id: null, pass: false };
  const row = res.rows[0];
  const id = safeText(row.record_json?.payload?.acceptance_id ?? row.fact_id) || null;
  const verdict = safeText(row.record_json?.payload?.verdict).toUpperCase();
  return { acceptance_id: id, pass: verdict === "PASS" };
}

async function ensureEstimatedRoiForSuccess(params: {
  pool: Pool;
  run: FlightTableRunV1;
  operation_id: string;
  field_id: string;
  act_task_id: string | null;
  prescription_id: string | null;
  field_memory_ids: string[];
  evidence_ids: string[];
}): Promise<{ roi_ids: string[]; status: "READY" | "ESTIMATED" | "EMPTY" | "ERROR"; reason: string | null }> {
  const { pool, run, operation_id, field_id, act_task_id, prescription_id, field_memory_ids, evidence_ids } = params;
  if (!(await tableExists(pool, "roi_ledger_v1"))) return { roi_ids: [], status: "EMPTY", reason: "ROI ledger table missing; customer layer should show empty state." };
  const existing = await pool.query(
    `SELECT roi_ledger_id FROM roi_ledger_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND (operation_id=$4 OR task_id=$5)
      ORDER BY created_at DESC LIMIT 20`,
    [run.tenant_id, run.project_id, run.group_id, operation_id, act_task_id],
  );
  const existingIds = (existing.rows ?? []).map((row: any) => safeText(row.roi_ledger_id)).filter(Boolean);
  if (existingIds.length) return { roi_ids: existingIds, status: "READY", reason: null };
  const roiId = `ft_roi_${shortHash(`${run.run_id}|${operation_id}|water_saved`)}`;
  await pool.query(
    `INSERT INTO roi_ledger_v1 (
      roi_ledger_id, tenant_id, project_id, group_id,
      operation_id, task_id, prescription_id, field_id, roi_type,
      baseline_type, baseline_value, planned_value, actual_value, delta_value, unit,
      estimated_money_value, currency, source_skill_id, skill_trace_ref,
      field_memory_refs, value_kind, baseline, actual, delta, confidence, evidence_refs,
      calculation_method, assumptions, uncertainty_notes, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,'WATER_SAVED',
      'DEFAULT_ASSUMPTION',$9,$10,$11,$12,'L',
      $13,'USD','flight_table_roi_estimator_v1',NULL,
      $14::jsonb,'ASSUMPTION_BASED',$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,
      'flight_table_estimated_roi_v1',$20::jsonb,$21,now(),now()
    ) ON CONFLICT (roi_ledger_id) DO NOTHING`,
    [
      roiId,
      run.tenant_id,
      run.project_id,
      run.group_id,
      operation_id,
      act_task_id,
      prescription_id,
      field_id,
      30000,
      25000,
      25000,
      5000,
      2.5,
      JSON.stringify(field_memory_ids),
      JSON.stringify({ type: "default_irrigation_baseline", water_l: 30000 }),
      JSON.stringify({ water_l: 25000 }),
      JSON.stringify({ water_saved_l: 5000 }),
      JSON.stringify({ level: "LOW", basis: "flight table estimate only" }),
      JSON.stringify(evidence_ids),
      JSON.stringify({ water_unit_price_usd_per_1000l: 0.5, source: "flight_table_default_assumption" }),
      "Estimated ROI only; not a billing or verified finance record.",
    ],
  );
  return { roi_ids: [roiId], status: "ESTIMATED", reason: "Generated assumption-based ROI estimate because no existing ROI ledger row was found." };
}

async function listFieldMemoryIds(pool: Pool, run: FlightTableRunV1, operationId: string, fieldId: string): Promise<string[]> {
  if (!(await tableExists(pool, "field_memory_v1"))) return [];
  const res = await pool.query(
    `SELECT memory_id FROM field_memory_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND (operation_id=$4 OR field_id=$5)
      ORDER BY occurred_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 50`,
    [run.tenant_id, run.project_id, run.group_id, operationId, fieldId],
  ).catch(() => ({ rows: [] as any[] }));
  return (res.rows ?? []).map((row: any) => safeText(row.memory_id)).filter(Boolean);
}

function normalizeWeatherStatus(history: any, forecast: any): FlightTableReportLearningRunResultV1["weather_status"] {
  const raw = safeText(history?.status ?? forecast?.status).toLowerCase();
  const source = safeText(history?.source ?? forecast?.source).toLowerCase();
  if (raw === "ok") return "ok";
  if (raw === "unavailable" || source.includes("unavailable")) return "unavailable";
  if (source.includes("stub") || source.includes("contract")) return "stub";
  if (raw) return "unknown";
  return "unknown";
}

function hasRain(weather: any): boolean {
  const rainfall = Number(weather?.rainfall_mm ?? 0);
  if (Number.isFinite(rainfall) && rainfall > 0) return true;
  const events = Array.isArray(weather?.events) ? weather.events : [];
  return events.some((event: any) => Number(event?.rainfall_mm ?? 0) > 0 || safeText(event?.event_type).toUpperCase().includes("RAIN"));
}

function diagnostics(params: {
  acceptancePass: boolean;
  evidenceIds: string[];
  weatherStatus: string;
  weatherExcludedReason: string | null;
  roiStatus: string;
  fieldMemoryIds: string[];
  fieldMemoryStatus: string;
  lane: string;
}): string[] {
  const out: string[] = [];
  if (!params.acceptancePass && params.lane === "success") out.push("缺少 acceptance：success lane 必须先完成验收 PASS。");
  if (params.evidenceIds.length === 0) out.push("缺少 evidence：operation 证据包或 evidence relation 未形成。");
  if (params.weatherExcludedReason) out.push(`weather interference：${params.weatherExcludedReason}`);
  if (params.roiStatus === "EMPTY") out.push("ROI baseline missing：未发现 ROI ledger，也未能写入估算记录。");
  if (params.fieldMemoryStatus === "EMPTY") out.push("Field Memory before/after/delta missing：未发现田块记忆或验收后学习记录。");
  if (params.lane === "skill_failure") out.push("skill failure：技能失败航线不写入可信学习。");
  return Array.from(new Set(out));
}

function determineLearningClosure(params: {
  lane: string;
  acceptancePass: boolean;
  weatherExcludedReason: string | null;
  roiStatus: string;
  fieldMemoryIds: string[];
  skillPerformanceStatus: string;
}): FlightTableReportLearningRunResultV1["learning_closure"] {
  if (params.lane === "weather_interference" || params.weatherExcludedReason) return "EXCLUDED_WEATHER";
  if (params.lane === "skill_failure") return "BLOCKED_SKILL_FAILURE";
  if (!params.acceptancePass) return "OPEN";
  if ((params.roiStatus === "READY" || params.roiStatus === "ESTIMATED") && params.fieldMemoryIds.length > 0 && params.skillPerformanceStatus !== "ERROR") return "CLOSED";
  return "PARTIAL";
}

function responseReady(result: StatusResult, keys: string[]): boolean {
  if (!result.ok) return false;
  if (!keys.length) return true;
  const rows = arrayFrom(result.json, keys);
  return rows.length > 0 || Boolean(result.json?.operation_report_v1 ?? result.json?.field_report_v1);
}

async function probe(baseUrl: string, token: string, path: string, keys: string[] = []): Promise<StatusResult> {
  const res = await callJson(`${baseUrl}${path}`, "GET", token);
  return { ok: res.ok, status: res.status, json: res.json, source: path };
}

export async function runFlightTableReportLearningClosureV1(args: {
  pool: Pool;
  run: FlightTableRunV1;
  input: FlightTableReportLearningRunInputV1;
  auth: AoActAuthContextV0;
  baseUrl: string;
  bearerToken: string;
}): Promise<FlightTableReportLearningRunResultV1> {
  const { pool, run, input, auth, baseUrl, bearerToken } = args;
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  const operation_id = normalizeId(input.operation_id) ?? run.manifest.operation_plan_ids.at(-1);
  const field_id = normalizeId(input.field_id) ?? run.manifest.field_id;
  const act_task_id = run.manifest.act_task_ids.at(-1) ?? null;
  if (!operation_id) throw new Error("FLIGHT_TABLE_OPERATION_ID_MISSING");
  if (!field_id) throw new Error("FLIGHT_TABLE_FIELD_NOT_FOUND");

  const from = new Date(nowTs() - 2 * 60 * 60 * 1000).toISOString();
  const to = new Date(nowTs() + 60 * 60 * 1000).toISOString();
  const [operationReport, fieldReport, customerReports, weatherHistory, weatherForecast, operatorRoi, customerRoi, fieldMemory, fieldMemoryByField, fieldMemoryByOperation, fieldMemoryHealth, operatorFieldMemory, skillTraces, skillPerformance] = await Promise.all([
    probe(baseUrl, bearerToken, `/api/v1/reports/operation/${encodeURIComponent(operation_id)}`),
    probe(baseUrl, bearerToken, `/api/v1/reports/field/${encodeURIComponent(field_id)}`),
    probe(baseUrl, bearerToken, `/api/v1/customer/reports`, ["reports"]),
    probe(baseUrl, bearerToken, `/api/v1/weather/history?field_id=${encodeURIComponent(field_id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    probe(baseUrl, bearerToken, `/api/v1/weather/forecast?field_id=${encodeURIComponent(field_id)}`),
    probe(baseUrl, bearerToken, `/api/v1/operator/roi-ledger?operation_id=${encodeURIComponent(operation_id)}`, ["items", "roi", "ledger"]),
    probe(baseUrl, bearerToken, `/api/v1/customer/roi-ledger?field_id=${encodeURIComponent(field_id)}&operation_id=${encodeURIComponent(operation_id)}`, ["items", "roi", "ledger"]),
    probe(baseUrl, bearerToken, `/api/v1/field-memory?operation_id=${encodeURIComponent(operation_id)}`, ["items"]),
    probe(baseUrl, bearerToken, `/api/v1/fields/${encodeURIComponent(field_id)}/memory`, ["items"]),
    probe(baseUrl, bearerToken, `/api/v1/operations/${encodeURIComponent(operation_id)}/field-memory`, ["items"]),
    probe(baseUrl, bearerToken, `/api/v1/field-memory/health`),
    probe(baseUrl, bearerToken, `/api/v1/operator/field-memory?operation_id=${encodeURIComponent(operation_id)}`, ["items"]),
    probe(baseUrl, bearerToken, `/api/v1/operator/skill-traces?operation_id=${encodeURIComponent(operation_id)}`, ["items", "skill_traces", "skill_runs"]),
    probe(baseUrl, bearerToken, `/api/v1/operator/skill-performance?operation_id=${encodeURIComponent(operation_id)}&field_id=${encodeURIComponent(field_id)}`, ["items", "skill_performance", "performance"]),
  ]);

  const acceptance = await latestAcceptancePass(pool, run, act_task_id, operation_id);
  const operationReportReady = responseReady(operationReport, []);
  const fieldReportReady = responseReady(fieldReport, []);
  const customerReportsReady = responseReady(customerReports, ["reports"]);
  const weatherStatus = normalizeWeatherStatus(weatherHistory.json, weatherForecast.json);
  const weatherSource = safeText(weatherHistory.json?.source ?? weatherForecast.json?.source) || null;
  const rainDetected = hasRain(weatherHistory.json) || hasRain(weatherForecast.json);
  const weatherExcludedReason = run.lane === "weather_interference" || rainDetected
    ? "rainfall_detected_or_weather_interference_lane; irrigation learning is excluded from trusted closure."
    : null;

  let fieldMemoryIds = await listFieldMemoryIds(pool, run, operation_id, field_id);
  if (!fieldMemoryIds.length) {
    fieldMemoryIds = [...arrayFrom(fieldMemory.json, ["items"]), ...arrayFrom(fieldMemoryByField.json, ["items"]), ...arrayFrom(fieldMemoryByOperation.json, ["items"])]
      .map((item: any) => safeText(item.memory_id ?? item.id))
      .filter(Boolean);
  }
  const fieldMemoryStatus: FlightTableReportLearningRunResultV1["field_memory_status"] = fieldMemoryIds.length ? "READY" : (fieldMemory.ok || fieldMemoryByField.ok || fieldMemoryByOperation.ok || fieldMemoryHealth.ok ? "EMPTY" : "ERROR");
  const fieldMemoryReason = fieldMemoryIds.length ? null : "No field memory row found for this operation; report should show explicit empty state.";

  let roiIds = arrayFrom(operatorRoi.json, ["items", "roi", "ledger"]).map((item: any) => safeText(item.roi_id ?? item.roi_ledger_id ?? item.id)).filter(Boolean);
  let roiStatus: FlightTableReportLearningRunResultV1["roi_status"] = roiIds.length ? "READY" : "EMPTY";
  let roiReason: string | null = roiIds.length ? null : "No ROI ledger row returned by operator ROI API.";
  if (run.lane === "success" && acceptance.pass && !weatherExcludedReason) {
    const ensured = await ensureEstimatedRoiForSuccess({
      pool,
      run,
      operation_id,
      field_id,
      act_task_id,
      prescription_id: run.manifest.prescription_ids.at(-1) ?? null,
      field_memory_ids: fieldMemoryIds,
      evidence_ids: run.manifest.evidence_ids,
    });
    roiIds = uniqueStrings([...roiIds, ...ensured.roi_ids]);
    roiStatus = ensured.status;
    roiReason = ensured.reason;
  } else if (!operatorRoi.ok && !customerRoi.ok) {
    roiStatus = "ERROR";
    roiReason = "ROI APIs unavailable; customer layer should show report embedded summary or empty state.";
  }

  const skillTraceStatus: FlightTableReportLearningRunResultV1["skill_trace_status"] = responseReady(skillTraces, ["items", "skill_traces", "skill_runs"]) ? "READY" : (skillTraces.ok ? "EMPTY" : "ERROR");
  const skillPerformanceStatus: FlightTableReportLearningRunResultV1["skill_performance_status"] = responseReady(skillPerformance, ["items", "skill_performance", "performance"]) || fieldMemoryIds.length ? "READY" : (skillPerformance.ok ? "EMPTY" : "ERROR");

  const closure = determineLearningClosure({
    lane: run.lane,
    acceptancePass: acceptance.pass,
    weatherExcludedReason,
    roiStatus,
    fieldMemoryIds,
    skillPerformanceStatus,
  });
  const suggestions = diagnostics({
    acceptancePass: acceptance.pass,
    evidenceIds: run.manifest.evidence_ids,
    weatherStatus,
    weatherExcludedReason,
    roiStatus,
    fieldMemoryIds,
    fieldMemoryStatus,
    lane: run.lane,
  });
  const learningExcludedReason = closure === "EXCLUDED_WEATHER" ? weatherExcludedReason : closure === "BLOCKED_SKILL_FAILURE" ? "skill failure lane; no trusted learning written." : null;

  const ui_urls = [
    "/customer/reports",
    `/operator/roi-ledger?operation_id=${encodeURIComponent(operation_id)}`,
    `/operator/field-memory?operation_id=${encodeURIComponent(operation_id)}`,
    `/customer/operations/${encodeURIComponent(operation_id)}`,
    `/customer/fields/${encodeURIComponent(field_id)}`,
  ];

  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/report-learning/run`,
    ok: true,
    status_code: 200,
    label: "report weather roi field-memory learning closure flight",
    request: { operation_id, field_id },
    response: {
      operation_report_ready: operationReportReady,
      field_report_ready: fieldReportReady,
      customer_reports_ready: customerReportsReady,
      weather_status: weatherStatus,
      weather_source: weatherSource,
      roi_status: roiStatus,
      roi_ids: roiIds,
      field_memory_status: fieldMemoryStatus,
      field_memory_ids: fieldMemoryIds,
      skill_trace_status: skillTraceStatus,
      skill_performance_status: skillPerformanceStatus,
      learning_closure: closure,
      learning_excluded_reason: learningExcludedReason,
      diagnostic_suggestions: suggestions,
      api_probe_status: {
        operation_report: operationReport.status,
        field_report: fieldReport.status,
        customer_reports: customerReports.status,
        weather_history: weatherHistory.status,
        weather_forecast: weatherForecast.status,
        operator_roi: operatorRoi.status,
        customer_roi: customerRoi.status,
        field_memory: fieldMemory.status,
        operator_field_memory: operatorFieldMemory.status,
        skill_traces: skillTraces.status,
        skill_performance: skillPerformance.status,
      },
    },
  });

  const passCondition = run.lane === "success"
    ? operationReportReady && fieldReportReady && acceptance.pass && fieldMemoryStatus === "READY" && (closure === "CLOSED" || closure === "EXCLUDED_WEATHER")
    : run.lane === "weather_interference"
      ? operationReportReady && fieldReportReady && closure === "EXCLUDED_WEATHER"
      : run.lane === "skill_failure"
        ? closure === "BLOCKED_SKILL_FAILURE"
        : operationReportReady && fieldReportReady;

  const steps = updateStep(run.steps, "H", passCondition ? "PASS" : "FAIL", `reports op=${operationReportReady}; field=${fieldReportReady}; weather=${weatherStatus}; roi=${roiStatus}; memory=${fieldMemoryStatus}; learning=${closure}`);
  const nextRun = await writeRun({
    ...run,
    current_step: "H",
    status: passCondition ? run.status : "FAIL",
    steps,
    manifest: {
      ...run.manifest,
      field_id,
      acceptance_ids: uniqueStrings([...run.manifest.acceptance_ids, normalizeId(input.acceptance_id) ?? acceptance.acceptance_id]),
      evidence_ids: uniqueStrings([...run.manifest.evidence_ids, normalizeId(input.evidence_id)]),
      roi_ids: uniqueStrings([...run.manifest.roi_ids, ...roiIds]),
      field_memory_ids: uniqueStrings([...run.manifest.field_memory_ids, ...fieldMemoryIds]),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      ui_urls: uniqueStrings([...run.manifest.ui_urls, ...ui_urls]),
    },
  });

  return {
    ok: true,
    operation_id,
    field_id,
    operation_report_ready: operationReportReady,
    field_report_ready: fieldReportReady,
    customer_reports_ready: customerReportsReady,
    weather_status: weatherStatus,
    weather_source: weatherSource,
    weather_learning_excluded_reason: weatherExcludedReason,
    roi_status: roiStatus,
    roi_ids: roiIds,
    roi_reason: roiReason,
    field_memory_status: fieldMemoryStatus,
    field_memory_ids: fieldMemoryIds,
    field_memory_reason: fieldMemoryReason,
    skill_trace_status: skillTraceStatus,
    skill_performance_status: skillPerformanceStatus,
    learning_closure: closure,
    learning_excluded_reason: learningExcludedReason,
    diagnostic_suggestions: suggestions,
    ui_urls,
    run: nextRun,
  };
}
