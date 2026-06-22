// apps/server/src/domain/acceptance/acceptance_result_from_evidence_artifacts_v1.ts
export type AcceptanceVerdictFromEvidenceArtifactsV1 = "PASS" | "FAIL" | "PARTIAL" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE";
export type OperatorAcceptanceResultSubmissionStatusV1 =
  | "ACCEPTANCE_RESULT_RECORDED"
  | "REJECTED_AS_EXECUTED_NOT_FOUND"
  | "REJECTED_EVIDENCE_ARTIFACT_NOT_FOUND"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_INSUFFICIENT_EVIDENCE"
  | "REJECTED_DEV_OR_SIMULATED_EVIDENCE"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type OperatorAcceptanceResultSubmissionPayloadV1 = {
  version: "v1"; surface: "OPERATOR"; submission_id: string;
  tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null;
  operator_id: string; idempotency_key: string; acceptance_reason: string;
  as_executed_id: string; task_id: string; receipt_id: string; operation_plan_id: string | null;
  evidence_artifact_ids: string[]; evidence_artifact_fact_ids: string[];
  acceptance_id: string | null; acceptance_result_fact_id: string | null;
  status: OperatorAcceptanceResultSubmissionStatusV1; verdict: AcceptanceVerdictFromEvidenceArtifactsV1 | null;
  acceptance_created: boolean; water_response_verification_created: false; roi_created: false; field_memory_created: false; customer_delivery_created: false;
  no_water_response_verification_created: true; no_roi_created: true; no_field_memory_created: true; no_effect_judgement: true;
  acceptance_result_v1: Record<string, unknown> | null;
  boundary_rules: Array<{ rule_code: string; label: string }>;
  created_at: string;
};

export type AcceptanceResultFromEvidenceArtifactsPayloadV1 = {
  acceptance_id: string; tenant_id: string; project_id: string; group_id: string; act_task_id: string; field_id: string; operation_plan_id?: string;
  verdict: AcceptanceVerdictFromEvidenceArtifactsV1;
  metrics: { coverage_ratio: number; in_field_ratio: number; telemetry_delta: number; artifact_count: number; formal_artifact_count: number; required_artifact_count: number };
  evidence_refs: string[]; evaluated_at: string; as_executed_id: string; receipt_id: string;
  formal_gate: { formal_evidence_passed: boolean; receipt_structure_passed: boolean; execution_evidence_passed: boolean; execution_effect_passed: false; formal_execution_passed: boolean; non_simulated_chain: boolean; source_lane: "FORMAL_OPERATION" | "UNKNOWN"; is_simulated: false; blocking_reasons: string[]; customer_visible_eligible: false; trust_level: "NEEDS_REVIEW" | "INSUFFICIENT_FORMAL_EVIDENCE" };
  formal_acceptance: boolean; formal_evidence_passed: boolean; receipt_structure_passed: boolean; execution_evidence_passed: boolean; execution_effect_passed: false; formal_execution_passed: boolean; non_simulated_chain: boolean; source_lane: "FORMAL_OPERATION" | "UNKNOWN"; is_simulated: false; blocking_reasons: string[]; customer_visible_eligible: false; trust_level: "NEEDS_REVIEW" | "INSUFFICIENT_FORMAL_EVIDENCE";
};

export type AcceptanceResultFromEvidenceArtifactsInputV1 = {
  tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null;
  operator_id: string; idempotency_key: string; acceptance_reason: string;
  asExecutedRecord: Record<string, unknown> | null; evidenceArtifacts: Record<string, unknown>[];
  as_executed_id: string; task_id: string; receipt_id: string; operation_plan_id: string | null;
  submission_id: string; acceptance_id: string; evaluated_at: string;
};

const BOUNDARY_RULES = [
  { rule_code: "EXECUTION_EVIDENCE_ONLY", label: "Acceptance result records execution evidence acceptance only." },
  { rule_code: "NO_DOWNSTREAM_FACTS", label: "No water response verification, ROI, Field Memory, operation state, or customer delivery is created." },
  { rule_code: "POINTER_ONLY_FORMAL_ARTIFACTS", label: "Evidence artifacts are formal pointer-only artifacts and referenced contents are not downloaded or parsed." },
];

function text(v: unknown): string { return String(v ?? "").trim(); }
function payload(f: Record<string, unknown>): Record<string, unknown> { return ((f as any).payload && typeof (f as any).payload === "object") ? (f as any).payload : f; }
function factId(f: Record<string, unknown>): string { return text((f as any).fact_id ?? (f as any).id); }
function artifactId(f: Record<string, unknown>): string { const p = payload(f); return text((p as any).artifact_id ?? (f as any).artifact_id); }
function pointerSource(f: Record<string, unknown>): string { const p = payload(f) as any; return text(p?.summary?.pointer_source ?? p?.pointer_source); }
function isRecordedExecution(r: Record<string, unknown> | null): boolean { const e = (r as any)?.executed ?? {}; const s = text((r as any)?.status ?? e?.status ?? (r as any)?.as_applied_status).toUpperCase(); return !["NOT_EXECUTED", "FAILED", "CANCELLED", "REJECTED"].includes(s); }
function hasPreciseDevOrSimulatedIndicator(p: Record<string, unknown>): boolean {
  const artifactRef = text((p as any).artifact_ref).toLowerCase();
  return (p as any).source_lane === "SIMULATED_DEV_ONLY"
    || (p as any).source_lane === "DEBUG_ONLY"
    || (p as any).evidence_level === "DEBUG"
    || (p as any).is_simulated === true
    || artifactRef.startsWith("dev://")
    || artifactRef.startsWith("simulated://")
    || artifactRef.includes("flight-table")
    || artifactRef.includes("flight_table");
}

function base(input: AcceptanceResultFromEvidenceArtifactsInputV1, status: OperatorAcceptanceResultSubmissionStatusV1, artifacts: Record<string, unknown>[], verdict: AcceptanceVerdictFromEvidenceArtifactsV1 | null, acceptance: AcceptanceResultFromEvidenceArtifactsPayloadV1 | null): OperatorAcceptanceResultSubmissionPayloadV1 {
  return { version: "v1", surface: "OPERATOR", submission_id: input.submission_id, tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id, field_id: input.field_id, zone_id: input.zone_id, operator_id: input.operator_id, idempotency_key: input.idempotency_key, acceptance_reason: input.acceptance_reason, as_executed_id: input.as_executed_id, task_id: input.task_id, receipt_id: input.receipt_id, operation_plan_id: input.operation_plan_id, evidence_artifact_ids: artifacts.map(artifactId).filter(Boolean), evidence_artifact_fact_ids: artifacts.map(factId).filter(Boolean), acceptance_id: acceptance ? input.acceptance_id : null, acceptance_result_fact_id: acceptance ? input.acceptance_id : null, status, verdict, acceptance_created: Boolean(acceptance), water_response_verification_created: false, roi_created: false, field_memory_created: false, customer_delivery_created: false, no_water_response_verification_created: true, no_roi_created: true, no_field_memory_created: true, no_effect_judgement: true, acceptance_result_v1: acceptance, boundary_rules: BOUNDARY_RULES, created_at: input.evaluated_at };
}

export function buildAcceptanceResultFromEvidenceArtifactsV1(input: AcceptanceResultFromEvidenceArtifactsInputV1): { submission: OperatorAcceptanceResultSubmissionPayloadV1; acceptanceResult: { type: "acceptance_result_v1"; payload: AcceptanceResultFromEvidenceArtifactsPayloadV1 } | null } {
  if (!input.asExecutedRecord) return { submission: base(input, "REJECTED_AS_EXECUTED_NOT_FOUND", [], null, null), acceptanceResult: null };
  const ar = input.asExecutedRecord as any;
  if ([ar.tenant_id, ar.project_id, ar.group_id, ar.field_id, ar.task_id, ar.receipt_id, ar.as_executed_id].map(text).join("|") !== [input.tenant_id, input.project_id, input.group_id, input.field_id, input.task_id, input.receipt_id, input.as_executed_id].join("|")) return { submission: base(input, "REJECTED_SCOPE_MISMATCH", input.evidenceArtifacts, null, null), acceptanceResult: null };
  if (input.evidenceArtifacts.length < 1) return { submission: base(input, "REJECTED_EVIDENCE_ARTIFACT_NOT_FOUND", [], null, null), acceptanceResult: null };
  const badDev = input.evidenceArtifacts.some((f) => { const p = payload(f) as any; return text((f as any).type) !== "evidence_artifact_v1" || p.source_lane !== "FORMAL_OPERATION" || p.formal_eligible !== true || p.is_simulated !== false || p.evidence_level !== "FORMAL" || hasPreciseDevOrSimulatedIndicator(p); });
  if (badDev) return { submission: base(input, "REJECTED_DEV_OR_SIMULATED_EVIDENCE", input.evidenceArtifacts, null, null), acceptanceResult: null };
  const mismatch = input.evidenceArtifacts.some((f) => { const p = payload(f) as any; const s = p.summary ?? {}; return p.tenant_id !== input.tenant_id || p.project_id !== input.project_id || p.group_id !== input.group_id || p.field_id !== input.field_id || p.act_task_id !== input.task_id || p.receipt_id !== input.receipt_id || p.source !== "AS_EXECUTED_RECORD_V1" || s.as_executed_id !== input.as_executed_id || s.task_id !== input.task_id || s.receipt_id !== input.receipt_id || s.source !== "AS_EXECUTED_RECORD_V1" || s.pointer_only !== true || s.no_acceptance_created !== true || s.no_effect_judgement !== true || (input.operation_plan_id !== null && s.operation_plan_id !== input.operation_plan_id); });
  if (mismatch) return { submission: base(input, "REJECTED_SCOPE_MISMATCH", input.evidenceArtifacts, null, null), acceptanceResult: null };
  const hasEvidence = input.evidenceArtifacts.some((f) => pointerSource(f) === "evidence_ref");
  const hasReceiptOrLog = input.evidenceArtifacts.some((f) => ["receipt_ref", "log_ref"].includes(pointerSource(f)));
  const formalEvidencePassed = input.evidenceArtifacts.length > 0;
  const receiptStructurePassed = hasReceiptOrLog;
  const executionEvidencePassed = hasEvidence && hasReceiptOrLog;
  const blocking: string[] = [];
  if (!hasEvidence) blocking.push("MISSING_EVIDENCE_REF_ARTIFACT");
  if (!hasReceiptOrLog) blocking.push("MISSING_RECEIPT_OR_LOG_ARTIFACT");
  if (!isRecordedExecution(input.asExecutedRecord)) blocking.push("AS_EXECUTED_NOT_RECORDED");
  const verdict: AcceptanceVerdictFromEvidenceArtifactsV1 = input.evidenceArtifacts.length === 0 ? "INSUFFICIENT_EVIDENCE" : (executionEvidencePassed && isRecordedExecution(input.asExecutedRecord) ? "PASS" : "NEEDS_REVIEW");
  const trust_level = verdict === "PASS" || verdict === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "INSUFFICIENT_FORMAL_EVIDENCE";
  const acceptance: AcceptanceResultFromEvidenceArtifactsPayloadV1 = { acceptance_id: input.acceptance_id, tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id, act_task_id: input.task_id, field_id: input.field_id, ...(input.operation_plan_id ? { operation_plan_id: input.operation_plan_id } : {}), verdict, metrics: { coverage_ratio: executionEvidencePassed ? 1 : 0.5, in_field_ratio: 1, telemetry_delta: 0, artifact_count: input.evidenceArtifacts.length, formal_artifact_count: input.evidenceArtifacts.length, required_artifact_count: 2 }, evidence_refs: input.evidenceArtifacts.map(factId).filter(Boolean), evaluated_at: input.evaluated_at, as_executed_id: input.as_executed_id, receipt_id: input.receipt_id, formal_gate: { formal_evidence_passed: formalEvidencePassed, receipt_structure_passed: receiptStructurePassed, execution_evidence_passed: executionEvidencePassed, execution_effect_passed: false, formal_execution_passed: verdict === "PASS", non_simulated_chain: true, source_lane: "FORMAL_OPERATION", is_simulated: false, blocking_reasons: blocking, customer_visible_eligible: false, trust_level }, formal_acceptance: verdict === "PASS", formal_evidence_passed: formalEvidencePassed, receipt_structure_passed: receiptStructurePassed, execution_evidence_passed: executionEvidencePassed, execution_effect_passed: false, formal_execution_passed: verdict === "PASS", non_simulated_chain: true, source_lane: "FORMAL_OPERATION", is_simulated: false, blocking_reasons: blocking, customer_visible_eligible: false, trust_level };
  return { submission: base(input, "ACCEPTANCE_RESULT_RECORDED", input.evidenceArtifacts, verdict, acceptance), acceptanceResult: { type: "acceptance_result_v1", payload: acceptance } };
}
