import type {
  FormalScenarioManifestV1,
  FormalScenarioRunV1,
} from "./formal_scenario_manifest_v1.js";

export type FormalScenarioVerifyChecksV1 = {
  formal_evidence_passed: boolean;
  problem_state_created: boolean;
  recommendation_created: boolean;
  prescription_created: boolean;
  approval_approved: boolean;
  ao_act_task_created: boolean;
  receipt_is_not_acceptance: boolean;
  formal_acceptance_passed: boolean;
  guarded_report_customer_visible: boolean;
  roi_trust_lane_valid: boolean;
  field_memory_lane_valid: boolean;
};

export type FormalScenarioVerifyV1 = {
  run_id: string;
  passed: boolean;
  checks: FormalScenarioVerifyChecksV1;
  blocking_reasons: string[];
};

export type FormalScenarioVerifyEvidenceV1 = Partial<FormalScenarioVerifyChecksV1> & {
  problem_state_id?: string | null;
  uncertainty_envelope_id?: string | null;
  acceptance_verdict?: string | null;
  report_trust_level?: string | null;
  roi_customer_visible_value?: boolean | null;
  field_memory_formal?: boolean | null;
};

const CHECK_KEYS: readonly (keyof FormalScenarioVerifyChecksV1)[] = [
  "formal_evidence_passed",
  "problem_state_created",
  "recommendation_created",
  "prescription_created",
  "approval_approved",
  "ao_act_task_created",
  "receipt_is_not_acceptance",
  "formal_acceptance_passed",
  "guarded_report_customer_visible",
  "roi_trust_lane_valid",
  "field_memory_lane_valid",
] as const;

function upper(input: unknown): string {
  return String(input ?? "").trim().toUpperCase();
}

function bool(input: unknown): boolean {
  return input === true;
}

function deriveChecksFromManifest(
  manifest: FormalScenarioManifestV1,
  evidence: FormalScenarioVerifyEvidenceV1 = {},
): FormalScenarioVerifyChecksV1 {
  const formalAcceptance =
    bool(evidence.formal_acceptance_passed)
    || upper(evidence.acceptance_verdict) === "PASS"
    || upper(evidence.acceptance_verdict) === "PASSED";
  const reportVisible =
    bool(evidence.guarded_report_customer_visible)
    || upper(evidence.report_trust_level) === "FORMAL_CHAIN_PASSED";
  return {
    formal_evidence_passed: bool(evidence.formal_evidence_passed),
    problem_state_created: bool(evidence.problem_state_created) || Boolean(evidence.problem_state_id || evidence.uncertainty_envelope_id),
    recommendation_created: bool(evidence.recommendation_created) || Boolean(manifest.recommendation_id),
    prescription_created: Boolean(manifest.prescription_id),
    approval_approved: bool(evidence.approval_approved) || Boolean(manifest.approval_request_id),
    ao_act_task_created: bool(evidence.ao_act_task_created) || Boolean(manifest.act_task_id),
    receipt_is_not_acceptance: bool(evidence.receipt_is_not_acceptance) || Boolean(manifest.receipt_id && manifest.acceptance_id && manifest.receipt_id !== manifest.acceptance_id),
    formal_acceptance_passed: formalAcceptance || Boolean(manifest.acceptance_id && evidence.formal_acceptance_passed),
    guarded_report_customer_visible: reportVisible,
    roi_trust_lane_valid: bool(evidence.roi_trust_lane_valid) || evidence.roi_customer_visible_value === true,
    field_memory_lane_valid: bool(evidence.field_memory_lane_valid) || evidence.field_memory_formal === true,
  };
}

function blockingReasonsFor(checks: FormalScenarioVerifyChecksV1): string[] {
  return CHECK_KEYS
    .filter((key) => checks[key] !== true)
    .map((key) => `CHECK_FAILED:${key}`);
}

export function buildFormalScenarioVerifyV1(params: {
  run: FormalScenarioRunV1;
  manifest: FormalScenarioManifestV1;
  evidence?: FormalScenarioVerifyEvidenceV1;
}): FormalScenarioVerifyV1 {
  const checks = deriveChecksFromManifest(params.manifest, params.evidence ?? {});
  const blocking_reasons = blockingReasonsFor(checks);
  return {
    run_id: params.run.run_id,
    passed: blocking_reasons.length === 0,
    checks,
    blocking_reasons,
  };
}

export function mergeFormalScenarioVerifyEvidenceV1(
  ...items: Array<FormalScenarioVerifyEvidenceV1 | null | undefined>
): FormalScenarioVerifyEvidenceV1 {
  return Object.assign({}, ...items.filter(Boolean));
}


export function sanitizeFormalScenarioVerifyV1(input: any): FormalScenarioVerifyV1 {
  const run_id = String(input?.run_id ?? "fsr_unknown").trim() || "fsr_unknown";
  const checks: FormalScenarioVerifyChecksV1 = {
    formal_evidence_passed: input?.checks?.formal_evidence_passed === true,
    problem_state_created: input?.checks?.problem_state_created === true,
    recommendation_created: input?.checks?.recommendation_created === true,
    prescription_created: input?.checks?.prescription_created === true,
    approval_approved: input?.checks?.approval_approved === true,
    ao_act_task_created: input?.checks?.ao_act_task_created === true,
    receipt_is_not_acceptance: input?.checks?.receipt_is_not_acceptance === true,
    formal_acceptance_passed: input?.checks?.formal_acceptance_passed === true,
    guarded_report_customer_visible: input?.checks?.guarded_report_customer_visible === true,
    roi_trust_lane_valid: input?.checks?.roi_trust_lane_valid === true,
    field_memory_lane_valid: input?.checks?.field_memory_lane_valid === true,
  };
  const blocking_reasons = Array.isArray(input?.blocking_reasons) ? input.blocking_reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean) : [];
  return {
    run_id,
    passed: input?.passed === true,
    checks,
    blocking_reasons,
  };
}
