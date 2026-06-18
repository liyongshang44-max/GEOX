// apps/server/src/routes/v1/operator_twin.ts
// Purpose: expose scoped, read-only Operator Twin Workbench projections.
// Boundary: these routes must not write facts, create recommendations, approve, dispatch, or create AO-ACT tasks.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const DATA_SCOPE = "OFFICIAL_OPERATOR_TWIN_API";

type Row = Record<string, any>;

type RequestScope = {
  tenantId: string | null;
  projectId: string | null;
  groupId: string | null;
  fieldId: string | null;
};

type TwinGap = {
  gap_code: string;
  label: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
};

type TwinBoundaryRule = {
  rule_code: string;
  label: string;
};

type TwinFieldRow = {
  field_id: string;
  field_name: string;
  crop_text: string;
  current_state_text: string;
  confidence_text: string;
  data_coverage_text: string;
  forecast_window_text: string;
  next_step_text: string;
  twin_href: string;
};

type TwinLayer = {
  layer: "Fact" | "Estimate" | "Forecast" | "Scenario" | "Recommendation";
  title: string;
  body: string;
  status: "AVAILABLE" | "LIMITED" | "NOT_AVAILABLE";
  evidence_refs: string[];
};

type TwinSource = {
  scope: RequestScope;
  fields: Row[];
  waterByField: Map<string, Row>;
  sensingByField: Map<string, Row>;
  weatherByField: Map<string, Row>;
  scenarioByField: Map<string, Row>;
  recommendationByField: Map<string, Row>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function basePayload(source: string): Row {
  return {
    ok: true,
    source,
    dataScope: DATA_SCOPE,
    generated_at: nowIso(),
    writeReady: false,
    dispatchReady: false,
    approvalReady: false,
    taskCreationReady: false,
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function safeText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  if (/token|secret|access[_-]?key|credential_payload|password|private\s*key/i.test(raw)) return "";
  return raw;
}

function nullableText(value: unknown): string | null {
  const raw = safeText(value);
  return raw || null;
}

function safeJson(value: unknown): any | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  const parsed = safeJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const raw = safeText(value);
    if (raw) return raw;
  }
  return "";
}

function firstValue(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function fieldIdOf(row: Row): string {
  return firstText(row.field_id, row.fieldId, row.target_field_id, row.subject_field_id, safeJson(row.context_json)?.field_id);
}

function tsNumber(row: Row): number {
  const candidates = [
    row.updated_ts_ms,
    row.created_ts_ms,
    row.computed_ts_ms,
    row.generated_ts_ms,
    row.occurred_ts_ms,
    row.updated_at,
    row.created_at,
    row.computed_at,
    row.generated_at,
    row.occurred_at,
  ];

  let best = 0;
  for (const value of candidates) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > best) {
      best = n;
      continue;
    }
    const d = new Date(String(value));
    if (Number.isFinite(d.getTime()) && d.getTime() > best) best = d.getTime();
  }
  return best;
}

function identifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error("UNSAFE_SQL_IDENTIFIER");
  }
  return name;
}

function queryValue(req: any, key: string): unknown {
  return req?.query?.[key] ?? req?.query?.[key.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())];
}

function headerValue(req: any, key: string): unknown {
  return req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()];
}

function extractRequestScope(req: any, fieldIdFromPath?: string | null): RequestScope {
  const user = req?.user ?? req?.auth ?? req?.principal ?? {};
  return {
    tenantId: nullableText(
      firstValue(
        user.tenant_id,
        user.tenantId,
        queryValue(req, "tenant_id"),
        queryValue(req, "tenantId"),
        headerValue(req, "x-tenant-id")
      )
    ),
    projectId: nullableText(
      firstValue(
        user.project_id,
        user.projectId,
        queryValue(req, "project_id"),
        queryValue(req, "projectId"),
        headerValue(req, "x-project-id")
      )
    ),
    groupId: nullableText(
      firstValue(
        user.group_id,
        user.groupId,
        queryValue(req, "group_id"),
        queryValue(req, "groupId"),
        headerValue(req, "x-group-id")
      )
    ),
    fieldId: nullableText(fieldIdFromPath ?? queryValue(req, "field_id") ?? queryValue(req, "fieldId")),
  };
}

function hasTenantScope(scope: RequestScope): boolean {
  return Boolean(scope.tenantId || scope.projectId || scope.groupId);
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool
    .query("SELECT to_regclass($1)::text AS name", ["public." + table])
    .catch(() => ({ rows: [{ name: null }] as Row[] }));
  return Boolean(result.rows?.[0]?.name);
}

async function readColumns(pool: Pool, table: string): Promise<Set<string>> {
  const result = await pool
    .query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [table]
    )
    .catch(() => ({ rows: [] as Row[] }));
  return new Set((result.rows ?? []).map((row) => String(row.column_name)));
}

async function readRows(pool: Pool, table: string, scope: RequestScope, limit = 500): Promise<Row[]> {
  if (!hasTenantScope(scope)) return [];
  if (!(await tableExists(pool, table))) return [];

  const columns = await readColumns(pool, table);
  const scopedColumns = ["tenant_id", "project_id", "group_id"].filter((column) => columns.has(column));
  if (scopedColumns.length === 0) return [];

  const clauses: string[] = [];
  const values: unknown[] = [];

  const scopePairs: Array<[string, string | null]> = [
    ["tenant_id", scope.tenantId],
    ["project_id", scope.projectId],
    ["group_id", scope.groupId],
  ];

  for (const [column, value] of scopePairs) {
    if (!value) continue;
    if (!columns.has(column)) continue;
    values.push(value);
    clauses.push(identifier(column) + " = $" + values.length);
  }

  if (!clauses.length) return [];

  if (scope.fieldId && columns.has("field_id")) {
    values.push(scope.fieldId);
    clauses.push("field_id = $" + values.length);
  }

  values.push(limit);
  const sql = "SELECT * FROM " + identifier(table) + " WHERE " + clauses.join(" AND ") + " LIMIT $" + values.length;
  const result = await pool.query(sql, values).catch(() => ({ rows: [] as Row[] }));
  return result.rows ?? [];
}

function latestByField(rows: Row[]): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const row of rows) {
    const fieldId = fieldIdOf(row);
    if (!fieldId) continue;
    const previous = result.get(fieldId);
    if (!previous || tsNumber(row) >= tsNumber(previous)) result.set(fieldId, row);
  }
  return result;
}

function collectEvidenceRefs(row: Row | null | undefined): string[] {
  if (!row) return [];
  const refs = [
    row.source_fact_id,
    row.fact_id,
    row.evidence_ref,
    row.evidence_id,
    row.sensing_window_id,
    row.forecast_id,
    row.scenario_set_id,
    row.recommendation_id,
  ];
  const jsonRefs = asArray(row.evidence_refs_json ?? row.evidence_refs);
  for (const item of jsonRefs) {
    if (typeof item === "string") refs.push(item);
    else if (item && typeof item === "object") refs.push(item.ref_id ?? item.id ?? item.fact_id);
  }
  return [...new Set(refs.map((value) => safeText(value)).filter(Boolean))].slice(0, 10);
}

function confidenceText(row: Row | null | undefined): string {
  if (!row) return "置信度待确认";
  const confidenceJson = safeJson(row.confidence_json ?? row.confidence);
  const level = firstText(row.confidence_level, row.confidence_text, confidenceJson?.level, confidenceJson?.confidence_level);
  const score = firstText(row.confidence_score, confidenceJson?.score);
  if (level && score) return level + " / " + score;
  if (level) return level;
  if (score) return "score " + score;
  return "置信度待确认";
}

function waterStateText(row: Row | null | undefined): string {
  if (!row) return "水分状态待确认";
  const stateJson = safeJson(row.state_json ?? row.estimate_json ?? row.response_json);
  const state = firstText(row.water_state, row.state, row.status, row.estimate_state, stateJson?.water_state, stateJson?.state);
  if (!state) return "水分状态待确认";
  if (state === "MODERATE_DEFICIT") return "水分状态：中度缺水";
  if (state === "LIGHT_DEFICIT") return "水分状态：轻度缺水";
  if (state === "NORMAL") return "水分状态：正常";
  if (state === "UNKNOWN") return "水分状态待确认";
  return "水分状态：" + state;
}

function dataCoverageText(sensing: Row | null | undefined, weather: Row | null | undefined): string {
  if (sensing && weather) return "土壤水分窗口与天气版本可用于灌溉判断";
  if (sensing) return "土壤水分窗口可用，天气版本待确认";
  if (weather) return "天气版本可用，土壤水分窗口待确认";
  return "数据覆盖待确认";
}

function defaultDataGaps(hasScenario: boolean): TwinGap[] {
  const gaps: TwinGap[] = [
    { gap_code: "SEVEN_DAY_FORECAST_RUN_MISSING", label: "7 天风险预测尚未作为正式 forecast_run_v1 固化", severity: "INFO" },
    { gap_code: "THIRTY_DAY_TREND_MISSING", label: "30 天趋势尚未建模", severity: "INFO" },
    { gap_code: "NITROGEN_DISEASE_ECONOMICS_MISSING", label: "氮素状态、病害风险、经济比较尚未接入", severity: "INFO" },
    { gap_code: "SUBMIT_SCENARIO_TO_RECOMMENDATION_NOT_OPEN", label: "Submit Scenario to Recommendation 尚未开放", severity: "INFO" },
  ];

  if (!hasScenario) {
    gaps.unshift({
      gap_code: "IRRIGATION_SCENARIO_SET_MISSING",
      label: "未找到 irrigation_scenario_set_index_v1 证据，情景比较不可用",
      severity: "WARNING",
    });
  }

  return gaps;
}

function defaultBoundaryRules(): TwinBoundaryRule[] {
  return [
    { rule_code: "NO_AO_ACT_TASK_CREATION", label: "本页面不创建 AO-ACT task" },
    { rule_code: "NO_DISPATCH", label: "本页面不 dispatch" },
    { rule_code: "NO_APPROVAL_BYPASS", label: "本页面不绕过 approval" },
    { rule_code: "FORECAST_IS_NOT_FACT", label: "Forecast 不能当作 Fact" },
    { rule_code: "SCENARIO_IS_NOT_TASK", label: "Scenario 不能当作 Task" },
    { rule_code: "NO_ACTION_BASELINE_REQUIRED", label: "no_action baseline 后续情景比较必须由真实 scenario 证据提供" },
  ];
}

function scenarioOptions(row: Row | null | undefined): Row[] {
  if (!row) return [];
  const direct = asArray(row.options_json ?? row.options ?? row.scenario_options_json ?? row.scenarios_json);
  if (direct.length > 0) return direct;
  const payload = safeJson(row.payload_json ?? row.raw_payload ?? row.record_json);
  const payloadOptions = asArray(payload?.options ?? payload?.scenario_options);
  return payloadOptions.length > 0 ? payloadOptions : [];
}

function optionId(option: Row): string {
  return firstText(option.option_id, option.id, option.scenario_id, option.action_type, option.label);
}

function hasNoActionBaseline(options: Row[]): boolean {
  return options.some((option) => optionId(option) === "no_action");
}

function suggestedActionPayload(row: Row | null | undefined): Row | null {
  if (!row) return null;
  const direct = safeJson(row.suggested_action_json ?? row.suggested_action);
  if (direct) return direct;

  const payload = safeJson(row.payload_json ?? row.raw_payload ?? row.record_json);
  const nested = safeJson(payload?.suggested_action_json ?? payload?.suggested_action);
  if (nested) return nested;

  if (payload && typeof payload.suggested_action === "object") return payload.suggested_action;
  return null;
}

function recommendationActionType(row: Row | null | undefined): string | null {
  const suggested = suggestedActionPayload(row);
  return nullableText(
    firstValue(
      row?.action_type,
      row?.recommended_action_type,
      row?.recommendation_action_type,
      suggested?.action_type,
      suggested?.actionType,
      suggested?.type
    )
  );
}

function recommendationAmountMm(row: Row | null | undefined): number | string | null {
  const suggested = suggestedActionPayload(row);
  const value = firstValue(
    row?.amount_mm,
    row?.recommended_amount_mm,
    row?.irrigation_amount_mm,
    suggested?.amount_mm,
    suggested?.amountMm,
    suggested?.irrigation_mm,
    suggested?.water_mm
  );

  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : safeText(value);
}

function buildLayers(input: {
  sensing: Row | null;
  weather: Row | null;
  waterState: Row | null;
  scenario: Row | null;
  recommendation: Row | null;
}): TwinLayer[] {
  return [
    {
      layer: "Fact",
      title: "事实",
      body: input.sensing || input.weather
        ? "土壤水分观测窗口、天气预报版本和作业记录来自正式后端事实链。"
        : "当前缺少可用于 Twin 工作区的正式事实窗口。",
      status: input.sensing || input.weather ? "AVAILABLE" : "LIMITED",
      evidence_refs: [...collectEvidenceRefs(input.sensing), ...collectEvidenceRefs(input.weather)].slice(0, 10),
    },
    {
      layer: "Estimate",
      title: "估计",
      body: waterStateText(input.waterState),
      status: input.waterState ? "AVAILABLE" : "LIMITED",
      evidence_refs: collectEvidenceRefs(input.waterState),
    },
    {
      layer: "Forecast",
      title: "预测",
      body: "短期预测窗口可展示能力边界；7d/30d 仍需后续 forecast_run_v1 固化。",
      status: "LIMITED",
      evidence_refs: collectEvidenceRefs(input.weather),
    },
    {
      layer: "Scenario",
      title: "情景",
      body: input.scenario
        ? "情景比较必须包含真实 no_action baseline，并只能进入 recommendation / approval 链路。"
        : "未找到情景证据，不能展示默认或虚构情景。",
      status: input.scenario ? "AVAILABLE" : "NOT_AVAILABLE",
      evidence_refs: collectEvidenceRefs(input.scenario),
    },
    {
      layer: "Recommendation",
      title: "建议候选",
      body: input.recommendation
        ? "存在建议候选；建议候选只能进入 recommendation / approval 链路，不能直接成为 AO-ACT task。"
        : "建议候选待确认；页面不自动生成 recommendation。",
      status: input.recommendation ? "AVAILABLE" : "LIMITED",
      evidence_refs: collectEvidenceRefs(input.recommendation),
    },
  ];
}

async function buildTwinSource(pool: Pool, scope: RequestScope): Promise<TwinSource> {
  const [fields, water, sensing, weather, scenarios, recommendations] = await Promise.all([
    readRows(pool, "field_index_v1", scope, 500),
    readRows(pool, "water_state_estimate_index_v1", scope, 500),
    readRows(pool, "soil_moisture_sensing_window_index_v1", scope, 500),
    readRows(pool, "weather_forecast_index_v1", scope, 500),
    readRows(pool, "irrigation_scenario_set_index_v1", scope, 500),
    readRows(pool, "decision_recommendation_index_v1", scope, 500),
  ]);

  return {
    scope,
    fields,
    waterByField: latestByField(water),
    sensingByField: latestByField(sensing),
    weatherByField: latestByField(weather),
    scenarioByField: latestByField(scenarios),
    recommendationByField: latestByField(recommendations),
  };
}

function fieldIdsFromSource(source: TwinSource): string[] {
  const ids = new Set<string>();
  for (const row of source.fields) {
    const id = fieldIdOf(row);
    if (id) ids.add(id);
  }
  for (const map of [source.waterByField, source.sensingByField, source.weatherByField, source.scenarioByField, source.recommendationByField]) {
    for (const id of map.keys()) ids.add(id);
  }
  return [...ids].sort();
}

function fieldDisplayName(fieldId: string, fields: Row[]): string {
  const row = fields.find((item) => fieldIdOf(item) === fieldId);
  return firstText(row?.display_name, row?.field_name, row?.name, fieldId);
}

function cropText(fieldId: string, fields: Row[]): string {
  const row = fields.find((item) => fieldIdOf(item) === fieldId);
  return firstText(row?.crop, row?.crop_type, row?.crop_name, row?.season_crop, "作物阶段待确认");
}

function buildFieldRow(fieldId: string, source: TwinSource): TwinFieldRow {
  const water = source.waterByField.get(fieldId) ?? null;
  const sensing = source.sensingByField.get(fieldId) ?? null;
  const weather = source.weatherByField.get(fieldId) ?? null;
  const scenario = source.scenarioByField.get(fieldId) ?? null;
  const recommendation = source.recommendationByField.get(fieldId) ?? null;

  return {
    field_id: fieldId,
    field_name: fieldDisplayName(fieldId, source.fields),
    crop_text: cropText(fieldId, source.fields),
    current_state_text: waterStateText(water),
    confidence_text: confidenceText(water ?? recommendation ?? scenario),
    data_coverage_text: dataCoverageText(sensing, weather),
    forecast_window_text: "短期窗口可用；7d/30d 标记为未开放",
    next_step_text: recommendation ? "复核建议候选并进入人工确认" : "复核情景比较并进入人工确认",
    twin_href: "/operator/twin/fields/" + encodeURIComponent(fieldId),
  };
}

async function buildOverview(pool: Pool, scope: RequestScope): Promise<Row> {
  const source = await buildTwinSource(pool, scope);
  const fields = fieldIdsFromSource(source).map((fieldId) => buildFieldRow(fieldId, source));
  const hasAnyScenario = source.scenarioByField.size > 0;

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_TWIN_OVERVIEW",
    request_scope: scope,
    fields,
    data_gaps: defaultDataGaps(hasAnyScenario),
    boundary_rules: defaultBoundaryRules(),
    summary: {
      field_count: fields.length,
      write_ready: false,
      approval_ready: false,
      dispatch_ready: false,
      task_creation_ready: false,
    },
  };
}

async function buildFieldWorkspace(pool: Pool, scope: RequestScope, fieldId: string): Promise<Row> {
  const normalizedFieldId = safeText(fieldId);
  const fieldScope = { ...scope, fieldId: normalizedFieldId };
  const source = await buildTwinSource(pool, fieldScope);

  const sensing = source.sensingByField.get(normalizedFieldId) ?? null;
  const weather = source.weatherByField.get(normalizedFieldId) ?? null;
  const waterState = source.waterByField.get(normalizedFieldId) ?? null;
  const scenario = source.scenarioByField.get(normalizedFieldId) ?? null;
  const recommendation = source.recommendationByField.get(normalizedFieldId) ?? null;
  const options = scenarioOptions(scenario);
  const noActionBaselinePresent = scenario ? hasNoActionBaseline(options) : false;

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_WORKSPACE",
    request_scope: fieldScope,
    field_context: {
      field_id: normalizedFieldId,
      field_name: fieldDisplayName(normalizedFieldId, source.fields),
      crop_text: cropText(normalizedFieldId, source.fields),
    },
    current_state: {
      state_text: waterStateText(waterState),
      confidence_text: confidenceText(waterState),
      classification: "Estimate",
      evidence_refs: collectEvidenceRefs(waterState),
    },
    data_coverage: {
      coverage_text: dataCoverageText(sensing, weather),
      sensing_available: Boolean(sensing),
      weather_available: Boolean(weather),
      evidence_refs: [...collectEvidenceRefs(sensing), ...collectEvidenceRefs(weather)].slice(0, 10),
    },
    forecast_window: {
      available_horizon: "72h",
      forecast_horizon_limited: true,
      unavailable_horizons: ["7d", "30d", "60d"],
      reason: "LONG_RANGE_FORECAST_RUN_NOT_AVAILABLE",
    },
    scenario_comparison: {
      no_action_baseline_present: noActionBaselinePresent,
      options: options.map((option) => ({
        option_id: optionId(option),
        label: firstText(option.customer_label, option.label, optionId(option)),
        risk_delta: nullableText(option.risk_delta),
        confidence_text: nullableText(option.confidence_text ?? option.confidence),
        failure_conditions: asArray(option.failure_conditions ?? option.failure_conditions_json).map((item) => safeText(item)).filter(Boolean),
      })),
      evidence_refs: collectEvidenceRefs(scenario),
      status: scenario ? "AVAILABLE" : "NOT_AVAILABLE",
      unavailable_reason: scenario ? null : "IRRIGATION_SCENARIO_SET_MISSING",
    },
    recommendation_candidate: {
      recommendation_id: nullableText(recommendation?.recommendation_id ?? recommendation?.id),
      action_type: recommendationActionType(recommendation),
      amount_mm: recommendationAmountMm(recommendation),
      human_approval_required: true,
      no_direct_execution: true,
      evidence_refs: collectEvidenceRefs(recommendation),
    },
    layers: buildLayers({
      sensing,
      weather,
      waterState,
      scenario,
      recommendation,
    }),
    data_gaps: defaultDataGaps(Boolean(scenario)),
    boundary_rules: defaultBoundaryRules(),
  };
}

export function registerOperatorTwinReadRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/twin", async (req: any, reply) => {
    const scope = extractRequestScope(req);
    const overview = await buildOverview(pool, scope);
    return reply.send({
      ...basePayload("operator_twin_overview_api"),
      operator_twin_overview_v1: overview,
    });
  });

  app.get("/api/v1/operator/twin/fields/:field_id", async (req: any, reply) => {
    const fieldId = safeText(req.params?.field_id);
    const scope = extractRequestScope(req, fieldId);
    const workspace = await buildFieldWorkspace(pool, scope, fieldId);
    return reply.send({
      ...basePayload("operator_field_twin_workspace_api"),
      operator_field_twin_workspace_v1: workspace,
    });
  });
}
