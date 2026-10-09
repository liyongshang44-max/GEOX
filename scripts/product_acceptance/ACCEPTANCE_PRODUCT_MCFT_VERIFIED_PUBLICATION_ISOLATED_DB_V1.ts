// Production-equivalent isolated PostgreSQL proof. The guard forbids non-local DBs.
import assert from "node:assert/strict";
import { randomBytes, generateKeyPairSync, sign as edSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { canonicalJsonV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import {
 PRODUCT_MCFT_PUBLICATION_SCHEMA_V1,
 PRODUCT_MCFT_PUBLICATION_SIGNER_PURPOSE_V1,
 verifyMcftFieldStatePublicationV1,
 type McftPublicationTrustPolicyV1,
 type SignedMcftFieldStatePublicationV1,
} from "../../apps/server/src/product_projection/publication/mcft_verified_field_state_publication_v1.js";
import {
 appendVerifiedMcftPublicationV1,readVerifiedPublishedCurrentV1,
} from "../../apps/server/src/product_projection/publication/postgres_mcft_verified_publication_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";

const dbName="geox_mcft_cap09_production_runtime_v1";
const writerLogin="geox_mcft_publication_publisher_login_v1";
const readerLogin="geox_product_readonly_login_v1";
function mustThrow(f:()=>unknown,pattern:RegExp) {
 assert.throws(f,pattern);
}
const A="a".repeat(64),B="b".repeat(64),C="c".repeat(64);
const DIG=(text:string)=>"sha256:"+text;
function iso(ms:number):string{return new Date(ms).toISOString();}
async function run(){
 assert.equal(process.env.CI_PRODUCT_PUBLICATION_TEST,"true","ISOLATED_CI_FLAG_REQUIRED");
 const source=String(process.env.CI_PRODUCT_PUBLICATION_POSTGRES_ADMIN_URL??"");
 const adminUrl=new URL(source);
 assert.ok(["127.0.0.1","localhost"].includes(adminUrl.hostname),"NON_LOCAL_DB_FORBIDDEN");
 assert.equal(decodeURIComponent(adminUrl.pathname.slice(1)),dbName,"ISOLATED_DB_NAME_REQUIRED");
 assert.equal(adminUrl.protocol,"postgres:","POSTGRES_SCHEME_REQUIRED");
 const admin=new Pool({connectionString:source,max:2});
 const {publicKey,privateKey}=generateKeyPairSync("ed25519");
 const pub=publicKey.export({format:"pem",type:"spki"}).toString();
 const trustedVerifier=DIG(A),runtimeSubject="a".repeat(40);
 const policy:McftPublicationTrustPolicyV1={
  key_id:"mcft-publish-test-key-1",public_key_pem:pub,
  runtime_subject_sha:runtimeSubject,
  qualified_readback_verifier_digest:trustedVerifier,
  authority_status:"EFFECTIVE_PUBLICATION_SIGNER_AUTHORITY",
  allowed_scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
 };
 const start=(await admin.query<{t:Date}>("SELECT clock_timestamp() AS t")).rows[0].t.getTime();
 const statement=()=>{
  const logical=iso(start-2*3600_000),visible=iso(start-3600_000),
  readback=iso(start-1800_000),certified=iso(start-10_000);
  return {
   schema_version:PRODUCT_MCFT_PUBLICATION_SCHEMA_V1,
   signer_purpose:PRODUCT_MCFT_PUBLICATION_SIGNER_PURPOSE_V1,
   scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
   source:{
    project_id:"delicate-glade-62464340" as const,
    branch_id:"br-cold-dust-a6j6aymz" as const,
    database_name:"geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const,
    runtime_subject_sha:runtimeSubject,
    active_lineage_ref:"lineage-a",
    active_lineage_hash:DIG(A),
    posterior_state_ref:"state-a",
    posterior_state_hash:DIG(B),
    posterior_source_fact_ref:"fact-a",
    complete_exact_graph_receipt_sha256:DIG(C),
    qualified_readback_verifier_digest:trustedVerifier,
    readback_status:"CAP07_COMPLETE_EXACT_GRAPH" as const,
    logical_time:logical,evidence_visible_at:visible,readback_as_of:readback,
   },
   condition:{kind:"MODELED_ROOT_ZONE_WATER" as const,
    water:{available_water_fraction:0.61,depletion_from_field_capacity_mm:14.8,
      root_zone_water_storage_mm:{mean:76.2,stddev:4.5,interval_low:67.4,interval_high:85}},
    water_stress_status:"NOT_ESTABLISHED" as const,
    confidence_status:"NOT_ESTABLISHED" as const},
   certified_at:certified,
   cap09_final_qualification_claim:false as const,
  };
 };
 const signStatement=(stmt:ReturnType<typeof statement>, key=privateKey):SignedMcftFieldStatePublicationV1=>({
  statement:stmt,key_id:policy.key_id,
  signature_base64:edSign(null,Buffer.from(canonicalJsonV1(stmt),"utf8"),key).toString("base64"),
 });
 let writer:Pool|null=null,reader:Pool|null=null;
 try{
  const already=await admin.query<{n:string}>("SELECT current_database() AS n");
  assert.equal(already.rows[0].n,dbName);
  await admin.query("CREATE ROLE geox_mcft_publication_writer_v1 NOLOGIN");
  await admin.query("CREATE ROLE geox_product_readonly_v1 NOLOGIN");
  await admin.query(`CREATE ROLE ${writerLogin} LOGIN PASSWORD 'publication-writer-ci-test'`);
  await admin.query(`CREATE ROLE ${readerLogin} LOGIN PASSWORD 'publication-reader-ci-test'`);
  await admin.query(`GRANT geox_mcft_publication_writer_v1 TO ${writerLogin}`);
  await admin.query(`GRANT geox_product_readonly_v1 TO ${readerLogin}`);
  await admin.query(`ALTER ROLE ${readerLogin} IN DATABASE ${dbName} SET default_transaction_read_only TO on`);
  await admin.query(fs.readFileSync(path.resolve("apps/server/db/migrations/2026_10_09_product_mcft_verified_publication_v1.sql"),"utf8"));
  const base=`postgresql://127.0.0.1:5432/${dbName}`;
  writer=new Pool({connectionString:base.replace("postgresql://","postgresql://"+writerLogin+":publication-writer-ci-test@"),max:2});
  reader=new Pool({connectionString:base.replace("postgresql://","postgresql://"+readerLogin+":publication-reader-ci-test@"),max:2});
  const w=writer,r=reader;
  const initial=await readVerifiedPublishedCurrentV1(r,policy.allowed_scope,policy);
  assert.equal(initial.status,"UNAVAILABLE");
  const good=signStatement(statement());
  const first=await appendVerifiedMcftPublicationV1(w,good,policy);
  assert.equal(first.inserted,true);
  const replay=await appendVerifiedMcftPublicationV1(w,good,policy);
  assert.equal(replay.inserted,false);
  assert.equal(first.publication_id,replay.publication_id);
  const latest=await readVerifiedPublishedCurrentV1(r,policy.allowed_scope,policy);
  assert.equal(latest.status,"PUBLISHED_UNQUALIFIED_24T");
  if(latest.status!=="PUBLISHED_UNQUALIFIED_24T")throw new Error("TEST_PUBLICATION_UNEXPECTED");
  assert.equal(latest.publication?.statement.condition.water.available_water_fraction,0.61);
  assert.equal(latest.publication?.statement.source.posterior_state_ref,"state-a");
  assert.equal(latest.publication?.statement.cap09_final_qualification_claim,false);

  mustThrow(()=>verifyMcftFieldStatePublicationV1({
    ...good,statement:{...good.statement,condition:{
      ...good.statement.condition,water:{...good.statement.condition.water,available_water_fraction:0.99},
    }},
  },policy,iso(start+60_000)),/SIGNATURE_CHECK_FAILED/);
  mustThrow(()=>verifyMcftFieldStatePublicationV1(good,{...policy,authority_status:"UNAUTHORISED" as any},iso(start+60_000)),/TRUST_AUTHORITY_NOT_EFFECTIVE/);
  mustThrow(()=>verifyMcftFieldStatePublicationV1(good,{...policy,key_id:"different-key"},iso(start+60_000)),/SIGNER_NOT_TRUSTED/);
  mustThrow(()=>verifyMcftFieldStatePublicationV1(signStatement({...statement(),scope:{...statement().scope,tenant_id:"other"}}),policy,iso(start+60_000)),/SOURCE_SCOPE_NOT_RESEARCH/);
  mustThrow(()=>verifyMcftFieldStatePublicationV1(signStatement({...statement(),cap09_final_qualification_claim:true as any}),policy,iso(start+60_000)),/UNQUALIFIED_COMPLETION_CLAIM/);
  mustThrow(()=>verifyMcftFieldStatePublicationV1(signStatement({...statement(),source:{...statement().source,evidence_visible_at:iso(start+60_000)}}),policy,iso(start+60_000)),/CAUSAL_TIME_ORDER_INVALID/);
  mustThrow(()=>verifyMcftFieldStatePublicationV1(signStatement({...statement(),source:{...statement().source,qualified_readback_verifier_digest:DIG(B)}}),policy,iso(start+60_000)),/SOURCE_VERIFIER_CONTRACT_NOT_AUTHORIZED/);

  await assert.rejects(r.query("INSERT INTO product_mcft_publication_v1.field_state_receipt_v1(publication_id) VALUES('invalid')"),/read-only|permission denied|cannot execute/i);
  await assert.rejects(w.query("UPDATE product_mcft_publication_v1.field_state_receipt_v1 SET issuer_key_id='evil'"),/permission denied|APPEND_ONLY/);
  await assert.rejects(w.query("DELETE FROM product_mcft_publication_v1.field_state_receipt_v1"),/permission denied|APPEND_ONLY/);
  const grant=await admin.query<{writer_insert:boolean;reader_insert:boolean;reader_select:boolean}>(
   "SELECT has_table_privilege($1,'product_mcft_publication_v1.field_state_receipt_v1','INSERT') AS writer_insert,has_table_privilege($2,'product_mcft_publication_v1.field_state_receipt_v1','INSERT') AS reader_insert,has_table_privilege($2,'product_mcft_publication_v1.field_state_receipt_v1','SELECT') AS reader_select",
   [writerLogin,readerLogin],
  );
  assert.equal(grant.rows[0].writer_insert,true);
  assert.equal(grant.rows[0].reader_insert,false);
  assert.equal(grant.rows[0].reader_select,true);

  // Legitimately signed competing content at the same logical hour fails
  // closed instead of opportunistically selecting latest-by-publication-time.
  const competitor=statement();
  competitor.source.posterior_state_ref="state-b";
  competitor.source.posterior_state_hash=DIG(C);
  await appendVerifiedMcftPublicationV1(w,signStatement(competitor),policy);
  const conflicting=await readVerifiedPublishedCurrentV1(r,policy.allowed_scope,policy);
  assert.equal(conflicting.status,"LIMITED");

  // Source DB remains absent from test connections; this test never modifies
  // Formal-v5. Provenance source truth still requires actual CAP07 proof.
  const count=await admin.query<{n:string}>("SELECT count(*)::text AS n FROM product_mcft_publication_v1.field_state_receipt_v1");
  assert.equal(count.rows[0].n,"2");
  process.stdout.write(JSON.stringify({
   status:"PASS",schema_version:"geox.product-mcft.publication.acceptance.v1",
   physical_db:dbName,rows:Number(count.rows[0].n),tests:[
    "exact_six_key_scope","ed25519_signature","qualified_verifier_pin",
    "causal_visibility","append_only","idempotence","reader_no_writes",
    "independent_read_verification","competing_revision_fail_closed","unqualified_24t_flag"
   ],
   production_approved:false,host_publication_enabled:false,
   formal_database_touched:false,
  },null,2)+"\n");
 }finally{
  await writer?.end().catch(()=>undefined);
  await reader?.end().catch(()=>undefined);
  await admin.end();
 }
}
run().catch(e=>{process.stderr.write("PRODUCT_MCFT_PUBLICATION_ACCEPTANCE_FIRST_RED:"+String(e?.stack??e)+"\n");process.exitCode=1;});
