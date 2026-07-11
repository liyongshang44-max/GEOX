// scripts/runtime_acceptance/mcft_cap_03_observation_assimilation_fixture_v1.ts
// Purpose: provide controlled canonical observations and inherited CAP-02 Evidence context for CAP-03 selector and pure assimilation acceptance.
// Boundary: acceptance fixture support only; no production route, persistence, scheduler, tick execution, or live-field claim.

import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap02SingleTickFixtureV1 } from "./mcft_cap_02_single_tick_fixture_v1.js";

export type ObservationFixtureOptionsV1 = {
  source_record_id: string;
  observed_at?: string;
  ingested_at?: string;
  available_to_runtime_at?: string;
  value?: number;
  quality_status?: "PASS" | "LIMITED" | "FAIL";
  binding_id?: string;
  canonical_unit?: string;
  quantity_kind?: string;
  source_version?: string;
  source_record_hash?: string;
  field_id?: string;
};

export async function buildMcftCap03ObservationAssimilationFixtureV1(): Promise<{
  cap02: Awaited<ReturnType<typeof buildMcftCap02SingleTickFixtureV1>>;
  makeObservation: (options: ObservationFixtureOptionsV1) => CanonicalReplayEvidenceRecordV1;
}> {
  const cap02 = await buildMcftCap02SingleTickFixtureV1();
  const logicalTime = cap02.evidenceFixture.logical_time;
  const makeObservation = (options: ObservationFixtureOptionsV1): CanonicalReplayEvidenceRecordV1 => ({
    ...cap02.scope,
    field_id: options.field_id ?? cap02.scope.field_id,
    dataset_id: "mcft_c8_water_replay_2026_06_v1",
    source_record_id: options.source_record_id,
    source_record_hash: options.source_record_hash ?? `sha256:${options.source_record_id}`,
    record_type: "soil_moisture_observation_v1",
    binding_id: options.binding_id ?? "soil_obs_c8_20cm_v1",
    origin_source_kind: "DEVICE",
    origin_source_id: "dev_soil_c8_001",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: options.available_to_runtime_at ?? options.ingested_at ?? "2026-06-01T01:56:00.000Z",
    role_time: {
      observed_at: options.observed_at ?? "2026-06-01T01:55:00.000Z",
      ingested_at: options.ingested_at ?? "2026-06-01T01:56:00.000Z",
    },
    quality: { status: options.quality_status ?? "PASS" },
    source_payload: {
      unit: "percent_vwc",
      value: (options.value ?? 0.23) * 100,
      source_version: options.source_version ?? "1",
    },
    canonical_payload: {
      unit: options.canonical_unit ?? "fraction",
      value: options.value ?? 0.23,
      quantity_kind: options.quantity_kind ?? "VOLUMETRIC_WATER_CONTENT",
    },
    source_unit: "percent_vwc",
    canonical_unit: options.canonical_unit ?? "fraction",
    conversion_rule: { id: "PERCENT_TO_FRACTION_V1", version: "1" },
    limitations: ["controlled synthetic point observation", `logical_time:${logicalTime}`],
  });
  return { cap02, makeObservation };
}
