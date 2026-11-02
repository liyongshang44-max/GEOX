"use strict";
/*
 * R4285 independent, Windows-only Resource Owner physical probe.
 * No provisioning, signer, Permit issuer or six-stage dispatcher. The default
 * diagnostic cannot create a PASS Readback or modify PG/S3/authority files.
 * The formal producer fails closed on facts a scoped read-only credential
 * cannot independently prove (notably global exclusive ownership).
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),os=require("node:os"),zlib=require("node:zlib");
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
// MinIO may reserialize an inline IAM policy with reordered arrays.
// Only Action, Resource and Statement ordering is immaterial. All fields,
// types, values, multiplicities, Sid, Effect and strict namespace remain exact.
function normalizeReplacementPolicyOrderV2(policy){
 const code="OWNER_BINDING_POLICY_SEVEN_EXACT_PAIRS_REQUIRED";
 const keySet=(v,keys)=>v&&typeof v==="object"&&!Array.isArray(v)&&
  Object.keys(v).sort().join("\u0000")===keys.slice().sort().join("\u0000");
 assert(keySet(policy,["Version","Statement"]),code);
 assert(policy.Version==="2012-10-17"&&Array.isArray(policy.Statement)&&
  policy.Statement.length===2,code);
 const statements=policy.Statement.map(s=>{
  assert(keySet(s,["Sid","Effect","Action","Resource"]),code);
  assert(typeof s.Sid==="string"&&s.Effect==="Allow",code);
  for(const k of ["Action","Resource"]){
   const a=s[k];
   assert(Array.isArray(a)&&a.length>0&&
    a.every(v=>typeof v==="string"&&v.length>0)&&
    new Set(a).size===a.length,code);
  }
  return {Sid:s.Sid,Effect:s.Effect,
   Action:[...s.Action].sort(),Resource:[...s.Resource].sort()};
 }).sort((a,b)=>a.Sid<b.Sid?-1:a.Sid>b.Sid?1:0);
 assert(new Set(statements.map(s=>s.Sid)).size===2,code);
 return {Version:policy.Version,Statement:statements};
}
function verifyReplacementPolicyV2(policy){
 // Fail closed without embedding the IAM policy in assertion-error text.
 assert(lineage.canonical(normalizeReplacementPolicyOrderV2(policy))===
  lineage.canonical(normalizeReplacementPolicyOrderV2(replacementPolicyV2())),
  "OWNER_BINDING_POLICY_SEVEN_EXACT_PAIRS_REQUIRED");
 // The signed 510-byte policy source and SHA are NEVER rewritten or reordered.
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
// The existing ACCOUNTABLE_SINGLE_OPERATOR is the CTO's authority for
// adjudicating the scope of existing evidence. No independent issuer, new
// registry, or second person's signature is required. The CTO decision uses
// the SAME pre-existing operator key as Owner Authority Binding V2.
// It cannot create physical facts, grant Permit or sign frozen Owner V1.
const CTO_DECISION_DOMAIN_V1="GEOX_MCFT_CAP09_R4285_CTO_SCOPE_DECISION_V1\n";

// The signed CTO decision is deliberately NOT the native witness. These two
// exact raw-source capsules are compared against fresh READ-ONLY native CLI
// stdout on the Windows host before any capability can be minted. No operator
// supplied "captured:true", method name, or digest can replace a native read.
const NATIVE_CONTROL_SCHEMA="MCFT_CAP09_R4285_MINIO_NATIVE_CONTROL_RAW_V1";
const NATIVE_INVENTORY_SCHEMA="MCFT_CAP09_R4285_WINDOWS_DOCKER_NATIVE_INVENTORY_RAW_V1";
const NATIVE_CONTROL_COMMANDS=Object.freeze([
 "ADMIN_INFO","POLICY_INFO","SERVICE_ACCOUNT_INFO","BUCKET_STAT","BUCKET_ANONYMOUS"]);
const NATIVE_INVENTORY_COMMANDS=Object.freeze([
 "CONTAINERS_ALL","CONTAINERS_INSPECT","VOLUME_INSPECT"]);
// The CLI returns complete native bytes; base64-expanded Docker inventory
// can exceed the bounded 1 MiB signed capsule. Gzip is lossless and in-memory,
// with strict limits on BOTH encoded and inflated sizes. No fields are dropped.
const NATIVE_CAPSULE_MAX_BYTES=1048576;
const NATIVE_CAPSULE_MAX_INFLATED_BYTES=8388608;
function encodeNativeCapsule(capsule,kind){
 const raw=Buffer.from(JSON.stringify(capsule),"utf8");
 assert(raw.length>0&&raw.length<=NATIVE_CAPSULE_MAX_INFLATED_BYTES,
  "HOLD_NATIVE_CAPTURE_"+kind+"_UNCOMPRESSED_BOUND");
 if(raw.length<NATIVE_CAPSULE_MAX_BYTES)return raw;
 const encoded=zlib.gzipSync(raw,{level:9});
 assert(encoded.length>0&&encoded.length<NATIVE_CAPSULE_MAX_BYTES,
  "HOLD_NATIVE_CAPTURE_"+kind+"_COMPRESSED_BOUND");
 return encoded;
}
function sourceJson(b,kind){
 assert(Buffer.isBuffer(b)&&b.length>0&&b.length<NATIVE_CAPSULE_MAX_BYTES,
  "HOLD_NATIVE_"+kind+"_BYTES");
 let raw=b;
 if(b.length>=2&&b[0]===0x1f&&b[1]===0x8b){
  try{
   raw=zlib.gunzipSync(b,{maxOutputLength:NATIVE_CAPSULE_MAX_INFLATED_BYTES});
  }catch{
   throw Error("HOLD_NATIVE_"+kind+"_GZIP_INVALID_OR_UNBOUNDED");
  }
  assert(raw.length>0&&raw.length<=NATIVE_CAPSULE_MAX_INFLATED_BYTES,
   "HOLD_NATIVE_"+kind+"_INFLATED_BOUND");
 }
 let x;
 try{x=JSON.parse(raw.toString("utf8").replace(/^\uFEFF/,""));}
 catch{throw Error("HOLD_NATIVE_"+kind+"_RAW_JSON_NOT_NATIVE_CAPSULE");}
 exact(x,["schema_version","run_id","subject_sha","host_id","observed_at","commands"],
  "HOLD_NATIVE_"+kind+"_SCHEMA");
 assert.equal(x.schema_version,
  kind==="CONTROL"?NATIVE_CONTROL_SCHEMA:NATIVE_INVENTORY_SCHEMA,
  "HOLD_NATIVE_"+kind+"_CAPTURE_SCHEMA");
 assert.equal(x.run_id,RUN,"HOLD_NATIVE_"+kind+"_RUN");
 assert.equal(x.host_id,HOST,"HOLD_NATIVE_"+kind+"_HOST");
 assert(H.test(x.subject_sha),"HOLD_NATIVE_"+kind+"_SUBJECT");
 assert(typeof x.observed_at==="string"&&Number.isFinite(Date.parse(x.observed_at))&&
  new Date(x.observed_at).toISOString()===x.observed_at,"HOLD_NATIVE_"+kind+"_OBSERVED_AT");
 return x;
}
function nativeJsonLines(b,code){
 let parsed;
 try{
  const lines=b.toString("utf8").split(/\r?\n/).filter(Boolean);
  assert(lines.length>0&&lines.length<=200,"HOLD_NATIVE_JSON_LINE_COUNT");
  parsed=lines.map(x=>JSON.parse(x));
 }catch{throw Error(code);}
 return parsed;
}
function deepHas(x,value,depth=0){
 if(depth>24||x===null||x===undefined)return false;
 if(typeof x==="string")return x===value;
 if(Array.isArray(x))return x.some(v=>deepHas(v,value,depth+1));
 if(typeof x==="object")return Object.values(x).some(v=>deepHas(v,value,depth+1));
 return false;
}
function nativeRead(tool,args){
 // Nonmutating fixed command families, no shell interpolation, no secrets or
 // raw stderr returned to operator. SDK/PG/S3 existing probes are untouched.
 const child=require("node:child_process").spawnSync(tool,args,{
  encoding:null,windowsHide:true,shell:false,timeout:15000,maxBuffer:1024*1024,
  stdio:["ignore","pipe","pipe"]});
 assert(!child.error&&child.status===0&&Buffer.isBuffer(child.stdout),
  "HOLD_NATIVE_COMMAND_NOT_AUTHENTICATED");
 return child.stdout;
}

// Windows mc RELEASE.2025-08-13 may return exact bucket stat as
// {status:"success",name:"bucket/", ...} without a "type" field.
// Require native command's exact bucket path and exact bucket identity;
// explicit non-folder types, other buckets and object paths remain rejected.
function nativeBucketStatMatches(x){
 if(!x||typeof x!=="object"||Array.isArray(x)||
  x.status!=="success"||
  (x.type!==undefined&&x.type!=="folder"))return false;
 const values=[x.key,x.name].filter(v=>typeof v==="string");
 return values.length>0&&values.every(v=>v===BUCKET||v===BUCKET+"/");
}
// Native Windows mc --json anonymous get reports {operation:"get",
// status:"success",bucket:"alias/bucket",permission:"private"}.
// Bind the exact read operation, exact alias/bucket and a private scope.
// Public/download/upload/readwrite, missing or unexpected fields fail closed.
function nativeBucketAnonymousMatches(x,alias){
 if(!x||typeof x!=="object"||Array.isArray(x)||
  typeof alias!=="string"||!(/^[A-Za-z0-9_.-]{2,128}$/.test(alias)))return false;
 const keys=["bucket","operation","permission","status"];
 if(Object.keys(x).sort().join("\u0000")!==keys.slice().sort().join("\u0000"))
  return false;
 return x.status==="success"&&x.operation==="get"&&
  x.bucket===alias+"/"+BUCKET&&x.permission==="private";
}
// The Windows native double-read witnessed 5/78 containers with Mounts
// array permutations only. Mount order is not part of mount ownership.
// Preserve every FULL mount record, including unknown fields, duplicates,
// flags and nested-array order. Other inspect fields remain strict.
function nativeMountsStableOrder(mounts){
 assert(Array.isArray(mounts)&&mounts.every(m=>m&&typeof m==="object"&&
  !Array.isArray(m)),"HOLD_NATIVE_MOUNTS_FORMAT");
 return [...mounts].sort((a,b)=>{
  const x=lineage.canonical(a),y=lineage.canonical(b);
  return x<y?-1:x>y?1:0;
 });
}
function nativeStableProjection(label,b){
 // Docker inspect returns a multiline JSON array; mc and docker ps use JSONL.
 // Only reconcile stable identities, not uptime/metrics.
 let x;
 if(label==="CONTAINERS_INSPECT"||label==="VOLUME_INSPECT"){
  try{x=[JSON.parse(b.toString("utf8"))];}
  catch{throw Error("HOLD_NATIVE_"+label+"_ARRAY_JSON_FORMAT");}
 }else x=nativeJsonLines(b,"HOLD_NATIVE_"+label+"_RESPONSE_FORMAT");
 if(label==="ADMIN_INFO")
  return JSON.stringify({deployment_verified:x.some(o=>
   deepHas(o,"ddbc6bb9-eb52-4b95-8324-b556697f8c0e"))});
 if(label==="BUCKET_STAT"){
  assert(x.length===1&&nativeBucketStatMatches(x[0]),
   "HOLD_NATIVE_BUCKET_NOT_NATIVE");
  return JSON.stringify({bucket_verified:true,bucket:BUCKET});
 }
 if(label==="BUCKET_ANONYMOUS"){
  const alias=process.env.MCFT_CAP09_R4285_EXISTING_MC_ALIAS;
  assert(x.length===1&&nativeBucketAnonymousMatches(x[0],alias),
   "HOLD_NATIVE_BUCKET_ANONYMOUS_SCOPE_NOT_PROVEN");
  return JSON.stringify({no_anonymous_access:true,bucket:alias+"/"+BUCKET});
 }
 if(label==="SERVICE_ACCOUNT_INFO"){
  const acct=process.env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID;
  return JSON.stringify({account_verified:x.some(o=>deepHas(o,acct))});
 }
 if(label==="POLICY_INFO"){
  const found=[];
  const walk=(v,d=0)=>{
   if(d>20||!v)return;
   if(typeof v==="string"){
    if(v[0]==="{"){try{walk(JSON.parse(v),d+1);}catch{}}
   }else if(Array.isArray(v))for(const y of v)walk(y,d+1);
   else if(typeof v==="object"){
    if(v.Version==="2012-10-17"&&Array.isArray(v.Statement))
     found.push(lineage.canonical(v));
    else for(const y of Object.values(v))walk(y,d+1);
   }
  };
  walk(x);
  assert(found.length===1,"HOLD_NATIVE_POLICY_ONE_DOCUMENT_REQUIRED");
  const policy=JSON.parse(found[0]);
  verifyReplacementPolicyV2(policy);
  // Native MinIO readbacks may reorder policy arrays between two calls.
  // Reconcile strictly validated policy semantics, not serialization order.
  return lineage.canonical(normalizeReplacementPolicyOrderV2(policy));
 }
 if(label==="CONTAINERS_ALL"){
  const ids=x.map(y=>y.ID||y.Id);
  assert(ids.every(v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v)),
   "HOLD_NATIVE_CONTAINER_ID_FORMAT");
  return JSON.stringify(ids);
 }
 if(label==="CONTAINERS_INSPECT"){
  const c=x.length===1&&Array.isArray(x[0])?x[0]:x;
  assert(c.every(y=>typeof y.Id==="string"),
   "HOLD_NATIVE_INSPECT_ID");
  return lineage.canonical(c.map(y=>({
   Id:y.Id,Name:y.Name,
   Labels:y.Config?.Labels||{},
   Mounts:nativeMountsStableOrder(y.Mounts||[]),
   Ports:y.NetworkSettings?.Ports||{},
   PortBindings:y.HostConfig?.PortBindings||{},
   EnvDigest:sha(Buffer.from(lineage.canonical(y.Config?.Env||[])))
  })));
 }
 if(label==="VOLUME_INSPECT"){
  const v=x.length===1&&Array.isArray(x[0])?x[0]:x;
  return lineage.canonical(v.map(y=>({
   Name:y.Name,Driver:y.Driver,Labels:y.Labels||{},Mountpoint:y.Mountpoint})));
 }
 throw Error("HOLD_NATIVE_PROJECTION_UNKNOWN_COMMAND");
}

function nativeCommand(record,tool,args,label){
 exact(record,["argv","stdout_base64","exit_code"],"HOLD_NATIVE_"+label+"_RECORD");
 assert.deepEqual(record.argv,args,"HOLD_NATIVE_"+label+"_ARGV");
 assert.equal(record.exit_code,0,"HOLD_NATIVE_"+label+"_EXIT");
 assert(typeof record.stdout_base64==="string"&&record.stdout_base64.length>0&&
  record.stdout_base64.length<1398104,"HOLD_NATIVE_"+label+"_ENCODING");
 const raw=Buffer.from(record.stdout_base64,"base64");
 assert(raw.length>0&&raw.toString("base64")===record.stdout_base64,
  "HOLD_NATIVE_"+label+"_BASE64");
 const observed=nativeRead(tool,args);
 // Boolean-only comparison: no native stdout or policy JSON in error details.
 assert(nativeStableProjection(label,raw)===nativeStableProjection(label,observed),
  "HOLD_NATIVE_"+label+"_CURRENT_IDENTITY_OR_SCOPE_DRIFT");
 return observed;
}

const REACH_IDPS=Object.freeze(["identity_ldap","identity_openid","identity_plugin","policy_plugin"]);
function parseDisabledIdentity(raw,name){
 assert(REACH_IDPS.includes(name),"HOLD_NATIVE_IDP_NAME");
 assert(Buffer.isBuffer(raw),"HOLD_NATIVE_IDP_RAW_REQUIRED");
 const s=raw.toString("utf8");
 assert(s.length>0&&s.length<32768,"HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
 // mc admin config get yields a single subsystem-prefixed config line.
 // Parse EXACT key=value boundaries so empty URL fields cannot consume the
 // next key, and never print values (they may include secrets).
 const header=new RegExp("^\\s*"+name+"(?=\\s|$)").exec(s);
 assert(header,"HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
 const rest=s.slice(header[0].length);
 const pattern=/(?<!\S)([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)'|(\S*))/g;
 const values=new Map();
 let cursor=0,m,count=0;
 while((m=pattern.exec(rest))!==null){
  assert(/^\s*$/.test(rest.slice(cursor,m.index))&&
   !values.has(m[1])&&++count<=80,
   "HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
  values.set(m[1],m[2]??m[3]??m[4]);
  cursor=pattern.lastIndex;
 }
 assert(count>0&&/^\s*$/.test(rest.slice(cursor)),
  "HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
 const required={identity_ldap:"server_addr",identity_openid:"config_url",
  identity_plugin:"url",policy_plugin:"url"}[name];
 const flags=["enable","enabled","status"].filter(k=>values.has(k));
 assert(flags.length<=1,"HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
 const state=flags.length?values.get(flags[0]).toLowerCase():null;
 assert(state===null||state===""||
  ["off","false","0"].includes(state),
  "HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
 // Explicit off is sufficient without an endpoint key; empty/absent enable
 // instead requires that the native provider's mandatory endpoint key exists.
 if(state===null||state==="")
  assert(values.has(required),"HOLD_NATIVE_IDP_ENABLED_OR_UNRESOLVED");
 for(const k of ["server_addr","config_url","url","endpoint","srv_record_name"]){
  if(values.has(k))
   assert(values.get(k)==="","HOLD_NATIVE_IDP_ACTIVE_ENDPOINT");
 }
 // Alternative provider URL/address keys also cannot smuggle a connection.
 for(const [k,v] of values){
  if(/(?:^|_)(?:url|uri|addr|endpoint)$/.test(k))
   assert(v==="","HOLD_NATIVE_IDP_ACTIVE_ENDPOINT");
 }
 return {name,disabled:true};
}
function assertNoIdpContainerEnvOverrides(target){
 const env=target?.Config?.Env;
 assert(Array.isArray(env),"HOLD_NATIVE_IDP_CONTAINER_ENV_UNOBSERVED");
 const blocked=["MINIO_IDENTITY_LDAP","MINIO_IDENTITY_OPENID",
  "MINIO_IDENTITY_PLUGIN","MINIO_POLICY_PLUGIN"];
 for(const entry of env){
  assert(typeof entry==="string"&&entry.includes("="),
   "HOLD_NATIVE_IDP_CONTAINER_ENV_UNOBSERVED");
  const k=entry.slice(0,entry.indexOf("=")).toUpperCase();
  assert(!blocked.some(prefix=>k===prefix||k.startsWith(prefix+"_")),
   "HOLD_NATIVE_IDP_ENV_OVERRIDE");
 }
}
function normalizeMinioList(raw,kind){
 assert(Buffer.isBuffer(raw)&&["USERS","ACCOUNTS","POLICY"].includes(kind),
  "HOLD_NATIVE_IAM_LIST_KIND");
 // The authenticated Windows mc user list emits ZERO stdout bytes for
 // no MinIO-managed users. Do not accept whitespace, command failures,
 // or zero-byte responses for ACCOUNTS/POLICY as evidence of absence.
 if(kind==="USERS"&&raw.length===0)return [];
 const a=nativeJsonLines(raw,"HOLD_NATIVE_"+kind+"_RAW_UNPARSEABLE")
  .flatMap(x=>Array.isArray(x)?x:[x]);
 const out=[];
 for(const x of a){
  assert(x&&typeof x==="object"&&!Array.isArray(x)&&x.status==="success",
   "HOLD_NATIVE_"+kind+"_NOT_SUCCESS");
  if(kind==="POLICY"){
   // Native mc emits {status:"success",result:{timestamp,...Mappings}},
   // not top-level policyMappings. Missing omitempty arrays mean zero,
   // but ANY mapping, malformed result, or extra field is a HOLD.
   assert(a.length===1&&
    Object.keys(x).sort().join("|")==="result|status"&&
    x.result&&typeof x.result==="object"&&!Array.isArray(x.result),
    "HOLD_NATIVE_POLICY_ENTITIES_NOT_ENUMERATED");
   const result=x.result;
   const allowed=["timestamp","userMappings","groupMappings","policyMappings"];
   assert(Object.keys(result).every(k=>allowed.includes(k))&&
    typeof result.timestamp==="string"&&
    Number.isFinite(Date.parse(result.timestamp)),
    "HOLD_NATIVE_POLICY_ENTITIES_NOT_ENUMERATED");
   for(const key of ["userMappings","groupMappings","policyMappings"]){
    if(Object.prototype.hasOwnProperty.call(result,key)){
     assert(Array.isArray(result[key]),
      "HOLD_NATIVE_POLICY_ENTITIES_NOT_ENUMERATED");
     assert(result[key].length===0,"HOLD_NATIVE_OTHER_POLICY_PRINCIPAL_REACHABLE");
    }
   }
   continue;
  }
  const key=kind==="USERS"?"users":"accounts";
  if(typeof x.accessKey==="string"){out.push(x.accessKey);continue;}
  assert(Array.isArray(x[key]),"HOLD_NATIVE_"+kind+"_INVENTORY_INCOMPLETE");
  for(const y of x[key]){
   const id=typeof y==="string"?y:y?.accessKey;
   assert(typeof id==="string"&&id.length>0,"HOLD_NATIVE_"+kind+"_IDENTITY_UNKNOWN");
   out.push(id);
  }
 }
 return out;
}
function assessNativeReachability(f){
 assert(Array.isArray(f.users)&&f.users.every(x=>x===f.parent),
  "HOLD_NATIVE_OTHER_MINIO_USER");
 assert(Array.isArray(f.accounts)&&f.accounts.length===1&&f.accounts[0]===f.account,
  "HOLD_NATIVE_OTHER_MINIO_SERVICE_ACCOUNT");
 assert(Array.isArray(f.policy)&&f.policy.length===0,
  "HOLD_NATIVE_OTHER_POLICY_BINDING");
 assert(Array.isArray(f.idps)&&f.idps.length===4&&
  f.idps.every((x,i)=>x.name===REACH_IDPS[i]&&x.disabled===true),
  "HOLD_NATIVE_EXTERNAL_AUTH_PLUGIN");
 const d=f.details,t=f.target;
 assert(Array.isArray(d)&&t&&d.some(x=>x.Id===t.Id),
  "HOLD_NATIVE_TARGET_NOT_IN_DOCKER_CENSUS");
 const hostPorts=Object.values(t.HostConfig?.PortBindings||{}).flatMap(x=>x||[]);
 assert(hostPorts.some(x=>Number(x.HostPort)===f.s3Port&&x.HostIp==="127.0.0.1")&&
  hostPorts.every(x=>["127.0.0.1","::1"].includes(x.HostIp)),
  "HOLD_NATIVE_NONLOOPBACK_DOCKER_PUBLISH");
 const ns=Object.keys(t.NetworkSettings?.Networks||{});
 assert(ns.length>0,"HOLD_NATIVE_DOCKER_NETWORK_UNOBSERVED");
 for(const peer of d.filter(x=>x.Id!==t.Id)){
  if(ns.some(n=>peer.NetworkSettings?.Networks?.[n]))
   assert(JSON.stringify(peer.Config?.Labels||{}).includes(RUN),
    "HOLD_NATIVE_UNAUTHORIZED_DOCKER_NETWORK_PEER");
 }
 const h=f.host;
 assert(h&&h.schema==="R4285_HOST_REACHABILITY_V1","HOLD_NATIVE_HOST_SCHEMA");
 const at=Date.parse(h.observed_at);
 assert(Number.isFinite(at)&&at<=f.now&&f.now-at<=120000,
  "HOLD_NATIVE_HOST_STALE");
 assert(Number.isInteger(h.process_count)&&h.process_count>0&&
  Number.isInteger(h.service_count)&&h.service_count>0,"HOLD_NATIVE_HOST_CENSUS_EMPTY");
 for(const name of ["process_refs","service_refs","inaccessible_apps","config_unreadable"])
  assert(Array.isArray(h[name])&&h[name].length===0,
   "HOLD_NATIVE_HOST_"+name.toUpperCase());
 assert(Array.isArray(h.listeners),"HOLD_NATIVE_HOST_LISTENERS_NOT_CAPTURED");
 for(const port of [f.s3Port,f.pgPort]){
  const rows=h.listeners.filter(x=>x.port===port);
  assert(rows.length>=1&&rows.every(x=>["127.0.0.1","::1"].includes(x.address)),
   "HOLD_NATIVE_HOST_LISTENER_NOT_LOOPBACK");
 }
 return Object.freeze({status:"NATIVE_REACHABLE_SCOPE_VERIFIED",
  owner_exclusive:true,production_bindings_present:false,
  covered_surfaces:FORMAL_SURFACES});
}
function liveReachability(i,env,alias,account,details,target,now){
 const parent=env.MCFT_CAP09_R4285_PARENT_ACCESS_KEY_ID;
 assert(typeof parent==="string"&&/^[A-Za-z0-9_.-]{2,128}$/.test(parent),
  "HOLD_NATIVE_PARENT_ID_REQUIRED");
 const mc=args=>nativeRead("mc",args);
 const idps=REACH_IDPS.map(name=>parseDisabledIdentity(
  mc(["admin","config","get",alias,name]),name));
 const users=normalizeMinioList(mc(["--json","admin","user","list",alias]),"USERS");
 const accounts=normalizeMinioList(mc(
  ["--json","admin","user","svcacct","ls",alias,parent]),"ACCOUNTS");
 const policy=normalizeMinioList(mc(
  ["--json","admin","policy","entities",alias]),"POLICY");
 const s3Port=Number(new URL(i.bucket_endpoint).port),pgPort=i.database_port;
 const tokens=[BUCKET,POS,NEG,String(s3Port),String(pgPort)];
 const ps="$ErrorActionPreference='Stop'\n$ports=__PORTS__\n$tokens=__TOKENS__\n$p=@(Get-CimInstance Win32_Process -ErrorAction Stop)\n$s=@(Get-CimInstance Win32_Service -ErrorAction Stop | Where-Object {$_.State -eq 'Running'})\n$ph=New-Object System.Collections.ArrayList\n$sh=New-Object System.Collections.ArrayList\n$unknown=New-Object System.Collections.ArrayList\n$cfg=New-Object System.Collections.ArrayList\nforeach($q in $p){\n if([int]$q.ProcessId -eq [int]$PID){continue}\n $cmd=[string]$q.CommandLine\n $name=[string]$q.Name\n if([string]::IsNullOrWhiteSpace($cmd)){\n  if($name -match '(?i)^(node|python|java|postgres|minio|mc|docker|geox)'){[void]$unknown.Add([int]$q.ProcessId)}\n  continue\n }\n foreach($v in $tokens){if($cmd.Contains($v)){[void]$ph.Add([int]$q.ProcessId);break}}\n if($name -match '(?i)^(node|python|java|postgres|minio|geox)'){\n  $flags=[regex]::Matches($cmd,'(?i)(?:--config|--env-file)(?:=|\\s+)(?:\"([^\"]+)\"|(\\S+))')\n  if($cmd -match '(?i)(--config|--env-file)' -and $flags.Count -eq 0){\n   [void]$cfg.Add([int]$q.ProcessId)\n  }\n  foreach($m in $flags){\n   try{\n    $f=$m.Groups[1].Value\n    if(!$f){$f=$m.Groups[2].Value}\n    if(!(Test-Path -LiteralPath $f -PathType Leaf)){throw 'NOFILE'}\n    $c=[IO.File]::ReadAllText($f)\n    foreach($v in $tokens){if($c.Contains($v)){[void]$ph.Add([int]$q.ProcessId);break}}\n   }catch{[void]$cfg.Add([int]$q.ProcessId)}\n  }\n }\n}\nforeach($q in $s){\n $cmd=[string]$q.PathName\n if([string]::IsNullOrWhiteSpace($cmd)){\n  if([string]$q.Name -match '(?i)(minio|postgres|geox|docker)'){[void]$unknown.Add([string]$q.Name)}\n  continue\n }\n foreach($v in $tokens){if($cmd.Contains($v)){[void]$sh.Add([string]$q.Name);break}}\n $serviceFlags=[regex]::Matches($cmd,'(?i)(?:--config|--env-file)(?:=|\\s+)(?:\"([^\"]+)\"|(\\S+))')\n if($cmd -match '(?i)(--config|--env-file)' -and $serviceFlags.Count -eq 0){\n  [void]$cfg.Add([string]$q.Name)\n }\n foreach($m in $serviceFlags){\n  $f=$m.Groups[1].Value\n  if(!$f){$f=$m.Groups[2].Value}\n  try{\n   if(!(Test-Path -LiteralPath $f -PathType Leaf)){throw 'NOFILE'}\n   $c=[IO.File]::ReadAllText($f)\n   foreach($v in $tokens){if($c.Contains($v)){[void]$sh.Add([string]$q.Name);break}}\n  }catch{[void]$cfg.Add([string]$q.Name)}\n }\n}\n$l=@(Get-NetTCPConnection -State Listen -ErrorAction Stop |\n Where-Object {$ports -contains [int]$_.LocalPort} |\n ForEach-Object {@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress}})\n@{schema='R4285_HOST_REACHABILITY_V1';observed_at=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')\n process_count=$p.Count;service_count=$s.Count;process_refs=@($ph|Select-Object -Unique)\n service_refs=@($sh|Select-Object -Unique);inaccessible_apps=@($unknown|Select-Object -Unique)\n config_unreadable=@($cfg|Select-Object -Unique);listeners=$l} | ConvertTo-Json -Compress -Depth 5";
 const quote=x=>"'"+x.replace(/'/g,"''")+"'";
 const script=ps.replace("__TOKENS__","@("+tokens.map(quote).join(",")+")")
  .replace("__PORTS__","@("+s3Port+","+pgPort+")");
 const native=nativeRead("powershell.exe",
  ["-NoProfile","-NonInteractive","-EncodedCommand",
   Buffer.from(script,"utf16le").toString("base64")]);
 let host;
 try{host=JSON.parse(native.toString("utf8").replace(/^\uFEFF/,""));}
 catch{throw Error("HOLD_NATIVE_HOST_CENSUS_JSON_UNREADABLE");}
 return assessNativeReachability({users,accounts,policy,idps,host,
  details,target,parent,account,s3Port,pgPort,now:Date.now()});
}

function verifyNativeSourceRaw(i,controlBytes,inventoryBytes,
 {now=Date.now(),env=process.env}={}){
 // This verifier is Windows-only at the formal CLI. Linux CI may exercise
 // structurally invalid inputs, never a synthetic physical PASS.
 const control=sourceJson(controlBytes,"CONTROL");
 const inventory=sourceJson(inventoryBytes,"INVENTORY");
 host();validateInput(i);
 assert.equal(control.subject_sha,i.subject_sha,"HOLD_NATIVE_CONTROL_SUBJECT");
 assert.equal(inventory.subject_sha,i.subject_sha,"HOLD_NATIVE_INVENTORY_SUBJECT");
 for(const [s,k] of [[control,"CONTROL"],[inventory,"INVENTORY"]]){
  const at=Date.parse(s.observed_at);
  assert(at<=now&&now-at<=120000,"HOLD_NATIVE_"+k+"_STALE");
 }
 assert(Math.abs(Date.parse(control.observed_at)-Date.parse(inventory.observed_at))<=120000,
  "HOLD_NATIVE_SOURCE_CLOCK_DIVERGENCE");
 const alias=env.MCFT_CAP09_R4285_EXISTING_MC_ALIAS;
 const acct=env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID;
 for(const [v,k] of [[alias,"ALIAS"],[acct,"ACCOUNT"]])
  assert(typeof v==="string"&&/^[A-Za-z0-9_.-]{2,128}$/.test(v),
   "HOLD_NATIVE_EXISTING_"+k+"_IDENTITY_REQUIRED");
 const cc=control.commands,ic=inventory.commands;
 exact(cc,NATIVE_CONTROL_COMMANDS,"HOLD_NATIVE_CONTROL_COMMAND_SET");
 exact(ic,NATIVE_INVENTORY_COMMANDS,"HOLD_NATIVE_INVENTORY_COMMAND_SET");
 const cs=[
  ["ADMIN_INFO",["--json","admin","info",alias]],
  ["POLICY_INFO",["--json","admin","accesskey","info",alias,acct]],
  ["SERVICE_ACCOUNT_INFO",["--json","admin","user","svcacct","info",alias,acct]],
  ["BUCKET_STAT",["--json","stat",alias+"/"+BUCKET]],
  ["BUCKET_ANONYMOUS",["--json","anonymous","get",alias+"/"+BUCKET]]
 ];
 const m={};
 for(const [key,args] of cs)
  m[key]=nativeJsonLines(nativeCommand(cc[key],"mc",args,key),
   "HOLD_NATIVE_CONTROL_"+key+"_JSON_UNSUPPORTED");
 // A command transcript is not an inventory of other principals. Require
 // the actual IAM/policy resource keys, account and deployment in distinct
 // CLI responses, not in signed summary fields.
 assert(m.ADMIN_INFO.some(x=>deepHas(x,"ddbc6bb9-eb52-4b95-8324-b556697f8c0e")),
  "HOLD_NATIVE_MINIO_DEPLOYMENT_UNVERIFIED");
 assert(m.SERVICE_ACCOUNT_INFO.some(x=>deepHas(x,acct)),
  "HOLD_NATIVE_MINIO_ACCOUNT_UNVERIFIED");
 assert(m.BUCKET_STAT.length===1&&nativeBucketStatMatches(m.BUCKET_STAT[0]),
  "HOLD_NATIVE_BUCKET_NOT_NATIVE");
 // The policy is INLINE on this exact access key, not an installed named
 // MinIO policy. Bind both native access-key identity and all seven pairs.
 assert(m.POLICY_INFO.some(x=>deepHas(x,acct)),
  "HOLD_NATIVE_INLINE_POLICY_ACCESS_KEY_IDENTITY");
 // POLICY_INFO was reconciled against the exact seven-pair policy by
 // nativeStableProjection() from both captured and live native data.
 assert(typeof nativeStableProjection("POLICY_INFO",
  Buffer.from(cc.POLICY_INFO.stdout_base64,"base64"))==="string",
  "HOLD_NATIVE_MINIO_POLICY_SCOPE_NOT_RECONCILED");
 // The source must prove no public bucket exposure, not merely say private.
 assert(m.BUCKET_ANONYMOUS.length===1&&
  nativeBucketAnonymousMatches(m.BUCKET_ANONYMOUS[0],alias),
  "HOLD_NATIVE_BUCKET_ANONYMOUS_SCOPE_NOT_PROVEN");
 const psArgs=["ps","--all","--no-trunc","--format","{{json .}}"];
 const containersText=nativeCommand(ic.CONTAINERS_ALL,"docker",psArgs,"CONTAINERS_ALL");
 const containers=nativeJsonLines(containersText,"HOLD_NATIVE_DOCKER_PS_JSON");
 const ids=containers.map(x=>x.ID||x.Id);
 assert(ids.length>=1&&ids.length<=256&&new Set(ids).size===ids.length&&
  ids.every(x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x)),
  "HOLD_NATIVE_DOCKER_COMPLETE_CONTAINER_IDENTITIES");
 const detailsText=nativeCommand(ic.CONTAINERS_INSPECT,"docker",
  ["inspect","--type","container",...ids],"CONTAINERS_INSPECT");
 let details;
 try{details=JSON.parse(detailsText.toString("utf8"));}catch{
  throw Error("HOLD_NATIVE_DOCKER_INSPECT_JSON");}
 assert(Array.isArray(details)&&details.length===ids.length&&
  new Set(details.map(x=>x.Id)).size===ids.length&&
  details.every(x=>ids.includes(x.Id)),"HOLD_NATIVE_DOCKER_INSPECT_COMPLETENESS");
 const volumeName="mcftcap09-r4285c3ce342c-s3data";
 const volText=nativeCommand(ic.VOLUME_INSPECT,"docker",
  ["volume","inspect",volumeName],"VOLUME_INSPECT");
 let vols;
 try{vols=JSON.parse(volText.toString("utf8"));}catch{
  throw Error("HOLD_NATIVE_DOCKER_VOLUME_JSON");}
 assert(Array.isArray(vols)&&vols.length===1&&vols[0].Name===volumeName,
  "HOLD_NATIVE_DOCKER_VOLUME_WRONG");
 // A full container list and each corresponding inspect (not a subset) must
 // support that the run volume is not mounted by other projects. Do not copy
 // or serialize Config.Env: it can contain secrets.
 const mountUsers=details.filter(x=>(x.Mounts||[]).some(y=>y.Name===volumeName));
 assert(mountUsers.length===1,"HOLD_NATIVE_VOLUME_OWNER_NOT_EXCLUSIVE");
 const target=mountUsers[0];
 assert(JSON.stringify(target.Config?.Labels||{}).includes(RUN),
  "HOLD_NATIVE_VOLUME_OWNER_RUN_LABEL_MISSING");
 // Application refs: inspect all existing containers for run DB/S3 endpoint
 // references. Any other container referencing the run is a live blocker.
 const references=details.filter(x=>x.Id!==target.Id&&
  (x.Config?.Env||[]).some(v=>typeof v==="string"&&
    (v.includes(BUCKET)||v.includes("127.0.0.1:55492")||
     v.includes("127.0.0.1:59292"))));
 assert.equal(references.length,0,"HOLD_NATIVE_PRODUCTION_BINDINGS_FOUND");
 // Bind native empty/disabled config to the target container environment.
 // No four-provider MINIO_* environment overrides may bypass the config read.
 assertNoIdpContainerEnvOverrides(target);
 // Remaining external principals, process listeners, host apps and IAM
 // reachability cannot be inferred from docker inspection plus 5 mc calls.
 // Fail closed until an exact independently observable complete source is
 // available; never promote signer's empty unresolved[] into that proof.
 const qualified=liveReachability(i,env,alias,acct,details,target,now);
 const completed=Date.now();
 // A native source may become stale during multiple read-only calls.
 for(const [capsule,kind] of [[control,"CONTROL"],[inventory,"INVENTORY"]])
  assert(completed-Date.parse(capsule.observed_at)<=120000,
   "HOLD_NATIVE_"+kind+"_EXPIRED_DURING_LIVE_CENSUS");
 return qualified;
}

function verifyFormalEvidence(i,inputs,{now=Date.now()}={}){
 const {envelope,trust,control_bytes,inventory_bytes,parent_principal_sha256,
  cto_decision}=inputs||{};
 assert(Buffer.isBuffer(control_bytes)&&control_bytes.length>0&&control_bytes.length<1048576,
  "OWNER_FORMAL_CONTROL_RAW_BYTES_REQUIRED");
 assert(Buffer.isBuffer(inventory_bytes)&&inventory_bytes.length>0&&inventory_bytes.length<1048576,
  "OWNER_FORMAL_INVENTORY_RAW_BYTES_REQUIRED");
 assert(!control_bytes.equals(inventory_bytes),"OWNER_FORMAL_TWO_DISTINCT_SOURCES_REQUIRED");
 const bound=verifyOwnerAuthorityBindingV2(envelope,trust,{
  subject_sha:i.subject_sha,host_id:HOST,parent_principal_sha256,
  control_evidence_bytes:control_bytes,inventory_evidence_bytes:inventory_bytes,now});
 verifyNativeSourceRaw(i,control_bytes,inventory_bytes,{now});
 // This is the CTO's accountable, bounded adjudication of the two exact
 // evidence byte streams. Mere labels or a SHA file without the registered
 // operator signature are not accepted. Open reachable production references
 // remain HOLD; a signed decision does not invent native capture.
 assert(cto_decision&&typeof cto_decision==="object"&&!Array.isArray(cto_decision),
  "HOLD_CTO_SCOPE_DECISION_REQUIRED");
 exact(cto_decision,["payload","signature_base64"],"HOLD_CTO_DECISION_ENVELOPE");
 const a=cto_decision.payload;
 const fields=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id",
  "control_sha256","inventory_sha256","covered_surfaces","unresolved_reachable_sources",
  "bucket_private","owner_exclusive","production_bindings_present","s3_owner_id",
  "verified_at","expires_at","account_expires_at","control_capture_method",
  "inventory_capture_method","authority_comment_id","decision_scope"];
 exact(a,fields,"HOLD_CTO_DECISION_EXACT_FIELDS");
 assert.equal(a.schema_version,"MCFT_CAP09_R4285_CTO_SCOPE_DECISION_V1",
  "HOLD_CTO_DECISION_SCHEMA");
 assert.equal(a.authority_comment_id,6571636092,"HOLD_CTO_AUTHORITY_COMMENT");
 assert.equal(a.decision_scope,"R4285_TEST_ONLY_DECLARED_REACHABLE_SURFACES",
  "HOLD_CTO_SCOPE_EXCEEDS_TEST_ONLY");
 assert.equal(a.run_id,RUN,"HOLD_CTO_RUN");
 assert.equal(a.subject_sha,i.subject_sha,"HOLD_CTO_SUBJECT");
 assert.equal(a.host_id,HOST,"HOLD_CTO_HOST");
 assert.equal(a.control_sha256,sha(control_bytes),"HOLD_CTO_CONTROL_DIGEST");
 assert.equal(a.inventory_sha256,sha(inventory_bytes),"HOLD_CTO_INVENTORY_DIGEST");
 assert.deepEqual(a.covered_surfaces,FORMAL_SURFACES,"HOLD_CTO_DECLARED_SURFACE_COVERAGE");
 assert.deepEqual(a.unresolved_reachable_sources,[],"HOLD_CTO_UNRESOLVED_REACHABILITY");
 assert.equal(a.s3_owner_id,bound.responsibility_record_id,"HOLD_CTO_OWNER_BINDING");
 assert.equal(a.bucket_private,true,"HOLD_CTO_BUCKET_PRIVATE_NOT_ESTABLISHED");
 assert.equal(a.owner_exclusive,true,"HOLD_CTO_EXCLUSIVE_NOT_ACCEPTED");
 assert.equal(a.production_bindings_present,false,"HOLD_CTO_PRODUCTION_REFERENCES_REMAIN");
 assert.equal(a.control_capture_method,"MINIO_NATIVE_ADMIN_READONLY",
  "HOLD_CTO_CONTROL_ORIGIN");
 assert.equal(a.inventory_capture_method,"WINDOWS_DOCKER_AND_APPLICATION_READONLY",
  "HOLD_CTO_INVENTORY_ORIGIN");
 // CTO and Owner V2 are the SAME registered accountable operator. No separate
 // INDEPENDENT_RETRY_GOVERNANCE signature or newly registered auditor is used.
 assert.equal(trust?.schema_version,"geox_mcft_cap09_retry_trust_v1",
  "HOLD_CTO_TRUST");
 assert.equal(a.issuer_id,trust.operator_id,"HOLD_CTO_OPERATOR_ID");
 assert.equal(a.issuer_id,envelope.payload.issuer_id,"HOLD_CTO_OWNER_ISSUER_DIFFERENT");
 assert.equal(a.key_id,envelope.payload.key_id,"HOLD_CTO_OWNER_KEY_DIFFERENT");
 const matches=trust.issuers.filter(k=>k.issuer_id===a.issuer_id&&k.key_id===a.key_id);
 assert.equal(matches.length,1,"HOLD_CTO_OPERATOR_NOT_REGISTERED");
 const operator=matches[0];
 assert.equal(operator.revoked,false,"HOLD_CTO_OPERATOR_REVOKED");
 assert.equal(operator.role,"ACCOUNTABLE_SINGLE_OPERATOR","HOLD_CTO_ACCOUNTABLE_ROLE");
 const iso=v=>{assert(typeof v==="string"&&Number.isFinite(Date.parse(v))&&
  new Date(v).toISOString()===v,"HOLD_CTO_TIME");return Date.parse(v);};
 const issued=iso(a.verified_at),expires=iso(a.expires_at);
 assert(issued<=now&&now-issued<=120000&&now<expires&&expires-issued<=86400000,
  "HOLD_CTO_DECISION_FRESHNESS");
 assert(iso(a.account_expires_at)>now+10860000,"HOLD_CTO_ACCOUNT_EXECUTION_BUDGET");
 assert(iso(operator.not_before)<=issued&&expires<=iso(operator.not_after),
  "HOLD_CTO_OPERATOR_KEY_WINDOW");
 const pub=crypto.createPublicKey(operator.public_key_pem);
 assert.equal(pub.asymmetricKeyType,"ed25519","HOLD_CTO_KEY_TYPE");
 assert.equal(sha(pub.export({type:"spki",format:"der"})),operator.spki_sha256,
  "HOLD_CTO_KEY_FINGERPRINT");
 const sig=Buffer.from(cto_decision.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===cto_decision.signature_base64,
  "HOLD_CTO_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(CTO_DECISION_DOMAIN_V1+lineage.canonical(a)),
  pub,sig),"HOLD_CTO_SIGNATURE_INVALID");
 const qualified=Object.freeze({
  kind:"CTO_SCOPED_SOURCE_ACCEPTED",verifier:"ACCOUNTABLE_SINGLE_OPERATOR",
  bucket_private:true,owner_exclusive:true,production_bindings_present:false,
  s3_owner_id:bound.responsibility_record_id,control_sha256:a.control_sha256,
  inventory_sha256:a.inventory_sha256,
  source_receipt_sha256:sha(Buffer.from(lineage.canonical(cto_decision))),
  cto_operator_id:a.issuer_id});
 FORMAL_NATIVE_CAPABILITIES.add(qualified);
 return qualified;
}

// The official command is only valid for a subject matching the locally
// fetched protected-main ref, not an unmerged PR or a fixture branch.
function requireLocalProtectedMain(i){
 // Reuse the CURRENT registered native consumer's remote-main + clean
 // worktree contract instead of a stale local origin/main tracking ref.
 try{
  require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V2.cjs")
   .gitExactMain(i.source_root,i.subject_sha);
 }catch{
  throw Error("OWNER_FORMAL_PROTECTED_MAIN_NATIVE_VERIFY_HOLD");
 }
}
function boundedFile(file,max=1048576){
 assert(typeof file==="string"&&path.isAbsolute(file),"OWNER_FORMAL_ABSOLUTE_SOURCE");
 noLinks(file);
 const st=fs.statSync(file);
 assert(st.isFile()&&st.size>0&&st.size<max,"OWNER_FORMAL_SOURCE_FILE_BOUNDS");
 return fs.readFileSync(file);
}
function loadFormalSourceSpec(file,sourceRoot){
 const spec=JSON.parse(boundedFile(file,16384).toString("utf8").replace(/^\uFEFF/,""));
 exact(spec,["binding_envelope_file","trust_file","cto_decision_file",
  "control_evidence_file","inventory_evidence_file","parent_principal_sha256"],
  "OWNER_FORMAL_SOURCE_SPEC_EXACT");
 const get=f=>JSON.parse(boundedFile(spec[f]).toString("utf8").replace(/^\uFEFF/,""));
 const trustPath=path.join(sourceRoot,"scripts","runtime_acceptance","MCFT_CAP09_RETRY_TRUST_V1.json");
 assert(boundedFile(trustPath).equals(boundedFile(spec.trust_file)),
  "OWNER_FORMAL_TRUST_NOT_REPOSITORY_REGISTERED");
 return {envelope:get("binding_envelope_file"),trust:get("trust_file"),
  cto_decision:get("cto_decision_file"),
  control_bytes:boundedFile(spec.control_evidence_file),
  inventory_bytes:boundedFile(spec.inventory_evidence_file),
  parent_principal_sha256:spec.parent_principal_sha256};
}
function assertFormalOutputSeparate(i,output){
 assert(typeof output==="string"&&path.isAbsolute(output),
  "OWNER_FORMAL_OUTPUT_ABSOLUTE");
 for(const root of [i.source_root,i.release_root]){
  const relative=path.relative(root,output);
  assert(relative===".."||relative.startsWith(".."+path.sep),
   "OWNER_FORMAL_OUTPUT_INSIDE_SOURCE_OR_RELEASE");
 }
 return true;
}
async function produceFormalRaw(i,sources,output,env=process.env){
 host();validateInput(i);requireLocalProtectedMain(i);
 assertFormalOutputSeparate(i,output);
 assert(!fs.existsSync(output),"OWNER_FORMAL_OUTPUT_EXISTS");
 noLinks(path.dirname(output));
 // If the accountable CTO has not signed the exact scoped source decision,
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
 const i=parse(["--diagnostic-only","--input",argv[2]]);
 return {i,sources:loadFormalSourceSpec(argv[4],i.source_root),output:argv[6]};
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
// Source-only entrypoint is safe on the Draft PR: no signed Owner,
// PG/S3 probe, Permit, resource write, or requirement to pretend this HEAD is
// protected main. It returns only a bounded native provenance/HOLD verdict.

function captureCurrentNativeSourceOnly(i,env=process.env){
 // Ephemeral collection: do not write raw MinIO/Docker CLI stdout or any
 // Config.Env secrets to disk, GitHub logs or stdout. The captured bytes are
 // immediately rechecked through the SAME fixed native verifier path.
 host();validateInput(i);
 const alias=env.MCFT_CAP09_R4285_EXISTING_MC_ALIAS;
 const acct=env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID;
 for(const v of [alias,acct])
  assert(typeof v==="string"&&/^[A-Za-z0-9_.-]{2,128}$/.test(v),
   "HOLD_NATIVE_EXISTING_MC_IDENTITY_REQUIRED");
 const observedAt=new Date().toISOString();
 const record=(tool,args)=>({argv:args,stdout_base64:nativeRead(tool,args).toString("base64"),
  exit_code:0});
 const mc={
  ADMIN_INFO:record("mc",["--json","admin","info",alias]),
  POLICY_INFO:record("mc",["--json","admin","accesskey","info",alias,acct]),
  SERVICE_ACCOUNT_INFO:record("mc",["--json","admin","user","svcacct","info",alias,acct]),
  BUCKET_STAT:record("mc",["--json","stat",alias+"/"+BUCKET]),
  BUCKET_ANONYMOUS:record("mc",["--json","anonymous","get",alias+"/"+BUCKET])
 };
 const psArgs=["ps","--all","--no-trunc","--format","{{json .}}"];
 const containers=record("docker",psArgs);
 const ids=nativeJsonLines(Buffer.from(containers.stdout_base64,"base64"),
  "HOLD_NATIVE_CAPTURE_DOCKER_PS").map(x=>x.ID||x.Id);
 assert(ids.length>0&&ids.length<=256&&new Set(ids).size===ids.length&&
  ids.every(x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x)),
  "HOLD_NATIVE_CAPTURE_DOCKER_COMPLETE_IDENTITIES");
 const dk={
  CONTAINERS_ALL:containers,
  CONTAINERS_INSPECT:record("docker",["inspect","--type","container",...ids]),
  VOLUME_INSPECT:record("docker",["volume","inspect",
   "mcftcap09-r4285c3ce342c-s3data"])
 };
 const base={run_id:RUN,subject_sha:i.subject_sha,host_id:HOST,
  observed_at:observedAt};
 const controlBytes=encodeNativeCapsule({
  schema_version:NATIVE_CONTROL_SCHEMA,...base,commands:mc},"CONTROL");
 const inventoryBytes=encodeNativeCapsule({
  schema_version:NATIVE_INVENTORY_SCHEMA,...base,commands:dk},"INVENTORY");
 // Each signed source is still <1 MiB after reversible, bounded encoding.
 // Replayed native observations must match the ORIGINAL decompressed stdout.
 const scope=verifyNativeSourceRaw(i,controlBytes,inventoryBytes,{env});
 return {status:scope.status,control_sha256:sha(controlBytes),
  inventory_sha256:sha(inventoryBytes),observed_at:observedAt,
  owner_issued:false,permit_issued:false,execution_authorized:false,
  six_stages_executed:0,raw_bytes_persisted:false};
}

function sourceOnly(argv){
 if(argv.length===4&&argv[0]==="--verify-source-only"&&
  argv[1]==="--input"&&argv[3]==="--capture-current"){
  const i=parse(["--diagnostic-only","--input",argv[2]]);
  return captureCurrentNativeSourceOnly(i);
 }
 assert(argv.length===7&&argv[0]==="--verify-source-only"&&argv[1]==="--input"&&
  argv[3]==="--control-raw"&&argv[5]==="--inventory-raw",
  "OWNER_NATIVE_SOURCE_ONLY_EXACT_CLI");
 const i=parse(["--diagnostic-only","--input",argv[2]]);
 return verifyNativeSourceRaw(i,boundedFile(argv[4]),boundedFile(argv[6]));
}
if(require.main===module&&process.argv[2]==="--verify-source-only"){
 Promise.resolve().then(()=>sourceOnly(process.argv.slice(2))).then(result=>{
  // No success elevation until all external reachable source families are
  // explicitly attested by native data, not the CTO's JSON declaration.
  process.stdout.write(JSON.stringify({status:"NATIVE_SOURCE_SCOPE_VERIFIED_NOT_OWNER",
   control_sha256:result?.control_sha256||null,
   inventory_sha256:result?.inventory_sha256||null,
   source_observed_at:result?.observed_at||null,
   raw_bytes_persisted:false,
   owner_issued:false,permit_issued:false,execution_authorized:false,stage_count:0})+"\n");
 }).catch(e=>{
  const reason=/^(OWNER_|HOLD_NATIVE_)/.test(e?.message||"")?
   e.message:"HOLD_NATIVE_SOURCE_UNAVAILABLE";
  process.stdout.write(JSON.stringify({status:"HOLD_NATIVE_SOURCE_NOT_QUALIFIED",
   reason_code:reason,owner_issued:false,permit_issued:false,
   execution_authorized:false,stage_count:0})+"\n");
  process.exitCode=2;
 });
}else if(require.main===module&&process.argv[2]==="--produce-raw"){
 Promise.resolve().then(()=>parseFormal(process.argv.slice(2)))
  .then(x=>produceFormalRaw(x.i,x.sources,x.output)).then(x=>{
   process.stdout.write(JSON.stringify(x)+"\n");
  }).catch(e=>{
   const reason=/^(OWNER_FORMAL_|OWNER_BINDING_|HOLD_CTO_)/.test(e?.message||"")?
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
 parseUrl,pgTarget,s3Target,pgFailureCode,probeCatalogFacts,assertS3Private,unresolved,normalizeMinioList,
 probePg,probeS3,timed,diagnostic,parse,
 OWNER_BINDING_DOMAIN_V2,ASSIGNMENT_FIELDS_V2,replacementPolicyV2,
 replacementPolicyBytesV2,verifyReplacementPolicyV2,verifyOwnerAuthorityBindingV2,
 FORMAL_SURFACES,CTO_DECISION_DOMAIN_V1,NATIVE_CONTROL_SCHEMA,NATIVE_INVENTORY_SCHEMA,
 encodeNativeCapsule,sourceJson,nativeStableProjection,nativeBucketAnonymousMatches,parseDisabledIdentity,assertNoIdpContainerEnvOverrides,assessNativeReachability,
 verifyNativeSourceRaw,captureCurrentNativeSourceOnly,sourceOnly,
 verifyFormalEvidence,composeFormalReadback,
 requireLocalProtectedMain,assertFormalOutputSeparate,loadFormalSourceSpec,produceFormalRaw,parseFormal};
