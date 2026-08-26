import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalObservationV1Schema,
  evidenceQualificationV1Schema,
} from "./canonical_evidence_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_fixture",
  season_id: "season_fixture",
  zone_id: null,
};

const baseObservation = {
  schema_version: "canonical_observation_v1" as const,
  observation_id: "obs_fixture_001",
  source_fact_id: "fact_fixture_001",
  source_ref: "fixture://sensor/rh",
  scope,
  metric: "relative_humidity_pct",
  unit: "%",
  raw_value: 55,
  canonical_value: 55,
  observed_at: "2026-08-27T00:00:00Z",
  ingested_at: "2026-08-27T00:00:05Z",
  available_to_runtime_at: "2026-08-27T00:00:05Z",
  device_transport_health: "GOOD" as const,
  measurement_health: "VALID" as const,
  physical_validity: "PASS" as const,
  temporal_eligibility: "ELIGIBLE" as const,
  source_authority: "QUALIFIED" as const,
  spatial_authority: "EXACT_SCOPE" as const,
  conflict_state: "NONE" as const,
  role_eligibility: [
    {
      role: "PHYSICAL_STATE_INPUT",
      eligibility: "ELIGIBLE" as const,
      reason_codes: [],
    },
  ],
  limitations: [],
  reason_codes: [],
  epistemic_class: "OBSERVED" as const,
};

test("device transport health remains distinct from measurement validity", () => {
  const result = canonicalObservationV1Schema.safeParse({
    ...baseObservation,
    raw_value: 102.7,
    canonical_value: 102.7,
    device_transport_health: "GOOD",
    measurement_health: "INVALID",
    physical_validity: "FAIL",
    role_eligibility: [
      {
        role: "PHYSICAL_STATE_INPUT",
        eligibility: "INELIGIBLE",
        reason_codes: ["PHYSICAL_RANGE_VIOLATION"],
      },
    ],
    reason_codes: ["PHYSICAL_RANGE_VIOLATION"],
  });

  assert.equal(result.success, true);
});

test("physically invalid evidence cannot retain an eligible physical-state role", () => {
  const result = canonicalObservationV1Schema.safeParse({
    ...baseObservation,
    raw_value: 102.7,
    canonical_value: 102.7,
    measurement_health: "INVALID",
    physical_validity: "FAIL",
  });

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues), /B03_INVALID_EVIDENCE_CANNOT_RETAIN_ELIGIBLE_ROLE_AUTHORITY/);
});

test("observed evidence cannot lose its source-fact provenance", () => {
  const result = canonicalObservationV1Schema.safeParse({
    ...baseObservation,
    source_fact_id: null,
  });

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues), /B03_OBSERVED_EVIDENCE_REQUIRES_SOURCE_FACT_ID/);
});

test("missing evidence is represented as missing rather than as a fabricated observation", () => {
  const result = evidenceQualificationV1Schema.safeParse({
    schema_version: "evidence_qualification_v1",
    qualification_id: "eq_missing_001",
    observation_id: null,
    source_ref: "fixture://sensor/soil-moisture",
    metric: "soil_moisture_pct",
    scope,
    evaluated_at: "2026-08-27T00:05:00Z",
    decision_time: "2026-08-27T00:05:00Z",
    presence: "MISSING",
    epistemic_class: "UNKNOWN",
    physical_validity: "UNKNOWN",
    temporal_eligibility: "UNKNOWN",
    source_authority: "UNKNOWN",
    spatial_authority: "UNKNOWN",
    conflict_state: "UNKNOWN",
    evidence_authority: "INELIGIBLE",
    role_eligibility: [
      {
        role: "PHYSICAL_STATE_INPUT",
        eligibility: "INELIGIBLE",
        reason_codes: ["MISSING_OBSERVATION"],
      },
    ],
    limitations: ["NO_OBSERVATION_AVAILABLE_AT_DECISION_TIME"],
    reason_codes: ["MISSING_OBSERVATION"],
  });

  assert.equal(result.success, true);
});

test("missing evidence cannot masquerade as qualified evidence", () => {
  const result = evidenceQualificationV1Schema.safeParse({
    schema_version: "evidence_qualification_v1",
    qualification_id: "eq_missing_bad_001",
    observation_id: "fabricated_obs_001",
    source_ref: "fixture://sensor/soil-moisture",
    metric: "soil_moisture_pct",
    scope,
    evaluated_at: "2026-08-27T00:05:00Z",
    decision_time: "2026-08-27T00:05:00Z",
    presence: "MISSING",
    epistemic_class: "ASSUMED",
    physical_validity: "UNKNOWN",
    temporal_eligibility: "UNKNOWN",
    source_authority: "UNKNOWN",
    spatial_authority: "UNKNOWN",
    conflict_state: "UNKNOWN",
    evidence_authority: "QUALIFIED",
    role_eligibility: [
      {
        role: "PHYSICAL_STATE_INPUT",
        eligibility: "ELIGIBLE",
        reason_codes: [],
      },
    ],
    limitations: [],
    reason_codes: [],
  });

  assert.equal(result.success, false);
  const issues = JSON.stringify(result.error?.issues);
  assert.match(issues, /B03_MISSING_EVIDENCE_MUST_NOT_REFERENCE_FABRICATED_OBSERVATION/);
  assert.match(issues, /B03_MISSING_EVIDENCE_CANNOT_BE_QUALIFIED/);
  assert.match(issues, /B03_MISSING_EVIDENCE_CANNOT_RETAIN_ELIGIBLE_ROLE_AUTHORITY/);
});

test("stale evidence cannot remain fully qualified or role-eligible", () => {
  const result = evidenceQualificationV1Schema.safeParse({
    schema_version: "evidence_qualification_v1",
    qualification_id: "eq_stale_bad_001",
    observation_id: "obs_stale_001",
    source_ref: "fixture://provider/weather",
    metric: "air_temperature_c",
    scope,
    evaluated_at: "2026-08-27T00:05:00Z",
    decision_time: "2026-08-27T00:05:00Z",
    presence: "PRESENT",
    epistemic_class: "OBSERVED",
    physical_validity: "PASS",
    temporal_eligibility: "STALE",
    source_authority: "QUALIFIED",
    spatial_authority: "EXACT_SCOPE",
    conflict_state: "NONE",
    evidence_authority: "QUALIFIED",
    role_eligibility: [
      {
        role: "DECISION_EVIDENCE",
        eligibility: "ELIGIBLE",
        reason_codes: [],
      },
    ],
    limitations: ["STALE_AT_DECISION_TIME"],
    reason_codes: ["STALE_AT_DECISION_TIME"],
  });

  assert.equal(result.success, false);
  const issues = JSON.stringify(result.error?.issues);
  assert.match(issues, /B03_FAILED_QUALIFICATION_DIMENSION_CANNOT_BE_FULLY_QUALIFIED/);
  assert.match(issues, /B03_FAILED_QUALIFICATION_DIMENSION_CANNOT_RETAIN_ELIGIBLE_ROLE_AUTHORITY/);
});

test("spatially limited evidence may remain explicitly LIMITED without becoming exact-scope truth", () => {
  const result = evidenceQualificationV1Schema.safeParse({
    schema_version: "evidence_qualification_v1",
    qualification_id: "eq_spatial_limited_001",
    observation_id: "obs_spatial_limited_001",
    source_ref: "fixture://provider/parent-area",
    metric: "rainfall_mm",
    scope,
    evaluated_at: "2026-08-27T00:05:00Z",
    decision_time: "2026-08-27T00:05:00Z",
    presence: "PRESENT",
    epistemic_class: "LIMITED",
    physical_validity: "PASS",
    temporal_eligibility: "ELIGIBLE",
    source_authority: "QUALIFIED",
    spatial_authority: "LIMITED",
    conflict_state: "NONE",
    evidence_authority: "LIMITED",
    role_eligibility: [
      {
        role: "DECISION_EVIDENCE",
        eligibility: "LIMITED",
        reason_codes: ["SPATIAL_AUTHORITY_LIMITED"],
      },
    ],
    limitations: ["PARENT_OR_PARTIAL_SPATIAL_AUTHORITY"],
    reason_codes: ["SPATIAL_AUTHORITY_LIMITED"],
  });

  assert.equal(result.success, true);
});
