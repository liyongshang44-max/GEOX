import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { FieldMemoryTypeV1, FieldMemoryV1 } from "@geox/contracts";

type DbConn = Pool | PoolClient;

type FieldMemoryLaneV1 =
  | "FORMAL_FIELD_MEMORY"
  | "TECHNICAL_SKILL_MEMORY"
  | "TECHNICAL_EXECUTION_MEMORY"
  | "SIMULATED_DEV_MEMORY"
  | "DIAGNOSTIC_NOTE";

type FieldMemoryTrustLevelV1 =
  | "FORMAL_ACCEPTED"
  | "TECHNICAL_SIGNAL"
  | "SIMULATED_DEV_ONLY"
  | "INSUFFICIENT_FORMAL_EVIDENCE";

type RecordMemoryInput = {
  type: "operation_outcome" | "execution_reliability" | "skill_performance" | FieldMemoryTypeV1;
  project_id?: string;
  group_id?: string;
  operation_id?: string;
  field_id: string;
  metrics?: Record<string, unknown>;
  skill_refs?: Array<{ skill_id?: string; skill_version?: string; skill_run_id?: string; trace_id?: string }>;
  skill_id?: string;
  evidence_refs?: unknown[];
  prescription_id?: string;
  recommendation_id?: string;
  summary?: string;
  season_id?: string;
  task_id?: string;
  acceptance_id?: string;
  roi_id?: string;
  skill_trace_ref?: string;
  weather_interference_detected?: boolean;
  learning_excluded_reason?: string;
  memory_lane?: FieldMemoryLaneV1;
  trust_level?: FieldMemoryTrustLevelV1;
  formal_acceptance_id?: string | null;
  source_lane?: string | null;
  customer_visible_memory?: boolean;
  learning_eligible?: boolean;
  trust_reasons?: string[];
  memory_id?: string;
  source_type?: string;
  source_id?: string;
};

export function normalizeMemoryType(type: string): FieldMemoryTypeV1 {
  if (type === "operation_outcome") return "FIELD_RESPONSE_MEMORY";
  if (type === "execution_reliability") return "DEVICE_RELIABILITY_MEMORY";
  if (type === "skill_performance") return "SKILL_PERFORMANCE_MEMORY";
  return type as FieldMemoryTypeV1;
}

function num(v: unknown): number | undefined { const n = Number(v); return Number.isFinite(n) ? n : undefined; }

function parseJsonMaybe(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function textOrNull(v: unknown): string | null {
  if (v == null) return null;
  const raw = String(v).trim();
  return raw || null;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const raw = String(v ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function hasDevMarker(input: RecordMemoryInput): boolean {
  const raw = JSON.stringify(input ?? "").toLowerCase();
  return raw.includes("flight-table")
    || raw.includes("flight_table")
    || raw.includes("simulated_dev_only")
    || raw.includes("irrigation_simulator")
    || raw.includes("sim_trace")
    || raw.includes("flight_table_dev");
}

function isFormalAcceptanceSource(sourceLane: string | null): boolean {
  const lane = String(sourceLane ?? "").trim().toUpperCase();
  return lane === "FORMAL_ACCEPTANCE" || lane === "FORMAL_OPERATION";
}

function classifyMemoryLaneV1(memory_type: FieldMemoryTypeV1, input: RecordMemoryInput): {
  memory_lane: FieldMemoryLaneV1;
  trust_level: FieldMemoryTrustLevelV1;
  formal_acceptance_id: string | null;
  source_lane: string | null;
  customer_visible_memory: boolean;
  learning_eligible: boolean;
  trust_reasons: string[];
} {
  const explicitLane = input.memory_lane;
  const explicitTrust = input.trust_level;
  const formalAcceptanceId = String(input.formal_acceptance_id ?? "").trim() || null;
  const legacyAcceptanceId = String(input.acceptance_id ?? "").trim() || null;
  const sourceLane = String(input.source_lane ?? "").trim() || null;
  const reasons: string[] = Array.isArray(input.trust_reasons) ? [...input.trust_reasons] : [];

  if (hasDevMarker(input) || explicitLane === "SIMULATED_DEV_MEMORY" || explicitTrust === "SIMULATED_DEV_ONLY") {
    return {
      memory_lane: "SIMULATED_DEV_MEMORY",
      trust_level: "SIMULATED_DEV_ONLY",
      formal_acceptance_id: formalAcceptanceId,
      source_lane: sourceLane ?? "FLIGHT_TABLE_DEV",
      customer_visible_memory: false,
      learning_eligible: false,
      trust_reasons: Array.from(new Set([...reasons, "SIMULATED_OR_DEV_MEMORY"])),
    };
  }

  const explicitFormalMemoryRequested = explicitLane === "FORMAL_FIELD_MEMORY" || explicitTrust === "FORMAL_ACCEPTED" || input.customer_visible_memory === true || input.learning_eligible === true;
  const formalLaneAllowed = explicitLane === "FORMAL_FIELD_MEMORY"
    && explicitTrust === "FORMAL_ACCEPTED"
    && Boolean(formalAcceptanceId)
    && isFormalAcceptanceSource(sourceLane);

  if (explicitFormalMemoryRequested) {
    if (formalLaneAllowed) {
      return {
        memory_lane: "FORMAL_FIELD_MEMORY",
        trust_level: "FORMAL_ACCEPTED",
        formal_acceptance_id: formalAcceptanceId,
        source_lane: sourceLane,
        customer_visible_memory: input.customer_visible_memory === true,
        learning_eligible: input.learning_eligible === true && input.customer_visible_memory === true,
        trust_reasons: Array.from(new Set(reasons)),
      };
    }
    return {
      memory_lane: memory_type === "SKILL_PERFORMANCE_MEMORY" ? "TECHNICAL_SKILL_MEMORY" : memory_type === "DEVICE_RELIABILITY_MEMORY" || memory_type === "EXECUTION_QUALITY_MEMORY" ? "TECHNICAL_EXECUTION_MEMORY" : "DIAGNOSTIC_NOTE",
      trust_level: "INSUFFICIENT_FORMAL_EVIDENCE",
      formal_acceptance_id: formalAcceptanceId,
      source_lane: sourceLane ?? "MANUAL_IMPORT",
      customer_visible_memory: false,
      learning_eligible: false,
      trust_reasons: Array.from(new Set([...reasons, "FORMAL_MEMORY_REQUIRES_EXPLICIT_FORMAL_ACCEPTANCE_GATE", ...(legacyAcceptanceId && !formalAcceptanceId ? ["LEGACY_ACCEPTANCE_ID_NOT_FORMAL_ACCEPTANCE_ID"] : [])])),
    };
  }

  if (memory_type === "SKILL_PERFORMANCE_MEMORY") {
    return {
      memory_lane: "TECHNICAL_SKILL_MEMORY",
      trust_level: "TECHNICAL_SIGNAL",
      formal_acceptance_id: null,
      source_lane: sourceLane ?? "SKILL_TECHNICAL",
      customer_visible_memory: false,
      learning_eligible: false,
      trust_reasons: Array.from(new Set([...reasons, "SKILL_RUN_IS_NOT_FORMAL_FIELD_LEARNING"])),
    };
  }

  if (memory_type === "DEVICE_RELIABILITY_MEMORY" || memory_type === "EXECUTION_QUALITY_MEMORY") {
    return {
      memory_lane: "TECHNICAL_EXECUTION_MEMORY",
      trust_level: "TECHNICAL_SIGNAL",
      formal_acceptance_id: null,
      source_lane: sourceLane ?? "AS_EXECUTED_SIGNAL",
      customer_visible_memory: false,
      learning_eligible: false,
      trust_reasons: Array.from(new Set([...reasons, "EXECUTION_SIGNAL_IS_NOT_FORMAL_FIELD_LEARNING"])),
    };
  }

  return {
    memory_lane: "DIAGNOSTIC_NOTE",
    trust_level: "TECHNICAL_SIGNAL",
    formal_acceptance_id: formalAcceptanceId,
    source_lane: sourceLane ?? "DIAGNOSTIC_NOTE",
    customer_visible_memory: false,
    learning_eligible: false,
    trust_reasons: Array.from(new Set([...reasons, "DIAGNOSTIC_NOTE_NOT_FORMAL_FIELD_LEARNING"])),
  };
}

function sourceTypeForMemory(memory_type: FieldMemoryTypeV1): string {
  if (memory_type === "FIELD_RESPONSE_MEMORY") return "acceptance";
  if (memory_type === "SKILL_PERFORMANCE_MEMORY") return "skill_run";
  if (memory_type === "DEVICE_RELIABILITY_MEMORY" || memory_type === "EXECUTION_QUALITY_MEMORY") return "execution_signal";
  return "diagnostic_note";
}


type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type AcceptanceResultForMemoryV1 = {
  fact_id: string;
  occurred_at: string | null;
  payload: any;
};

type ObservationPairV1 = {
  before_soil_moisture: number;
  after_soil_moisture: number;
  soil_moisture_delta: number;
  evidence_refs: unknown[];
  source: string;
};

function finiteFromKeys(source: any, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = num(source?.[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeEvidenceRefs(value: unknown): unknown[] {
  return Array.isArray(value) ? value.filter((item) => item != null) : [];
}

async function tableExists(db: DbConn, tableName: string): Promise<boolean> {
  const q = await db.query(`SELECT to_regclass($1)::text AS table_name`, [`public.${tableName}`]);
  return Boolean((q.rows?.[0] as any)?.table_name);
}

async function loadAcceptanceResultForMemoryV1(db: DbConn, tenant: TenantTriple, input: { operation_plan_id: string; acceptance_id: string }): Promise<AcceptanceResultForMemoryV1 | null> {
  const q = await db.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
        AND COALESCE(record_json::jsonb#>>'{payload,acceptance_id}', fact_id) = $4
        AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $5
        AND COALESCE(record_json::jsonb#>>'{payload,tenant_id}', $1) = $1
        AND COALESCE(record_json::jsonb#>>'{payload,project_id}', $2) = $2
        AND COALESCE(record_json::jsonb#>>'{payload,group_id}', $3) = $3
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, input.acceptance_id, input.operation_plan_id]
  );
  const row = q.rows?.[0] as any;
  if (!row) return null;
  return { fact_id: String(row.fact_id ?? ""), occurred_at: row.occurred_at == null ? null : String(row.occurred_at), payload: parseJsonMaybe(row.record_json)?.payload ?? {} };
}

function acceptanceGateBool(payload: any, key: string): boolean {
  return bool(payload?.[key] ?? payload?.formal_gate?.[key]);
}

function validateFormalFieldMemoryAcceptanceV1(payload: any): void {
  if (String(payload?.verdict ?? "").trim().toUpperCase() !== "PASS") throw new Error("ACCEPTANCE_VERDICT_NOT_PASS");
  if (acceptanceGateBool(payload, "formal_acceptance") !== true) throw new Error("ACCEPTANCE_NOT_FORMAL");
  if (acceptanceGateBool(payload, "formal_evidence_passed") !== true) throw new Error("FORMAL_EVIDENCE_NOT_PASSED");
  if (acceptanceGateBool(payload, "chain_validation_passed") !== true) throw new Error("CHAIN_VALIDATION_NOT_PASSED");
}

function observationPairFromPayload(payload: any, evidenceRef: unknown, source: string): ObservationPairV1 | null {
  const observed = payload?.observed_parameters ?? payload?.metrics ?? payload ?? {};
  let before = finiteFromKeys(observed, ["pre_soil_moisture", "before_soil_moisture", "soil_moisture_before", "before_value", "soil_moisture_before_percent", "soil_moisture_percent_before"]);
  let after = finiteFromKeys(observed, ["post_soil_moisture", "after_soil_moisture", "soil_moisture_after", "after_value", "soil_moisture_after_percent", "soil_moisture_percent_after"]);
  const delta = finiteFromKeys(observed, ["soil_moisture_delta", "moisture_delta", "telemetry_delta", "delta_value", "delta_percent"]);
  if (before !== undefined && after === undefined && delta !== undefined) after = before + delta;
  if (after !== undefined && before === undefined && delta !== undefined) before = after - delta;
  if (before === undefined || after === undefined) return null;
  return {
    before_soil_moisture: before,
    after_soil_moisture: after,
    soil_moisture_delta: delta ?? after - before,
    evidence_refs: evidenceRef == null ? [] : [evidenceRef],
    source,
  };
}

async function loadAcceptanceObservationPairV1(acceptance: AcceptanceResultForMemoryV1): Promise<ObservationPairV1 | null> {
  const payload = acceptance.payload ?? {};
  const candidates = [
    payload?.metrics,
    payload?.observed_parameters,
    payload?.formal_gate?.metrics,
    payload,
  ];
  for (const candidate of candidates) {
    const pair = observationPairFromPayload(candidate, { kind: "acceptance_fact", ref: acceptance.fact_id }, "acceptance_result_payload");
    if (pair) return pair;
  }
  return null;
}

async function loadEvidenceArtifactObservationPairV1(db: DbConn, tenant: TenantTriple, acceptance: AcceptanceResultForMemoryV1, operationPlanId: string): Promise<ObservationPairV1 | null> {
  const payload = acceptance.payload ?? {};
  const evidenceRefs = normalizeEvidenceRefs(payload.evidence_refs).map((ref) => String(ref).trim()).filter(Boolean);
  if (evidenceRefs.length === 0) return null;
  const q = await db.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'evidence_artifact_v1'
        AND (
          fact_id = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,evidence_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,artifact_id}') = ANY($4::text[])
        )
        AND COALESCE(record_json::jsonb#>>'{payload,operation_plan_id}', record_json::jsonb#>>'{payload,operation_id}', $5) = $5
        AND COALESCE(record_json::jsonb#>>'{payload,tenant_id}', $1) = $1
        AND COALESCE(record_json::jsonb#>>'{payload,project_id}', $2) = $2
        AND COALESCE(record_json::jsonb#>>'{payload,group_id}', $3) = $3
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 10`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, evidenceRefs, operationPlanId]
  );
  for (const row of q.rows ?? []) {
    const fact = parseJsonMaybe((row as any).record_json) ?? {};
    const factPayload = fact.payload ?? {};
    const candidates = [factPayload?.metrics, factPayload?.observed_parameters, factPayload?.metric_payload, factPayload];
    for (const candidate of candidates) {
      const pair = observationPairFromPayload(candidate, { kind: "evidence_artifact", ref: String((row as any).fact_id ?? "") }, "evidence_artifact_metric_payload");
      if (pair) return pair;
    }
  }
  return null;
}

async function loadReceiptObservationPairV1(db: DbConn, tenant: TenantTriple, acceptance: AcceptanceResultForMemoryV1, operationPlanId: string): Promise<ObservationPairV1 | null> {
  const payload = acceptance.payload ?? {};
  const evidenceRefs = normalizeEvidenceRefs(payload.evidence_refs).map((ref) => String(ref).trim()).filter(Boolean);
  const q = await db.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
        AND (
          (cardinality($4::text[]) > 0 AND fact_id = ANY($4::text[]))
          OR (record_json::jsonb#>>'{payload,act_task_id}') = $5
          OR (record_json::jsonb#>>'{payload,task_id}') = $5
          OR (record_json::jsonb#>>'{payload,operation_plan_id}') = $6
        )
        AND COALESCE(record_json::jsonb#>>'{payload,tenant_id}', $1) = $1
        AND COALESCE(record_json::jsonb#>>'{payload,project_id}', $2) = $2
        AND COALESCE(record_json::jsonb#>>'{payload,group_id}', $3) = $3
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 5`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, evidenceRefs, String(payload?.act_task_id ?? payload?.task_id ?? "").trim(), operationPlanId]
  );
  for (const row of q.rows ?? []) {
    const fact = parseJsonMaybe((row as any).record_json) ?? {};
    const pair = observationPairFromPayload(fact.payload ?? {}, { kind: "receipt_fact", ref: String((row as any).fact_id ?? "") }, "receipt_observed_parameters");
    if (pair) return pair;
  }
  return null;
}

async function loadDeviceObservationPairV1(db: DbConn, tenant: TenantTriple, fieldId: string): Promise<ObservationPairV1 | null> {
  if (!fieldId || !(await tableExists(db, "device_observation_index_v1"))) return null;
  const q = await db.query(
    `SELECT fact_id, value_num, metric, observed_at_ts_ms
       FROM device_observation_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND metric IN ('soil_moisture_percent', 'soil_moisture_after_percent', 'soil_moisture', 'soil_moisture_pct', 'soil_moisture_vwc', 'moisture_pct')
        AND value_num IS NOT NULL
      ORDER BY observed_at_ts_ms DESC
      LIMIT 2`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldId]
  );
  const rows = q.rows ?? [];
  if (rows.length < 2) return null;
  const afterRow = rows[0] as any;
  const beforeRow = rows[1] as any;
  const before = num(beforeRow.value_num);
  const after = num(afterRow.value_num);
  if (before === undefined || after === undefined) return null;
  return {
    before_soil_moisture: before,
    after_soil_moisture: after,
    soil_moisture_delta: after - before,
    evidence_refs: [
      { kind: "device_observation", ref: String(beforeRow.fact_id ?? ""), role: "before" },
      { kind: "device_observation", ref: String(afterRow.fact_id ?? ""), role: "after" },
    ],
    source: "device_observation_index_v1",
  };
}

async function findExistingFormalFieldMemoryV1(db: DbConn, tenant: TenantTriple, formalAcceptanceId: string): Promise<any | null> {
  const q = await db.query(
    `SELECT memory_id, tenant_id, project_id, group_id, field_id, operation_id, memory_type, metric_key, metric_value,
            before_value, after_value, delta_value, confidence, summary_text, evidence_refs, source_id, source_type,
            skill_id, skill_trace_ref, weather_interference_detected, learning_excluded_reason, memory_lane,
            trust_level, formal_acceptance_id, source_lane, customer_visible_memory, learning_eligible, trust_reasons,
            occurred_at
       FROM field_memory_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND formal_acceptance_id = $4
        AND memory_type = 'FIELD_RESPONSE_MEMORY'
        AND memory_lane = 'FORMAL_FIELD_MEMORY'
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, formalAcceptanceId]
  );
  return q.rows?.[0] ?? null;
}

function memoryIdFromOperation(operationId: string): string {
  return String(operationId || "")
    .replace(/^op_plan_/, "fm_")
    .replace("_formal_", "_response_");
}

export async function createFormalFieldMemoryFromAcceptanceV1(db: DbConn, tenant: TenantTriple, input: {
  operation_plan_id: string;
  acceptance_id: string;
}): Promise<{ idempotent: boolean; acceptance: { acceptance_id: string; operation_plan_id: string; verdict: string }; field_memory: any }> {
  const acceptance = await loadAcceptanceResultForMemoryV1(db, tenant, input);
  if (!acceptance) throw new Error("ACCEPTANCE_NOT_FOUND");
  validateFormalFieldMemoryAcceptanceV1(acceptance.payload);

  const formalAcceptanceId = textOrNull(acceptance.payload?.acceptance_id) ?? acceptance.fact_id;
  const existing = await findExistingFormalFieldMemoryV1(db, tenant, formalAcceptanceId);
  if (existing) {
    return {
      idempotent: true,
      acceptance: { acceptance_id: formalAcceptanceId, operation_plan_id: input.operation_plan_id, verdict: String(acceptance.payload?.verdict ?? "") },
      field_memory: existing,
    };
  }

  const fieldId = textOrNull(acceptance.payload?.field_id);
  if (!fieldId) throw new Error("ACCEPTANCE_FIELD_ID_MISSING");
  const acceptancePair = await loadAcceptanceObservationPairV1(acceptance);
  const evidencePair = acceptancePair ?? await loadEvidenceArtifactObservationPairV1(db, tenant, acceptance, input.operation_plan_id);
  const receiptPair = evidencePair ?? await loadReceiptObservationPairV1(db, tenant, acceptance, input.operation_plan_id);
  const observationPair = receiptPair ?? await loadDeviceObservationPairV1(db, tenant, fieldId);
  if (!observationPair) throw new Error("OBSERVATION_PAIR_NOT_FOUND");

  const evidenceRefs = normalizeEvidenceRefs([
    { kind: "acceptance_fact", ref: acceptance.fact_id, acceptance_id: formalAcceptanceId },
    ...normalizeEvidenceRefs(acceptance.payload?.evidence_refs),
    ...observationPair.evidence_refs,
  ]);

  const memory = await recordMemoryV1(db, tenant.tenant_id, {
    type: "FIELD_RESPONSE_MEMORY",
    memory_id: memoryIdFromOperation(input.operation_plan_id),
    source_type: "acceptance_result_v1",
    source_id: formalAcceptanceId,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    operation_id: input.operation_plan_id,
    task_id: textOrNull(acceptance.payload?.act_task_id ?? acceptance.payload?.task_id) ?? undefined,
    field_id: fieldId,
    acceptance_id: formalAcceptanceId,
    formal_acceptance_id: formalAcceptanceId,
    memory_lane: "FORMAL_FIELD_MEMORY",
    trust_level: "FORMAL_ACCEPTED",
    source_lane: "FORMAL_OPERATION",
    customer_visible_memory: true,
    learning_eligible: true,
    trust_reasons: ["FORMAL_ACCEPTANCE_PASS", "FORMAL_FIELD_OBSERVATION_PAIR_FOUND"],
    metrics: {
      before_soil_moisture: observationPair.before_soil_moisture,
      after_soil_moisture: observationPair.after_soil_moisture,
      soil_moisture_delta: observationPair.soil_moisture_delta,
      target_range: acceptance.payload?.metrics?.target_range ?? { min: 0.22, max: 0.28 },
      success: true,
      acceptance_passed: true,
      observation_source: observationPair.source,
    },
    evidence_refs: evidenceRefs,
    summary: `Formal field response memory from acceptance ${formalAcceptanceId}`,
  });

  return {
    idempotent: false,
    acceptance: { acceptance_id: formalAcceptanceId, operation_plan_id: input.operation_plan_id, verdict: String(acceptance.payload?.verdict ?? "") },
    field_memory: memory,
  };
}

export async function recordMemoryV1(db: DbConn, tenant_id: string, input: RecordMemoryInput): Promise<FieldMemoryV1> {
  const memory_type = normalizeMemoryType(input.type);
  const memory_id = String(input.memory_id ?? "").trim() || crypto.randomUUID();
  const metrics = input.metrics ?? {};
  const before_value = num((metrics as any).before_soil_moisture ?? (metrics as any).before_value);
  const after_value = num((metrics as any).after_soil_moisture ?? (metrics as any).after_value);
  const delta_value = num((metrics as any).soil_moisture_delta ?? (after_value != null && before_value != null ? after_value - before_value : undefined));
  const confidence = num((metrics as any).confidence) ?? 0.8;
  const skill_refs = Array.isArray(input.skill_refs) ? input.skill_refs : [];
  const firstSkillRef = skill_refs.find((x: any) => String(x?.skill_id ?? "").trim());
  const skill_id = String(input.skill_id ?? "").trim() || String(firstSkillRef?.skill_id ?? "").trim() || undefined;
  const skill_trace_ref = String(input.skill_trace_ref ?? "").trim() || String(firstSkillRef?.trace_id ?? firstSkillRef?.skill_run_id ?? "").trim() || undefined;
  const metric_key = memory_type === "FIELD_RESPONSE_MEMORY" ? "soil_moisture_response" : memory_type === "DEVICE_RELIABILITY_MEMORY" ? "valve_response_status" : "irrigation_skill_outcome";
  const metric_value = memory_type === "DEVICE_RELIABILITY_MEMORY" ? ((metrics as any).success === false ? 0 : 1) : undefined;
  const summary_text = input.summary?.trim() || `Field memory recorded: ${memory_type}`;
  const occurred_at = new Date().toISOString();
  const trust = classifyMemoryLaneV1(memory_type, input);
  const source_type = String(input.source_type ?? "").trim() || sourceTypeForMemory(memory_type);
  const source_id = String(input.source_id ?? "").trim() || trust.formal_acceptance_id ?? input.operation_id ?? skill_trace_ref ?? memory_id;

  await db.query(
    `INSERT INTO field_memory_v1 (
      memory_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, memory_type, metric_key, metric_value, metric_unit,
      before_value, after_value, baseline_value, delta_value, target_range, confidence, source_type, source_id,
      operation_id, recommendation_id, prescription_id, task_id, acceptance_id, roi_id, skill_id, skill_trace_ref,
      evidence_refs, summary_text, weather_interference_detected, learning_excluded_reason,
      memory_lane, trust_level, formal_acceptance_id, source_lane, customer_visible_memory, learning_eligible, trust_reasons,
      occurred_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,$16::jsonb,$17,$18,$19,
      $20,$21,$22,$23,$24,$25,$26,$27,
      $28::jsonb,$29,$30,$31,
      $32,$33,$34,$35,$36,$37,$38::jsonb,
      $39
    )`,
    [
      memory_id, tenant_id, input.project_id ?? "projectA", input.group_id ?? "groupA", input.field_id, input.season_id ?? null, null,
      memory_type, metric_key, metric_value ?? null, null, before_value ?? null, after_value ?? null, null, delta_value ?? null,
      JSON.stringify((metrics as any).target_range ?? null), confidence, source_type,
      source_id, input.operation_id ?? null, input.recommendation_id ?? null,
      input.prescription_id ?? null, input.task_id ?? null, input.acceptance_id ?? null, input.roi_id ?? null, skill_id,
      skill_trace_ref, JSON.stringify(input.evidence_refs ?? []), summary_text,
      input.weather_interference_detected ?? null, input.learning_excluded_reason ?? null,
      trust.memory_lane, trust.trust_level, trust.formal_acceptance_id, trust.source_lane, trust.customer_visible_memory, trust.learning_eligible, JSON.stringify(trust.trust_reasons),
      occurred_at,
    ],
  );

  return {
    memory_id, tenant_id, project_id: input.project_id ?? "projectA", group_id: input.group_id ?? "groupA", field_id: input.field_id, season_id: input.season_id, memory_type,
    metric_key, metric_value, before_value, after_value, delta_value, confidence,
    source_type, source_id,
    operation_id: input.operation_id, recommendation_id: input.recommendation_id, prescription_id: input.prescription_id,
    task_id: input.task_id, acceptance_id: input.acceptance_id, roi_id: input.roi_id,
    skill_id, skill_trace_ref, evidence_refs: input.evidence_refs ?? [], summary_text,
    weather_interference_detected: input.weather_interference_detected,
    learning_excluded_reason: input.learning_excluded_reason,
    memory_lane: trust.memory_lane,
    trust_level: trust.trust_level,
    formal_acceptance_id: trust.formal_acceptance_id,
    source_lane: trust.source_lane,
    customer_visible_memory: trust.customer_visible_memory,
    learning_eligible: trust.learning_eligible,
    trust_reasons: trust.trust_reasons,
    occurred_at, created_at: occurred_at,
  };
}
