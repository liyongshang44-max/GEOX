// Append-only publication sink + independently signature-verified customer read.
import type { Pool } from "pg";
import {
  PRODUCT_MCFT_PUBLICATION_DATABASE_V1,
  verifyMcftFieldStatePublicationV1,
  type McftPublicationTrustPolicyV1,
  type PublishedResearchScopeV1,
  type SignedMcftFieldStatePublicationV1,
  type VerifiedMcftPublicationV1,
} from "../../apps/server/src/product_projection/publication/mcft_verified_field_state_publication_v1.js";

const RELATION = "product_mcft_publication_v1.field_state_receipt_v1";
const WRITER_LOGIN = "geox_mcft_publication_publisher_login_v1";
const READER_LOGIN = "geox_product_readonly_login_v1";
const WRITE_ROLE = "geox_mcft_publication_writer_v1";
const READ_ROLE = "geox_product_readonly_v1";
function fail(code:string):never { throw new Error("PRODUCT_MCFT_PUBLICATION_"+code); }
type Identity = { db:string; username:string; member:boolean; readonly_mode:string; database_now:Date };
type PublicationRow = {
 publication_id:string;
 tenant_id:string; project_id:string; group_id:string; field_id:string; season_id:string; zone_id:string;
 source_logical_time:Date; source_evidence_visible_at:Date; source_readback_as_of:Date; certified_at:Date;
 source_state_ref:string; source_state_hash:string; source_graph_readback_sha256:string;
 issuer_key_id:string; statement_json:unknown; signature_base64:string;
 verification_verdict:string; received_at:Date;
};
async function identity(pool:Pick<Pool,"query">, role:string):Promise<Identity> {
 const result=await pool.query<Identity>(
   "SELECT current_database()::text AS db,current_user::text AS username,pg_has_role(current_user,$1::text,'USAGE') AS member,current_setting('transaction_read_only')::text AS readonly_mode,clock_timestamp() AS database_now",
   [role],
 );
 const row=result.rows[0];
 if(!row || row.db!==PRODUCT_MCFT_PUBLICATION_DATABASE_V1) fail("OPERATIONAL_DATABASE_REQUIRED");
 if(!row.member) fail("PUBLICATION_ROLE_MEMBERSHIP_REQUIRED");
 if(!(row.database_now instanceof Date)||!Number.isFinite(row.database_now.getTime())) fail("DATABASE_CLOCK_NOT_VERIFIED");
 return row;
}
function exactRow(row:PublicationRow,statement:VerifiedMcftPublicationV1) {
 const {source}=statement.statement;
 const fields=["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
 for(const k of fields)if(row[k]!==statement.statement.scope[k])fail("STORED_SCOPE_MISMATCH:"+k);
 if(row.publication_id!==statement.publication_id
    ||row.source_state_ref!==source.posterior_state_ref
    ||row.source_state_hash!==source.posterior_state_hash
    ||row.source_graph_readback_sha256!==source.complete_exact_graph_receipt_sha256
    ||row.issuer_key_id!==statement.key_id
    ||row.signature_base64!==statement.signature_base64
    ||row.verification_verdict!=="SIGNED_SOURCE_GRAPH_VERIFIED") fail("STORED_PROVENANCE_MISMATCH");
 for(const [k,v] of [
  ["source_logical_time",source.logical_time],
  ["source_evidence_visible_at",source.evidence_visible_at],
  ["source_readback_as_of",source.readback_as_of],
  ["certified_at",statement.statement.certified_at],
 ] as const){
   const dbTime=row[k];
   if(!(dbTime instanceof Date)||dbTime.toISOString()!==v)fail("STORED_TIME_MISMATCH:"+k);
 }
 if(!(row.received_at instanceof Date)||row.received_at.getTime()<new Date(statement.statement.certified_at).getTime())fail("STORED_INGEST_TIME_INVALID");
}
export type VerifiedPublishedCurrentV1 =
 | {status:"UNAVAILABLE";reason_codes:readonly string[];publication:null}
 | {status:"LIMITED";reason_codes:readonly string[];publication:null}
 | {status:"PUBLISHED_UNQUALIFIED_24T";reason_codes:readonly string[];publication:VerifiedMcftPublicationV1 & {received_at:string}};
/**
 * A separately authenticated publisher calls this only after verifying the
 * exact CAP07 graph on the source. The signature is verified again on read.
 * No host process or Cron is created; the owner must qualify a publisher.
 */
export async function appendVerifiedMcftPublicationV1(
 pool:Pool,
 capsule:SignedMcftFieldStatePublicationV1,
 policy:McftPublicationTrustPolicyV1,
):Promise<{publication_id:string;inserted:boolean}> {
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const i=await identity(client,WRITE_ROLE);
  if(i.username!==WRITER_LOGIN || i.readonly_mode!=="off")fail("WRITER_IDENTITY_NOT_ADMITTED");
  const checked=verifyMcftFieldStatePublicationV1(capsule,policy,i.database_now.toISOString());
  const st=checked.statement,scope=st.scope,src=st.source;
  const write=await client.query<{publication_id:string}>(
   `INSERT INTO ${RELATION}
    (publication_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,
     source_logical_time,source_evidence_visible_at,source_readback_as_of,certified_at,
     source_state_ref,source_state_hash,source_graph_readback_sha256,issuer_key_id,
     statement_json,signature_base64,verification_verdict)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,'SIGNED_SOURCE_GRAPH_VERIFIED')
    ON CONFLICT (publication_id) DO NOTHING RETURNING publication_id`,
   [checked.publication_id,scope.tenant_id,scope.project_id,scope.group_id,
    scope.field_id,scope.season_id,scope.zone_id,src.logical_time,src.evidence_visible_at,
    src.readback_as_of,st.certified_at,src.posterior_state_ref,src.posterior_state_hash,
    src.complete_exact_graph_receipt_sha256,checked.key_id,JSON.stringify(st),checked.signature_base64],
  );
  const inserted=write.rows.length===1;
  if(!inserted){
    const old=await client.query<PublicationRow>(`SELECT * FROM ${RELATION} WHERE publication_id=$1`,[checked.publication_id]);
    if(old.rows.length!==1)fail("CONFLICT_READBACK_INVALID");
    const restored=verifyMcftFieldStatePublicationV1({
      statement:old.rows[0].statement_json as SignedMcftFieldStatePublicationV1["statement"],
      key_id:old.rows[0].issuer_key_id,
      signature_base64:old.rows[0].signature_base64,
    },policy,i.database_now.toISOString());
    exactRow(old.rows[0],restored);
    if(restored.publication_id!==checked.publication_id ||restored.signature_base64!==checked.signature_base64)fail("REPLAY_DATA_DIFFERENT");
  }
  await client.query("COMMIT");
  return {publication_id:checked.publication_id,inserted};
 }catch(e){await client.query("ROLLBACK").catch(()=>undefined);throw e;}
 finally{client.release();}
}
/** Product read-only: even an administrator-forged DB row fails signature check. */
export async function readVerifiedPublishedCurrentV1(
 pool:Pool, scope:PublishedResearchScopeV1, policy:McftPublicationTrustPolicyV1,
):Promise<VerifiedPublishedCurrentV1> {
 const i=await identity(pool,READ_ROLE);
 if(i.username!==READER_LOGIN||i.readonly_mode!=="on")fail("READONLY_CONSUMER_NOT_ADMITTED");
 if(Object.keys(scope).length!==6)fail("READ_SCOPE_SHAPE_INVALID");
 for(const k of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const)
  if(scope[k]!==policy.allowed_scope[k])fail("CROSS_CUSTOMER_SCOPE_FORBIDDEN");
 const rows=await pool.query<PublicationRow>(
   `SELECT * FROM ${RELATION}
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       AND received_at<=clock_timestamp() AND source_evidence_visible_at<=clock_timestamp()
     ORDER BY source_logical_time DESC,source_evidence_visible_at DESC,received_at DESC,publication_id ASC
     LIMIT 2`,
   [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id],
 );
 if(rows.rows.length===0)return {status:"UNAVAILABLE",reason_codes:["MCFT_NO_VERIFIED_PUBLISHED_STATE"],publication:null};
 const verified=rows.rows.map(row=>{
  const capsule:SignedMcftFieldStatePublicationV1={
    statement:row.statement_json as SignedMcftFieldStatePublicationV1["statement"],
    key_id:row.issuer_key_id,signature_base64:row.signature_base64,
  };
  const proof=verifyMcftFieldStatePublicationV1(capsule,policy,i.database_now.toISOString());
  exactRow(row,proof);
  return {...proof,received_at:row.received_at.toISOString()};
 });
 if(verified.length===2 &&
  verified[0].statement.source.logical_time===verified[1].statement.source.logical_time &&
  verified[0].statement.source.posterior_state_hash!==verified[1].statement.source.posterior_state_hash){
    return {status:"LIMITED",reason_codes:["MCFT_COMPETING_PUBLISHED_STATE_REVISION_NOT_ADJUDICATED"],publication:null};
 }
 return {status:"PUBLISHED_UNQUALIFIED_24T",
  reason_codes:["MCFT_CAP09_24T_QUALIFICATION_NOT_CLAIMED","PRODUCT_TEMPORAL_FRESHNESS_POLICY_NOT_ESTABLISHED"],
  publication:verified[0]};
}
