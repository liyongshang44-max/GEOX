// apps/server/src/routes/v1/operator_twin.ts
// Purpose: expose scoped, read-only Operator Twin Workbench projections.
// Boundary: these routes must not write facts, create recommendations, approve, dispatch, or create AO-ACT tasks.

import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const DATA_SCOPE = "OFFICIAL_OPERATOR_TWIN_API";

const TENANT_SCOPE_COLUMNS = ["tenant_id", "project_id", "group_id"] as const;

const OPERATOR_TWIN_SCOPED_INDEX_TABLES = [
  "field_index_v1",
  "water_state_estimate_index_v1",
  "soil_moisture_sensing_window_index_v1",
  "weather_forecast_index_v1",
  "irrigation_scenario_set_index_v1",
  "decision_recommendation_index_v1",
] as const;

const SCOPE_REQUIRED_REASON = "TENANT_PROJECT_OR_GROUP_SCOPE_REQUIRED";

const TABLE_SCOPE_COLUMNS_REQUIRED_REASON =
  "INDEX_TABLE_SCOPE_COLUMNS_REQUIRED";

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
  risk_text: string;
  low_confidence: boolean;
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

type SourceIndexInventoryRow = {
  table_name: string;
  available: boolean;
  row_count: number;
  latest_ts_ms: number | null;
  latest_evidence_refs: string[];
  scope_columns_present: string[];
  missing_reason: string | null;
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
    memoryWriteReady: false,
    roiWriteReady: false,
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function safeText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  if (
    /token|secret|access[_-]?key|credential_payload|password|private\s*key/i.test(
      raw,
    )
  )
    return "";
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
    if (value !== undefined && value !== null && String(value).trim() !== "")
      return value;
  }
  return null;
}

function fieldIdOf(row: Row): string {
  return firstText(
    row.field_id,
    row.fieldId,
    row.target_field_id,
    row.subject_field_id,
    safeJson(row.context_json)?.field_id,
    safeJson(row.record_json)?.payload?.field_id,
    safeJson(row.record_json)?.entity?.field_id,
  );
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
  return (
    req?.query?.[key] ??
    req?.query?.[
      key.replace(/_([a-z])/g, (_match: string, letter: string) =>
        letter.toUpperCase(),
      )
    ]
  );
}

function headerValue(req: any, key: string): unknown {
  return req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()];
}

function extractRequestScope(
  req: any,
  fieldIdFromPath?: string | null,
): RequestScope {
  const user = req?.user ?? req?.auth ?? req?.principal ?? {};
  return {
    tenantId: nullableText(
      firstValue(
        user.tenant_id,
        user.tenantId,
        queryValue(req, "tenant_id"),
        queryValue(req, "tenantId"),
        headerValue(req, "x-tenant-id"),
      ),
    ),
    projectId: nullableText(
      firstValue(
        user.project_id,
        user.projectId,
        queryValue(req, "project_id"),
        queryValue(req, "projectId"),
        headerValue(req, "x-project-id"),
      ),
    ),
    groupId: nullableText(
      firstValue(
        user.group_id,
        user.groupId,
        queryValue(req, "group_id"),
        queryValue(req, "groupId"),
        headerValue(req, "x-group-id"),
      ),
    ),
    fieldId: nullableText(
      fieldIdFromPath ??
        queryValue(req, "field_id") ??
        queryValue(req, "fieldId"),
    ),
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
      [table],
    )
    .catch(() => ({ rows: [] as Row[] }));
  return new Set((result.rows ?? []).map((row) => String(row.column_name)));
}

async function readRows(
  pool: Pool,
  table: string,
  scope: RequestScope,
  limit = 500,
): Promise<Row[]> {
  if (!hasTenantScope(scope)) return [];
  if (!(await tableExists(pool, table))) return [];

  const columns = await readColumns(pool, table);
  const scopedColumns = TENANT_SCOPE_COLUMNS.filter((column) =>
    columns.has(column),
  );
  if (scopedColumns.length === 0) {
    void TABLE_SCOPE_COLUMNS_REQUIRED_REASON;
    return [];
  }

  const clauses: string[] = [];
  const values: unknown[] = [];

  const scopePairs: Array<
    [(typeof TENANT_SCOPE_COLUMNS)[number], string | null]
  > = [
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

  const orderExpression = latestTimestampOrderExpression(columns);
  const orderClause =
    orderExpression === "NULL::bigint"
      ? ""
      : " ORDER BY " + orderExpression + " DESC NULLS LAST";

  values.push(limit);
  const sql =
    "SELECT * FROM " +
    identifier(table) +
    " WHERE " +
    clauses.join(" AND ") +
    orderClause +
    " LIMIT $" +
    values.length;

  const result = await pool
    .query(sql, values)
    .catch(() => ({ rows: [] as Row[] }));
  return result.rows ?? [];
}

function latestByField(rows: Row[]): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const row of rows) {
    const fieldId = fieldIdOf(row);
    if (!fieldId) continue;
    const previous = result.get(fieldId);
    if (!previous || tsNumber(row) >= tsNumber(previous))
      result.set(fieldId, row);
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
    row.fact_id,
  ];
  const jsonRefs = asArray(row.evidence_refs_json ?? row.evidence_refs);
  for (const item of jsonRefs) {
    if (typeof item === "string") refs.push(item);
    else if (item && typeof item === "object")
      refs.push(item.ref_id ?? item.id ?? item.fact_id);
  }
  return [
    ...new Set(refs.map((value) => safeText(value)).filter(Boolean)),
  ].slice(0, 10);
}

function confidenceText(row: Row | null | undefined): string {
  if (!row) return "置信度待确认";
  const confidenceJson = safeJson(row.confidence_json ?? row.confidence);
  const level = firstText(
    row.confidence_level,
    row.confidence_text,
    confidenceJson?.level,
    confidenceJson?.confidence_level,
  );
  const score = firstText(row.confidence_score, confidenceJson?.score);
  if (level && score) return level + " / " + score;
  if (level) return level;
  if (score) return "score " + score;
  return "置信度待确认";
}

function isLowConfidence(row: Row | null | undefined): boolean {
  if (!row) return true;
  const confidenceJson = safeJson(row.confidence_json ?? row.confidence);
  const level = firstText(
    row.confidence_level,
    row.confidence_text,
    confidenceJson?.level,
    confidenceJson?.confidence_level,
  ).toUpperCase();
  const scoreValue = firstValue(row.confidence_score, confidenceJson?.score);
  const score =
    scoreValue === null || scoreValue === undefined ? NaN : Number(scoreValue);

  if (!level && !Number.isFinite(score)) return true;
  if (
    level.includes("PENDING") ||
    level.includes("UNKNOWN") ||
    level.includes("待确认")
  )
    return true;
  if (level.includes("LOW") || level.includes("低")) return true;
  if (Number.isFinite(score) && score < 0.6) return true;
  return false;
}

function riskText(
  water: Row | null | undefined,
  recommendation: Row | null | undefined,
  scenario: Row | null | undefined,
): string {
  const stateJson = safeJson(
    water?.state_json ?? water?.estimate_json ?? water?.response_json,
  );
  const state = firstText(
    water?.water_state,
    water?.state,
    water?.status,
    water?.estimate_state,
    stateJson?.water_state,
    stateJson?.state,
  ).toUpperCase();

  if (state === "MODERATE_DEFICIT") return "RISK: WATER_DEFICIT_MODERATE";
  if (state === "LIGHT_DEFICIT") return "RISK: WATER_DEFICIT_LIGHT";
  if (state === "NORMAL") return "RISK: NORMAL";

  if (recommendation) return "RISK: RECOMMENDATION_REVIEW_REQUIRED";
  if (scenario) return "RISK: SCENARIO_REVIEW_REQUIRED";
  return "RISK: DATA_GAP";
}

function waterStateText(row: Row | null | undefined): string {
  if (!row) return "水分状态待确认";
  const stateJson = safeJson(
    row.state_json ?? row.estimate_json ?? row.response_json,
  );
  const state = firstText(
    row.water_state,
    row.state,
    row.status,
    row.estimate_state,
    stateJson?.water_state,
    stateJson?.state,
  );
  if (!state) return "水分状态待确认";
  if (state === "MODERATE_DEFICIT") return "水分状态：中度缺水";
  if (state === "LIGHT_DEFICIT") return "水分状态：轻度缺水";
  if (state === "NORMAL") return "水分状态：正常";
  if (state === "UNKNOWN") return "水分状态待确认";
  return "水分状态：" + state;
}

function dataCoverageText(
  sensing: Row | null | undefined,
  weather: Row | null | undefined,
): string {
  if (sensing && weather) return "土壤水分窗口与天气版本可用于灌溉判断";
  if (sensing) return "土壤水分窗口可用，天气版本待确认";
  if (weather) return "天气版本可用，土壤水分窗口待确认";
  return "数据覆盖待确认";
}

function defaultDataGaps(hasScenario: boolean): TwinGap[] {
  const gaps: TwinGap[] = [
    {
      gap_code: "SEVEN_DAY_FORECAST_RUN_MISSING",
      label: "7 天风险预测尚未作为正式 forecast_run_v1 固化",
      severity: "INFO",
    },
    {
      gap_code: "THIRTY_DAY_TREND_MISSING",
      label: "30 天趋势尚未建模",
      severity: "INFO",
    },
    {
      gap_code: "NITROGEN_DISEASE_ECONOMICS_MISSING",
      label: "氮素状态、病害风险、经济比较尚未接入",
      severity: "INFO",
    },
    {
      gap_code: "SUBMIT_SCENARIO_TO_RECOMMENDATION_NOT_OPEN",
      label: "Submit Scenario to Recommendation 尚未开放",
      severity: "INFO",
    },
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
    {
      rule_code: "NO_ACTION_BASELINE_REQUIRED",
      label: "no_action baseline 后续情景比较必须由真实 scenario 证据提供",
    },
  ];
}

function scenarioOptions(row: Row | null | undefined): Row[] {
  if (!row) return [];
  const direct = asArray(
    row.options_json ??
      row.options ??
      row.scenario_options_json ??
      row.scenarios_json,
  );
  if (direct.length > 0) return direct;
  const payload = safeJson(
    row.payload_json ?? row.raw_payload ?? row.record_json,
  );
  const payloadOptions = asArray(payload?.options ?? payload?.scenario_options);
  return payloadOptions.length > 0 ? payloadOptions : [];
}

function optionId(option: Row): string {
  return firstText(
    option.option_id,
    option.id,
    option.scenario_id,
    option.action_type,
    option.label,
  );
}

function hasNoActionBaseline(options: Row[]): boolean {
  return options.some((option) => optionId(option) === "no_action");
}

function suggestedActionPayload(row: Row | null | undefined): Row | null {
  if (!row) return null;
  const direct = safeJson(row.suggested_action_json ?? row.suggested_action);
  if (direct) return direct;

  const payload = safeJson(
    row.payload_json ?? row.raw_payload ?? row.record_json,
  );
  const nested = safeJson(
    payload?.suggested_action_json ?? payload?.suggested_action,
  );
  if (nested) return nested;

  if (payload && typeof payload.suggested_action === "object")
    return payload.suggested_action;
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
      suggested?.type,
    ),
  );
}

function recommendationAmountMm(
  row: Row | null | undefined,
): number | string | null {
  const suggested = suggestedActionPayload(row);
  const value = firstValue(
    row?.amount_mm,
    row?.recommended_amount_mm,
    row?.irrigation_amount_mm,
    suggested?.amount_mm,
    suggested?.amountMm,
    suggested?.irrigation_mm,
    suggested?.water_mm,
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
      body:
        input.sensing || input.weather
          ? "土壤水分观测窗口、天气预报版本和作业记录来自正式后端事实链。"
          : "当前缺少可用于 Twin 工作区的正式事实窗口。",
      status: input.sensing || input.weather ? "AVAILABLE" : "LIMITED",
      evidence_refs: [
        ...collectEvidenceRefs(input.sensing),
        ...collectEvidenceRefs(input.weather),
      ].slice(0, 10),
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

function forecastEvidenceRefs(workspace: Row): string[] {
  const refs = [
    ...asArray(workspace?.current_state?.evidence_refs),
    ...asArray(workspace?.data_coverage?.evidence_refs),
    ...asArray(workspace?.layers).flatMap((layer) =>
      asArray(layer?.evidence_refs),
    ),
  ];

  return [
    ...new Set(refs.map((value) => safeText(value)).filter(Boolean)),
  ].slice(0, 10);
}

function forecastRiskTimeline(workspace: Row): Row[] {
  const risk = firstText(workspace?.current_state?.risk_text, "RISK: DATA_GAP");
  const confidence = firstText(
    workspace?.current_state?.confidence_text,
    "置信度待确认",
  );
  const refs = forecastEvidenceRefs(workspace);
  const unavailableHorizons = asArray(
    workspace?.forecast_window?.unavailable_horizons,
  )
    .map((item) => safeText(item))
    .filter(Boolean);

  return [
    {
      horizon: "0-24h",
      risk_text: risk,
      confidence_text: confidence,
      evidence_refs: refs,
    },
    {
      horizon: "24-72h",
      risk_text: risk,
      confidence_text: confidence,
      evidence_refs: refs,
    },
    ...unavailableHorizons.map((horizon) => ({
      horizon,
      risk_text: "RISK: FORECAST_WINDOW_LIMITED",
      confidence_text: "预测窗口不可用",
      evidence_refs: refs,
    })),
  ];
}

async function buildFieldForecastPanel(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
): Promise<Row> {
  const workspace = await buildFieldWorkspace(pool, scope, fieldId);
  const forecastWindow = workspace.forecast_window ?? {};
  const evidenceRefs = forecastEvidenceRefs(workspace);

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_FORECAST_PANEL",
    request_scope: workspace.request_scope,
    scope_policy: workspace.scope_policy,
    field_context: workspace.field_context,
    forecast_window_v1: {
      available_horizon: firstText(forecastWindow.available_horizon, "72h"),
      forecast_horizon_limited: Boolean(
        forecastWindow.forecast_horizon_limited,
      ),
      unavailable_horizons: asArray(forecastWindow.unavailable_horizons)
        .map((item) => safeText(item))
        .filter(Boolean),
      reason: firstText(
        forecastWindow.reason,
        "LONG_RANGE_FORECAST_RUN_NOT_AVAILABLE",
      ),
      evidence_refs: evidenceRefs,
      risk_timeline: forecastRiskTimeline(workspace),
    },
    data_gaps: workspace.data_gaps,
    boundary_rules: defaultBoundaryRules(),
  };
}

async function buildFieldScenarioCompare(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
): Promise<Row> {
  const workspace = await buildFieldWorkspace(pool, scope, fieldId);
  const scenarioComparison = workspace.scenario_comparison ?? {};
  const noActionBaselinePresent = Boolean(
    scenarioComparison.no_action_baseline_present,
  );
  const options = asArray(scenarioComparison.options).map((option) => ({
    option_id: firstText(option.option_id, option.id, option.label),
    label: firstText(option.label, option.option_id, option.id),
    risk_delta: nullableText(option.risk_delta),
    confidence_text: nullableText(option.confidence_text),
    failure_conditions: asArray(option.failure_conditions)
      .map((item) => safeText(item))
      .filter(Boolean),
  }));
  const scenarioCompareAvailable =
    noActionBaselinePresent && options.length > 0;
  const unavailableReason = scenarioCompareAvailable
    ? nullableText(scenarioComparison.unavailable_reason)
    : firstText(
        scenarioComparison.unavailable_reason,
        "NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE",
      );

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_SCENARIO_COMPARE",
    request_scope: workspace.request_scope,
    scope_policy: workspace.scope_policy,
    field_context: workspace.field_context,
    scenario_compare_v1: {
      scenario_set_id: nullableText(scenarioComparison.scenario_set_id),
      no_action_baseline_present: noActionBaselinePresent,
      options,
      evidence_refs: asArray(scenarioComparison.evidence_refs)
        .map((item) => safeText(item))
        .filter(Boolean),
      status: scenarioCompareAvailable ? "AVAILABLE" : "NOT_AVAILABLE",
      unavailable_reason: unavailableReason,
    },
    data_gaps: workspace.data_gaps,
    boundary_rules: defaultBoundaryRules(),
  };
}

function isNoActionOption(option: Row): boolean {
  const id = optionId(option).toLowerCase();
  const action = firstText(
    option.action_type,
    option.kind,
    option.type,
    option.label,
  ).toLowerCase();
  return (
    id === "no_action" ||
    action === "no_action" ||
    id.includes("no action") ||
    action.includes("no action")
  );
}

function scenarioSetIdOf(row: Row | null | undefined): string {
  if (!row) return "";
  const payload =
    safeJson(row.payload_json ?? row.raw_payload ?? row.record_json) ?? {};
  return firstText(
    row.scenario_set_id,
    row.id,
    payload.scenario_set_id,
    payload.id,
  );
}

function rowScopeValue(row: Row, key: string): string {
  const payload =
    safeJson(row.payload_json ?? row.raw_payload ?? row.record_json) ?? {};
  return firstText(row[key], payload[key]);
}

function scenarioAvailable(row: Row): boolean {
  const status = firstText(
    row.status,
    row.availability_status,
    row.scenario_status,
    safeJson(row.payload_json ?? row.raw_payload ?? row.record_json)?.status,
  ).toUpperCase();
  return !["UNKNOWN", "BLOCKED", "NOT_AVAILABLE"].includes(status);
}

function evidenceQualityBlocking(row: Row, option: Row): boolean {
  const blob = JSON.stringify({ row, option }).toUpperCase();
  return (
    blob.includes("EVIDENCE_QUALITY_BLOCKING") ||
    blob.includes('"BLOCKING"') ||
    blob.includes("QUALITY_STATUS_BLOCKING")
  );
}

async function latestScenarioSetById(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
  scenarioSetId: string,
): Promise<Row | null> {
  if (!scope.tenantId) return null;
  if (!(await tableExists(pool, "irrigation_scenario_set_index_v1"))) return null;
  const result = await pool
    .query(
      `SELECT *
         FROM irrigation_scenario_set_index_v1
        WHERE tenant_id = $1
          AND field_id = $2
          AND scenario_set_id = $3
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1`,
      [scope.tenantId, fieldId, scenarioSetId],
    )
    .catch(() => ({ rows: [] as Row[] }));
  return result.rows?.[0] ?? null;
}

async function latestSubmissionByIdempotencyKey(
  pool: Pool,
  tenantId: string,
  key: string,
): Promise<Row | null> {
  if (!key || !(await tableExists(pool, "facts"))) return null;
  const result = await pool
    .query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operator_scenario_recommendation_submission_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,idempotency_key}') = $2
      ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`,
      [tenantId, key],
    )
    .catch(() => ({ rows: [] as Row[] }));
  return result.rows?.[0] ?? null;
}

async function insertOperatorScenarioRecommendationFacts(
  pool: Pool,
  submission: Row,
  recommendation: Row,
): Promise<{ submissionFactId: string; recommendationFactId: string }> {
  const occurredAt = nowIso();
  const submissionFactId = "fact_" + randomUUID();
  const recommendationFactId = "fact_" + randomUUID();
  await pool.query("BEGIN");
  try {
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)",
      [
        submissionFactId,
        occurredAt,
        "operator_scenario_recommendation_submission_api",
        JSON.stringify({
          type: "operator_scenario_recommendation_submission_v1",
          payload: submission,
        }),
      ],
    );
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)",
      [
        recommendationFactId,
        occurredAt,
        "operator_scenario_recommendation_submission_api",
        JSON.stringify({
          type: "decision_recommendation_v1",
          payload: recommendation,
        }),
      ],
    );
    await pool.query("COMMIT");
    return { submissionFactId, recommendationFactId };
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function buildOperatorScenarioRecommendationSubmission(
  pool: Pool,
  params: {
    fieldId: string;
    scenarioSetId: string;
    optionId: string;
    body: Row;
    req: any;
  },
): Promise<Row> {
  const body = params.body ?? {};
  const scope: RequestScope = {
    tenantId: nullableText(body.tenant_id),
    projectId: nullableText(body.project_id),
    groupId: nullableText(body.group_id),
    fieldId: params.fieldId,
  };
  const base = {
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
  };
  const reject = (status: string, extra: Row = {}) => ({
    version: "v1",
    surface: "OPERATOR",
    submission_id: "",
    field_id: params.fieldId,
    scenario_set_id: params.scenarioSetId,
    selected_option_id: params.optionId,
    recommendation_id: null,
    status,
    evidence_refs: [],
    boundary_rules: defaultBoundaryRules(),
    ...base,
    ...extra,
  });
  if (!scope.tenantId || !scope.projectId || !scope.groupId)
    return reject("REJECTED_SCOPE_MISMATCH");

  const duplicate = await latestSubmissionByIdempotencyKey(
    pool,
    scope.tenantId,
    safeText(body.idempotency_key),
  );
  if (duplicate?.record_json?.payload)
    return {
      ...duplicate.record_json.payload,
      status: "REJECTED_DUPLICATE",
      duplicate: true,
    };

  const fields = await readRows(pool, "field_index_v1", scope, 20);
  if (!fields.some((row) => fieldIdOf(row) === params.fieldId))
    return reject("REJECTED_SCOPE_MISMATCH");
  const scenario = await latestScenarioSetById(
    pool,
    scope,
    params.fieldId,
    params.scenarioSetId,
  );
  if (!scenario) return reject("REJECTED_SCENARIO_NOT_FOUND");
  if (
    rowScopeValue(scenario, "tenant_id") &&
    rowScopeValue(scenario, "tenant_id") !== scope.tenantId
  )
    return reject("REJECTED_SCOPE_MISMATCH");
  if (
    rowScopeValue(scenario, "project_id") &&
    rowScopeValue(scenario, "project_id") !== scope.projectId
  )
    return reject("REJECTED_SCOPE_MISMATCH");
  if (
    rowScopeValue(scenario, "group_id") &&
    rowScopeValue(scenario, "group_id") !== scope.groupId
  )
    return reject("REJECTED_SCOPE_MISMATCH");
  if (!scenarioAvailable(scenario))
    return reject("REJECTED_SCENARIO_NOT_FOUND");
  const option = scenarioOptions(scenario).find(
    (item) => optionId(item) === params.optionId,
  );
  if (!option) return reject("REJECTED_OPTION_NOT_FOUND");
  if (isNoActionOption(option)) return reject("REJECTED_NO_ACTION");
  if (evidenceQualityBlocking(scenario, option))
    return reject("REJECTED_EVIDENCE_BLOCKING");
  const evidenceRefs = [
    ...new Set([
      ...collectEvidenceRefs(scenario),
      ...collectEvidenceRefs(option),
    ]),
  ];
  if (evidenceRefs.length === 0) return reject("REJECTED_EVIDENCE_BLOCKING");

  const submissionId = "sub_" + randomUUID();
  const recommendationId = "rec_" + randomUUID();
  const recommendation = {
    version: "v1",
    recommendation_id: recommendationId,
    tenant_id: scope.tenantId,
    project_id: scope.projectId,
    group_id: scope.groupId,
    field_id: params.fieldId,
    scenario_set_id: params.scenarioSetId,
    selected_option_id: params.optionId,
    source: "OPERATOR_SCENARIO_SELECTION",
    status: "CANDIDATE",
    human_approval_required: true,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    quality: {
      source: "OPERATOR_SCENARIO_SELECTION",
      evidence_quality_blocking: false,
    },
    derivation: { scenario_derived: true, no_direct_execution: true },
    evidence_refs: evidenceRefs,
    created_at: nowIso(),
  };
  const submission = {
    version: "v1",
    surface: "OPERATOR",
    submission_id: submissionId,
    tenant_id: scope.tenantId,
    project_id: scope.projectId,
    group_id: scope.groupId,
    operator_id: safeText(body.operator_id),
    submission_reason: safeText(body.submission_reason),
    idempotency_key: safeText(body.idempotency_key),
    field_id: params.fieldId,
    scenario_set_id: params.scenarioSetId,
    selected_option_id: params.optionId,
    recommendation_id: recommendationId,
    status: "SUBMITTED_TO_RECOMMENDATION",
    ...base,
    evidence_refs: evidenceRefs,
    boundary_rules: defaultBoundaryRules(),
    decision_recommendation_v1: recommendation,
  };
  const factIds = await insertOperatorScenarioRecommendationFacts(
    pool,
    submission,
    recommendation,
  );
  return {
    ...submission,
    fact_id: factIds.submissionFactId,
    recommendation_fact_id: factIds.recommendationFactId,
  };
}

function tableDisplayLabel(tableName: string): string {
  if (tableName === "field_index_v1") return "Field Index";
  if (tableName === "water_state_estimate_index_v1")
    return "Water State Estimate";
  if (tableName === "soil_moisture_sensing_window_index_v1")
    return "Soil Moisture Sensing Window";
  if (tableName === "weather_forecast_index_v1") return "Weather Forecast";
  if (tableName === "irrigation_scenario_set_index_v1")
    return "Irrigation Scenario Set";
  if (tableName === "decision_recommendation_index_v1")
    return "Decision Recommendation";
  return tableName;
}

const INVENTORY_FRESHNESS_COLUMN_CANDIDATES = [
  "updated_ts_ms",
  "created_ts_ms",
  "computed_ts_ms",
  "generated_ts_ms",
  "occurred_ts_ms",
  "updated_at",
  "created_at",
  "computed_at",
  "generated_at",
  "occurred_at",
] as const;

function timestampValueExpression(column: string): string {
  const safeColumn = identifier(column);

  if (column.endsWith("_ts_ms")) {
    return safeColumn + "::bigint";
  }

  return "FLOOR(EXTRACT(EPOCH FROM " + safeColumn + ") * 1000)::bigint";
}

function latestTimestampValueExpression(columns: Set<string>): string {
  for (const column of INVENTORY_FRESHNESS_COLUMN_CANDIDATES) {
    if (columns.has(column)) return timestampValueExpression(column);
  }

  return "NULL::bigint";
}

function latestTimestampExpression(columns: Set<string>): string {
  const expression = latestTimestampValueExpression(columns);

  if (expression === "NULL::bigint") return expression;

  return "MAX(" + expression + ")::bigint";
}

function latestTimestampOrderExpression(columns: Set<string>): string {
  return latestTimestampValueExpression(columns);
}

async function countScopedRows(
  pool: Pool,
  table: string,
  scope: RequestScope,
): Promise<{
  rowCount: number;
  latestTsMs: number | null;
  scopeColumnsPresent: string[];
  missingReason: string | null;
}> {
  if (!hasTenantScope(scope)) {
    return {
      rowCount: 0,
      latestTsMs: null,
      scopeColumnsPresent: [],
      missingReason: SCOPE_REQUIRED_REASON,
    };
  }

  if (!(await tableExists(pool, table))) {
    return {
      rowCount: 0,
      latestTsMs: null,
      scopeColumnsPresent: [],
      missingReason: "SOURCE_INDEX_TABLE_NOT_FOUND",
    };
  }

  const columns = await readColumns(pool, table);
  const scopedColumns = TENANT_SCOPE_COLUMNS.filter((column) =>
    columns.has(column),
  );

  if (scopedColumns.length === 0) {
    return {
      rowCount: 0,
      latestTsMs: null,
      scopeColumnsPresent: [],
      missingReason: TABLE_SCOPE_COLUMNS_REQUIRED_REASON,
    };
  }

  const clauses: string[] = [];
  const values: unknown[] = [];

  const scopePairs: Array<
    [(typeof TENANT_SCOPE_COLUMNS)[number], string | null]
  > = [
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

  if (scope.fieldId && columns.has("field_id")) {
    values.push(scope.fieldId);
    clauses.push("field_id = $" + values.length);
  }

  if (!clauses.length) {
    return {
      rowCount: 0,
      latestTsMs: null,
      scopeColumnsPresent: [...scopedColumns],
      missingReason: SCOPE_REQUIRED_REASON,
    };
  }

  const sql =
    "SELECT COUNT(*)::int AS row_count, " +
    latestTimestampExpression(columns) +
    " AS latest_ts_ms FROM " +
    identifier(table) +
    " WHERE " +
    clauses.join(" AND ");

  const result = await pool
    .query(sql, values)
    .catch(() => ({ rows: [] as Row[] }));
  const row = result.rows?.[0] ?? {};
  const rowCount = Number(row.row_count ?? 0);
  const latest =
    row.latest_ts_ms === null || row.latest_ts_ms === undefined
      ? null
      : Number(row.latest_ts_ms);

  return {
    rowCount: Number.isFinite(rowCount) ? rowCount : 0,
    latestTsMs: Number.isFinite(latest) ? latest : null,
    scopeColumnsPresent: [...scopedColumns],
    missingReason: null,
  };
}

async function buildSourceIndexInventory(
  pool: Pool,
  scope: RequestScope,
): Promise<Row> {
  const rows: SourceIndexInventoryRow[] = [];

  for (const tableName of OPERATOR_TWIN_SCOPED_INDEX_TABLES) {
    const summary = await countScopedRows(pool, tableName, scope);
    const latestRows = await readRows(pool, tableName, scope, 3);
    const evidenceRefs = latestRows
      .flatMap((row) => collectEvidenceRefs(row))
      .filter(Boolean);

    rows.push({
      table_name: tableName,
      available: summary.rowCount > 0,
      row_count: summary.rowCount,
      latest_ts_ms: summary.latestTsMs,
      latest_evidence_refs: [...new Set(evidenceRefs)].slice(0, 10),
      scope_columns_present: summary.scopeColumnsPresent,
      missing_reason: summary.missingReason,
    });
  }

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
    request_scope: scope,
    scope_policy: {
      required: true,
      accepted_scope_keys: [...TENANT_SCOPE_COLUMNS],
      scope_applied: hasTenantScope(scope),
      missing_reason: hasTenantScope(scope) ? null : SCOPE_REQUIRED_REASON,
      index_tables: [...OPERATOR_TWIN_SCOPED_INDEX_TABLES],
    },
    source_indexes: rows.map((row) => ({
      ...row,
      label: tableDisplayLabel(row.table_name),
    })),
    summary: {
      table_count: rows.length,
      available_table_count: rows.filter((row) => row.available).length,
      total_row_count: rows.reduce((sum, row) => sum + row.row_count, 0),
      write_ready: false,
      approval_ready: false,
      dispatch_ready: false,
      task_creation_ready: false,
    },
    boundary_rules: defaultBoundaryRules(),
  };
}
async function buildTwinSource(
  pool: Pool,
  scope: RequestScope,
): Promise<TwinSource> {
  const [fields, water, sensing, weather, scenarios, recommendations] =
    await Promise.all([
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
  for (const map of [
    source.waterByField,
    source.sensingByField,
    source.weatherByField,
    source.scenarioByField,
    source.recommendationByField,
  ]) {
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
  return firstText(
    row?.crop,
    row?.crop_type,
    row?.crop_name,
    row?.season_crop,
    "作物阶段待确认",
  );
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
    risk_text: riskText(water, recommendation, scenario),
    confidence_text: confidenceText(water ?? recommendation ?? scenario),
    low_confidence: isLowConfidence(water ?? recommendation ?? scenario),
    data_coverage_text: dataCoverageText(sensing, weather),
    forecast_window_text: "短期窗口可用；7d/30d 标记为未开放",
    next_step_text: recommendation
      ? "复核建议候选并进入人工确认"
      : "复核情景比较并进入人工确认",
    twin_href: "/operator/twin/fields/" + encodeURIComponent(fieldId),
  };
}

async function buildOverview(pool: Pool, scope: RequestScope): Promise<Row> {
  const source = await buildTwinSource(pool, scope);
  const fields = fieldIdsFromSource(source).map((fieldId) =>
    buildFieldRow(fieldId, source),
  );
  const hasAnyScenario = source.scenarioByField.size > 0;

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_TWIN_OVERVIEW",
    request_scope: scope,
    scope_policy: {
      required: true,
      accepted_scope_keys: [...TENANT_SCOPE_COLUMNS],
      scope_applied: hasTenantScope(scope),
      missing_reason: hasTenantScope(scope) ? null : SCOPE_REQUIRED_REASON,
      index_tables: [...OPERATOR_TWIN_SCOPED_INDEX_TABLES],
    },
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

async function buildFieldWorkspace(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
): Promise<Row> {
  const normalizedFieldId = safeText(fieldId);
  const fieldScope = { ...scope, fieldId: normalizedFieldId };
  const source = await buildTwinSource(pool, fieldScope);

  const sensing = source.sensingByField.get(normalizedFieldId) ?? null;
  const weather = source.weatherByField.get(normalizedFieldId) ?? null;
  const waterState = source.waterByField.get(normalizedFieldId) ?? null;
  const scenario = source.scenarioByField.get(normalizedFieldId) ?? null;
  const recommendation =
    source.recommendationByField.get(normalizedFieldId) ?? null;
  const options = scenarioOptions(scenario);
  const noActionBaselinePresent = scenario
    ? hasNoActionBaseline(options)
    : false;

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_WORKSPACE",
    request_scope: fieldScope,
    scope_policy: {
      required: true,
      accepted_scope_keys: [...TENANT_SCOPE_COLUMNS],
      scope_applied: hasTenantScope(fieldScope),
      missing_reason: hasTenantScope(fieldScope) ? null : SCOPE_REQUIRED_REASON,
      index_tables: [...OPERATOR_TWIN_SCOPED_INDEX_TABLES],
      field_scope_required: true,
    },
    field_context: {
      field_id: normalizedFieldId,
      field_name: fieldDisplayName(normalizedFieldId, source.fields),
      crop_text: cropText(normalizedFieldId, source.fields),
    },
    current_state: {
      state_text: waterStateText(waterState),
      risk_text: riskText(waterState, recommendation, scenario),
      low_confidence: isLowConfidence(waterState),
      confidence_text: confidenceText(waterState),
      classification: "Estimate",
      evidence_refs: collectEvidenceRefs(waterState),
    },
    data_coverage: {
      coverage_text: dataCoverageText(sensing, weather),
      sensing_available: Boolean(sensing),
      weather_available: Boolean(weather),
      evidence_refs: [
        ...collectEvidenceRefs(sensing),
        ...collectEvidenceRefs(weather),
      ].slice(0, 10),
    },
    forecast_window: {
      available_horizon: "72h",
      forecast_horizon_limited: true,
      unavailable_horizons: ["7d", "30d", "60d"],
      reason: "LONG_RANGE_FORECAST_RUN_NOT_AVAILABLE",
    },
    scenario_comparison: {
      scenario_set_id: scenarioSetIdOf(scenario),
      no_action_baseline_present: noActionBaselinePresent,
      options: options.map((option) => ({
        option_id: optionId(option),
        label: firstText(option.customer_label, option.label, optionId(option)),
        risk_delta: nullableText(option.risk_delta),
        confidence_text: confidenceText(option),
        failure_conditions: asArray(
          option.failure_conditions ?? option.failure_conditions_json,
        )
          .map((item) => safeText(item))
          .filter(Boolean),
      })),
      evidence_refs: collectEvidenceRefs(scenario),
      status: scenario ? "AVAILABLE" : "NOT_AVAILABLE",
      unavailable_reason: scenario ? null : "IRRIGATION_SCENARIO_SET_MISSING",
    },
    recommendation_candidate: {
      recommendation_id: nullableText(
        recommendation?.recommendation_id ?? recommendation?.id,
      ),
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

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sourceQualityFlags(
  inventoryRow: Row,
  sourceRow: Row | null | undefined,
): string[] {
  const flags: string[] = [];

  if (!inventoryRow.available) {
    flags.push(firstText(inventoryRow.missing_reason, "NO_SCOPED_ROWS"));
  }

  if (!sourceRow) return [...new Set(flags)];

  const coverageRatio = numberOrNull(
    firstValue(sourceRow.coverage_ratio, sourceRow.coverageRatio),
  );
  const minCoverageRatio = numberOrNull(
    firstValue(sourceRow.min_coverage_ratio, sourceRow.minCoverageRatio),
  );
  if (
    coverageRatio !== null &&
    minCoverageRatio !== null &&
    coverageRatio < minCoverageRatio
  ) {
    flags.push("COVERAGE_RATIO_BELOW_MINIMUM");
  }

  const maxGapMs = numberOrNull(
    firstValue(sourceRow.max_gap_ms, sourceRow.maxGapMs),
  );
  const maxAllowedGapMs = numberOrNull(
    firstValue(sourceRow.max_allowed_gap_ms, sourceRow.maxAllowedGapMs),
  );
  if (
    maxGapMs !== null &&
    maxAllowedGapMs !== null &&
    maxGapMs > maxAllowedGapMs
  ) {
    flags.push("MAX_GAP_EXCEEDS_ALLOWED");
  }

  const qualityStatus = firstText(
    sourceRow.quality_status,
    sourceRow.qualityStatus,
  ).toUpperCase();
  if (
    qualityStatus &&
    !["OK", "PASS", "PASSED", "GOOD", "AVAILABLE", "QUALIFIED"].includes(
      qualityStatus,
    )
  ) {
    flags.push("QUALITY_STATUS_" + qualityStatus.replace(/[^A-Z0-9]+/g, "_"));
  }

  return [...new Set(flags.filter(Boolean))];
}

function replayItem(
  stage: string,
  label: string,
  sourceTable: string,
  row: Row | null,
): Row {
  return {
    stage,
    label,
    status: row ? "AVAILABLE" : "NOT_AVAILABLE",
    occurred_at:
      row && tsNumber(row) ? new Date(tsNumber(row)).toISOString() : null,
    source_table: sourceTable,
    ref_id: nullableText(
      firstValue(
        row?.id,
        row?.record_id,
        row?.recommendation_id,
        row?.scenario_set_id,
        row?.task_id,
        row?.receipt_id,
        row?.fact_id,
        safeJson(row?.record_json)?.payload?.operation_plan_id,
        safeJson(row?.record_json)?.payload?.act_task_id,
        safeJson(row?.record_json)?.payload?.receipt_id,
        safeJson(row?.record_json)?.payload?.acceptance_id,
      ),
    ),
    evidence_refs: collectEvidenceRefs(row),
    replay_notes: row
      ? ["Official projection row available for replay."]
      : [sourceTable + " not available; replay gap is preserved."],
  };
}

async function latestOptionalRow(
  pool: Pool,
  table: string,
  scope: RequestScope,
): Promise<Row | null> {
  const rows = await readRows(pool, table, scope, 1);
  return rows[0] ?? null;
}

function factScopeClause(jsonPath: "payload" | "entity", key: string): string {
  return "record_json::jsonb#>>'{" + jsonPath + "," + key + "}'";
}

async function latestOptionalFactByType(
  pool: Pool,
  type: string,
  scope: RequestScope,
): Promise<Row | null> {
  if (!hasTenantScope(scope)) return null;
  if (!(await tableExists(pool, "facts"))) return null;

  const clauses = ["(record_json::jsonb->>'type') = $1"];
  const values: unknown[] = [type];
  const scoped: Array<[keyof RequestScope, string]> = [
    ["tenantId", "tenant_id"],
    ["projectId", "project_id"],
    ["groupId", "group_id"],
    ["fieldId", "field_id"],
  ];

  for (const [scopeKey, jsonKey] of scoped) {
    const value = scope[scopeKey];
    if (!value) continue;
    values.push(value);
    clauses.push(
      "(" +
        [
          factScopeClause("payload", jsonKey),
          factScopeClause("entity", jsonKey),
          "record_json::jsonb->>'" + jsonKey + "'",
        ]
          .map((expr) => expr + " = $" + values.length)
          .join(" OR ") +
        ")",
    );
  }

  const sql =
    "SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json, " +
    "record_json::jsonb->'payload' AS payload_json, " +
    "record_json::jsonb#>>'{payload,field_id}' AS field_id, " +
    "record_json::jsonb#>>'{payload,tenant_id}' AS tenant_id, " +
    "record_json::jsonb#>>'{payload,project_id}' AS project_id, " +
    "record_json::jsonb#>>'{payload,group_id}' AS group_id " +
    "FROM facts WHERE " +
    clauses.join(" AND ") +
    " ORDER BY occurred_at DESC, fact_id DESC LIMIT 1";

  const result = await pool
    .query(sql, values)
    .catch(() => ({ rows: [] as Row[] }));
  return result.rows?.[0] ?? null;
}

async function latestOptionalProjectionOrFactRow(
  pool: Pool,
  tableOrType: string,
  scope: RequestScope,
): Promise<Row | null> {
  const indexed = await latestOptionalRow(pool, tableOrType, scope);
  if (indexed) return indexed;
  return latestOptionalFactByType(pool, tableOrType, scope);
}

async function buildFieldCalibrationReplay(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
): Promise<Row> {
  const normalizedFieldId = safeText(fieldId);
  const fieldScope = { ...scope, fieldId: normalizedFieldId };
  const workspace = await buildFieldWorkspace(
    pool,
    fieldScope,
    normalizedFieldId,
  );
  const evidenceQuality = await buildFieldEvidenceQuality(
    pool,
    fieldScope,
    normalizedFieldId,
  );
  const [
    waterState,
    weather,
    scenario,
    recommendation,
    operationPlan,
    task,
    receipt,
    asExecuted,
    acceptance,
  ] = await Promise.all([
    latestOptionalRow(pool, "water_state_estimate_index_v1", fieldScope),
    latestOptionalRow(pool, "weather_forecast_index_v1", fieldScope),
    latestOptionalRow(pool, "irrigation_scenario_set_index_v1", fieldScope),
    latestOptionalRow(pool, "decision_recommendation_index_v1", fieldScope),
    latestOptionalProjectionOrFactRow(pool, "operation_plan_v1", fieldScope),
    latestOptionalProjectionOrFactRow(pool, "ao_act_" + "task_v0", fieldScope),
    latestOptionalProjectionOrFactRow(
      pool,
      "ao_act_receipt_v1",
      fieldScope,
    ).then(
      async (row) =>
        row ??
        latestOptionalProjectionOrFactRow(
          pool,
          "ao_act_receipt_v0",
          fieldScope,
        ),
    ),
    latestOptionalProjectionOrFactRow(
      pool,
      "as_executed_record_v1",
      fieldScope,
    ),
    latestOptionalProjectionOrFactRow(pool, "acceptance_result_v1", fieldScope),
  ]);

  const replayGaps: TwinGap[] = [];
  if (!operationPlan)
    replayGaps.push({
      gap_code: "OPERATION_PLAN_NOT_FOUND",
      label: "未找到 operation_plan_v1，不能回放正式作业计划。",
      severity: "INFO",
    });
  if (!receipt)
    replayGaps.push({
      gap_code: "AO_ACT_RECEIPT_NOT_FOUND",
      label: "未找到 AO-ACT receipt，不能回放执行回执。",
      severity: "INFO",
    });
  if (!asExecuted)
    replayGaps.push({
      gap_code: "AS_EXECUTED_RECORD_NOT_FOUND",
      label: "未找到 as_executed_record_v1，不能回放实执行记录。",
      severity: "INFO",
    });
  if (!acceptance)
    replayGaps.push({
      gap_code: "ACCEPTANCE_RESULT_NOT_FOUND",
      label: "未找到 acceptance_result_v1，不能回放验收结果。",
      severity: "INFO",
    });
  replayGaps.push({
    gap_code: "POST_IRRIGATION_VERIFICATION_NOT_AVAILABLE",
    label:
      "H26 不进行灌后效果判断；post-irrigation verification 尚不可用于校准。",
    severity: "INFO",
  });

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_CALIBRATION_REPLAY",
    request_scope: workspace.request_scope,
    scope_policy: workspace.scope_policy,
    field_context: workspace.field_context,
    replay_timeline_v1: {
      items: [
        replayItem(
          "OBSERVATION",
          "Observation / Evidence Quality",
          "operator_field_twin_evidence_quality_v1",
          evidenceQuality,
        ),
        replayItem(
          "STATE_ESTIMATE",
          "Water State Estimate",
          "water_state_estimate_index_v1",
          waterState,
        ),
        replayItem(
          "FORECAST",
          "Weather Forecast",
          "weather_forecast_index_v1",
          weather,
        ),
        replayItem(
          "SCENARIO_COMPARE",
          "Scenario Compare",
          "irrigation_scenario_set_index_v1",
          scenario,
        ),
        replayItem(
          "RECOMMENDATION",
          "Decision Recommendation",
          "decision_recommendation_index_v1",
          recommendation,
        ),
        replayItem(
          "APPROVAL",
          "Approval Boundary",
          "approval_projection_unavailable",
          null,
        ),
        replayItem(
          "OPERATION_PLAN",
          "Operation Plan",
          "operation_plan_v1",
          operationPlan,
        ),
        replayItem("TASK", "AO-ACT Task", "ao_act_" + "task_v0", task),
        replayItem(
          "RECEIPT",
          "AO-ACT Receipt",
          receipt ? "ao_act_receipt" : "ao_act_receipt_v1",
          receipt,
        ),
        replayItem(
          "AS_EXECUTED",
          "As Executed Record",
          "as_executed_record_v1",
          asExecuted,
        ),
        replayItem(
          "ACCEPTANCE",
          "Acceptance Result",
          "acceptance_result_v1",
          acceptance,
        ),
        {
          stage: "CALIBRATION_GAP",
          label: "Calibration Gap",
          status: "NOT_READY",
          occurred_at: null,
          source_table: "post_irrigation_verification",
          ref_id: null,
          evidence_refs: [],
          replay_notes: [
            "POST_IRRIGATION_VERIFICATION_NOT_AVAILABLE",
            "本页只读，不执行校准，不判断灌后有效/无效。",
          ],
        },
      ],
    },
    calibration_inputs_v1: {
      prediction_sources: [waterState, weather, scenario, recommendation]
        .filter(Boolean)
        .map((row) => ({
          source_table: firstText(row?.source_table, "official_projection"),
          evidence_refs: collectEvidenceRefs(row),
        })),
      execution_sources: [operationPlan, task, receipt, asExecuted]
        .filter(Boolean)
        .map((row) => ({
          source_table: firstText(row?.source_table, "execution_projection"),
          evidence_refs: collectEvidenceRefs(row),
        })),
      outcome_sources: acceptance
        ? [
            {
              source_table: "acceptance_result_v1",
              evidence_refs: collectEvidenceRefs(acceptance),
            },
          ]
        : [],
      evidence_quality_refs: asArray(
        evidenceQuality.evidence_trace_v1?.trace_items,
      )
        .flatMap((item) => asArray(item.evidence_refs))
        .map((item) => safeText(item))
        .filter(Boolean)
        .slice(0, 10),
    },
    calibration_summary: {
      status: "NOT_READY",
      reason: "POST_IRRIGATION_VERIFICATION_NOT_AVAILABLE",
      available_for_review: true,
      write_ready: false,
    },
    replay_gaps: replayGaps,
    boundary_rules: [
      ...defaultBoundaryRules(),
      { rule_code: "NO_FIELD_MEMORY_WRITE", label: "本页不写 Field Memory" },
      {
        rule_code: "NO_CALIBRATION_EXECUTION",
        label: "本页只展示可回放证据，不执行校准或学习",
      },
    ],
  };
}

function stateSnapshot(row: Row | null, phase: "PRE" | "POST"): Row {
  const payload =
    safeJson(
      row?.payload_json ??
        row?.payload ??
        row?.record_json?.payload ??
        row?.record_json,
    ) ?? {};
  const summary =
    safeJson(row?.summary_json ?? payload.summary_json ?? payload.summary) ??
    {};
  const value = numberOrNull(
    firstValue(
      row?.soil_moisture_value,
      row?.vwc,
      row?.vwc_percent,
      row?.soil_moisture,
      row?.mean_vwc,
      row?.root_zone_soil_moisture_percent,
      row?.root_zone_vwc_percent,
      payload.soil_moisture_value,
      payload.vwc,
      payload.vwc_percent,
      payload.soil_moisture,
      payload.mean_vwc,
      payload.root_zone_soil_moisture_percent,
      payload.root_zone_vwc_percent,
      summary.last_value,
      summary.mean_value,
      summary.root_zone_soil_moisture_percent,
      summary.root_zone_vwc_percent,
    ),
  );
  const waterState = nullableText(
    firstValue(
      row?.water_state,
      row?.water_state_code,
      row?.state,
      row?.state_code,
      row?.deficit_classification,
      row?.classification,
      payload.water_state,
      payload.water_state_code,
      payload.state,
      payload.state_code,
      payload.deficit_classification,
      payload.classification,
    ),
  );
  const observedMs = row ? tsNumber(row) : 0;
  return {
    available: Boolean(row),
    source: row
      ? firstText(
          row.source_table,
          row.source,
          row.table_name,
          phase === "PRE"
            ? "soil_moisture_sensing_window_index_v1"
            : "soil_moisture_sensing_window_index_v1",
        )
      : null,
    observed_at: observedMs ? new Date(observedMs).toISOString() : null,
    soil_moisture_value: value,
    water_state: waterState,
    confidence: nullableText(
      firstValue(
        row?.confidence,
        row?.confidence_text,
        payload.confidence,
        payload.confidence_text,
      ),
    ),
    evidence_refs: collectEvidenceRefs(row),
  };
}

function rowLooksPost(row: Row): boolean {
  const blob = JSON.stringify(row).toLowerCase();
  return (
    blob.includes("post") ||
    blob.includes("after") ||
    blob.includes("irrigation_response")
  );
}

function rowLooksPre(row: Row): boolean {
  const blob = JSON.stringify(row).toLowerCase();
  return (
    blob.includes("pre") || blob.includes("before") || blob.includes("baseline")
  );
}

function timestampMsFromValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function executionWindowEndMs(
  ...rows: Array<Row | null | undefined>
): number | null {
  let best: number | null = null;
  for (const row of rows) {
    if (!row) continue;
    const payload =
      safeJson(
        row.payload_json ??
          row.payload ??
          row.record_json?.payload ??
          row.record_json,
      ) ?? {};
    const candidates = [
      row.completed_at,
      row.executed_at,
      row.execution_completed_at,
      row.operation_end_at,
      row.window_end,
      row.end_at,
      payload.completed_at,
      payload.executed_at,
      payload.execution_completed_at,
      payload.operation_end_at,
      payload.window_end,
      payload.end_at,
    ];
    for (const candidate of candidates) {
      const ms = timestampMsFromValue(candidate);
      if (ms !== null && (best === null || ms > best)) best = ms;
    }
  }
  return best;
}

function observationTimestampMs(row: Row): number | null {
  const payload =
    safeJson(
      row.payload_json ??
        row.payload ??
        row.record_json?.payload ??
        row.record_json,
    ) ?? {};
  const candidates = [
    row.observed_at,
    row.window_end,
    row.updated_at,
    row.created_at,
    payload.observed_at,
    payload.window_end,
    payload.updated_at,
    payload.created_at,
  ];
  for (const candidate of candidates) {
    const ms = timestampMsFromValue(candidate);
    if (ms !== null) return ms;
  }
  const fallback = tsNumber(row);
  return fallback || null;
}

function findRowAfterExecutionWindow(
  rows: Row[],
  ...executionRows: Array<Row | null | undefined>
): Row | null {
  const endMs = executionWindowEndMs(...executionRows);
  if (endMs === null) return null;
  const maxPostWindowMs = 7 * 24 * 60 * 60 * 1000;
  return (
    rows.find((row) => {
      const observedMs = observationTimestampMs(row);
      return (
        observedMs !== null &&
        observedMs > endMs &&
        observedMs <= endMs + maxPostWindowMs
      );
    }) ?? null
  );
}

async function latestOperationReport(
  pool: Pool,
  scope: RequestScope,
): Promise<Row | null> {
  return (
    (await latestOptionalProjectionOrFactRow(
      pool,
      "operation_report_v1",
      scope,
    )) ??
    (await latestOptionalFactByType(pool, "operation_report_projection", scope))
  );
}

async function buildFieldPostIrrigationVerification(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
): Promise<Row> {
  const normalizedFieldId = safeText(fieldId);
  const fieldScope = { ...scope, fieldId: normalizedFieldId };
  const workspace = await buildFieldWorkspace(
    pool,
    fieldScope,
    normalizedFieldId,
  );
  const evidenceQuality = await buildFieldEvidenceQuality(
    pool,
    fieldScope,
    normalizedFieldId,
  );
  const calibrationReplay = await buildFieldCalibrationReplay(
    pool,
    fieldScope,
    normalizedFieldId,
  );
  const sensingRows = await readRows(
    pool,
    "soil_moisture_sensing_window_index_v1",
    fieldScope,
    10,
  );
  const waterRows = await readRows(
    pool,
    "water_state_estimate_index_v1",
    fieldScope,
    10,
  );
  const combined = [...sensingRows, ...waterRows].sort(
    (a, b) => tsNumber(a) - tsNumber(b),
  );
  const preRow = combined.find(rowLooksPre) ?? combined[0] ?? null;
  const [operationPlan, receipt, asExecuted, acceptance, operationReport] =
    await Promise.all([
      latestOptionalProjectionOrFactRow(pool, "operation_plan_v1", fieldScope),
      latestOptionalProjectionOrFactRow(
        pool,
        "ao_act_receipt_v1",
        fieldScope,
      ).then(
        async (row) =>
          row ??
          latestOptionalProjectionOrFactRow(
            pool,
            "ao_act_receipt_v0",
            fieldScope,
          ),
      ),
      latestOptionalProjectionOrFactRow(
        pool,
        "as_executed_record_v1",
        fieldScope,
      ),
      latestOptionalProjectionOrFactRow(
        pool,
        "acceptance_result_v1",
        fieldScope,
      ),
      latestOperationReport(pool, fieldScope),
    ]);
  const explicitPostRow = [...combined].reverse().find(rowLooksPost) ?? null;
  const operationWindowPostRow = findRowAfterExecutionWindow(
    combined,
    receipt,
    asExecuted,
    operationPlan,
  );
  const postRow = explicitPostRow ?? operationWindowPostRow ?? null;

  const pre = stateSnapshot(preRow, "PRE");
  const post = stateSnapshot(postRow, "POST");
  const deltaValue =
    pre.soil_moisture_value !== null && post.soil_moisture_value !== null
      ? Number((post.soil_moisture_value - pre.soil_moisture_value).toFixed(3))
      : null;
  const evidenceReady = Boolean(receipt && asExecuted);
  const qualityStatus = firstText(
    evidenceQuality.quality_summary?.status,
  ).toUpperCase();
  const lowConfidence = ["FAIL", "LOW", "LIMITED", "BLOCKING"].some((token) =>
    qualityStatus.includes(token),
  );
  const gaps: TwinGap[] = [];
  if (!post.available)
    gaps.push({
      gap_code: "POST_IRRIGATION_OBSERVATION_NOT_AVAILABLE",
      label:
        "未找到灌后 soil moisture / water state observation，不能验证灌后响应。",
      severity: "BLOCKING",
    });
  if (!receipt)
    gaps.push({
      gap_code: "AO_ACT_RECEIPT_NOT_AVAILABLE",
      label: "未找到 receipt 支撑执行链。",
      severity: "WARNING",
    });
  if (!asExecuted)
    gaps.push({
      gap_code: "AS_EXECUTED_RECORD_NOT_AVAILABLE",
      label: "未找到 as-executed record 支撑执行链。",
      severity: "WARNING",
    });
  if (lowConfidence)
    gaps.push({
      gap_code: "LOW_CONFIDENCE",
      label: "证据质量为 LOW/FAIL/LIMITED/BLOCKING，结果只能低置信展示。",
      severity: "WARNING",
    });

  let status = "UNKNOWN";
  if (!post.available) status = "NOT_VERIFIABLE";
  else if (lowConfidence) status = "LOW_CONFIDENCE";
  else if (!evidenceReady) status = "EXECUTION_EVIDENCE_MISSING";
  else if (deltaValue !== null && deltaValue > 0) status = "RESPONSE_OBSERVED";
  else if (deltaValue !== null && deltaValue <= 0)
    status = "NO_RESPONSE_OBSERVED";

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_POST_IRRIGATION_VERIFICATION",
    request_scope: workspace.request_scope,
    scope_policy: workspace.scope_policy,
    field_context: workspace.field_context,
    operation_context: {
      operation_id: nullableText(
        firstValue(
          operationPlan?.operation_id,
          operationPlan?.id,
          safeJson(operationPlan?.payload_json)?.operation_id,
        ),
      ),
      task_id: nullableText(
        firstValue(
          operationPlan?.task_id,
          receipt?.task_id,
          safeJson(receipt?.payload_json)?.task_id,
        ),
      ),
      receipt_id: nullableText(
        firstValue(
          receipt?.receipt_id,
          receipt?.id,
          receipt?.fact_id,
          safeJson(receipt?.payload_json)?.receipt_id,
        ),
      ),
      as_executed_id: nullableText(
        firstValue(
          asExecuted?.as_executed_id,
          asExecuted?.id,
          asExecuted?.fact_id,
          safeJson(asExecuted?.payload_json)?.as_executed_id,
        ),
      ),
      acceptance_result_id: nullableText(
        firstValue(
          acceptance?.acceptance_result_id,
          acceptance?.id,
          acceptance?.fact_id,
          safeJson(acceptance?.payload_json)?.acceptance_result_id,
        ),
      ),
    },
    pre_irrigation_state_v1: pre,
    post_irrigation_state_v1: post,
    response_delta_v1: {
      status,
      delta_value: deltaValue,
      delta_direction:
        deltaValue === null
          ? "UNKNOWN"
          : deltaValue > 0
            ? "INCREASED"
            : deltaValue < 0
              ? "DECREASED"
              : "UNCHANGED",
      meets_expected_response:
        status === "RESPONSE_OBSERVED"
          ? true
          : status === "NO_RESPONSE_OBSERVED"
            ? false
            : null,
      reason_codes: gaps.map((gap) => gap.gap_code),
    },
    execution_evidence_v1: {
      receipt_available: Boolean(receipt),
      as_executed_available: Boolean(asExecuted),
      acceptance_available: Boolean(acceptance),
      operation_report_available: Boolean(operationReport),
      evidence_refs: [receipt, asExecuted, acceptance, operationReport]
        .flatMap((row) => collectEvidenceRefs(row))
        .slice(0, 20),
    },
    zone_response_matrix_v1: { rows: [] },
    verification_summary: {
      status,
      reason: gaps[0]?.gap_code ?? status,
      field_memory_candidate: status === "RESPONSE_OBSERVED",
      roi_candidate: status === "RESPONSE_OBSERVED",
      write_ready: false,
    },
    verification_gaps: gaps,
    boundary_rules: [
      ...defaultBoundaryRules(),
      {
        rule_code: "READ_ONLY_POST_IRRIGATION_VERIFICATION",
        label:
          "本页只读，用于验证灌后响应证据，不写入 Field Memory，不写 ROI，不创建 task。",
      },
      {
        rule_code: "FACTS_FALLBACK_PRESERVED",
        label: "execution-chain 读取复用 projection + facts fallback。",
      },
    ],
    reused_projection_refs: {
      evidence_quality_report_kind: evidenceQuality.report_kind,
      calibration_replay_report_kind: calibrationReplay.report_kind,
    },
  };
}

async function buildFieldEvidenceQuality(
  pool: Pool,
  scope: RequestScope,
  fieldId: string,
): Promise<Row> {
  const normalizedFieldId = safeText(fieldId);
  const fieldScope = { ...scope, fieldId: normalizedFieldId };
  const workspace = await buildFieldWorkspace(
    pool,
    fieldScope,
    normalizedFieldId,
  );
  const inventory = await buildSourceIndexInventory(pool, fieldScope);
  const rows = asArray(inventory.source_indexes);

  const traceStageByTable: Record<string, string> = {
    field_index_v1: "Fact",
    soil_moisture_sensing_window_index_v1: "Fact",
    water_state_estimate_index_v1: "Estimate",
    weather_forecast_index_v1: "Forecast",
    irrigation_scenario_set_index_v1: "Scenario",
    decision_recommendation_index_v1: "Recommendation",
  };

  const latestRowsByTable = new Map<string, Row>();
  await Promise.all(
    rows.map(async (row) => {
      const tableName = safeText(row.table_name);
      if (!tableName) return;
      const latestRows = await readRows(pool, tableName, fieldScope, 1);
      if (latestRows[0]) latestRowsByTable.set(tableName, latestRows[0]);
    }),
  );

  const coverageRows = rows.map((row) => {
    const sourceRow = latestRowsByTable.get(safeText(row.table_name)) ?? null;
    const qualityFlags = sourceQualityFlags(row, sourceRow);
    const available = Boolean(row.available);

    return {
      metric: String(row.table_name || "").replace(/_index_v1$/, ""),
      source_table: row.table_name,
      available,
      row_count: Number(row.row_count ?? 0),
      latest_ts_ms: row.latest_ts_ms ?? null,
      coverage_ratio: numberOrNull(
        firstValue(sourceRow?.coverage_ratio, sourceRow?.coverageRatio),
      ),
      max_gap_ms: numberOrNull(
        firstValue(sourceRow?.max_gap_ms, sourceRow?.maxGapMs),
      ),
      actual_points: numberOrNull(
        firstValue(
          sourceRow?.actual_points,
          sourceRow?.actualPoints,
          sourceRow?.observed_points,
        ),
      ),
      expected_points: numberOrNull(
        firstValue(
          sourceRow?.expected_points,
          sourceRow?.expectedPoints,
          sourceRow?.required_points,
        ),
      ),
      quality_status: nullableText(
        firstValue(sourceRow?.quality_status, sourceRow?.qualityStatus),
      ),
      confidence: nullableText(
        firstValue(
          sourceRow?.confidence,
          sourceRow?.confidence_level,
          sourceRow?.confidence_text,
        ),
      ),
      coverage_details: sourceRow
        ? {
            coverage_ratio: numberOrNull(
              firstValue(sourceRow.coverage_ratio, sourceRow.coverageRatio),
            ),
            max_gap_ms: numberOrNull(
              firstValue(sourceRow.max_gap_ms, sourceRow.maxGapMs),
            ),
            actual_points: numberOrNull(
              firstValue(
                sourceRow.actual_points,
                sourceRow.actualPoints,
                sourceRow.observed_points,
              ),
            ),
            expected_points: numberOrNull(
              firstValue(
                sourceRow.expected_points,
                sourceRow.expectedPoints,
                sourceRow.required_points,
              ),
            ),
            quality_status: nullableText(
              firstValue(sourceRow.quality_status, sourceRow.qualityStatus),
            ),
            confidence: nullableText(
              firstValue(
                sourceRow.confidence,
                sourceRow.confidence_level,
                sourceRow.confidence_text,
              ),
            ),
          }
        : null,
      missing_windows: available
        ? []
        : [row.missing_reason || "SOURCE_INDEX_WINDOW_MISSING"],
      quality_flags: qualityFlags,
      confidence_penalty:
        qualityFlags.length > 0
          ? "LIMITED_BY_SOURCE_ROW_QUALITY"
          : available
            ? null
            : "LIMITED_BY_MISSING_SOURCE_INDEX",
      evidence_refs: [
        ...asArray(row.latest_evidence_refs)
          .map((item) => safeText(item))
          .filter(Boolean),
        ...collectEvidenceRefs(sourceRow),
      ].slice(0, 10),
    };
  });

  const lowQualityReasons = coverageRows
    .filter((row) => !row.available || row.quality_flags.length > 0)
    .map((row) => ({
      source_table: row.source_table,
      reason: row.quality_flags[0] || "LIMITED_SOURCE_INDEX_QUALITY",
      evidence_refs: row.evidence_refs,
      missing_windows: row.missing_windows,
    }));

  const hasRequiredScope = hasTenantScope(fieldScope);
  const qualityStatus = !hasRequiredScope
    ? "BLOCKING"
    : lowQualityReasons.length > 0
      ? "LIMITED"
      : "AVAILABLE";

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_FIELD_TWIN_EVIDENCE_QUALITY",
    request_scope: workspace.request_scope,
    scope_policy: workspace.scope_policy,
    field_context: workspace.field_context,
    evidence_trace_v1: {
      trace_items: rows.map((row) => ({
        stage: traceStageByTable[row.table_name] || "Fact",
        label: tableDisplayLabel(row.table_name),
        source_table: row.table_name,
        available: Boolean(row.available),
        latest_ts_ms: row.latest_ts_ms ?? null,
        evidence_refs: asArray(row.latest_evidence_refs)
          .map((item) => safeText(item))
          .filter(Boolean),
        quality_flags: row.available
          ? []
          : [row.missing_reason || "NO_SCOPED_ROWS"],
      })),
    },
    data_coverage_matrix_v1: { rows: coverageRows },
    quality_summary: {
      status: qualityStatus,
      blocking_reason: hasRequiredScope ? null : SCOPE_REQUIRED_REASON,
      low_quality_reasons: lowQualityReasons,
      simulation_data_present: false,
      official_data_qualified: hasRequiredScope,
    },
    source_index_inventory: inventory,
    data_gaps: workspace.data_gaps,
    boundary_rules: defaultBoundaryRules(),
  };
}

export function registerOperatorTwinReadRoutes(
  app: FastifyInstance,
  pool: Pool,
): void {
  app.get("/api/v1/operator/twin", async (req: any, reply) => {
    const scope = extractRequestScope(req);
    const overview = await buildOverview(pool, scope);
    return reply.send({
      ...basePayload("operator_twin_overview_api"),
      operator_twin_overview_v1: overview,
    });
  });

  app.get("/api/v1/operator/twin/source-indexes", async (req: any, reply) => {
    const scope = extractRequestScope(req);
    const inventory = await buildSourceIndexInventory(pool, scope);
    return reply.send({
      ...basePayload("operator_twin_source_index_inventory_api"),
      operator_twin_source_index_inventory_v1: inventory,
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

  app.get(
    "/api/v1/operator/twin/fields/:field_id/post-irrigation",
    async (req: any, reply) => {
      const fieldId = safeText(req.params?.field_id);
      const scope = extractRequestScope(req, fieldId);
      const verification = await buildFieldPostIrrigationVerification(
        pool,
        scope,
        fieldId,
      );
      return reply.send({
        ...basePayload("operator_field_twin_post_irrigation_verification_api"),
        operator_field_twin_post_irrigation_verification_v1: verification,
      });
    },
  );

  app.get(
    "/api/v1/operator/twin/fields/:field_id/calibration",
    async (req: any, reply) => {
      const fieldId = safeText(req.params?.field_id);
      const scope = extractRequestScope(req, fieldId);
      const replay = await buildFieldCalibrationReplay(pool, scope, fieldId);
      return reply.send({
        ...basePayload("operator_field_twin_calibration_replay_api"),
        operator_field_twin_calibration_replay_v1: replay,
      });
    },
  );

  app.get(
    "/api/v1/operator/twin/fields/:field_id/evidence",
    async (req: any, reply) => {
      const fieldId = safeText(req.params?.field_id);
      const scope = extractRequestScope(req, fieldId);
      const evidence = await buildFieldEvidenceQuality(pool, scope, fieldId);
      return reply.send({
        ...basePayload("operator_field_twin_evidence_quality_api"),
        operator_field_twin_evidence_quality_v1: evidence,
      });
    },
  );

  app.get(
    "/api/v1/operator/twin/fields/:field_id/forecast",
    async (req: any, reply) => {
      const fieldId = safeText(req.params?.field_id);
      const scope = extractRequestScope(req, fieldId);
      const panel = await buildFieldForecastPanel(pool, scope, fieldId);
      return reply.send({
        ...basePayload("operator_field_twin_forecast_panel_api"),
        operator_field_twin_forecast_panel_v1: panel,
      });
    },
  );

  app.get(
    "/api/v1/operator/twin/fields/:field_id/scenarios",
    async (req: any, reply) => {
      const fieldId = safeText(req.params?.field_id);
      const scope = extractRequestScope(req, fieldId);
      const compare = await buildFieldScenarioCompare(pool, scope, fieldId);
      return reply.send({
        ...basePayload("operator_field_twin_scenario_compare_api"),
        operator_field_twin_scenario_compare_v1: compare,
      });
    },
  );

  app.post(
    "/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
    async (req: any, reply) => {
      const submission = await buildOperatorScenarioRecommendationSubmission(
        pool,
        {
          fieldId: safeText(req.params?.field_id),
          scenarioSetId: safeText(req.params?.scenario_set_id),
          optionId: safeText(req.params?.option_id),
          body: req.body ?? {},
          req,
        },
      );
      const ok =
        submission.status === "SUBMITTED_TO_RECOMMENDATION" ||
        submission.status === "REJECTED_DUPLICATE";
      return reply.code(ok ? 200 : 400).send({
        ...basePayload("operator_scenario_recommendation_submission_api"),
        writeReady: true,
        dispatchReady: false,
        approvalReady: false,
        taskCreationReady: false,
        operator_scenario_recommendation_submission_v1: submission,
      });
    },
  );
}
