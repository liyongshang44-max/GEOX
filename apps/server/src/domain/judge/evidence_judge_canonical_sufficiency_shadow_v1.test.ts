import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import {
  evaluateEvidenceJudgeCanonicalSufficiencyShadowV1,
  evaluateEvidenceJudgeV2,
  evaluateEvidenceJudgeV2WithCanonicalShadow,
} from "./evidence_judge_v2.js";
import type { RawSampleEvidenceQualificationProjectionBatchV1 } from "../../evidence/raw_sample_evidence_qualification_projection_v1.js";

function qualification(sampleId: string, eligibility: "ELIGIBLE" | "LIMITED" | "INELIGIBLE" | "UNKNOWN", reasonCodes: string[] = []) {
  return {
    schema_version: "evidence_qualification_v1",
    qualification_id: "q:" + sampleId,
    observation_id: "raw_sample:" + sampleId,
    source_ref: "raw_sample:" + sampleId,
    metric: "soil_moisture",
    scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      season_id: null,
      zone_id: null,
    },
    evaluated_at: "2026-08-27T08:00:00.000Z",
    decision_time: "2026-08-27T08:00:00.000Z",
    presence: "PRESENT",
    epistemic_class: eligibility === "ELIGIBLE" ? "OBSERVED" : "LIMITED",
    physical_validity: eligibility === "INELIGIBLE" ? "FAIL" : "PASS",
    temporal_eligibility: eligibility === "UNKNOWN" ? "UNKNOWN" : "ELIGIBLE",
    source_authority: "QUALIFIED",
    spatial_authority: "EXACT_SCOPE",
    conflict_state: "NONE",
    evidence_authority: eligibility === "ELIGIBLE" ? "QUALIFIED" : eligibility === "INELIGIBLE" ? "INELIGIBLE" : eligibility === "LIMITED" ? "LIMITED" : "UNKNOWN",
    role_eligibility: [{
      role: "STAGE1_FORMAL_EVIDENCE",
      eligibility,
      reason_codes: reasonCodes,
    }],
    limitations: [],
    reason_codes: reasonCodes,
  };
}

function batch(items: ReturnType<typeof qualification>[]): RawSampleEvidenceQualificationProjectionBatchV1 {
  const counts = { total: items.length, qualified: 0, limited: 0, ineligible: 0, unknown: 0 };
  for (const item of items) {
    if (item.evidence_authority === "QUALIFIED") counts.qualified += 1;
    else if (item.evidence_authority === "LIMITED") counts.limited += 1;
    else if (item.evidence_authority === "INELIGIBLE") counts.ineligible += 1;
    else counts.unknown += 1;
  }
  return {
    schema_version: "raw_sample_evidence_qualification_projection_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    role: "STAGE1_FORMAL_EVIDENCE",
    qualifications: items as any,
    counts,
    limitations: ["B04D4_SHADOW_NON_AUTHORITATIVE"],
  };
}

test("B-04e facade is SUFFICIENT when independent role-eligible evidence remains", () => {
  const shadow = evaluateEvidenceJudgeCanonicalSufficiencyShadowV1(batch([
    qualification("good", "ELIGIBLE"),
    qualification("bad", "INELIGIBLE", ["PHYSICAL_VALIDITY_FAIL"]),
  ]));

  assert.equal(shadow.status, "SUFFICIENT");
  assert.equal(shadow.counts.role_eligible, 1);
  assert.equal(shadow.counts.role_ineligible, 1);
  assert.deepEqual(shadow.reason_codes, ["CANONICAL_ROLE_ELIGIBLE_EVIDENCE_PRESENT"]);
  assert.ok(shadow.canonical_reason_codes.includes("PHYSICAL_VALIDITY_FAIL"));
  assert.equal(shadow.authority_mode, "SHADOW_NON_AUTHORITATIVE");
});

test("B-04e facade requests evidence when no canonical role-eligible evidence exists", () => {
  const shadow = evaluateEvidenceJudgeCanonicalSufficiencyShadowV1(batch([
    qualification("limited", "LIMITED", ["POST_COMMIT_RUNTIME_AVAILABILITY_NOT_ESTABLISHED"]),
    qualification("unknown", "UNKNOWN", ["CONFLICT_STATE_UNKNOWN"]),
  ]));

  assert.equal(shadow.status, "NEEDS_EVIDENCE");
  assert.equal(shadow.counts.role_eligible, 0);
  assert.deepEqual(shadow.reason_codes, ["NO_ROLE_ELIGIBLE_CANONICAL_EVIDENCE"]);
  assert.ok(shadow.canonical_reason_codes.includes("POST_COMMIT_RUNTIME_AVAILABILITY_NOT_ESTABLISHED"));
  assert.ok(shadow.canonical_reason_codes.includes("CONFLICT_STATE_UNKNOWN"));
});

test("B-04e canonical shadow failure cannot alter legacy Evidence Judge authority", async () => {
  const input = {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "devA",
    soil_moisture: 2.0,
    observed_at_ts_ms: 1_000,
    now_ts_ms: 61_000,
    last_heartbeat_ts_ms: 60_000,
  };
  const legacy = evaluateEvidenceJudgeV2(input);
  const pool = {
    query: async () => {
      throw new Error("canonical read unavailable");
    },
  } as unknown as Pool;

  const withShadow = await evaluateEvidenceJudgeV2WithCanonicalShadow(pool, input);
  assert.equal(legacy.verdict, "SENSOR_DRIFT");
  assert.equal(withShadow.verdict, legacy.verdict);
  assert.equal(withShadow.severity, legacy.severity);
  assert.deepEqual(withShadow.reasons, legacy.reasons);
  const stableTrace = (refs: any[] | undefined) => (refs ?? []).map((ref) => ({
    skill_id: ref.skill_id,
    skill_version: ref.skill_version,
    skill_category: ref.skill_category,
    input_digest: ref.input_digest,
    inputs: ref.inputs,
    outputs: ref.outputs,
    confidence: ref.confidence,
    evidence_refs: ref.evidence_refs,
  }));
  assert.deepEqual(stableTrace(withShadow.source_refs as any[]), stableTrace(legacy.source_refs as any[]));
  assert.equal(
    (withShadow.outputs as any).canonical_evidence_sufficiency_shadow_v1.status,
    "UNKNOWN",
  );
  assert.deepEqual(
    (withShadow.outputs as any).canonical_evidence_sufficiency_shadow_v1.reason_codes,
    ["CANONICAL_EVIDENCE_SHADOW_READ_FAILED"],
  );
});


test("B-04 missing observation is not fabricated and requests evidence", () => {
  const shadow = evaluateEvidenceJudgeCanonicalSufficiencyShadowV1(batch([]));

  assert.equal(shadow.status, "NEEDS_EVIDENCE");
  assert.deepEqual(shadow.counts, {
    total: 0,
    role_eligible: 0,
    role_limited: 0,
    role_ineligible: 0,
    role_unknown: 0,
  });
  assert.deepEqual(shadow.reason_codes, ["NO_CANONICAL_EVIDENCE_QUALIFICATIONS"]);
  assert.deepEqual(shadow.canonical_reason_codes, []);
  assert.equal(shadow.authority_mode, "SHADOW_NON_AUTHORITATIVE");
});
