import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1,
  readMcftCap09EvidenceRuntimeProcessConfigV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.js";
import {
  createMcftCap09ProcessStopV1,
  installMcftCap09RuntimePoolIdleErrorGuardV1,
  type McftCap09RuntimePoolIdleErrorEventV1,
  mcftCap09EvidenceLeaseKeepaliveIntervalMsV1,
  McftCap09ProductionEvidenceFailureClassifierV1,
  McftCap09ProductionTwinFailureClassifierV1,
  MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1,
} from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";
import {
  MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1,
  loadMcftCap09ProductionStageAuthorityMountsV1,
  readMcftCap09TwinRuntimeProcessConfigV1,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.js";
import {
  MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.js";
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

class FakeRuntimePoolV1 extends EventEmitter {
  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}

function digestFile(file: string): string {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main(): void {
  const poolEvents: McftCap09RuntimePoolIdleErrorEventV1[] = [];
  const fakeTwinPool = new FakeRuntimePoolV1();
  const twinPoolGuard = installMcftCap09RuntimePoolIdleErrorGuardV1({
    pool: fakeTwinPool as never,
    runtime_role: "TWIN_RUNTIME",
    failure_classifier: new McftCap09ProductionTwinFailureClassifierV1(),
    event_sink: (event) => poolEvents.push(structuredClone(event)),
  });
  const transientRecovery = Object.assign(
    new Error("the database system is in recovery mode"),
    { code: "57P03" },
  );
  assert.doesNotThrow(() => {
    fakeTwinPool.emit("error", transientRecovery, {
      secretKey: 472317303,
      password: "must-not-leak",
    });
  });
  assert.equal(poolEvents.length, 1);
  assert.equal(poolEvents[0]?.runtime_role, "TWIN_RUNTIME");
  assert.equal(poolEvents[0]?.failure_class, "RETRYABLE");
  assert.equal(poolEvents[0]?.failure_token, "57P03");
  assert.equal(JSON.stringify(poolEvents).includes("secretKey"), false);
  assert.equal(JSON.stringify(poolEvents).includes("must-not-leak"), false);

  assert.throws(
    () => fakeTwinPool.emit(
      "error",
      new Error("PHASE5_NON_TRANSIENT_IDLE_POOL_FATAL"),
    ),
    /PHASE5_NON_TRANSIENT_IDLE_POOL_FATAL/,
  );
  assert.equal(poolEvents.at(-1)?.failure_class, "FATAL");
  twinPoolGuard.dispose();
  assert.equal(fakeTwinPool.listenerCount("error"), 0);

  const fakeEvidencePool = new FakeRuntimePoolV1();
  const evidenceEvents: McftCap09RuntimePoolIdleErrorEventV1[] = [];
  const evidencePoolGuard = installMcftCap09RuntimePoolIdleErrorGuardV1({
    pool: fakeEvidencePool as never,
    runtime_role: "EVIDENCE_RUNTIME",
    failure_classifier: new McftCap09ProductionEvidenceFailureClassifierV1(),
    event_sink: (event) => evidenceEvents.push(structuredClone(event)),
  });
  assert.doesNotThrow(() => {
    fakeEvidencePool.emit(
      "error",
      new Error("Connection terminated unexpectedly"),
    );
  });
  assert.equal(evidenceEvents.length, 1);
  assert.equal(evidenceEvents[0]?.failure_class, "RETRYABLE");
  assert.equal(
    evidenceEvents[0]?.failure_token,
    "POSTGRES_CONNECTION_TERMINATED",
  );
  evidencePoolGuard.dispose();
  assert.equal(fakeEvidencePool.listenerCount("error"), 0);

  const twinV1Source = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts"),
    "utf8",
  );
  const twinV2GuardSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts"),
    "utf8",
  );
  const twinQualificationSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts"),
    "utf8",
  );
  const evidenceProcessSource = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts"),
    "utf8",
  );
  for (const [name, source] of [
    ["TWIN_V1", twinV1Source],
    ["TWIN_V2", twinV2GuardSource],
    ["TWIN_QUALIFICATION", twinQualificationSource],
    ["EVIDENCE", evidenceProcessSource],
  ] as const) {
    assert.equal(
      source.includes("installMcftCap09RuntimePoolIdleErrorGuardV1"),
      true,
      `PHASE5_RUNTIME_POOL_IDLE_ERROR_GUARD_REQUIRED:${name}`,
    );
  }
  const twinEnv = {
    GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL:
      "postgres://twin-login:secret@postgres:5432/geox",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_MANIFEST_PATH: "/run/geox/manifest.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH: "/run/geox/crop.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH:
      "/run/geox/config-matrix.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_CURRENT_CROP_AUTHORITY_PATH:
      "/run/geox/current-crop.json",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH:
      "/run/geox/stage-architecture-effectiveness.json",
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
  assert.equal(twin.current_crop_authority_path, "/run/geox/current-crop.json");
  assert.equal(
    twin.biological_stage_architecture_effectiveness_path,
    "/run/geox/stage-architecture-effectiveness.json",
  );
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
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2.composition,
    "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2",
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2.runner,
    "ExternalFormalV4Amendment19RunnerV2",
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2.crop_context_materializer,
    "materializeExternalFormalA18CropContextV4",
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2.provider_credentials_allowed,
    false,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2.raw_storage_credentials_allowed,
    false,
  );

  const runtimeStartExpected = {
    deployment_subject_sha: "1".repeat(40),
    scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "field_e3r1",
      season_id: "season_2026",
      zone_id: "zone_root",
    },
  } as const;
  const runtimeStartAuthority = {
    schema_version: "geox_mcft_cap09_production_runtime_start_authority_instance_v1",
    authority_id: "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-INSTANCE-V1",
    status: "AUTHORIZED",
    armed: true,
    authority_class: "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
    authority_ref: "GEOX-MCFT-CAP-09-TEST-RUNTIME-START-AUTHORITY-V1",
    deployment_subject_sha: runtimeStartExpected.deployment_subject_sha,
    scope: runtimeStartExpected.scope,
    activation_fence_time: "2026-09-03T17:30:00.000Z",
    formal_a0_authority_ref: "GEOX-MCFT-CAP-09-TEST-A0-AUTHORITY-V1",
    formal_a0_authority_sha256:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    live_activation_authority_ref:
      "GEOX-MCFT-CAP-09-TEST-LIVE-ACTIVATION-AUTHORITY-V1",
    live_activation_authority_sha256:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    current_crop_authority_ref:
      "qualification://mcft-cap09/phase5/process-boundary-current-crop-authority-v1",
    current_crop_authority_sha256:
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    biological_stage_architecture_effectiveness_ref:
      "qualification://mcft-cap09/phase5/process-boundary-stage-architecture-effectiveness-v1",
    biological_stage_architecture_effectiveness_sha256:
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
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
      runtimeStartExpected,
    ).formal_a0_logical_time,
    "2026-09-03T18:00:00.000Z",
  );
  assert.equal(
    parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      runtimeStartAuthority,
      "EVIDENCE_RUNTIME",
      runtimeStartExpected,
    ).activation_fence_time,
    "2026-09-03T17:30:00.000Z",
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      { ...runtimeStartAuthority, armed: false },
      "TWIN_RUNTIME",
      runtimeStartExpected,
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED/,
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      { ...runtimeStartAuthority, twin_runtime_start_authorized: false },
      "TWIN_RUNTIME",
      runtimeStartExpected,
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED/,
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      runtimeStartAuthority,
      "TWIN_RUNTIME",
      { ...runtimeStartExpected, deployment_subject_sha: "2".repeat(40) },
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_DEPLOYMENT_SUBJECT_MISMATCH/,
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      runtimeStartAuthority,
      "TWIN_RUNTIME",
      {
        ...runtimeStartExpected,
        scope: { ...runtimeStartExpected.scope, field_id: "field_other" },
      },
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_SCOPE_MISMATCH/,
  );
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      { ...runtimeStartAuthority, formal_a0_authority_sha256: "sha256:bad" },
      "TWIN_RUNTIME",
      runtimeStartExpected,
    ),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_AUTHORITY_DIGEST_REQUIRED/,
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
      expected: runtimeStartExpected,
      authority_path: mountedAuthorityPath,
      embedded_authority: { armed: false },
    }).formal_a0_logical_time,
    "2026-09-03T18:00:00.000Z",
  );

  const stageMountDir = path.resolve("acceptance-output/mcft-cap09-stage-mount-fixtures");
  fs.mkdirSync(stageMountDir, { recursive: true });
  const currentCropPath = path.join(stageMountDir, "current-crop-authority.json");
  const stageArchitecturePath = path.join(stageMountDir, "stage-architecture-effectiveness.json");
  fs.writeFileSync(currentCropPath, JSON.stringify({
    schema_version: "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status: "PASS",
    qualification_outcome: "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective: true,
    runtime_consumption_authorized: true,
  }, null, 2) + "\n");
  fs.writeFileSync(stageArchitecturePath, JSON.stringify({
    schema_version: "geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id: "DT02-AMENDMENT-03",
    status: "EFFECTIVE",
    effective: true,
  }, null, 2) + "\n");

  const mountedStageAuthority = loadMcftCap09ProductionStageAuthorityMountsV1({
    runtime_start_authority: {
      current_crop_authority_sha256: digestFile(currentCropPath),
      biological_stage_architecture_effectiveness_sha256: digestFile(stageArchitecturePath),
    },
    current_crop_authority_path: currentCropPath,
    biological_stage_architecture_effectiveness_path: stageArchitecturePath,
  });
  assert.equal(mountedStageAuthority.current_crop_authority.runtime_consumption_authorized, true);
  assert.equal(mountedStageAuthority.biological_stage_architecture_effectiveness.effective, true);

  assert.throws(
    () => loadMcftCap09ProductionStageAuthorityMountsV1({
      runtime_start_authority: {
        current_crop_authority_sha256: "sha256:" + "e".repeat(64),
        biological_stage_architecture_effectiveness_sha256: digestFile(stageArchitecturePath),
      },
      current_crop_authority_path: currentCropPath,
      biological_stage_architecture_effectiveness_path: stageArchitecturePath,
    }),
    /MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_DIGEST_MISMATCH/,
  );

  const candidateOnlyPath = path.join(stageMountDir, "current-crop-candidate-only.json");
  fs.writeFileSync(candidateOnlyPath, JSON.stringify({
    schema_version: "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status: "PASS",
    qualification_outcome: "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective: false,
    runtime_consumption_authorized: false,
  }, null, 2) + "\n");
  assert.throws(
    () => loadMcftCap09ProductionStageAuthorityMountsV1({
      runtime_start_authority: {
        current_crop_authority_sha256: digestFile(candidateOnlyPath),
        biological_stage_architecture_effectiveness_sha256: digestFile(stageArchitecturePath),
      },
      current_crop_authority_path: candidateOnlyPath,
      biological_stage_architecture_effectiveness_path: stageArchitecturePath,
    }),
    /MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE/,
  );

  const ineffectiveArchitecturePath = path.join(stageMountDir, "stage-architecture-candidate.json");
  fs.writeFileSync(ineffectiveArchitecturePath, JSON.stringify({
    schema_version: "geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id: "DT02-AMENDMENT-03",
    status: "CANDIDATE",
    effective: false,
  }, null, 2) + "\n");
  assert.throws(
    () => loadMcftCap09ProductionStageAuthorityMountsV1({
      runtime_start_authority: {
        current_crop_authority_sha256: digestFile(currentCropPath),
        biological_stage_architecture_effectiveness_sha256: digestFile(ineffectiveArchitecturePath),
      },
      current_crop_authority_path: currentCropPath,
      biological_stage_architecture_effectiveness_path: ineffectiveArchitecturePath,
    }),
    /MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_NOT_EFFECTIVE/,
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
  assert.equal(
    mcftCap09EvidenceLeaseKeepaliveIntervalMsV1(300),
    60_000,
    "PHASE5_EVIDENCE_300_SECOND_LEASE_RENEWS_AT_60_SECONDS",
  );
  assert.equal(
    mcftCap09EvidenceLeaseKeepaliveIntervalMsV1(1),
    333,
    "PHASE5_EVIDENCE_MINIMUM_LEASE_KEEPALIVE_INTERVAL_REQUIRED",
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

  const evidenceFailureClassifier = new McftCap09ProductionEvidenceFailureClassifierV1();
  assert.equal(
    evidenceFailureClassifier.classify(
      new Error(
        "PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:BLOCKED_HISTORICAL_DRIFT:HISTORICAL_DRIFT",
      ),
    ),
    "RETRYABLE",
    "PHASE5_EVIDENCE_KBS_HISTORICAL_DRIFT_MUST_FAIL_CLOSED_WITHOUT_PROCESS_FATAL",
  );
  for (const message of [
    "PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:BLOCKED_FORWARD_GAP:gap",
    "PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:BLOCKED_AMBIGUOUS_FORWARD:ambiguous",
  ]) {
    assert.equal(
      evidenceFailureClassifier.classify(new Error(message)),
      "FATAL",
      `PHASE5_EVIDENCE_KBS_NON_HISTORICAL_BLOCK_REMAINS_FATAL:${message}`,
    );
  }

  const evidenceRecoveryWithCode = Object.assign(
    new Error("the database system is in recovery mode"),
    { code: "57P03" },
  );
  assert.equal(
    evidenceFailureClassifier.classify(evidenceRecoveryWithCode),
    "RETRYABLE",
    "PHASE5_EVIDENCE_POSTGRES_CANNOT_CONNECT_NOW_MUST_RETRY",
  );
  assert.equal(
    evidenceFailureClassifier.classify(
      new Error("the database system is in recovery mode"),
    ),
    "RETRYABLE",
    "PHASE5_EVIDENCE_POSTGRES_RECOVERY_MESSAGE_MUST_RETRY",
  );

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
  const postgresRecoveryWithCode = Object.assign(
    new Error("the database system is in recovery mode"),
    { code: "57P03" },
  );
  assert.equal(
    twinFailureClassifier.classify(postgresRecoveryWithCode),
    "RETRYABLE",
    "PHASE5_TWIN_POSTGRES_CANNOT_CONNECT_NOW_MUST_RETRY",
  );
  assert.equal(
    twinFailureClassifier.classify(
      new Error("the database system is in recovery mode"),
    ),
    "RETRYABLE",
    "PHASE5_TWIN_POSTGRES_RECOVERY_MESSAGE_MUST_RETRY",
  );

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
  const twinV2Source = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts"),
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
      `${lifecycleSource}\n${twinSource}\n${twinV2Source}\n${evidenceSource}`.includes(forbidden),
      false,
      `PHASE5_PROCESS_TEST_ONLY_DEPENDENCY_FORBIDDEN:${forbidden}`,
    );
  }
  assert.equal(
    lifecycleSource.includes('case "SCHEDULER_LEASE_STANDBY":'),
    true,
    "PHASE5_TWIN_SCHEDULER_LEASE_STANDBY_WAIT_REQUIRED",
  );
  assert.equal(twinSource.includes("composeMcftCap09TwinRuntimeV1"), true);
  assert.equal(twinV2Source.includes("composeMcftCap09TwinRuntimeV2"), true);
  assert.equal(
    twinV2Source.includes("loadMcftCap09ProductionStageAuthorityMountsV1"),
    true,
  );
  assert.equal(
    twinV2Source.includes("ExternalFormalV4Am19WindowManifestV2"),
    true,
  );
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
  assert.equal(
    distWriter.includes('path.join("runtime", "mcft_cap09_twin_runtime_v2.js")'),
    true,
  );
  assert.equal(
    distWriter.includes("runMcftCap09TwinRuntimeProcessV2"),
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
    production_twin_process_uses_v2_stage_authority_composition: true,
    signal_stop_supported: true,
    evidence_graceful_current_fence_release: true,
    evidence_inflight_lease_keepalive_interval_for_300s_ms: 60_000,
    evidence_inflight_health_keepalive_same_cadence: true,
    evidence_kbs_historical_drift_fail_closed_nonfatal: true,
    evidence_kbs_forward_gap_remains_fatal: true,
    evidence_kbs_ambiguous_forward_remains_fatal: true,
    evidence_postgres_cannot_connect_now_retryable: true,
    evidence_postgres_recovery_message_retryable: true,
    twin_duplicate_coordination_contention_retryable: true,
    twin_postgres_cannot_connect_now_retryable: true,
    twin_postgres_recovery_message_retryable: true,
    twin_idle_pool_recovery_event_retryable: true,
    evidence_idle_pool_connection_termination_retryable: true,
    idle_pool_client_object_not_logged: true,
    idle_pool_nontransient_error_fail_closed: true,
    twin_v1_pool_guard_installed: true,
    twin_v2_pool_guard_installed: true,
    twin_qualification_pool_guard_installed: true,
    evidence_pool_guard_installed: true,
    twin_stale_fence_corruption_fatal: true,
    twin_scheduler_lease_standby_waits_without_fatal: true,
    stable_compiled_evidence_entrypoint: true,
    evidence_entrypoint_production_planner_bound: true,
    evidence_entrypoint_fail_closed_without_runtime_start_authority: true,
    twin_entrypoint_fail_closed_without_runtime_start_authority: true,
    shared_runtime_start_authority_parser: true,
    runtime_start_exact_deployment_subject_bound: true,
    runtime_start_exact_scope_bound: true,
    runtime_start_source_digest_fields_required: true,
    production_current_crop_authority_mount_digest_bound: true,
    production_current_crop_authority_must_be_effective: true,
    production_biological_stage_architecture_mount_digest_bound: true,
    production_biological_stage_architecture_must_be_effective: true,
    stale_runtime_start_authority_replay_fail_closed: true,
    mounted_runtime_start_authority_file_binding: true,
    frozen_production_service_identity_binding: true,
    per_instance_fenced_owner_identity: true,
    duplicate_service_instances_have_distinct_owner_identity: true,
    stable_compiled_twin_entrypoint: true,
    stable_compiled_twin_v2_entrypoint: true,
    production_twin_process_v2_stage_authority_bound: true,
    historical_twin_process_v1_preserved: true,
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
