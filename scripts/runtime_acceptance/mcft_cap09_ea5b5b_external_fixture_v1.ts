// scripts/runtime_acceptance/mcft_cap09_ea5b5b_external_fixture_v1.ts
// Purpose: assemble deterministic test-only External CAP04 State-source + compatibility Forecast math inputs for EA5B5B focused qualification.
// Boundary: acceptance support only; all explicit authority refs/hashes are qualification-only and never persisted Formal facts.

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
import {
  executeCap04Pure72hForecastMathV1,
} from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { ExternalFormalCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
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
  buildExternalFormalCap04StateSourceMembersV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_state_source_builder_v1.js";
import {
  validateExternalFormalCap04InputAuthorityV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.js";
import {
  selectCap04FutureForcingOutcomeV1,
} from "../../apps/server/src/runtime/twin_runtime/future_forcing_outcome_classifier_v1.js";
import {
  buildCap04BlockedForecastPayloadV1,
} from "../../apps/server/src/runtime/twin_runtime/blocked_forecast_payload_builder_v1.js";
import {
  buildExternalFormalCompletedForecastAuthorityV1,
  buildExternalFormalBlockedForecastAuthorityV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_cap04_forecast_authority_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  PreparedNextTickInputV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildCap04S6SingleTickFixtureV1,
  CAP04_S6_CREATED_AT_V1,
  CAP04_S6_LOGICAL_TIME_V1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

export const EA5B5B_LOGICAL_TIME_V1 = CAP04_S6_LOGICAL_TIME_V1;
export const EA5B5B_CREATED_AT_V1 = CAP04_S6_CREATED_AT_V1;
export const EA5B5B_PREVIOUS_TIME_V1 = new Date(Date.parse(EA5B5B_LOGICAL_TIME_V1) - 3_600_000).toISOString();
export const EA5B5B_CONFIG_MATRIX_REF_V1 = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";
export const EA5B5B_CONFIG_MATRIX_HASH_V1 = "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5";
export const EA5B5B_CROP_CONTEXT_REF_V1 = "qualification://ea5b5b/external-crop-context";
export const EA5B5B_CROP_CONTEXT_HASH_V1 = "sha256:ea5b5b-qualification-external-crop-context";
export const EA5B5B_REALITY_REF_V1 = "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1";
export const EA5B5B_REALITY_HASH_V1 = "sha256:ea5b5b-qualification-reality-binding";

const formalAuthorities: CompileExternalFormalRuntimeConfigInputV1["formal_authorities"] = {
  site: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json",
    hash: "ea5b5b-qualification-site-authority",
  },
  reality: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json",
    hash: "ea5b5b-qualification-reality-authority",
  },
  source_binding_matrix: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json",
    hash: "ea5b5b-qualification-source-authority",
  },
  crop_context: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
    hash: "ea5b5b-qualification-crop-authority",
  },
  recovery: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json",
    hash: "ea5b5b-qualification-recovery-authority",
  },
  fresh_database: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json",
    hash: "ea5b5b-qualification-fresh-db-authority",
  },
};

function runtimeInputV1(role: "A0_BOOTSTRAP" | "HOURLY_CAP04"): CompileExternalFormalRuntimeConfigInputV1 {
  return {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    config_role: role,
    effective_logical_time: role === "A0_BOOTSTRAP" ? EA5B5B_PREVIOUS_TIME_V1 : EA5B5B_LOGICAL_TIME_V1,
    created_at: EA5B5B_CREATED_AT_V1,
    parent_runtime_config_ref: null,
    parent_runtime_config_hash: null,
    reality_binding_ref: EA5B5B_REALITY_REF_V1,
    reality_binding_hash: EA5B5B_REALITY_HASH_V1,
    source_matrix_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
    source_matrix_hash: "sha256:ea5b5b-qualification-source-matrix",
    configuration_matrix_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
    configuration_matrix_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    geometry_semantic_hash: "sha256:ea5b5b-qualification-explicit-geometry-input",
    formal_authorities: structuredClone(formalAuthorities),
    crop_stage_context_authority: {
      context_ref: EA5B5B_CROP_CONTEXT_REF_V1,
      context_hash: EA5B5B_CROP_CONTEXT_HASH_V1,
      configuration_matrix_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
      configuration_matrix_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    },
    model_prior: {
      source_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
      source_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    },
  };
}

function externalCropContextV1(source: ContinuationCropStageConfigurationContextV1): ContinuationCropStageConfigurationContextV1 {
  return {
    ...structuredClone(source),
    dataset_id: "mcft_cap09_ea5b5b_external_crop_qualification_v1",
    configuration_matrix_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
    configuration_matrix_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    crop_water_use_binding_ref: "external_public_research_crop_water_use_v1",
    crop_water_use_configuration_source_id: "external_public_research_crop_config_v1",
    crop_stage_mapping_source: "EXTERNAL_PUBLIC_RESEARCH_CONFIGURATION",
    limitations: ["EXTERNAL_PUBLIC_RESEARCH_SCOPE", "MODEL_PRIOR_FROM_CAP08", "NOT_FIELD_CALIBRATED"],
    determinism_hash: EA5B5B_CROP_CONTEXT_HASH_V1,
  };
}

function evidenceAuthorityV1(recordType: string): { binding: string; epistemic: string } {
  switch (recordType) {
    case "soil_moisture_observation_v1": return { binding: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, epistemic: "OBSERVED" };
    case "observed_rainfall_v1": return { binding: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1, epistemic: "OBSERVED" };
    case "historical_et0_estimate_v1": return { binding: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1, epistemic: "ESTIMATED" };
    case "future_weather_assumption_v1": return { binding: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1, epistemic: "ASSUMED" };
    case "future_et0_assumption_v1": return { binding: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1, epistemic: "ASSUMED" };
    default: throw new Error(`EA5B5B_UNEXPECTED_FIXTURE_RECORD_TYPE:${recordType}`);
  }
}

function externalizeEvidenceV1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1[] {
  return records.map((source) => {
    const record = structuredClone(source);
    const authority = evidenceAuthorityV1(record.record_type);
    Object.assign(record, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
    record.dataset_id = "mcft_cap09_ea5b5b_external_evidence_qualification_v1";
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
    active_lineage_ref: "external_lineage_object_ea5b5b",
    previous_posterior_ref: "external_previous_state_ea5b5b",
    previous_posterior_hash: "sha256:ea5b5b-previous-state",
    previous_checkpoint_ref: "external_previous_checkpoint_ea5b5b",
    previous_checkpoint_hash: "sha256:ea5b5b-previous-checkpoint",
    previous_forecast_result_ref: "external_previous_forecast_ea5b5b",
    previous_forecast_result_hash: "sha256:ea5b5b-previous-forecast",
    latest_successful_forecast_ref: "external_previous_successful_forecast_ea5b5b",
    lineage_id: "external_lineage_ea5b5b",
    revision_id: "external_revision_ea5b5b",
    prior_mean: 0.3,
    prior_variance: 0.001,
    previous_storage_mm_decimal: "90.000000",
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: "external_previous_state_ea5b5b",
      previous_storage_variance_mm2_decimal: "4.000000000000",
    },
    previous_tick_sequence: 48,
    next_logical_tick_time: EA5B5B_LOGICAL_TIME_V1,
    previous_state_runtime_config_ref: parent.object_id,
    previous_state_runtime_config_hash: parent.determinism_hash,
    reality_binding_ref: String(current.payload.reality_binding_ref),
    reality_binding_hash: String(current.payload.reality_binding_hash),
  };
}

export async function buildEa5b5bExternalFixtureV1() {
  const historical = buildCap04S6SingleTickFixtureV1();
  const replayCandidates = await historical.runtime.loadCandidateRecords({
    scope: historical.input.scope,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
  });
  const candidates = externalizeEvidenceV1(replayCandidates);
  const crop = externalCropContextV1(historical.crop_stage_context);

  const a0Input = runtimeInputV1("A0_BOOTSTRAP");
  const a0 = compileExternalFormalRuntimeConfigV1(a0Input);
  const hourlyInput = runtimeInputV1("HOURLY_CAP04");
  hourlyInput.parent_runtime_config_ref = a0.object_id;
  hourlyInput.parent_runtime_config_hash = a0.determinism_hash;
  const hourly = compileExternalFormalRuntimeConfigV1(hourlyInput);
  const handoff = handoffV1(a0, hourly);

  const inputAuthority = validateExternalFormalCap04InputAuthorityV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    runtime_config: hourly,
    candidate_records: candidates,
    crop_stage_context: crop,
  });
  const compatibility = new ExternalFormalCap04ExecutionConfigResolverV1().resolveExecutionConfig(hourly).payload;
  const preliminary = buildAssimilatedContinuationEvidenceWindowV2({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    candidate_records: candidates,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    crop_stage_context_ref: EA5B5B_CROP_CONTEXT_REF_V1,
    crop_stage_context_hash: EA5B5B_CROP_CONTEXT_HASH_V1,
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
      String(finiteNumberV1(base.rainfall_record.canonical_payload.value, "EA5B5B_RAINFALL_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    historical_et0_mm_decimal: normalizeFixedDecimalV1(
      String(finiteNumberV1(base.historical_et0_record.canonical_payload.value, "EA5B5B_ET0_REQUIRED")),
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
  const evidence = finalizeAssimilatedContinuationEvidenceWindowV2({ window: preliminary, assimilation });
  const sourceMembers = buildExternalFormalCap04StateSourceMembersV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: EA5B5B_CREATED_AT_V1,
    handoff,
    runtime_config: hourly,
    compatibility_execution_config_payload: compatibility,
    evidence_window: evidence,
    dynamics,
    compatibility_assimilation: assimilation,
  });
  const sourceState = sourceMembers.twin_state_estimate_v1;
  const stateBasis = sourceState.payload.computation_basis as Record<string, unknown>;
  const storageMean = stateBasis.storage_mean_mm_decimal as { value?: unknown };
  const storageVariance = stateBasis.storage_variance_mm2_decimal as { value?: unknown };
  if (typeof storageMean?.value !== "string" || typeof storageVariance?.value !== "string") {
    throw new Error("EA5B5B_SOURCE_STATE_DECIMAL_BASIS_REQUIRED");
  }

  const forcingOutcome = selectCap04FutureForcingOutcomeV1({
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    candidate_records: candidates,
    authorized_binding_ids: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
    crop_stage_context: {
      ref: compatibility.crop_stage_context.context_ref,
      hash: compatibility.crop_stage_context.context_hash,
      crop_stage_code: base.crop_stage_context.stage_code,
      kc: base.crop_stage_context.kc,
    },
    runtime_config: { ref: hourly.object_id, hash: hourly.determinism_hash },
  });
  if (forcingOutcome.status !== "SELECTED") {
    throw new Error(`EA5B5B_SELECTED_FORCING_REQUIRED:${forcingOutcome.status}`);
  }
  const compatibilityForecastMath = executeCap04Pure72hForecastMathV1({
    source_posterior: {
      ref: sourceState.object_id,
      hash: sourceState.determinism_hash,
      logical_time: EA5B5B_LOGICAL_TIME_V1,
      computation_basis: {
        storage_mean_mm_decimal: storageMean.value,
        storage_variance_mm2_decimal: storageVariance.value,
      },
    },
    runtime_config: {
      ref: hourly.object_id,
      hash: hourly.determinism_hash,
      payload: compatibility,
    },
    forcing_window: forcingOutcome.window,
  });
  const externalCompletedForecast = buildExternalFormalCompletedForecastAuthorityV1({
    compatibility_result: compatibilityForecastMath,
    runtime_config: hourly,
  });

  const compatibilityBlockedForecast = buildCap04BlockedForecastPayloadV1({
    issued_at: EA5B5B_LOGICAL_TIME_V1,
    source_posterior_ref: sourceState.object_id,
    source_posterior_hash: sourceState.determinism_hash,
    runtime_config_ref: hourly.object_id,
    runtime_config_hash: hourly.determinism_hash,
    runtime_config_payload: compatibility,
    reason_codes: ["NO_COMPLETE_MATCHING_FORCING_CYCLE"],
    limitations: ["EA5B5B_QUALIFICATION_BLOCKED_PATH"],
  });
  const externalBlockedForecast = buildExternalFormalBlockedForecastAuthorityV1({
    compatibility_forecast: compatibilityBlockedForecast,
    runtime_config: hourly,
  });

  return {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    a0,
    hourly,
    handoff,
    candidates,
    crop,
    inputAuthority,
    compatibility,
    evidence,
    dynamics,
    assimilation,
    sourceMembers,
    sourceState,
    forcingOutcome,
    compatibilityForecastMath,
    externalCompletedForecast,
    compatibilityBlockedForecast,
    externalBlockedForecast,
  };
}
