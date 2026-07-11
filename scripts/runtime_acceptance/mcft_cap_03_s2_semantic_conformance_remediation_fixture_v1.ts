// scripts/runtime_acceptance/mcft_cap_03_s2_semantic_conformance_remediation_fixture_v1.ts
// Purpose: provide controlled V1-compatible canonical observation records for the additive MCFT-CAP-03 S2 V2 semantic-conformance acceptance.
// Boundary: acceptance fixture support only; no production route, persistence, scheduler, Runtime tick execution, canonical write, or live-field claim.

import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap03ObservationAssimilationFixtureV1,
  type ObservationFixtureOptionsV1,
} from "./mcft_cap_03_observation_assimilation_fixture_v1.js";

export type S2SemanticConformanceObservationOptionsV1 =
  ObservationFixtureOptionsV1 & {
    record_type?: string;
    canonical_payload_extra?: Record<string, unknown>;
  };

export async function buildMcftCap03S2SemanticConformanceRemediationFixtureV1(): Promise<{
  cap02: Awaited<
    ReturnType<typeof buildMcftCap03ObservationAssimilationFixtureV1>
  >["cap02"];
  makeObservation: (
    options: S2SemanticConformanceObservationOptionsV1,
  ) => CanonicalReplayEvidenceRecordV1;
}> {
  const base = await buildMcftCap03ObservationAssimilationFixtureV1();

  const makeObservation = (
    options: S2SemanticConformanceObservationOptionsV1,
  ): CanonicalReplayEvidenceRecordV1 => {
    const record = base.makeObservation(options);
    record.record_type =
      options.record_type ?? "soil_moisture_observation_v1";
    record.canonical_payload = {
      ...record.canonical_payload,
      ...(options.canonical_payload_extra ?? {}),
    };
    return record;
  };

  return {
    cap02: base.cap02,
    makeObservation,
  };
}
