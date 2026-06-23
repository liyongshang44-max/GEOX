// apps/server/src/routes/v1/operator_twin_h31_h45_closure.ts
// Purpose: expose a scoped, read-only H31-H45 closure projection for Operator Twin demo pages.
// Boundary: this route must not write facts, create approvals, create dispatches, create tasks, write ROI, or write Field Memory.
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const DATA_SCOPE = "OFFICIAL_OPERATOR_TWIN_API";
const DEMO_FIELD_ID = "field_c8_demo";
const TENANT_SCOPE_COLUMNS = ["tenant_id", "project_id", "group_id"] as const;

type Row = Record<string, any>;

type ClosureScope = {
  tenantId: string | null;
  projectId: string | null;
  groupId: string | null;
  fieldId: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
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

function payloadOf(row: Row | null | undefined): Row {
  return safeJson(row?.payload_json ?? row?.record_json?.payload ?? row?.record_json) ?? {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const raw = text(value);
    if (raw) return raw;
  }
  return "";
}

function normalizeFieldId(raw: unknown): string {
  const value = text(raw);
  if (!value || value === ":fieldId" || value === "fieldId") return DEMO_FIELD_ID;
  if (value.startsWith(":")) return DEMO_FIELD_ID;
  return value;
}

function queryValue(req: any, key: string): unknown {
  return req?.query?.[key] ?? req?.query?.[key.replace(/_([a-z])/g, (_m: string, letter: string) => letter.toUpperCase())];
}

function headerValue(req: any, key: string): unknown {
  return req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()];
}

function extractScope(req: any, fieldId: string): ClosureScope {
  const user = req?.user ?? req?.auth ?? req?.principal ?? {};
  return {
    tenantId: firstText(user.tenant_id, user.tenantId, queryValue(req, "tenant_id"), queryValue(req, "tenantId"), headerValue(req, "x-tenant-id")) || null,
    projectId: firstText(user.project_id, user.projectId, queryValue(req, "project_id"), queryValue(req, "projectId"), headerValue(req, "x-project-id")) || null,
    groupId: firstText(user.group_id, user.groupId, queryValue(req, "group_id"), queryValue(req, "groupId"), headerValue(req, "x-group-id")) || null,
    fieldId: normalizeFieldId(fieldId),
  };
}

function hasTenantScope(scope: ClosureScope): boolean {
  return Boolean(scope.tenantId || scope.projectId || scope.groupId);
}

function identifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error("UNSAFE_SQL_IDENTIFIER");
  return value;
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query("SELECT to_regclass($1)::text AS name", ["public." + table]).catch(() => ({ rows: [{ name: null }] as Row[] }));
  return Boolean(result.rows?.[0]?.name);
}

async function columns(pool: Pool, table: string): Promise<Set<string>> {
  const result = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]).catch(() => ({ rows: [] as Row[] }));
  return new Set((result.rows ?? []).map((row) => String(row.column_name)));
}

function scopeClausesForColumns(cols: Set<string>, scope: ClosureScope, values: unknown[]): string[] {
  const clauses: string[] = [];
  const pairs: Array<[(typeof TENANT_SCOPE_COLUMNS)[number], string | null]> = [["tenant_id", scope.tenantId], ["project_id", scope.projectId], ["group_id", scope.groupId]];
  for (const [column, value] of pairs) {
    if (!value || !cols.has(column)) continue;
    values.push(value);
    clauses.push(identifier(column) + " = $" + values.length);
  }
  if (scope.fieldId && cols.has("field_id")) {
    values.push(scope.fieldId);
    clauses.push("field_id = $" + values.length);
  }
  return clauses;
}

async function countTableRows(pool: Pool, table: string, scope: ClosureScope): Promise<number> {
  if (!(await tableExists(pool, table))) return 0;
  const cols = await columns(pool, table);
  const values: unknown[] = [];
  const clauses = scopeClausesForColumns(cols, scope, values);
  if (!clauses.length) return 0;
  const result = await pool.query("SELECT COUNT(*)::int AS row_count FROM " + identifier(table) + " WHERE " + clauses.join(" AND "), values).catch(() => ({ rows: [] as Row[] }));
  return Number(result.rows?.[0]?.row_count ?? 0) || 0;
}

async function latestFact(pool: Pool, type: string, scope: ClosureScope): Promise<Row | null> {
  if (!(await tableExists(pool, "facts"))) return null;
  const clauses = ["record_json::jsonb->>'type' = $1"];
  const values: unknown[] = [type];
  const scoped: Array<[keyof ClosureScope, string]> = [["tenantId", "tenant_id"], ["projectId", "project_id"], ["groupId", "group_id"], ["fieldId", "field_id"]];
  for (const [scopeKey, jsonKey] of scoped) {
    const value = scope[scopeKey];
    if (!value) continue;
    values.push(value);
    clauses.push("(record_json::jsonb#>>'{payload," + jsonKey + "}' = $" + values.length + " OR record_json::jsonb#>>'{entity," + jsonKey + "}' = $" + values.length + " OR record_json::jsonb->>'" + jsonKey + "' = $" + values.length + ")");
  }
  const result = await pool.query("SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json, record_json::jsonb->'payload' AS payload_json FROM facts WHERE " + clauses.join(" AND ") + " ORDER BY occurred_at DESC, fact_id DESC LIMIT 1", values).catch(() => ({ rows: [] as Row[] }));
  return result.rows?.[0] ?? null;
}

async function countFactRows(pool: Pool, type: string, scope: ClosureScope): Promise<number> {
  if (!(await tableExists(pool, "facts"))) return 0;
  const clauses = ["record_json::jsonb->>'type' = $1"];
  const values: unknown[] = [type];
  const scoped: Array<[keyof ClosureScope, string]> = [["tenantId", "tenant_id"], ["projectId", "project_id"], ["groupId", "group_id"], ["fieldId", "field_id"]];
  for (const [scopeKey, jsonKey] of scoped) {
    const value = scope[scopeKey];
    if (!value) continue;
    values.push(value);
    clauses.push("(record_json::jsonb#>>'{payload," + jsonKey + "}' = $" + values.length + " OR record_json::jsonb#>>'{entity," + jsonKey + "}' = $" + values.length + " OR record_json::jsonb->>'" + jsonKey + "' = $" + values.length + ")");
  }
  const result = await pool.query("SELECT COUNT(*)::int AS row_count FROM facts WHERE " + clauses.join(" AND "), values).catch(() => ({ rows: [] as Row[] }));
  return Number(result.rows?.[0]?.row_count ?? 0) || 0;
}

async function latestIndexRow(pool: Pool, table: string, scope: ClosureScope): Promise<Row | null> {
  if (!(await tableExists(pool, table))) return null;
  const cols = await columns(pool, table);
  const values: unknown[] = [];
  const clauses = scopeClausesForColumns(cols, scope, values);
  if (!clauses.length) return null;
  const order = cols.has("updated_at") ? " ORDER BY updated_at DESC NULLS LAST" : cols.has("computed_at") ? " ORDER BY computed_at DESC NULLS LAST" : "";
  const result = await pool.query("SELECT * FROM " + identifier(table) + " WHERE " + clauses.join(" AND ") + order + " LIMIT 1", values).catch(() => ({ rows: [] as Row[] }));
  return result.rows?.[0] ?? null;
}

function stage(code: string, label: string, available: boolean, evidenceRefs: string[], summary: string): Row {
  return { code, label, status: available ? "AVAILABLE" : "MISSING", evidence_refs: [...new Set(evidenceRefs.filter(Boolean))].slice(0, 12), summary_text: summary };
}

function refs(...rows: Array<Row | null | undefined>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (!row) continue;
    const payload = payloadOf(row);
    out.push(firstText(row.fact_id, payload.fact_id, payload.id, payload.recommendation_id, payload.operation_plan_id, payload.act_task_id, payload.receipt_id, payload.as_executed_id, payload.acceptance_id, payload.verification_id));
    const rawRefs = payload.evidence_refs;
    if (Array.isArray(rawRefs)) for (const ref of rawRefs) out.push(firstText(ref));
  }
  return out.filter(Boolean);
}

async function buildClosure(pool: Pool, scope: ClosureScope): Promise<Row> {
  const [soil, water, forecast, scenario, recommendation, approvalRequest, approvalDecision, operationPlan, transition, task, receipt, asExecuted, evidence, acceptance, waterResponseFact, waterResponseIndex] = await Promise.all([
    latestFact(pool, "soil_moisture_sensing_window_v1", scope),
    latestFact(pool, "water_state_estimate_v1", scope),
    latestFact(pool, "weather_forecast_fact_v1", scope),
    latestFact(pool, "irrigation_scenario_set_v1", scope),
    latestFact(pool, "decision_recommendation_v1", scope),
    latestFact(pool, "approval_request_v1", scope),
    latestFact(pool, "approval_decision_v1", scope),
    latestFact(pool, "operation_plan_v1", scope),
    latestFact(pool, "operation_plan_transition_v1", scope),
    latestFact(pool, "ao_act_task_v0", scope),
    latestFact(pool, "ao_act_receipt_v1", scope),
    latestFact(pool, "as_executed_record_v1", scope),
    latestFact(pool, "evidence_artifact_v1", scope),
    latestFact(pool, "acceptance_result_v1", scope),
    latestFact(pool, "water_response_verification_v1", scope),
    latestIndexRow(pool, "water_response_verification_index_v1", scope),
  ]);
  const waterResponse = waterResponseIndex ?? waterResponseFact;
  const waterResponsePayload = payloadOf(waterResponse);
  const inventoryTypes = ["soil_moisture_sensing_window_v1", "water_state_estimate_v1", "weather_forecast_fact_v1", "irrigation_scenario_set_v1", "decision_recommendation_v1", "approval_request_v1", "approval_decision_v1", "operation_plan_v1", "operation_plan_transition_v1", "ao_act_task_v0", "ao_act_receipt_v1", "as_executed_record_v1", "evidence_artifact_v1", "acceptance_result_v1", "water_response_verification_v1"];
  const factInventory = await Promise.all(inventoryTypes.map(async (type) => ({ source_kind: "fact", name: type, available: (await countFactRows(pool, type, scope)) > 0 })));
  const tableInventory = await Promise.all(["water_response_verification_index_v1", "soil_moisture_sensing_window_index_v1"].map(async (table) => ({ source_kind: "index", name: table, available: (await countTableRows(pool, table, scope)) > 0 })));
  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_TWIN_H31_H45_DEMO_CLOSURE",
    request_scope: scope,
    field_context: { field_id: scope.fieldId },
    source_inventory: [...factInventory, ...tableInventory],
    stage_groups: [
      stage("H31-H35", "Evidence / State / Forecast / Scenario / Recommendation", Boolean(soil && water && forecast && scenario && recommendation), refs(soil, water, forecast, scenario, recommendation), "H31-H35 evidence available"),
      stage("H36-H39", "Approval Request / Decision / Operation Plan / Transition", Boolean(approvalRequest && approvalDecision && operationPlan && transition), refs(approvalRequest, approvalDecision, operationPlan, transition), "H36-H39 approval and operation plan available"),
      stage("H40-H42", "AO-ACT Task / Receipt / As-Executed", Boolean(task && receipt && asExecuted), refs(task, receipt, asExecuted), "H40-H42 task, receipt, and as-executed available"),
      stage("H43-H44", "Evidence Artifact / Acceptance Result", Boolean(evidence && acceptance), refs(evidence, acceptance), "H43-H44 evidence and acceptance available"),
      stage("H45", "Water Response Verification", Boolean(waterResponse), refs(waterResponse), firstText(waterResponsePayload.status, waterResponsePayload.verification_status, "H45 response verification available")),
    ],
    execution_tail: {
      task_id: firstText(payloadOf(task).act_task_id, payloadOf(task).task_id),
      receipt_id: firstText(payloadOf(receipt).receipt_id, payloadOf(receipt).ao_act_receipt_id),
      as_executed_id: firstText(payloadOf(asExecuted).as_executed_id, payloadOf(asExecuted).record_id),
      acceptance_result_id: firstText(payloadOf(acceptance).acceptance_id, payloadOf(acceptance).acceptance_result_id),
      water_response_verification_id: firstText(waterResponsePayload.verification_id, waterResponse?.verification_id),
    },
    response_summary: {
      status: firstText(waterResponsePayload.status, waterResponsePayload.verification_status, waterResponse?.status, "UNKNOWN"),
      before_value: waterResponsePayload.before_value ?? waterResponsePayload.before_soil_moisture ?? waterResponse?.before_value ?? null,
      after_value: waterResponsePayload.after_value ?? waterResponsePayload.after_soil_moisture ?? waterResponse?.after_value ?? null,
      delta_value: waterResponsePayload.delta_value ?? waterResponsePayload.soil_moisture_delta ?? waterResponse?.delta_value ?? null,
      write_ready: false,
      roi_write_ready: false,
      field_memory_write_ready: false,
    },
    boundary_rules: [
      { rule_code: "READ_ONLY", label: "本端点只读，不创建 approval / dispatch / AO-ACT task。" },
      { rule_code: "NO_ROI_WRITE", label: "本端点不写 ROI ledger。" },
      { rule_code: "NO_FIELD_MEMORY_WRITE", label: "本端点不写 Field Memory。" },
      { rule_code: "NO_CUSTOMER_DELIVERY", label: "本端点不生成 customer delivery confirmed result。" },
    ],
  };
}

export function registerOperatorTwinH31H45ClosureRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/twin/fields/:fieldId/h31-h45-closure", async (req: any) => {
    const fieldId = normalizeFieldId(req?.params?.fieldId);
    const scope = extractScope(req, fieldId);
    const projection = hasTenantScope(scope)
      ? await buildClosure(pool, scope)
      : { version: "v1", surface: "OPERATOR", report_kind: "OPERATOR_TWIN_H31_H45_DEMO_CLOSURE", request_scope: scope, field_context: { field_id: fieldId }, source_inventory: [], stage_groups: [], execution_tail: {}, response_summary: { status: "SCOPE_REQUIRED", write_ready: false, roi_write_ready: false, field_memory_write_ready: false }, boundary_rules: [] };
    return {
      ok: true,
      source: "operator_twin_h31_h45_closure_api",
      dataScope: DATA_SCOPE,
      generated_at: new Date().toISOString(),
      writeReady: false,
      dispatchReady: false,
      approvalReady: false,
      taskCreationReady: false,
      memoryWriteReady: false,
      roiWriteReady: false,
      operator_twin_h31_h45_closure_v1: projection,
    };
  });
}
