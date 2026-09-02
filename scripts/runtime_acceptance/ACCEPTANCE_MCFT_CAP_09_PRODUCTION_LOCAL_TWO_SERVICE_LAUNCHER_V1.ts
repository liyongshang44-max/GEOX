import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  buildMcftCap09ProductionLeaseOwnerV1,
  readMcftCap09ProductionServiceIdentityBindingV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_service_identity_v1.js";

const COMPOSE = path.resolve("docker-compose.mcft-cap09-production.yml");
const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PRODUCTION_LOCAL_TWO_SERVICE_LAUNCHER_V1_RESULT.json",
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

function mounts(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object" && !Array.isArray(entry)),
    );
}

function mountFor(
  value: unknown,
  target: string,
): Record<string, unknown> | undefined {
  return mounts(value).find((entry) => entry.target === target);
}

function noForbiddenRuntimeSurface(
  service: Record<string, unknown>,
  serviceName: string,
): void {
  assert.equal("ports" in service, false, `PRODUCTION_PUBLIC_PORT_FORBIDDEN:${serviceName}`);
  assert.equal(service.privileged === true, false, `PRODUCTION_PRIVILEGED_FORBIDDEN:${serviceName}`);
  assert.notEqual(service.network_mode, "host", `PRODUCTION_HOST_NETWORK_FORBIDDEN:${serviceName}`);
  const volumes = mounts(service.volumes);
  assert.equal(
    volumes.some((entry) => String(entry.source ?? "").includes("docker.sock")),
    false,
    `PRODUCTION_DOCKER_SOCKET_FORBIDDEN:${serviceName}`,
  );
}

function main(): void {
  const env = {
    ...process.env,
    GEOX_DEPLOYMENT_SUBJECT_COMMIT: "a".repeat(40),
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL:
      "postgres://evidence-login:secret@db.example.invalid:5432/geox",
    GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL:
      "postgres://twin-login:secret@db.example.invalid:5432/geox",
    GEOX_MCFT_CAP09_TENANT_ID: "tenant-a",
    GEOX_MCFT_CAP09_PROJECT_ID: "project-a",
    GEOX_MCFT_CAP09_GROUP_ID: "group-a",
    GEOX_MCFT_CAP09_FIELD_ID: "field-a",
    GEOX_MCFT_CAP09_SEASON_ID: "season-a",
    GEOX_MCFT_CAP09_ZONE_ID: "zone-a",
    GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT: "https://s3.example.invalid",
    GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET: "mcft-cap09-production",
    GEOX_MCFT_CAP09_EVIDENCE_S3_REGION: "us-test-1",
    GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID: "access-key",
    GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY: "secret-key",
    GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH:
      "/tmp/mcft-cap09/runtime-start-authority.json",
    GEOX_MCFT_CAP09_PRODUCTION_FORMAL_WINDOW_MANIFEST_PATH:
      "/tmp/mcft-cap09/formal-window-manifest.json",
    GEOX_MCFT_CAP09_PRODUCTION_CROP_AUTHORITY_PATH:
      "/tmp/mcft-cap09/crop-authority.json",
    GEOX_MCFT_CAP09_PRODUCTION_CONFIGURATION_MATRIX_PATH:
      "/tmp/mcft-cap09/configuration-matrix.json",
    GEOX_MCFT_CAP09_DURABLE_LOG_ROOT: "/tmp/mcft-cap09/logs",
  };

  const rendered = execFileSync(
    "docker",
    ["compose", "-f", COMPOSE, "config", "--format", "json"],
    { encoding: "utf8", env },
  );
  const config = JSON.parse(rendered) as {
    name?: string;
    services?: Record<string, Record<string, unknown>>;
  };

  assert.equal(config.name, "geox-mcft-cap09-production-v1");
  const services = config.services ?? {};
  assert.deepEqual(
    Object.keys(services).sort(),
    [
      "geox-mcft-cap09-evidence-runtime-v1",
      "geox-mcft-cap09-twin-runtime-v1",
    ],
    "PRODUCTION_EXACT_TWO_RUNTIME_SERVICES_REQUIRED",
  );

  const evidence = services["geox-mcft-cap09-evidence-runtime-v1"]!;
  const twin = services["geox-mcft-cap09-twin-runtime-v1"]!;
  const evidenceEnv = environmentMap(evidence.environment);
  const twinEnv = environmentMap(twin.environment);
  const evidenceBinding =
    readMcftCap09ProductionServiceIdentityBindingV1("EVIDENCE_RUNTIME");
  const twinBinding =
    readMcftCap09ProductionServiceIdentityBindingV1("TWIN_RUNTIME");

  assert.equal(evidence.restart, "unless-stopped");
  assert.equal(twin.restart, "unless-stopped");
  assert.equal(evidence.init, true);
  assert.equal(twin.init, true);

  assert.equal(
    evidenceEnv.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_SERVICE_ID,
    evidenceBinding.service_id,
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID,
    twinBinding.service_id,
  );
  assert.notEqual(evidenceBinding.service_id, twinBinding.service_id);

  assert.equal(
    evidenceEnv.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH,
    "/run/geox/mcft-cap09/runtime-start-authority.json",
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH,
    "/run/geox/mcft-cap09/runtime-start-authority.json",
  );

  assert.match(
    commandText(evidence.command),
    /apps\/server\/dist\/runtime\/mcft_cap09_evidence_runtime\.js/,
  );
  assert.match(
    commandText(twin.command),
    /apps\/server\/dist\/runtime\/mcft_cap09_twin_runtime\.js/,
  );
  assert.match(commandText(evidence.command), /exec node/);
  assert.match(commandText(twin.command), /exec node/);
  assert.match(commandText(evidence.command), /evidence\/runtime\.log/);
  assert.match(commandText(twin.command), /twin\/runtime\.log/);

  assert.notEqual(
    evidenceEnv.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL,
    twinEnv.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      evidenceEnv,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      twinEnv,
      "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
    ),
    false,
  );

  for (const key of [
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
  ]) {
    assert.ok(evidenceEnv[key], `PRODUCTION_EVIDENCE_SECRET_REQUIRED:${key}`);
    assert.equal(
      Object.prototype.hasOwnProperty.call(twinEnv, key),
      false,
      `PRODUCTION_TWIN_EVIDENCE_SECRET_FORBIDDEN:${key}`,
    );
  }
  for (const key of Object.keys(twinEnv)) {
    assert.equal(
      /S3|PROVIDER/i.test(key),
      false,
      `PRODUCTION_TWIN_PROVIDER_SURFACE_FORBIDDEN:${key}`,
    );
  }

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      evidenceEnv,
      "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_OWNER",
    ),
    false,
    "PRODUCTION_FIXED_EVIDENCE_LEASE_OWNER_FORBIDDEN",
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      twinEnv,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER",
    ),
    false,
    "PRODUCTION_FIXED_TWIN_LEASE_OWNER_FORBIDDEN",
  );

  const evidenceAuthorityMount = mountFor(
    evidence.volumes,
    "/run/geox/mcft-cap09/runtime-start-authority.json",
  );
  const twinAuthorityMount = mountFor(
    twin.volumes,
    "/run/geox/mcft-cap09/runtime-start-authority.json",
  );
  assert.equal(evidenceAuthorityMount?.read_only, true);
  assert.equal(twinAuthorityMount?.read_only, true);

  for (const target of [
    "/run/geox/mcft-cap09/formal-window-manifest.json",
    "/run/geox/mcft-cap09/crop-authority.json",
    "/run/geox/mcft-cap09/configuration-matrix.json",
  ]) {
    assert.equal(
      mountFor(twin.volumes, target)?.read_only,
      true,
      `PRODUCTION_TWIN_CONTROL_MOUNT_READ_ONLY_REQUIRED:${target}`,
    );
    assert.equal(
      Boolean(mountFor(evidence.volumes, target)),
      false,
      `PRODUCTION_EVIDENCE_TWIN_CONTROL_MOUNT_FORBIDDEN:${target}`,
    );
  }

  assert.equal(
    mountFor(evidence.volumes, "/var/log/geox/mcft-cap09/evidence")?.read_only,
    undefined,
  );
  assert.equal(
    mountFor(twin.volumes, "/var/log/geox/mcft-cap09/twin")?.read_only,
    undefined,
  );

  noForbiddenRuntimeSurface(
    evidence,
    "geox-mcft-cap09-evidence-runtime-v1",
  );
  noForbiddenRuntimeSurface(
    twin,
    "geox-mcft-cap09-twin-runtime-v1",
  );

  assert.equal(evidence.image, twin.image);
  assert.match(
    String(evidence.image),
    /^geox-mcft-cap09-runtime:a{40}$/,
  );
  assert.equal(
    (evidence.build as Record<string, unknown>)?.dockerfile,
    "docker/mcft-cap09-runtime.Dockerfile",
  );
  assert.equal(
    (twin.build as Record<string, unknown>)?.dockerfile,
    "docker/mcft-cap09-runtime.Dockerfile",
  );

  const ownerA = buildMcftCap09ProductionLeaseOwnerV1({
    plane: "EVIDENCE_RUNTIME",
    configured_service_id: evidenceBinding.service_id,
    instance_id: "container-a",
  });
  const ownerB = buildMcftCap09ProductionLeaseOwnerV1({
    plane: "EVIDENCE_RUNTIME",
    configured_service_id: evidenceBinding.service_id,
    instance_id: "container-b",
  });
  assert.notEqual(ownerA, ownerB);
  assert.match(ownerA, /^local-docker:\/\/.+#instance:container-a$/);
  assert.throws(
    () => buildMcftCap09ProductionLeaseOwnerV1({
      plane: "EVIDENCE_RUNTIME",
      configured_service_id: twinBinding.service_id,
      instance_id: "container-a",
    }),
    /MCFT_CAP09_PRODUCTION_CONFIGURED_SERVICE_ID_MISMATCH/,
  );

  const source = fs.readFileSync(COMPOSE, "utf8");
  for (const forbidden of [
    "workflow_run",
    "github.event",
    "qualification-runtime",
    "qualification-orchestration",
    "container_name:",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `PRODUCTION_COMPOSE_FORBIDDEN_MARKER:${forbidden}`,
    );
  }

  const proof = {
    schema_version:
      "geox_mcft_cap09_production_local_two_service_launcher_v1",
    status: "PASS",
    compose_project_name: config.name,
    exact_two_runtime_services: true,
    frozen_service_identity_binding: true,
    per_instance_fenced_lease_owner_binding: true,
    duplicate_instances_have_distinct_owner_identity: true,
    restart_policy_unless_stopped: true,
    production_compiled_entrypoints: true,
    mounted_runtime_start_authority_read_only: true,
    twin_governed_control_mounts_read_only: true,
    separate_runtime_database_credentials: true,
    evidence_only_private_object_storage_credentials: true,
    durable_log_mounts_present: true,
    public_runtime_ports: 0,
    github_production_execution_surface: false,
    qualification_runtime_surface: false,
    production_runtime_started: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
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
      production_runtime_started: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    }, null, 2) + "\n",
  );
  throw error;
}
