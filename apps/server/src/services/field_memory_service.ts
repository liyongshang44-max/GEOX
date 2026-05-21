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
};

export function normalizeMemoryType(type: string): FieldMemoryTypeV1 {
  if (type === "operation_outcome") return "FIELD_RESPONSE_MEMORY";
  if (type === "execution_reliability") return "DEVICE_RELIABILITY_MEMORY";
  if (type === "skill_performance") return "SKILL_PERFORMANCE_MEMORY";
  return type as FieldMemoryTypeV1;
}

function num(v: unknown): number | undefined { const n = Number(v); return Number.isFinite(n) ? n : undefined; }

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

export async function recordMemoryV1(db: DbConn, tenant_id: string, input: RecordMemoryInput): Promise<FieldMemoryV1> {
  const memory_type = normalizeMemoryType(input.type);
  const memory_id = crypto.randomUUID();
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
  const source_type = sourceTypeForMemory(memory_type);
  const source_id = trust.formal_acceptance_id ?? input.operation_id ?? skill_trace_ref ?? memory_id;

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
