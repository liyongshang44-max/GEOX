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
 assert.equal(observed.database_owner_exclusivity_verified,false);
 // A current cluster DB owner can be postgres; it must not be conflated
 // with the separately authenticated/restricted Evidence login.
 const adminOwned=p.probeCatalogFacts({...facts,databaseOwner:"postgres"});
 assert.equal(adminOwned.owner_role,"postgres");
 assert.equal(adminOwned.database_owner_restriction_verified,false);
 assert.equal(adminOwned.database_owner_exclusivity_verified,false);
 assert.throws(()=>p.probeCatalogFacts({...facts,databaseOwner:""}),
  /OWNER_PRODUCER_PG_DATABASE_OWNER_CATALOG_INVALID/);
 assert.throws(()=>p.probeCatalogFacts({...facts,databaseOid:0}),
  /OWNER_PRODUCER_PG_DATABASE_OWNER_CATALOG_INVALID/);
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

test("scoped S3 probe uses only the original four read operations",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V2.cjs"),"utf8");
 const block=source.split("async function probeS3(i,env){")[1]?.split("\nasync function timed(label,fn){")[0];
 assert(block,"S3 bounded source is present");
 for(const operation of ["HeadBucketCommand","ListObjectsV2Command",
  "ListObjectVersionsCommand","ListMultipartUploadsCommand"])
  assert(block.includes(operation),"missing four-read operation: "+operation);
 assert(!block.includes("GetBucketAclCommand"));
 assert(!block.includes("GetBucketPolicyCommand"));
 const scoped=await p.timed("S3_BUCKET_PRIVATE_VERSIONS_MULTIPART_READONLY",
  async()=>({status:"PASS_SCOPED_DATA_PLANE_ONLY",
   bucket_exists:true,bucket_empty_including_versions_multipart:true,
   bucket_private_verified:false,independent_control_plane_verified:false}));
 assert.equal(scoped.status,"HOLD_INDEPENDENT_CONTROL_PLANE");
 assert.equal(scoped.result.bucket_private_verified,false);
 assert(p.unresolved({status:"PASS_SCOPED_READONLY"},scoped)
  .includes("S3_INDEPENDENT_ACL_POLICY_OWNER_NOT_PROVEN"));
 assert(!p.unresolved({status:"PASS_SCOPED_READONLY"},scoped)
  .includes("PG_AUTHENTICATED_SCOPE_AND_ACL_NOT_PROVEN"));
});

test("S3-only mode is explicit NONAUTH and formal readback route stays forbidden",()=>{
 const {root,i}=context();
 try{
  const input=path.join(root,"owner-input.json");
  fs.writeFileSync(input,JSON.stringify(i));
  assert.equal(p.parse(["--s3-only-diagnostic","--input",input]).subject_sha,i.subject_sha);
  assert.equal(p.parse(["--diagnostic-only","--input",input]).subject_sha,i.subject_sha);
  for(const mode of ["--produce-raw","--sign-owner","--session-execute"]){
   assert.throws(()=>p.parse([mode,"--input",input]),
    /OWNER_PRODUCER_ONLY_DIAGNOSTIC_ALLOWED/);
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});


test("V2 successor policy fixes precisely seven bucket/object Action/Resource pairs",()=>{
 const policy=p.replacementPolicyV2(),checked=p.verifyReplacementPolicyV2(policy);
 assert.equal(checked.pairs,7);
 assert.match(checked.sha256,/^[a-f0-9]{64}$/);
 assert.equal(p.replacementPolicyBytesV2().at(-1),10);
 assert.deepEqual(policy.Statement.map(x=>x.Action.length*x.Resource.length),[3,4]);
 assert.equal(policy.Statement[0].Resource[0],"arn:aws:s3:::mcft-cap09-requal-4285c3ce342c");
 for(const action of ["s3:GetBucketAcl","s3:GetBucketPolicy","s3:DeleteObject"])
  assert(!JSON.stringify(policy).includes(action));
 assert.throws(()=>p.verifyReplacementPolicyV2({...policy,Statement:[
  {...policy.Statement[0],Resource:["*"]},policy.Statement[1]
 ]}),/OWNER_BINDING_POLICY_SEVEN_EXACT_PAIRS_REQUIRED/);
 assert.throws(()=>p.verifyReplacementPolicyV2({...policy,Statement:[
  policy.Statement[0],{...policy.Statement[1],Action:["s3:GetObject","s3:PutObject","s3:DeleteObject"]}
 ]}),/OWNER_BINDING_POLICY_SEVEN_EXACT_PAIRS_REQUIRED/);
});
test("V2 responsibility assignment has genuine Ed25519 authority but never physical Owner PASS",()=>{
 const crypto=require("node:crypto");
 const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
 const canonical=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs").canonical;
 const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
 const now=Date.parse("2026-11-02T04:30:00.000Z");
 const bytesA=Buffer.from("fixture-control-readback-NOT-real"),bytesB=Buffer.from("fixture-inventory-NOT-real");
 const parent=hash(Buffer.from("nonproduction-fixture-parent"));
 const issuer="operator-fixture-v2",kid="fixture-signing-key";
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:p.HOST,
  operator_id:issuer,issuers:[{issuer_id:issuer,key_id:kid,revoked:false,
  role:"ACCOUNTABLE_SINGLE_OPERATOR",public_key_pem:publicKey.export({format:"pem",type:"spki"}),
  spki_sha256:hash(publicKey.export({format:"der",type:"spki"})),
  not_before:"2026-11-02T04:00:00.000Z",not_after:"2026-11-03T04:00:00.000Z"}]};
 const policy=p.verifyReplacementPolicyV2(p.replacementPolicyV2());
 const payload={
  schema_version:"MCFT_CAP09_R4285_OWNER_AUTHORITY_BINDING_V2",issuer_id:issuer,
  key_id:kid,run_id:p.RUN,subject_sha:"a".repeat(40),host_id:p.HOST,
  scope:"R4285_ISOLATED_QUALIFICATION_TEST_ONLY",production_authorized:false,
  authority_comment_id:6569014082,authorized_operator_id:issuer,
  issued_at:"2026-11-02T04:29:00.000Z",expires_at:"2026-11-02T08:29:00.000Z",
  minio_deployment_id:"ddbc6bb9-eb52-4b95-8324-b556697f8c0e",
  volume_name:"mcftcap09-r4285c3ce342c-s3data",
  bucket_endpoint:"http://127.0.0.1:59292/",
  bucket:p.BUCKET,bucket_arn:policy.bucket_arn,raw_prefix_arn:policy.raw_prefix_arn,
  candidate_prefix_arn:policy.candidate_prefix_arn,
  parent_principal_sha256:parent,policy_sha256:policy.sha256,
  control_evidence_sha256:hash(bytesA),inventory_evidence_sha256:hash(bytesB)
 };
 const sign=q=>({payload:q,signature_base64:crypto.sign(null,
  Buffer.from(p.OWNER_BINDING_DOMAIN_V2+canonical(q)),privateKey).toString("base64")});
 const ctx={subject_sha:payload.subject_sha,host_id:p.HOST,
  parent_principal_sha256:parent,control_evidence_bytes:bytesA,
  inventory_evidence_bytes:bytesB,now};
 const valid=p.verifyOwnerAuthorityBindingV2(sign(payload),trust,ctx);
 assert.equal(valid.status,"R4285_SIGNED_RESPONSIBILITY_AND_RAW_DIGESTS_BOUND_NOT_PHYSICAL_OWNER");
 assert.match(valid.responsibility_record_id,/^r4285owner:[a-f0-9]{40}$/);
 assert.equal(valid.owner_exclusive_verified,false);
 assert.equal(valid.production_bindings_absent_verified,false);
 assert.equal(valid.formal_readback_issued,false);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign(payload),trust,{
  ...ctx,control_evidence_bytes:Buffer.from("tampered")}),/OWNER_BINDING_INDEPENDENT_RAW_DIGEST/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign(payload),trust,{
  ...ctx,parent_principal_sha256:"0".repeat(64)}),/OWNER_BINDING_PARENT_SOURCE/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign({...payload,bucket:"other"}),trust,ctx),
  /OWNER_BINDING_BUCKET/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign({...payload,policy_sha256:"0".repeat(64)}),trust,ctx),
  /OWNER_BINDING_POLICY_SHA/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign({...payload,authorized_operator_id:"unbound"}),trust,ctx),
  /OWNER_BINDING_ACCOUNTABLE_OPERATOR/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign(payload),{
  ...trust,issuers:[{...trust.issuers[0],revoked:true}]},ctx),
  /OWNER_BINDING_SIGNER_REVOKED/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign(payload),{
  ...trust,issuers:[{...trust.issuers[0],role:"ADMIN"}]},ctx),
  /OWNER_BINDING_ROLE/);
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(sign(payload),trust,{...ctx,now:Date.parse("2026-11-02T09:00:00Z")}),
  /OWNER_BINDING_WINDOW/);
 const altered=sign(payload);altered.payload={...payload,minio_deployment_id:"other"};
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(altered,trust,ctx),/OWNER_BINDING_DEPLOYMENT/);
 const forged=sign(payload);forged.payload={...payload,issued_at:"2026-11-02T04:29:10.000Z"};
 assert.throws(()=>p.verifyOwnerAuthorityBindingV2(forged,trust,ctx),/OWNER_BINDING_SIGNATURE_INVALID/);
});


test("formal source rejects self-declared control/inventory receipts before any Owner PASS",()=>{
 const {root,i}=context();
 try{
  assert.throws(()=>p.verifyFormalEvidence(i,{}),/OWNER_FORMAL_CONTROL_RAW_BYTES_REQUIRED/);
  const x={envelope:{},trust:{},parent_principal_sha256:"a".repeat(64),
   control_bytes:Buffer.from("control"),inventory_bytes:Buffer.from("control")};
  assert.throws(()=>p.verifyFormalEvidence(i,x),/OWNER_FORMAL_TWO_DISTINCT_SOURCES_REQUIRED/);
  assert.throws(()=>p.verifyFormalEvidence(i,{...x,inventory_bytes:Buffer.from("inventory")}),
   /OWNER_BINDING_/);
  assert.throws(()=>p.composeFormalReadback(i,{status:"PASS"},{
   status:"PASS_SCOPED_READONLY"},{status:"PASS_SCOPED_DATA_PLANE_ONLY"},{
   observedAt:new Date().toISOString(),completedAt:new Date().toISOString(),
   sourceSha:"a".repeat(64)}),/OWNER_FORMAL_VERIFIED_NATIVE_SOURCE_REQUIRED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("source-bound assembly preserves frozen V1 FACT_BINDINGS and rejects stale or partial probes",()=>{
 const {root,i}=context();
 try{
  const source={kind:"NATIVE_AUTHENTICATED_SOURCE",verifier:"R4285_NATIVE",
   bucket_private:true,production_bindings_present:false,owner_exclusive:true,
   s3_owner_id:"r4285owner:"+"a".repeat(40),
   control_sha256:"a".repeat(64),inventory_sha256:"b".repeat(64),
   source_receipt_sha256:"c".repeat(64)};
  const pg={status:"PASS_SCOPED_READONLY",database_host:"127.0.0.1",
   database_port:i.database_port,positive_database:P,negative_database:N,
   audit_user:"cap09_"+R+"_p_evidence",positive_rows_zero:true,
   negative_rows_zero:true,positive_database_exists:true,negative_database_exists:true,
   positive_login_restricted:true,negative_login_restricted:true,
   fenced_writer_execute_allowed:true,direct_fact_insert_forbidden:true,
   pg_owner_id:"pgdb:456:789:postgres"};
  const s3={status:"PASS_SCOPED_DATA_PLANE_ONLY",bucket:p.BUCKET,
   bucket_endpoint:i.bucket_endpoint,bucket_exists:true,
   bucket_empty_including_versions_multipart:true,probe_operations:4};
  const at="2026-11-02T07:00:00.000Z";
  const opts={observedAt:at,completedAt:"2026-11-02T07:00:01.000Z",
   sourceSha:"a".repeat(64)};
  const raw=p.composeFormalReadback(i,source,pg,s3,opts);
  assert.equal(raw.status,"PASS");
  for(const name of require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs").FACT_BINDINGS)
   assert(Object.hasOwn(raw,name),"V1 fact missing: "+name);
  assert.throws(()=>p.composeFormalReadback(i,source,pg,{...s3,probe_operations:3},opts),
   /OWNER_FORMAL_S3_NOT_FOUR_NATIVE_READS/);
  assert.throws(()=>p.composeFormalReadback(i,source,pg,s3,{
   ...opts,completedAt:"2026-11-02T07:02:01.000Z"}),/OWNER_FORMAL_READBACK_STALE/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
