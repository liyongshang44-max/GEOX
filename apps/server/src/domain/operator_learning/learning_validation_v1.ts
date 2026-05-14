import type { Pool } from "pg";

export type OperatorLearningValidationStatusV1 =
  | "FORMAL_LEARNING_ACCEPTED"
  | "TRUSTED_VALUE_ONLY"
  | "RAW_SIGNALS_ONLY"
  | "SIMULATED_OR_DEV_ONLY"
  | "INSUFFICIENT_FORMAL_CHAIN";

export type OperatorLearningValidationV1 = {
  operation_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  learning_effective: boolean;
  learning_validation_status: OperatorLearningValidationStatusV1;
  formal_memory_count: number;
  trusted_value_count: number;
  raw_signal_count: number;
  technical_memory_count: number;
  simulated_or_dev_count: number;
  gates: {
    formal_field_memory: boolean;
    trusted_value: boolean;
    raw_skill_signal_only: boolean;
    technical_memory_only: boolean;
    simulated_or_dev_present: boolean;
    formal_acceptance_required: boolean;
  };
  reasons: string[];
  customer_summary: {
    learned: string;
    excluded_data: string;
    no_learning_reason: string | null;
  };
  raw_counts: {
    field_memory_rows: number;
    roi_rows: number;
    skill_trace_rows: number;
  };
};

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type AnyRow = Record<string, any>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const q = await pool.query(`SELECT to_regclass($1)::text AS table_name`, [`public.${tableName}`]);
  return Boolean(q.rows?.[0]?.table_name);
}

async function safeQuery(pool: Pool, sql: string, values: unknown[]): Promise<AnyRow[]> {
  try {
    const q = await pool.query(sql, values);
    return q.rows ?? [];
  } catch {
    return [];
  }
}

function hasDevMarker(row: AnyRow): boolean {
  const raw = JSON.stringify(row ?? "").toLowerCase();
  return raw.includes("flight-table")
    || raw.includes("flight_table")
    || raw.includes("simulated_dev_only")
    || raw.includes("simulated")
    || raw.includes("dev_only")
    || raw.includes("sim_trace");
}

function isFormalMemory(row: AnyRow): boolean {
  return text(row.memory_lane).toUpperCase() === "FORMAL_FIELD_MEMORY"
    && text(row.trust_level).toUpperCase() === "FORMAL_ACCEPTED"
    && row.customer_visible_memory === true
    && row.learning_eligible === true
    && Boolean(text(row.formal_acceptance_id ?? row.acceptance_id));
}

function isTechnicalMemory(row: AnyRow): boolean {
  const lane = text(row.memory_lane).toUpperCase();
  const trust = text(row.trust_level).toUpperCase();
  return lane.startsWith("TECHNICAL_") || trust === "TECHNICAL_SIGNAL" || text(row.memory_type).toUpperCase() === "SKILL_PERFORMANCE_MEMORY";
}

function isTrustedValue(row: AnyRow): boolean {
  return row.customer_visible_value === true
    && text(row.trust_level).toUpperCase() === "FORMAL_ACCEPTED"
    && row.formal_evidence_passed === true
    && row.chain_validation_passed === true
    && Boolean(text(row.formal_acceptance_id));
}

function rawSkillSignalCount(rows: AnyRow[]): number {
  return rows.filter((row) => {
    const status = text(row.result_status ?? row.status ?? row.record_json?.payload?.result_status ?? row.record_json?.payload?.status).toUpperCase();
    return status === "SUCCESS" || status === "PASSED" || status === "DONE" || status === "OK";
  }).length;
}

async function loadFieldMemoryRows(pool: Pool, tenant: TenantTriple, operationId: string): Promise<AnyRow[]> {
  if (!(await tableExists(pool, "field_memory_v1"))) return [];
  return safeQuery(pool,
    `SELECT memory_id, memory_type, memory_lane, trust_level, formal_acceptance_id, source_lane, customer_visible_memory, learning_eligible, trust_reasons, acceptance_id, operation_id, field_id, evidence_refs, learning_excluded_reason
       FROM field_memory_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND operation_id=$4
      ORDER BY occurred_at DESC
      LIMIT 200`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationId]);
}

async function loadRoiRows(pool: Pool, tenant: TenantTriple, operationId: string): Promise<AnyRow[]> {
  if (!(await tableExists(pool, "roi_ledger_v1"))) return [];
  return safeQuery(pool,
    `SELECT roi_ledger_id, trust_level, source_lane, formal_acceptance_id, formal_evidence_passed, chain_validation_passed, customer_visible_value, trust_reasons, value_kind, operation_id, field_id
       FROM roi_ledger_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND operation_id=$4
      ORDER BY created_at DESC
      LIMIT 200`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationId]);
}

async function loadSkillRows(pool: Pool, tenant: TenantTriple, operationId: string): Promise<AnyRow[]> {
  if (!(await tableExists(pool, "facts"))) return [];
  return safeQuery(pool,
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') IN ('skill_run_v1','skill_trace_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (record_json::jsonb#>>'{payload,operation_id}')=$4
      ORDER BY occurred_at DESC
      LIMIT 200`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationId]);
}

export async function buildOperatorLearningValidationV1(pool: Pool, tenant: TenantTriple, operationIdRaw: string): Promise<OperatorLearningValidationV1> {
  const operation_id = text(operationIdRaw);
  const [memoryRows, roiRows, skillRows] = await Promise.all([
    loadFieldMemoryRows(pool, tenant, operation_id),
    loadRoiRows(pool, tenant, operation_id),
    loadSkillRows(pool, tenant, operation_id),
  ]);

  const formalMemoryCount = memoryRows.filter(isFormalMemory).length;
  const trustedValueCount = roiRows.filter(isTrustedValue).length;
  const technicalMemoryCount = memoryRows.filter(isTechnicalMemory).length;
  const simulatedOrDevCount = [...memoryRows, ...roiRows, ...skillRows].filter(hasDevMarker).length;
  const rawSignalCount = rawSkillSignalCount(skillRows) + technicalMemoryCount + roiRows.length;

  const reasons = new Set<string>();
  if (formalMemoryCount === 0) reasons.add("FORMAL_FIELD_MEMORY_REQUIRED");
  if (trustedValueCount === 0 && roiRows.length > 0) reasons.add("ROI_ROW_IS_NOT_FORMAL_LEARNING");
  if (technicalMemoryCount > 0) reasons.add("TECHNICAL_MEMORY_IS_RAW_SIGNAL");
  if (rawSkillSignalCount(skillRows) > 0) reasons.add("SKILL_RUN_IS_RAW_SIGNAL");
  if (simulatedOrDevCount > 0) reasons.add("SIMULATED_OR_DEV_SIGNAL_NOT_FORMAL");
  if (memoryRows.some((row) => !text(row.formal_acceptance_id ?? row.acceptance_id))) reasons.add("FORMAL_ACCEPTANCE_ID_REQUIRED");

  const learningEffective = formalMemoryCount > 0 && simulatedOrDevCount === 0;
  const status: OperatorLearningValidationStatusV1 = learningEffective
    ? "FORMAL_LEARNING_ACCEPTED"
    : simulatedOrDevCount > 0
      ? "SIMULATED_OR_DEV_ONLY"
      : trustedValueCount > 0
        ? "TRUSTED_VALUE_ONLY"
        : rawSignalCount > 0
          ? "RAW_SIGNALS_ONLY"
          : "INSUFFICIENT_FORMAL_CHAIN";

  return {
    operation_id,
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    learning_effective: learningEffective,
    learning_validation_status: status,
    formal_memory_count: formalMemoryCount,
    trusted_value_count: trustedValueCount,
    raw_signal_count: rawSignalCount,
    technical_memory_count: technicalMemoryCount,
    simulated_or_dev_count: simulatedOrDevCount,
    gates: {
      formal_field_memory: formalMemoryCount > 0,
      trusted_value: trustedValueCount > 0,
      raw_skill_signal_only: rawSkillSignalCount(skillRows) > 0 && formalMemoryCount === 0,
      technical_memory_only: technicalMemoryCount > 0 && formalMemoryCount === 0,
      simulated_or_dev_present: simulatedOrDevCount > 0,
      formal_acceptance_required: formalMemoryCount === 0,
    },
    reasons: Array.from(reasons),
    customer_summary: {
      learned: learningEffective
        ? `已通过正式学习门禁：${formalMemoryCount} 条正式田块记忆。`
        : "未通过正式学习门禁。",
      excluded_data: rawSignalCount > 0 || simulatedOrDevCount > 0
        ? `已降级 ${rawSignalCount + simulatedOrDevCount} 条技术/模拟/对象存在信号。`
        : "当前无可降级的技术学习信号。",
      no_learning_reason: learningEffective ? null : "缺少正式田块记忆、正式验收绑定或存在模拟/技术信号，不能判定学习已生效。",
    },
    raw_counts: {
      field_memory_rows: memoryRows.length,
      roi_rows: roiRows.length,
      skill_trace_rows: skillRows.length,
    },
  };
}
