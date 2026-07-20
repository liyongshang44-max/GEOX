// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S2_REPOSITORY.ts
// Purpose: prove the S2 one-shot migration, credential separation, ledger/checksum, xid8 trigger/backfill, Runtime preflight, schema preprovision boundary, historical visibility predicate, and exact resolvers.
// Boundary: isolated focused PostgreSQL only; no product route, frontend, canonical Runtime object, recommendation, activation, or CAP-08 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
  MCFT_CAP07_MIGRATOR_ROLE_V1,
  MCFT_CAP07_RUNTIME_ROLE_V1,
  runMcftCap07DatabasePlatformBootstrapV1,
} from "../../apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.js";
import {
  RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1,
  ensureRuntimeSchemaCompatibilityV1,
} from "../../apps/server/src/infra/runtime_schema_compatibility_bootstrap_v1.js";
import {
  MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1,
  runMcftCap07StartupMigrationRunnerV1,
} from "../../apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.js";
import { runMcftCap07RuntimeStartupPreflightV1 } from "../../apps/server/src/infra/mcft_cap07_runtime_startup_preflight_v1.js";
import { CanonicalFactVisibilityMetadataRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/canonical_fact_visibility_metadata_repository_v1.js";
import { PostgresFieldTwinSnapshotRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";
import {
  ActiveLineageAuthorityValidatorV1,
  CanonicalTwinFactResolverV1,
  DerivedCompositeValidatorV1,
  EvidenceBindingValidatorV1,
  RecordSetIdentityValidatorV1,
  ReplayEvidenceFactResolverV1,
  REQUIRED_CANONICAL_TWIN_FACT_TYPES_V1,
  REQUIRED_REPLAY_EVIDENCE_FACT_TYPES_V1,
  RuntimeHealthDualResolverV1,
  RuntimeHealthRoleResolverV1,
} from "../../apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.js";
import type { FieldTwinCanonicalObjectRefV1, FieldTwinScopeV1, SemanticHashTextV1 } from "../../apps/server/src/domain/field_twin_read_model/contracts_v1.js";
import { omitSemanticFieldsV1, semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S2_REPOSITORY_RESULT.json");
const ADMIN_URL = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
const MIGRATION_URL = String(process.env.GEOX_MIGRATION_DATABASE_URL || "").trim();
const RUNTIME_URL = String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim();
const MIGRATOR_PASSWORD = String(process.env.GEOX_MCFT_MIGRATOR_PASSWORD || "");
const RUNTIME_PASSWORD = String(process.env.GEOX_RUNTIME_DATABASE_PASSWORD || "");
const SUBJECT_COMMIT = String(process.env.MCFT_CANDIDATE_SHA || process.env.GITHUB_SHA || "").trim();
const assertions: Array<{ name: string; passed: boolean; details?: unknown }> = [];
const scope: FieldTwinScopeV1 = {
  tenant_id: "tenantA", project_id: "projectA", group_id: "groupA",
  field_id: "fieldA", season_id: "seasonA", zone_id: "zoneA",
};

function check(name: string, condition: unknown, details?: unknown): void {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  assert.equal(passed, true, name);
}

async function expectFailure(name: string, operation: () => Promise<unknown> | unknown, token: string): Promise<void> {
  let observed = "";
  try { await operation(); } catch (error) { observed = String(error instanceof Error ? error.message : error); }
  check(name, observed.includes(token), { observed, token });
}

function hash(value: unknown): SemanticHashTextV1 {
  return semanticHashV1(value) as SemanticHashTextV1;
}

function staticAudit(): void {
  const required = [
    "apps/server/db/migrations/2026_07_20_mcft_cap_07_fact_visibility_support.sql",
    "apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts",
    "apps/server/src/infra/runtime_schema_compatibility_bootstrap_v1.ts",
    "apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.ts",
    "apps/server/src/infra/mcft_cap07_runtime_startup_preflight_v1.ts",
    "apps/server/src/infra/database.ts",
    "apps/server/src/runtime/runtime_security_v1.ts",
    "apps/server/src/runtime/worker_runtime_heartbeat_v1.ts",
    "apps/executor/src/lib/worker_runtime_heartbeat.ts",
    "apps/server/src/repositories/field_twin_read_model/canonical_fact_visibility_metadata_repository_v1.ts",
    "apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.ts",
    "apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.ts",
    "docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json",
    "docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S2-DELIVERY-STATUS-V1.json",
    "docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S3-DELIVERY-STATUS-V1.json",
  ];
  for (const file of required) check(`file:${file}`, fs.existsSync(path.join(ROOT, file)));
  const bootstrap = fs.readFileSync(path.join(ROOT, "apps/server/src/bootstrap/server.ts"), "utf8");
  check("runtime_bootstrap_no_migration", !bootstrap.includes("runSqlMigrations("));
  check("runtime_bootstrap_has_preflight", bootstrap.includes("runMcftCap07RuntimeStartupPreflightV1"));
  const migration = fs.readFileSync(path.join(ROOT, required[0]), "utf8");
  for (const token of ["LOCK TABLE public.facts", "xid8", "pg_current_xact_id()", "SECURITY DEFINER", "SET search_path = pg_catalog", "AFTER INSERT ON public.facts"]) {
    check(`migration:${token}`, migration.includes(token));
  }
  check("raw_xmin_not_authority", !migration.includes("facts.xmin"));

  const compatibilityBootstrap = fs.readFileSync(path.join(ROOT, "apps/server/src/infra/runtime_schema_compatibility_bootstrap_v1.ts"), "utf8");
  for (const relation of RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1) {
    check(`compatibility_bootstrap:${relation}`, compatibilityBootstrap.includes(relation));
  }
  const runtimeDatabase = fs.readFileSync(path.join(ROOT, "apps/server/src/infra/database.ts"), "utf8");
  check("runtime_schema_guard_fail_closed", runtimeDatabase.includes("RUNTIME_DDL_FORBIDDEN") && runtimeDatabase.includes("RUNTIME_SCHEMA_PREPROVISION_REQUIRED"));
  const serverHeartbeat = fs.readFileSync(path.join(ROOT, "apps/server/src/runtime/worker_runtime_heartbeat_v1.ts"), "utf8");
  const executorHeartbeat = fs.readFileSync(path.join(ROOT, "apps/executor/src/lib/worker_runtime_heartbeat.ts"), "utf8");
  check("server_heartbeat_no_runtime_ddl", !serverHeartbeat.includes("CREATE TABLE") && !serverHeartbeat.includes("CREATE INDEX"));
  check("executor_heartbeat_no_runtime_ddl", !executorHeartbeat.includes("CREATE TABLE") && !executorHeartbeat.includes("CREATE INDEX"));

  const compose = fs.readFileSync(path.join(ROOT, "docker-compose.commercial_v1.yml"), "utf8");
  check("compose_one_shot_dependency", compose.includes("mcft-cap07-migration:") && compose.includes("condition: service_completed_successfully"));
  check("compose_roles_separate", compose.includes("geox_mcft_migrator_v1") && compose.includes("geox_runtime_v1"));
  const status = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S2-DELIVERY-STATUS-V1.json"), "utf8"));
  check("s2_candidate_signal", status.s2_candidate_implemented === true && status.effective_next_slice_when_attested === "S3");
}

async function prepareStore(admin: Pool): Promise<void> {
  await admin.query(`
    DROP TABLE IF EXISTS public.twin_fact_visibility_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_fact_visibility_epoch_v1 CASCADE;
    DROP TABLE IF EXISTS public.geox_schema_migration_ledger_v1 CASCADE;
    DROP FUNCTION IF EXISTS public.enforce_mcft_cap07_fact_visibility_v1() CASCADE;
    DROP FUNCTION IF EXISTS public.enforce_mcft_cap07_visibility_epoch_authority_v1() CASCADE;
    DROP FUNCTION IF EXISTS public.enforce_mcft_cap07_visibility_index_immutability_v1() CASCADE;
    DROP TABLE IF EXISTS public.worker_runtime_heartbeat_v1 CASCADE;
    DROP TABLE IF EXISTS public.jobs CASCADE;
    DROP TABLE IF EXISTS public.evidence_export_job_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.evidence_pack_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.derived_sensing_state_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.agronomy_inference_result_v1 CASCADE;
    DROP TABLE IF EXISTS public.agronomy_inference_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.agronomy_observation_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.field_season_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.facts CASCADE;
    CREATE TABLE public.facts (
      fact_id text PRIMARY KEY,
      occurred_at timestamptz NOT NULL,
      source text NOT NULL,
      record_json jsonb NOT NULL
    );
    INSERT INTO public.facts VALUES
      ('s2_baseline_001','2026-07-20T00:00:00.000Z','s2','{"type":"baseline_v1","payload":{"ordinal":1}}'),
      ('s2_baseline_002','2026-07-20T00:01:00.000Z','s2','{"type":"baseline_v1","payload":{"ordinal":2}}');
  `);
}

async function runtimePreflight(pool: Pool): Promise<Awaited<ReturnType<typeof runMcftCap07RuntimeStartupPreflightV1>>> {
  const migration = process.env.GEOX_MIGRATION_DATABASE_URL;
  const admin = process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL;
  delete process.env.GEOX_MIGRATION_DATABASE_URL;
  delete process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL;
  try { return await runMcftCap07RuntimeStartupPreflightV1(pool); }
  finally {
    if (migration == null) delete process.env.GEOX_MIGRATION_DATABASE_URL; else process.env.GEOX_MIGRATION_DATABASE_URL = migration;
    if (admin == null) delete process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL; else process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL = admin;
  }
}

async function withOwner<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: MIGRATION_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}`);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); await pool.end(); }
}

async function proveDatabase(): Promise<void> {
  check("database_urls_present", Boolean(ADMIN_URL && MIGRATION_URL && RUNTIME_URL));
  check("database_urls_distinct", new Set([ADMIN_URL, MIGRATION_URL, RUNTIME_URL]).size === 3);
  check("passwords_distinct", Boolean(MIGRATOR_PASSWORD && RUNTIME_PASSWORD) && MIGRATOR_PASSWORD !== RUNTIME_PASSWORD);
  check("subject_commit_exact", /^[0-9a-f]{40}$/i.test(SUBJECT_COMMIT));

  const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
  await prepareStore(admin);
  const bootstrap = await runMcftCap07DatabasePlatformBootstrapV1({
    admin_database_url: ADMIN_URL,
    migrator_password: MIGRATOR_PASSWORD,
    runtime_password: RUNTIME_PASSWORD,
    apply_legacy_migrations: false,
  });
  check("role_bootstrap_pass", bootstrap.status === "PASS");
  check("role_inventory_exact", bootstrap.roles_provisioned.join(",") === [MCFT_CAP07_MIGRATION_OWNER_ROLE_V1, MCFT_CAP07_MIGRATOR_ROLE_V1, MCFT_CAP07_RUNTIME_ROLE_V1].join(","));
  const compatibility = await ensureRuntimeSchemaCompatibilityV1(admin);
  check("runtime_schema_compatibility_bootstrap_pass", compatibility.status === "PASS" && compatibility.relations_preprovisioned.length === 9);

  const applied = await runMcftCap07StartupMigrationRunnerV1({ migration_database_url: MIGRATION_URL, subject_commit: SUBJECT_COMMIT });
  check("migration_applied", applied.status === "PASS" && applied.migration_action === "APPLIED");
  check("baseline_coverage", applied.fact_count === "2" && applied.visibility_row_count === "2");
  const rerun = await runMcftCap07StartupMigrationRunnerV1({ migration_database_url: MIGRATION_URL, subject_commit: SUBJECT_COMMIT });
  check("migration_rerun_exact", rerun.migration_action === "ALREADY_APPLIED_EXACT" && rerun.migration_checksum_sha256 === applied.migration_checksum_sha256);

  const runtime = new Pool({ connectionString: RUNTIME_URL, max: 4 });
  const preflight = await runtimePreflight(runtime);
  check("runtime_preflight_pass", preflight.status === "PASS" && preflight.active_epoch_id === MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1);
  check("runtime_schema_preprovisioned", preflight.runtime_schema_compatibility === "PREPROVISIONED" && preflight.runtime_schema_create_authority === "FORBIDDEN");
  await expectFailure("runtime_set_role_denied", () => runtime.query(`SET ROLE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}`), "permission denied");
  await expectFailure("runtime_schema_create_denied", () => runtime.query("CREATE TABLE public.s2_runtime_ddl_forbidden(id integer)"), "permission denied");
  await expectFailure("runtime_metadata_insert_denied", () => runtime.query(
    `INSERT INTO public.twin_fact_visibility_index_v1 VALUES ($1,$2,pg_catalog.pg_current_xact_id(),'FACT_INSERT_TRANSACTION')`,
    [MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1, "s2_baseline_001"],
  ), "permission denied");

  await runtime.query(
    `INSERT INTO public.worker_runtime_heartbeat_v1
      (worker_type, worker_id, runtime_instance_id, status, started_at, last_heartbeat_at, heartbeat_count, metadata_json, updated_at)
     VALUES ('jobs','s2-runtime-worker','s2-instance','STARTED',now(),now(),1,'{}'::jsonb,now())`,
  );
  check("runtime_compatibility_dml_allowed", Number((await runtime.query(
    "SELECT count(*)::int AS count FROM public.worker_runtime_heartbeat_v1 WHERE worker_id='s2-runtime-worker'",
  )).rows[0]?.count ?? 0) === 1);

  const visibility = new CanonicalFactVisibilityMetadataRepositoryV1();
  const oldClient = await runtime.connect();
  await oldClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const epoch = await visibility.resolveActiveEpochId(oldClient);
  const oldSnapshot = await visibility.resolveCurrentVisibilitySnapshot(oldClient, epoch);
  await runtime.query(`INSERT INTO public.facts VALUES ('s2_after_snapshot','2026-07-20T00:02:00.000Z','s2','{"type":"after_snapshot_v1","payload":{}}')`);
  const hidden = await visibility.readVisibleFactById({
    client: oldClient, visibility_epoch_id: epoch, pg_snapshot_token: oldSnapshot.pg_snapshot_token, fact_id: "s2_after_snapshot",
  });
  check("post_snapshot_fact_excluded", hidden === null);
  await oldClient.query("COMMIT");
  oldClient.release();

  const snapshots = new PostgresFieldTwinSnapshotRepositoryV1(runtime);
  const visible = await snapshots.withReadOnlyRequestSnapshot(scope, (context) => visibility.readVisibleFactById({
    client: context.client,
    visibility_epoch_id: context.canonical_visibility_snapshot.database_visibility_epoch_id,
    pg_snapshot_token: context.canonical_visibility_snapshot.pg_snapshot_token,
    fact_id: "s2_after_snapshot",
  }));
  check("fresh_snapshot_observes_fact", visible?.fact_id === "s2_after_snapshot" && visible.visibility_anchor_kind === "FACT_INSERT_TRANSACTION");

  await admin.query("ALTER TABLE public.facts DISABLE TRIGGER mcft_cap07_fact_visibility_after_insert_v1");
  await admin.query(`INSERT INTO public.facts VALUES ('s2_missing_metadata','2026-07-20T00:03:00.000Z','s2','{"type":"missing_v1","payload":{}}')`);
  await admin.query("ALTER TABLE public.facts ENABLE TRIGGER mcft_cap07_fact_visibility_after_insert_v1");
  await expectFailure("missing_visibility_fails_preflight", () => runtimePreflight(runtime), "MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT");
  await withOwner((client) => client.query(
    `INSERT INTO public.twin_fact_visibility_index_v1 VALUES ($1,'s2_missing_metadata',pg_catalog.pg_current_xact_id(),'EPOCH_ROTATION_TRANSACTION')`,
    [MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1],
  ));
  check("preflight_recovers", (await runtimePreflight(runtime)).status === "PASS");
  await runtime.end();
  await admin.end();
}

async function proveResolvers(): Promise<void> {
  const base = {
    object_id: "attempt-1", scope, lineage_id: "lineage-1", revision_id: "revision-1",
    logical_time: "2026-07-20T00:00:00.000Z", as_of: "2026-07-20T00:00:00.000Z",
    payload: { operation_id: "operation-1", status: "FAILED" },
  };
  const determinismHash = hash(omitSemanticFieldsV1(base, ["determinism_hash", "fact_id", "created_at", "persisted_at"]));
  const canonical = { ...base, determinism_hash: determinismHash };
  const canonicalResolver = new CanonicalTwinFactResolverV1();
  check("canonical_resolver_exact", canonicalResolver.resolve({
    fact_id: "fact-1", record_json: { type: "twin_runtime_attempt_v1", payload: canonical },
    expected_type: "twin_runtime_attempt_v1", expected_object_ref: "attempt-1", expected_scope: scope,
  }).object_hash === determinismHash);
  await expectFailure("canonical_hash_required", () => canonicalResolver.resolve({
    fact_id: "fact-1", record_json: { type: "twin_runtime_attempt_v1", payload: base },
    expected_type: "twin_runtime_attempt_v1", expected_object_ref: "attempt-1", expected_scope: scope,
  }), "DETERMINISM_HASH_REQUIRED");

  const replayResolver = new ReplayEvidenceFactResolverV1();
  for (const [index, recordType] of REQUIRED_REPLAY_EVIDENCE_FACT_TYPES_V1.entries()) {
    const sourcePayload = { ordinal: index + 1, exact: true };
    const semantic: Record<string, unknown> = {
      record_type: recordType, ...scope, source_record_id: `source-${index}`,
      evidence_identity_key: `identity-${index}`, available_to_runtime_at: "2026-07-20T00:10:00.000Z",
      source_payload: sourcePayload, canonical_payload: sourcePayload,
    };
    const sourceHash = hash(semantic);
    check(`replay:${recordType}`, replayResolver.resolve({
      fact_id: `evidence-${index}`, record_json: { type: recordType, payload: { ...semantic, source_record_hash: sourceHash } }, expected_type: recordType,
    }).source_record_hash === sourceHash);
  }

  const members: FieldTwinCanonicalObjectRefV1[] = [
    { object_ref: "attempt-1", object_type: "twin_runtime_attempt_v1", object_hash: determinismHash, source_fact_ref: "fact-1" },
  ];
  const aggregateHash = hash({ record_set_id: "record-set-1", identity_kind: "A0_RECORD_SET", members: [{ object_ref: "attempt-1", object_hash: determinismHash }] });
  check("record_set_exact", new RecordSetIdentityValidatorV1().validate({
    record_set_id: "record-set-1", identity_kind: "A0_RECORD_SET", declared_member_refs: members,
    actual_member_refs: members, aggregate_determinism_hash: aggregateHash,
  }).validation_status === "PASS");
  new ActiveLineageAuthorityValidatorV1().validateInitial({
    active_lineage_ref: "lineage-1", activation_authority_ref: "lineage-1", lineage_object_ref: "lineage-1",
    lineage_kind: "INITIAL", expected_previous_active_lineage: null,
  });
  check("active_lineage_exact", true);
  check("evidence_binding_exact", new EvidenceBindingValidatorV1().validate({
    declared_refs: [{ ref_type: "FACT", ref_value: "fact-1" }], resolved_refs: [{ ref_type: "FACT", ref_value: "fact-1" }],
    scope, resolved_scope: scope,
  }).length === 1);
  const compositeHash = hash({ exact_refs: members, canonical_composite_payload: { status: "EXACT" } });
  check("derived_composite_exact", new DerivedCompositeValidatorV1().validate({
    exact_refs: members, canonical_composite_payload: { status: "EXACT" }, declared_projection_hash: compositeHash,
  }) === compositeHash);
  const health = new RuntimeHealthRoleResolverV1();
  const terminal = health.resolve({
    health_object_ref: "health-a", record_set_membership: { record_set_id: "record-set-1", member_refs: ["health-a"] }, operational_attempt_relation: null,
  });
  const operational = health.resolve({
    health_object_ref: "health-f", record_set_membership: null,
    operational_attempt_relation: { attempt_ref: "attempt-1", health_ref: "health-f", forecast_failure_ref: "failure-1" },
  });
  check("health_dual_exact", new RuntimeHealthDualResolverV1().resolve({
    terminal_record_set_health: terminal, latest_operational_runtime_health: operational,
  }).relationship === "DISTINCT_OBJECTS");
}

async function main(): Promise<void> {
  try {
    staticAudit();
    await proveDatabase();
    await proveResolvers();
    const result = {
      status: "PASS",
      acceptance: "MCFT_CAP_07_S2_REPOSITORY",
      assertion_count: assertions.length,
      failed_assertion_count: assertions.filter((item) => !item.passed).length,
      canonical_fact_type_count: REQUIRED_CANONICAL_TWIN_FACT_TYPES_V1.length,
      replay_evidence_fact_type_count: REQUIRED_REPLAY_EVIDENCE_FACT_TYPES_V1.length,
      runtime_schema_compatibility_relation_count: RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1.length,
      runtime_schema_create_authority: "FORBIDDEN",
      runtime_authority_delta: "READ_ONLY_REPOSITORY_AND_EXACT_RESOLVERS_ONLY",
      canonical_write_authority_delta: "ZERO",
      route_implementation_performed: false,
      frontend_implementation_performed: false,
      cap_08_authorized: false,
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: "FAIL",
      acceptance: "MCFT_CAP_07_S2_REPOSITORY",
      error: String(error instanceof Error ? error.stack || error.message : error),
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

void main();
