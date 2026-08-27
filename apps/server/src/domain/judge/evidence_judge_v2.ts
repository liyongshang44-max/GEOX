import type { Pool } from "pg";
import { buildAppleIIEvidenceSufficiencyV1 } from "../sensing/appleii_evidence_sufficiency_v1.js";
import type { RawSampleEvidenceQualificationProjectionBatchV1 } from "../../evidence/raw_sample_evidence_qualification_projection_v1.js";
import { STAGE1_FORMAL_EVIDENCE_ROLE_V1 } from "../../evidence/raw_sample_evidence_qualification_projection_v1.js";
import { runDeviceFreshnessSkillV1 } from "./skills/device_freshness_skill_v1.js";
import { runSoilMoistureQualitySkillV1 } from "./skills/soil_moisture_quality_skill_v1.js";
import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";

export type EvidenceJudgeEvaluateInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  device_id?: string | null;
  soil_moisture?: number | null;
  observed_at_ts_ms?: number | null;
  now_ts_ms?: number | null;
  last_heartbeat_ts_ms?: number | null;
  last_telemetry_ts_ms?: number | null;
  evidence_refs?: unknown[];
};

function mapSeverity(verdict: string): JudgeResultV2CreateInput["severity"] {
  if (verdict === "DEVICE_OFFLINE") return "CRITICAL";
  if (verdict === "SENSOR_DRIFT" || verdict === "STALE_DATA") return "HIGH";
  if (verdict === "INSUFFICIENT_EVIDENCE") return "MEDIUM";
  return "LOW";
}

export function evaluateEvidenceJudgeV2(input: EvidenceJudgeEvaluateInput): JudgeResultV2CreateInput {
  const nowTs = Number.isFinite(Number(input.now_ts_ms)) ? Number(input.now_ts_ms) : Date.now();
  const observedAtTs = Number(input.observed_at_ts_ms);
  const heartbeatTs = Number(input.last_heartbeat_ts_ms);

  const observationAgeMinutes = Number.isFinite(observedAtTs) ? (nowTs - observedAtTs) / 60000 : Number.POSITIVE_INFINITY;
  const heartbeatAgeMinutes = Number.isFinite(heartbeatTs) ? (nowTs - heartbeatTs) / 60000 : Number.POSITIVE_INFINITY;

  const soil = runSoilMoistureQualitySkillV1({
    soil_moisture: input.soil_moisture,
  });

  const freshness = runDeviceFreshnessSkillV1({
    observation_age_minutes: observationAgeMinutes,
    heartbeat_age_minutes: heartbeatAgeMinutes,
  });

  const selected =
    soil.output.verdict !== "PASS" ? soil : freshness.output.verdict !== "PASS" ? freshness : null;

  const verdict = selected?.output.verdict ?? "PASS";
  const reasons = selected?.output.reasons ?? ["evidence_guard_pass"];

  return {
    judge_kind: "EVIDENCE",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
    verdict,
    severity: mapSeverity(verdict),
    reasons,
    inputs: {
      soil_moisture: input.soil_moisture ?? null,
      observed_at_ts_ms: Number.isFinite(observedAtTs) ? observedAtTs : null,
      now_ts_ms: nowTs,
      last_heartbeat_ts_ms: Number.isFinite(heartbeatTs) ? heartbeatTs : null,
      last_telemetry_ts_ms: Number.isFinite(Number(input.last_telemetry_ts_ms))
        ? Number(input.last_telemetry_ts_ms)
        : null,
    },
    outputs: {
      skill_traces: [
        {
          skill_id: soil.trace.skill_id,
          trace_id: soil.trace.trace_id,
          run_id: soil.trace.run_id,
          skill_version: soil.trace.skill_version,
          skill_category: soil.trace.skill_category,
          verdict: soil.output.verdict,
          reasons: soil.output.reasons,
        },
        {
          skill_id: freshness.trace.skill_id,
          trace_id: freshness.trace.trace_id,
          run_id: freshness.trace.run_id,
          skill_version: freshness.trace.skill_version,
          skill_category: freshness.trace.skill_category,
          verdict: freshness.output.verdict,
          reasons: freshness.output.reasons,
        },
      ],
    },
    confidence: selected?.trace.confidence ?? {
      level: "HIGH",
      basis: "measured",
      reasons: ["soil_moisture_and_freshness_checks_passed"],
    },
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: [
      {
        skill_id: soil.trace.skill_id,
        skill_version: soil.trace.skill_version,
        skill_category: soil.trace.skill_category,
        trace_id: soil.trace.trace_id,
        run_id: soil.trace.run_id,
        input_digest: soil.trace.input_digest,
        inputs: soil.trace.inputs,
        outputs: soil.trace.outputs,
        confidence: soil.trace.confidence,
        evidence_refs: soil.trace.evidence_refs,
      },
      {
        skill_id: freshness.trace.skill_id,
        skill_version: freshness.trace.skill_version,
        skill_category: freshness.trace.skill_category,
        trace_id: freshness.trace.trace_id,
        run_id: freshness.trace.run_id,
        input_digest: freshness.trace.input_digest,
        inputs: freshness.trace.inputs,
        outputs: freshness.trace.outputs,
        confidence: freshness.trace.confidence,
        evidence_refs: freshness.trace.evidence_refs,
      },
    ],
  };
}


export type EvidenceJudgeCanonicalSufficiencyShadowV1 = {
  schema_version: "evidence_judge_canonical_sufficiency_shadow_v1";
  authority_mode: "SHADOW_NON_AUTHORITATIVE";
  qualification_role: typeof STAGE1_FORMAL_EVIDENCE_ROLE_V1;
  status: "SUFFICIENT" | "NEEDS_EVIDENCE" | "UNKNOWN";
  counts: {
    total: number;
    role_eligible: number;
    role_limited: number;
    role_ineligible: number;
    role_unknown: number;
  };
  reason_codes: string[];
  canonical_reason_codes: string[];
  limitations: string[];
};

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort();
}

function unavailableCanonicalSufficiencyShadowV1(reasonCode: string): EvidenceJudgeCanonicalSufficiencyShadowV1 {
  return {
    schema_version: "evidence_judge_canonical_sufficiency_shadow_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    qualification_role: STAGE1_FORMAL_EVIDENCE_ROLE_V1,
    status: "UNKNOWN",
    counts: {
      total: 0,
      role_eligible: 0,
      role_limited: 0,
      role_ineligible: 0,
      role_unknown: 0,
    },
    reason_codes: [reasonCode],
    canonical_reason_codes: [],
    limitations: [
      "B04E_SHADOW_NON_AUTHORITATIVE",
      "LEGACY_EVIDENCE_JUDGE_VERDICT_REMAINS_COMPATIBILITY_AUTHORITY_UNTIL_B09",
    ],
  };
}

/**
 * B-04e problem-specific sufficiency facade.
 *
 * This function does not inspect raw numeric values, recompute physical ranges,
 * or recompute freshness. It consumes only canonical EvidenceQualificationV1
 * role authority already projected by the B-03/B-04 evidence runtime.
 *
 * One invalid observation does not automatically make the problem insufficient
 * when independent role-eligible evidence remains.
 */
export function evaluateEvidenceJudgeCanonicalSufficiencyShadowV1(
  batch: RawSampleEvidenceQualificationProjectionBatchV1,
): EvidenceJudgeCanonicalSufficiencyShadowV1 {
  let roleEligible = 0;
  let roleLimited = 0;
  let roleIneligible = 0;
  let roleUnknown = 0;
  const canonicalReasonCodes: string[] = [];

  for (const qualification of batch.qualifications ?? []) {
    canonicalReasonCodes.push(...(qualification.reason_codes ?? []));
    const role = (qualification.role_eligibility ?? []).find(
      (entry) => entry.role === STAGE1_FORMAL_EVIDENCE_ROLE_V1,
    );
    const state = role?.eligibility ?? "UNKNOWN";
    if (state === "ELIGIBLE") roleEligible += 1;
    else if (state === "LIMITED") roleLimited += 1;
    else if (state === "INELIGIBLE") roleIneligible += 1;
    else roleUnknown += 1;
  }

  const total = Number(batch.qualifications?.length ?? 0);
  let status: EvidenceJudgeCanonicalSufficiencyShadowV1["status"] = "NEEDS_EVIDENCE";
  let reasonCodes: string[];

  if (total === 0) {
    reasonCodes = ["NO_CANONICAL_EVIDENCE_QUALIFICATIONS"];
  } else if (roleEligible > 0) {
    status = "SUFFICIENT";
    reasonCodes = ["CANONICAL_ROLE_ELIGIBLE_EVIDENCE_PRESENT"];
  } else {
    reasonCodes = ["NO_ROLE_ELIGIBLE_CANONICAL_EVIDENCE"];
  }

  return {
    schema_version: "evidence_judge_canonical_sufficiency_shadow_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    qualification_role: STAGE1_FORMAL_EVIDENCE_ROLE_V1,
    status,
    counts: {
      total,
      role_eligible: roleEligible,
      role_limited: roleLimited,
      role_ineligible: roleIneligible,
      role_unknown: roleUnknown,
    },
    reason_codes: reasonCodes,
    canonical_reason_codes: uniqueStrings(canonicalReasonCodes),
    limitations: [
      "B04E_SHADOW_NON_AUTHORITATIVE",
      "CURRENT_CANONICAL_RUNTIME_PROJECTS_STAGE1_FORMAL_EVIDENCE_ROLE",
      "LEGACY_EVIDENCE_JUDGE_VERDICT_REMAINS_COMPATIBILITY_AUTHORITY_UNTIL_B09",
    ],
  };
}

/**
 * Runtime orchestration for the existing Evidence Judge route.
 *
 * The persisted canonical path is shadow-only in B-04e. The legacy verdict is
 * intentionally preserved byte-for-byte as the route's compatibility authority.
 * Canonical read/build failure therefore degrades the shadow to UNKNOWN and must
 * never alter the existing verdict, severity, reasons, skill traces, or source refs.
 */
export async function evaluateEvidenceJudgeV2WithCanonicalShadow(
  pool: Pool,
  input: EvidenceJudgeEvaluateInput,
): Promise<JudgeResultV2CreateInput> {
  const legacy = evaluateEvidenceJudgeV2(input);
  const fieldId = String(input.field_id ?? "").trim();

  let canonicalShadow: EvidenceJudgeCanonicalSufficiencyShadowV1;
  if (!fieldId) {
    canonicalShadow = unavailableCanonicalSufficiencyShadowV1("FIELD_SCOPE_REQUIRED_FOR_CANONICAL_EVIDENCE_SHADOW");
  } else {
    try {
      const nowTs = Number.isFinite(Number(input.now_ts_ms)) ? Number(input.now_ts_ms) : Date.now();
      const evidence = await buildAppleIIEvidenceSufficiencyV1(pool, {
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
        field_id: fieldId,
        device_id: input.device_id ?? null,
        now_ms: nowTs,
      });
      canonicalShadow = evaluateEvidenceJudgeCanonicalSufficiencyShadowV1(
        evidence.canonical_evidence_qualification_projection_v1,
      );
    } catch {
      canonicalShadow = unavailableCanonicalSufficiencyShadowV1("CANONICAL_EVIDENCE_SHADOW_READ_FAILED");
    }
  }

  return {
    ...legacy,
    outputs: {
      ...(legacy.outputs ?? {}),
      canonical_evidence_sufficiency_shadow_v1: canonicalShadow,
    },
  };
}
