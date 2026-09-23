import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStage1ActionBoundaryDebugV1,
  evaluateFormalStage1TriggerGateV1,
} from "./stage1_action_boundary_v1.js";

function eligibleSummary() {
  return {
    irrigation_effectiveness: "low",
    leak_risk: "low",
    freshness: "fresh",
    evidence_sufficiency: "PASS",
    evidence_sufficiency_v1: {
      evidence_sufficiency: "PASS",
      reason_codes: [],
    },
    time_coverage_v1: {
      observation_window: {
        start_ts_ms: 1_000,
        end_ts_ms: 10_000,
      },
      formal_sample_count: 3,
      formal_coverage_ratio: 0.75,
      formal_source_eligible: true,
      max_gap_ms: 30 * 60 * 1000,
      expected_sample_interval_ms: 30 * 60 * 1000,
      freshness: "fresh",
      trigger_metric_evidence: {
        irrigation_effectiveness: true,
        leak_risk: true,
      },
    },
    device_health_snapshot_v1: {
      device_health_status: "GOOD",
    },
    conflict_detection_v1: {
      conflict_status: "NONE",
    },
  };
}

test("B-04d3 canonical qualification projection is visible in Stage-1 debug but not gate authority", () => {
  const withoutShadow = eligibleSummary();
  const shadow = {
    schema_version: "raw_sample_evidence_qualification_projection_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    role: "STAGE1_FORMAL_EVIDENCE",
    qualifications: [{
      schema_version: "evidence_qualification_v1",
      evidence_authority: "INELIGIBLE",
    }],
    counts: {
      total: 1,
      qualified: 0,
      limited: 0,
      ineligible: 1,
      unknown: 0,
    },
    limitations: ["DO_NOT_USE_FOR_STAGE1_TRIGGER_ELIGIBILITY_YET"],
  };
  const withShadow = {
    ...eligibleSummary(),
    evidence_sufficiency_v1: {
      evidence_sufficiency: "PASS",
      reason_codes: [],
      canonical_evidence_qualification_projection_v1: shadow,
    },
  };

  assert.deepEqual(
    evaluateFormalStage1TriggerGateV1(withShadow),
    evaluateFormalStage1TriggerGateV1(withoutShadow),
    "B-04d3 shadow projection must not alter Stage-1 trigger eligibility",
  );
  assert.equal(evaluateFormalStage1TriggerGateV1(withShadow).status, "ELIGIBLE");

  const debug = buildStage1ActionBoundaryDebugV1(withShadow);
  assert.deepEqual(debug.canonical_evidence_qualification_projection, shadow);
});
