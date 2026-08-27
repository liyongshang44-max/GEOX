import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRawSampleEvidenceQualificationProjectionBatchV1,
  projectRawSampleEvidenceQualificationV1,
  STAGE1_FORMAL_EVIDENCE_ROLE_V1,
} from "./raw_sample_evidence_qualification_projection_v1.js";

const decisionTime = Date.parse("2026-08-27T06:00:00Z");

function baseInput() {
  return {
    sample: {
      sample_id: "rs_shadow_001",
      sensor_id: "dev_001",
      ts_ms: decisionTime - 10 * 60_000,
      metric: "soil_moisture",
      source: "device" as const,
      created_at: new Date(decisionTime - 9 * 60_000).toISOString(),
      payload_json: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
      },
    },
    decision_time_ms: decisionTime,
    requested_scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
    },
    source_formal_eligible: true,
    quality_decision: {
      quality_flags: ["OK"],
      observation_pipeline_eligible: true,
      reason_code: "RAW_SAMPLE_QC_OK" as const,
    },
    physical_qc_decision: {
      eligible: true,
      mode: "QUALIFIED" as const,
      reason_code: "RAW_SAMPLE_PHYSICAL_QC_PASS" as const,
    },
    conflict_state: "NONE" as const,
  };
}

test("otherwise-good raw sample remains LIMITED because exact post-COMMIT availability is not established", () => {
  const q = projectRawSampleEvidenceQualificationV1(baseInput());

  assert.equal(q.schema_version, "evidence_qualification_v1");
  assert.equal(q.observation_id, "raw_sample:rs_shadow_001");
  assert.equal(q.source_ref, "raw_sample:rs_shadow_001");
  assert.equal(q.physical_validity, "PASS");
  assert.equal(q.source_authority, "QUALIFIED");
  assert.equal(q.spatial_authority, "EXACT_SCOPE");
  assert.equal(q.conflict_state, "NONE");

  assert.equal(q.temporal_eligibility, "UNKNOWN");
  assert.equal(q.evidence_authority, "LIMITED");
  assert.equal(q.role_eligibility[0]?.role, STAGE1_FORMAL_EVIDENCE_ROLE_V1);
  assert.equal(q.role_eligibility[0]?.eligibility, "LIMITED");
  assert.ok(q.reason_codes.includes("POST_COMMIT_RUNTIME_AVAILABILITY_NOT_ESTABLISHED"));
  assert.ok(q.limitations.includes("RAW_SAMPLE_CREATED_AT_IS_NOT_POST_COMMIT_VISIBILITY_TIME"));
});

test("physical failure projects as INELIGIBLE without deleting source evidence", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_bad_physical";
  input.physical_qc_decision = {
    eligible: false,
    mode: "INELIGIBLE_INVALID",
    reason_code: "RAW_SAMPLE_PHYSICAL_QC_INVALID",
  };

  const q = projectRawSampleEvidenceQualificationV1(input);
  assert.equal(q.presence, "PRESENT");
  assert.equal(q.physical_validity, "FAIL");
  assert.equal(q.evidence_authority, "INELIGIBLE");
  assert.equal(q.role_eligibility[0]?.eligibility, "INELIGIBLE");
});

test("non-formal source remains visible but source authority is UNQUALIFIED", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_unknown_source";
  input.sample.source = "unknown";
  input.source_formal_eligible = false;

  const q = projectRawSampleEvidenceQualificationV1(input);
  assert.equal(q.source_authority, "UNQUALIFIED");
  assert.equal(q.evidence_authority, "INELIGIBLE");
  assert.ok(q.reason_codes.includes("SOURCE_NOT_FORMAL_ELIGIBLE"));
});

test("scope mismatch becomes OUT_OF_SCOPE and INELIGIBLE", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_wrong_project";
  input.sample.payload_json.project_id = "projectB";

  const q = projectRawSampleEvidenceQualificationV1(input);
  assert.equal(q.spatial_authority, "OUT_OF_SCOPE");
  assert.equal(q.evidence_authority, "INELIGIBLE");
  assert.equal(q.role_eligibility[0]?.eligibility, "INELIGIBLE");
});

test("row created after decision time is explicitly NOT_AVAILABLE_AT_DECISION", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_backfilled_later";
  input.sample.created_at = new Date(decisionTime + 60_000).toISOString();

  const q = projectRawSampleEvidenceQualificationV1(input);
  assert.equal(q.temporal_eligibility, "NOT_AVAILABLE_AT_DECISION");
  assert.equal(q.evidence_authority, "INELIGIBLE");
  assert.ok(q.reason_codes.includes("RAW_SAMPLE_CREATED_AFTER_DECISION_TIME"));
});

test("missing created_at stays temporal UNKNOWN rather than fabricated", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_missing_availability";
  input.sample.created_at = null;

  const q = projectRawSampleEvidenceQualificationV1(input);
  assert.equal(q.temporal_eligibility, "UNKNOWN");
  assert.equal(q.evidence_authority, "LIMITED");
  assert.ok(q.reason_codes.includes("RUNTIME_AVAILABILITY_METADATA_MISSING"));
});

test("shadow batch reports authority distribution and cannot claim canonical PASS", () => {
  const good = projectRawSampleEvidenceQualificationV1(baseInput());
  const badInput = baseInput();
  badInput.sample.sample_id = "rs_bad";
  badInput.source_formal_eligible = false;
  badInput.sample.source = "unknown";
  const bad = projectRawSampleEvidenceQualificationV1(badInput);

  const batch = buildRawSampleEvidenceQualificationProjectionBatchV1([good, bad]);
  assert.equal(batch.authority_mode, "SHADOW_NON_AUTHORITATIVE");
  assert.deepEqual(batch.counts, {
    total: 2,
    qualified: 0,
    limited: 1,
    ineligible: 1,
    unknown: 0,
  });
  assert.ok(batch.limitations.includes("DO_NOT_USE_FOR_STAGE1_TRIGGER_ELIGIBILITY_YET"));
});
