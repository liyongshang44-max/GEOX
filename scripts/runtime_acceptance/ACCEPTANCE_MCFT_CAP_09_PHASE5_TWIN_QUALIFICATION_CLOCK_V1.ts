import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.js";
import {
  buildPhase5TwinQualificationClockBoundaryV1,
  MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1,
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
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1.database_clock_for_tick_authority,
    true,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1.qualification_clock_boundary,
    "EXPLICIT_DATABASE_CLOCK_AND_SCHEDULER_AUTHORITY_INJECTION_WITH_PRODUCTION_DEFAULT",
  );

  const qualificationSource = fs.readFileSync(
    path.resolve(
      "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts",
    ),
    "utf8",
  );
  for (const required of [
    "runMcftCap09TwinRuntimeProcessV1",
    "ACCELERATED_ENGINEERING_ONLY",
    "MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1",
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
      "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts",
    ),
    "utf8",
  );
  for (const required of [
    "database_clock: input?.database_clock",
    "scheduler_clock_authority: input?.scheduler_clock_authority",
    "composeMcftCap09TwinRuntimeV1",
  ]) {
    assert.equal(processSource.includes(required), true);
  }

  const compositionSource = fs.readFileSync(
    path.resolve(
      "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts",
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
    exact_hour_required: true,
    same_production_twin_process_reused: true,
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
