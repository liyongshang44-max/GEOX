// scripts/runtime_acceptance/mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.ts
// Purpose: assemble deterministic S5 standard and independent observation-aware range fixtures over the verified S4 single-tick runtime.
// Boundary: acceptance support only; no production database, route, scheduler, restart/backfill, successful Forecast, Recommendation, Decision, action, calibration, or model activation.

import type {
  CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  compileAssimilatedContinuationRuntimeConfigV1,
  type AssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  AssimilatedContiguousRangeServiceV1,
  type RunAssimilatedContiguousRangeInputV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.js";
import {
  AssimilatedContinuationTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import {
  PrepareNextTickInputServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  buildMcftCap03SingleTickIntegrationFixtureV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";

export const S5_FIRST_LOGICAL_TIME_V1 =
  "2026-06-02T02:00:00.000Z";

export const S5_LAST_LOGICAL_TIME_V1 =
  "2026-06-03T01:00:00.000Z";

export const S5_NEXT_HANDOFF_LOGICAL_TIME_V1 =
  "2026-06-03T02:00:00.000Z";

export const S5_CREATED_AT_V1 =
  "2026-07-11T11:30:00.000Z";

export const S5_STANDARD_TICK_COUNT_V1 = 24;

const HOUR_MS_V1 = 60 * 60 * 1000;
const MINUTE_MS_V1 = 60 * 1000;

export type S5ObservationScenarioV1 =
  | "STANDARD_PASS_RANGE"
  | "LIMITED"
  | "NO_USABLE_OBSERVATION"
  | "OUTLIER_REJECTION"
  | "CANDIDATE_EXCLUSION";

function addMillisecondsV1(
  value: string,
  milliseconds: number,
): string {
  return new Date(
    Date.parse(value) + milliseconds,
  ).toISOString();
}

function addHoursV1(
  value: string,
  hours: number,
): string {
  return addMillisecondsV1(
    value,
    hours * HOUR_MS_V1,
  );
}

function padTickV1(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function sameScopeV1(
  left: TwinScopeKeyV1,
  right: TwinScopeKeyV1,
): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function requiredTemplateV1(
  records: readonly CanonicalReplayEvidenceRecordV1[],
  recordType: string,
): CanonicalReplayEvidenceRecordV1 {
  const record = records.find(
    (candidate) => candidate.record_type === recordType,
  );

  if (!record) {
    throw new Error(
      `S5_FIXTURE_TEMPLATE_REQUIRED:${recordType}`,
    );
  }

  return structuredClone(record);
}

function rainfallRecordV1(input: {
  template: CanonicalReplayEvidenceRecordV1;
  logical_time: string;
  tick_index: number;
  canonical_value?: number;
}): CanonicalReplayEvidenceRecordV1 {
  const record = structuredClone(input.template);
  const suffix = padTickV1(input.tick_index);
  const intervalStart = addHoursV1(
    input.logical_time,
    -1,
  );
  const availableAt = addMillisecondsV1(
    input.logical_time,
    -5 * MINUTE_MS_V1,
  );

  const canonicalValue =
    input.canonical_value ?? 0;

  record.source_record_id =
    `rain_cap03_s5_${suffix}`;
  record.source_record_hash =
    `sha256:rain_cap03_s5_${suffix}`;
  record.available_to_runtime_at = availableAt;
  record.role_time = {
    ...record.role_time,
    interval_start: intervalStart,
    interval_end: input.logical_time,
    ingested_at: availableAt,
  };
  record.source_payload = {
    ...record.source_payload,
    value: canonicalValue,
    unit: "mm",
  };
  record.canonical_payload = {
    ...record.canonical_payload,
    value: canonicalValue,
    unit: "mm",
  };

  return record;
}

function et0RecordV1(input: {
  template: CanonicalReplayEvidenceRecordV1;
  logical_time: string;
  tick_index: number;
}): CanonicalReplayEvidenceRecordV1 {
  const record = structuredClone(input.template);
  const suffix = padTickV1(input.tick_index);
  const intervalStart = addHoursV1(
    input.logical_time,
    -1,
  );
  const availableAt = addMillisecondsV1(
    input.logical_time,
    -5 * MINUTE_MS_V1,
  );

  record.source_record_id =
    `et0_cap03_s5_${suffix}`;
  record.source_record_hash =
    `sha256:et0_cap03_s5_${suffix}`;
  record.available_to_runtime_at = availableAt;
  record.role_time = {
    ...record.role_time,
    interval_start: intervalStart,
    interval_end: input.logical_time,
    ingested_at: availableAt,
  };
  record.source_payload = {
    ...record.source_payload,
    value: 0.085,
    unit: "mm",
  };
  record.canonical_payload = {
    ...record.canonical_payload,
    value: 0.085,
    unit: "mm",
  };

  return record;
}

function observationRecordV1(input: {
  template: CanonicalReplayEvidenceRecordV1;
  logical_time: string;
  tick_index: number;
  identity_suffix: string;
  quality_status: "PASS" | "LIMITED" | "FAIL";
  canonical_value: number;
  binding_id?: string;
  observed_offset_minutes?: number;
}): CanonicalReplayEvidenceRecordV1 {
  const record = structuredClone(input.template);
  const suffix = padTickV1(input.tick_index);
  const observedAt = addMillisecondsV1(
    input.logical_time,
    -(input.observed_offset_minutes ?? 5)
      * MINUTE_MS_V1,
  );
  const availableAt = addMillisecondsV1(
    input.logical_time,
    -2 * MINUTE_MS_V1,
  );

  record.source_record_id =
    `soil_cap03_s5_${suffix}_${input.identity_suffix}`;
  record.source_record_hash =
    `sha256:soil_cap03_s5_${suffix}_${input.identity_suffix}`;
  record.available_to_runtime_at = availableAt;
  record.binding_id =
    input.binding_id ?? record.binding_id;
  record.quality = {
    ...record.quality,
    status: input.quality_status,
  };
  record.role_time = {
    ...record.role_time,
    observed_at: observedAt,
    ingested_at: availableAt,
  };
  record.source_payload = {
    ...record.source_payload,
    value: input.canonical_value * 100,
    unit: "percent_vwc",
  };
  record.canonical_payload = {
    ...record.canonical_payload,
    value: input.canonical_value,
    unit: "fraction",
  };

  return record;
}

function logicalTickIndexV1(
  logicalTime: string,
): number {
  const difference =
    (
      Date.parse(logicalTime)
      - Date.parse(S5_FIRST_LOGICAL_TIME_V1)
    ) / HOUR_MS_V1;

  if (
    !Number.isInteger(difference)
    || difference < 0
    || difference >= S5_STANDARD_TICK_COUNT_V1
  ) {
    throw new Error(
      "S5_FIXTURE_LOGICAL_TIME_OUTSIDE_FROZEN_RANGE",
    );
  }

  return difference;
}

function assimilatedConfigPayloadV1(
  config: CanonicalObjectEnvelopeV1,
): AssimilatedContinuationRuntimeConfigPayloadV1 {
  const payload: unknown = config.payload;

  return payload as AssimilatedContinuationRuntimeConfigPayloadV1;
}

function buildRuntimeConfigChainV1(input: {
  scope: TwinScopeKeyV1;
  first_config: CanonicalObjectEnvelopeV1;
}): CanonicalObjectEnvelopeV1[] {
  const firstConfig = structuredClone(
    input.first_config,
  );

  const authority = assimilatedConfigPayloadV1(
    firstConfig,
  );

  const configs: CanonicalObjectEnvelopeV1[] = [
    firstConfig,
  ];

  let parentConfig = firstConfig;

  for (
    let index = 1;
    index < S5_STANDARD_TICK_COUNT_V1;
    index += 1
  ) {
    const config =
      compileAssimilatedContinuationRuntimeConfigV1({
        scope: input.scope,
        logical_time: addHoursV1(
          S5_FIRST_LOGICAL_TIME_V1,
          index,
        ),
        created_at: S5_CREATED_AT_V1,
        parent_runtime_config_ref:
          parentConfig.object_id,
        parent_runtime_config_hash:
          parentConfig.determinism_hash,
        reality_binding_ref:
          authority.reality_binding_ref,
        reality_binding_hash:
          authority.reality_binding_hash,
        source_matrix_hash:
          authority.source_matrix_hash,
        configuration_matrix_hash:
          authority.configuration_matrix_hash,
        geometry_semantic_hash:
          authority.geometry_semantic_hash,
      });

    configs.push(config);
    parentConfig = config;
  }

  return configs;
}

class S5RangeEvidenceSourceV1
implements ReplayEvidenceSourcePortV1 {
  constructor(
    private readonly scope: TwinScopeKeyV1,
    private readonly rainfallTemplate:
      CanonicalReplayEvidenceRecordV1,
    private readonly et0Template:
      CanonicalReplayEvidenceRecordV1,
    private readonly observationTemplate:
      CanonicalReplayEvidenceRecordV1,
    private readonly scenario:
      S5ObservationScenarioV1,
    private readonly saturationFraction: number,
  ) {}

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (!sameScopeV1(input.scope, this.scope)) {
      throw new Error(
        "S5_FIXTURE_EVIDENCE_SCOPE_MISMATCH",
      );
    }

    const tickIndex = logicalTickIndexV1(
      input.logical_time,
    );

    const baseRecords = [
      rainfallRecordV1({
        template: this.rainfallTemplate,
        logical_time: input.logical_time,
        tick_index: tickIndex,
        // The independent outlier fixture drives the propagated prior near saturation before evaluating a zero-VWC observation.
        canonical_value:
          this.scenario === "OUTLIER_REJECTION"
            ? 80
            : 0,
      }),
      et0RecordV1({
        template: this.et0Template,
        logical_time: input.logical_time,
        tick_index: tickIndex,
      }),
    ];

    if (this.scenario === "NO_USABLE_OBSERVATION") {
      return baseRecords;
    }

    if (this.scenario === "LIMITED") {
      return [
        ...baseRecords,
        observationRecordV1({
          template: this.observationTemplate,
          logical_time: input.logical_time,
          tick_index: tickIndex,
          identity_suffix: "limited",
          quality_status: "LIMITED",
          canonical_value: 0.19,
        }),
      ];
    }

    if (this.scenario === "OUTLIER_REJECTION") {
      return [
        ...baseRecords,
        observationRecordV1({
          template: this.observationTemplate,
          logical_time: input.logical_time,
          tick_index: tickIndex,
          identity_suffix: "outlier",
          quality_status: "PASS",
          canonical_value: 0,
        }),
      ];
    }

    const selectedPass = observationRecordV1({
      template: this.observationTemplate,
      logical_time: input.logical_time,
      tick_index: tickIndex,
      identity_suffix: "pass",
      quality_status: "PASS",
      canonical_value: 0.19,
    });

    if (this.scenario === "CANDIDATE_EXCLUSION") {
      const excludedCandidate = observationRecordV1({
        template: this.observationTemplate,
        logical_time: input.logical_time,
        tick_index: tickIndex,
        identity_suffix: "unauthorized",
        quality_status: "PASS",
        canonical_value: 0.2,
        binding_id:
          "soil_moisture_unauthorized_s5_v1",
        observed_offset_minutes: 4,
      });

      return [
        ...baseRecords,
        selectedPass,
        excludedCandidate,
      ];
    }

    return [
      ...baseRecords,
      selectedPass,
    ];
  }
}

export async function
buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1(
  scenario:
    S5ObservationScenarioV1 =
      "STANDARD_PASS_RANGE",
) {
  const source =
    await buildMcftCap03SingleTickIntegrationFixtureV1();

  const rainfallTemplate = requiredTemplateV1(
    source.candidateRecords,
    "observed_rainfall_v1",
  );

  const et0Template = requiredTemplateV1(
    source.candidateRecords,
    "historical_et0_estimate_v1",
  );

  const observationTemplate = requiredTemplateV1(
    source.candidateRecords,
    "soil_moisture_observation_v1",
  );

  const runtimeConfigPayload =
    source.assimilatedRuntimeConfig.payload;

  const soilHydraulicSnapshot =
    runtimeConfigPayload
    && typeof runtimeConfigPayload === "object"
    && !Array.isArray(runtimeConfigPayload)
      ? Reflect.get(
          runtimeConfigPayload,
          "soil_hydraulic_snapshot",
        )
      : null;

  const saturationFraction = Number(
    soilHydraulicSnapshot
    && typeof soilHydraulicSnapshot === "object"
    && !Array.isArray(soilHydraulicSnapshot)
      ? Reflect.get(
          soilHydraulicSnapshot,
          "saturation_fraction",
        )
      : Number.NaN,
  );

  if (
    !Number.isFinite(saturationFraction)
    || saturationFraction <= 0
    || saturationFraction > 1
  ) {
    throw new Error(
      "S5_FIXTURE_SATURATION_FRACTION_INVALID",
    );
  }

  const runtimeConfigChain =
    buildRuntimeConfigChainV1({
      scope: source.scope,
      first_config:
        source.assimilatedRuntimeConfig,
    });

  for (
    const config of runtimeConfigChain.slice(1)
  ) {
    await source.runtime.commitRuntimeConfig(
      config,
    );
  }

  const runtimeConfigRefsByLogicalTime =
    Object.fromEntries(
      runtimeConfigChain.map((config) => [
        config.logical_time,
        config.object_id,
      ]),
    );

  const evidenceSource =
    new S5RangeEvidenceSourceV1(
      source.scope,
      rainfallTemplate,
      et0Template,
      observationTemplate,
      scenario,
      saturationFraction,
    );

  const handoffService =
    new PrepareNextTickInputServiceV1(
      source.runtime,
    );

  const tickService =
    new AssimilatedContinuationTickServiceV1(
      handoffService,
      evidenceSource,
      source.runtime,
      source.runtime,
    );

  const rangeService =
    new AssimilatedContiguousRangeServiceV1(
      handoffService,
      tickService,
    );

  const targetLogicalTime =
    scenario === "STANDARD_PASS_RANGE"
      ? S5_LAST_LOGICAL_TIME_V1
      : S5_FIRST_LOGICAL_TIME_V1;

  const expectedTickCount =
    scenario === "STANDARD_PASS_RANGE"
      ? S5_STANDARD_TICK_COUNT_V1
      : 1;

  const rangeInput:
    RunAssimilatedContiguousRangeInputV1 = {
      scope: source.scope,
      to_logical_time: targetLogicalTime,
      created_at: S5_CREATED_AT_V1,
      assimilated_runtime_config_refs_by_logical_time:
        runtimeConfigRefsByLogicalTime,
      crop_stage_context:
        source.cropStageContext,
      lease_owner:
        `mcft-cap-03-s5-${scenario.toLowerCase()}`,
      lease_duration_seconds: 300,
    };

  return {
    ...source,
    scenario,
    saturationFraction,
    runtimeConfigChain,
    runtimeConfigRefsByLogicalTime,
    evidenceSource,
    handoffService,
    tickService,
    rangeService,
    rangeInput,
    targetLogicalTime,
    expectedTickCount,
    firstLogicalTime:
      S5_FIRST_LOGICAL_TIME_V1,
    lastLogicalTime:
      S5_LAST_LOGICAL_TIME_V1,
    nextHandoffLogicalTime:
      S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  };
}
