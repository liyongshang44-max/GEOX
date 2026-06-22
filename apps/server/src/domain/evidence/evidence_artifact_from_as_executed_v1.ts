// apps/server/src/domain/evidence/evidence_artifact_from_as_executed_v1.ts
import { createHash } from "node:crypto";

export type EvidencePointerSourceV1 = "evidence_ref" | "receipt_ref" | "log_ref";

export type EvidenceArtifactSubmissionStatusV1 =
  | "EVIDENCE_ARTIFACTS_RECORDED"
  | "REJECTED_AS_EXECUTED_NOT_FOUND"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_NO_EVIDENCE_POINTERS"
  | "REJECTED_DEV_EVIDENCE_NOT_FORMAL"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type EvidenceArtifactInputV1 = {
  source_ref_kind: EvidencePointerSourceV1;
  kind: string;
  ref: string;
};

export type OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1 = {
  version: "v1";
  surface: "OPERATOR";
  submission_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;
  operator_id: string;
  idempotency_key: string;
  materialization_reason: string;
  as_executed_id: string;
  task_id: string;
  receipt_id: string;
  operation_plan_id: string | null;
  evidence_artifact_ids: string[];
  evidence_artifact_fact_ids: string[];
  status: EvidenceArtifactSubmissionStatusV1;
  evidence_artifacts_created: boolean;
  acceptance_created: false;
  water_response_verification_created: false;
  roi_created: false;
  field_memory_created: false;
  no_acceptance_created: true;
  no_effect_judgement: true;
  pointer_only: true;
  artifact_inputs: EvidenceArtifactInputV1[];
  boundary_rules: Array<{ rule_code: string; label: string }>;
  created_at: string;
};

export type EvidenceArtifactFromAsExecutedPayloadV1 = {
  artifact_id: string;
  operation_plan_id?: string;
  act_task_id: string;
  receipt_id: string;
  receipt_fact_id?: string;
  evidence_id?: string;
  field_id: string;
  kind: string;
  artifact_ref: string;
  summary: {
    source: "AS_EXECUTED_RECORD_V1";
    as_executed_id: string;
    task_id: string;
    receipt_id: string;
    operation_plan_id: string | null;
    pointer_kind: string;
    pointer_ref: string;
    pointer_source: EvidencePointerSourceV1;
    pointer_only: true;
    no_acceptance_created: true;
    no_effect_judgement: true;
  };
  source: "AS_EXECUTED_RECORD_V1";
  source_lane: "FORMAL_OPERATION";
  is_simulated: false;
  formal_eligible: true;
  evidence_level: "FORMAL";
  level: "FORMAL";
  tenant_id: string;
  project_id: string;
  group_id: string;
  created_at: string;
  created_by: string;
};

export type EvidenceArtifactsFromAsExecutedInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;
  operator_id: string;
  idempotency_key: string;
  materialization_reason: string;
  asExecutedRecord: Record<string, unknown> | null;
  as_executed_id: string;
  task_id: string;
  receipt_id: string;
  operation_plan_id: string | null;
  submission_id: string;
  created_at: string;
};

export type EvidenceArtifactFromAsExecutedRecordV1 = {
  fact_id: string;
  record: {
    type: "evidence_artifact_v1";
    payload: EvidenceArtifactFromAsExecutedPayloadV1;
  };
};

const BOUNDARY_RULES = [
  {
    rule_code: "POINTER_ONLY",
    label: "Evidence artifacts preserve pointers only and do not read referenced contents.",
  },
  {
    rule_code: "NO_ACCEPTANCE",
    label: "Materialization does not create acceptance, effect judgement, ROI, or Field Memory.",
  },
  {
    rule_code: "FORMAL_OPERATION_ONLY",
    label: "Dev/flight-table/simulated pointers cannot be promoted into formal operation evidence.",
  },
];

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pointerRef(pointer: unknown): string {
  if (typeof pointer === "string") return pointer.trim();
  const obj = pointer as Record<string, unknown> | null;
  return asText(obj?.ref ?? obj?.artifact_ref ?? obj?.uri ?? obj?.url ?? obj?.fact_id ?? obj?.id);
}

function pointerKind(pointer: unknown, fallback: string): string {
  const obj = pointer as Record<string, unknown> | null;
  return asText(obj?.kind ?? obj?.type ?? fallback) || fallback;
}

function normalizeEvidenceKind(kind: string): string {
  const lower = kind.toLowerCase();
  if (/image|photo|png|jpg|jpeg/.test(lower)) return "image";
  if (/video|media|audio/.test(lower)) return "media";
  if (/note|text/.test(lower)) return "note";
  if (/metric|measurement/.test(lower)) return "metric";
  if (/trajectory|gps|path/.test(lower)) return "trajectory";
  return "artifact";
}

function hasDevIndicator(input: EvidenceArtifactInputV1): boolean {
  const value = `${input.ref} ${input.kind}`.toLowerCase();
  return (
    value.includes("flight-table") ||
    value.includes("flight_table") ||
    value.includes("dev://") ||
    value.includes("simulated://")
  );
}

function deterministicArtifactId(
  input: EvidenceArtifactsFromAsExecutedInputV1,
  pointer: EvidenceArtifactInputV1,
): string {
  const seed = [
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.as_executed_id,
    input.task_id,
    input.receipt_id,
    pointer.source_ref_kind,
    pointer.kind,
    pointer.ref,
  ].join("\n");
  return `eart_${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

function baseSubmission(
  input: EvidenceArtifactsFromAsExecutedInputV1,
  status: EvidenceArtifactSubmissionStatusV1,
  artifactInputs: EvidenceArtifactInputV1[] = [],
): OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1 {
  return {
    version: "v1",
    surface: "OPERATOR",
    submission_id: input.submission_id,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    operator_id: input.operator_id,
    idempotency_key: input.idempotency_key,
    materialization_reason: input.materialization_reason,
    as_executed_id: input.as_executed_id,
    task_id: input.task_id,
    receipt_id: input.receipt_id,
    operation_plan_id: input.operation_plan_id,
    evidence_artifact_ids: [],
    evidence_artifact_fact_ids: [],
    status,
    evidence_artifacts_created: false,
    acceptance_created: false,
    water_response_verification_created: false,
    roi_created: false,
    field_memory_created: false,
    no_acceptance_created: true,
    no_effect_judgement: true,
    pointer_only: true,
    artifact_inputs: artifactInputs,
    boundary_rules: BOUNDARY_RULES,
    created_at: input.created_at,
  };
}

function extractPointerInputs(record: Record<string, unknown>): EvidenceArtifactInputV1[] {
  const inputs = [
    ...asArray(record.evidence_refs).map((pointer) => ({
      source_ref_kind: "evidence_ref" as const,
      kind: normalizeEvidenceKind(pointerKind(pointer, "artifact")),
      ref: pointerRef(pointer),
    })),
    ...asArray(record.receipt_refs).map((pointer) => ({
      source_ref_kind: "receipt_ref" as const,
      kind: "water_delivery_receipt",
      ref: pointerRef(pointer),
    })),
    ...asArray(record.log_refs).map((pointer) => ({
      source_ref_kind: "log_ref" as const,
      kind: "log",
      ref: pointerRef(pointer),
    })),
  ];

  return inputs.filter((input) => input.ref.length > 0);
}

function recordOperationPlanId(record: Record<string, unknown>): string | null {
  const planned = record.planned as Record<string, unknown> | null;
  return asText(record.operation_plan_id ?? planned?.operation_plan_id ?? record.prescription_id) || null;
}

function recordScopeMatches(
  input: EvidenceArtifactsFromAsExecutedInputV1,
  record: Record<string, unknown>,
): boolean {
  const operationPlanId = recordOperationPlanId(record);
  return (
    asText(record.tenant_id) === input.tenant_id &&
    asText(record.project_id) === input.project_id &&
    asText(record.group_id) === input.group_id &&
    asText(record.field_id) === input.field_id &&
    asText(record.task_id) === input.task_id &&
    asText(record.receipt_id) === input.receipt_id &&
    asText(record.as_executed_id) === input.as_executed_id &&
    (!input.operation_plan_id || operationPlanId === input.operation_plan_id)
  );
}

function buildArtifactPayload(
  input: EvidenceArtifactsFromAsExecutedInputV1,
  pointer: EvidenceArtifactInputV1,
): EvidenceArtifactFromAsExecutedPayloadV1 {
  const artifactId = deterministicArtifactId(input, pointer);
  return {
    artifact_id: artifactId,
    ...(input.operation_plan_id ? { operation_plan_id: input.operation_plan_id } : {}),
    act_task_id: input.task_id,
    receipt_id: input.receipt_id,
    field_id: input.field_id,
    kind: pointer.kind,
    artifact_ref: pointer.ref,
    summary: {
      source: "AS_EXECUTED_RECORD_V1",
      as_executed_id: input.as_executed_id,
      task_id: input.task_id,
      receipt_id: input.receipt_id,
      operation_plan_id: input.operation_plan_id,
      pointer_kind: pointer.kind,
      pointer_ref: pointer.ref,
      pointer_source: pointer.source_ref_kind,
      pointer_only: true,
      no_acceptance_created: true,
      no_effect_judgement: true,
    },
    source: "AS_EXECUTED_RECORD_V1",
    source_lane: "FORMAL_OPERATION",
    is_simulated: false,
    formal_eligible: true,
    evidence_level: "FORMAL",
    level: "FORMAL",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    created_at: input.created_at,
    created_by: input.operator_id,
  };
}

function buildArtifactRecord(
  input: EvidenceArtifactsFromAsExecutedInputV1,
  pointer: EvidenceArtifactInputV1,
): EvidenceArtifactFromAsExecutedRecordV1 {
  const payload = buildArtifactPayload(input, pointer);
  return {
    fact_id: payload.artifact_id,
    record: {
      type: "evidence_artifact_v1",
      payload,
    },
  };
}

export function buildEvidenceArtifactsFromAsExecutedV1(input: EvidenceArtifactsFromAsExecutedInputV1): {
  submission: OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1;
  artifacts: EvidenceArtifactFromAsExecutedRecordV1[];
} {
  const record = input.asExecutedRecord;
  if (!record) {
    return { submission: baseSubmission(input, "REJECTED_AS_EXECUTED_NOT_FOUND"), artifacts: [] };
  }

  if (!recordScopeMatches(input, record)) {
    return { submission: baseSubmission(input, "REJECTED_SCOPE_MISMATCH"), artifacts: [] };
  }

  const artifactInputs = extractPointerInputs(record);
  if (artifactInputs.length === 0) {
    return { submission: baseSubmission(input, "REJECTED_NO_EVIDENCE_POINTERS"), artifacts: [] };
  }

  if (artifactInputs.some(hasDevIndicator)) {
    return {
      submission: baseSubmission(input, "REJECTED_DEV_EVIDENCE_NOT_FORMAL", artifactInputs),
      artifacts: [],
    };
  }

  const artifacts = artifactInputs.map((pointer) => buildArtifactRecord(input, pointer));
  const submission = baseSubmission(input, "EVIDENCE_ARTIFACTS_RECORDED", artifactInputs);
  submission.evidence_artifact_ids = artifacts.map((artifact) => artifact.record.payload.artifact_id);
  submission.evidence_artifact_fact_ids = artifacts.map((artifact) => artifact.fact_id);
  submission.evidence_artifacts_created = true;

  return { submission, artifacts };
}
