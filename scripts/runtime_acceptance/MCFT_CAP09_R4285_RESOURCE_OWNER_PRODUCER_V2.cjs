"use strict";
/*
 * R4285 independent, Windows-only Resource Owner physical probe.
 * No provisioning, signer, Permit issuer or six-stage dispatcher. The default
 * diagnostic cannot create a PASS Readback or modify PG/S3/authority files.
 * The formal producer fails closed on facts a scoped read-only credential
 * cannot independently prove (notably global exclusive ownership).
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),os=require("node:os");
const {performance}=require("node:perf_hooks");
const owner=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs");
const pgContract=require("./MCFT_CAP09_R4285_PG_READONLY_V1.cjs");
const RUN="4285c3ce342c",HOST="LAPTOP-STN2A2P1";
const SCHEMA="MCFT_CAP09_R4285_RESOURCE_READBACK_V1";
const PROBE="WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST";
const H=/^[a-f0-9]{40}$/,X=/^[a-f0-9]{64}$/;
const POS="mcft_cap09_requal_"+RUN+"_positive",NEG="mcft_cap09_requal_"+RUN+"_negative";
const BUCKET="mcft-cap09-requal-"+RUN;
const FENCED=pgContract.FENCED_WRITER;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const round=n=>Math.round(n*1000)/1000;
const PG_SAFELIST=new Set(["28P01","28000","3D000","42501","42P01","42883",
 "42703","42601","57P03","53300","08001","08006","ECONNREFUSED",
 "ETIMEDOUT","ENOTFOUND","EHOSTUNREACH","ECONNRESET","EAI_AGAIN"]);
function pgFailureCode(error,side,phase){
 // Never serialize pg Error.message, query text, connectionString, cause,
 // stack, parameters or credentials. Only audited constant error categories.
 assert(["positive","negative"].includes(side),"OWNER_PRODUCER_DIAGNOSTIC_SIDE");
 assert(/^[A-Z0-9_]+$/.test(phase),"OWNER_PRODUCER_DIAGNOSTIC_PHASE");
 if(error?.code==="ERR_ASSERTION"&&
  /^OWNER_PRODUCER_PG_[A-Z0-9_]+$/.test(error.message||""))
  return error.message;
 const code=typeof error?.code==="string"&&PG_SAFELIST.has(error.code)?
  error.code:"UNKNOWN";
 return "OWNER_PRODUCER_PG_"+side.toUpperCase()+"_"+phase+"_"+code;
}
const keys=["source_root","release_root","subject_sha","database_port","bucket_endpoint"];
function exact(o,fields,label){
 assert(o&&typeof o==="object"&&!Array.isArray(o),label);
 assert.deepEqual(Object.keys(o).sort(),fields.slice().sort(),label);
}
function host(){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,
  "OWNER_PRODUCER_WINDOWS_NONCI_REQUIRED");
 assert.equal(os.hostname().toUpperCase(),HOST,"OWNER_PRODUCER_EXACT_HOST_REQUIRED");
 for(const k of ["NODE_OPTIONS","NODE_PATH","PYTHONHOME","PYTHONPATH","MCFT_R4285_CHILD"])
  assert(!process.env[k],"OWNER_PRODUCER_INJECTION_FORBIDDEN");
}
function validateInput(i){
 exact(i,keys,"OWNER_PRODUCER_INPUT_EXACT");
 for(const k of ["source_root","release_root"]){
  assert(typeof i[k]==="string"&&path.isAbsolute(i[k]),"OWNER_PRODUCER_ABSOLUTE_ROOT");
  assert(fs.existsSync(i[k])&&fs.statSync(i[k]).isDirectory(),"OWNER_PRODUCER_ROOT_UNAVAILABLE");
 }
 assert(H.test(i.subject_sha),"OWNER_PRODUCER_SUBJECT_REQUIRED");
 assert(Number.isInteger(i.database_port)&&i.database_port>=1024&&i.database_port<=65535,
  "OWNER_PRODUCER_PG_PORT");
 const historicPG=[5432,5433,55434,55432,55445,55446,55477,55478,55479,55480,55481,55482];
 assert(!historicPG.includes(i.database_port),"OWNER_PRODUCER_HISTORIC_PG_PORT");
 const u=new URL(i.bucket_endpoint);
 assert(u.protocol==="http:"&&u.hostname==="127.0.0.1"&&u.pathname==="/"&&
  !u.username&&!u.password&&!u.hash&&!u.search,"OWNER_PRODUCER_S3_ENDPOINT_SCOPE");
 assert(+u.port>=1024&&+u.port<=65535&&
  ![59000,9000,9001,9002,59005,59006,59277,59278,59279,59280,59281,59282].includes(+u.port),
  "OWNER_PRODUCER_S3_HISTORIC_PORT");
 return i;
}
function parseUrl(raw,i,side){
 assert(typeof raw==="string"&&raw.length>0,"OWNER_PRODUCER_PG_SCOPED_CREDENTIAL_ABSENT:"+side);
 let url;try{url=new URL(raw);}catch{throw Error("OWNER_PRODUCER_PG_SCOPED_URL_INVALID");}
 const db=side==="positive"?POS:NEG;
 const role="cap09_"+RUN+"_"+(side==="positive"?"p_evidence":"n_evidence");
 assert(["postgres:","postgresql:"].includes(url.protocol)&&url.hostname==="127.0.0.1"&&
  +url.port===i.database_port&&!url.search&&!url.hash&&url.password&&
  decodeURIComponent(url.pathname.slice(1))===db&&decodeURIComponent(url.username)===role,
  "OWNER_PRODUCER_PG_SCOPE_MISMATCH:"+side);
 return {db,role,raw,side};
}
function pgTarget(i,env){
 const positive=parseUrl(env.DATABASE_URL,i,"positive");
 const negative=parseUrl(env.BLOCKED_DATABASE_URL,i,"negative");
 assert(positive.raw!==negative.raw,"OWNER_PRODUCER_PG_DATABASE_PAIR_COLLISION");
 return {positive,negative};
}
function s3Target(i,env){
 assert(env.MCFT_CAP09_FORMAL_RAW_BUCKET===BUCKET &&
  env.MCFT_CAP09_FORMAL_RAW_ENDPOINT===i.bucket_endpoint,
  "OWNER_PRODUCER_S3_SCOPE_MISMATCH");
 for(const k of ["MCFT_CAP09_FORMAL_RAW_REGION","MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID",
  "MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY"])
  assert(typeof env[k]==="string"&&env[k].length>0,
   "OWNER_PRODUCER_S3_CREDENTIAL_ABSENT");
 assert(!["root","minioadmin"].includes(env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID),
  "OWNER_PRODUCER_S3_ROOT_CREDENTIAL_FORBIDDEN");
 return {bucket:BUCKET,endpoint:i.bucket_endpoint};
}
function noLinks(p){
 let current=path.resolve(p);for(;;){
  assert(!fs.lstatSync(current).isSymbolicLink(),"OWNER_PRODUCER_REPARSE_FORBIDDEN");
  const up=path.dirname(current);if(up===current)break;current=up;
 }
}
function probeCatalogFacts(data){
 // Entire physical observation must be within a READ ONLY transaction.
 const {id,tables,acl,factsCount,selectRights,databaseOwner,databaseOid,roleCaps}=data;
 assert.equal(id.session_user,data.expectedRole,"OWNER_PRODUCER_PG_SESSION_LOGIN");
 assert.equal(id.current_user,data.expectedRole,"OWNER_PRODUCER_PG_EFFECTIVE_LOGIN");
 assert.equal(id.database,data.expectedDb,"OWNER_PRODUCER_PG_DATABASE_ID");
 assert.deepEqual(tables,pgContract.REQUIRED_PUBLIC_TABLES,"OWNER_PRODUCER_PG_EXACT_29_TABLES");
 assert(acl.fenced_exists===true&&acl.fenced_execute===true&&acl.direct_insert===false&&
  acl.controller_acl===true,"OWNER_PRODUCER_PG_FENCED_ACL_INVALID");
 assert(roleCaps && Object.values(roleCaps).every(x=>x===false),
  "OWNER_PRODUCER_PG_LOGIN_NOT_RESTRICTED");
 // Host contract: 29 exact public table identities, and exact
 // public.facts row counts using the scoped Evidence-login authority.
 assert.equal(factsCount,"0","OWNER_PRODUCER_PG_FACTS_NOT_EMPTY");
 assert(Array.isArray(selectRights)&&selectRights.length===29,
  "OWNER_PRODUCER_PG_SELECT_ACL_INVENTORY_INCOMPLETE");
 const controllerNames=["twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1"];
 for(const n of ["facts",...controllerNames]){
  assert(selectRights.some(x=>x.name===n&&x.allowed===true),
   "OWNER_PRODUCER_PG_REQUIRED_SELECT_DENIED");
 }
 assert.deepEqual(selectRights.map(x=>x.name).sort(),tables.slice().sort(),
  "OWNER_PRODUCER_PG_SELECT_ACL_NAMES_MISMATCH");
 // Database ownership belongs to the PostgreSQL control plane and must
 // NOT be confused with scoped Evidence login permissions. Database owner may
 // legitimately be the cluster bootstrap/admin role; restricted access is
 // independently proven from the authenticated session_user and pg_roles.
 // An owner name/DB OID is only a current catalog identity, NOT proof of
 // exclusive Resource Owner authority or absence of production bindings.
 assert(Number.isInteger(databaseOid)&&databaseOid>0&&
  typeof databaseOwner==="string"&&
  /^[a-z_][a-z0-9_]{0,62}$/.test(databaseOwner),
  "OWNER_PRODUCER_PG_DATABASE_OWNER_CATALOG_INVALID");
 return {owner_role:databaseOwner,oid:databaseOid,
  database_owner_restriction_verified:false,
  database_owner_exclusivity_verified:false,
  role:data.expectedRole,
  tables:tables.length,facts_rows_zero:true,
  // 28 non-facts tables are not claimed empty by the scoped identity.
  other_28_table_rows_verified:false,restricted_role:true,
  denied_select_tables:selectRights.filter(x=>x.allowed!==true).map(x=>x.name)};
}
async function pgOne(pg,binding){
 const pool=new pg.Pool({connectionString:binding.raw,max:1,connectionTimeoutMillis:5000,
  query_timeout:5000,statement_timeout:5000});
 let client,started=false,phase="CONNECT";
 try{
  client=await pool.connect();
  phase="BEGIN_READ_ONLY";
  await client.query("BEGIN TRANSACTION READ ONLY");started=true;
  phase="IDENTITY";
  const id=(await client.query("SELECT session_user::text AS session_user,current_user::text AS current_user,current_database()::text AS database")).rows[0];
  phase="DATABASE_CATALOG";
  const own=(await client.query("SELECT d.oid::int AS oid,r.rolname::text AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=current_database() AND d.datallowconn=true AND d.datistemplate=false")).rows;
  assert.equal(own.length,1,"OWNER_PRODUCER_PG_DATABASE_CATALOG_MISMATCH");
  phase="ROLE_CATALOG";
  const roles=(await client.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=session_user")).rows;
  assert.equal(roles.length,1,"OWNER_PRODUCER_PG_ROLE_NOT_IN_CATALOG");
  phase="TABLE_CATALOG";
  const tables=(await client.query("SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname")).rows.map(x=>x.name);
  phase="FENCED_ACL";
  const p=(await client.query(
   "SELECT to_regprocedure($1::text) IS NOT NULL AS fenced_exists,"+
   "has_table_privilege(current_user,'public.facts','INSERT') AS direct_insert",[FENCED])).rows[0];
  const fencedExecute=p.fenced_exists?
   (await client.query("SELECT has_function_privilege(current_user,$1::text,'EXECUTE') AS allowed",[FENCED])).rows[0].allowed:false;
  const controller=(await client.query(
   "SELECT bool_and(has_table_privilege(current_user,'public.'||name,'SELECT') AND "+
   "has_table_privilege(current_user,'public.'||name,'INSERT') AND "+
   "has_table_privilege(current_user,'public.'||name,'UPDATE')) AS allowed "+
   "FROM (VALUES ('twin_external_formal_forcing_base_cursor_v1'),"+
   "('twin_external_formal_forcing_base_target_v1'),"+
   "('twin_external_formal_forcing_controller_lease_v1')) AS t(name)")).rows[0].allowed;

  // Inventory 29 exact SELECT grants. No COUNT on Twin internal tables
  // lacking Evidence SELECT privilege: intentional least-privilege design.
  // No denial is interpreted as a zero-row table.
  phase="TABLE_SELECT_PRIVILEGES";
  const selectRights=(await client.query(
   "SELECT t.name::text AS name, has_table_privilege(current_user,"+
   "format('%I.%I','public',t.name),'SELECT') AS allowed "+
   "FROM unnest($1::text[]) AS t(name)",
   [pgContract.REQUIRED_PUBLIC_TABLES])).rows;
  assert.equal(selectRights.length,29,"OWNER_PRODUCER_PG_SELECT_ACL_INVENTORY_INCOMPLETE");
  phase="FACTS_COUNT";
  const factsCount=(await client.query("SELECT count(*)::text AS n FROM public.facts")).rows[0]?.n;
  phase="FACT_CONTRACT";
  return probeCatalogFacts({id,tables,acl:{...p,fenced_execute:fencedExecute,controller_acl:controller},
   factsCount,selectRights,databaseOwner:own[0].owner,databaseOid:own[0].oid,
   roleCaps:roles[0],expectedRole:binding.role,expectedDb:binding.db});
 }catch(error){
  const safelyClassified=Error(
   error?.message==="OWNER_PRODUCER_PG_TABLE_SELECT_DENIED"?
    "OWNER_PRODUCER_PG_"+binding.side.toUpperCase()+"_TABLE_SELECT_DENIED":
    pgFailureCode(error,binding.side,phase));
  if(Array.isArray(error?.denied_tables)){
   // Only public names from the frozen 29-table allowlist, never server text.
   const safe=error.denied_tables.filter(name=>
    pgContract.REQUIRED_PUBLIC_TABLES.includes(name));
   if(safe.length===error.denied_tables.length)
    safelyClassified.denied_tables=safe;
  }
  throw safelyClassified;
 }finally{
  if(client){if(started){try{await client.query("ROLLBACK");}catch{}}
   client.release();}
  await pool.end();
 }
}
async function probePg(i,env){
 const target=pgTarget(i,env);
 let pg;
 try{pg=require(require.resolve("pg",{paths:[i.release_root]}));}
 catch{throw Error("OWNER_PRODUCER_PG_CLIENT_MODULE_UNAVAILABLE");}
 const a=await pgOne(pg,target.positive),b=await pgOne(pg,target.negative);
 assert(a.oid!==b.oid&&a.role!==b.role,"OWNER_PRODUCER_PG_SCOPE_COLLISION");
 // Catalog IDs are direct authenticated DB data, not a caller-provided label.
 return {status:"PASS_SCOPED_READONLY",positive_database:POS,negative_database:NEG,
  database_host:"127.0.0.1",database_port:i.database_port,audit_user:a.role,
  positive_rows_zero:a.facts_rows_zero,negative_rows_zero:b.facts_rows_zero,
  verified_zero_table:"public.facts",other_28_table_rows_verified:false,
  positive_database_exists:true,negative_database_exists:true,
  positive_login_restricted:a.restricted_role,negative_login_restricted:b.restricted_role,
  fenced_writer_execute_allowed:true,direct_fact_insert_forbidden:true,
  pg_owner_id:"pgdb:"+a.oid+":"+b.oid+":"+a.owner_role,
  probe_command_families:["BEGIN TRANSACTION READ ONLY","pg_catalog.pg_database","pg_catalog.pg_roles",
   "pg_catalog.pg_class","29x has_table_privilege SELECT per database",
    "has_function_privilege","1x public.facts exact COUNT per database","ROLLBACK"],
  probes:{positive:{table_count:a.tables,database_catalog_owner:a.owner_role,
    database_owner_exclusivity_verified:false,
    denied_select_tables:a.denied_select_tables},
   negative:{table_count:b.tables,database_catalog_owner:b.owner_role,
    database_owner_exclusivity_verified:false,
    denied_select_tables:b.denied_select_tables}}};
}
/*
 * Forward-only R4285 Owner Authority Binding V2.
 * This is a signed responsibility assignment and exact successor S3 policy
 * source, not a fabricated MinIO ACL owner, live control readback, Owner PASS,
 * or authority to issue Permit/execute.
 */
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const OWNER_BINDING_DOMAIN_V2="GEOX_MCFT_CAP09_R4285_RESOURCE_RESPONSIBILITY_ASSIGNMENT_V2\n";
const OWNER_BINDING_ID_DOMAIN_V2="GEOX_MCFT_CAP09_R4285_RESPONSIBILITY_RECORD_ID_V2\n";
const BUCKET_ARN="arn:aws:s3:::"+BUCKET;
const RAW_ARN=BUCKET_ARN+"/mcft-cap09-formal-raw-v1/sha256/*";
const CANDIDATE_ARN=BUCKET_ARN+"/mcft-cap09-formal-candidate-v1/sha256/*";
const ASSIGNMENT_FIELDS_V2=Object.freeze([
 "schema_version","issuer_id","key_id","run_id","subject_sha","host_id",
 "scope","production_authorized","authority_comment_id","authorized_operator_id",
 "issued_at","expires_at","minio_deployment_id","volume_name","bucket_endpoint",
 "bucket","bucket_arn","raw_prefix_arn","candidate_prefix_arn",
 "parent_principal_sha256","policy_sha256","control_evidence_sha256",
 "inventory_evidence_sha256"
]);
function replacementPolicyV2(){
 // Seven exact Action/Resource pairs. Prefix wildcards are deliberately
 // limited to the two signed R4285 object namespaces; no bucket-wide '*' ARN.
 return {Version:"2012-10-17",Statement:[
  {Sid:"R4285BucketInventoryOnly",Effect:"Allow",
   Action:["s3:ListBucket","s3:ListBucketVersions","s3:ListBucketMultipartUploads"],
   Resource:[BUCKET_ARN]},
  {Sid:"R4285FormalSha256EvidenceOnly",Effect:"Allow",
   Action:["s3:GetObject","s3:PutObject"],
   Resource:[RAW_ARN,CANDIDATE_ARN]}
 ]};
}
function replacementPolicyBytesV2(){
 return Buffer.from(lineage.canonical(replacementPolicyV2())+"\n","utf8");
}
function verifyReplacementPolicyV2(policy){
 assert.equal(lineage.canonical(policy),lineage.canonical(replacementPolicyV2()),
  "OWNER_BINDING_POLICY_SEVEN_EXACT_PAIRS_REQUIRED");
 return Object.freeze({sha256:sha(replacementPolicyBytesV2()),pairs:7,
  bucket_arn:BUCKET_ARN,raw_prefix_arn:RAW_ARN,candidate_prefix_arn:CANDIDATE_ARN});
}
function verifyOwnerAuthorityBindingV2(envelope,trust,ctx){
 // Two independent raw-source byte strings must be supplied. SHA equivalence
 // proves binding only; it cannot certify probe provenance or physical truth.
 exact(envelope,["payload","signature_base64"],"OWNER_BINDING_ENVELOPE_EXACT");
 const p=envelope.payload;
 exact(p,ASSIGNMENT_FIELDS_V2,"OWNER_BINDING_PAYLOAD_EXACT");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_OWNER_AUTHORITY_BINDING_V2");
 assert.equal(p.run_id,RUN);
 assert.equal(p.subject_sha,ctx?.subject_sha,"OWNER_BINDING_SUBJECT");
 assert(H.test(p.subject_sha),"OWNER_BINDING_SUBJECT_FORMAT");
 assert.equal(p.host_id,HOST,"OWNER_BINDING_HOST");
 assert.equal(ctx.host_id,HOST,"OWNER_BINDING_CONTEXT_HOST");
 assert.equal(p.scope,"R4285_ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.production_authorized,false,"OWNER_BINDING_PRODUCTION_FORBIDDEN");
 assert.equal(p.authority_comment_id,6569014082,"OWNER_BINDING_CTO_SOURCE_CHANGED");
 assert.equal(p.minio_deployment_id,"ddbc6bb9-eb52-4b95-8324-b556697f8c0e",
  "OWNER_BINDING_DEPLOYMENT");
 assert.equal(p.volume_name,"mcftcap09-r4285c3ce342c-s3data","OWNER_BINDING_VOLUME");
 assert.equal(p.bucket_endpoint,"http://127.0.0.1:59292/","OWNER_BINDING_ENDPOINT");
 assert.equal(p.bucket,BUCKET,"OWNER_BINDING_BUCKET");
 assert.equal(p.bucket_arn,BUCKET_ARN,"OWNER_BINDING_BUCKET_ARN");
 assert.equal(p.raw_prefix_arn,RAW_ARN,"OWNER_BINDING_RAW_ARN");
 assert.equal(p.candidate_prefix_arn,CANDIDATE_ARN,"OWNER_BINDING_CANDIDATE_ARN");
 assert.equal(p.policy_sha256,verifyReplacementPolicyV2(replacementPolicyV2()).sha256,
  "OWNER_BINDING_POLICY_SHA");
 assert(X.test(p.parent_principal_sha256)&&
  p.parent_principal_sha256===ctx.parent_principal_sha256,
  "OWNER_BINDING_PARENT_SOURCE");
 for(const [field,bytes] of [
  ["control_evidence_sha256",ctx.control_evidence_bytes],
  ["inventory_evidence_sha256",ctx.inventory_evidence_bytes]
 ]){
  assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<1048576,
   "OWNER_BINDING_INDEPENDENT_RAW_BYTES_REQUIRED:"+field);
  assert(X.test(p[field])&&p[field]===sha(bytes),
   "OWNER_BINDING_INDEPENDENT_RAW_DIGEST:"+field);
 }
 assert.equal(trust?.schema_version,"geox_mcft_cap09_retry_trust_v1",
  "OWNER_BINDING_TRUST_SCHEMA");
 assert.equal(trust.host_id,HOST,"OWNER_BINDING_TRUST_HOST");
 assert(Array.isArray(trust.issuers),"OWNER_BINDING_TRUST_ISSUERS");
 assert.equal(p.authorized_operator_id,trust.operator_id,
  "OWNER_BINDING_ACCOUNTABLE_OPERATOR");
 const candidates=trust.issuers.filter(k=>k.issuer_id===p.issuer_id&&k.key_id===p.key_id);
 assert.equal(candidates.length,1,"OWNER_BINDING_SIGNER_UNIQUE");
 const signer=candidates[0];
 assert.equal(signer.revoked,false,"OWNER_BINDING_SIGNER_REVOKED");
 assert.equal(signer.role,"ACCOUNTABLE_SINGLE_OPERATOR","OWNER_BINDING_ROLE");
 assert.equal(signer.issuer_id,trust.operator_id,"OWNER_BINDING_SIGNER_AUTHORITY");
 const time=t=>{
  assert(typeof t==="string"&&Number.isFinite(Date.parse(t))&&
   new Date(t).toISOString()===t,"OWNER_BINDING_UTC");
  return Date.parse(t);
 };
 const now=ctx.now??Date.now(),issued=time(p.issued_at),expires=time(p.expires_at);
 assert(issued<=now&&now<expires&&expires-issued<=86400000,
  "OWNER_BINDING_WINDOW");
 assert(time(signer.not_before)<=issued&&expires<=time(signer.not_after),
  "OWNER_BINDING_KEY_WINDOW");
 const pub=crypto.createPublicKey(signer.public_key_pem);
 assert.equal(pub.asymmetricKeyType,"ed25519","OWNER_BINDING_KEY_TYPE");
 assert.equal(sha(pub.export({type:"spki",format:"der"})),signer.spki_sha256,
  "OWNER_BINDING_KEY_FINGERPRINT");
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,
  "OWNER_BINDING_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(OWNER_BINDING_DOMAIN_V2+lineage.canonical(p)),pub,sig),
  "OWNER_BINDING_SIGNATURE_INVALID");
 const responsibilityRecordId="r4285owner:"+sha(Buffer.from(
  OWNER_BINDING_ID_DOMAIN_V2+lineage.canonical(p))).slice(0,40);
 return Object.freeze({
  status:"R4285_SIGNED_RESPONSIBILITY_AND_RAW_DIGESTS_BOUND_NOT_PHYSICAL_OWNER",
  responsibility_record_id:responsibilityRecordId,
  run_id:RUN,subject_sha:p.subject_sha,policy_sha256:p.policy_sha256,
  signer_operator_id:trust.operator_id,control_readback_provenance_verified:false,
  owner_exclusive_verified:false,production_bindings_absent_verified:false,
  formal_readback_issued:false,permit_issued:false,execute_authorized:false
 });
}

function assertS3Private(acl,policyResult){
 assert(acl?.Owner?.ID && /^[A-Za-z0-9_.:-]{12,128}$/.test(acl.Owner.ID),
  "OWNER_PRODUCER_S3_OWNER_ID_UNAVAILABLE");
 assert(Array.isArray(acl.Grants)&&acl.Grants.length>0,
  "OWNER_PRODUCER_S3_ACL_MISSING");
 assert(acl.Grants.every(x=>x.Grantee?.Type==="CanonicalUser" &&
  x.Grantee.ID===acl.Owner.ID),"OWNER_PRODUCER_S3_PUBLIC_OR_EXTERNAL_GRANT");
 assert(policyResult==="NO_BUCKET_POLICY",
  "OWNER_PRODUCER_S3_POLICY_PRIVACY_NOT_PROVEN");
 return acl.Owner.ID;
}
async function probeS3(i,env){
 // The preexisting restricted account performs only the four approved
 // read-only S3 data-plane calls. No ACL/policy privilege expansion.
 s3Target(i,env);
 let sdk;
 try{sdk=require(require.resolve("@aws-sdk/client-s3",{paths:[i.release_root]}));}
 catch{throw Error("OWNER_PRODUCER_S3_CLIENT_MODULE_UNAVAILABLE");}
 const {S3Client,HeadBucketCommand,ListObjectsV2Command,
  ListObjectVersionsCommand,ListMultipartUploadsCommand}=sdk;
 for(const f of [S3Client,HeadBucketCommand,ListObjectsV2Command,
  ListMultipartUploadsCommand])
  assert(typeof f==="function","OWNER_PRODUCER_S3_CLIENT_INCOMPLETE");
 const client=new S3Client({endpoint:i.bucket_endpoint,region:env.MCFT_CAP09_FORMAL_RAW_REGION,
  forcePathStyle:true,maxAttempts:1,credentials:{
   accessKeyId:env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID,
   secretAccessKey:env.MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY}});
 let phase="HEAD_BUCKET";
 try{
  await client.send(new HeadBucketCommand({Bucket:BUCKET}));
  phase="LIST_OBJECTS";
  const objects=await client.send(new ListObjectsV2Command({Bucket:BUCKET,MaxKeys:2}));
  assert(!objects.IsTruncated&&!(objects.Contents||[]).length,
   "OWNER_PRODUCER_S3_OBJECTS_EXIST");
  phase="LIST_VERSIONS";
  const versions=await client.send(new ListObjectVersionsCommand({Bucket:BUCKET,MaxKeys:2}));
  assert(!versions.IsTruncated&&!(versions.Versions||[]).length&&
   !(versions.DeleteMarkers||[]).length,
   "OWNER_PRODUCER_S3_VERSIONS_OR_MARKERS_EXIST");
  phase="LIST_MULTIPART";
  const uploads=await client.send(new ListMultipartUploadsCommand({Bucket:BUCKET,MaxUploads:2}));
  assert(!uploads.IsTruncated&&!(uploads.Uploads||[]).length,
   "OWNER_PRODUCER_S3_MULTIPART_EXIST");
  return {status:"PASS_SCOPED_DATA_PLANE_ONLY",bucket_endpoint:i.bucket_endpoint,
   bucket:BUCKET,bucket_exists:true,bucket_empty_including_versions_multipart:true,
   bucket_private_verified:false,s3_owner_id_verified:false,
   independent_control_plane_verified:false,production_bindings_absence_verified:false,
   probe_operations:4,probe_commands:["HeadBucket","ListObjectsV2",
    "ListObjectVersions","ListMultipartUploads"]};
 }catch(e){
  // Never serialize SDK errors containing signed headers/URLs.
  if(typeof e?.message==="string"&&/^OWNER_PRODUCER_S3_[A-Z0-9_]+$/.test(e.message))throw e;
  const allowed=new Set(["AccessDenied","InvalidAccessKeyId","SignatureDoesNotMatch",
   "ExpiredToken","NoSuchBucket","NotImplemented","ECONNREFUSED","ETIMEDOUT"]);
  const code=allowed.has(e?.name)?e.name:allowed.has(e?.code)?e.code:"UNKNOWN";
  throw Error("OWNER_PRODUCER_S3_"+phase+"_"+code);
 }finally{client.destroy();}
}
async function timed(label,fn){
 const now=performance.now();
 try{
  const result=await fn();return {component:label,
   status:result?.status==="PASS_SCOPED_DATA_PLANE_ONLY"?
    "HOLD_INDEPENDENT_CONTROL_PLANE":"PASS_SCOPED_READONLY",
   elapsed_ms:round(performance.now()-now),result};
 }catch(e){
  const reason=typeof e?.message==="string"&&
   /^OWNER_PRODUCER_[A-Z0-9_:]+$/.test(e.message)?
   e.message:"OWNER_PRODUCER_COMPONENT_UNAVAILABLE";
  const result={component:label,status:"HOLD",
   elapsed_ms:round(performance.now()-now),reason_code:reason};
  if(Array.isArray(e?.denied_tables)&&e.denied_tables.every(name=>
   pgContract.REQUIRED_PUBLIC_TABLES.includes(name)))result.denied_tables=e.denied_tables;
  return result;
 }
}
function unresolved(pg,s3){
 const blockers=[];
 if(pg.status!=="PASS_SCOPED_READONLY")blockers.push("PG_AUTHENTICATED_SCOPE_AND_ACL_NOT_PROVEN");
 if(s3.status!=="PASS_SCOPED_READONLY")blockers.push(
  s3.status==="HOLD_INDEPENDENT_CONTROL_PLANE"?
   "S3_INDEPENDENT_ACL_POLICY_OWNER_NOT_PROVEN":
   "S3_EMPTY_VERSIONS_MULTIPART_PRIVATE_NOT_PROVEN");
 // Complete global ownership and absence of all production bindings cannot
 // be inferred from two scoped logins and a single bucket ACL. Formal owner
 // exclusivity needs separately verifiable current resource-control evidence.
 blockers.push("OWNER_EXCLUSIVE_CONTROL_PLANE_NOT_PROVEN");
 blockers.push("PRODUCTION_BINDINGS_ABSENT_NOT_INDEPENDENTLY_PROVEN");
 return blockers;
}
async function diagnostic(i,env=process.env,{s3Only=false}={}){
 host();validateInput(i);noLinks(__filename);
 const start=Date.now(),source_sha=sha(fs.readFileSync(__filename));
 const pg=s3Only?
  {component:"PG_DUAL_DATABASE_READONLY",status:"NOT_REPROBED_S3_ONLY",
   elapsed_ms:0,prior_pg_evidence_not_promoted:true}:
  await timed("PG_DUAL_DATABASE_READONLY",()=>probePg(i,env));
 const s3=await timed("S3_BUCKET_PRIVATE_VERSIONS_MULTIPART_READONLY",()=>probeS3(i,env));
 const blockers=unresolved(pg,s3);
 return {schema_version:"MCFT_CAP09_R4285_OWNER_PRODUCER_NONAUTH_DIAGNOSTIC_V1",
  status:"HOLD_NONAUTH_DIAGNOSTIC_NOT_SIGNED_OWNER",run_id:RUN,host_id:HOST,
  subject_sha:i.subject_sha,probe_type:PROBE,probe_source_sha256:source_sha,
  observed_at:new Date(start).toISOString(),completed_at:new Date().toISOString(),
  pg,s3,blockers,diagnostic_mode:s3Only?"S3_ONLY":"PG_AND_S3",
  source_qualified:false,owner_exclusive_verified:false,
  formal_resource_readback_written:false,permit_issued:false,permit_consumed:false,
  execution_authorized:false,production_authorized:false,original_six_stages_executed:0};
}

// Formal source-bound raw preparation. Existing V2 responsibility signature
// authenticates exact material bytes, but DOES NOT certify their native origin.
// Never convert scope-limited legacy findings into unqualified Owner PASS.
// Unexported capability. Source labels and signatures alone cannot mint this.
const FORMAL_NATIVE_CAPABILITIES=new WeakSet();
const FORMAL_SURFACES=Object.freeze([
 "MINIO_CURRENT_IAM_AND_BUCKET","WINDOWS_CURRENT_DOCKER_AND_STORAGE",
 "NETWORK_INGRESS","APPLICATION_PRODUCTION_REFERENCES",
 "EXTERNAL_PRINCIPAL_REACHABILITY"
]);
function verifyFormalEvidence(i,inputs,{now=Date.now()}={}){
 const {envelope,trust,control_bytes,inventory_bytes,parent_principal_sha256,
  native_audit}=inputs||{};
 assert(Buffer.isBuffer(control_bytes)&&control_bytes.length>0&&control_bytes.length<1048576,
  "OWNER_FORMAL_CONTROL_RAW_BYTES_REQUIRED");
 assert(Buffer.isBuffer(inventory_bytes)&&inventory_bytes.length>0&&inventory_bytes.length<1048576,
  "OWNER_FORMAL_INVENTORY_RAW_BYTES_REQUIRED");
 assert(!control_bytes.equals(inventory_bytes),"OWNER_FORMAL_TWO_DISTINCT_SOURCES_REQUIRED");
 const bound=verifyOwnerAuthorityBindingV2(envelope,trust,{
  subject_sha:i.subject_sha,host_id:HOST,parent_principal_sha256,
  control_evidence_bytes:control_bytes,inventory_evidence_bytes:inventory_bytes,now});
 // Native provenance is a distinct fact from signed SHA-256 equality.
 // No operator-created Boolean, bare file hash or old Docker summary qualifies.
 assert(native_audit&&typeof native_audit==="object"&&!Array.isArray(native_audit),
  "HOLD_INDEPENDENT_NATIVE_AUDIT_PROVENANCE_REQUIRED");
 exact(native_audit,["payload","signature_base64"],"HOLD_NATIVE_AUDIT_ENVELOPE");
 const a=native_audit.payload;
 const fields=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id",
  "control_sha256","inventory_sha256","covered_surfaces","unresolved_reachable_sources",
  "bucket_private","owner_exclusive","production_bindings_present","s3_owner_id",
  "verified_at","expires_at","account_expires_at","control_capture_method",
  "inventory_capture_method"];
 exact(a,fields,"HOLD_NATIVE_AUDIT_EXACT_SOURCE_CONTRACT");
 assert.equal(a.schema_version,"MCFT_CAP09_R4285_NATIVE_AUDIT_VERIFIED_V1",
  "HOLD_NATIVE_AUDIT_SOURCE_SCHEMA");
 assert.equal(a.run_id,RUN,"HOLD_NATIVE_AUDIT_RUN");
 assert.equal(a.subject_sha,i.subject_sha,"HOLD_NATIVE_AUDIT_SUBJECT");
 assert.equal(a.host_id,HOST,"HOLD_NATIVE_AUDIT_HOST");
 assert.equal(a.control_sha256,sha(control_bytes),"HOLD_NATIVE_CONTROL_DIGEST");
 assert.equal(a.inventory_sha256,sha(inventory_bytes),"HOLD_NATIVE_INVENTORY_DIGEST");
 assert.deepEqual(a.covered_surfaces,FORMAL_SURFACES,"HOLD_NATIVE_AUDIT_COVERAGE");
 assert.deepEqual(a.unresolved_reachable_sources,[],"HOLD_NATIVE_AUDIT_REACHABILITY");
 assert.equal(a.s3_owner_id,bound.responsibility_record_id,"HOLD_NATIVE_AUDIT_OWNER_SOURCE");
 assert.equal(a.bucket_private,true,"HOLD_NATIVE_BUCKET_PRIVATE");
 assert.equal(a.owner_exclusive,true,"HOLD_NATIVE_OWNER_EXCLUSIVE");
 assert.equal(a.production_bindings_present,false,"HOLD_NATIVE_PRODUCTION_BINDINGS");
 assert.equal(a.control_capture_method,"MINIO_NATIVE_ADMIN_READONLY",
  "HOLD_NATIVE_CONTROL_CAPTURE_METHOD");
 assert.equal(a.inventory_capture_method,"WINDOWS_DOCKER_AND_APPLICATION_READONLY",
  "HOLD_NATIVE_INVENTORY_CAPTURE_METHOD");
 // Reuse the EXISTING trust registry; a separate qualified auditor cannot
 // be minted by this module or replaced by the accountable Owner signer.
 assert.equal(trust?.schema_version,"geox_mcft_cap09_retry_trust_v1",
  "HOLD_NATIVE_AUDITOR_TRUST");
 const matches=trust.issuers.filter(k=>k.issuer_id===a.issuer_id&&k.key_id===a.key_id);
 assert.equal(matches.length,1,"HOLD_NATIVE_AUDITOR_NOT_IN_EXISTING_TRUST");
 const auditor=matches[0];
 assert.equal(auditor.revoked,false,"HOLD_NATIVE_AUDITOR_REVOKED");
 assert.equal(auditor.role,"INDEPENDENT_RESOURCE_AUDITOR","HOLD_NATIVE_AUDITOR_ROLE");
 assert.notEqual(auditor.issuer_id,envelope.payload.issuer_id,
  "HOLD_NATIVE_AUDITOR_NOT_INDEPENDENT");
 const iso=s=>{assert(typeof s==="string"&&Number.isFinite(Date.parse(s))&&
  new Date(s).toISOString()===s,"HOLD_NATIVE_AUDIT_TIME");return Date.parse(s);};
 const issued=iso(a.verified_at),expires=iso(a.expires_at);
 assert(issued<=now&&now-issued<=120000&&now<expires&&expires-issued<=86400000,
  "HOLD_NATIVE_AUDIT_FRESHNESS");
 assert(iso(a.account_expires_at)>now+10860000,
  "HOLD_NATIVE_ACCOUNT_EXECUTION_BUDGET");
 assert(iso(auditor.not_before)<=issued&&expires<=iso(auditor.not_after),
  "HOLD_NATIVE_AUDITOR_KEY_WINDOW");
 const pub=crypto.createPublicKey(auditor.public_key_pem);
 assert.equal(pub.asymmetricKeyType,"ed25519","HOLD_NATIVE_AUDITOR_KEY_TYPE");
 assert.equal(sha(pub.export({type:"spki",format:"der"})),auditor.spki_sha256,
  "HOLD_NATIVE_AUDITOR_KEY_ID");
 const sig=Buffer.from(native_audit.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===native_audit.signature_base64,
  "HOLD_NATIVE_AUDITOR_SIG_FORMAT");
 const domain="GEOX_MCFT_CAP09_R4285_NATIVE_CONTROL_INVENTORY_AUDIT_V1\n";
 assert(crypto.verify(null,Buffer.from(domain+lineage.canonical(a)),pub,sig),
  "HOLD_NATIVE_AUDITOR_SIGNATURE");
 const native=Object.freeze({
  kind:"NATIVE_AUTHENTICATED_SOURCE",verifier:"R4285_NATIVE",
  bucket_private:true,owner_exclusive:true,production_bindings_present:false,
  s3_owner_id:bound.responsibility_record_id,control_sha256:a.control_sha256,
  inventory_sha256:a.inventory_sha256,
  source_receipt_sha256:sha(Buffer.from(lineage.canonical(native_audit))),
  audit_issuer_id:a.issuer_id});
 FORMAL_NATIVE_CAPABILITIES.add(native);
 return native;
}

// The official command is only valid for a subject matching the locally
// fetched protected-main ref, not an unmerged PR or a fixture branch.
function requireLocalProtectedMain(i){
 const {spawnSync}=require("node:child_process");
 const run=args=>{
  const r=spawnSync("git",["-C",i.source_root,...args],{
   encoding:"utf8",timeout:10000,windowsHide:true});
  assert(r.status===0&&/^[0-9a-f]{40}\s*$/.test(r.stdout||""),
   "OWNER_FORMAL_PROTECTED_MAIN_GIT_UNAVAILABLE");
  return r.stdout.trim();
 };
 assert.equal(run(["rev-parse","HEAD"]),i.subject_sha,
  "OWNER_FORMAL_SOURCE_HEAD_MISMATCH");
 assert.equal(run(["rev-parse","refs/remotes/origin/main"]),i.subject_sha,
  "OWNER_FORMAL_PROTECTED_MAIN_SUBJECT_REQUIRED");
}
function boundedFile(file,max=1048576){
 assert(typeof file==="string"&&path.isAbsolute(file),"OWNER_FORMAL_ABSOLUTE_SOURCE");
 noLinks(file);
 const st=fs.statSync(file);
 assert(st.isFile()&&st.size>0&&st.size<max,"OWNER_FORMAL_SOURCE_FILE_BOUNDS");
 return fs.readFileSync(file);
}
function loadFormalSourceSpec(file){
 const spec=JSON.parse(boundedFile(file,16384).toString("utf8").replace(/^\uFEFF/,""));
 exact(spec,["binding_envelope_file","trust_file","native_audit_file",
  "control_evidence_file","inventory_evidence_file","parent_principal_sha256"],
  "OWNER_FORMAL_SOURCE_SPEC_EXACT");
 const get=f=>JSON.parse(boundedFile(spec[f]).toString("utf8").replace(/^\uFEFF/,""));
 return {envelope:get("binding_envelope_file"),trust:get("trust_file"),
  native_audit:get("native_audit_file"),
  control_bytes:boundedFile(spec.control_evidence_file),
  inventory_bytes:boundedFile(spec.inventory_evidence_file),
  parent_principal_sha256:spec.parent_principal_sha256};
}
async function produceFormalRaw(i,sources,output,env=process.env){
 host();validateInput(i);requireLocalProtectedMain(i);
 assert(typeof output==="string"&&path.isAbsolute(output),"OWNER_FORMAL_OUTPUT_ABSOLUTE");
 assert(!fs.existsSync(output),"OWNER_FORMAL_OUTPUT_EXISTS");
 noLinks(path.dirname(output));
 // If no independently signed authenticated native source can be verified,
 // neither live PG/S3 nor any formal raw file may be produced.
 const verified=verifyFormalEvidence(i,sources);
 const observedAt=new Date().toISOString();
 const pg=await probePg(i,env),s3=await probeS3(i,env);
 const raw=composeFormalReadback(i,verified,pg,s3,{
  observedAt,completedAt:new Date().toISOString(),
  sourceSha:sha(fs.readFileSync(__filename))});
 const bytes=Buffer.from(lineage.canonical(raw)+"\n","utf8");
 const fd=fs.openSync(output,"wx",0o600);
 try{fs.writeFileSync(fd,bytes);}finally{fs.closeSync(fd);}
 return {status:"FORMAL_RAW_ONLY_UNSIGNED_NO_PERMIT",run_id:RUN,
  sha256:sha(bytes),observed_at:raw.observed_at,formal_signed:false,
  permit_issued:false,execution_authorized:false,physical_stages:0};
}
function parseFormal(argv){
 assert(argv.length===7&&argv[0]==="--produce-raw"&&argv[1]==="--input"&&
  argv[3]==="--sources"&&argv[5]==="--output","OWNER_FORMAL_CLI_EXACT");
 return {i:parse(["--diagnostic-only","--input",argv[2]]),
  sources:loadFormalSourceSpec(argv[4]),output:argv[6]};
}

function composeFormalReadback(i,source,pg,s3,{observedAt,completedAt,sourceSha}){
 assert(source&&typeof source==="object"&&FORMAL_NATIVE_CAPABILITIES.has(source),
  "OWNER_FORMAL_VERIFIED_NATIVE_SOURCE_REQUIRED");
 assert.equal(pg?.status,"PASS_SCOPED_READONLY","OWNER_FORMAL_FRESH_PG_REQUIRED");
 assert.equal(s3?.status,"PASS_SCOPED_DATA_PLANE_ONLY","OWNER_FORMAL_FRESH_S3_REQUIRED");
 assert.equal(s3.bucket,BUCKET,"OWNER_FORMAL_S3_SCOPE");
 assert.equal(s3.bucket_endpoint,i.bucket_endpoint,"OWNER_FORMAL_S3_ENDPOINT");
 assert.equal(s3.bucket_exists,true,"OWNER_FORMAL_S3_BUCKET_MISSING");
 assert.equal(s3.bucket_empty_including_versions_multipart,true,
  "OWNER_FORMAL_S3_NOT_EMPTY");
 assert.equal(s3.probe_operations,4,"OWNER_FORMAL_S3_NOT_FOUR_NATIVE_READS");
 const start=Date.parse(observedAt),end=Date.parse(completedAt);
 assert(Number.isFinite(start)&&Number.isFinite(end)&&end>=start&&end-start<=120000,
  "OWNER_FORMAL_READBACK_STALE");
 assert(X.test(sourceSha),"OWNER_FORMAL_SOURCE_SHA");
 return Object.freeze({
  schema_version:SCHEMA,status:"PASS",run_id:RUN,host_id:HOST,
  subject_sha:i.subject_sha,probe_type:PROBE,probe_source_sha256:sourceSha,
  observed_at:observedAt,completed_at:completedAt,production_authorized:false,
  database_host:pg.database_host,database_port:pg.database_port,
  positive_database:pg.positive_database,negative_database:pg.negative_database,
  audit_user:pg.audit_user,positive_rows_zero:pg.positive_rows_zero,
  negative_rows_zero:pg.negative_rows_zero,
  positive_database_exists:pg.positive_database_exists,
  negative_database_exists:pg.negative_database_exists,
  positive_login_restricted:pg.positive_login_restricted,
  negative_login_restricted:pg.negative_login_restricted,
  fenced_writer_execute_allowed:pg.fenced_writer_execute_allowed,
  direct_fact_insert_forbidden:pg.direct_fact_insert_forbidden,
  pg_owner_id:pg.pg_owner_id,bucket_endpoint:i.bucket_endpoint,bucket:BUCKET,
  bucket_exists:s3.bucket_exists,
  bucket_empty_including_versions_multipart:s3.bucket_empty_including_versions_multipart,
  bucket_private:source.bucket_private,
  production_bindings_present:source.production_bindings_present,
  owner_exclusive:source.owner_exclusive,s3_owner_id:source.s3_owner_id,
  source_evidence_sha256:Object.freeze({
   control:source.control_sha256,inventory:source.inventory_sha256,
   verified_receipt:source.source_receipt_sha256})
 });
}

function parse(argv){
 assert(argv.length===3&&["--diagnostic-only","--s3-only-diagnostic"].includes(argv[0])&&
  argv[1]==="--input"&&
  path.isAbsolute(argv[2]),"OWNER_PRODUCER_ONLY_DIAGNOSTIC_ALLOWED");
 noLinks(argv[2]);const st=fs.statSync(argv[2]);
 assert(st.isFile()&&st.size>0&&st.size<16384,"OWNER_PRODUCER_INPUT_FILE_INVALID");
 const input=JSON.parse(fs.readFileSync(argv[2],"utf8").replace(/^\uFEFF/,""));
 return validateInput(input);
}
if(require.main===module&&process.argv[2]==="--produce-raw"){
 Promise.resolve().then(()=>parseFormal(process.argv.slice(2)))
  .then(x=>produceFormalRaw(x.i,x.sources,x.output)).then(x=>{
   process.stdout.write(JSON.stringify(x)+"\n");
  }).catch(e=>{
   const reason=/^(OWNER_FORMAL_|OWNER_BINDING_|HOLD_NATIVE_)/.test(e?.message||"")?
    e.message:"OWNER_FORMAL_SOURCE_OR_PHYSICAL_PROBE_NOT_QUALIFIED";
   process.stdout.write(JSON.stringify({status:"HOLD_FORMAL_READBACK_NOT_ISSUED",
    reason_code:reason,formal_signed:false,permit_issued:false,
    execution_authorized:false,physical_stages:0})+"\n");
   process.exitCode=2;
  });
}else if(require.main===module){
 Promise.resolve().then(()=>diagnostic(
  parse(process.argv.slice(2)),process.env,
  {s3Only:process.argv[2]==="--s3-only-diagnostic"})).then(x=>{
  process.stdout.write(JSON.stringify(x,null,2)+"\n");
  // A completed diagnostic is not a successfully qualified Owner.
  if(x.status!=="PASS")process.exitCode=2;
 }).catch(e=>{
  const reason=e?.code==="ERR_ASSERTION"&&/^OWNER_PRODUCER_/.test(e.message||"")?
   e.message:"OWNER_PRODUCER_DIAGNOSTIC_NOT_AVAILABLE";
  process.stdout.write(JSON.stringify({status:"HOLD_NONAUTH_OWNER_PRODUCER",
   reason_code:reason,formal_resource_readback_written:false,
   permit_issued:false,permit_consumed:false,execution_authorized:false,
   original_six_stages_executed:0})+"\n");
  process.exitCode=1;
 });
}
module.exports={RUN,HOST,PROBE,SCHEMA,POS,NEG,BUCKET,keys,validateInput,
 parseUrl,pgTarget,s3Target,pgFailureCode,probeCatalogFacts,assertS3Private,unresolved,
 probePg,probeS3,timed,diagnostic,parse,
 OWNER_BINDING_DOMAIN_V2,ASSIGNMENT_FIELDS_V2,replacementPolicyV2,
 replacementPolicyBytesV2,verifyReplacementPolicyV2,verifyOwnerAuthorityBindingV2,
 FORMAL_SURFACES,verifyFormalEvidence,composeFormalReadback,
 requireLocalProtectedMain,loadFormalSourceSpec,produceFormalRaw,parseFormal};
