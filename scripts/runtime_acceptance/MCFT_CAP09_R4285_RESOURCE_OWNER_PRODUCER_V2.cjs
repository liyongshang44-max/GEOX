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
 const {id,tables,acl,counts,databaseOwner,databaseOid,roleCaps}=data;
 assert.equal(id.session_user,data.expectedRole,"OWNER_PRODUCER_PG_SESSION_LOGIN");
 assert.equal(id.current_user,data.expectedRole,"OWNER_PRODUCER_PG_EFFECTIVE_LOGIN");
 assert.equal(id.database,data.expectedDb,"OWNER_PRODUCER_PG_DATABASE_ID");
 assert.deepEqual(tables,pgContract.REQUIRED_PUBLIC_TABLES,"OWNER_PRODUCER_PG_EXACT_29_TABLES");
 assert(acl.fenced_exists===true&&acl.fenced_execute===true&&acl.direct_insert===false&&
  acl.controller_acl===true,"OWNER_PRODUCER_PG_FENCED_ACL_INVALID");
 assert(roleCaps && Object.values(roleCaps).every(x=>x===false),
  "OWNER_PRODUCER_PG_LOGIN_NOT_RESTRICTED");
 assert(counts.length===29&&counts.every(x=>x==="0"),"OWNER_PRODUCER_PG_NONEMPTY");
 assert(Number.isInteger(databaseOid)&&databaseOid>0&&
  /^[a-z_][a-z0-9_]{3,62}$/.test(databaseOwner)&&
  !["postgres","qual_admin","qual_dedicated_admin"].includes(databaseOwner),
  "OWNER_PRODUCER_PG_DATABASE_OWNER_NOT_RESTRICTED");
 return {owner_role:databaseOwner,oid:databaseOid,role:data.expectedRole,
  tables:tables.length,all_tables_empty:true,restricted_role:true};
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
  phase="TABLE_COUNTS";
  const counts=[];
  for(const name of pgContract.REQUIRED_PUBLIC_TABLES){
   // Names are frozen constants, never caller-supplied SQL.
   const r=await client.query('SELECT count(*)::text AS n FROM public."'+name+'"');
   counts.push(r.rows[0]?.n);
  }
  phase="FACT_CONTRACT";
  return probeCatalogFacts({id,tables,acl:{...p,fenced_execute:fencedExecute,controller_acl:controller},
   counts,databaseOwner:own[0].owner,databaseOid:own[0].oid,
   roleCaps:roles[0],expectedRole:binding.role,expectedDb:binding.db});
 }catch(error){
  throw Error(pgFailureCode(error,binding.side,phase));
 }finally{
  if(client){if(started){try{await client.query("ROLLBACK");}catch{}}
   client.release();}
  await pool.end();
 }
}
async function probePg(i,env){
 const target=pgTarget(i,env);
 const pg=require(require.resolve("pg",{paths:[i.release_root]}));
 const a=await pgOne(pg,target.positive),b=await pgOne(pg,target.negative);
 assert(a.oid!==b.oid&&a.role!==b.role,"OWNER_PRODUCER_PG_SCOPE_COLLISION");
 // Catalog IDs are direct authenticated DB data, not a caller-provided label.
 return {status:"PASS_SCOPED_READONLY",positive_database:POS,negative_database:NEG,
  database_host:"127.0.0.1",database_port:i.database_port,audit_user:a.role,
  positive_rows_zero:a.all_tables_empty,negative_rows_zero:b.all_tables_empty,
  positive_database_exists:true,negative_database_exists:true,
  positive_login_restricted:a.restricted_role,negative_login_restricted:b.restricted_role,
  fenced_writer_execute_allowed:true,direct_fact_insert_forbidden:true,
  pg_owner_id:"pgdb:"+a.oid+":"+b.oid+":"+a.owner_role,
  probe_command_families:["BEGIN TRANSACTION READ ONLY","pg_catalog.pg_database","pg_catalog.pg_roles",
   "pg_catalog.pg_class","has_table_privilege","has_function_privilege","29x SELECT count(*) per database","ROLLBACK"],
  probes:{positive:{table_count:a.tables,owner:a.owner_role},
   negative:{table_count:b.tables,owner:b.owner_role}}};
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
 s3Target(i,env);
 const sdk=require(require.resolve("@aws-sdk/client-s3",{paths:[i.release_root]}));
 const {S3Client,HeadBucketCommand,ListObjectsV2Command,ListObjectVersionsCommand,
  ListMultipartUploadsCommand,GetBucketAclCommand,GetBucketPolicyCommand}=sdk;
 for(const f of [S3Client,HeadBucketCommand,ListObjectsV2Command,ListObjectVersionsCommand,
  ListMultipartUploadsCommand,GetBucketAclCommand,GetBucketPolicyCommand])
  assert(typeof f==="function","OWNER_PRODUCER_S3_SDK_REQUIRED");
 const client=new S3Client({endpoint:i.bucket_endpoint,region:env.MCFT_CAP09_FORMAL_RAW_REGION,
  forcePathStyle:true,maxAttempts:1,credentials:{
   accessKeyId:env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID,
   secretAccessKey:env.MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY}});
 try{
  await client.send(new HeadBucketCommand({Bucket:BUCKET}));
  const objects=await client.send(new ListObjectsV2Command({Bucket:BUCKET,MaxKeys:2}));
  const versions=await client.send(new ListObjectVersionsCommand({Bucket:BUCKET,MaxKeys:2}));
  const uploads=await client.send(new ListMultipartUploadsCommand({Bucket:BUCKET,MaxUploads:2}));
  assert(!objects.IsTruncated&&!(objects.Contents||[]).length,
   "OWNER_PRODUCER_S3_OBJECTS_EXIST");
  assert(!versions.IsTruncated&&!(versions.Versions||[]).length&&
   !(versions.DeleteMarkers||[]).length,
   "OWNER_PRODUCER_S3_VERSIONS_OR_MARKERS_EXIST");
  assert(!uploads.IsTruncated&&!(uploads.Uploads||[]).length,
   "OWNER_PRODUCER_S3_MULTIPART_EXIST");
  const acl=await client.send(new GetBucketAclCommand({Bucket:BUCKET}));
  let policy="UNPROVEN";
  try{await client.send(new GetBucketPolicyCommand({Bucket:BUCKET}));policy="POLICY_PRESENT";}
  catch(e){
   // Only an unambiguous NoSuchBucketPolicy response is admissible.
   if(["NoSuchBucketPolicy","NoSuchBucketPolicyException"].includes(e?.name))
    policy="NO_BUCKET_POLICY";
   else throw Error("OWNER_PRODUCER_S3_POLICY_READ_UNAVAILABLE");
  }
  const ownerId=assertS3Private(acl,policy);
  return {status:"PASS_SCOPED_READONLY",bucket_endpoint:i.bucket_endpoint,bucket:BUCKET,
   bucket_exists:true,bucket_empty_including_versions_multipart:true,
   bucket_private:true,s3_owner_id:ownerId,
   probe_operations:6,
   probe_commands:["HeadBucket","ListObjectsV2","ListObjectVersions",
    "ListMultipartUploads","GetBucketAcl","GetBucketPolicy"]};
 }finally{client.destroy();}
}
async function timed(label,fn){
 const now=performance.now();
 try{
  const result=await fn();return {component:label,status:"PASS_SCOPED_READONLY",
   elapsed_ms:round(performance.now()-now),result};
 }catch(e){
  const reason=typeof e?.message==="string"&&
   /^OWNER_PRODUCER_[A-Z0-9_:]+$/.test(e.message)?
   e.message:"OWNER_PRODUCER_COMPONENT_UNAVAILABLE";
  return {component:label,status:"HOLD",elapsed_ms:round(performance.now()-now),reason_code:reason};
 }
}
function unresolved(pg,s3){
 const blockers=[];
 if(pg.status!=="PASS_SCOPED_READONLY")blockers.push("PG_AUTHENTICATED_SCOPE_AND_ACL_NOT_PROVEN");
 if(s3.status!=="PASS_SCOPED_READONLY")blockers.push("S3_EMPTY_VERSIONS_MULTIPART_PRIVATE_NOT_PROVEN");
 // Complete global ownership and absence of all production bindings cannot
 // be inferred from two scoped logins and a single bucket ACL. Formal owner
 // exclusivity needs separately verifiable current resource-control evidence.
 blockers.push("OWNER_EXCLUSIVE_CONTROL_PLANE_NOT_PROVEN");
 blockers.push("PRODUCTION_BINDINGS_ABSENT_NOT_INDEPENDENTLY_PROVEN");
 return blockers;
}
async function diagnostic(i,env=process.env){
 host();validateInput(i);noLinks(__filename);
 const start=Date.now(),source_sha=sha(fs.readFileSync(__filename));
 const pg=await timed("PG_DUAL_DATABASE_READONLY",()=>probePg(i,env));
 const s3=await timed("S3_BUCKET_PRIVATE_VERSIONS_MULTIPART_READONLY",()=>probeS3(i,env));
 const blockers=unresolved(pg,s3);
 return {schema_version:"MCFT_CAP09_R4285_OWNER_PRODUCER_NONAUTH_DIAGNOSTIC_V1",
  status:"HOLD_NONAUTH_DIAGNOSTIC_NOT_SIGNED_OWNER",run_id:RUN,host_id:HOST,
  subject_sha:i.subject_sha,probe_type:PROBE,probe_source_sha256:source_sha,
  observed_at:new Date(start).toISOString(),completed_at:new Date().toISOString(),
  pg,s3,blockers,source_qualified:false,owner_exclusive_verified:false,
  formal_resource_readback_written:false,permit_issued:false,permit_consumed:false,
  execution_authorized:false,production_authorized:false,original_six_stages_executed:0};
}
function parse(argv){
 assert(argv.length===3&&argv[0]==="--diagnostic-only"&&argv[1]==="--input"&&
  path.isAbsolute(argv[2]),"OWNER_PRODUCER_ONLY_DIAGNOSTIC_ALLOWED");
 noLinks(argv[2]);const st=fs.statSync(argv[2]);
 assert(st.isFile()&&st.size>0&&st.size<16384,"OWNER_PRODUCER_INPUT_FILE_INVALID");
 const input=JSON.parse(fs.readFileSync(argv[2],"utf8").replace(/^\uFEFF/,""));
 return validateInput(input);
}
if(require.main===module){
 Promise.resolve().then(()=>diagnostic(parse(process.argv.slice(2)))).then(x=>{
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
 probePg,probeS3,diagnostic,parse};
