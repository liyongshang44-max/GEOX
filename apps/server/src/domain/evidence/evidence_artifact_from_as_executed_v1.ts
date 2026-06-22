import { createHash } from "node:crypto";

export type EvidencePointerSourceV1 = "evidence_ref" | "receipt_ref" | "log_ref";
export type EvidenceArtifactSubmissionStatusV1 = "EVIDENCE_ARTIFACTS_RECORDED" | "REJECTED_AS_EXECUTED_NOT_FOUND" | "REJECTED_SCOPE_MISMATCH" | "REJECTED_NO_EVIDENCE_POINTERS" | "REJECTED_DEV_EVIDENCE_NOT_FORMAL" | "REJECTED_DUPLICATE" | "REJECTED_INVALID_INPUT";

type ArtifactInput = { source_ref_kind: EvidencePointerSourceV1; kind: string; ref: string };

export type OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1 = {
  version: "v1"; surface: "OPERATOR"; submission_id: string; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null; operator_id: string; idempotency_key: string; materialization_reason: string; as_executed_id: string; task_id: string; receipt_id: string; operation_plan_id: string | null; evidence_artifact_ids: string[]; evidence_artifact_fact_ids: string[]; status: EvidenceArtifactSubmissionStatusV1; evidence_artifacts_created: boolean; acceptance_created: false; water_response_verification_created: false; roi_created: false; field_memory_created: false; no_acceptance_created: true; no_effect_judgement: true; pointer_only: true; artifact_inputs: ArtifactInput[]; boundary_rules: Array<{ rule_code: string; label: string }>; created_at: string;
};

export type EvidenceArtifactFromAsExecutedPayloadV1 = {
  artifact_id: string; operation_plan_id?: string; act_task_id: string; receipt_id: string; receipt_fact_id?: string; evidence_id?: string; field_id: string; kind: string; artifact_ref: string; summary: { source: "AS_EXECUTED_RECORD_V1"; as_executed_id: string; task_id: string; receipt_id: string; operation_plan_id: string | null; pointer_kind: string; pointer_ref: string; pointer_source: EvidencePointerSourceV1; pointer_only: true; no_acceptance_created: true; no_effect_judgement: true; }; source: "AS_EXECUTED_RECORD_V1"; source_lane: "FORMAL_OPERATION"; is_simulated: false; formal_eligible: true; evidence_level: "FORMAL"; level: "FORMAL"; tenant_id: string; project_id: string; group_id: string; created_at: string; created_by: string;
};

export type EvidenceArtifactsFromAsExecutedInputV1 = { tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null; operator_id: string; idempotency_key: string; materialization_reason: string; asExecutedRecord: Record<string, unknown> | null; as_executed_id: string; task_id: string; receipt_id: string; operation_plan_id: string | null; submission_id: string; created_at: string };

const boundaryRules = [
  { rule_code: "POINTER_ONLY", label: "Evidence artifacts preserve pointers only and do not read referenced contents." },
  { rule_code: "NO_ACCEPTANCE", label: "Materialization does not create acceptance, effect judgement, ROI, or Field Memory." },
  { rule_code: "FORMAL_OPERATION_ONLY", label: "Dev/flight-table/simulated pointers cannot be promoted into formal operation evidence." },
];

function text(v: unknown): string { return String(v ?? "").trim(); }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function pointerRef(v: unknown): string { return typeof v === "string" ? v.trim() : text((v as any)?.ref ?? (v as any)?.artifact_ref ?? (v as any)?.uri ?? (v as any)?.url ?? (v as any)?.fact_id ?? (v as any)?.id); }
function pointerKind(v: unknown, fallback: string): string { return text((v as any)?.kind ?? (v as any)?.type ?? fallback) || fallback; }
function normalizeEvidenceKind(kind: string): string { const k = kind.toLowerCase(); if (/image|photo|png|jpg|jpeg/.test(k)) return "image"; if (/video|media|audio/.test(k)) return "media"; if (/note|text/.test(k)) return "note"; if (/metric|measurement/.test(k)) return "metric"; if (/trajectory|gps|path/.test(k)) return "trajectory"; return "artifact"; }
function hasDevIndicator(input: ArtifactInput): boolean { const s = `${input.ref} ${input.kind}`.toLowerCase(); return s.includes("flight-table") || s.includes("flight_table") || s.includes("dev://") || s.includes("simulated://"); }
function artifactId(input: EvidenceArtifactsFromAsExecutedInputV1, p: ArtifactInput): string { return `eart_${createHash("sha256").update([input.tenant_id,input.project_id,input.group_id,input.as_executed_id,input.task_id,input.receipt_id,p.source_ref_kind,p.kind,p.ref].join("\n")).digest("hex").slice(0,24)}`; }
function reject(input: EvidenceArtifactsFromAsExecutedInputV1, status: EvidenceArtifactSubmissionStatusV1, artifact_inputs: ArtifactInput[] = []): OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1 { return { version:"v1", surface:"OPERATOR", submission_id:input.submission_id, tenant_id:input.tenant_id, project_id:input.project_id, group_id:input.group_id, field_id:input.field_id, zone_id:input.zone_id, operator_id:input.operator_id, idempotency_key:input.idempotency_key, materialization_reason:input.materialization_reason, as_executed_id:input.as_executed_id, task_id:input.task_id, receipt_id:input.receipt_id, operation_plan_id:input.operation_plan_id, evidence_artifact_ids:[], evidence_artifact_fact_ids:[], status, evidence_artifacts_created:false, acceptance_created:false, water_response_verification_created:false, roi_created:false, field_memory_created:false, no_acceptance_created:true, no_effect_judgement:true, pointer_only:true, artifact_inputs, boundary_rules:boundaryRules, created_at:input.created_at }; }

export function buildEvidenceArtifactsFromAsExecutedV1(input: EvidenceArtifactsFromAsExecutedInputV1): { submission: OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1; artifacts: Array<{ fact_id: string; record: { type: "evidence_artifact_v1"; payload: EvidenceArtifactFromAsExecutedPayloadV1 } }> } {
  const r = input.asExecutedRecord;
  if (!r) return { submission: reject(input, "REJECTED_AS_EXECUTED_NOT_FOUND"), artifacts: [] };
  const op = text((r as any).operation_plan_id ?? (r as any).planned?.operation_plan_id ?? (r as any).prescription_id) || null;
  if (text(r.tenant_id)!==input.tenant_id || text(r.project_id)!==input.project_id || text(r.group_id)!==input.group_id || text(r.field_id)!==input.field_id || text(r.task_id)!==input.task_id || text(r.receipt_id)!==input.receipt_id || text(r.as_executed_id)!==input.as_executed_id || (input.operation_plan_id && op !== input.operation_plan_id)) return { submission: reject(input, "REJECTED_SCOPE_MISMATCH"), artifacts: [] };
  const artifact_inputs: ArtifactInput[] = [
    ...arr(r.evidence_refs).map((x) => ({ source_ref_kind:"evidence_ref" as const, kind: normalizeEvidenceKind(pointerKind(x,"artifact")), ref: pointerRef(x) })),
    ...arr(r.receipt_refs).map((x) => ({ source_ref_kind:"receipt_ref" as const, kind: "water_delivery_receipt", ref: pointerRef(x) })),
    ...arr(r.log_refs).map((x) => ({ source_ref_kind:"log_ref" as const, kind: "log", ref: pointerRef(x) })),
  ].filter((x) => x.ref);
  if (artifact_inputs.length === 0) return { submission: reject(input, "REJECTED_NO_EVIDENCE_POINTERS"), artifacts: [] };
  if (artifact_inputs.some(hasDevIndicator)) return { submission: reject(input, "REJECTED_DEV_EVIDENCE_NOT_FORMAL", artifact_inputs), artifacts: [] };
  const artifacts = artifact_inputs.map((p) => { const id = artifactId(input,p); const payload: EvidenceArtifactFromAsExecutedPayloadV1 = { artifact_id:id, ...(input.operation_plan_id ? { operation_plan_id: input.operation_plan_id } : {}), act_task_id:input.task_id, receipt_id:input.receipt_id, field_id:input.field_id, kind:p.kind, artifact_ref:p.ref, summary:{ source:"AS_EXECUTED_RECORD_V1", as_executed_id:input.as_executed_id, task_id:input.task_id, receipt_id:input.receipt_id, operation_plan_id:input.operation_plan_id, pointer_kind:p.kind, pointer_ref:p.ref, pointer_source:p.source_ref_kind, pointer_only:true, no_acceptance_created:true, no_effect_judgement:true }, source:"AS_EXECUTED_RECORD_V1", source_lane:"FORMAL_OPERATION", is_simulated:false, formal_eligible:true, evidence_level:"FORMAL", level:"FORMAL", tenant_id:input.tenant_id, project_id:input.project_id, group_id:input.group_id, created_at:input.created_at, created_by:input.operator_id }; return { fact_id: id, record: { type:"evidence_artifact_v1" as const, payload } }; });
  const submission = reject(input, "EVIDENCE_ARTIFACTS_RECORDED", artifact_inputs); submission.evidence_artifact_ids = artifacts.map((a)=>a.record.payload.artifact_id); submission.evidence_artifact_fact_ids = artifacts.map((a)=>a.fact_id); submission.evidence_artifacts_created = true;
  return { submission, artifacts };
}
