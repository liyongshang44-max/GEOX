// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B_EXTERNAL_EVIDENCE_BINDING_SEAM.ts
// Purpose: prove Amendment-05 External soil binding authority is explicit, fail-closed, additive, and usable through a CAP08-safe External A0 Evidence service while historical Replay defaults remain available.
// Boundary: deterministic in-memory acceptance only; no database, filesystem raw-source read, provider network, Runtime persistence, scheduler, Formal write, recommendation, action or O00 execution.

import assert from "node:assert/strict";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_ALL_BINDING_IDS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  buildFrozenEvidenceWindowV1,
} from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import {
  ExternalFormalA0EvidenceWindowServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.js";
import {
  selectAssimilatedContinuationObservationV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap03R2V2FixtureV1,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function soilRecord(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1 {
  const found = records.find((record) => record.record_type === "soil_moisture_observation_v1");
  assert.ok(found, "EA5B_SOIL_FIXTURE_REQUIRED");
  return structuredClone(found);
}

function externalizeSoil(record: CanonicalReplayEvidenceRecordV1): CanonicalReplayEvidenceRecordV1 {
  const external = structuredClone(record);
  external.source_record_id = "ea5b_external_kbs_soil";
  external.source_record_hash = "sha256:ea5b_external_kbs_soil";
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
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_ALL_BINDING_IDS_V1.length, 5);
  assert.equal(new Set(MCFT_CAP09_EXTERNAL_FORMAL_ALL_BINDING_IDS_V1).size, 5);
  assert.deepEqual(MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1, [
    "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1",
    "noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1",
  ]);
  ok("Amendment-05 freezes five unique External Formal binding IDs and exact future pair");

  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.soil_measurement_depth_mm, 100);
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.soil_direct_state_equivalence, false);
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.soil_direct_field_equivalence, false);
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.soil_direct_root_zone_equivalence, false);
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.soil_root_zone_representativeness, "PARTIAL");
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.soil_observation_operator_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.model_parameter_authority, "MODEL_PRIOR_FROM_CAP08");
  assert.equal(MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1.field_calibration_status, "NOT_FIELD_CALIBRATED");
  ok("External soil profile preserves 100-mm near-site partial representativeness and no equivalence claim");

  const fixture = await buildMcftCap03R2V2FixtureV1(1);
  const scope = fixture.source.scope;
  const logicalTime = fixture.firstLogicalTime;
  const records = (await fixture.runtime.loadCandidateRecords({
    scope,
    logical_time: logicalTime,
  })).map((record) => structuredClone(record));
  const legacySoil = soilRecord(records);
  assert.equal(legacySoil.binding_id, ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1);
  const externalSoil = externalizeSoil(legacySoil);
  const mixedRecords = [
    ...records.filter((record) => record.record_type !== "soil_moisture_observation_v1"),
    legacySoil,
    externalSoil,
  ];

  const externalA0 = buildFrozenEvidenceWindowV1({
    scope,
    logical_time: logicalTime,
    candidate_records: mixedRecords,
    authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  assert.equal(externalA0.authorized_soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(externalA0.assimilation_observation.source_record_id, externalSoil.source_record_id);
  assert.equal(externalA0.assimilation_observation.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  const excludedLegacy = externalA0.excluded_records.find((record) => record.source_record_id === legacySoil.source_record_id);
  assert.equal(excludedLegacy?.reason_code, "SOIL_BINDING_NOT_AUTHORIZED");
  assert.equal(excludedLegacy?.model_consumption_status, "NOT_CONSUMED_EXCLUDED");
  assert.ok(!externalA0.consumed_evidence_refs.includes(legacySoil.source_record_id));
  ok("A0 External binding whitelist consumes KBS soil and excludes same-scope historical C8 soil");

  const externalEvidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords() {
      return mixedRecords;
    },
  };
  const externalA0Service = new ExternalFormalA0EvidenceWindowServiceV1(externalEvidenceSource);
  const preparedExternalA0 = await externalA0Service.prepare({
    scope,
    logical_time: logicalTime,
  });
  assert.equal(preparedExternalA0.authorized_soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(preparedExternalA0.evidence_window.assimilation_observation.source_record_id, externalSoil.source_record_id);
  assert.equal(preparedExternalA0.evidence_window.excluded_records.find((record) => record.source_record_id === legacySoil.source_record_id)?.reason_code, "SOIL_BINDING_NOT_AUTHORIZED");
  ok("CAP08-safe External A0 Evidence service enforces KBS binding without mutating historical A0 bootstrap core");

  const legacyA0 = buildFrozenEvidenceWindowV1({
    scope,
    logical_time: logicalTime,
    candidate_records: records,
  });
  assert.equal("authorized_soil_binding_id" in legacyA0, false);
  assert.equal(legacyA0.assimilation_observation.binding_id, ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1);
  ok("A0 legacy call omits new profile field and retains historical Replay binding behavior");

  const externalSelection = selectAssimilatedContinuationObservationV2({
    scope,
    logical_time: logicalTime,
    saturation_fraction: fixture.firstV2Config.payload.soil_hydraulic_snapshot.saturation_fraction,
    observation_records: [legacySoil, externalSoil],
    authorized_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  assert.equal(externalSelection.authorized_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(externalSelection.selected_observation_ref, externalSoil.source_record_id);
  assert.equal(externalSelection.selected_observation?.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(externalSelection.candidates.find((candidate) => candidate.observation_ref === legacySoil.source_record_id)?.candidate_assessment, "REJECTED_UNAUTHORIZED_BINDING");
  ok("continuation selector explicitly selects External KBS binding and rejects historical C8 binding");

  const legacySelection = selectAssimilatedContinuationObservationV2({
    scope,
    logical_time: logicalTime,
    saturation_fraction: fixture.firstV2Config.payload.soil_hydraulic_snapshot.saturation_fraction,
    observation_records: [legacySoil, externalSoil],
  });
  assert.equal("authorized_binding_id" in legacySelection, false);
  assert.equal(legacySelection.selected_observation_ref, legacySoil.source_record_id);
  assert.equal(legacySelection.candidates.find((candidate) => candidate.observation_ref === externalSoil.source_record_id)?.candidate_assessment, "REJECTED_UNAUTHORIZED_BINDING");
  ok("continuation selector default remains historical Replay binding authority");

  assert.throws(() => buildFrozenEvidenceWindowV1({
    scope,
    logical_time: logicalTime,
    candidate_records: records,
    authorized_soil_binding_id: " ",
  }), /AUTHORIZED_SOIL_BINDING_ID_INVALID/);
  assert.throws(() => selectAssimilatedContinuationObservationV2({
    scope,
    logical_time: logicalTime,
    saturation_fraction: fixture.firstV2Config.payload.soil_hydraulic_snapshot.saturation_fraction,
    observation_records: [legacySoil],
    authorized_binding_id: " ",
  }), /INVALID_RUNTIME_CONFIG:AUTHORIZED_SOIL_BINDING_ID/);
  ok("blank binding authority fails closed in both A0 and continuation selectors");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-09 EA5B External Evidence binding seam: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
