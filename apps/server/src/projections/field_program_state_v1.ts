import type { Pool } from "pg";
import { AcceptanceResultV1PayloadSchema, type AcceptanceResultV1Payload } from "@geox/contracts";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type FieldProgramGoalProfileV1 = {
  yield_priority: string;
  quality_priority: string;
  residue_priority: string;
  water_saving_priority: string;
  cost_priority: string;
};

export type FieldProgramConstraintsV1 = {
  forbid_pesticide_classes: string[];
  forbid_fertilizer_types: string[];
  max_irrigation_mm_per_day: number | null;
  manual_approval_required_for: string[];
  allow_night_irrigation: boolean;
};

export type FieldProgramStageV1 =
  | "SETUP"
  | "EXECUTION_PENDING"
  | "EXECUTING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type FieldProgramRiskSummaryV1 = {
  level: "LOW" | "MEDIUM" | "HIGH";
  signals: string[];
  score: number | null;
  last_updated_ts: number;
};

export type FieldProgramStateV1 = {
  program_id: string;
  field_id: string;
  season_id: string;
  crop_code: string;
  variety_code: string | null;
  status: string;
  current_stage: FieldProgramStageV1;
  goal_profile: FieldProgramGoalProfileV1;
  constraints: FieldProgramConstraintsV1;
  latest_recommendation: {
    recommendation_id: string;
    recommendation_type: string;
    status: string;
    confidence: number | null;
    created_ts: number;
    fact_id: string;
  } | null;
  pending_operation_plan: {
    operation_plan_id: string;
    status: string;
    approval_request_id: string | null;
    act_task_id: string | null;
    updated_ts: number;
    fact_id: string;
  } | null;
  latest_acceptance_result: (AcceptanceResultV1Payload & { fact_id: string; created_ts: number }) | null;
  latest_evidence: {
    artifact_type: string;
    artifact_uri: string | null;
    artifact_sha256: string | null;
    created_ts: number;
    fact_id: string;
  } | null;
  current_risk_summary: FieldProgramRiskSummaryV1;
  last_event_ts: number;
};

export type FieldProgramProjectionFactRow = FactRow;

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function toMs(v: string | null | undefined): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: any): string {
  return String(v ?? "").trim();
}

function pickLatest(rows: FactRow[]): FactRow | null {
  if (!rows.length) return null;
  return rows.reduce((best, row) => (toMs(row.occurred_at) >= toMs(best.occurred_at) ? row : best));
}

function latestByKey(rows: FactRow[], keyFn: (row: FactRow) => string): Map<string, FactRow> {
  const out = new Map<string, FactRow>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const prev = out.get(key);
    if (!prev || toMs(row.occurred_at) >= toMs(prev.occurred_at)) out.set(key, row);
  }
  return out;
}

function isPendingOperationStatus(statusRaw: string): boolean {
  const s = statusRaw.toUpperCase();
  return ["CREATED", "PENDING_APPROVAL", "APPROVED", "READY", "DISPATCHED", "ACKED", "EXECUTING", "RUNNING", "IN_PROGRESS"].includes(s);
}

function deriveStage(programStatusRaw: string, pendingPlanStatus: string | null): FieldProgramStageV1 {
  const s = programStatusRaw.toUpperCase();
  if (s === "DRAFT") return "SETUP";
  if (s === "PAUSED") return "PAUSED";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "CANCELLED") return "CANCELLED";
  if (s === "ARCHIVED") return "ARCHIVED";
  if (pendingPlanStatus) {
    const ps = pendingPlanStatus.toUpperCase();
    if (["EXECUTING", "RUNNING", "IN_PROGRESS", "DISPATCHED", "ACKED"].includes(ps)) return "EXECUTING";
    return "EXECUTION_PENDING";
  }
  return "SETUP";
}

function riskLevelFromSignals(score: number | null, hasFailure: boolean, acceptanceVerdict: string | null): "LOW" | "MEDIUM" | "HIGH" {
  if (hasFailure) return "HIGH";
  if ((acceptanceVerdict ?? "").toUpperCase() === "FAIL") return "HIGH";
  if (score != null && score >= 0.75) return "HIGH";
  if (score != null && score >= 0.45) return "MEDIUM";
  return "LOW";
}

export function projectFieldProgramStateFromFacts(rows: FieldProgramProjectionFactRow[]): FieldProgramStateV1[] {
  const facts = rows.map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }));

  const programById = latestByKey(
    facts.filter((r) => r.record_json?.type === "field_program_v1"),
    (r) => str(r.record_json?.payload?.program_id)
  );
  const transitionsByProgram = new Map<string, FactRow[]>();
  for (const row of facts.filter((r) => r.record_json?.type === "field_program_transition_v1")) {
    const programId = str(row.record_json?.payload?.program_id);
    if (!programId) continue;
    const arr = transitionsByProgram.get(programId) ?? [];
    arr.push(row);
    transitionsByProgram.set(programId, arr);
  }

  const recommendationFacts = facts.filter((r) => r.record_json?.type === "decision_recommendation_v1");
  const operationPlanFacts = facts.filter((r) => r.record_json?.type === "operation_plan_v1");
  const acceptanceFacts = facts.filter((r) => r.record_json?.type === "acceptance_result_v1");
  const evidenceFacts = facts.filter((r) => r.record_json?.type === "evidence_pack_export_v1");

  const out: FieldProgramStateV1[] = [];
  for (const [programId, programRow] of programById.entries()) {
    const p = programRow.record_json?.payload ?? {};
    const fieldId = str(p.field_id);
    const seasonId = str(p.season_id);

    const latestTransition = pickLatest(transitionsByProgram.get(programId) ?? []);
    const currentStatus = str(latestTransition?.record_json?.payload?.status) || str(p.status) || "DRAFT";

    const recCandidates = recommendationFacts.filter((r) => {
      const rp = r.record_json?.payload ?? {};
      const recProgramId = str(rp.program_id);
      if (recProgramId) return recProgramId === programId;
      if (str(rp.field_id) !== fieldId) return false;
      if (seasonId && str(rp.season_id) && str(rp.season_id) !== seasonId) return false;
      return true;
    });
    const latestRecommendationRow = pickLatest(recCandidates);

    const pendingPlanCandidates = operationPlanFacts.filter((r) => {
      const op = r.record_json?.payload ?? {};
      const opProgramId = str(op.program_id);
      if (opProgramId && opProgramId !== programId) return false;
      if (!opProgramId) {
        const targetField = str(op?.target?.ref || op.field_id);
        if (targetField && fieldId && targetField !== fieldId) return false;
      }
      const recId = str(op.recommendation_id);
      if (!opProgramId && latestRecommendationRow && recId && recId !== str(latestRecommendationRow.record_json?.payload?.recommendation_id)) return false;
      return isPendingOperationStatus(str(op.status));
    });
    const pendingPlanRow = pickLatest(pendingPlanCandidates);

    const linkedFactIds = new Set<string>();
    linkedFactIds.add(programRow.fact_id);
    if (latestRecommendationRow) linkedFactIds.add(latestRecommendationRow.fact_id);
    if (pendingPlanRow) linkedFactIds.add(pendingPlanRow.fact_id);

    const latestAcceptance = pickLatest(acceptanceFacts.filter((r) => {
      const ap = r.record_json?.payload ?? {};
      if (str(ap.program_id) === programId) return true;
      const evidenceIds = Array.isArray(ap.evidence_fact_ids) ? ap.evidence_fact_ids.map((x: any) => str(x)) : [];
      return evidenceIds.some((id: string) => linkedFactIds.has(id));
    }));

    const latestEvidence = pickLatest(evidenceFacts.filter((r) => {
      const ep = r.record_json?.payload ?? {};
      if (str(ep.program_id) === programId) return true;
      if (fieldId && str(ep.field_id) === fieldId) return true;
      return false;
    }));

    const recPayload = latestRecommendationRow?.record_json?.payload ?? {};
    const recRiskScore = toNum(recPayload?.suggested_action?.parameters?.risk_score ?? recPayload?.confidence);
    const pendingStatus = str(pendingPlanRow?.record_json?.payload?.status) || null;
    const acceptanceVerdict = str(latestAcceptance?.record_json?.payload?.verdict) || null;
    const hasFailureSignal = ["FAILED", "ERROR", "REJECTED"].includes((pendingStatus ?? "").toUpperCase());
    const signals: string[] = [];
    if (pendingStatus) signals.push(`plan:${pendingStatus.toUpperCase()}`);
    if (acceptanceVerdict) signals.push(`acceptance:${acceptanceVerdict.toUpperCase()}`);
    if (recRiskScore != null) signals.push(`recommendation_risk_score:${recRiskScore.toFixed(3)}`);

    const riskSummary: FieldProgramRiskSummaryV1 = {
      level: riskLevelFromSignals(recRiskScore, hasFailureSignal, acceptanceVerdict),
      signals,
      score: recRiskScore,
      last_updated_ts: Math.max(
        toMs(programRow.occurred_at),
        latestTransition ? toMs(latestTransition.occurred_at) : 0,
        latestRecommendationRow ? toMs(latestRecommendationRow.occurred_at) : 0,
        pendingPlanRow ? toMs(pendingPlanRow.occurred_at) : 0,
        latestAcceptance ? toMs(latestAcceptance.occurred_at) : 0,
        latestEvidence ? toMs(latestEvidence.occurred_at) : 0
      )
    };

    out.push({
      program_id: programId,
      field_id: fieldId,
      season_id: seasonId,
      crop_code: str(p.crop_code),
      variety_code: str(p.variety_code) || null,
      status: currentStatus,
      current_stage: deriveStage(currentStatus, pendingStatus),
      goal_profile: {
        yield_priority: str(p?.goal_profile?.yield_priority),
        quality_priority: str(p?.goal_profile?.quality_priority),
        residue_priority: str(p?.goal_profile?.residue_priority),
        water_saving_priority: str(p?.goal_profile?.water_saving_priority),
        cost_priority: str(p?.goal_profile?.cost_priority)
      },
      constraints: {
        forbid_pesticide_classes: Array.isArray(p?.constraints?.forbid_pesticide_classes) ? p.constraints.forbid_pesticide_classes.map((x: any) => str(x)).filter(Boolean) : [],
        forbid_fertilizer_types: Array.isArray(p?.constraints?.forbid_fertilizer_types) ? p.constraints.forbid_fertilizer_types.map((x: any) => str(x)).filter(Boolean) : [],
        max_irrigation_mm_per_day: toNum(p?.constraints?.max_irrigation_mm_per_day),
        manual_approval_required_for: Array.isArray(p?.constraints?.manual_approval_required_for) ? p.constraints.manual_approval_required_for.map((x: any) => str(x)).filter(Boolean) : [],
        allow_night_irrigation: Boolean(p?.constraints?.allow_night_irrigation)
      },
      latest_recommendation: latestRecommendationRow ? {
        recommendation_id: str(recPayload.recommendation_id),
        recommendation_type: str(recPayload.recommendation_type),
        status: str(recPayload.status),
        confidence: toNum(recPayload.confidence),
        created_ts: toNum(recPayload.created_ts) ?? toMs(latestRecommendationRow.occurred_at),
        fact_id: latestRecommendationRow.fact_id
      } : null,
      pending_operation_plan: pendingPlanRow ? {
        operation_plan_id: str(pendingPlanRow.record_json?.payload?.operation_plan_id),
        status: str(pendingPlanRow.record_json?.payload?.status),
        approval_request_id: str(pendingPlanRow.record_json?.payload?.approval_request_id) || null,
        act_task_id: str(pendingPlanRow.record_json?.payload?.act_task_id) || null,
        updated_ts: toNum(pendingPlanRow.record_json?.payload?.updated_ts) ?? toMs(pendingPlanRow.occurred_at),
        fact_id: pendingPlanRow.fact_id
      } : null,
      latest_acceptance_result: latestAcceptance ? (() => {
        const payload = AcceptanceResultV1PayloadSchema.safeParse(latestAcceptance.record_json?.payload);
        if (!payload.success) return null;
        return { ...payload.data, created_ts: toMs(payload.data.evaluated_at) || toMs(latestAcceptance.occurred_at), fact_id: latestAcceptance.fact_id };
      })() : null,
      latest_evidence: latestEvidence ? {
        artifact_type: str(latestEvidence.record_json?.payload?.artifact_type) || "evidence_pack_export_v1",
        artifact_uri: str(latestEvidence.record_json?.payload?.artifact_path ?? latestEvidence.record_json?.payload?.artifact_uri) || null,
        artifact_sha256: str(latestEvidence.record_json?.payload?.artifact_sha256) || null,
        created_ts: toNum(latestEvidence.record_json?.payload?.created_ts) ?? toMs(latestEvidence.occurred_at),
        fact_id: latestEvidence.fact_id
      } : null,
      current_risk_summary: riskSummary,
      last_event_ts: riskSummary.last_updated_ts
    });
  }

  return out.sort((a, b) => b.last_event_ts - a.last_event_ts);
}

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN (
      'field_program_v1','field_program_transition_v1',
      'decision_recommendation_v1','operation_plan_v1',
      'acceptance_result_v1','evidence_pack_export_v1'
    )
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: str(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
}

export async function projectFieldProgramStateV1(pool: Pool, tenant: TenantTriple): Promise<FieldProgramStateV1[]> {
  const facts = await loadFacts(pool, tenant);
  return projectFieldProgramStateFromFacts(facts);
}
