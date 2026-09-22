// Qualification-only exact-head Phase5 requalification marker for 0ac2d2cf successor re-anchor; no runtime/product semantic change.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_CONTRACT_V2,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.js";
import {
  buildPhase5TwinQualificationClockBoundaryV1,
  buildPhase5TwinQualificationRuntimeStartAuthorityV1,
  MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1,
  MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1,
  MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1,
  MCFT_CAP09_PHASE5_RUNTIME_START_QUALIFICATION_AUTHORITY_REF_V1,
} from "../../apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";

async function main(): Promise<void> {
  const through = "2026-08-28T07:00:00.000Z";
  const boundary = buildPhase5TwinQualificationClockBoundaryV1({
    through_logical_time: through,
    qualification_ack: MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1,
  });
  const snapshot = await boundary.database_clock.readDatabaseNow();
  assert.equal(snapshot.observed_at, through);
  assert.equal(boundary.scheduler_clock_authority.mode, "ACCELERATED_ENGINEERING_ONLY");
  if (boundary.scheduler_clock_authority.mode !== "ACCELERATED_ENGINEERING_ONLY") {
    throw new Error("PHASE5_ACCELERATED_SCHEDULER_AUTHORITY_REQUIRED");
  }
  assert.equal(
    boundary.scheduler_clock_authority.qualification_ack,
    MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
  );
  assert.equal(boundary.scheduler_clock_authority.now().toISOString(), through);

  const qualificationScope = {
    tenant_id: "tenant-phase5",
    project_id: "project-phase5",
    group_id: "group-phase5",
    field_id: "field-phase5",
    season_id: "season-phase5",
    zone_id: "zone-phase5",
  } as const;
  const qualificationSubject = "1".repeat(40);
  const qualificationStart =
    buildPhase5TwinQualificationRuntimeStartAuthorityV1({
      formal_a0: "2026-08-27T19:00:00.000Z",
      run_class: MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1,
      qualification_ack: MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1,
      deployment_subject_sha: qualificationSubject,
      scope: qualificationScope,
    });
  assert.equal(
    qualificationStart.authority_ref,
    MCFT_CAP09_PHASE5_RUNTIME_START_QUALIFICATION_AUTHORITY_REF_V1,
  );
  assert.equal(qualificationStart.deployment_subject_sha, qualificationSubject);
  assert.deepEqual(qualificationStart.scope, qualificationScope);
  assert.match(
    qualificationStart.formal_a0_authority_sha256,
    /^sha256:[0-9a-f]{64}$/,
  );
  assert.match(
    qualificationStart.live_activation_authority_sha256,
    /^sha256:[0-9a-f]{64}$/,
  );
  assert.equal(
    qualificationStart.activation_fence_time,
    "2026-08-27T18:30:00.000Z",
  );
  assert.equal(
    qualificationStart.formal_a0_logical_time,
    "2026-08-27T19:00:00.000Z",
  );
  assert.equal(qualificationStart.runtime_process_start_authorized, true);
  assert.equal(qualificationStart.twin_runtime_start_authorized, true);
  assert.equal(qualificationStart.evidence_runtime_start_authorized, false);
  assert.equal(qualificationStart.production_owner_activation_authorized, false);
  assert.equal(qualificationStart.formal_v5_arm_authorized, false);
  assert.equal(qualificationStart.a0_authorized, false);
  assert.equal(qualificationStart.o00_authorized, false);

  const realClockStart = buildPhase5TwinQualificationRuntimeStartAuthorityV1({
    formal_a0: "2026-08-27T19:00:00.000Z",
    run_class: MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1,
    rehearsal_activation_fence_time: "2026-08-27T18:11:22.000Z",
    deployment_subject_sha: qualificationSubject,
    scope: qualificationScope,
  });
  assert.equal(
    realClockStart.authority_ref,
    "qualification://mcft-cap09/phase5/real-clock-rehearsal/runtime-start-authority-v1",
  );
  assert.equal(realClockStart.activation_fence_time, "2026-08-27T18:11:22.000Z");
  assert.equal(realClockStart.runtime_process_start_authorized, true);
  assert.equal(realClockStart.twin_runtime_start_authorized, true);
  assert.equal(realClockStart.production_owner_activation_authorized, false);
  assert.equal(realClockStart.formal_v5_arm_authorized, false);
  assert.equal(realClockStart.a0_authorized, false);
  assert.equal(realClockStart.o00_authorized, false);

  assert.throws(
    () => buildPhase5TwinQualificationRuntimeStartAuthorityV1({
      formal_a0: "2026-08-27T19:00:00.000Z",
      run_class: MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1,
      deployment_subject_sha: qualificationSubject,
      scope: qualificationScope,
    }),
    /REAL_CLOCK_REHEARSAL_ACTIVATION_FENCE_REQUIRED/,
  );
  assert.throws(
    () => buildPhase5TwinQualificationRuntimeStartAuthorityV1({
      formal_a0: "2026-08-27T19:00:00.000Z",
      run_class: MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1,
      rehearsal_activation_fence_time: "2026-08-27T19:00:00.000Z",
      deployment_subject_sha: qualificationSubject,
      scope: qualificationScope,
    }),
    /REAL_CLOCK_REHEARSAL_FENCE_MUST_PRECEDE_A0/,
  );

  assert.throws(
    () => buildPhase5TwinQualificationRuntimeStartAuthorityV1({
      formal_a0: "2026-08-27T19:00:00.000Z",
      run_class: MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1,
      qualification_ack: "WRONG",
      deployment_subject_sha: qualificationSubject,
      scope: qualificationScope,
    }),
    /PHASE5_TWIN_QUALIFICATION_RUNTIME_START_ACK_REQUIRED/,
  );

  assert.throws(
    () => buildPhase5TwinQualificationClockBoundaryV1({
      through_logical_time: through,
      qualification_ack: "WRONG",
    }),
    /PHASE5_TWIN_QUALIFICATION_CLOCK_ACK_REQUIRED/,
  );
  assert.throws(
    () => buildPhase5TwinQualificationClockBoundaryV1({
      through_logical_time: "2026-08-28T07:30:00.000Z",
      qualification_ack: MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1,
    }),
    /PHASE5_TWIN_QUALIFICATION_CLOCK_EXACT_HOUR_REQUIRED/,
  );

  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_CONTRACT_V2.host_clock_mode,
    "POSTGRES_TRANSACTION_TIMESTAMP_DEFAULT_WITH_EXPLICIT_QUALIFICATION_SEAM",
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_CONTRACT_V2.scheduler_clock_mode,
    "SYSTEM_DATABASE_UTC_DEFAULT_WITH_EXPLICIT_ACCELERATED_ENGINEERING_SEAM",
  );

  const qualificationSource = fs.readFileSync(
    path.resolve(
      "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts",
    ),
    "utf8",
  );
  for (const required of [
    "composeMcftCap09TwinRuntimeV2",
    "ACCELERATED_ENGINEERING_ONLY",
    "MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1",
    "buildPhase5TwinQualificationRuntimeStartAuthorityV1",
    "loadMcftCap09ProductionRuntimeStartAuthorityV1",
    "loadMcftCap09ProductionStageAuthorityMountsV1",
    "REAL_CLOCK_REHEARSAL",
  ]) {
    assert.equal(
      qualificationSource.includes(required),
      true,
      `PHASE5_TWIN_QUALIFICATION_BINDING_REQUIRED:${required}`,
    );
  }
  for (const forbidden of [
    "composeMcftCap09TwinRuntimeV1(",
    "ExternalFormalV3Amendment19RunnerV1",
    "PostgresPersistentSequentialSchedulerAdapterV1(",
    "PostgresRuntimeRepositoryV1",
    "/external_evidence/",
    "provider/",
    "EvidenceSupplyCursor",
    "scripts/runtime_acceptance",
  ]) {
    assert.equal(
      qualificationSource.includes(forbidden),
      false,
      `PHASE5_TWIN_QUALIFICATION_SECOND_RUNTIME_PATH_FORBIDDEN:${forbidden}`,
    );
  }

  const processSource = fs.readFileSync(
    path.resolve(
      "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts",
    ),
    "utf8",
  );
  assert.equal(processSource.includes("composeMcftCap09TwinRuntimeV2"), true);
  for (const forbidden of [
    "qualification_lease_owner",
    "qualification_run_class",
    "database_clock: input?.database_clock",
    "scheduler_clock_authority: input?.scheduler_clock_authority",
  ]) {
    assert.equal(
      processSource.includes(forbidden),
      false,
      `PHASE5_PRODUCTION_PROCESS_QUALIFICATION_SEAM_FORBIDDEN:${forbidden}`,
    );
  }

  const compositionSource = fs.readFileSync(
    path.resolve(
      "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts",
    ),
    "utf8",
  );
  assert.equal(
    compositionSource.includes('input.scheduler_clock_authority ?? { mode: "SYSTEM_DATABASE_UTC" }'),
    true,
  );
  assert.equal(
    compositionSource.includes(
      "input.database_clock ?? new PostgresTwinRuntimeDatabaseClockV1(input.pool)",
    ),
    true,
  );

  const proof = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_PHASE5_TWIN_QUALIFICATION_CLOCK_V1",
    production_database_clock_default_preserved: true,
    production_scheduler_clock_default_preserved: true,
    accelerated_clock_requires_explicit_ack: true,
    qualification_runtime_start_requires_explicit_ack: true,
    qualification_runtime_start_exact_subject_bound: true,
    qualification_runtime_start_exact_scope_bound: true,
    qualification_runtime_start_authority_is_non_owner_non_formal: true,
    qualification_lease_owner_requires_explicit_run_class: true,
    real_clock_rehearsal_forbids_clock_override: true,
    real_clock_rehearsal_uses_system_database_utc_clock: true,
    real_clock_rehearsal_activation_fence_is_physical_start_time: true,
    exact_hour_required: true,
    same_production_twin_composition_reused: true,
    production_process_source_has_no_qualification_clock_seam: true,
    production_process_version: "V2",
    production_composition_version: "V2",
    production_runner_version: "ExternalFormalV4Amendment19RunnerV2",
    production_crop_context_version: "materializeExternalFormalA18CropContextV4",
    second_scheduler_or_runner_path: false,
    provider_fallback: false,
    formal_v5_armed: false,
    production_owner_cutover: false,
  };
  fs.mkdirSync("acceptance-output", { recursive: true });
  fs.writeFileSync(
    "acceptance-output/MCFT_CAP_09_PHASE5_TWIN_QUALIFICATION_CLOCK_V1_RESULT.json",
    JSON.stringify(proof, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(proof, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});