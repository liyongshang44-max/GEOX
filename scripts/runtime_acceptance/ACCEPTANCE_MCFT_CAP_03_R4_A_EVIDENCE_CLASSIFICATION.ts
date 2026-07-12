// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_A_EVIDENCE_CLASSIFICATION.ts
// Purpose: prove the full V2 Runtime tick preserves selected-only evaluated refs and commits legal NO_USABLE_OBSERVATION ticks for rejected-only candidate sets.
// Boundary: deterministic in-memory Replay acceptance only; no production database, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  AssimilatedContinuationTickServiceV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.js";
import {
  buildMcftCap03R2V2FixtureV1,
  memberR2V2,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

const MINUTE_MS = 60 * 1000;
let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE_MS).toISOString();
}

function observationFrom(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): CanonicalReplayEvidenceRecordV1 {
  const observation = records.find(
    (record) => record.record_type === "soil_moisture_observation_v1",
  );
  assert.ok(observation);
  return structuredClone(observation);
}

function nonObservationRecords(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): CanonicalReplayEvidenceRecordV1[] {
  return records
    .filter((record) => record.record_type !== "soil_moisture_observation_v1")
    .map((record) => structuredClone(record));
}

function identify(
  record: CanonicalReplayEvidenceRecordV1,
  id: string,
): CanonicalReplayEvidenceRecordV1 {
  record.source_record_id = id;
  record.source_record_hash = `sha256:${id}`;
  return record;
}

type FixtureV1 = Awaited<ReturnType<typeof buildMcftCap03R2V2FixtureV1>>;
type CandidateTransformV1 = (
  records: CanonicalReplayEvidenceRecordV1[],
  logicalTime: string,
) => CanonicalReplayEvidenceRecordV1[];

function tickServiceWithEvidence(
  fixture: FixtureV1,
  transform: CandidateTransformV1,
): AssimilatedContinuationTickServiceV2 {
  const evidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      const records = await fixture.runtime.loadCandidateRecords(input);
      return transform(
        records.map((record) => structuredClone(record)),
        input.logical_time,
      );
    },
  };

  return new AssimilatedContinuationTickServiceV2(
    fixture.handoffService,
    evidenceSource,
    fixture.runtime,
    fixture.runtime,
  );
}

async function proveMultipleUsableSelection(): Promise<void> {
  const fixture = await buildMcftCap03R2V2FixtureV1(1);
  const service = tickServiceWithEvidence(
    fixture,
    (records, logicalTime) => {
      const base = observationFrom(records);
      const older = identify(structuredClone(base), "obs_r4_multi_older");
      const latest = identify(structuredClone(base), "obs_r4_multi_latest");

      older.role_time = {
        ...older.role_time,
        observed_at: addMinutes(logicalTime, -10),
        ingested_at: addMinutes(logicalTime, -9),
      };
      older.available_to_runtime_at = addMinutes(logicalTime, -9);

      latest.role_time = {
        ...latest.role_time,
        observed_at: addMinutes(logicalTime, -5),
        ingested_at: addMinutes(logicalTime, -4),
      };
      latest.available_to_runtime_at = addMinutes(logicalTime, -4);

      return [...nonObservationRecords(records), older, latest];
    },
  );

  const result = await service.executeOneTick(fixture.tickInput());
  assert.equal(result.status, "INSERTED");
  assert.equal(result.assimilation?.status, "APPLIED");
  assert.equal(
    result.assimilation?.selected_observation_ref,
    "obs_r4_multi_latest",
  );
  assert.deepEqual(
    result.assimilation?.evaluated_observation_refs,
    ["obs_r4_multi_latest"],
  );
  assert.deepEqual(
    result.evidence_window?.assimilation_evaluated_evidence_refs,
    ["obs_r4_multi_latest"],
  );
  const candidates =
    result.evidence_window?.observation_selection.candidates ?? [];
  assert.equal(
    candidates.find(
      (candidate) => candidate.observation_ref === "obs_r4_multi_older",
    )?.candidate_assessment,
    "NOT_SELECTED_OLDER_USABLE",
  );
  const update = memberR2V2(
    result.record_set,
    "twin_assimilation_update_v1",
  );
  assert.deepEqual(
    update.payload.evaluated_observation_refs,
    ["obs_r4_multi_latest"],
  );
  ok("multiple usable observations commit with selected-only evaluated refs");
}

async function proveRejectedOnlyTick(input: {
  name: string;
  observationId: string;
  expectedAssessment: string;
  mutate: (
    observation: CanonicalReplayEvidenceRecordV1,
    logicalTime: string,
  ) => void;
}): Promise<void> {
  const fixture = await buildMcftCap03R2V2FixtureV1(1);
  const service = tickServiceWithEvidence(
    fixture,
    (records, logicalTime) => {
      const observation = identify(
        observationFrom(records),
        input.observationId,
      );
      input.mutate(observation, logicalTime);
      return [...nonObservationRecords(records), observation];
    },
  );

  const result = await service.executeOneTick(fixture.tickInput());
  assert.equal(result.status, "INSERTED");
  assert.equal(result.assimilation?.status, "NOT_APPLIED");
  assert.equal(
    result.assimilation?.disposition,
    "NO_USABLE_OBSERVATION",
  );
  assert.equal(result.assimilation?.selected_observation_ref, null);
  assert.deepEqual(result.assimilation?.evaluated_observation_refs, []);
  assert.deepEqual(result.assimilation?.applied_observation_refs, []);
  assert.deepEqual(result.assimilation?.consumed_observation_refs, []);
  assert.deepEqual(
    result.evidence_window?.assimilation_evaluated_evidence_refs,
    [],
  );
  assert.deepEqual(
    result.evidence_window?.assimilation_applied_evidence_refs,
    [],
  );
  assert.ok(
    result.evidence_window?.rejected_evidence_refs.includes(
      input.observationId,
    ),
  );
  assert.ok(
    !result.evidence_window?.consumed_evidence_refs.includes(
      input.observationId,
    ),
  );
  const candidate =
    result.evidence_window?.observation_selection.candidates.find(
      (value) => value.observation_ref === input.observationId,
    );
  assert.equal(candidate?.candidate_assessment, input.expectedAssessment);
  const update = memberR2V2(
    result.record_set,
    "twin_assimilation_update_v1",
  );
  assert.deepEqual(update.payload.evaluated_observation_refs, []);
  assert.equal(update.payload.state_correction_vwc, 0);
  ok(`${input.name} remains a rejected candidate and commits a legal NOT_APPLIED tick`);
}

async function main(): Promise<void> {
  await proveMultipleUsableSelection();

  await proveRejectedOnlyTick({
    name: "stale-only observation",
    observationId: "obs_r4_stale_only",
    expectedAssessment: "REJECTED_TIME_STALE",
    mutate(observation, logicalTime) {
      observation.role_time = {
        ...observation.role_time,
        observed_at: addMinutes(logicalTime, -16),
        ingested_at: addMinutes(logicalTime, -5),
      };
      observation.available_to_runtime_at = addMinutes(logicalTime, -5);
    },
  });

  await proveRejectedOnlyTick({
    name: "FAIL-quality-only observation",
    observationId: "obs_r4_fail_only",
    expectedAssessment: "REJECTED_QUALITY_FAIL",
    mutate(observation) {
      observation.quality = { status: "FAIL" };
    },
  });

  await proveRejectedOnlyTick({
    name: "scope-mismatch-only observation",
    observationId: "obs_r4_scope_only",
    expectedAssessment: "REJECTED_SCOPE",
    mutate(observation) {
      observation.field_id = `${observation.field_id}_other`;
    },
  });

  await proveRejectedOnlyTick({
    name: "binding-mismatch-only observation",
    observationId: "obs_r4_binding_only",
    expectedAssessment: "REJECTED_UNAUTHORIZED_BINDING",
    mutate(observation) {
      observation.binding_id = "soil_obs_unapproved_v1";
    },
  });

  await proveRejectedOnlyTick({
    name: "quantity-mismatch-only observation",
    observationId: "obs_r4_quantity_only",
    expectedAssessment: "REJECTED_QUANTITY",
    mutate(observation) {
      observation.canonical_payload = {
        ...observation.canonical_payload,
        quantity_kind: "SOIL_TEMPERATURE",
      };
    },
  });

  await proveRejectedOnlyTick({
    name: "unit-mismatch-only observation",
    observationId: "obs_r4_unit_only",
    expectedAssessment: "REJECTED_CANONICAL_UNIT",
    mutate(observation) {
      observation.canonical_payload = {
        ...observation.canonical_payload,
        unit: "percent",
      };
      observation.canonical_unit = "percent";
    },
  });

  await proveRejectedOnlyTick({
    name: "physical-bound-only observation",
    observationId: "obs_r4_physical_only",
    expectedAssessment: "REJECTED_PHYSICAL_BOUNDS",
    mutate(observation) {
      observation.canonical_payload = {
        ...observation.canonical_payload,
        value: 0.9,
      };
    },
  });

  console.log(
    `MCFT-CAP-03 R4-A evidence classification: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
