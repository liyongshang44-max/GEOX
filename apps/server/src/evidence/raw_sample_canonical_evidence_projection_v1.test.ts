import assert from "node:assert/strict";
import test from "node:test";

import {
  projectRawSampleCanonicalEvidenceV1,
  STAGE1_FORMAL_EVIDENCE_ROLE_V1,
} from "./raw_sample_canonical_evidence_projection_v1.js";

const decisionTime = Date.parse("2026-08-27T06:00:00Z");

function baseInput() {
  return {
    sample: {
      sample_id: "rs_qualified",
      sensor_id: "dev_001",
      ts_ms: decisionTime - 10 * 60_000,
      metric: "soil_moisture",
      value: 0.22,
      source: "device" as const,
      created_at: new Date(decisionTime - 9 * 60_000).toISOString(),
      payload_json: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
        unit: "m3/m3",
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
    device_transport_health: "GOOD" as const,
  };
}

test("fully qualified raw sample projects into canonical observation and EvidenceQualificationV1", () => {
  const result = projectRawSampleCanonicalEvidenceV1(baseInput());
  assert.equal(result.status, "PROJECTED");
  if (result.status !== "PROJECTED") return;

  assert.equal(result.observation.schema_version, "canonical_observation_v1");
  assert.equal(result.observation.source_fact_id, "raw_sample:rs_qualified");
  assert.equal(result.observation.measurement_health, "VALID");
  assert.equal(result.observation.physical_validity, "PASS");
  assert.equal(result.observation.temporal_eligibility, "ELIGIBLE");
  assert.equal(result.observation.source_authority, "QUALIFIED");
  assert.equal(result.observation.spatial_authority, "EXACT_SCOPE");
  assert.equal(result.observation.conflict_state, "NONE");

  assert.equal(result.qualification.schema_version, "evidence_qualification_v1");
  assert.equal(result.qualification.evidence_authority, "QUALIFIED");
  assert.equal(result.qualification.role_eligibility[0]?.role, STAGE1_FORMAL_EVIDENCE_ROLE_V1);
  assert.equal(result.qualification.role_eligibility[0]?.eligibility, "ELIGIBLE");
});

test("physical FAIL remains source evidence but canonical Stage-1 role is INELIGIBLE", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_invalid";
  input.sample.value = 1.7;
  input.physical_qc_decision = {
    eligible: false,
    mode: "INELIGIBLE_INVALID",
    reason_code: "RAW_SAMPLE_PHYSICAL_QC_INVALID",
  };

  const result = projectRawSampleCanonicalEvidenceV1(input);
  assert.equal(result.status, "PROJECTED");
  if (result.status !== "PROJECTED") return;

  assert.equal(result.observation.raw_value, 1.7);
  assert.equal(result.observation.measurement_health, "INVALID");
  assert.equal(result.qualification.physical_validity, "FAIL");
  assert.equal(result.qualification.evidence_authority, "INELIGIBLE");
  assert.equal(result.qualification.role_eligibility[0]?.eligibility, "INELIGIBLE");
});

test("non-formal source projects as UNQUALIFIED rather than disappearing", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_unknown_source";
  input.sample.source = "unknown";
  input.source_formal_eligible = false;

  const result = projectRawSampleCanonicalEvidenceV1(input);
  assert.equal(result.status, "PROJECTED");
  if (result.status !== "PROJECTED") return;

  assert.equal(result.qualification.source_authority, "UNQUALIFIED");
  assert.equal(result.qualification.evidence_authority, "INELIGIBLE");
  assert.ok(result.qualification.reason_codes.includes("SOURCE_NOT_FORMAL_ELIGIBLE"));
});

test("legacy sample without ingress physical QC is explicitly LIMITED in canonical shadow projection", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_legacy";
  input.physical_qc_decision = {
    eligible: true,
    mode: "LEGACY_UNCLASSIFIED",
    reason_code: "RAW_SAMPLE_PHYSICAL_QC_LEGACY_UNCLASSIFIED",
  };

  const result = projectRawSampleCanonicalEvidenceV1(input);
  assert.equal(result.status, "PROJECTED");
  if (result.status !== "PROJECTED") return;

  assert.equal(result.qualification.physical_validity, "UNKNOWN");
  assert.equal(result.qualification.evidence_authority, "LIMITED");
  assert.equal(result.qualification.role_eligibility[0]?.eligibility, "LIMITED");
  assert.ok(result.qualification.limitations.includes("LEGACY_RAW_SAMPLE_WITHOUT_INGRESS_PHYSICAL_QC"));
});

test("suspect caller quality stays SUSPECT and becomes LIMITED rather than OK", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_suspect";
  input.quality_decision = {
    quality_flags: ["SUSPECT"],
    observation_pipeline_eligible: true,
    reason_code: "RAW_SAMPLE_QC_SUSPECT",
  };

  const result = projectRawSampleCanonicalEvidenceV1(input);
  assert.equal(result.status, "PROJECTED");
  if (result.status !== "PROJECTED") return;

  assert.equal(result.observation.measurement_health, "SUSPECT");
  assert.equal(result.qualification.evidence_authority, "LIMITED");
  assert.equal(result.qualification.role_eligibility[0]?.eligibility, "LIMITED");
});

test("future availability relative to decision time becomes NOT_AVAILABLE_AT_DECISION", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_backfill";
  input.sample.created_at = new Date(decisionTime + 60_000).toISOString();

  const result = projectRawSampleCanonicalEvidenceV1(input);
  assert.equal(result.status, "PROJECTED");
  if (result.status !== "PROJECTED") return;

  assert.equal(result.qualification.temporal_eligibility, "NOT_AVAILABLE_AT_DECISION");
  assert.equal(result.qualification.evidence_authority, "INELIGIBLE");
  assert.equal(result.qualification.role_eligibility[0]?.eligibility, "INELIGIBLE");
});

test("missing runtime availability metadata is omitted instead of fabricated", () => {
  const input = baseInput();
  input.sample.sample_id = "rs_missing_created_at";
  input.sample.created_at = null;

  assert.deepEqual(projectRawSampleCanonicalEvidenceV1(input), {
    status: "OMITTED",
    sample_id: "rs_missing_created_at",
    reason_code: "CANONICAL_PROJECTION_MISSING_CREATED_AT",
  });
});
