// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5A_EXTERNAL_CAP04_STATE_SOURCE.ts
// Purpose: prove exact External five-source/crop authority can drive the frozen CAP02/CAP03 compatibility math and then be re-canonicalized into honest External CAP04 Evidence/Transition/Assimilation/State source members.
// Boundary: deterministic in-memory qualification only. Qualification refs/hashes are not persisted Formal authority. No database, provider network, writer, scheduler, Forecast aggregate persistence, Scenario, Recommendation, Action, or O00.

import assert from "node:assert/strict";
import {
  composeAssimilatedContinuationPosteriorV1,
} from "../../apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  normalizeFixedDecimalV1,
  WATER_AMOUNT_SCALE_V1,
} from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
} from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import { buildExternalFormalAssimilationAuthorityViewV1 } from "../../apps/server/src/domain/soil_water/external_formal_assimilation_authority_view_v1.js";
import {
  computeMemberDeterminismHashV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { ExternalFormalCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  buildAssimilatedContinuationEvidenceWindowV2,
  finalizeAssimilatedContinuationEvidenceWindowV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import {
  validateExternalFormalCap04InputAuthorityV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.js";
import {
  buildExternalFormalCap04StateSourceMembersV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_state_source_builder_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  PreparedNextTickInputV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildCap04S6SingleTickFixtureV1,
  CAP04_S6_CREATED_AT_V1,
  CAP04_S6_LOGICAL_TIME_V1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

const LOGICAL_TIME = CAP04_S6_LOGICAL_TIME_V1;
const CREATED_AT = CAP04_S6_CREATED_AT_V1;
const PREVIOUS_TIME = new Date(Date.parse(LOGICAL_TIME) - 3_600_000).toISOString();
const CONFIG_MATRIX_REF = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";
const CONFIG_MATRIX_HASH = "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5";
const CROP_CONTEXT_REF = "qualification://ea5b5a/external-crop-context";
const CROP_CONTEXT_HASH = "sha256:ea5b5a-qualification-external-crop-context";
const REALITY_REF = "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1";
const REALITY_HASH = "sha256:ea5b5a-qualification-reality-binding";

const formalAuthorities: CompileExternalFormalRuntimeConfigInputV1["formal_authorities"] = {
  site: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json",
    hash: "ea5b5a-qualification-site-authority",
  },
  reality: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json",
    hash: "ea5b5a-qualification-reality-authority",
  },
  source_binding_matrix: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json",
    hash: "ea5b5a-qualification-source-authority",
  },
  crop_context: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
    hash: "ea5b5a-qualification-crop-authority",
  },
  recovery: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json",
    hash: "ea5b5a-qualification-recovery-authority",
  },
  fresh_database: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json",
    hash: "ea5b5a-qualification-fresh-db-authority",
  },
};

function runtimeInput(role: "A0_BOOTSTRAP" | "HOURLY_CAP04"): CompileExternalFormalRuntimeConfigInputV1 {
  return {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    config_role: role,
    effective_logical_time: role === "A0_BOOTSTRAP" ? PREVIOUS_TIME : LOGICAL_TIME,
    created_at: CREATED_AT,
    parent_runtime_config_ref: null,
    parent_runtime_config_hash: null,
    reality_binding_ref: REALITY_REF,
    reality_binding_hash: REALITY_HASH,
    source_matrix_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
    source_matrix_hash: "sha256:ea5b5a-qualification-source-matrix",
    configuration_matrix_ref: CONFIG_MATRIX_REF,
    configuration_matrix_hash: CONFIG_MATRIX_HASH,
    geometry_semantic_hash: "sha256:ea5b5a-qualification-explicit-geometry-input",
    formal_authorities: structuredClone(formalAuthorities),
    crop_stage_context_authority: {
      context_ref: CROP_CONTEXT_REF,
      context_hash: CROP_CONTEXT_HASH,
      configuration_matrix_ref: CONFIG_MATRIX_REF,
      configuration_matrix_hash: CONFIG_MATRIX_HASH,
    },
    model_prior: {
      source_ref: CONFIG_MATRIX_REF,
      source_hash: CONFIG_MATRIX_HASH,
    },
  };
}

function externalCropContextV1(source: ContinuationCropStageConfigurationContextV1): ContinuationCropStageConfigurationContextV1 {
  return {
    ...structuredClone(source),
    dataset_id: "mcft_cap09_ea5b5a_external_crop_qualification_v1",
    configuration_matrix_ref: CONFIG_MATRIX_REF,
    configuration_matrix_hash: CONFIG_MATRIX_HASH,
    crop_water_use_binding_ref: "external_public_research_crop_water_use_v1",
    crop_water_use_configuration_source_id: "external_public_research_crop_config_v1",
    crop_stage_mapping_source: "EXTERNAL_PUBLIC_RESEARCH_CONFIGURATION",
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
    ],
    determinism_hash: CROP_CONTEXT_HASH,
  };
}

function evidenceBindingV1(recordType: string): { binding: string; epistemic: string } {
  switch (recordType) {
    case "soil_moisture_observation_v1":
      return { binding: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, epistemic: "OBSERVED" };
    case "observed_rainfall_v1":
      return { binding: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1, epistemic: "OBSERVED" };
    case "historical_et0_estimate_v1":
      return { binding: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1, epistemic: "ESTIMATED" };
    case "future_weather_assumption_v1":
      return { binding: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1, epistemic: "ASSUMED" };
    case "future_et0_assumption_v1":
      return { binding: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1, epistemic: "ASSUMED" };
    default:
      throw new Error(`EA5B5A_UNEXPECTED_FIXTURE_RECORD_TYPE:${recordType}`);
  }
}

function externalizeEvidenceV1(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): CanonicalReplayEvidenceRecordV1[] {
  return records.map((source) => {
    const record = structuredClone(source);
    const authority = evidenceBindingV1(record.record_type);
    Object.assign(record, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
    record.dataset_id = "mcft_cap09_ea5b5a_external_evidence_qualification_v1";
    record.binding_id = authority.binding;
    record.origin_source_kind = "EXTERNAL_PUBLIC_RESEARCH_DATASET";
    record.origin_source_id = `external_${record.record_type}`;
    record.epistemic_class = authority.epistemic;
    record.limitations = ["EXTERNAL_PUBLIC_RESEARCH_SCOPE"];
    delete record.execution_metadata;
    record.source_record_hash = semanticHashV1({
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      record_type: record.record_type,
      source_record_id: record.source_record_id,
      binding_id: record.binding_id,
      origin_source_id: record.origin_source_id,
      role_time: record.role_time,
      canonical_payload: record.canonical_payload,
    });
    return record;
  });
}

function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function dynamicsConfigV1(config: ReturnType<ExternalFormalCap04ExecutionConfigResolverV1["resolveExecutionConfig"]>["payload"]): HourlyWaterBalanceConfigV1 {
  return {
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm.toFixed(6),
    wilting_point_storage_mm: config.soil_hydraulic_snapshot.wilting_point_storage_mm.toFixed(6),
    field_capacity_storage_mm: config.soil_hydraulic_snapshot.field_capacity_storage_mm.toFixed(6),
    saturation_storage_mm: config.soil_hydraulic_snapshot.saturation_storage_mm.toFixed(6),
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction.toFixed(6),
    runoff_fraction: config.dynamics_parameters.runoff_fraction.toFixed(6),
    drainage_coefficient_per_hour: config.dynamics_parameters.drainage_coefficient_per_hour.toFixed(6),
    structural_process_stddev_mm_per_hour: config.process_uncertainty.structural_process_stddev_mm_per_hour.toFixed(6),
    rainfall_relative_stddev: config.process_uncertainty.rainfall_relative_stddev.toFixed(6),
    crop_et_relative_stddev: config.process_uncertainty.crop_et_relative_stddev.toFixed(6),
    executed_irrigation_relative_stddev: config.process_uncertainty.executed_irrigation_relative_stddev.toFixed(6),
  };
}

function handoffV1(parent: CanonicalObjectEnvelopeV1, current: CanonicalObjectEnvelopeV1): PreparedNextTickInputV1 {
  return {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    active_lineage_ref: "external_lineage_object_ea5b5a",
    previous_posterior_ref: "external_previous_state_ea5b5a",
    previous_posterior_hash: "sha256:ea5b5a-previous-state",
    previous_checkpoint_ref: "external_previous_checkpoint_ea5b5a",
    previous_checkpoint_hash: "sha256:ea5b5a-previous-checkpoint",
    previous_forecast_result_ref: "external_previous_forecast_ea5b5a",
    previous_forecast_result_hash: "sha256:ea5b5a-previous-forecast",
    latest_successful_forecast_ref: null,
    lineage_id: "external_lineage_ea5b5a",
    revision_id: "external_revision_ea5b5a",
    prior_mean: 0.3,
    prior_variance: 0.001,
    previous_storage_mm_decimal: "90.000000",
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: "external_previous_state_ea5b5a",
      previous_storage_variance_mm2_decimal: "4.000000000000",
    },
    previous_tick_sequence: 48,
    next_logical_tick_time: LOGICAL_TIME,
    previous_state_runtime_config_ref: parent.object_id,
    previous_state_runtime_config_hash: parent.determinism_hash,
    reality_binding_ref: String(current.payload.reality_binding_ref),
    reality_binding_hash: String(current.payload.reality_binding_hash),
  };
}

function memberV1(
  members: ReturnType<typeof buildExternalFormalCap04StateSourceMembersV1>,
  type: keyof ReturnType<typeof buildExternalFormalCap04StateSourceMembersV1>,
): CanonicalObjectEnvelopeV1 {
  return members[type];
}

async function main(): Promise<void> {
  const historical = buildCap04S6SingleTickFixtureV1();
  const replayCandidates = await historical.runtime.loadCandidateRecords({
    scope: historical.input.scope,
    logical_time: LOGICAL_TIME,
  });
  const candidates = externalizeEvidenceV1(replayCandidates);
  const crop = externalCropContextV1(historical.crop_stage_context);

  const a0Input = runtimeInput("A0_BOOTSTRAP");
  const a0 = compileExternalFormalRuntimeConfigV1(a0Input);
  const hourlyInput = runtimeInput("HOURLY_CAP04");
  hourlyInput.parent_runtime_config_ref = a0.object_id;
  hourlyInput.parent_runtime_config_hash = a0.determinism_hash;
  const hourly = compileExternalFormalRuntimeConfigV1(hourlyInput);
  const handoff = handoffV1(a0, hourly);

  const inputAuthority = validateExternalFormalCap04InputAuthorityV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    runtime_config: hourly,
    candidate_records: candidates,
    crop_stage_context: crop,
  });
  assert.deepEqual(inputAuthority.binding_cardinality, {
    soil: 1,
    rainfall: 1,
    historical_et0: 1,
    future_weather: 1,
    future_et0: 1,
  });
  assert.equal(inputAuthority.resolved_crop_stage_context.context_ref, CROP_CONTEXT_REF);
  assert.equal(inputAuthority.resolved_crop_stage_context.context_hash, CROP_CONTEXT_HASH);
  assert.equal(inputAuthority.canonical_persistence_authorized, false);
  ok("External CAP04 input guard freezes exact five-source bindings, scope, crop authority, and zero-persistence boundary");

  const compatibility = new ExternalFormalCap04ExecutionConfigResolverV1().resolveExecutionConfig(hourly).payload;
  const preliminary = buildAssimilatedContinuationEvidenceWindowV2({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    candidate_records: candidates,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    crop_stage_context_ref: CROP_CONTEXT_REF,
    crop_stage_context_hash: CROP_CONTEXT_HASH,
    crop_stage_context: crop,
    authorized_soil_observation_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  const base = preliminary.base_continuation_window;
  const dynamics = executeHourlyWaterBalanceV1({
    interval_start_exclusive: base.window_start_exclusive,
    interval_end_inclusive: base.window_end_inclusive,
    previous_storage_mm_decimal: handoff.previous_storage_mm_decimal,
    previous_variance_basis: handoff.previous_variance_basis,
    gross_rainfall_mm_decimal: normalizeFixedDecimalV1(
      String(finiteNumberV1(base.rainfall_record.canonical_payload.value, "EA5B5A_RAINFALL_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    historical_et0_mm_decimal: normalizeFixedDecimalV1(
      String(finiteNumberV1(base.historical_et0_record.canonical_payload.value, "EA5B5A_ET0_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    crop_stage_code: base.crop_stage_context.stage_code,
    kc_decimal: normalizeFixedDecimalV1(String(base.crop_stage_context.kc), WATER_AMOUNT_SCALE_V1),
    executed_irrigation_candidates: [],
    config: dynamicsConfigV1(compatibility),
  });
  const assimilation = composeAssimilatedContinuationPosteriorV1({
    prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
    prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
    selected_observation: preliminary.observation_selection.selected_observation as never,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    root_zone_depth_mm: compatibility.soil_hydraulic_snapshot.root_zone_depth_mm,
    sensor_measurement_stddev_fraction: compatibility.observation_assimilation.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: compatibility.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
    quality_weights: compatibility.observation_assimilation.quality_weights,
  });
  const evidence = finalizeAssimilatedContinuationEvidenceWindowV2({
    window: preliminary,
    assimilation,
  });
  assert.equal(evidence.observation_selection.authorized_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(evidence.base_continuation_window.crop_stage_context.context_ref, CROP_CONTEXT_REF);
  assert.equal(dynamics.mass_balance_trace.mass_balance_error_mm, "0.000000");
  ok("Frozen CAP02/CAP03 kernels consume the External-qualified hourly window without changing their numerical contracts");

  const members = buildExternalFormalCap04StateSourceMembersV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    created_at: CREATED_AT,
    handoff,
    runtime_config: hourly,
    compatibility_execution_config_payload: compatibility,
    evidence_window: evidence,
    dynamics,
    compatibility_assimilation: assimilation,
  });
  for (const member of Object.values(members)) {
    assert.equal(
      computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>),
      member.determinism_hash,
    );
  }
  assert.equal(Object.values(members).length, 4);
  const canonicalText = JSON.stringify(members);
  assert.ok(!canonicalText.includes("CONTROLLED_REPLAY"));
  assert.ok(!canonicalText.includes("CONTROLLED_SYNTHETIC_REPLAY_PROXY"));
  assert.ok(!canonicalText.includes('"runtime_mode":"REPLAY"'));
  assert.ok(!canonicalText.includes("POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"));
  ok("External CAP04 produces four canonical source-member candidates with no Replay/200-mm truth leakage");

  const evidenceMember = memberV1(members, "twin_evidence_window_v1");
  const assimilationMember = memberV1(members, "twin_assimilation_update_v1");
  const stateMember = memberV1(members, "twin_state_estimate_v1");
  assert.equal(evidenceMember.payload.authorized_soil_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.ok(JSON.stringify(assimilationMember.payload).includes(MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1));
  assert.equal(stateMember.payload.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  assert.equal(stateMember.payload.crop_stage_context_ref, CROP_CONTEXT_REF);
  assert.equal(stateMember.payload.crop_stage_context_hash, CROP_CONTEXT_HASH);
  assert.equal((stateMember.payload.use_eligibility as Record<string, unknown>).recommendation_input_eligible, false);
  assert.equal((stateMember.payload.use_eligibility as Record<string, unknown>).action_input_eligible, false);
  ok("Canonical Evidence/Assimilation/State freeze KBS soil authority, 100-mm operator, External crop authority, and no-action eligibility");

  const authorityView = buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: assimilation,
    evidence_authority: {
      authorized_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      selected_observation_ref: evidence.observation_selection.selected_observation_ref,
    },
  });
  const stateVwc = stateMember.payload.root_zone_vwc_fraction as Record<string, unknown>;
  assert.equal(stateVwc.mean, authorityView.posterior_candidate.published_posterior_mean);
  assert.equal(stateVwc.variance, authorityView.posterior_candidate.published_posterior_variance);
  assert.equal(authorityView.numerical_identity_preserved, true);
  ok("External canonical State preserves the frozen compatibility posterior numerics while replacing only authority provenance");

  const membersAgain = buildExternalFormalCap04StateSourceMembersV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    created_at: new Date(Date.parse(CREATED_AT) + 30 * 60_000).toISOString(),
    handoff,
    runtime_config: hourly,
    compatibility_execution_config_payload: compatibility,
    evidence_window: evidence,
    dynamics,
    compatibility_assimilation: assimilation,
  });
  for (const type of Object.keys(members) as Array<keyof typeof members>) {
    assert.equal(membersAgain[type].object_id, members[type].object_id);
    assert.equal(membersAgain[type].determinism_hash, members[type].determinism_hash);
  }
  ok("External CAP04 source-member identity and hashes are deterministic across audit created_at changes");

  const badRain = structuredClone(candidates);
  const rain = badRain.find((record) => record.record_type === "observed_rainfall_v1");
  if (!rain) throw new Error("EA5B5A_RAIN_FIXTURE_REQUIRED");
  rain.binding_id = "rainfall_c8_hourly_v1";
  assert.throws(() => validateExternalFormalCap04InputAuthorityV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    runtime_config: hourly,
    candidate_records: badRain,
    crop_stage_context: crop,
  }), /EXTERNAL_CAP04_EVIDENCE_BINDING_MISMATCH:observed_rainfall_v1/);
  ok("External CAP04 input authority rejects a Replay/C8 rainfall binding substitution fail-closed");

  const operationEvidence = structuredClone(candidates[0]);
  operationEvidence.record_type = "irrigation_execution_evidence_v1";
  operationEvidence.source_record_id = "forbidden_external_operation_evidence";
  assert.throws(() => validateExternalFormalCap04InputAuthorityV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    runtime_config: hourly,
    candidate_records: [...candidates, operationEvidence],
    crop_stage_context: crop,
  }), /EXTERNAL_CAP04_COMMERCIAL_OPERATION_EVIDENCE_FORBIDDEN/);
  ok("External Formal CAP04 rejects commercial irrigation execution/plan evidence at the authority boundary");

  const badCrop = structuredClone(crop);
  badCrop.determinism_hash = "sha256:wrong-crop-context";
  assert.throws(() => validateExternalFormalCap04InputAuthorityV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: LOGICAL_TIME,
    runtime_config: hourly,
    candidate_records: candidates,
    crop_stage_context: badCrop,
  }), /CROP_STAGE_CONTEXT_HASH_MISMATCH/);
  const wrongScope: TwinScopeKeyV1 = {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    zone_id: "wrong_zone",
  };
  assert.throws(() => validateExternalFormalCap04InputAuthorityV1({
    scope: wrongScope,
    logical_time: LOGICAL_TIME,
    runtime_config: hourly,
    candidate_records: candidates,
    crop_stage_context: crop,
  }), /EXTERNAL_CAP04_INPUT_SCOPE_MISMATCH/);
  ok("Crop hash drift and External six-key scope substitution both fail closed before any compatibility math");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-09 EA5B5A External CAP04 State Source: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
