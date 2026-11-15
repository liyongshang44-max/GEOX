#!/usr/bin/env node
"use strict";
/* Local R4285 purpose-separated signatures. Never issues a Permit.
 * Requires the separately verified protected-main Trust V2 Owner registration.
 * Does not accept a caller-created "approved" boolean as authority.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const crypto=require("node:crypto"),readline=require("node:readline/promises");
const gate=require("../runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs");
const owner=require("./MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const adoption=require("./MCFT_CAP09_R4285_ADOPTION_V5_V3.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const ROOT=path.resolve(__dirname,"../.."),TRUST=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json");
const PURPOSES=Object.freeze({
 owner:{fields:owner.OWNER_FIELDS,domain:owner.DOMAIN_OWNER,
  schema:"MCFT_CAP09_R4285_OWNER_INVENTORY_AND_ORDINAL_V1",
  decision:"APPROVE_BOUNDED_INVENTORY_AS_EXHAUSTIVE_AND_ADJUDICATE_ORDINAL_ONLY"},
 lineage:{fields:lineage.LINEAGE_FIELDS,domain:lineage.DOMAIN,
  schema:"MCFT_CAP09_R4285_PURPOSE_SPECIFIC_LINEAGE_V1",
  decision:"APPROVE_R4285_LINEAGE_NOT_ADOPTION_OR_PERMIT"},
 adoption:{fields:adoption.FIELDS,domain:adoption.DOMAIN,
  schema:"MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V5",
  decision:"APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT"}
});
function utc(s){assert(typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s,"R4285_SIGN_UTC");return Date.parse(s);}
function validate(p,purpose,trust,subject,now=Date.now()){
 const c=PURPOSES[purpose];assert(c,"R4285_SIGN_PURPOSE_NOT_ALLOWED");
 assert(p&&typeof p==="object"&&!Array.isArray(p),"R4285_SIGN_PAYLOAD");
 assert.deepEqual(Object.keys(p).sort(),[...c.fields].sort(),"R4285_SIGN_EXACT_FIELDS");
 assert.equal(p.schema_version,c.schema);
 assert.equal(p.decision,c.decision);
 assert.equal(p.issuer_id,gate.OP);assert.equal(p.host_id,gate.HOST);
 assert.equal(p.run_id,gate.RUN);assert.equal(p.subject_sha,subject,"R4285_SIGN_SUBJECT_NOT_MERGED");
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.production_authorized,false);
 if(Object.hasOwn(p,"permit_authorized"))assert.equal(p.permit_authorized,false);
 if(Object.hasOwn(p,"attempt_ordinal"))assert.equal(p.attempt_ordinal,4);
 if(Object.hasOwn(p,"adjudicated_ordinal"))assert.equal(p.adjudicated_ordinal,4);
 if(purpose==="lineage"){assert.equal(p.parent_run_id,"72dc0304a21a");assert.equal(p.failed_predecessor_run_id,"6ff9b41f6f7f");}
 const issuer=trust.issuers.filter(k=>k.issuer_id===p.issuer_id&&k.key_id===p.key_id);
 assert.equal(issuer.length,1);assert.equal(issuer[0].role,"ACCOUNTABLE_SINGLE_OPERATOR");
 assert.equal(issuer[0].revoked,false);
 assert(!trust.issuers.slice(0,2).some(k=>k.key_id===p.key_id),"R4285_SIGN_OLD_KEY_FORBIDDEN");
 const start=utc(p.issued_at),end=utc(p.expires_at);
 assert(start<=now&&now<end&&end-start<=86400000,"R4285_SIGN_NOT_SHORT_LIVED");
 assert(utc(issuer[0].not_before)<=start&&end<=utc(issuer[0].not_after),"R4285_SIGN_KEY_TIME");
 return {domain:c.domain,issuer:issuer[0]};
}
async function main(args){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"R4285_SIGN_WINDOWS_OPERATOR_ONLY");
 assert.equal(args.length,5,"USAGE: node SIGN...cjs owner|lineage|adoption PAYLOAD_JSON PRIVATE_KEY_PEM NEW_OUTPUT_JSON TRUST_V2_AUTHORITY_JSON");
 const [purpose,payloadFile,privateFile,outputFile,authorityFile]=args;
 for(const f of [payloadFile,privateFile,outputFile,authorityFile])assert(path.isAbsolute(f),"R4285_SIGN_ABSOLUTE_PATH_REQUIRED");
 const rel=path.relative(ROOT,outputFile);
 assert(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel),"R4285_SIGN_OUTPUT_OUTSIDE_SOURCE");
 assert(!fs.existsSync(outputFile),"R4285_SIGN_OUTPUT_EXCLUSIVE");
 const trustBytes=fs.readFileSync(TRUST);
 const approved=gate.verifyEffective({authority_file:authorityFile,source_root:ROOT,trust_v2_bytes:trustBytes});
 assert.equal(approved.status,"TRUST_V2_OWNER_NATIVE_GOVERNANCE_AND_REGISTERED_KEY_VERIFIED_NOT_PERMIT");
 const trust=JSON.parse(trustBytes.toString("utf8"));
 const payload=JSON.parse(fs.readFileSync(payloadFile,"utf8"));
 const {domain,issuer}=validate(payload,purpose,trust,approved.subject_sha);
 const privateKey=crypto.createPrivateKey(fs.readFileSync(privateFile));
 assert.equal(privateKey.asymmetricKeyType,"ed25519");
 const spki=sha(crypto.createPublicKey(privateKey).export({type:"spki",format:"der"}));
 assert.equal(spki,issuer.spki_sha256,"R4285_SIGN_NEW_PRIVATE_KEY_NOT_REGISTERED");
 const prompt=readline.createInterface({input:process.stdin,output:process.stdout});
 const phrase="SIGN_R4285_"+purpose.toUpperCase()+"_TEST_ONLY_NOT_PERMIT";
 let entered;try{entered=await prompt.question("Type "+phrase+" to issue one non-execution signature: ")}finally{prompt.close()}
 assert.equal(entered,phrase,"R4285_SIGN_OPERATOR_DECLINED");
 const signature=crypto.sign(null,Buffer.from(domain+owner.canonical(payload)),privateKey).toString("base64");
 const pub=crypto.createPublicKey(privateKey);
 assert(crypto.verify(null,Buffer.from(domain+owner.canonical(payload)),pub,Buffer.from(signature,"base64")),"R4285_SIGNATURE_INTERNAL_VERIFY");
 const bytes=Buffer.from(JSON.stringify({payload,signature_base64:signature},null,2)+"\n","utf8");
 const fd=fs.openSync(outputFile,"wx",0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 console.log(JSON.stringify({status:"R4285_"+purpose.toUpperCase()+"_SIGNED_ONCE_NOT_ADOPTION_OR_PERMIT",
   envelope_sha256:sha(bytes),subject_sha:approved.subject_sha,permit_issued:false,
   permit_consumed:false,execute_authorized:false,production_authorized:false}));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error("HOLD_R4285_TRUST_V2_PURPOSE_SIGNING:"+String(e.message||e).slice(0,240));process.exitCode=1});
module.exports={validate,PURPOSES};
