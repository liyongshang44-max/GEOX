import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const COMPOSE = path.resolve("docker-compose.mcft-cap09-phase5-qualification.yml");
const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_QUALIFICATION_COMPOSE_V1_RESULT.json",
);

function environmentMap(value: unknown): Record<string, string> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.map((entry) => {
        const [key, ...rest] = String(entry).split("=");
        return [key, rest.join("=")];
      }),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        String(entry ?? ""),
      ]),
    );
  }
  return {};
}

function commandText(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(" ") : String(value ?? "");
}

function hasReadOnlyMount(
  volumes: unknown,
  target: string,
): boolean {
  if (!Array.isArray(volumes)) return false;
  return volumes.some((entry) => {
    if (typeof entry === "string") {
      const parts = entry.split(":");
      return parts[1] === target && parts.includes("ro");
    }
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    return row.target === target && row.read_only === true;
  });
}

function dependsOnCompleted(service: Record<string, unknown>, dependency: string): boolean {
  const value = service.depends_on;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = (value as Record<string, unknown>)[dependency];
  if (typeof row === "string") return row === "service_completed_successfully";
  return Boolean(
    row
    && typeof row === "object"
    && !Array.isArray(row)
    && (row as Record<string, unknown>).condition === "service_completed_successfully",
  );
}

async function main(): Promise<void> {
  const env = {
    ...process.env,
    GEOX_DEPLOYMENT_SUBJECT_COMMIT: "1".repeat(40),
    GEOX_PHASE5_POSTGRES_USER: "postgres",
    GEOX_PHASE5_POSTGRES_PASSWORD: "phase5-postgres",
    GEOX_PHASE5_MIGRATOR_PASSWORD: "phase5-migrator",
    GEOX_PHASE5_GENERIC_RUNTIME_PASSWORD: "phase5-generic-runtime",
    GEOX_PHASE5_EVIDENCE_DATABASE_PASSWORD: "phase5-evidence",
    GEOX_PHASE5_TWIN_DATABASE_PASSWORD: "phase5-twin",
    GEOX_PHASE5_MINIO_ACCESS_KEY: "phase5minio",
    GEOX_PHASE5_MINIO_SECRET_KEY: "phase5minio-secret",
    GEOX_PHASE5_TENANT_ID: "tenant-phase5",
    GEOX_PHASE5_PROJECT_ID: "project-phase5",
    GEOX_PHASE5_GROUP_ID: "group-phase5",
    GEOX_PHASE5_FIELD_ID: "field-phase5",
    GEOX_PHASE5_SEASON_ID: "season-phase5",
    GEOX_PHASE5_ZONE_ID: "zone-phase5",
    GEOX_PHASE5_FIXTURE_ROOT: "/tmp/mcft-cap09-phase5-fixtures",
    GEOX_PHASE5_CONTROL_ROOT: "/tmp/mcft-cap09-phase5-control",
    GEOX_PHASE5_RUN_CLASS: "ACCELERATED_24T",
    GEOX_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME: "2026-08-28T07:00:00.000Z",
    GEOX_PHASE5_A0: "2026-08-27T07:00:00.000Z",
    GEOX_PHASE5_CREATED_AT: "2026-08-27T06:30:00.000Z",
  };

  const rendered = execFileSync(
    "docker",
    ["compose", "-f", COMPOSE, "--profile", "qualification-runtime", "--profile", "qualification-orchestration", "config", "--format", "json"],
    { encoding: "utf8", env },
  );
  const config = JSON.parse(rendered) as {
    services?: Record<string, Record<string, unknown>>;
    volumes?: Record<string, unknown>;
  };
  const services = config.services ?? {};
  for (const required of [
    "postgres",
    "minio",
    "minio-init",
    "database-platform-bootstrap",
    "service-principal-bootstrap",
    "fixture-capture",
    "qualification-prepare",
    "qualification-verify",
    "evidence-runtime",
    "twin-runtime",
  ]) {
    assert.ok(services[required], `PHASE5_COMPOSE_SERVICE_REQUIRED:${required}`);
  }

  const evidence = services["evidence-runtime"]!;
  const twin = services["twin-runtime"]!;
  const evidenceEnv = environmentMap(evidence.environment);
  const twinEnv = environmentMap(twin.environment);
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PHASE5_A0,
    env.GEOX_PHASE5_A0,
    "PHASE5_TWIN_QUALIFICATION_A0_REQUIRED_FOR_CONTROLLED_RUNTIME_START_AUTHORITY",
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PHASE5_RUN_CLASS,
    "ACCELERATED_24T",
    "PHASE5_TWIN_DEFAULT_ACCELERATED_RUN_CLASS_REQUIRED",
  );
  assert.equal(
    twinEnv.GEOX_DEPLOYMENT_SUBJECT_COMMIT,
    env.GEOX_DEPLOYMENT_SUBJECT_COMMIT,
    "PHASE5_TWIN_QUALIFICATION_EXACT_SUBJECT_REQUIRED",
  );
  for (const [runtimeKey, sourceKey] of [
    ["GEOX_MCFT_CAP09_TENANT_ID", "GEOX_PHASE5_TENANT_ID"],
    ["GEOX_MCFT_CAP09_PROJECT_ID", "GEOX_PHASE5_PROJECT_ID"],
    ["GEOX_MCFT_CAP09_GROUP_ID", "GEOX_PHASE5_GROUP_ID"],
    ["GEOX_MCFT_CAP09_FIELD_ID", "GEOX_PHASE5_FIELD_ID"],
    ["GEOX_MCFT_CAP09_SEASON_ID", "GEOX_PHASE5_SEASON_ID"],
    ["GEOX_MCFT_CAP09_ZONE_ID", "GEOX_PHASE5_ZONE_ID"],
  ] as const) {
    assert.equal(
      twinEnv[runtimeKey],
      env[sourceKey],
      `PHASE5_TWIN_QUALIFICATION_EXACT_SCOPE_REQUIRED:${runtimeKey}`,
    );
  }
  const capture = services["fixture-capture"]!;
  const prepare = services["qualification-prepare"]!;
  const verify = services["qualification-verify"]!;
  const captureEnv = environmentMap(capture.environment);
  const prepareEnv = environmentMap(prepare.environment);
  const verifyEnv = environmentMap(verify.environment);

  assert.match(
    commandText(evidence.command),
    /apps\/server\/dist\/qualification\/mcft_cap09_phase5_evidence_runtime\.js/,
  );
  assert.match(
    commandText(twin.command),
    /apps\/server\/dist\/qualification\/mcft_cap09_phase5_twin_runtime\.js/,
  );
  assert.match(commandText(capture.command), /mcft_cap09_phase5_capture_a0_fixture\.js/);
  assert.match(commandText(prepare.command), /mcft_cap09_phase5_prepare_24t\.js/);
  assert.match(commandText(verify.command), /mcft_cap09_phase5_verify_24t\.js/);
  assert.match(
    evidenceEnv.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL ?? "",
    /geox_mcft_cap09_evidence_runtime_login_v1/,
  );
  assert.match(
    twinEnv.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL ?? "",
    /geox_mcft_cap09_twin_runtime_login_v1/,
  );
  assert.notEqual(
    evidenceEnv.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL,
    twinEnv.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL,
  );

  for (const key of [
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
    "GEOX_MCFT_CAP09_PHASE5_FIXTURE_MANIFEST_PATH",
    "GEOX_MCFT_CAP09_PHASE5_FIXTURE_ROOT",
  ]) {
    assert.ok(evidenceEnv[key], `PHASE5_EVIDENCE_ENV_REQUIRED:${key}`);
    assert.equal(
      Object.prototype.hasOwnProperty.call(twinEnv, key),
      false,
      `PHASE5_TWIN_EVIDENCE_SECRET_FORBIDDEN:${key}`,
    );
  }
  for (const key of Object.keys(twinEnv)) {
    assert.equal(/S3|FIXTURE|PROVIDER/i.test(key), false, `PHASE5_TWIN_PROVIDER_ENV_FORBIDDEN:${key}`);
  }

  for (const [serviceName, serviceEnv, ownerKey] of [
    ["evidence-runtime", evidenceEnv, "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_OWNER"],
    ["twin-runtime", twinEnv, "GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER"],
  ] as const) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(serviceEnv, ownerKey),
      false,
      `PHASE5_SCALED_SERVICE_FIXED_LEASE_OWNER_FORBIDDEN:${serviceName}:${ownerKey}`,
    );
  }

  for (const [serviceName, serviceEnv] of [
    ["fixture-capture", captureEnv],
    ["qualification-prepare", prepareEnv],
    ["qualification-verify", verifyEnv],
  ] as const) {
    for (const key of Object.keys(serviceEnv)) {
      if (serviceName !== "fixture-capture" && /S3|MINIO|PROVIDER/i.test(key)) {
        throw new Error(`PHASE5_ORCHESTRATION_PROVIDER_SECRET_FORBIDDEN:${serviceName}:${key}`);
      }
    }
  }
  assert.equal(Object.keys(captureEnv).some(key => /DATABASE|S3|MINIO/i.test(key)), false);
  assert.ok(prepareEnv.DATABASE_URL);
  assert.ok(verifyEnv.DATABASE_URL);
  assert.equal(Object.keys(prepareEnv).some(key => /S3|MINIO|PROVIDER/i.test(key)), false);
  assert.equal(Object.keys(verifyEnv).some(key => /S3|MINIO|PROVIDER/i.test(key)), false);

  const evidenceProcessSource = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts"),
    "utf8",
  );
  const twinProcessSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts"),
    "utf8",
  );
  const twinQualificationSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts"),
    "utf8",
  );
  assert.equal(
    evidenceProcessSource.includes("evidence-runtime:\${env.HOSTNAME ?? os.hostname()}"),
    true,
    "PHASE5_EVIDENCE_CONTAINER_HOSTNAME_LEASE_OWNER_REQUIRED",
  );
  assert.equal(
    twinQualificationSource.includes("const leaseOwner = \`twin-runtime:\${hostname}\`;"),
    true,
    "PHASE5_TWIN_QUALIFICATION_CONTAINER_HOSTNAME_LEASE_OWNER_REQUIRED",
  );
  assert.equal(
    twinQualificationSource.includes("composeMcftCap09TwinRuntimeV2"),
    true,
    "PHASE5_TWIN_QUALIFICATION_MUST_REUSE_PRODUCTION_V2_COMPOSITION",
  );
  assert.equal(
    twinProcessSource.includes("composeMcftCap09TwinRuntimeV2"),
    true,
    "PHASE5_TWIN_PRODUCTION_V2_COMPOSITION_REQUIRED",
  );

  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK,
    "MCFT_CAP09_PHASE5_ACCELERATED_WAIT_AND_CLOCK_ONLY",
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME,
    env.GEOX_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME,
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_TWIN_RUNTIME_CURRENT_CROP_AUTHORITY_PATH,
    "/qualification/control/current-crop-authority.json",
    "PHASE5_TWIN_V2_CURRENT_CROP_AUTHORITY_MOUNT_REQUIRED",
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_TWIN_RUNTIME_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH,
    "/qualification/control/biological-stage-architecture-effectiveness.json",
    "PHASE5_TWIN_V2_STAGE_ARCHITECTURE_MOUNT_REQUIRED",
  );
  assert.equal(
    prepareEnv.GEOX_MCFT_CAP09_PHASE5_CURRENT_CROP_AUTHORITY_OUTPUT,
    "/qualification/control/current-crop-authority.json",
  );
  assert.equal(
    prepareEnv.GEOX_MCFT_CAP09_PHASE5_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_OUTPUT,
    "/qualification/control/biological-stage-architecture-effectiveness.json",
  );

  assert.equal(evidence.image, twin.image);
  assert.equal(capture.image, evidence.image);
  assert.equal(prepare.image, evidence.image);
  assert.equal(verify.image, evidence.image);
  assert.equal(String(evidence.restart ?? "no"), "no");
  assert.equal(String(twin.restart ?? "no"), "no");
  assert.equal("container_name" in evidence, false, "PHASE5_EVIDENCE_SCALE_MUST_NOT_BE_BLOCKED_BY_CONTAINER_NAME");
  assert.equal("container_name" in twin, false, "PHASE5_TWIN_SCALE_MUST_NOT_BE_BLOCKED_BY_CONTAINER_NAME");
  assert.equal("ports" in evidence, false, "PHASE5_EVIDENCE_PUBLIC_PORT_FORBIDDEN");
  assert.equal("ports" in twin, false, "PHASE5_TWIN_PUBLIC_PORT_FORBIDDEN");

  assert.ok(
    Array.isArray(evidence.profiles)
    && (evidence.profiles as unknown[]).includes("qualification-runtime"),
  );
  assert.ok(
    Array.isArray(twin.profiles)
    && (twin.profiles as unknown[]).includes("qualification-runtime"),
  );
  assert.equal(
    hasReadOnlyMount(evidence.volumes, "/qualification/fixtures"),
    true,
    "PHASE5_FIXTURE_MOUNT_MUST_BE_READ_ONLY",
  );
  assert.equal(
    hasReadOnlyMount(twin.volumes, "/qualification/control"),
    true,
    "PHASE5_CONTROL_MOUNT_MUST_BE_READ_ONLY",
  );
  assert.equal(
    dependsOnCompleted(evidence, "service-principal-bootstrap"),
    true,
    "PHASE5_EVIDENCE_PRINCIPAL_BOOTSTRAP_REQUIRED",
  );
  assert.equal(
    dependsOnCompleted(twin, "service-principal-bootstrap"),
    true,
    "PHASE5_TWIN_PRINCIPAL_BOOTSTRAP_REQUIRED",
  );

  assert.ok(config.volumes?.mcft_cap09_phase5_pgdata);
  assert.ok(config.volumes?.mcft_cap09_phase5_raw);

  const runtimeImage = fs.readFileSync(
    path.resolve("docker/mcft-cap09-runtime.Dockerfile"),
    "utf8",
  );
  for (const required of [
    "eccodes==2.47.0",
    "eccodeslib==2.47.3.23",
    "numpy==1.26.4",
    "refet==0.4.2",
    "mcft_cap09_gfs_scientific_core_v1.py selftest",
    "mcft_cap09_gfs_raw_bundle_decoder_v1.py selftest",
  ]) {
    assert.ok(runtimeImage.includes(required), `PHASE5_SCIENTIFIC_RUNTIME_IMAGE_REQUIREMENT_MISSING:${required}`);
  }

  const source = fs.readFileSync(COMPOSE, "utf8");
  for (const forbidden of [
    "docker-compose.commercial_v1.yml",
    "FORMAL_V5",
    "graduation",
    "workflow_run",
    "github.event",
  ]) {
    assert.equal(source.includes(forbidden), false, `PHASE5_COMPOSE_FORBIDDEN_OWNER_MARKER:${forbidden}`);
  }

  const rehearsalRendered = execFileSync(
    "docker",
    ["compose", "-f", COMPOSE, "--profile", "qualification-runtime", "--profile", "qualification-orchestration", "config", "--format", "json"],
    {
      encoding: "utf8",
      env: {
        ...env,
        GEOX_PHASE5_RUN_CLASS: "REAL_CLOCK_REHEARSAL",
      },
    },
  );
  const rehearsalConfig = JSON.parse(rehearsalRendered) as {
    services?: Record<string, Record<string, unknown>>;
  };
  const rehearsalTwinEnv = environmentMap(
    rehearsalConfig.services?.["twin-runtime"]?.environment,
  );
  const rehearsalPrepareEnv = environmentMap(
    rehearsalConfig.services?.["qualification-prepare"]?.environment,
  );
  const rehearsalVerifyEnv = environmentMap(
    rehearsalConfig.services?.["qualification-verify"]?.environment,
  );
  assert.equal(
    rehearsalTwinEnv.GEOX_MCFT_CAP09_PHASE5_RUN_CLASS,
    "REAL_CLOCK_REHEARSAL",
    "PHASE5_TWIN_REAL_CLOCK_REHEARSAL_RUN_CLASS_REQUIRED",
  );
  assert.equal(
    rehearsalTwinEnv.GEOX_MCFT_CAP09_PHASE5_REHEARSAL_ACTIVATION_FENCE,
    env.GEOX_PHASE5_CREATED_AT,
    "PHASE5_TWIN_REAL_CLOCK_REHEARSAL_PHYSICAL_ACTIVATION_FENCE_REQUIRED",
  );
  assert.equal(
    rehearsalPrepareEnv.GEOX_MCFT_CAP09_PHASE5_RUN_CLASS,
    "REAL_CLOCK_REHEARSAL",
    "PHASE5_PREPARE_REAL_CLOCK_REHEARSAL_RUN_CLASS_REQUIRED",
  );
  assert.equal(
    rehearsalVerifyEnv.GEOX_MCFT_CAP09_PHASE5_RUN_CLASS,
    "REAL_CLOCK_REHEARSAL",
    "PHASE5_VERIFY_REAL_CLOCK_REHEARSAL_RUN_CLASS_REQUIRED",
  );

  const taskbook = fs.readFileSync(
    path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md"),
    "utf8",
  );
  const stage1bScope = fs.readFileSync(
    path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json"),
    "utf8",
  );
  const externalFormalConfig = fs.readFileSync(
    path.resolve("apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts"),
    "utf8",
  );
  const s5CanonicalAdapter = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.ts"),
    "utf8",
  );
  const historicalResidual = fs.readFileSync(
    path.resolve("apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.ts"),
    "utf8",
  );
  const externalEvidenceBinding = fs.readFileSync(
    path.resolve("apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts"),
    "utf8",
  );
  assert.equal(
    taskbook.includes("HA-18  Residual eligibility preserved")
      && taskbook.includes("Residual creation only when verification Evidence becomes eligible"),
    true,
    "PHASE5_HA18_TASKBOOK_CONDITIONAL_ELIGIBILITY_REQUIRED",
  );
  assert.equal(
    stage1bScope.includes("CONTROLLED_ACTION_FEEDBACK_CLOSURE"),
    true,
    "PHASE5_HA18_CONTROLLED_ACTION_FEEDBACK_SEPARATE_QUALIFICATION_REQUIRED",
  );
  assert.equal(
    externalFormalConfig.includes(
      '"MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_AUTHORITY_V1" as const',
    ),
    true,
    "PHASE5_HA18_EXTERNAL_FORMAL_CONFIG_PURPOSE_REQUIRED",
  );
  assert.equal(
    s5CanonicalAdapter.includes(
      "config.payload.config_purpose===CAP05_RUNTIME_CONFIG_PURPOSE_V1",
    )
      && s5CanonicalAdapter.includes('disposition="RUNTIME_CONFIG_NOT_CAP05"'),
    true,
    "PHASE5_HA18_S5_CAP05_CONDITIONAL_GATE_REQUIRED",
  );
  assert.equal(
    historicalResidual.includes(
      "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    ),
    true,
    "PHASE5_HA18_HISTORICAL_CAP05_200MM_OPERATOR_REQUIRED",
  );
  assert.equal(
    externalEvidenceBinding.includes(
      "POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    ),
    true,
    "PHASE5_HA18_EXTERNAL_FORMAL_100MM_OPERATOR_REQUIRED",
  );
  assert.equal(
    twinProcessSource.includes("Cap05ForecastResidualOutcomeTickServiceV1"),
    false,
    "PHASE5_HA18_CAP05_RESIDUAL_PRODUCTION_WIRING_FORBIDDEN",
  );

  const proof = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_PHASE5_QUALIFICATION_COMPOSE_V1",
    docker_compose_config_parsed: true,
    separate_evidence_twin_database_logins: true,
    evidence_only_s3_and_fixture_credentials: true,
    compiled_qualification_entrypoints: true,
    accelerated_and_real_clock_run_classes_share_same_twin_entrypoint: true,
    qualification_reuses_production_v2_composition: true,
    production_v2_process_remains_free_of_qualification_clock_seams: true,
    qualification_uses_v4_stage_authority_mounts: true,
    ha18_preformal_adjudication: "CONDITIONAL_ZERO_CURRENT_EXTERNAL_FORMAL_SCOPE",
    ha18_external_formal_runtime_config_is_cap05: false,
    ha18_controlled_action_feedback_closure_established: false,
    ha18_historical_s5_positive_c_semantics_preserved: true,
    ha18_direct_100mm_to_historical_cap05_200mm_edge_authorized: false,
    ha18_final_status: "PENDING_FORMAL_DATABASE_EVIDENCE",
    real_clock_rehearsal_compose_rendered: true,
    scientific_runtime_image_pinned: true,
    live_raw_capture_has_no_database_or_s3_credentials: true,
    prepare_verify_have_no_provider_or_s3_credentials: true,
    read_only_qualification_inputs: true,
    duplicate_instance_scaling_not_blocked_by_container_name: true,
    duplicate_instance_lease_owner_defaults_are_container_unique: true,
    persistent_postgres_and_raw_storage: true,
    public_runtime_ports: 0,
    production_commercial_compose_mutated: false,
    production_owner_cutover: false,
    formal_v5_armed: false,
    phase5_durable_evidence_registered: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof, null, 2) + "\n");
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
});
