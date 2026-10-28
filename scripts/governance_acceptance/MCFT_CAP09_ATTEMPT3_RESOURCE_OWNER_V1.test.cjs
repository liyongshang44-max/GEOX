"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const owner=require("./MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs");
const a3=require("./MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const sha=v=>crypto.createHash("sha256").update(v).digest("hex");
function input(){
 const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
 const p={schema_version:"MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1",issuer_id:"operator",key_id:"test",
 run_id:a3.RUN,subject_sha:"f".repeat(40),host_id:"LAPTOP-STN2A2P1",scope:"TEST_ONLY",production_authorized:false,
 observed_at:"2026-10-28T12:00:00.000Z",issued_at:"2026-10-28T12:01:00.000Z",expires_at:"2026-10-28T12:04:00.000Z",
 readback_sha256:"e".repeat(64),database_host:"127.0.0.1",database_port:55488,
 positive_database:"mcft_cap09_requal_"+a3.RUN+"_positive",
 negative_database:"mcft_cap09_requal_"+a3.RUN+"_negative",audit_user:"cap09_a3_readonly",
 positive_rows_zero:true,negative_rows_zero:true,positive_database_exists:true,negative_database_exists:true,
 positive_login_restricted:true,negative_login_restricted:true,fenced_writer_execute_allowed:true,direct_fact_insert_forbidden:true,
 bucket_endpoint:"http://127.0.0.1:59088",bucket:"mcft-cap09-requal-"+a3.RUN,
 bucket_exists:true,bucket_empty_including_versions_multipart:true,bucket_private:true,
 production_bindings_present:false,owner_exclusive:true,pg_owner_id:"dedicated_pg_attempt3",s3_owner_id:"dedicated_s3_attempt3"};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:p.host_id,operator_id:"operator",
  issuers:[{issuer_id:"operator",key_id:"test",role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,
   not_before:"2026-10-28T00:00:00.000Z",not_after:"2026-10-29T00:00:00.000Z",
   public_key_pem:publicKey.export({type:"spki",format:"pem"}),spki_sha256:sha(publicKey.export({type:"spki",format:"der"}))}]};
 const ctx={subject_sha:p.subject_sha,host_id:p.host_id,readback_sha256:p.readback_sha256,now:Date.parse("2026-10-28T12:02:00.000Z")};
 const sign=(x,dom=owner.DOMAIN)=>({payload:x,signature_base64:crypto.sign(null,Buffer.from(dom+a3.canonical(x)),privateKey).toString("base64")});
 return {p,trust,ctx,sign};
}
test("signed PG/S3 owner observations validate but are never independently physically proven",()=>{
 const x=input(),r=owner.verify(x.sign(x.p),x.trust,x.ctx);
 assert.equal(r.status,"HOST_RESOURCE_OWNER_SIGNED_ATTESTATION_VERIFIED_NOT_INDEPENDENT_PHYSICAL_READBACK");
 assert.equal(r.permit_authorized,false);
});
test("reject wrong run/resource endpoints, tenant fallback and unsafe ACL observations",()=>{
 const x=input();
 const changes=[["database_port",55445],["bucket_endpoint","http://127.0.0.1:59005"],
  ["database_host","db.internal"],["positive_database","mcft_cap09_requal_da9db7129607_positive"],
  ["negative_database","shared"],["audit_user","postgres"],["bucket","mcft-cap09-requal-da9db7129607"],
  ["bucket_private",false],["direct_fact_insert_forbidden",false],["fenced_writer_execute_allowed",false],
  ["production_bindings_present",true],["positive_login_restricted",false],["negative_rows_zero",false],
  ["bucket_empty_including_versions_multipart",false],["owner_exclusive",false],["subject_sha","0".repeat(40)]];
 for(const [key,val] of changes)assert.throws(()=>owner.verify(x.sign({...x.p,[key]:val}),x.trust,x.ctx),key);
});
test("reject stale resource readback, expired evidence and signing key mismatch",()=>{
 const x=input();
 const c=structuredClone(x.ctx);c.now=Date.parse("2026-10-28T12:06:00.000Z");
 assert.throws(()=>owner.verify(x.sign(x.p),x.trust,c));
 const revoked=structuredClone(x.trust);revoked.issuers[0].revoked=true;
 assert.throws(()=>owner.verify(x.sign(x.p),revoked,x.ctx));
 assert.throws(()=>owner.verify(x.sign(x.p,"wrong-domain\n"),x.trust,x.ctx));
});

test("signed owner properties must be individually backed by captured raw PG/S3 facts",()=>{
 const x=input();
 const valid={sha256:x.p.readback_sha256,status:"RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY",
  facts:{schema_version:"MCFT_CAP09_ATTEMPT3_RESOURCE_READBACK_V1",run_id:a3.RUN,
   status:"PASS",probe_type:"WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST",
   probe_source_sha256:"f".repeat(64),production_authorized:false}};
 for(const k of owner.FACT_BINDINGS)valid.facts[k]=x.p[k];
 assert.equal(owner.bindSignedToReadback(x.p,valid),true);
 const bad=structuredClone(valid);bad.facts.positive_rows_zero=false;
 assert.throws(()=>owner.bindSignedToReadback(x.p,bad),/A3_RESOURCE_ATTESTATION_CONTRADICTS_RAW:positive_rows_zero/);
 const badHost=structuredClone(valid);badHost.facts.host_id="unknown";
 assert.throws(()=>owner.bindSignedToReadback(x.p,badHost));
 const changedBytes=structuredClone(valid);changedBytes.sha256="0".repeat(64);
 assert.throws(()=>owner.bindSignedToReadback(x.p,changedBytes));
});

test("all locally discovered occupied historical PG and S3 ports remain non-reusable",()=>{
 const x=input();
 for(const old of [55445,55446,55477,55478,55479,55480,55481,55482]){
  assert.throws(()=>owner.validateFacts({...x.p,database_port:old},x.ctx),"historical PG "+old);
 }
 for(const old of [59005,59006,59277,59278,59279,59280,59281,59282]){
  assert.throws(()=>owner.validateFacts({...x.p,bucket_endpoint:"http://127.0.0.1:"+old},x.ctx),"historical S3 "+old);
 }
});
