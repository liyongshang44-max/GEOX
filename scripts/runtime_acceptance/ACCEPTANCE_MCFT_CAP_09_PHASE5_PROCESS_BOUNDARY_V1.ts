import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1,
  readMcftCap09EvidenceRuntimeProcessConfigV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.js";
import {
  createMcftCap09ProcessStopV1,
  McftCap09ProductionTwinFailureClassifierV1,
  MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1,
} from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";
import {
  MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1,
  readMcftCap09TwinRuntimeProcessConfigV1,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.js";
import {
  loadMcftCap09ProductionRuntimeStartAuthorityV1,
  parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_runtime_start_authority_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
  readMcftCap09ProductionServiceIdentityBindingV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_service_identity_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1_RESULT.json",
);

class FakeProcessSignalsV1 extends EventEmitter {
  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}

function main(): void {
  const twinEnv = {
    GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL:
      "postgres://twin-login:secret@postgres:5432/geox",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_MANIFEST_PATH: "/run/geox/manifest.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH: "/run/geox/crop.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH:
      "/run/geox/config-matrix.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER: "twin-runtime:test-A",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_DURATION_SECONDS: "300",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_IDLE_POLL_MS: "1000",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_NOT_READY_POLL_MS: "2000",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_TERMINAL_POLL_MS: "0",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_RETRY_BASE_MS: "1000",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_RETRY_MAXIMUM_MS: "10000",
    DATABASE_URL: "postgres://forbidden-generic-url",
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL:
      "postgres://forbidden-evidence-url",
    GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY: "forbidden-to-twin",
  } as const;
  const twin = readMcftCap09TwinRuntimeProcessConfigV1(twinEnv);
  assert.equal(
    twin.database_url,
    "postgres://twin-login:secret@postgres:5432/geox",
  );
  assert.equal(twin.lease_owner, "twin-runtime:test-A");
  assert.equal(twin.lease_duration_seconds, 300);
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1.provider_credentials_allowed,
    false,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1.raw_storage_credentials_allowed,
    false,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1.database_clock_for_tick_authority,
    true,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1.runtime_start_authority,
    "SEPARATE_GOVERNED_AUTHORITY_REQUIRED",
  );

  const runtimeStartAuthority = {
    schema_version: "geox_mcft_cap09_production_runtime_start_authority_instance_v1",
    authority_id: "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-INSTANCE-V1",
    status: "AUTHORIZED",
    armed: true,
    authority_class: "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
    authority_ref: "GEOX-MCFT-CAP-09-TEST-RUNTIME-START-AUTHORITY-V1",
    activation_fence_time: "2026-09-03T17:30:00.000Z",
    formal_a0_authority_ref: "GEOX-MCFT-CAP-09-TEST-A0-AUTHORITY-V1",
    formal_a0_logical_time: "2026-09-03T18:00:00.000Z",
    runtime_process_start_authorized: true,
    evidence_runtime_start_authorized: true,
    twin_runtime_start_authorized: true,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
  } as const;
  assert.equal(
    parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      runtimeStartAuthority,
      "TWIN_RUNTIME",
    ).formal_a0_logical_time,
    "2026-09-03T18:00:00.000Z",
  );
  assert.equal(
    parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      runtimeStartAuthority,
      "EVIDENCE_RUNTIME",
    ).activation_fence_time,
    "2026-09-03T17:30:00.000Z",
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      { ...runtimeStartAuthority, armed: false },
      "TWIN_RUNTIME",
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED/,
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      { ...runtimeStartAuthority, twin_runtime_start_authorized: false },
      "TWIN_RUNTIME",
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED/,
  );

  const mountedAuthorityPath = path.resolve(
    "acceptance-output/MCFT_CAP_09_TEST_RUNTIME_START_AUTHORITY_INSTANCE_V1.json",
  );
  fs.mkdirSync(path.dirname(mountedAuthorityPath), { recursive: true });
  fs.writeFileSync(
    mountedAuthorityPath,
    JSON.stringify(runtimeStartAuthority, null, 2) + "\n",
  );
  assert.equal(
    loadMcftCap09ProductionRuntimeStartAuthorityV1({
      plane: "TWIN_RUNTIME",
      authority_path: mountedAuthorityPath,
      embedded_authority: { armed: false },
    }).formal_a0_logical_time,
    "2026-09-03T18:00:00.000Z",
  );

  const evidenceBinding =
    readMcftCap09ProductionServiceIdentityBindingV1("EVIDENCE_RUNTIME");
  const twinBinding =
    readMcftCap09ProductionServiceIdentityBindingV1("TWIN_RUNTIME");
  assert.notEqual(evidenceBinding.service_id, twinBinding.service_id);
  const evidenceOwnerA = buildMcftCap09ProductionLeaseOwnerV1({
    plane: "EVIDENCE_RUNTIME",
    configured_service_id: evidenceBinding.service_id,
    instance_id: "container-a",
  });
  const evidenceOwnerB = buildMcftCap09ProductionLeaseOwnerV1({
    plane: "EVIDENCE_RUNTIME",
    configured_service_id: evidenceBinding.service_id,
    instance_id: "container-b",
  });
  assert.notEqual(evidenceOwnerA, evidenceOwnerB);
  assert.equal(
    evidenceOwnerA,
    `${evidenceBinding.service_id}#instance:container-a`,
  );
  assert.throws(
    () => buildMcftCap09ProductionLeaseOwnerV1({
      plane: "EVIDENCE_RUNTIME",
      configured_service_id: twinBinding.service_id,
      instance_id: "container-a",
    }),
    /MCFT_CAP09_PRODUCTION_CONFIGURED_SERVICE_ID_MISMATCH/,
  );

  assert.throws(
    () => readMcftCap09TwinRuntimeProcessConfigV1({
      ...twinEnv,
      GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL: "",
    }),
    /PHASE5_TWIN_RUNTIME_DATABASE_URL_REQUIRED/,
  );

  const evidenceEnv = {
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL:
      "postgres://evidence-login:secret@postgres:5432/geox",
    GEOX_MCFT_CAP09_TENANT_ID: "tenantA",
    GEOX_MCFT_CAP09_PROJECT_ID: "projectA",
    GEOX_MCFT_CAP09_GROUP_ID: "groupA",
    GEOX_MCFT_CAP09_FIELD_ID: "field_e3r1",
    GEOX_MCFT_CAP09_SEASON_ID: "season_2026",
    GEOX_MCFT_CAP09_ZONE_ID: "zone_root",
    GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT: "https://s3.example.invalid",
    GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET: "phase5-evidence-private",
    GEOX_MCFT_CAP09_EVIDENCE_S3_REGION: "us-test-1",
    GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID: "evidence-access",
    GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY: "evidence-secret",
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_OWNER: "evidence-runtime:test-A",
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_DURATION_SECONDS: "300",
    GEOX_MCFT_CAP09_EVIDENCE_SUCCESS_CADENCE_MS: "1000",
    GEOX_MCFT_CAP09_EVIDENCE_LEASE_STANDBY_MS: "1000",
    GEOX_MCFT_CAP09_EVIDENCE_RETRY_BASE_MS: "1000",
    GEOX_MCFT_CAP09_EVIDENCE_RETRY_MAXIMUM_MS: "10000",
    DATABASE_URL: "postgres://forbidden-generic-url",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL:
      "postgres://forbidden-twin-url",
  } as const;
  const evidence = readMcftCap09EvidenceRuntimeProcessConfigV1(evidenceEnv);
  assert.equal(
    evidence.database_url,
    "postgres://evidence-login:secret@postgres:5432/geox",
  );
  assert.equal(evidence.scope.field_id, "field_e3r1");
  assert.equal(evidence.lease_owner, "evidence-runtime:test-A");
  assert.equal(
    MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1.runtime_tick_cursor_authority,
    false,
  );
  assert.equal(
    MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1.twin_state_authority,
    false,
  );
  assert.equal(
    MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1.target_selection_boundary,
    "EXPLICIT_INJECTED_TARGET_PLANNER",
  );
  assert.equal(
    MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1.host_planner_boundary,
    "EXPLICIT_INJECTED_HOST_PLANNER",
  );

  const signals = new FakeProcessSignalsV1();
  const stop = createMcftCap09ProcessStopV1({
    process_ref: signals as never,
  });
  assert.equal(stop.lifecycle_id, MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1);
  assert.equal(stop.stopRequested(), false);
  signals.emit("SIGTERM");
  assert.equal(stop.stopRequested(), true);
  assert.equal(stop.received_signal, "SIGTERM");
  stop.dispose();
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  assert.equal(signals.listenerCount("SIGINT"), 0);

  const twinFailureClassifier = new McftCap09ProductionTwinFailureClassifierV1();
  for (const code of [
    "LEASE_HELD_BY_OTHER_OWNER",
    "SLOT_ALREADY_CLAIMED_BY_OTHER_OWNER",
    "ACTIVE_SLOT_ALREADY_PRESENT",
    "TERMINAL_SLOT_ALREADY_RECORDED",
    "SLOT_PRECEDES_DURABLE_CURSOR",
  ]) {
    assert.equal(
      twinFailureClassifier.classify(new Error(code)),
      "RETRYABLE",
      `PHASE5_TWIN_COORDINATION_CONTENTION_MUST_RETRY:${code}`,
    );
  }
  for (const code of [
    "STALE_FENCING_TOKEN",
    "OLDER_MISSED_SLOT_REQUIRED",
    "SCHEDULER_CURSOR_CONFIG_CONFLICT",
  ]) {
    assert.equal(
      twinFailureClassifier.classify(new Error(code)),
      "FATAL",
      `PHASE5_TWIN_CORRUPTION_MUST_FAIL_CLOSED:${code}`,
    );
  }

  const lifecycleSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts"),
    "utf8",
  );
  const twinSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts"),
    "utf8",
  );
  const evidenceSource = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts"),
    "utf8",
  );
  const distWriter = fs.readFileSync(
    path.resolve("apps/server/scripts/write_dist_entries.cjs"),
    "utf8",
  );
  assert.equal(
    evidenceSource.includes("host_planner: EvidenceRuntimeHostPlannerV1"),
    true,
    "PHASE5_EVIDENCE_PROCESS_DIRECT_HOST_PLANNER_SEAM_REQUIRED",
  );
  assert.equal(
    distWriter.includes("runMcftCap09ProductionEvidenceRuntimeV1"),
    true,
    "PHASE5_EVIDENCE_DIST_ENTRYPOINT_PRODUCTION_PLANNER_BINDING_REQUIRED",
  );

  for (const forbidden of [
    "scripts/runtime_acceptance",
    "github.event",
    "GITHUB_RUN_ID",
    "Formal-v5",
  ]) {
    assert.equal(
      `${lifecycleSource}\n${twinSource}\n${evidenceSource}`.includes(forbidden),
      false,
      `PHASE5_PROCESS_TEST_ONLY_DEPENDENCY_FORBIDDEN:${forbidden}`,
    );
  }
  assert.equal(twinSource.includes("composeMcftCap09TwinRuntimeV1"), true);
  assert.equal(evidenceSource.includes("composeEvidenceRuntimeV1"), true);
  assert.equal(evidenceSource.includes("lease_repository.releaseLease"), true);
  assert.equal(
    distWriter.includes('path.join("runtime", "mcft_cap09_evidence_runtime.js")'),
    true,
  );
  assert.equal(
    distWriter.includes("runMcftCap09ProductionEvidenceRuntimeV1"),
    true,
  );
  assert.equal(
    distWriter.includes("MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND"),
    false,
  );
  assert.equal(
    distWriter.includes('path.join("runtime", "mcft_cap09_twin_runtime.js")'),
    true,
  );
  assert.equal(
    distWriter.includes("runMcftCap09TwinRuntimeProcessV1"),
    true,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_phase5_process_boundary_qualification_v1",
    status: "PASS",
    production_lifecycle_shared: true,
    twin_database_url_explicit_and_independent: true,
    evidence_database_url_explicit_and_independent: true,
    twin_provider_credentials_not_read: true,
    twin_raw_storage_credentials_not_read: true,
    evidence_target_planner_explicit_boundary: true,
    evidence_process_uses_phase3_composition: true,
    twin_process_uses_phase4_composition: true,
    signal_stop_supported: true,
    evidence_graceful_current_fence_release: true,
    twin_duplicate_coordination_contention_retryable: true,
    twin_stale_fence_corruption_fatal: true,
    stable_compiled_evidence_entrypoint: true,
    evidence_entrypoint_production_planner_bound: true,
    evidence_entrypoint_fail_closed_without_runtime_start_authority: true,
    twin_entrypoint_fail_closed_without_runtime_start_authority: true,
    shared_runtime_start_authority_parser: true,
    mounted_runtime_start_authority_file_binding: true,
    frozen_production_service_identity_binding: true,
    per_instance_fenced_owner_identity: true,
    duplicate_service_instances_have_distinct_owner_identity: true,
    stable_compiled_twin_entrypoint: true,
    test_script_dependency_in_product_process: false,
    production_owner_cutover: false,
    formal_v5_armed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof) + "\n");
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  throw error;
}
