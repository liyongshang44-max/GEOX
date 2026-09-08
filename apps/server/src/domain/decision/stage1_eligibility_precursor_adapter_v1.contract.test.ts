import assert from "node:assert/strict";
import test from "node:test";

import { projectStage1FormalTriggerEligibilityPrecursorV1 } from "./stage1_eligibility_precursor_adapter_v1.js";

const context = {
  candidate_ref: "candidate_decision_v1:candidate_001",
  source_ref: "stage1_formal_trigger_gate_v1:gate_001",
  canonical_evidence_qualification_refs: [
    "evidence_qualification_v1:eq_pressure",
    "evidence_qualification_v1:eq_meter",
  ],
};

test("B-07b Stage-1 ELIGIBLE becomes satisfied evidence criterion, not PASS", () => {
  const projected = projectStage1FormalTriggerEligibilityPrecursorV1(
    { status: "ELIGIBLE", reason_codes: [] },
    context,
  );

  assert.equal(projected.classification, "FORMAL_TRIGGER_SUPPORTED");
  assert.equal(projected.source_status, "ELIGIBLE");
  assert.equal(projected.direct_verdict_authority, "NONE");
  assert.equal(projected.criterion_assessments.length, 1);
  assert.equal(projected.criterion_assessments[0]?.criterion, "QUALIFIED_EVIDENCE");
  assert.equal(projected.criterion_assessments[0]?.status, "SATISFIED");
  assert.equal("verdict" in projected, false);
  assert.equal(projected.limitations.includes("STAGE1_ELIGIBLE_DOES_NOT_MEAN_DECISION_ELIGIBILITY_PASS"), true);
});

test("B-07b Stage-1 NEEDS_EVIDENCE becomes missing evidence criterion only", () => {
  const projected = projectStage1FormalTriggerEligibilityPrecursorV1(
    {
      status: "NEEDS_EVIDENCE",
      error: "FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE",
      reason_codes: ["FRESHNESS_NOT_FRESH", "CONFLICT_STATUS_CONFLICTING"],
    },
    context,
  );

  assert.equal(projected.classification, "FORMAL_TRIGGER_EVIDENCE_GAP");
  assert.equal(projected.direct_verdict_authority, "NONE");
  assert.equal(projected.criterion_assessments[0]?.criterion, "QUALIFIED_EVIDENCE");
  assert.equal(projected.criterion_assessments[0]?.status, "MISSING");
  assert.deepEqual(
    projected.criterion_assessments[0]?.reason_codes,
    ["FRESHNESS_NOT_FRESH", "CONFLICT_STATUS_CONFLICTING"],
  );
  assert.equal("verdict" in projected, false);
  assert.equal(projected.limitations.includes("FINAL_ACTION_VERDICT_REQUIRES_INDEPENDENT_SUPPORT_AND_OTHER_ELIGIBILITY_FACTORS"), true);
});

test("B-07b Stage-1 NOT_ELIGIBLE is no-trigger classification, not BLOCK", () => {
  const projected = projectStage1FormalTriggerEligibilityPrecursorV1(
    { status: "NOT_ELIGIBLE", reason_codes: ["NO_FORMAL_STAGE1_SIGNAL"] },
    context,
  );

  assert.equal(projected.classification, "NO_FORMAL_TRIGGER_SIGNAL");
  assert.deepEqual(projected.criterion_assessments, []);
  assert.equal(projected.direct_verdict_authority, "NONE");
  assert.equal("verdict" in projected, false);
  assert.equal(projected.limitations.includes("STAGE1_NOT_ELIGIBLE_DOES_NOT_MEAN_DECISION_ELIGIBILITY_BLOCK"), true);
});

test("B-07b canonical EvidenceQualification refs are explicit caller inputs", () => {
  const projected = projectStage1FormalTriggerEligibilityPrecursorV1(
    { status: "ELIGIBLE", reason_codes: [] },
    context,
  );

  assert.deepEqual(
    projected.criterion_assessments[0]?.support_refs,
    [
      "evidence_qualification_v1:eq_pressure",
      "evidence_qualification_v1:eq_meter",
    ],
  );
});

test("B-07b source gate cannot smuggle raw evidence or downstream authority into criterion", () => {
  const projected = projectStage1FormalTriggerEligibilityPrecursorV1(
    {
      status: "NEEDS_EVIDENCE",
      reason_codes: ["TIME_COVERAGE_MISSING"],
      raw_evidence_refs: ["raw_fact:must_not_promote"],
      approval_request_id: "apr_must_not_promote",
      operation_plan_id: "opl_must_not_promote",
      task_id: "task_must_not_promote",
    },
    context,
  );

  assert.deepEqual(
    projected.criterion_assessments[0]?.support_refs,
    context.canonical_evidence_qualification_refs,
  );
  assert.equal(JSON.stringify(projected).includes("raw_fact:must_not_promote"), false);
  assert.equal(JSON.stringify(projected).includes("apr_must_not_promote"), false);
  assert.equal(JSON.stringify(projected).includes("opl_must_not_promote"), false);
  assert.equal(JSON.stringify(projected).includes("task_must_not_promote"), false);
});

test("B-07b malformed Stage-1 status semantics fail closed", () => {
  assert.throws(
    () => projectStage1FormalTriggerEligibilityPrecursorV1(
      { status: "ELIGIBLE", reason_codes: ["UNEXPECTED"] },
      context,
    ),
    /B07B_ELIGIBLE_WITH_REASON_CODES_INVALID/,
  );

  assert.throws(
    () => projectStage1FormalTriggerEligibilityPrecursorV1(
      { status: "NEEDS_EVIDENCE", reason_codes: [] },
      context,
    ),
    /B07B_NEEDS_EVIDENCE_REASON_CODES_REQUIRED/,
  );

  assert.throws(
    () => projectStage1FormalTriggerEligibilityPrecursorV1(
      { status: "NOT_ELIGIBLE", reason_codes: ["OTHER"] },
      context,
    ),
    /B07B_NOT_ELIGIBLE_FORMAL_SIGNAL_REASON_REQUIRED/,
  );

  for (const status of ["PASS", "BLOCK", "UNKNOWN", ""]) {
    assert.throws(
      () => projectStage1FormalTriggerEligibilityPrecursorV1(
        { status, reason_codes: [] },
        context,
      ),
      /B07B_UNKNOWN_STAGE1_GATE_STATUS/,
    );
  }
});

test("B-07b candidate/source identity refs are mandatory", () => {
  assert.throws(
    () => projectStage1FormalTriggerEligibilityPrecursorV1(
      { status: "ELIGIBLE", reason_codes: [] },
      { ...context, candidate_ref: "" },
    ),
    /B07B_CANDIDATE_REF_REQUIRED/,
  );

  assert.throws(
    () => projectStage1FormalTriggerEligibilityPrecursorV1(
      { status: "ELIGIBLE", reason_codes: [] },
      { ...context, source_ref: "" },
    ),
    /B07B_SOURCE_REF_REQUIRED/,
  );
});
