"use strict";
/* R4285 Trust V2 - pre-approval boundary, NEVER a registration act.
 * Original V1 Trust remains exact and immutable. New public registration and
 * governance approval are independent prerequisites; neither creates Permit.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const SHA=/^[a-f0-9]{64}$/,UTC=s=>typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const OLD_SHA="dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7";
const RUN="4285c3ce342c",HOST="LAPTOP-STN2A2P1",OP="mcft_cap09_operator_mylr1";
function candidate(v1Raw,v2Raw,{now=Date.now()}={}){
 assert(Buffer.isBuffer(v1Raw)&&Buffer.isBuffer(v2Raw),"TRUST_V2_RAW_BYTES_REQUIRED");
 assert.equal(sha(v1Raw),OLD_SHA,"TRUST_V2_HISTORIC_V1_DRIFT");
 const old=JSON.parse(v1Raw.toString("utf8")),next=JSON.parse(v2Raw.toString("utf8"));
 assert.equal(old.schema_version,"geox_mcft_cap09_retry_trust_v1");
 assert.equal(next.schema_version,old.schema_version,"TRUST_V2_LEGACY_WIRE_SCHEMA_DRIFT");
 for(const k of ["host_id","operator_id","ledger_root","adopted","execution_enabled",
  "real_delay_controller_adopted","stage_capability_adopted",
  "real_provider_transport_delay_adopted","real_pipeline_delay_adopted"]){
  assert.deepEqual(next[k],old[k],"TRUST_V2_FROZEN_FIELD_DRIFT:"+k);
 }
 assert.equal(next.host_id,HOST);assert.equal(next.operator_id,OP);
 assert.equal(next.adopted,false);assert.equal(next.execution_enabled,false);
 assert(Array.isArray(old.issuers)&&old.issuers.length===2&&Array.isArray(next.issuers),
  "TRUST_V2_ISSUER_SHAPE");
 assert(next.issuers.length===2||next.issuers.length===3,"TRUST_V2_EXACTLY_ONE_SUCCESSOR");
 for(let i=0;i<2;i++)assert.deepEqual(next.issuers[i],old.issuers[i],"TRUST_V2_OLD_ISSUER_CHANGED");
 const s=next.succession;
 assert(s&&s.schema_version==="MCFT_CAP09_TRUST_V2_REGISTRATION_CANDIDATE_V1");
 assert.equal(s.prior_trust_raw_sha256,OLD_SHA);
 assert.equal(s.registration_scope,"CAP09_ISOLATED_TEST_ONLY");
 assert.equal(s.resource_run_id,RUN);assert.equal(s.attempt_ordinal,4);
 assert.equal(s.production_authorized,false);assert.equal(s.permit_authorized,false);
 assert.equal(s.trust_successor_activated,false,"TRUST_V2_SELF_ACTIVATION_FORBIDDEN");
 if(next.issuers.length===2){
  assert.equal(s.operator_successor_key_id,null,"TRUST_V2_MISSING_PUBLIC_REGISTRATION");
  assert.equal(s.registration_state,"PENDING_NEW_OPERATOR_PUBLIC_KEY_AND_INDEPENDENT_OWNER_AUTHORITY");
  return Object.freeze({status:"TRUST_V2_CANDIDATE_MISSING_OPERATOR_KEY_HOLD",registered:false,
   authorized:false,production_authorized:false,permit_authorized:false});
 }
 const k=next.issuers[2];
 assert.equal(k.issuer_id,OP,"TRUST_V2_OPERATOR_ID_MUST_REMAIN");
 assert.equal(k.role,"ACCOUNTABLE_SINGLE_OPERATOR","TRUST_V2_ROLE_NOT_OWNER");
 assert.equal(k.revoked,false,"TRUST_V2_NEW_KEY_REVOKED");
 assert(/^[A-Za-z0-9_-]{1,128}$/.test(k.key_id)&&!old.issuers.some(x=>x.key_id===k.key_id),
  "TRUST_V2_DUPLICATE_KEY_ID");
 assert(UTC(k.not_before)&&UTC(k.not_after),"TRUST_V2_NEW_KEY_TIME");
 const start=Date.parse(k.not_before),end=Date.parse(k.not_after);
 assert(start<=now&&now<end&&end>start&&end-start<=90*86400000,"TRUST_V2_WINDOW_NOT_ELIGIBLE");
 assert.equal(s.operator_successor_key_id,k.key_id,"TRUST_V2_KEY_ID_UNBOUND");
 assert(SHA.test(k.spki_sha256),"TRUST_V2_SP KI_SHA");
 const key=crypto.createPublicKey(k.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519","TRUST_V2_ED25519");
 assert.equal(sha(key.export({format:"der",type:"spki"})),k.spki_sha256,"TRUST_V2_SPKI_DRIFT");
 assert.equal(s.registration_state,"PENDING_INDEPENDENT_OWNER_AUTHORITY");
 // Authorization is NEVER caller-provided boolean. A separate native
 // protected-main registration authority verifier must be satisfied.
 return Object.freeze({status:"TRUST_V2_PUBLIC_KEY_CANDIDATE_ONLY_NOT_AUTHORIZED",
  registered:false,authorized:false,production_authorized:false,permit_authorized:false});
}
function verifyEffective(){throw Error("HOLD_TRUST_V2_INDEPENDENT_REGISTRATION_AUTHORITY_NOT_YET_QUALIFIED");}
module.exports={candidate,verifyEffective,OLD_SHA,RUN,HOST,OP};
