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
test("PG source facts require verified exact roles all 29 empty tables and fenced ACL",()=>{
 const names=require("./MCFT_CAP09_R4285_PG_READONLY_V1.cjs").REQUIRED_PUBLIC_TABLES;
 const facts={id:{session_user:"cap09_"+R+"_p_evidence",current_user:"cap09_"+R+"_p_evidence",
  database:P},expectedRole:"cap09_"+R+"_p_evidence",expectedDb:P,
  tables:names.slice(),counts:names.map(()=>"0"),databaseOwner:"cap09_4285c3ce342c_owner",
  databaseOid:45673,acl:{fenced_exists:true,fenced_execute:true,direct_insert:false,controller_acl:true},
  roleCaps:{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false}};
 assert.equal(p.probeCatalogFacts(facts).tables,29);
 assert.throws(()=>p.probeCatalogFacts({...facts,counts:facts.counts.map((n,i)=>i===0?"1":n)}),
  /OWNER_PRODUCER_PG_NONEMPTY/);
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
