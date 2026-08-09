// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING.ts
// Purpose: prove EA5B1 External soil binding authority is threaded through the CAP04 single-tick service while historical Replay default behavior and idempotent authority stability remain intact.
// Boundary: deterministic in-memory acceptance only; no database, provider network, scheduler, Formal writer, External Runtime Config authority, recommendation, action, or O00 execution.

import assert from "node:assert/strict";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function soilRecord(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1 {
  const found = records.find((record) => record.record_type === "soil_moisture_observation_v1");
  assert.ok(found, "EA5B2_SOIL_FIXTURE_REQUIRED");
  return structuredClone(found);
}

function externalizeSoil(record: CanonicalReplayEvidenceRecordV1): CanonicalReplayEvidenceRecordV1 {
  const external = structuredClone(record);
  external.source_record_id = "ea5b2_external_kbs_soil";
  external.source_record_hash = "sha256:ea5b2_external_kbs_soil";
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

function evidenceMember(result: Awaited<ReturnType<Cap04ForecastScenarioSingleTickServiceV1["executeOneTick"]>>) {
  const found = result.a_record_set.members.find((member) => member.object_type === "twin_evidence_window_v1");
  assert.ok(found, "EA5B2_CANONICAL_EVIDENCE_WINDOW_REQUIRED");
  return found;
}

async function main(): Promise<void> {
  const externalFixture = buildCap04S6SingleTickFixtureV1();
  const baseRecords = await externalFixture.runtime.loadCandidateRecords({
    scope: externalFixture.input.scope,
    logical_time: externalFixture.input.logical_time,
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
  const externalService = new Cap04ForecastScenarioSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(externalFixture.runtime),
    externalEvidenceSource,
    externalFixture.runtime,
    externalFixture.runtime,
  );
  const externalInput = {
    ...externalFixture.input,
    authorized_soil_observation_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  };

  const externalResult = await externalService.executeOneTick(externalInput);
  assert.equal(externalResult.status, "INSERTED");
  assert.ok(externalResult.evidence_window);
  assert.equal(
    externalResult.evidence_window.observation_selection.authorized_binding_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  );
  assert.equal(
    externalResult.evidence_window.observation_selection.selected_observation_ref,
    externalSoil.source_record_id,
  );
  assert.equal(
    externalResult.evidence_window.observation_selection.candidates.find(
      (candidate) => candidate.observation_ref === legacySoil.source_record_id,
    )?.candidate_assessment,
    "REJECTED_UNAUTHORIZED_BINDING",
  );
  const canonicalEvidence = evidenceMember(externalResult);
  const canonicalSelection = canonicalEvidence.payload.observation_selection as Record<string, unknown>;
  assert.equal(canonicalSelection.authorized_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal(canonicalSelection.selected_observation_ref, externalSoil.source_record_id);
  ok("CAP04 single-tick explicit External authority selects KBS soil and canonically rejects same-scope C8");

  const sameAuthorityRetry = await externalService.executeOneTick(externalInput);
  assert.equal(sameAuthorityRetry.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(
    evidenceMember(sameAuthorityRetry).determinism_hash,
    canonicalEvidence.determinism_hash,
  );
  ok("CAP04 idempotent retry accepts the exact same External soil authority");

  await assert.rejects(
    () => externalService.executeOneTick({
      ...externalInput,
      authorized_soil_observation_binding_id: ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
    }),
    /CAP04_SINGLE_TICK_SOIL_BINDING_AUTHORITY_RETRY_MISMATCH/,
  );
  ok("CAP04 idempotent retry rejects External-to-C8 authority drift");

  const { authorized_soil_observation_binding_id: _omitted, ...omittedRetry } = externalInput;
  await assert.rejects(
    () => externalService.executeOneTick(omittedRetry),
    /CAP04_SINGLE_TICK_SOIL_BINDING_AUTHORITY_RETRY_MISMATCH/,
  );
  ok("CAP04 idempotent retry rejects explicit-to-omitted authority drift");

  const blankFixture = buildCap04S6SingleTickFixtureV1();
  await assert.rejects(
    () => blankFixture.service.executeOneTick({
      ...blankFixture.input,
      authorized_soil_observation_binding_id: " ",
    }),
    /CAP04_SINGLE_TICK_SOIL_BINDING_AUTHORITY_INVALID/,
  );
  ok("CAP04 blank soil binding authority fails closed before Runtime execution");

  const replayFixture = buildCap04S6SingleTickFixtureV1();
  const replayResult = await replayFixture.service.executeOneTick(replayFixture.input);
  assert.equal(replayResult.status, "INSERTED");
  assert.ok(replayResult.evidence_window);
  assert.equal("authorized_binding_id" in replayResult.evidence_window.observation_selection, false);
  assert.equal(
    replayResult.evidence_window.observation_selection.selected_observation?.binding_id,
    ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
  );
  assert.equal(
    "authorized_binding_id" in (evidenceMember(replayResult).payload.observation_selection as Record<string, unknown>),
    false,
  );
  ok("CAP04 omitted soil authority preserves historical Replay default and canonical object shape");

  assert.equal(pass, 6);
  console.log(`MCFT-CAP-09 EA5B2 CAP04 External binding threading: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
