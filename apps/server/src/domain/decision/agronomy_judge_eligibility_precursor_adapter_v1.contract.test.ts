import assert from "node:assert/strict";
import test from "node:test";

import { projectAgronomyJudgeEligibilityPrecursorV1 } from "./agronomy_judge_eligibility_precursor_adapter_v1.js";

const context = {
  candidate_ref: "candidate_decision_v1:candidate_irrigate_001",
  candidate_action_type: "IRRIGATE",
  source_ref: "judge_result_v2:agronomy_001",
  canonical_evidence_qualification_refs: [
    "evidence_qualification_v1:eq_soil",
    "evidence_qualification_v1:eq_weather",
  ],
  calculation_result_refs: [
    "calculation_result_v1:irrigation_requirement_001",
  ],
};

function source(overrides: Record<string, unknown> = {}) {
  return {
    judge_kind: "AGRONOMY",
    verdict: "WATER_DEFICIT",
    severity: "HIGH",
    reasons: ["irrigation_requirement_detected", "soil_moisture_below_threshold"],
    inputs: {
      soil_moisture: 0.18,
      crop_stage: "vegetative",
      evidence_judge_verdict: null,
    },
    outputs: {
      skill_id: "irrigation_requirement_skill_v1",
      requirement_detected: true,
      net_irrigation_requirement_mm: 16,
      gross_irrigation_requirement_mm: 18.824,
      calculation_trace: ["legacy_trace"],
    },
    evidence_refs: ["legacy:soil", "legacy:weather"],
    ...overrides,
  };
}

test("B-07c WATER_DEFICIT becomes STATE=SATISFIED criterion, not PASS", () => {
  const projected = projectAgronomyJudgeEligibilityPrecursorV1(source(), context);

  assert.equal(projected.classification, "IRRIGATION_REQUIREMENT_PRESENT");
  assert.equal(projected.source_verdict, "WATER_DEFICIT");
  assert.equal(projected.direct_verdict_authority, "NONE");
  assert.equal(projected.criterion_assessments[0]?.criterion, "STATE");
  assert.equal(projected.criterion_assessments[0]?.status, "SATISFIED");
  assert.deepEqual(projected.criterion_assessments[0]?.support_refs, context.calculation_result_refs);
  assert.equal("verdict" in projected, false);
  assert.equal(projected.limitations.includes("AGRONOMY_JUDGE_WATER_DEFICIT_DOES_NOT_MEAN_DECISION_ELIGIBILITY_PASS"), true);
});

test("B-07c Agronomy Judge PASS means IRRIGATE state criterion violated, not final PASS or BLOCK", () => {
  const projected = projectAgronomyJudgeEligibilityPrecursorV1(
    source({
      verdict: "PASS",
      severity: "LOW",
      reasons: ["no_irrigation_requirement"],
      outputs: {
        skill_id: "irrigation_requirement_skill_v1",
        requirement_detected: false,
        net_irrigation_requirement_mm: 0,
      },
    }),
    context,
  );

  assert.equal(projected.classification, "IRRIGATION_REQUIREMENT_ABSENT");
  assert.equal(projected.source_verdict, "PASS");
  assert.equal(projected.direct_verdict_authority, "NONE");
  assert.equal(projected.criterion_assessments[0]?.criterion, "STATE");
  assert.equal(projected.criterion_assessments[0]?.status, "VIOLATED");
  assert.equal("verdict" in projected, false);
  assert.equal(projected.limitations.includes("AGRONOMY_JUDGE_PASS_DOES_NOT_MEAN_DECISION_ELIGIBILITY_PASS"), true);
  assert.equal(projected.limitations.includes("STATE_VIOLATION_IS_CRITERION_ONLY_NOT_FINAL_BLOCK"), true);
});

test("B-07c BLOCKED by Evidence Judge becomes QUALIFIED_EVIDENCE=MISSING, not BLOCK", () => {
  for (const evidence_judge_verdict of ["DEVICE_OFFLINE", "INSUFFICIENT_EVIDENCE", "STALE_DATA"]) {
    const projected = projectAgronomyJudgeEligibilityPrecursorV1(
      source({
        verdict: "BLOCKED",
        reasons: ["blocked_by_evidence_judge"],
        inputs: { evidence_judge_verdict },
      }),
      context,
    );

    assert.equal(projected.classification, "AGRONOMY_EVIDENCE_GAP");
    assert.equal(projected.direct_verdict_authority, "NONE");
    assert.equal(projected.criterion_assessments[0]?.criterion, "QUALIFIED_EVIDENCE");
    assert.equal(projected.criterion_assessments[0]?.status, "MISSING");
    assert.deepEqual(projected.criterion_assessments[0]?.support_refs, context.canonical_evidence_qualification_refs);
    assert.equal("verdict" in projected, false);
    assert.equal(projected.limitations.includes("AGRONOMY_JUDGE_BLOCKED_DOES_NOT_MEAN_DECISION_ELIGIBILITY_BLOCK"), true);
  }
});

test("B-07c legacy judge evidence refs never become canonical EvidenceQualification refs", () => {
  const projected = projectAgronomyJudgeEligibilityPrecursorV1(
    source({
      verdict: "BLOCKED",
      reasons: ["blocked_by_evidence_judge"],
      inputs: { evidence_judge_verdict: "STALE_DATA" },
      evidence_refs: ["legacy:must_not_promote"],
    }),
    context,
  );

  assert.deepEqual(
    projected.criterion_assessments[0]?.support_refs,
    context.canonical_evidence_qualification_refs,
  );
  assert.equal(JSON.stringify(projected).includes("legacy:must_not_promote"), false);
});

test("B-07c legacy judge calculation outputs never replace explicit canonical CalculationResult refs", () => {
  const projected = projectAgronomyJudgeEligibilityPrecursorV1(
    source({
      outputs: {
        requirement_detected: true,
        net_irrigation_requirement_mm: 999,
        calculation_trace: ["legacy:trace:must_not_promote"],
      },
    }),
    context,
  );

  assert.deepEqual(projected.criterion_assessments[0]?.support_refs, context.calculation_result_refs);
  assert.equal(JSON.stringify(projected).includes("999"), false);
  assert.equal(JSON.stringify(projected).includes("legacy:trace:must_not_promote"), false);
});

test("B-07c WATER_DEFICIT/PASS require explicit canonical CalculationResult support", () => {
  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source(),
      { ...context, calculation_result_refs: [] },
    ),
    /B07C_CANONICAL_CALCULATION_RESULT_REQUIRED/,
  );

  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source({ verdict: "PASS", reasons: ["no_irrigation_requirement"] }),
      { ...context, calculation_result_refs: [] },
    ),
    /B07C_CANONICAL_CALCULATION_RESULT_REQUIRED/,
  );
});

test("B-07c only IRRIGATE candidates are supported", () => {
  for (const action of ["FERTILIZE", "INSPECT", "WAIT", "SPRAY", ""]) {
    assert.throws(
      () => projectAgronomyJudgeEligibilityPrecursorV1(
        source(),
        { ...context, candidate_action_type: action },
      ),
      /B07C_ONLY_IRRIGATE_CANDIDATE_SUPPORTED/,
    );
  }
});

test("B-07c malformed Judge semantics fail closed", () => {
  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source({ judge_kind: "EVIDENCE" }),
      context,
    ),
    /B07C_AGRONOMY_JUDGE_SOURCE_REQUIRED/,
  );

  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source({ verdict: "WATER_DEFICIT", reasons: ["other"] }),
      context,
    ),
    /B07C_WATER_DEFICIT_REQUIREMENT_REASON_REQUIRED/,
  );

  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source({ verdict: "PASS", reasons: ["other"] }),
      context,
    ),
    /B07C_PASS_NO_REQUIREMENT_REASON_REQUIRED/,
  );

  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source({
        verdict: "BLOCKED",
        reasons: ["blocked_by_evidence_judge"],
        inputs: { evidence_judge_verdict: "SENSOR_DRIFT" },
      }),
      context,
    ),
    /B07C_BLOCKED_EVIDENCE_VERDICT_NOT_RECOGNIZED/,
  );

  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source({ verdict: "UNKNOWN" }),
      context,
    ),
    /B07C_UNKNOWN_AGRONOMY_JUDGE_VERDICT/,
  );
});

test("B-07c downstream-contaminated JudgeResult objects fail closed", () => {
  for (const extra of [
    { approval_request_id: "apr1" },
    { operation_plan_id: "opl1" },
    { task_id: "task1" },
    { receipt_id: "receipt1" },
    { as_executed_id: "exec1" },
  ]) {
    assert.throws(
      () => projectAgronomyJudgeEligibilityPrecursorV1(source(extra), context),
      /B07C_SOURCE_ALREADY_CARRIES_DOWNSTREAM_AUTHORITY/,
    );
  }
});

test("B-07c identity refs are mandatory", () => {
  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source(),
      { ...context, candidate_ref: "" },
    ),
    /B07C_CANDIDATE_REF_REQUIRED/,
  );

  assert.throws(
    () => projectAgronomyJudgeEligibilityPrecursorV1(
      source(),
      { ...context, source_ref: "" },
    ),
    /B07C_SOURCE_REF_REQUIRED/,
  );
});
