"use strict";
/* No network, no signed Owner, no credentials and no physical R4285 stages. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),
 os=require("node:os"),path=require("node:path");
const p=require("./MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V2.cjs");
const R="4285c3ce342c",P="mcft_cap09_requal_"+R+"_positive",N="mcft_cap09_requal_"+R+"_negative";
function context(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-r4285-owner-probe-"));
 const i={source_root:root,release_root:root,subject_sha:"a".repeat(40),
  database_port:55492,bucket_endpoint:"http://127.0.0.1:59292/"};
 return {root,i};
}
function pgEnv(i){
 return {DATABASE_URL:"postgres://cap09_"+R+"_p_evidence:fixture@127.0.0.1:"+i.database_port+"/"+P,
  BLOCKED_DATABASE_URL:"postgres://cap09_"+R+"_n_evidence:fixture@127.0.0.1:"+i.database_port+"/"+N};
}
test("current R4285 scoped urls validate before any connection and forbid landos",()=>{
 const {root,i}=context();
 try{
  const env=pgEnv(i);
  const checked=p.pgTarget(i,env);
  assert.equal(checked.positive.db,P);assert.equal(checked.negative.db,N);
  assert.throws(()=>p.pgTarget(i,{...env,DATABASE_URL:"postgres://user:secret@127.0.0.1:5432/landos"}),
   /OWNER_PRODUCER_PG_SCOPE_MISMATCH/);
  assert.throws(()=>p.pgTarget(i,{...env,BLOCKED_DATABASE_URL:undefined}),
   /OWNER_PRODUCER_PG_SCOPED_CREDENTIAL_ABSENT/);
  assert.throws(()=>p.validateInput({...i,database_port:5432}),
   /OWNER_PRODUCER_HISTORIC_PG_PORT/);
  assert.throws(()=>p.validateInput({...i,bucket_endpoint:"http://127.0.0.1:9000/"}),
   /OWNER_PRODUCER_S3_HISTORIC_PORT/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PG source facts preserve 29-table schema, enforce facts-zero without widening Evidence SELECT",()=>{
 const names=require("./MCFT_CAP09_R4285_PG_READONLY_V1.cjs").REQUIRED_PUBLIC_TABLES;
 const facts={id:{session_user:"cap09_"+R+"_p_evidence",current_user:"cap09_"+R+"_p_evidence",
  database:P},expectedRole:"cap09_"+R+"_p_evidence",expectedDb:P,
  tables:names.slice(),factsCount:"0",
  selectRights:names.map(name=>({name,allowed:["facts",
   "twin_external_formal_forcing_base_cursor_v1",
   "twin_external_formal_forcing_base_target_v1",
   "twin_external_formal_forcing_controller_lease_v1"].includes(name)})),
  databaseOwner:"cap09_4285c3ce342c_owner",
  databaseOid:45673,acl:{fenced_exists:true,fenced_execute:true,direct_insert:false,controller_acl:true},
  roleCaps:{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false}};
 const observed=p.probeCatalogFacts(facts);
 assert.equal(observed.tables,29);
 assert.equal(observed.facts_rows_zero,true);
 assert.equal(observed.other_28_table_rows_verified,false);
 assert.equal(observed.denied_select_tables.length,25);
 assert.throws(()=>p.probeCatalogFacts({...facts,factsCount:"1"}),
  /OWNER_PRODUCER_PG_FACTS_NOT_EMPTY/);
 assert.throws(()=>p.probeCatalogFacts({...facts,selectRights:facts.selectRights.map(x=>
  x.name==="facts"?{...x,allowed:false}:x)}),
  /OWNER_PRODUCER_PG_REQUIRED_SELECT_DENIED/);
 assert.throws(()=>p.probeCatalogFacts({...facts,acl:{...facts.acl,direct_insert:true}}),
  /OWNER_PRODUCER_PG_FENCED_ACL_INVALID/);
 assert.throws(()=>p.probeCatalogFacts({...facts,roleCaps:{...facts.roleCaps,rolsuper:true}}),
  /OWNER_PRODUCER_PG_LOGIN_NOT_RESTRICTED/);
 assert.throws(()=>p.probeCatalogFacts({...facts,tables:names.slice(1)}),
  /OWNER_PRODUCER_PG_EXACT_29_TABLES/);
});
test("S3 source facts require canonical owner grants and no bucket policy",()=>{
 const id="abc01234567890",acl={Owner:{ID:id},Grants:[{
  Grantee:{Type:"CanonicalUser",ID:id},Permission:"FULL_CONTROL"}]};
 assert.equal(p.assertS3Private(acl,"NO_BUCKET_POLICY"),id);
 assert.throws(()=>p.assertS3Private({...acl,Grants:[{
  Grantee:{Type:"Group",URI:"http://acs.amazonaws.com/groups/global/AllUsers"},
  Permission:"READ"}]},"NO_BUCKET_POLICY"),/OWNER_PRODUCER_S3_PUBLIC_OR_EXTERNAL_GRANT/);
 assert.throws(()=>p.assertS3Private(acl,"POLICY_PRESENT"),
  /OWNER_PRODUCER_S3_POLICY_PRIVACY_NOT_PROVEN/);
});
test("no fabricated Owner PASS from two successful scoped diagnostics",()=>{
 const hold=p.unresolved({status:"PASS_SCOPED_READONLY"},{status:"PASS_SCOPED_READONLY"});
 assert.deepEqual(hold,["OWNER_EXCLUSIVE_CONTROL_PLANE_NOT_PROVEN",
  "PRODUCTION_BINDINGS_ABSENT_NOT_INDEPENDENTLY_PROVEN"]);
 assert.equal(p.unresolved({status:"HOLD"},{status:"HOLD"}).length,4);
 const {root,i}=context();
 try{
  assert.throws(()=>p.parse(["--produce-raw","--input",path.join(root,"future.json")]),
   /OWNER_PRODUCER_ONLY_DIAGNOSTIC_ALLOWED/);
  assert.equal(p.validateInput(i),i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("PG diagnostic distinguishes positive/negative phases with safe codes only",()=>{
 assert.equal(p.pgFailureCode({code:"ECONNREFUSED",message:"postgres://password@127.0.0.1"},"positive","CONNECT"),
  "OWNER_PRODUCER_PG_POSITIVE_CONNECT_ECONNREFUSED");
 assert.equal(p.pgFailureCode({code:"28P01",message:"password=UNSAFE_SECRET"},"negative","CONNECT"),
  "OWNER_PRODUCER_PG_NEGATIVE_CONNECT_28P01");
 assert.equal(p.pgFailureCode({code:"42501",detail:"secret database ACL"},"positive","FACTS_COUNT"),
  "OWNER_PRODUCER_PG_POSITIVE_FACTS_COUNT_42501");
 assert.equal(p.pgFailureCode({code:"undefined",message:"secret credential URL"},"positive","TABLE_CATALOG"),
  "OWNER_PRODUCER_PG_POSITIVE_TABLE_CATALOG_UNKNOWN");
 assert.equal(p.pgFailureCode({code:"ERR_ASSERTION",message:"OWNER_PRODUCER_PG_EXACT_29_TABLES"},
  "negative","FACT_CONTRACT"),"OWNER_PRODUCER_PG_EXACT_29_TABLES");
 assert.throws(()=>p.pgFailureCode({code:"28P01"},"other","CONNECT"),
  /OWNER_PRODUCER_DIAGNOSTIC_SIDE/);
});

test("bounded synthetic PG failure does not leak server text or untrusted table names",async()=>{
 const table=require("./MCFT_CAP09_R4285_PG_READONLY_V1.cjs").REQUIRED_PUBLIC_TABLES[0];
 const classified=await p.timed("PG_DUAL_DATABASE_READONLY",async()=>{
  const e=Error("OWNER_PRODUCER_PG_POSITIVE_TABLE_SELECT_DENIED");
  e.denied_tables=[table];
  e.detail="postgres://untrusted:SECRET@127.0.0.1";
  throw e;
 });
 assert.equal(classified.status,"HOLD");
 assert.equal(classified.reason_code,"OWNER_PRODUCER_PG_POSITIVE_TABLE_SELECT_DENIED");
 assert.deepEqual(classified.denied_tables,[table]);
 assert(!JSON.stringify(classified).includes("SECRET"));
 const tampered=await p.timed("PG_DUAL_DATABASE_READONLY",async()=>{
  const e=Error("OWNER_PRODUCER_PG_POSITIVE_TABLE_SELECT_DENIED");
  e.denied_tables=["../../some-sensitive-table"];
  throw e;
 });
 assert.equal(tampered.status,"HOLD");
 assert.equal(tampered.denied_tables,undefined);
});
