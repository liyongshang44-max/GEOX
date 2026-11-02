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
 // Synthetic POSITIVE proves exact source/signature wiring only, not a real
 // Windows native source or permission to sign/issue/execute.
 // The existing V2 operator alone adjudicates scope; no independent key.
 const scope={
  schema_version:"MCFT_CAP09_R4285_CTO_SCOPE_DECISION_V1",
  authority_comment_id:6571636092,
  decision_scope:"R4285_TEST_ONLY_DECLARED_REACHABLE_SURFACES",
  issuer_id:issuer,key_id:kid,run_id:p.RUN,subject_sha:payload.subject_sha,
  host_id:p.HOST,control_sha256:hash(bytesA),inventory_sha256:hash(bytesB),
  covered_surfaces:p.FORMAL_SURFACES,
  unresolved_reachable_sources:[],bucket_private:true,owner_exclusive:true,
  production_bindings_present:false,s3_owner_id:valid.responsibility_record_id,
  verified_at:"2026-11-02T04:29:30.000Z",
  expires_at:"2026-11-02T05:29:30.000Z",
  account_expires_at:"2026-11-05T05:52:27.000Z",
  control_capture_method:"MINIO_NATIVE_ADMIN_READONLY",
  inventory_capture_method:"WINDOWS_DOCKER_AND_APPLICATION_READONLY"};
 const signDecision=q=>({payload:q,signature_base64:crypto.sign(null,
  Buffer.from(p.CTO_DECISION_DOMAIN_V1+canonical(q)),
  privateKey).toString("base64")});
 const {root,i}=context();
 try{
  const inputs={envelope:sign(payload),trust,control_bytes:bytesA,
   inventory_bytes:bytesB,parent_principal_sha256:parent,cto_decision:signDecision(scope)};
  // Decisive negative: both arbitrary, different nonempty text sources with
  // matching SHA-256 and a valid registered operator signature MUST NOT mint
  // a native-source capability or PASS Resource Readback.
  assert.throws(()=>p.verifyFormalEvidence(i,inputs,{now}),
   /HOLD_NATIVE_CONTROL_RAW_JSON_NOT_NATIVE_CAPSULE/);
  const forgedControl={schema_version:p.NATIVE_CONTROL_SCHEMA,run_id:p.RUN,
   subject_sha:payload.subject_sha,host_id:p.HOST,
   observed_at:"2026-11-02T04:29:30.000Z",
   commands:{ADMIN_INFO:{argv:[],stdout_base64:"e30=",exit_code:0}}};
  const controlBytes=Buffer.from(JSON.stringify(forgedControl));
  const changedPayload={...payload,control_evidence_sha256:hash(controlBytes)};
  const forgedScope={...scope,control_sha256:hash(controlBytes)};
  assert.throws(()=>p.verifyFormalEvidence(i,{
   ...inputs,envelope:sign(changedPayload),control_bytes:controlBytes,
   cto_decision:signDecision(forgedScope)},{now}),
   /HOLD_NATIVE_INVENTORY_RAW_JSON_NOT_NATIVE_CAPSULE/);
  assert.throws(()=>p.composeFormalReadback(i,{status:"PASS"},
   {status:"PASS_SCOPED_READONLY"},{status:"PASS_SCOPED_DATA_PLANE_ONLY"},{
   observedAt:"2026-11-02T04:29:40.000Z",
   completedAt:"2026-11-02T04:29:41.000Z",
   sourceSha:"f".repeat(64)}),
   /OWNER_FORMAL_VERIFIED_NATIVE_SOURCE_REQUIRED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
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
test("forged source labels never qualify as independent native capability",()=>{
 const {root,i}=context();
 try{
  const source={kind:"NATIVE_AUTHENTICATED_SOURCE",verifier:"R4285_NATIVE",
   bucket_private:true,owner_exclusive:true,production_bindings_present:false,
   s3_owner_id:"r4285owner:"+"a".repeat(40)};
  const pg={status:"PASS_SCOPED_READONLY"};
  const s3={status:"PASS_SCOPED_DATA_PLANE_ONLY",bucket:p.BUCKET,
   bucket_endpoint:i.bucket_endpoint,bucket_exists:true,
   bucket_empty_including_versions_multipart:true,probe_operations:4};
  assert.throws(()=>p.composeFormalReadback(i,source,pg,s3,{
   observedAt:new Date().toISOString(),completedAt:new Date().toISOString(),
   sourceSha:"a".repeat(64)}),/OWNER_FORMAL_VERIFIED_NATIVE_SOURCE_REQUIRED/);
  assert.throws(()=>p.parse(["--diagnostic-only","--input",
   path.join(root,"missing-input.json")]),/ENOENT/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});


test("native source-only mode denies incomplete CLI and never invokes Owner signer",()=>{
 assert.throws(()=>p.sourceOnly(["--verify-source-only","--input","fake"]),
  /OWNER_NATIVE_SOURCE_ONLY_EXACT_CLI/);
});
test("formal CLI cannot use an unmerged or forged protected-main subject",()=>{
 const {root,i}=context();
 try{
  assert.throws(()=>p.requireLocalProtectedMain(i),
   /OWNER_FORMAL_PROTECTED_MAIN_NATIVE_VERIFY_HOLD/);
  assert.throws(()=>p.parseFormal(["--produce-raw","--input","x"]),
   /OWNER_FORMAL_CLI_EXACT/);
  assert.throws(()=>p.loadFormalSourceSpec(path.join(root,"not-there.json"),root),/ENOENT/);
  assert.throws(()=>p.assertFormalOutputSeparate(i,path.join(root,"raw.json")),
   /OWNER_FORMAL_OUTPUT_INSIDE_SOURCE_OR_RELEASE/);
  assert.equal(p.assertFormalOutputSeparate(i,path.join(os.tmpdir(),
   "external-r4285-raw.json")),true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("native reachable scope has a bounded synthetic PASS and targeted HOLD cases",()=>{
 const target={Id:"a".repeat(64),HostConfig:{PortBindings:{
  "9000/tcp":[{HostIp:"127.0.0.1",HostPort:"59292"}]}},
  NetworkSettings:{Networks:{private:{}}},Config:{Labels:{run:"4285c3ce342c"}}};
 const base={users:[],accounts:["test-account"],policy:[],
  idps:["identity_ldap","identity_openid","identity_plugin","policy_plugin"]
   .map(name=>({name,disabled:true})),
  details:[target],target,account:"test-account",parent:"root-account",
  s3Port:59292,pgPort:55492,now:Date.parse("2026-11-02T10:00:30.000Z"),
  host:{schema:"R4285_HOST_REACHABILITY_V1",observed_at:"2026-11-02T10:00:00.000Z",
   process_count:55,service_count:40,process_refs:[],service_refs:[],
   inaccessible_apps:[],config_unreadable:[],listeners:[
    {port:59292,address:"127.0.0.1"},{port:55492,address:"127.0.0.1"}]}};
 assert.equal(p.assessNativeReachability(base).status,"NATIVE_REACHABLE_SCOPE_VERIFIED");
 const fails=(diff,reason)=>assert.throws(()=>p.assessNativeReachability({
  ...base,...diff}),new RegExp(reason));
 fails({accounts:["test-account","foreign"]},"HOLD_NATIVE_OTHER_MINIO_SERVICE_ACCOUNT");
 fails({users:["foreign"]},"HOLD_NATIVE_OTHER_MINIO_USER");
 fails({idps:[{name:"identity_ldap",disabled:false},...base.idps.slice(1)]},
  "HOLD_NATIVE_EXTERNAL_AUTH_PLUGIN");
 fails({details:[target,{Id:"b".repeat(64),Config:{Labels:{}},
  NetworkSettings:{Networks:{private:{}}}}]},
  "HOLD_NATIVE_UNAUTHORIZED_DOCKER_NETWORK_PEER");
 fails({host:{...base.host,process_refs:[123]}},"HOLD_NATIVE_HOST_PROCESS_REFS");
 fails({host:{...base.host,service_refs:["foreign-service"]}},
  "HOLD_NATIVE_HOST_SERVICE_REFS");
 fails({host:{...base.host,config_unreadable:[4]}},"HOLD_NATIVE_HOST_CONFIG_UNREADABLE");
 fails({host:{...base.host,observed_at:"2026-11-02T09:50:00.000Z"}},
  "HOLD_NATIVE_HOST_STALE");
 fails({host:{...base.host,listeners:[
  {port:59292,address:"0.0.0.0"},{port:55492,address:"127.0.0.1"}]}},
  "HOLD_NATIVE_HOST_LISTENER_NOT_LOOPBACK");
 assert.equal(p.parseDisabledIdentity(Buffer.from("identity_ldap enable=off"),
  "identity_ldap").disabled,true);
 assert.throws(()=>p.parseDisabledIdentity(
  Buffer.from("identity_ldap enable=on server_addr=ldap.example:389"),
  "identity_ldap"),/HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED/);
});

test("ephemeral current capture mode requires a real bounded Windows input and cannot mint owner",()=>{
 assert.throws(()=>p.sourceOnly(["--verify-source-only","--input",
  "nonexistent","--capture-current"]),/OWNER_PRODUCER_ONLY_DIAGNOSTIC_ALLOWED/);
 const source=fs.readFileSync(path.join(__dirname,
  "MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V2.cjs"),"utf8");
 const body=source.split("function captureCurrentNativeSourceOnly(i,env=process.env){")[1]
  ?.split("\nfunction sourceOnly(argv){")[0];
 assert(body&&body.includes("verifyNativeSourceRaw(i,controlBytes,inventoryBytes"));
 assert(body.includes("raw_bytes_persisted:false"));
 assert(!body.includes("fs.writeFileSync")&&!body.includes("fs.openSync"));
});

test("native Windows survey scans quoted and unquoted process/service config references without exposing contents",()=>{
 const s=fs.readFileSync(path.join(__dirname,
  "MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V2.cjs"),"utf8");
 const part=s.split("function liveReachability(i,env,alias,account,details,target,now){")[1]
  ?.split("\nfunction verifyNativeSourceRaw(")[0];
 assert(part&&part.includes("$serviceFlags="));
 assert(part.includes("$flags="));
 assert(part.includes("if(!$f){$f=$m.Groups[2].Value}"));
 assert(part.includes("String(s3Port),String(pgPort)"));
 assert(!part.includes("console.log($c)"));
});

test("replacement access-key policy is embedded; no nonexistent named MinIO policy dependency",()=>{
 const source=fs.readFileSync(path.join(__dirname,
  "MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V2.cjs"),"utf8");
 assert(!source.includes("MCFT_CAP09_R4285_EXISTING_MC_POLICY"));
 assert(!source.includes('"admin","policy","info"'));
 const command='"--json","admin","accesskey","info",alias,acct';
 assert(source.includes(command));
 assert(source.includes("HOLD_NATIVE_INLINE_POLICY_ACCESS_KEY_IDENTITY"));
 assert(source.includes('verifyReplacementPolicyV2(JSON.parse(found[0]))'));
});
