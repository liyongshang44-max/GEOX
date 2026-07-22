import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  MCFT_CAP08_RELATION_PRIVILEGES_V1,
  MCFT_CAP08_RUNNER_ROLE_V1,
  runMcftCap08DatabasePlatformBootstrapV1,
} from "../../apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.js";
import { runMcftCap07DatabasePlatformBootstrapV1 } from "../../apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.js";
import { runMcftCap07StartupMigrationRunnerV1 } from "../../apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.js";

const { Client, Pool } = pg;
const rootUrl = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const databaseName = String(process.env.MCFT_CAP08_TARGET_DATABASE_NAME || "geox_mcft_cap08_s0_acceptance");
const runnerPassword = String(process.env.MCFT_CAP08_RUNNER_PASSWORD || "cap08-local-runner-password");
const migratorPassword = String(process.env.MCFT_CAP08_MIGRATOR_PASSWORD || "cap08-local-migrator-password");
const runtimePassword = String(process.env.MCFT_CAP08_LEGACY_RUNTIME_PASSWORD || "cap08-local-legacy-runtime-password");
const subjectCommit = String(process.env.MCFT_CANDIDATE_SHA || "").trim();
const outputPath = "acceptance-output/MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB_RESULT.json";

function output(value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}
function hash(value: unknown): string { return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }
function databaseUrl(name: string): string { const url = new URL(rootUrl); url.pathname = `/${name}`; return url.toString(); }
function quoteIdentifier(value: string): string { if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("DATABASE_NAME_INVALID"); return `"${value}"`; }

async function recreateDatabase(): Promise<void> {
  const client = new Client({ connectionString: rootUrl });
  await client.connect();
  try {
    await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [databaseName]);
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  } finally { await client.end(); }
}

async function applySqlDirectory(pool: Pool, directory: string): Promise<Array<{ file: string; sha256: string }>> {
  const absolute = path.resolve(directory);
  const files = fs.readdirSync(absolute).filter((name) => name.endsWith(".sql")).sort();
  if (!files.length) throw new Error(`SQL_DIRECTORY_EMPTY:${directory}`);
  const applied: Array<{ file: string; sha256: string }> = [];
  for (const name of files) {
    const bytes = fs.readFileSync(path.join(absolute, name));
    const sql = bytes.toString("utf8").replace(/^\uFEFF/, "");
    if (sql.trim()) await pool.query(sql);
    applied.push({ file: name, sha256: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}` });
  }
  return applied;
}

function roleDatabaseUrl(name: string, role: string, passwordValue: string): string {
  const url = new URL(rootUrl);
  url.pathname = `/${name}`;
  url.username = role;
  url.password = passwordValue;
  return url.toString();
}

async function structureProjection(pool: Pool): Promise<unknown[]> {
  const result = await pool.query(`
    WITH relations AS (
      SELECT n.nspname AS schema_name,c.relname AS object_name,c.relkind AS object_kind
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
    ), columns AS (
      SELECT table_schema AS schema_name,table_name AS object_name,ordinal_position,column_name,data_type,udt_name,is_nullable,column_default
        FROM information_schema.columns WHERE table_schema='public'
    ), constraints AS (
      SELECT n.nspname AS schema_name,c.relname AS object_name,con.conname,pg_get_constraintdef(con.oid,true) AS definition
        FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    ), indexes AS (
      SELECT schemaname AS schema_name,tablename AS object_name,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    ), functions AS (
      SELECT n.nspname AS schema_name,p.proname AS object_name,pg_get_function_identity_arguments(p.oid) AS identity_arguments,pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    ), triggers AS (
      SELECT n.nspname AS schema_name,c.relname AS object_name,t.tgname,pg_get_triggerdef(t.oid,true) AS definition
        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    )
    SELECT * FROM (
      SELECT 'RELATION' kind,to_jsonb(relations) value FROM relations
      UNION ALL SELECT 'COLUMN',to_jsonb(columns) FROM columns
      UNION ALL SELECT 'CONSTRAINT',to_jsonb(constraints) FROM constraints
      UNION ALL SELECT 'INDEX',to_jsonb(indexes) FROM indexes
      UNION ALL SELECT 'FUNCTION',to_jsonb(functions) FROM functions
      UNION ALL SELECT 'TRIGGER',to_jsonb(triggers) FROM triggers
    ) x ORDER BY kind,value::text
  `);
  return result.rows;
}

async function relationCounts(pool: Pool): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const relation of Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1)) {
    result[relation] = Number((await pool.query(`SELECT count(*)::int AS n FROM public.${relation}`)).rows[0].n);
  }
  return result;
}

async function effectiveGraph(pool: Pool): Promise<unknown> {
  const role = (await pool.query(`SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1`, [MCFT_CAP08_RUNNER_ROLE_V1])).rows[0];
  if (!role) throw new Error("RUNNER_ROLE_MISSING");
  const databasePrivileges = Object.fromEntries(await Promise.all(["CONNECT","CREATE","TEMP"].map(async (privilege) => [privilege, (await pool.query(`SELECT has_database_privilege($1,current_database(),$2) AS ok`, [MCFT_CAP08_RUNNER_ROLE_V1, privilege])).rows[0].ok])));
  const publicDatabasePrivilegeRows = await pool.query(`
    SELECT a.privilege_type::text AS privilege_type
      FROM pg_database d
      CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
     WHERE d.datname = current_database()
       AND a.grantee = 0
  `);
  const publicDatabasePrivilegeSet = new Set(publicDatabasePrivilegeRows.rows.map((row) => String(row.privilege_type)));
  const publicDatabasePrivileges = Object.fromEntries(
    ["CONNECT", "CREATE", "TEMP"].map((privilege) => [privilege, publicDatabasePrivilegeSet.has(privilege)]),
  );
  const schemaPrivileges = Object.fromEntries(await Promise.all(["USAGE", "CREATE"].map(async (privilege) => [
    privilege,
    (await pool.query(`SELECT has_schema_privilege($1,'public',$2) AS ok`, [MCFT_CAP08_RUNNER_ROLE_V1, privilege])).rows[0].ok,
  ])));
  const publicSchemaPrivilegeRows = await pool.query(`
    SELECT a.privilege_type::text AS privilege_type
      FROM pg_namespace n
      CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
     WHERE n.nspname = 'public'
       AND a.grantee = 0
  `);
  const publicSchemaPrivilegeSet = new Set(publicSchemaPrivilegeRows.rows.map((row) => String(row.privilege_type)));
  const publicSchemaPrivileges = Object.fromEntries(
    ["USAGE", "CREATE"].map((privilege) => [privilege, publicSchemaPrivilegeSet.has(privilege)]),
  );
  const tablePrivileges: Record<string, string[]> = {};
  for (const relation of Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1)) {
    const allowed: string[] = [];
    for (const privilege of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER"]) {
      if ((await pool.query(`SELECT has_table_privilege($1,$2,$3) AS ok`, [MCFT_CAP08_RUNNER_ROLE_V1, `public.${relation}`, privilege])).rows[0].ok) allowed.push(privilege);
    }
    tablePrivileges[relation] = allowed;
  }
  const membership = (await pool.query(`SELECT count(*)::int AS n FROM pg_auth_members WHERE member=$1 OR roleid=$1`, [role.oid])).rows[0].n;
  const ownership = (await pool.query(`SELECT ((SELECT count(*) FROM pg_database WHERE datdba=$1)+(SELECT count(*) FROM pg_namespace WHERE nspowner=$1)+(SELECT count(*) FROM pg_class WHERE relowner=$1)+(SELECT count(*) FROM pg_proc WHERE proowner=$1))::int AS n`, [role.oid])).rows[0].n;
  const sequencePrivilegeCount = (await pool.query(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' AND (has_sequence_privilege($1,c.oid,'USAGE') OR has_sequence_privilege($1,c.oid,'SELECT') OR has_sequence_privilege($1,c.oid,'UPDATE'))`, [MCFT_CAP08_RUNNER_ROLE_V1])).rows[0].n;
  const functionExecuteCount = (await pool.query(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND has_function_privilege($1,p.oid,'EXECUTE')`, [MCFT_CAP08_RUNNER_ROLE_V1])).rows[0].n;
  const publicFunctionExecuteCount = (await pool.query(`
    SELECT count(*)::int AS n
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
     WHERE n.nspname = 'public'
       AND a.grantee = 0
       AND a.privilege_type = 'EXECUTE'
  `)).rows[0].n;
  const defaultAclCount = (await pool.query(`
    SELECT count(*)::int AS n
      FROM pg_default_acl d
      CROSS JOIN LATERAL aclexplode(COALESCE(d.defaclacl,acldefault(d.defaclobjtype,d.defaclrole))) a
      LEFT JOIN pg_roles r ON r.oid=a.grantee
     WHERE a.grantee=0 OR r.rolname = ANY($1::text[])
  `, [[MCFT_CAP08_RUNNER_ROLE_V1, "geox_mcft_migrator_v1", "geox_runtime_v1"]])).rows[0].n;
  const alternateConnectRoles = (await pool.query(`
    SELECT rolname
      FROM pg_roles
     WHERE rolcanlogin
       AND NOT rolsuper
       AND rolname <> $1
       AND has_database_privilege(rolname,current_database(),'CONNECT')
     ORDER BY rolname
  `, [MCFT_CAP08_RUNNER_ROLE_V1])).rows.map((row) => String(row.rolname));
  return { role, databasePrivileges, publicDatabasePrivileges, schemaPrivileges, publicSchemaPrivileges, tablePrivileges, membership, ownership, sequencePrivilegeCount, functionExecuteCount, publicFunctionExecuteCount, defaultAclCount, alternateConnectRoles };
}

async function main(): Promise<void> {
  await recreateDatabase();
  const targetUrl = databaseUrl(databaseName);
  const pool = new Pool({ connectionString: targetUrl, max: 1 });
  try {
    if (!/^[0-9a-f]{40}$/.test(subjectCommit)) throw new Error("MCFT_CAP08_CANDIDATE_SHA_REQUIRED");
    const initFiles = await applySqlDirectory(pool, "docker/postgres/init");
    const cap07PlatformBootstrap = await runMcftCap07DatabasePlatformBootstrapV1({
      admin_database_url: targetUrl,
      migrator_password: migratorPassword,
      runtime_password: runtimePassword,
      apply_legacy_migrations: true,
    });
    const cap07VisibilityMigration = await runMcftCap07StartupMigrationRunnerV1({
      migration_database_url: roleDatabaseUrl(databaseName, "geox_mcft_migrator_v1", migratorPassword),
      subject_commit: subjectCommit,
    });
    const structureBefore = await structureProjection(pool);
    const countsBefore = await relationCounts(pool);
    const bootstrap = await runMcftCap08DatabasePlatformBootstrapV1({ admin_database_url: targetUrl, runner_password: runnerPassword, expected_database_name: databaseName });
    const structureAfter = await structureProjection(pool);
    const countsAfter = await relationCounts(pool);
    const graph = await effectiveGraph(pool);
    const expectedTables = Object.fromEntries(Object.entries(MCFT_CAP08_RELATION_PRIVILEGES_V1).map(([name, privileges]) => [name, [...privileges]]));
    if (hash(structureBefore) !== hash(structureAfter)) throw new Error("BUSINESS_SCHEMA_STRUCTURE_DELTA");
    if (JSON.stringify(countsBefore) !== JSON.stringify(countsAfter)) throw new Error("CANONICAL_RELATION_COUNT_DELTA");
    if (JSON.stringify((graph as any).tablePrivileges) !== JSON.stringify(expectedTables)) throw new Error("EFFECTIVE_TABLE_PRIVILEGES_NOT_EXACT");
    if ((graph as any).databasePrivileges.CONNECT !== true || (graph as any).databasePrivileges.CREATE !== false || (graph as any).databasePrivileges.TEMP !== false) throw new Error("RUNNER_DATABASE_PRIVILEGES_INVALID");
    if ((graph as any).publicDatabasePrivileges.CONNECT !== false || (graph as any).publicDatabasePrivileges.CREATE !== false || (graph as any).publicDatabasePrivileges.TEMP !== false) throw new Error("PUBLIC_DATABASE_PRIVILEGES_INVALID");
    if ((graph as any).schemaPrivileges.USAGE !== true || (graph as any).schemaPrivileges.CREATE !== false) throw new Error("RUNNER_SCHEMA_PRIVILEGES_INVALID");
    if ((graph as any).publicSchemaPrivileges.USAGE !== true || (graph as any).publicSchemaPrivileges.CREATE !== false) throw new Error("PUBLIC_SCHEMA_PRIVILEGES_INVALID");
    if ((graph as any).membership !== 0 || (graph as any).ownership !== 0 || (graph as any).sequencePrivilegeCount !== 0 || (graph as any).functionExecuteCount !== 0 || (graph as any).publicFunctionExecuteCount !== 0 || (graph as any).defaultAclCount !== 0 || (graph as any).alternateConnectRoles.length !== 0) throw new Error("EFFECTIVE_PRIVILEGE_GRAPH_NOT_CLOSED");
    output({
      status: "PASS",
      database_name: databaseName,
      subject_commit: subjectCommit,
      init_file_count: initFiles.length,
      init_files: initFiles,
      cap07_platform_bootstrap: cap07PlatformBootstrap,
      cap07_visibility_migration: cap07VisibilityMigration,
      relation_count: Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).length,
      business_schema_structure_digest_before: hash(structureBefore),
      business_schema_structure_digest_after: hash(structureAfter),
      canonical_relation_counts_before: countsBefore,
      canonical_relation_counts_after: countsAfter,
      effective_privilege_graph_digest: hash(graph),
      effective_privilege_graph: graph,
      bootstrap,
      production_schema_path: "DOCKER_INIT_PLUS_CAP07_REGISTERED_LEGACY_AND_VISIBILITY_MIGRATION",
      zero_canonical_runtime_data_delta: true,
    });
  } finally { await pool.end(); }
}

main().catch((error) => { output({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }); throw error; });
