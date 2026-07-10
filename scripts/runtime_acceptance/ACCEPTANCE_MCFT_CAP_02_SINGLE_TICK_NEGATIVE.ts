// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_NEGATIVE.ts
// Purpose: prove the single-tick application path fails closed for non-next time, invalid pinned config, missing/conflicting Evidence, invalid crop context, invalid lease intent, and transaction failure.
// Boundary: negative application acceptance only; no PostgreSQL fault recovery, range, restart, backfill, projection repair, Forecast success, Recommendation, or action.

import assert from "node:assert/strict";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { ContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  InMemorySingleTickRuntimeV1,
  buildMcftCap02SingleTickFixtureV1,
} from "./mcft_cap_02_single_tick_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02SingleTickFixtureV1();

  const execute = async (overrides: {
    logical_time?: string;
    created_at?: string;
    config?: CanonicalObjectEnvelopeV1 | null;
    records?: typeof fixture.evidenceFixture.candidate_records;
    crop_hash?: string;
    crop_context?: typeof fixture.cropStageContext;
    lease_owner?: string;
    lease_duration_seconds?: number;
    fault_injection?: (stage: string) => void;
  } = {}) => {
    const configs = [fixture.parentRuntimeConfig];
    if (overrides.config !== null) configs.push(overrides.config ?? fixture.continuationRuntimeConfig);
    const runtime = new InMemorySingleTickRuntimeV1({
      snapshot: fixture.initialSnapshot,
      configs,
      candidate_records: overrides.records ?? fixture.evidenceFixture.candidate_records,
    });
    const service = new ContinuationTickServiceV1(
      new PrepareNextTickInputServiceV1(runtime),
      runtime,
      runtime,
      runtime,
    );
    return service.executeOneTick({
      scope: fixture.scope,
      logical_time: overrides.logical_time ?? fixture.expectedFixture.logical_time,
      created_at: overrides.created_at ?? fixture.expectedFixture.created_at,
      continuation_runtime_config_ref: (overrides.config ?? fixture.continuationRuntimeConfig).object_id,
      crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
      crop_stage_context_hash: overrides.crop_hash ?? fixture.evidenceFixture.crop_stage_context_hash,
      crop_stage_context: overrides.crop_context ?? fixture.cropStageContext,
      lease_owner: overrides.lease_owner ?? "mcft-cap-02-single-tick-negative",
      lease_duration_seconds: overrides.lease_duration_seconds ?? 300,
      fault_injection: overrides.fault_injection,
    });
  };

  const expectReject = async (name: string, error: RegExp, action: () => Promise<unknown>) => {
    await assert.rejects(action, error);
    ok(name);
  };

  await expectReject(
    "REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK",
    /REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK/,
    () => execute({ logical_time: "2026-06-01T03:00:00.000Z" }),
  );

  await expectReject(
    "CONTINUATION_RUNTIME_CONFIG_NOT_FOUND",
    /CONTINUATION_RUNTIME_CONFIG_NOT_FOUND/,
    () => execute({ config: null }),
  );

  const parentRefMismatch = structuredClone(fixture.continuationRuntimeConfig);
  parentRefMismatch.payload.parent_runtime_config_ref = "runtime_config_wrong";
  await expectReject(
    "CONTINUATION_PARENT_RUNTIME_CONFIG_REF_MISMATCH",
    /CONTINUATION_PARENT_RUNTIME_CONFIG_REF_MISMATCH/,
    () => execute({ config: parentRefMismatch }),
  );

  const parentHashMismatch = structuredClone(fixture.continuationRuntimeConfig);
  parentHashMismatch.payload.parent_runtime_config_hash = "sha256:wrong";
  await expectReject(
    "CONTINUATION_PARENT_RUNTIME_CONFIG_HASH_MISMATCH",
    /CONTINUATION_PARENT_RUNTIME_CONFIG_HASH_MISMATCH/,
    () => execute({ config: parentHashMismatch }),
  );

  const realityMismatch = structuredClone(fixture.continuationRuntimeConfig);
  realityMismatch.payload.reality_binding_hash = "sha256:wrong";
  await expectReject(
    "CONTINUATION_REALITY_BINDING_MISMATCH",
    /CONTINUATION_REALITY_BINDING_MISMATCH/,
    () => execute({ config: realityMismatch }),
  );

  await expectReject(
    "MISSING_EXACT_HOURLY_RAINFALL_INTERVAL",
    /MISSING_EXACT_HOURLY_RAINFALL_INTERVAL/,
    () => execute({ records: fixture.evidenceFixture.candidate_records.filter((record) => record.record_type !== "observed_rainfall_v1") }),
  );

  await expectReject(
    "MISSING_EXACT_HOURLY_ET0_INTERVAL",
    /MISSING_EXACT_HOURLY_ET0_INTERVAL/,
    () => execute({ records: fixture.evidenceFixture.candidate_records.filter((record) => record.record_type !== "historical_et0_estimate_v1") }),
  );

  await expectReject(
    "CROP_STAGE_CONTEXT_HASH_MISMATCH",
    /CROP_STAGE_CONTEXT_HASH_MISMATCH/,
    () => execute({ crop_hash: "sha256:wrong" }),
  );

  const outsideContext = structuredClone(fixture.cropStageContext);
  outsideContext.coverage_end_exclusive = "2026-06-01T02:00:00.000Z";
  await expectReject(
    "CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE",
    /CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE/,
    () => execute({ crop_context: outsideContext }),
  );

  await expectReject(
    "SINGLE_TICK_LEASE_OWNER_REQUIRED",
    /SINGLE_TICK_LEASE_OWNER_REQUIRED/,
    () => execute({ lease_owner: "" }),
  );

  await expectReject(
    "SINGLE_TICK_LEASE_DURATION_INVALID",
    /SINGLE_TICK_LEASE_DURATION_INVALID/,
    () => execute({ lease_duration_seconds: 0 }),
  );

  const futureConfig = structuredClone(fixture.continuationRuntimeConfig);
  futureConfig.logical_time = "2026-06-01T03:00:00.000Z";
  await expectReject(
    "CONTINUATION_RUNTIME_CONFIG_FROM_FUTURE_FORBIDDEN",
    /CONTINUATION_RUNTIME_CONFIG_FROM_FUTURE_FORBIDDEN/,
    () => execute({ config: futureConfig }),
  );

  const conflictRecords = structuredClone(fixture.evidenceFixture.candidate_records);
  const duplicateRain = conflictRecords.find((record) => record.source_record_id === "rain_exact_earlier");
  assert.ok(duplicateRain);
  duplicateRain.canonical_payload.value = 1;
  await expectReject(
    "CONFLICTING_DUPLICATE_EVIDENCE",
    /CONFLICTING_DUPLICATE_EVIDENCE/,
    () => execute({ records: conflictRecords }),
  );

  await expectReject(
    "FAULT_INJECTION_BEFORE_COMMIT",
    /FAULT:before_commit/,
    () => execute({ fault_injection: (stage) => { if (stage === "before_commit") throw new Error("FAULT:before_commit"); } }),
  );

  const wrongType = structuredClone(fixture.continuationRuntimeConfig) as CanonicalObjectEnvelopeV1;
  wrongType.object_type = "twin_state_estimate_v1";
  await expectReject(
    "CONTINUATION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED",
    /CONTINUATION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED/,
    () => execute({ config: wrongType }),
  );

  console.log(`MCFT-CAP-02 single-tick negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
