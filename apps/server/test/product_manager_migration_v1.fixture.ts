// Real PostgreSQL fixture test; intentionally not a full commercial bootstrap qualification.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { runProductManagerMigrationV1 } from "../src/infra/product_manager_migration_v1.js";

const root=process.cwd();
const url=new URL(String(process.env.P6_TEST_DATABASE_URL??""));
assert.equal(process.env.P6_TEST_ONLY,"1");
assert.ok(["localhost","127.0.0.1"].includes(url.hostname));
assert.equal(url.pathname,"/geox_p6_migration_test");
assert.equal(url.username,"postgres");
const admin=new Pool({connectionString:url.href,max:1});
const login=(username:string,password:string)=>{const u=new URL(url);u.username=username;u.password=password;return u.href;};
const migratorUrl=login("geox_product_migrator_v1","p6_fixture_migrator_only");
const runtimeUrl=login("geox_runtime_v1","p6_fixture_runtime_only");
const cfg={migrationDatabaseUrl:migratorUrl,subjectCommit:"c6d666b4addaf71610bf3135c9380bb2b6ee5069",repositoryRoot:root};
const proof=(x:string)=>console.log("PASS "+x);
const rel="geox_manager_v1";
const tables=["field_soil_document_revision_p2_v1","field_soil_document_confirmation_p2_v1","field_crop_review_p3_v1","field_native_assessment_p3p_v1","field_context_followup_p4_v1"];
let runtime:Pool|undefined;
try {
  const empty=await admin.query(`SELECT current_database() AS db,
    to_regclass('public.facts') IS NULL AS empty_facts,
    to_regclass('public.field_index_v1') IS NULL AS empty_fields,
    NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='geox_manager_v1') AS empty_product,
    NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('geox_runtime_v1','geox_product_migrator_v1','geox_product_migration_owner_v1')) AS empty_roles`);
  assert.deepEqual(empty.rows[0],{db:"geox_p6_migration_test",empty_facts:true,empty_fields:true,empty_product:true,empty_roles:true});
  const init=readFileSync(resolve(root,"docker/postgres/init/001_schema.sql"),"utf8");
  for (const table of ["facts","field_index_v1"]) {
    const source=init.match(new RegExp("CREATE TABLE IF NOT EXISTS "+table+" \\([\\s\\S]*?\\n\\);"));
    assert.ok(source,"native init table missing "+table);
    await admin.query(source[0]);
  }
  await admin.query(`
    CREATE ROLE geox_runtime_v1 LOGIN PASSWORD 'p6_fixture_runtime_only' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    CREATE ROLE geox_product_migrator_v1 LOGIN NOINHERIT PASSWORD 'p6_fixture_migrator_only' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    INSERT INTO public.field_index_v1(tenant_id,field_id,field_name) VALUES ('t','f','existing native field');
    INSERT INTO public.facts VALUES ('f1',now(),'TEST_ONLY','{}'),('f2',now(),'TEST_ONLY','{}');
  `);
  await admin.query(readFileSync(resolve(root,"apps/server/db/migrations/product/provision_manager_schema_v1.sql"),"utf8"));
  await assert.rejects(runProductManagerMigrationV1({...cfg,migrationDatabaseUrl:runtimeUrl}),/IDENTITY_OR_SCHEMA/);
  proof("RUNTIME_MIGRATION_DENIED");
  const applied=await runProductManagerMigrationV1(cfg);
  assert.equal(applied.action,"APPLIED");
  proof("PRODUCT_INSTALL_ON_EXISTING_NATIVE_TABLE_FIXTURE");
  const existing=await admin.query("SELECT field_name FROM public.field_index_v1 WHERE tenant_id='t' AND field_id='f'");
  assert.equal(existing.rows[0].field_name,"existing native field");
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM public.facts")).rows[0].n,2);
  proof("NATIVE_ROWS_PRESERVED");
  runtime=new Pool({connectionString:runtimeUrl,max:1});
  await runtime.query(`INSERT INTO ${rel}.field_soil_document_revision_p2_v1 VALUES
    ('t','p','g','f','d',1,'report.csv','TEST_ONLY',decode('00','hex'),'o','c','b','[]',NULL,'f1','a',now())`);
  await runtime.query(`INSERT INTO ${rel}.field_soil_document_confirmation_p2_v1 VALUES
    ('t','p','g','f','d',1,'c','f2','a',now())`);
  await runtime.query(`INSERT INTO ${rel}.field_crop_review_p3_v1 VALUES
    ('t','p','g','f','r','a','i','{}','{}','h',now())`);
  await runtime.query(`INSERT INTO ${rel}.field_native_assessment_p3p_v1 VALUES
    ('t','p','g','f','n','r','a','{}','h',now())`);
  await runtime.query(`INSERT INTO ${rel}.field_context_followup_p4_v1 VALUES
    ('t','p','g','f','u','n','a','{}','h',now())`);
  proof("FIVE_TABLE_APPEND_CHAIN");
  await assert.rejects(runtime.query(`INSERT INTO ${rel}.field_context_followup_p4_v1 VALUES
    ('t','p','other','f','bad','n','a','{}','h',now())`),{code:"23503"});
  proof("FOLLOWUP_CROSS_GROUP_FOREIGN_KEY_DENIED");
  // Reproduce the existing bootstrap's public-only broad table grant, not the full bootstrap.
  await admin.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO geox_runtime_v1");
  for (const t of tables) {
    await assert.rejects(runtime.query(`UPDATE ${rel}.${t} SET field_id=field_id WHERE false`),{code:"42501"});
    await assert.rejects(runtime.query(`DELETE FROM ${rel}.${t} WHERE false`),{code:"42501"});
    await assert.rejects(runtime.query(`TRUNCATE ${rel}.${t}`),{code:"42501"});
  }
  await assert.rejects(runtime.query(`CREATE TABLE ${rel}.no_runtime_ddl(id int)`),{code:"42501"});
  await assert.rejects(runtime.query(`DELETE FROM ${rel}.migration_ledger_v1 WHERE false`),{code:"42501"});
  await assert.rejects(runtime.query(`INSERT INTO ${rel}.migration_ledger_v1(migration_id,source_sha256,physical_sha256,subject_commit) SELECT 'x','x','x','x' WHERE false`),{code:"42501"});
  proof("APPEND_ONLY_AFTER_PUBLIC_BROAD_GRANT_AND_LEDGER_DENIAL");
  await runtime.end();runtime=undefined;
  const again=await runProductManagerMigrationV1(cfg);
  assert.equal(again.action,"ALREADY_APPLIED_EXACT");
  assert.equal(again.physical_sha256,applied.physical_sha256);
  runtime=new Pool({connectionString:runtimeUrl,max:1});
  for(const t of tables) assert.equal((await runtime.query(`SELECT count(*)::int AS n FROM ${rel}.${t}`)).rows[0].n,1);
  proof("EXACT_REENTRY_AND_NEW_CONNECTION_READBACK");
  await admin.query(`ALTER TABLE ${rel}.field_crop_review_p3_v1 ADD COLUMN drift text`);
  await assert.rejects(runProductManagerMigrationV1(cfg),/PHYSICAL_DRIFT/);
  await admin.query(`ALTER TABLE ${rel}.field_crop_review_p3_v1 DROP COLUMN drift`);
  proof("PHYSICAL_DRIFT_DENIED");
  await admin.query(`UPDATE ${rel}.migration_ledger_v1 SET source_sha256=repeat('0',64)`);
  await assert.rejects(runProductManagerMigrationV1(cfg),/CHECKSUM_OR_LEDGER/);
  await admin.query(`UPDATE ${rel}.migration_ledger_v1 SET source_sha256=$1`,[applied.source_sha256]);
  proof("CHECKSUM_DRIFT_DENIED");
  await admin.query(`CREATE TABLE ${rel}.unexpected_fixture(id int)`);
  await assert.rejects(runProductManagerMigrationV1(cfg),/PARTIAL_OR_EXTRA_SCHEMA/);
  await admin.query(`DROP TABLE ${rel}.unexpected_fixture`);
  proof("EXTRA_SCHEMA_DENIED");
  await admin.query(`GRANT UPDATE ON ${rel}.field_crop_review_p3_v1 TO geox_runtime_v1`);
  await assert.rejects(runProductManagerMigrationV1(cfg),/EFFECTIVE_ACL/);
  await admin.query(`REVOKE UPDATE ON ${rel}.field_crop_review_p3_v1 FROM geox_runtime_v1`);
  proof("ACL_DRIFT_DENIED");
  console.log("P6_A2_PG16_FIXTURE=PASS");
} finally {
  if(runtime) await runtime.end();
  await admin.end();
}
