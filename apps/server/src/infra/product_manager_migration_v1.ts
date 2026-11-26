// P6-A2 candidate: independent product one-shot; not registered in live Server or Compose.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

const schema = "geox_manager_v1";
const owner = "geox_product_migration_owner_v1";
const migrator = "geox_product_migrator_v1";
const runtime = "geox_runtime_v1";
const id = "geox.manager.p2-p4.persistence.v1";
const tables = [
  "field_soil_document_revision_p2_v1",
  "field_soil_document_confirmation_p2_v1",
  "field_crop_review_p3_v1",
  "field_native_assessment_p3p_v1",
  "field_context_followup_p4_v1",
  "migration_ledger_v1",
].sort();
const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
function requireContract(ok: unknown, detail: string): asserts ok {
  if (!ok) throw new Error("P6_PRODUCT_MIGRATION_" + detail);
}

async function identity(c: PoolClient) {
  const r = await c.query(`
    SELECT session_user::text AS session_id, current_user::text AS current_id,
      NOT (m.rolsuper OR m.rolcreaterole OR m.rolcreatedb OR m.rolreplication OR m.rolbypassrls) AS migrator_safe,
      NOT (o.rolcanlogin OR o.rolsuper OR o.rolcreaterole OR o.rolcreatedb OR o.rolreplication OR o.rolbypassrls) AS owner_safe,
      NOT (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls) AS runtime_safe,
      pg_has_role(m.rolname,o.rolname,'SET') AS migrator_can_set,
      NOT pg_has_role(r.rolname,o.rolname,'MEMBER') AND NOT pg_has_role(r.rolname,m.rolname,'MEMBER') AS runtime_separated,
      n.nspowner=o.oid AS schema_owned,
      has_schema_privilege(r.rolname,n.oid,'USAGE') AND NOT has_schema_privilege(r.rolname,n.oid,'CREATE') AS runtime_schema_safe
    FROM pg_roles m CROSS JOIN pg_roles o CROSS JOIN pg_roles r CROSS JOIN pg_namespace n
    WHERE m.rolname=$1 AND o.rolname=$2 AND r.rolname=$3 AND n.nspname=$4
  `,[migrator,owner,runtime,schema]);
  const x = r.rows[0];
  requireContract(r.rowCount===1 && x.session_id===migrator && x.current_id===migrator &&
    x.migrator_safe && x.owner_safe && x.runtime_safe && x.migrator_can_set &&
    x.runtime_separated && x.schema_owned && x.runtime_schema_safe, "IDENTITY_OR_SCHEMA");
}
async function relations(c: PoolClient): Promise<string[]> {
  const r = await c.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relkind NOT IN ('i','I','t') ORDER BY c.relname`,[schema]);
  return r.rows.map(x=>String(x.relname));
}
async function physical(c: PoolClient): Promise<string> {
  requireContract(JSON.stringify(await relations(c))===JSON.stringify(tables),"PARTIAL_OR_EXTRA_SCHEMA");
  const acl=await c.query(`
    SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
      has_table_privilege($2,c.oid,'SELECT') AS can_read,
      has_table_privilege($2,c.oid,'INSERT') AS can_insert,
      has_any_column_privilege($2,c.oid,'INSERT') AS column_insert,
      (has_table_privilege($2,c.oid,'UPDATE') OR has_any_column_privilege($2,c.oid,'UPDATE')
       OR has_table_privilege($2,c.oid,'DELETE') OR has_table_privilege($2,c.oid,'TRUNCATE')
       OR has_table_privilege($2,c.oid,'TRIGGER') OR has_table_privilege($2,c.oid,'REFERENCES')
       OR has_any_column_privilege($2,c.oid,'REFERENCES')) AS forbidden
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($3::text[]) ORDER BY c.relname
  `,[schema,runtime,tables]);
  requireContract(acl.rowCount===tables.length && acl.rows.every(x=>x.relkind==="r" && x.owner===owner &&
    x.can_read && !x.forbidden && x.can_insert===(x.relname!=="migration_ledger_v1") &&
    x.column_insert===(x.relname!=="migration_ledger_v1")),"EFFECTIVE_ACL");
  const columns=await c.query(`
    SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS type,
       a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) AS default_expr
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attnum
  `,[schema,tables]);
  const constraints=await c.query(`
    SELECT c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) ORDER BY c.relname,k.conname
  `,[schema,tables]);
  requireContract(constraints.rows.every(x=>x.convalidated),"UNVALIDATED_CONSTRAINT");
  const indexes=await c.query(`
    SELECT c.relname,i.relname AS index_name,x.indisvalid,x.indisready,pg_get_indexdef(i.oid) AS definition
    FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2::text[])
    ORDER BY c.relname,i.relname
  `,[schema,tables]);
  requireContract(indexes.rows.every(x=>x.indisvalid && x.indisready),"INVALID_INDEX");
  const triggers=await c.query(`
    SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname
  `,[schema,tables]);
  return sha(JSON.stringify([acl.rows,columns.rows,constraints.rows,indexes.rows,triggers.rows]));
}

export async function runProductManagerMigrationV1(config: {
  migrationDatabaseUrl: string; subjectCommit: string; repositoryRoot: string;
}) {
  requireContract(/^[0-9a-f]{40}$/.test(config.subjectCommit),"SUBJECT");
  requireContract(Boolean(config.migrationDatabaseUrl),"CREDENTIAL_MISSING");
  const bytes=readFileSync(resolve(config.repositoryRoot,"apps/server/db/migrations/product/2026_11_26_manager_persistence_v1.sql"));
  const checksum=sha(bytes);
  const pool=new Pool({connectionString:config.migrationDatabaseUrl,max:1});
  try {
    const c=await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL search_path=pg_catalog");
      await c.query("SET LOCAL lock_timeout='5s'");
      await c.query("SET LOCAL statement_timeout='60s'");
      await identity(c);
      await c.query("SELECT pg_advisory_xact_lock(7360220261126::bigint)");
      await c.query("SET LOCAL ROLE geox_product_migration_owner_v1");
      const existing=await relations(c);
      let action="APPLIED";
      let fingerprint:string;
      if (existing.length===0) {
        await c.query(bytes.toString("utf8"));
        fingerprint=await physical(c);
        await c.query(`INSERT INTO geox_manager_v1.migration_ledger_v1
          (migration_id,source_sha256,physical_sha256,subject_commit) VALUES ($1,$2,$3,$4)`,
          [id,checksum,fingerprint,config.subjectCommit]);
      } else {
        requireContract(JSON.stringify(existing)===JSON.stringify(tables),"PARTIAL_OR_EXTRA_SCHEMA");
        const ledger=await c.query("SELECT migration_id,source_sha256,physical_sha256 FROM geox_manager_v1.migration_ledger_v1");
        requireContract(ledger.rowCount===1 && ledger.rows[0].migration_id===id &&
          ledger.rows[0].source_sha256===checksum,"CHECKSUM_OR_LEDGER");
        fingerprint=await physical(c);
        requireContract(ledger.rows[0].physical_sha256===fingerprint,"PHYSICAL_DRIFT");
        action="ALREADY_APPLIED_EXACT";
      }
      await c.query("COMMIT");
      return {status:"PASS",migration_id:id,action,source_sha256:checksum,physical_sha256:fingerprint,subject_commit:config.subjectCommit};
    } catch (e) {
      await c.query("ROLLBACK").catch(()=>undefined);
      throw e;
    } finally { c.release(); }
  } finally { await pool.end(); }
}
