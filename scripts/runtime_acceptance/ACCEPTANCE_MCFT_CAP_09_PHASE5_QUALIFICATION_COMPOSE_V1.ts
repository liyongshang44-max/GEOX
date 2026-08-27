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
    GEOX_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME: "2026-08-28T07:00:00.000Z",
  };

  const rendered = execFileSync(
    "docker",
    ["compose", "-f", COMPOSE, "config", "--format", "json"],
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
    "evidence-runtime",
    "twin-runtime",
  ]) {
    assert.ok(services[required], `PHASE5_COMPOSE_SERVICE_REQUIRED:${required}`);
  }

  const evidence = services["evidence-runtime"]!;
  const twin = services["twin-runtime"]!;
  const evidenceEnv = environmentMap(evidence.environment);
  const twinEnv = environmentMap(twin.environment);

  assert.match(
    commandText(evidence.command),
    /apps\/server\/dist\/qualification\/mcft_cap09_phase5_evidence_runtime\.js/,
  );
  assert.match(
    commandText(twin.command),
    /apps\/server\/dist\/qualification\/mcft_cap09_phase5_twin_runtime\.js/,
  );
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

  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK,
    "MCFT_CAP09_PHASE5_ACCELERATED_WAIT_AND_CLOCK_ONLY",
  );
  assert.equal(
    twinEnv.GEOX_MCFT_CAP09_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME,
    env.GEOX_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME,
  );

  assert.equal(evidence.image, twin.image);
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

  const proof = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_PHASE5_QUALIFICATION_COMPOSE_V1",
    docker_compose_config_parsed: true,
    separate_evidence_twin_database_logins: true,
    evidence_only_s3_and_fixture_credentials: true,
    compiled_qualification_entrypoints: true,
    read_only_qualification_inputs: true,
    duplicate_instance_scaling_not_blocked_by_container_name: true,
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
