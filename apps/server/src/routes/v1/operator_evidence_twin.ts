// apps/server/src/routes/v1/operator_evidence_twin.ts
// Purpose: expose the H53.1 Operator Evidence Twin read-only endpoint with sensing-only readback.
// Boundary: this route reads scoped sensing rows and never writes facts, recommendations, approvals, AO-ACT tasks, receipts, acceptance, ROI, or Field Memory.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

type Row = Record<string, any>;
type Scope = { tenantId: string | null; projectId: string | null; groupId: string | null; fieldId: string | null };

const DATA_SCOPE = "OFFICIAL_OPERATOR_TWIN_API";
const STEP_DEFINITIONS = [
  ["RAW_SIGNAL", 1, "原始信号", "raw_signal"],
  ["OBSERVATION", 2, "标准化观测", "observation"],
  ["WATER_STRESS_STATE", 3, "水分压力状态", "state_estimate"],
  ["FORECAST", 4, "水分预测", "forecast"],
  ["SCENARIO", 5, "灌溉情景", "scenario"],
  ["RECOMMENDATION", 6, "建议候选", "recommendation"],
  ["APPROVAL", 7, "人工审批", "approval"],
  ["OPERATION_PLAN", 8, "作业计划", "operation_plan"],
  ["AO_ACT", 9, "AO-ACT", "task"],
  ["AS_EXECUTED", 10, "实执记录", "as_executed"],
  ["EVIDENCE", 11, "执行证据", "evidence"],
  ["ACCEPTANCE", 12, "执行验收", "acceptance"],
  ["VERIFICATION", 13, "灌后水分响应验证", "verification"],
] as const;

function text(value: unknown): string { return String(value ?? "").trim(); }
function n(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function j(value: unknown): any { if (!value) return null; if (typeof value === "object") return value; try { return JSON.parse(String(value)); } catch { return null; } }
function arr(value: unknown): any[] { const parsed = j(value); if (Array.isArray(value)) return value; return Array.isArray(parsed) ? parsed : []; }
function ref(kind: string, id: unknown, schema: string | null = null) { const refId = text(id); return refId ? { kind, ref_id: refId, schema_ref: schema, label: refId, href: null } : null; }
function refs(...items: Array<{ kind: string; id: unknown; schema?: string | null }>) { return items.map((item) => ref(item.kind, item.id, item.schema ?? null)).filter(Boolean); }
function writePolicy() { return { write_ready: false, allowed_actions: [] }; }
function node(args: { id: string; label: string; kind: string; schemaRef: string | null; status: string; sourceRefs?: any[]; evidenceRefs?: any[]; expandPayload?: Row | null; blockingReasons?: string[]; confidenceLabel?: string | null; confidenceScore?: number | null; latestTsMs?: number | null }) {
  return {
    id: args.id,
    label: args.label,
    kind: args.kind,
    schema_ref: args.schemaRef,
    status: args.status,
    time: { occurred_at: null, observed_at: null, computed_at: null, updated_at: null, latest_ts_ms: args.latestTsMs ?? null },
    quality: { status: args.status === "MISSING" || args.status === "DERIVED_PENDING" ? "BLOCKING" : "AVAILABLE", quality_flags: [], blocking_reasons: args.blockingReasons ?? [], confidence_penalty: null },
    confidence: { label: args.confidenceLabel ?? null, score: args.confidenceScore ?? null, level: args.confidenceLabel ?? null },
    source_refs: args.sourceRefs ?? [],
    evidence_refs: args.evidenceRefs ?? [],
    expand_payload: args.expandPayload ?? null,
    ui_policy: { default_collapsed: true, show_raw_payload: false, show_internal_ids: true, show_customer_safe_label: false },
    write_policy: writePolicy(),
  };
}
function missing(id: string, label: string, kind: string, schemaRef: string | null, code: string) { return node({ id, label, kind, schemaRef, status: "MISSING", expandPayload: { gap_code: code }, blockingReasons: [code] }); }
function gap(code: string, label: string, severity: string, nodeIds: string[] = []) { return { gap_code: code, label, severity, related_node_ids: nodeIds, suggested_resolution: null }; }
function boundary(code: string, label: string, severity = "BLOCKING") { return { rule_code: code, label, severity, enforced: true }; }
function scopeFrom(req: any, fieldId: string): Scope {
  const user = req?.user ?? req?.auth ?? req?.principal ?? {};
  const q = req?.query ?? {};
  const h = req?.headers ?? {};
  return {
    tenantId: text(user.tenant_id ?? user.tenantId ?? q.tenant_id ?? q.tenantId ?? h["x-tenant-id"]),
    projectId: text(user.project_id ?? user.projectId ?? q.project_id ?? q.projectId ?? h["x-project-id"]),
    groupId: text(user.group_id ?? user.groupId ?? q.group_id ?? q.groupId ?? h["x-group-id"]),
    fieldId: text(fieldId),
  };
}
function scoped(scope: Scope): boolean { return Boolean(scope.tenantId && scope.projectId && scope.groupId && scope.fieldId); }
async function tableExists(pool: Pool, table: string): Promise<boolean> { const r = await pool.query("SELECT to_regclass($1)::text AS name", ["public." + table]).catch(() => ({ rows: [{ name: null }] as Row[] })); return Boolean(r.rows?.[0]?.name); }
async function one(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> { const r = await pool.query(sql, values).catch(() => ({ rows: [] as Row[] })); return r.rows?.[0] ?? null; }
async function rows(pool: Pool, sql: string, values: unknown[]): Promise<Row[]> { const r = await pool.query(sql, values).catch(() => ({ rows: [] as Row[] })); return r.rows ?? []; }
async function latestField(pool: Pool, scope: Scope) { if (!scoped(scope) || !(await tableExists(pool, "field_index_v1"))) return null; return one(pool, "SELECT * FROM field_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 LIMIT 1", [scope.tenantId, scope.projectId, scope.groupId, scope.fieldId]); }
async function boundDevices(pool: Pool, scope: Scope) { if (!scoped(scope) || !(await tableExists(pool, "device_binding_index_v1"))) return []; return rows(pool, "SELECT device_id FROM device_binding_index_v1 WHERE tenant_id=$1 AND field_id=$2", [scope.tenantId, scope.fieldId]); }
async function latestTelemetry(pool: Pool, scope: Scope, devices: string[]) { if (!scope.tenantId || !devices.length || !(await tableExists(pool, "telemetry_index_v1"))) return null; return one(pool, "SELECT * FROM telemetry_index_v1 WHERE tenant_id=$1 AND device_id = ANY($2::text[]) AND metric='soil_moisture_percent' ORDER BY ts DESC LIMIT 1", [scope.tenantId, devices]); }
async function latestObservation(pool: Pool, scope: Scope) { if (!scoped(scope) || !(await tableExists(pool, "device_observation_index_v1"))) return null; return one(pool, "SELECT * FROM device_observation_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND metric='soil_moisture_percent' ORDER BY observed_at DESC LIMIT 1", [scope.tenantId, scope.projectId, scope.groupId, scope.fieldId]); }
async function latestWindow(pool: Pool, scope: Scope) { if (!scoped(scope) || !(await tableExists(pool, "soil_moisture_sensing_window_index_v1"))) return null; return one(pool, "SELECT * FROM soil_moisture_sensing_window_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 ORDER BY updated_at DESC NULLS LAST, window_end DESC LIMIT 1", [scope.tenantId, scope.projectId, scope.groupId, scope.fieldId]); }
async function latestWeather(pool: Pool, scope: Scope) {
  if (!scoped(scope)) return null;
  if (await tableExists(pool, "weather_forecast_index_v1")) {
    const indexed = await one(pool, "SELECT * FROM weather_forecast_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 ORDER BY generated_at DESC LIMIT 1", [scope.tenantId, scope.projectId, scope.groupId, scope.fieldId]);
    if (indexed) return indexed;
  }
  if (!(await tableExists(pool, "facts"))) return null;
  return one(pool, "SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json, record_json::jsonb->'payload' AS payload_json FROM facts WHERE (record_json::jsonb->>'type')='weather_forecast_fact_v1' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,project_id}')=$2 AND (record_json::jsonb#>>'{payload,group_id}')=$3 AND (record_json::jsonb#>>'{payload,field_id}')=$4 ORDER BY occurred_at DESC LIMIT 1", [scope.tenantId, scope.projectId, scope.groupId, scope.fieldId]);
}
function rawPayload(row: Row | null) { return row ? (j(row.payload_json) ?? j(row.raw_payload_json) ?? j(row.record_json)?.payload ?? row) : {}; }
function ts(row: Row | null, key: string) { const value = row?.[key] ?? rawPayload(row)?.[key]; const numeric = Number(value); if (Number.isFinite(numeric)) return numeric; const parsed = Date.parse(String(value ?? "")); return Number.isFinite(parsed) ? parsed : null; }
function rawSignalNode(row: Row | null) { return row ? node({ id: "raw_signal:soil_moisture_percent", label: "土壤水分原始信号", kind: "raw_signal", schemaRef: "telemetry_index_v1", status: "AVAILABLE", sourceRefs: refs({ kind: "fact", id: row.fact_id, schema: "telemetry_index_v1" }), expandPayload: { metric: row.metric, value_num: n(row.value_num), value_text: row.value_text ?? null, device_id: row.device_id, soil_moisture_percent: n(row.value_num) }, latestTsMs: ts(row, "ts") }) : missing("missing:raw_signal", "原始信号", "raw_signal", "telemetry_index_v1", "RAW_SIGNAL_SOURCE_NOT_EXPOSED"); }
function observationNode(row: Row | null) { return row ? node({ id: "observation:soil_moisture_percent", label: "土壤水分标准化观测", kind: "observation", schemaRef: "device_observation_index_v1", status: "AVAILABLE", sourceRefs: refs({ kind: "observation", id: row.fact_id, schema: "device_observation_index_v1" }), expandPayload: { metric: row.metric, value_num: n(row.value_num), unit: row.unit ?? null, confidence: n(row.confidence), device_id: row.device_id, soil_moisture_percent: n(row.value_num) }, latestTsMs: n(row.observed_at_ts_ms) ?? ts(row, "observed_at") }) : missing("missing:observation", "标准化观测", "observation", "device_observation_index_v1", "OBSERVATION_SOURCE_NOT_EXPOSED"); }
function windowNode(row: Row | null) { return row ? node({ id: "observation_window:soil_moisture", label: "土壤水分感知窗口", kind: "observation", schemaRef: "soil_moisture_sensing_window_index_v1", status: "AVAILABLE", sourceRefs: refs({ kind: "observation", id: row.source_fact_id, schema: "soil_moisture_sensing_window_index_v1" }), expandPayload: { window_id: row.window_id, metric: row.metric, coverage_ratio: n(row.coverage_ratio), quality_status: row.quality_status, actual_points: n(row.actual_points), expected_points: n(row.expected_points), max_gap_ms: n(row.max_gap_ms) }, confidenceLabel: text(j(row.confidence_json)?.level ?? row.quality_status), confidenceScore: n(j(row.confidence_json)?.score), latestTsMs: ts(row, "window_end") }) : missing("missing:soil_moisture_window", "土壤水分感知窗口", "observation", "soil_moisture_sensing_window_index_v1", "SOIL_MOISTURE_SENSING_WINDOW_MISSING"); }
function weatherNode(row: Row | null) { const payload = rawPayload(row); return row ? node({ id: "forecast_input:weather", label: "天气预报输入", kind: "forecast", schemaRef: row.forecast_id ? "weather_forecast_index_v1" : "weather_forecast_fact_v1", status: "AVAILABLE", sourceRefs: refs({ kind: "forecast", id: row.source_fact_id ?? row.fact_id ?? row.forecast_id, schema: row.forecast_id ? "weather_forecast_index_v1" : "weather_forecast_fact_v1" }), expandPayload: { forecast_id: row.forecast_id ?? payload.forecast_id ?? null, rainfall_forecast_mm_72h: n(row.rainfall_forecast_mm_72h ?? payload.rainfall_forecast_mm_72h), temperature_max_c_72h: n(row.temperature_max_c_72h ?? payload.temperature_max_c_72h), et0_mm_72h: n(row.et0_mm_72h ?? payload.et0_mm_72h), provider: row.provider ?? payload.provider ?? null }, latestTsMs: ts(row, "generated_at") ?? ts(row, "occurred_at") }) : missing("missing:weather_forecast", "天气预报输入", "forecast", "weather_forecast_fact_v1", "WEATHER_FORECAST_INPUT_MISSING"); }
function statusNode(code: string, label: string, kind: string, schema: string, gapCode: string) { return node({ id: "derived_pending:" + code.toLowerCase(), label, kind, schemaRef: schema, status: "DERIVED_PENDING", expandPayload: { gap_code: gapCode, reason: "H53.1 only reads sensing data; derived state/decision/execution layers are not seeded." }, blockingReasons: [gapCode] }); }
function sourceInventory(telemetry: Row | null, observation: Row | null, window: Row | null, weather: Row | null) { const items = [{ table_name: "telemetry_index_v1", row: telemetry }, { table_name: "device_observation_index_v1", row: observation }, { table_name: "soil_moisture_sensing_window_index_v1", row: window }, { table_name: weather?.forecast_id ? "weather_forecast_index_v1" : "weather_forecast_fact_v1", row: weather }]; return { index_tables: items.map((item) => ({ table_name: item.table_name, label: item.table_name, available: Boolean(item.row), row_count: item.row ? 1 : 0, latest_ts_ms: item.row ? (ts(item.row, "updated_at") ?? ts(item.row, "ts") ?? ts(item.row, "occurred_at")) : null, latest_evidence_refs: item.row ? refs({ kind: "index_row", id: item.row.fact_id ?? item.row.source_fact_id ?? item.row.forecast_id, schema: item.table_name }) : [], scope_columns_present: ["tenant_id", "project_id", "group_id", "field_id"], missing_reason: item.row ? null : "NO_SCOPED_ROWS" })), summary: { table_count: items.length, available_table_count: items.filter((item) => item.row).length, total_row_count: items.filter((item) => item.row).length } }; }
function buildTwin(scope: Scope, field: Row | null, telemetry: Row | null, observation: Row | null, window: Row | null, weather: Row | null) {
  const raw = rawSignalNode(telemetry);
  const obs = observationNode(observation);
  const sensingWindow = windowNode(window);
  const weatherInput = weatherNode(weather);
  const state = statusNode("WATER_STRESS_STATE", "水分压力状态", "state_estimate", "water_state_estimate_index_v1", "WATER_STRESS_STATE_DERIVED_PENDING");
  const forecast = statusNode("FORECAST", "水分预测", "forecast", "root_zone_soil_water_forecast_v1", "FORECAST_DERIVED_PENDING");
  const scenario = { ...statusNode("SCENARIO", "灌溉情景", "scenario", "irrigation_scenario_set_index_v1", "SCENARIO_DERIVED_PENDING"), scenario_set_id: null, no_action_baseline_present: false, options: [], unavailable_reason: "SCENARIO_DERIVED_PENDING" };
  const recommendation = { ...statusNode("RECOMMENDATION", "建议候选", "recommendation", "decision_recommendation_index_v1", "RECOMMENDATION_DERIVED_PENDING"), recommendation_id: null, selected_scenario_option_id: null, action_type: null, amount_mm: null, human_approval_required: true, no_direct_execution: true, approval_created: false, operation_plan_created: false, task_created: false, dispatch_created: false };
  const approval = statusNode("APPROVAL", "人工审批", "approval", "approval_request_v1", "APPROVAL_NOT_CREATED_IN_SENSING_ONLY");
  const operation = statusNode("OPERATION_PLAN", "作业计划", "operation_plan", "operation_plan_v1", "OPERATION_PLAN_NOT_CREATED_IN_SENSING_ONLY");
  const aoAct = statusNode("AO_ACT", "AO-ACT", "task", "ao_act_task_v0", "AO_ACT_NOT_CREATED_IN_SENSING_ONLY");
  const asExecuted = statusNode("AS_EXECUTED", "实执记录", "as_executed", "as_executed_record_v1", "AS_EXECUTED_NOT_CREATED_IN_SENSING_ONLY");
  const evidence = statusNode("EVIDENCE", "执行证据", "evidence", "evidence_artifact_v1", "EVIDENCE_NOT_CREATED_IN_SENSING_ONLY");
  const acceptance = statusNode("ACCEPTANCE", "执行验收", "acceptance", "acceptance_result_v1", "ACCEPTANCE_NOT_CREATED_IN_SENSING_ONLY");
  const verification = statusNode("VERIFICATION", "灌后水分响应验证", "verification", "water_response_verification_v1", "VERIFICATION_NOT_CREATED_IN_SENSING_ONLY");
  const stepByCode: Record<string, any> = { RAW_SIGNAL: raw, OBSERVATION: sensingWindow.status === "AVAILABLE" ? sensingWindow : obs, WATER_STRESS_STATE: state, FORECAST: forecast, SCENARIO: scenario, RECOMMENDATION: recommendation, APPROVAL: approval, OPERATION_PLAN: operation, AO_ACT: aoAct, AS_EXECUTED: asExecuted, EVIDENCE: evidence, ACCEPTANCE: acceptance, VERIFICATION: verification };
  const steps = STEP_DEFINITIONS.map(([code, order, label, kind]) => ({ ...stepByCode[code], step_code: code, order, label, kind, required_for_p0: true }));
  const gaps = [
    ...(!telemetry ? [gap("RAW_SIGNAL_SOURCE_NOT_EXPOSED", "未找到 scoped telemetry_index_v1 土壤水分原始信号。", "BLOCKING", [raw.id])] : []),
    ...(!observation ? [gap("OBSERVATION_SOURCE_NOT_EXPOSED", "未找到 scoped device_observation_index_v1 标准化观测。", "BLOCKING", [obs.id])] : []),
    ...(!window ? [gap("SOIL_MOISTURE_SENSING_WINDOW_MISSING", "未找到 scoped soil_moisture_sensing_window_index_v1。", "BLOCKING", [sensingWindow.id])] : []),
    ...(!weather ? [gap("WEATHER_FORECAST_INPUT_MISSING", "未找到 scoped weather forecast 输入。", "WARNING", [weatherInput.id])] : []),
    gap("WATER_STRESS_STATE_DERIVED_PENDING", "H53.1 只回读感知数据，水分压力状态必须由后续推导生成。", "INFO", [state.id]),
    gap("SCENARIO_DERIVED_PENDING", "H53.1 不 seed 情景、建议、审批或执行。", "INFO", [scenario.id]),
    gap("ACCEPTANCE_NOT_CREATED_IN_SENSING_ONLY", "H53.1 不 seed 灌后验收。", "INFO", [acceptance.id]),
  ];
  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_EVIDENCE_TWIN",
    request_scope: { tenant_id: scope.tenantId, project_id: scope.projectId, group_id: scope.groupId, fieldId: scope.fieldId, field_id: scope.fieldId },
    scope_policy: { required: true, accepted_scope_keys: ["tenant_id", "project_id", "group_id", "field_id"], scope_applied: scoped(scope), missing_reason: scoped(scope) ? null : "TENANT_PROJECT_GROUP_FIELD_SCOPE_REQUIRED" },
    field: { field_id: scope.fieldId || "", field_name: text(field?.display_name ?? field?.field_name ?? scope.fieldId), crop_text: text(field?.crop ?? field?.crop_text) || null, tenant_id: scope.tenantId, project_id: scope.projectId, group_id: scope.groupId, canonical_route: `/app/operator/fields/${encodeURIComponent(scope.fieldId || "")}/evidence-twin`, legacy_routes: [`/operator/twin/fields/${encodeURIComponent(scope.fieldId || "")}`] },
    current_state: { label: telemetry || observation || window ? "感知数据已回读，状态待推导" : "感知数据缺失", code: null, status: telemetry || observation || window ? "LIMITED" : "MISSING", confidence: { label: null, score: null, level: null }, quality: { status: telemetry || observation || window ? "LIMITED" : "BLOCKING", quality_flags: [], blocking_reasons: telemetry || observation || window ? ["STATE_DERIVED_PENDING"] : ["SENSING_SOURCE_MISSING"], confidence_penalty: null }, latest_update_time: null, state_refs: [], evidence_refs: [], summary_text: "H53.1 只展示 RawSignal / Observation；不从 seed 写入水分状态、建议、执行或验收。" },
    lineage: { raw_signals: [raw], observations: [obs, sensingWindow], state_estimates: [state], evidence: [evidence], verifications: [verification] },
    water_stress_loop: { loop_id: "water_stress_loop_v1", label: "水分压力闭环", subtitle: "猎鹰 1 号", inputs: { soil_moisture: [raw, obs, sensingWindow], canopy_temperature: [], weather_forecast: [weatherInput], irrigation_event: [] }, water_stress_state: state, forecast, scenario, recommendation, approval, operation, ao_act: aoAct, as_executed: asExecuted, evidence, acceptance, verification, steps },
    source_inventory: sourceInventory(telemetry, observation, window, weather),
    quality: { status: telemetry && observation && window ? "LIMITED" : "BLOCKING", blocking_reason: telemetry && observation && window ? "STATE_DERIVED_PENDING" : "SENSING_SOURCE_MISSING", low_quality_reasons: [], simulation_data_present: false, official_data_qualified: Boolean(telemetry && observation && window) },
    gaps,
    boundary_rules: [boundary("NO_AO_ACT_TASK_CREATION", "H53.1 read model 不创建 AO-ACT task。"), boundary("NO_DISPATCH", "H53.1 read model 不派单。"), boundary("NO_APPROVAL_BYPASS", "H53.1 read model 不绕过人工审批。"), boundary("NO_RECOMMENDATION_SEED", "H53.1 sensing-only seed 不写建议候选。"), boundary("NO_ACCEPTANCE_SEED", "H53.1 sensing-only seed 不写验收。"), boundary("NO_FIELD_MEMORY_WRITE", "H53.1 不写 Field Memory。"), boundary("NO_ROI_WRITE", "H53.1 不写 ROI。")],
    legacy_conflict_policy: { canonical_routes: [`/app/operator/fields/${encodeURIComponent(scope.fieldId || "")}/evidence-twin`, `/app/operator/fields/${encodeURIComponent(scope.fieldId || "")}/evidence-twin/water-stress`], legacy_routes: [`/operator/twin/fields/${encodeURIComponent(scope.fieldId || "")}`], legacy_visible_by_url_only: true, delete_old_pages_first: false, route_governance_required: true },
  };
}

export function registerOperatorEvidenceTwinReadRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/fields/:fieldId/evidence-twin", async (req: any, reply) => {
    const fieldId = text(req.params?.fieldId);
    const scope = scopeFrom(req, fieldId);
    const devices = (await boundDevices(pool, scope)).map((row) => text(row.device_id)).filter(Boolean);
    const [field, telemetry, observation, window, weather] = await Promise.all([latestField(pool, scope), latestTelemetry(pool, scope, devices), latestObservation(pool, scope), latestWindow(pool, scope), latestWeather(pool, scope)]);
    const twin = buildTwin(scope, field, telemetry, observation, window, weather);
    return reply.send({ ok: true, source: "operator_evidence_twin_api", dataScope: DATA_SCOPE, surface: "OPERATOR", version: "v1", generated_at: new Date().toISOString(), writeReady: false, dispatchReady: false, approvalReady: false, taskCreationReady: false, memoryWriteReady: false, roiWriteReady: false, operator_evidence_twin_v1: twin });
  });
}
