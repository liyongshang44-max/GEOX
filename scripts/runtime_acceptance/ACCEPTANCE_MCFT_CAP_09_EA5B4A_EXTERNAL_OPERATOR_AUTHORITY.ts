// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B4A_EXTERNAL_OPERATOR_AUTHORITY.ts
// Purpose: prove the existing CAP03 H=1 compatibility posterior can be adapted to the exact Amendment-05 External 100-mm operator provenance without changing any numerical/disposition result and without authorizing canonical persistence.
// Boundary: deterministic in-memory qualification only; no DB, provider network, scheduler, writer, canonical External A0 construction, model activation, recommendation, action, or O00.

import assert from "node:assert/strict";
import {
  buildExternalFormalAssimilationAuthorityViewV1,
} from "../../apps/server/src/domain/soil_water/external_formal_assimilation_authority_view_v1.js";
import { composeAssimilatedContinuationPosteriorV1 } from "../../apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
  ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { buildCap04S6SingleTickFixtureV1 } from "./mcft_cap_04_single_tick_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function soilRecord(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1 {
  const found = records.find((record) => record.record_type === "soil_moisture_observation_v1");
  assert.ok(found, "EA5B4A_SOIL_FIXTURE_REQUIRED");
  return structuredClone(found);
}

function externalizeSoil(record: CanonicalReplayEvidenceRecordV1): CanonicalReplayEvidenceRecordV1 {
  const external = structuredClone(record);
  external.source_record_id = "ea5b4a_external_kbs_soil";
  external.source_record_hash = "sha256:ea5b4a_external_kbs_soil";
  external.binding_id = MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  external.origin_source_id = "KBS_LTER_CURRENT_WEATHER_VARIATE_25";
  external.source_payload = {
    ...external.source_payload,
    source_version: "kbs-lter-current-weather-variate-25-v1",
  };
  external.limitations = [
    "NEAR_SITE_POINT_SUPPORT",
    "MEASUREMENT_DEPTH_100MM",
    "DIRECT_FIELD_EQUIVALENCE_FALSE",
    "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
    "ROOT_ZONE_REPRESENTATIVENESS_PARTIAL",
  ];
  return external;
}

async function main(): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const baseRecords = await fixture.runtime.loadCandidateRecords({
    scope: fixture.input.scope,
    logical_time: fixture.input.logical_time,
  });
  const legacySoil = soilRecord(baseRecords);
  assert.equal(legacySoil.binding_id, ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1);
  const externalSoil = externalizeSoil(legacySoil);
  const mixedRecords = [
    ...baseRecords.filter((record) => record.record_type !== "soil_moisture_observation_v1"),
    legacySoil,
    externalSoil,
  ];
  const externalEvidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords() {
      return structuredClone(mixedRecords);
    },
  };
  const service = new Cap04ForecastScenarioSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(fixture.runtime),
    externalEvidenceSource,
    fixture.runtime,
    fixture.runtime,
  );
  const result = await service.executeOneTick({
    ...fixture.input,
    authorized_soil_observation_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  assert.ok(result.assimilation, "EA5B4A_COMPATIBILITY_ASSIMILATION_REQUIRED");
  assert.ok(result.evidence_window, "EA5B4A_EVIDENCE_WINDOW_REQUIRED");
  assert.equal(
    result.evidence_window.observation_selection.authorized_binding_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  );
  assert.equal(
    result.assimilation.observation_operator.id,
    ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
  );
  const compatibilitySnapshot = structuredClone(result.assimilation);
  const view = buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: result.assimilation,
    evidence_authority: {
      authorized_binding_id: result.evidence_window.observation_selection.authorized_binding_id!,
      selected_observation_ref: result.evidence_window.observation_selection.selected_observation_ref,
    },
  });
  assert.equal(view.authorized_soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(view.source_compatibility_operator_id, ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1);
  assert.equal(view.external_operator_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  assert.equal(view.posterior_candidate.observation_operator.id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  assert.equal(view.posterior_candidate.observation_operator.measurement_depth_mm, 100);
  assert.equal(view.posterior_candidate.observation_operator.root_zone_representativeness, "PARTIAL");
  assert.equal(view.posterior_candidate.observation_operator.direct_field_equivalence, false);
  assert.equal(view.posterior_candidate.observation_operator.direct_root_zone_equivalence, false);
  ok("External KBS binding maps to exact 100-mm operator provenance while historical compatibility math stays H=1");

  assert.equal(view.compatibility_numeric_digest, view.external_candidate_numeric_digest);
  assert.equal(view.numerical_identity_preserved, true);
  assert.equal(view.posterior_candidate.published_posterior_mean, result.assimilation.published_posterior_mean);
  assert.equal(view.posterior_candidate.published_posterior_variance, result.assimilation.published_posterior_variance);
  assert.deepEqual(view.posterior_candidate.canonical_decimal_basis, result.assimilation.canonical_decimal_basis);
  ok("External operator adaptation preserves the exact numerical posterior and canonical decimal basis");

  assert.deepEqual(result.assimilation, compatibilitySnapshot);
  assert.equal(result.assimilation.observation_operator.id, ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1);
  ok("Authority adaptation does not mutate the historical CAP03 compatibility posterior");

  assert.equal(view.canonical_persistence_authorized, false);
  assert.equal(view.model_parameter_authority, "MODEL_PRIOR_FROM_CAP08");
  assert.equal(view.field_calibration_status, "NOT_FIELD_CALIBRATED");
  assert.ok(view.limitations.includes("NONCANONICAL_COMPATIBILITY_MATH_SOURCE"));
  ok("EA5B4A remains non-persistable and preserves model-prior / non-calibrated nonclaims");

  assert.throws(() => buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: result.assimilation!,
    evidence_authority: {
      authorized_binding_id: ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
      selected_observation_ref: result.assimilation!.selected_observation_ref,
    },
  }), /EXTERNAL_FORMAL_ASSIMILATION_SOIL_BINDING_MISMATCH/);
  assert.throws(() => buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: result.assimilation!,
    evidence_authority: {
      authorized_binding_id: " ",
      selected_observation_ref: result.assimilation!.selected_observation_ref,
    },
  }), /EXTERNAL_FORMAL_ASSIMILATION_SOIL_BINDING_REQUIRED/);
  ok("Historical C8 or blank soil authority cannot claim External operator provenance");

  assert.throws(() => buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: result.assimilation!,
    evidence_authority: {
      authorized_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      selected_observation_ref: "different_observation_ref",
    },
  }), /EXTERNAL_FORMAL_ASSIMILATION_SELECTED_OBSERVATION_MISMATCH/);
  ok("External operator view fails closed when Evidence selection and posterior observation refs diverge");

  const config = fixture.runtime_config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const noObservation = composeAssimilatedContinuationPosteriorV1({
    prior_mean: 0.3,
    prior_variance: 0.001,
    selected_observation: null,
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm,
    sensor_measurement_stddev_fraction: config.observation_assimilation.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: config.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
    quality_weights: config.observation_assimilation.quality_weights,
  });
  const noObservationView = buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: noObservation,
    evidence_authority: {
      authorized_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      selected_observation_ref: null,
    },
  });
  assert.equal(noObservationView.posterior_candidate.disposition, "NO_USABLE_OBSERVATION");
  assert.equal(noObservationView.posterior_candidate.selected_observation_ref, null);
  assert.equal(noObservationView.posterior_candidate.observation_operator.id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  assert.equal(noObservationView.numerical_identity_preserved, true);
  ok("No-observation degraded posterior can carry External operator authority without inventing an observation");

  assert.equal(pass, 7);
  console.log(`MCFT-CAP-09 EA5B4A External operator authority: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
