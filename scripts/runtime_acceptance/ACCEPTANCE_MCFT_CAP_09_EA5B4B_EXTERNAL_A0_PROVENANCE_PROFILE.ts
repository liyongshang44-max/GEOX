// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE.ts
// Purpose: prove one honest External Formal A0 nine-object canonical candidate can be constructed from explicit External Runtime Config/Evidence authority while reusing frozen CAP01 bootstrap mathematics only as a non-canonical compatibility producer.
// Boundary: deterministic in-memory qualification only. Qualification refs/hashes are not persisted Formal authority. No database, writer, lease, scheduler, provider network, CAP04 execution, recommendation, action, model activation, or O00.

import assert from "node:assert/strict";
import {
  MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1,
} from "../../apps/server/src/domain/twin_runtime/runtime_config_v1.js";
import {
  buildRootZoneWaterPosteriorV1,
  type BootstrapWaterModelConfigV1,
} from "../../apps/server/src/domain/soil_water/root_zone_water_posterior_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  validateA0RecordSetV1,
  type A0RecordSetV1,
  type CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import {
  buildExternalFormalA0RecordSetV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a0_record_set_builder_v1.js";
import {
  buildFrozenEvidenceWindowV1,
} from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04S6SingleTickFixtureV1 } from "./mcft_cap_04_single_tick_fixture_v1.js";
import { buildMcftCap03R2V2FixtureV1 } from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function memberV1(recordSet: A0RecordSetV1, type: CanonicalObjectEnvelopeV1["object_type"]): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === type);
  assert.equal(matches.length, 1, `EA5B4B_MEMBER_CARDINALITY:${type}`);
  return matches[0]!;
}

function soilRecordV1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1 {
  const found = records.find((record) => record.record_type === "soil_moisture_observation_v1");
  assert.ok(found, "EA5B4B_SOIL_FIXTURE_REQUIRED");
  return structuredClone(found);
}

function externalizeSoilV1(record: CanonicalReplayEvidenceRecordV1): CanonicalReplayEvidenceRecordV1 {
  const external = structuredClone(record);
  Object.assign(external, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  external.dataset_id = "ea5b4b_external_a0_qualification_v1";
  external.source_record_id = "ea5b4b_kbs_soil_100mm";
  external.source_record_hash = "sha256:ea5b4b_kbs_soil_100mm";
  external.binding_id = MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  external.origin_source_kind = "PUBLIC_RESEARCH_SOURCE";
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

function externalConfigInputV1(logicalTime: string): CompileExternalFormalRuntimeConfigInputV1 {
  const configurationMatrixRef = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";
  const configurationMatrixHash = "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5";
  return {
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    config_role: "A0_BOOTSTRAP",
    effective_logical_time: logicalTime,
    created_at: logicalTime,
    parent_runtime_config_ref: null,
    parent_runtime_config_hash: null,
    reality_binding_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1",
    reality_binding_hash: "sha256:ea5b4b-qualification-reality-binding",
    source_matrix_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
    source_matrix_hash: "sha256:ea5b4b-qualification-source-matrix",
    configuration_matrix_ref: configurationMatrixRef,
    configuration_matrix_hash: configurationMatrixHash,
    geometry_semantic_hash: "sha256:ea5b4b-qualification-explicit-geometry-input",
    formal_authorities: {
      site: { ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1", hash: "sha256:ea5b4b-site" },
      reality: { ref: "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1", hash: "sha256:ea5b4b-reality" },
      source_binding_matrix: { ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1", hash: "sha256:ea5b4b-source" },
      crop_context: { ref: "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1", hash: "sha256:ea5b4b-crop" },
      recovery: { ref: "GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1", hash: "sha256:ea5b4b-recovery" },
      fresh_database: { ref: "GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1", hash: "sha256:ea5b4b-database" },
    },
    crop_stage_context_authority: {
      context_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1",
      context_hash: "sha256:ea5b4b-crop-context",
      configuration_matrix_ref: configurationMatrixRef,
      configuration_matrix_hash: configurationMatrixHash,
    },
    model_prior: {
      source_ref: configurationMatrixRef,
      source_hash: configurationMatrixHash,
    },
  };
}

function hydraulicV1(): SoilHydraulicBoundsV1 {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const config = fixture.runtime_config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  return {
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm,
    wilting_point_fraction: config.soil_hydraulic_snapshot.wilting_point_fraction,
    field_capacity_fraction: config.soil_hydraulic_snapshot.field_capacity_fraction,
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
  };
}

async function main(): Promise<void> {
  const sourceFixture = await buildMcftCap03R2V2FixtureV1(1);
  const logicalTime = sourceFixture.firstLogicalTime;
  const sourceRecords = await sourceFixture.runtime.loadCandidateRecords({
    scope: sourceFixture.source.scope,
    logical_time: logicalTime,
  });
  const externalSoil = externalizeSoilV1(soilRecordV1(sourceRecords));
  const evidenceWindow = buildFrozenEvidenceWindowV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    candidate_records: [externalSoil],
    authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  assert.equal(evidenceWindow.assimilation_observation.source_record_id, externalSoil.source_record_id);
  assert.equal(evidenceWindow.authorized_soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  ok("External A0 Evidence Window freezes the exact KBS 100-mm soil binding with no Replay default substitution");

  const runtimeConfigInput = externalConfigInputV1(logicalTime);
  const runtimeConfig = compileExternalFormalRuntimeConfigV1(runtimeConfigInput);
  const hydraulic = hydraulicV1();
  const compatibilityModelConfig = structuredClone(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1) as unknown as BootstrapWaterModelConfigV1;
  const recordSet = buildExternalFormalA0RecordSetV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    created_at: logicalTime,
    runtime_config: runtimeConfig,
    evidence_window: evidenceWindow,
    hydraulic,
    soil_hydraulic_model_prior_ref: runtimeConfigInput.model_prior.source_ref,
    compatibility_bootstrap_model_config: compatibilityModelConfig,
  });
  validateA0RecordSetV1(recordSet);
  assert.equal(recordSet.members.length, 9);
  const canonicalText = JSON.stringify(recordSet);
  assert.ok(!canonicalText.includes("CONTROLLED_SYNTHETIC_REPLAY_PROXY"));
  assert.ok(!canonicalText.includes('"runtime_mode":"REPLAY"'));
  assert.ok(!canonicalText.includes('"observation_operator_id":"POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"'));
  assert.ok(!canonicalText.includes('"truth_class":"CONTROLLED_SYNTHETIC"'));
  ok("External A0 produces a valid nine-object graph with no Replay/synthetic canonical truth markers");

  const evidence = memberV1(recordSet, "twin_evidence_window_v1");
  const assimilation = memberV1(recordSet, "twin_assimilation_update_v1");
  const state = memberV1(recordSet, "twin_state_estimate_v1");
  assert.equal(evidence.payload.authorized_soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(assimilation.payload.observation_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(assimilation.payload.observation_operator_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  assert.equal(assimilation.payload.measurement_depth_mm, 100);
  assert.equal(assimilation.payload.root_zone_representativeness, "PARTIAL");
  assert.equal((state.payload.model_versions as Record<string, unknown>).observation_operator_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  assert.equal((state.payload.external_authority as Record<string, unknown>).soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal((state.payload.confidence as Record<string, unknown>).status, "NOT_ESTABLISHED");
  assert.equal((state.payload.use_eligibility as Record<string, unknown>).recommendation_input_eligible, false);
  assert.equal((state.payload.use_eligibility as Record<string, unknown>).action_input_eligible, false);
  ok("External canonical Evidence/Assimilation/State freeze exact KBS binding, 100-mm operator, PARTIAL support and no action eligibility");

  for (const type of ["twin_runtime_lineage_v1", "twin_runtime_tick_v1", "twin_runtime_checkpoint_v1", "twin_runtime_health_v1"] as const) {
    const member = memberV1(recordSet, type);
    assert.equal(member.payload.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  }
  const health = memberV1(recordSet, "twin_runtime_health_v1");
  assert.equal(health.payload.operation_status, "EXTERNAL_A0_CANONICAL_CANDIDATE_WITH_BLOCKED_FORECAST");
  const forecast = memberV1(recordSet, "twin_forecast_run_v1");
  assert.equal(forecast.payload.status, "BLOCKED");
  assert.deepEqual(forecast.payload.points, []);
  assert.equal(forecast.payload.scenario_eligible, false);
  ok("External A0 lineage/tick/checkpoint/health carry honest Shadow-online qualification mode and Forecast remains blocked");

  const compatibilityPosterior = buildRootZoneWaterPosteriorV1({
    observation_fraction: externalSoil.canonical_payload.value,
    quality_status: externalSoil.quality.status,
    hydraulic,
    model_config: compatibilityModelConfig,
  });
  assert.deepEqual(state.payload.prior, compatibilityPosterior.prior);
  assert.deepEqual(state.payload.observation_update, compatibilityPosterior.observation_update);
  assert.deepEqual(state.payload.derived_state, compatibilityPosterior.derived_state);
  assert.deepEqual(state.payload.physical_bounds, compatibilityPosterior.physical_bounds);
  assert.equal((state.payload.posterior as Record<string, unknown>).mean, compatibilityPosterior.posterior.mean);
  assert.equal((state.payload.posterior as Record<string, unknown>).variance, compatibilityPosterior.posterior.variance);
  assert.equal(state.payload.numerical_identity_preserved, true);
  ok("External A0 preserves frozen CAP01 bootstrap numerical posterior while replacing only canonical provenance authority");

  const second = buildExternalFormalA0RecordSetV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    created_at: new Date(Date.parse(logicalTime) + 30 * 60 * 1000).toISOString(),
    runtime_config: runtimeConfig,
    evidence_window: evidenceWindow,
    hydraulic,
    soil_hydraulic_model_prior_ref: runtimeConfigInput.model_prior.source_ref,
    compatibility_bootstrap_model_config: compatibilityModelConfig,
  });
  assert.equal(second.a0_record_set_id, recordSet.a0_record_set_id);
  assert.equal(second.a0_idempotency_key, recordSet.a0_idempotency_key);
  assert.equal(second.a0_record_set_determinism_hash, recordSet.a0_record_set_determinism_hash);
  assert.deepEqual(
    second.members.map((member) => [member.object_type, member.object_id, member.determinism_hash]),
    recordSet.members.map((member) => [member.object_type, member.object_id, member.determinism_hash]),
  );
  ok("External A0 is deterministic and audit created_at does not alter canonical identity");

  const c8Window = structuredClone(evidenceWindow);
  c8Window.authorized_soil_binding_id = "soil_obs_c8_20cm_v1";
  assert.throws(() => buildExternalFormalA0RecordSetV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    created_at: logicalTime,
    runtime_config: runtimeConfig,
    evidence_window: c8Window,
    hydraulic,
    soil_hydraulic_model_prior_ref: runtimeConfigInput.model_prior.source_ref,
    compatibility_bootstrap_model_config: compatibilityModelConfig,
  }), /EXTERNAL_A0_SOIL_BINDING_AUTHORITY_REQUIRED/);
  const wrongPrior = "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json";
  assert.throws(() => buildExternalFormalA0RecordSetV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    created_at: logicalTime,
    runtime_config: runtimeConfig,
    evidence_window: evidenceWindow,
    hydraulic,
    soil_hydraulic_model_prior_ref: wrongPrior,
    compatibility_bootstrap_model_config: compatibilityModelConfig,
  }), /EXTERNAL_A0_SOIL_HYDRAULIC_MODEL_PRIOR_REF_MISMATCH/);
  ok("External A0 rejects historical C8 soil authority and mismatched model-prior provenance fail-closed");

  const wrongRoleConfig = compileExternalFormalRuntimeConfigV1({
    ...runtimeConfigInput,
    config_role: "HOURLY_CAP04",
    parent_runtime_config_ref: runtimeConfig.object_id,
    parent_runtime_config_hash: runtimeConfig.determinism_hash,
  });
  assert.throws(() => buildExternalFormalA0RecordSetV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: logicalTime,
    created_at: logicalTime,
    runtime_config: wrongRoleConfig,
    evidence_window: evidenceWindow,
    hydraulic,
    soil_hydraulic_model_prior_ref: runtimeConfigInput.model_prior.source_ref,
    compatibility_bootstrap_model_config: compatibilityModelConfig,
  }), /EXTERNAL_A0_BOOTSTRAP_CONFIG_ROLE_REQUIRED/);
  assert.throws(() => buildExternalFormalA0RecordSetV1({
    scope: {
      ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      field_id: "field_c8_demo",
    },
    logical_time: logicalTime,
    created_at: logicalTime,
    runtime_config: runtimeConfig,
    evidence_window: evidenceWindow,
    hydraulic,
    soil_hydraulic_model_prior_ref: runtimeConfigInput.model_prior.source_ref,
    compatibility_bootstrap_model_config: compatibilityModelConfig,
  }), /EXTERNAL_A0_SCOPE_MISMATCH/);
  ok("External A0 rejects hourly config role and Replay/cross-scope identity substitution");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-09 EA5B4B External A0 provenance profile: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
