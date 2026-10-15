"use strict";
// Synthetic, negative-focused provisioning acceptance. No live permit issuance.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {provision}=require("../runtime_acceptance/MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs");
const {verifyPermit,DOMAIN,canonical,sha}=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
// Exact QCP ownership is required; adding a workflow must not leave an unknown path.
const qcp=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
const issuerResolver=qcp.dependency_resolvers.A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_V1;
assert.equal(issuerResolver.kind,"EXACT_PATH_SET");
const issuerPaths=[".github/workflows/mcft-cap09-independent-retry-issuer-v1.yml", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs", "scripts/runtime_acceptance/MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs"];
for(const file of issuerPaths)assert.equal(issuerResolver.paths.filter(p=>p===file).length,1,"ISSUER_EXACT_QCP_REGISTRATION_REQUIRED:"+file);
assert(issuerResolver.paths.every(p=>!p.includes('*')&&!p.includes('?')),"ISSUER_WILDCARD_REGISTRATION_FORBIDDEN");
const engineering=qcp.checks.find(c=>c.check_id==="A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY");
assert(engineering.resolver_ids.includes("A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_V1"));
assert.equal(engineering.carry_forward_policy,"NONE");
const fixedTrust=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"),"utf8"));
assert.equal(fixedTrust.adopted,false,"STATIC_ADOPTION_MUST_REMAIN_DISABLED");
assert.equal(fixedTrust.execution_enabled,false,"STATIC_EXECUTION_MUST_REMAIN_DISABLED");
const realIssuers=fixedTrust.issuers.filter(x=>x.role==="INDEPENDENT_RETRY_GOVERNANCE");
assert.equal(realIssuers.length,1,"EXACT_ONE_INDEPENDENT_RETRY_ISSUER_REQUIRED");
const realIssuer=realIssuers[0];
assert.equal(realIssuer.issuer_id,"mcft_cap09_independent_retry_governance");
assert.equal(realIssuer.key_id,"cap09_retry_ed25519_20261015");
assert.equal(realIssuer.revoked,false);
assert.notEqual(realIssuer.issuer_id,fixedTrust.operator_id,"ISSUER_CONTROL_ROLE_MUST_DIFFER");
assert.equal(realIssuer.spki_sha256,"ef7459a5918e35c90913532a7c8af545fbca4fec0b7dc95916797db3303fa870");
assert.equal(sha(crypto.createPublicKey(realIssuer.public_key_pem).export({format:"der",type:"spki"})),realIssuer.spki_sha256);
assert(new Date(realIssuer.not_before).getTime()<new Date(realIssuer.not_after).getTime());
const root=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-retry-issuer-test-"));
const iso=n=>new Date(n).toISOString();
let tests=0;
try {
 const now=Date.now(),from=iso(now-60000),to=iso(now+1800000);
 const priv=path.join(root,"retry-private.pem"),registration=path.join(root,"public.json");
 const args=["test_independent_governance","test_retry_key",from,to,priv,registration];
 function rejects(a,rx){assert.throws(()=>provision(a),rx);tests++;}
 rejects(["mcft_cap09_operator_mylr1",...args.slice(1)],/ISSUER_NOT_INDEPENDENT/);
 rejects([args[0],args[1],from,iso(now-1000),priv,registration],/ISSUER_LIFETIME_INVALID/);
 rejects([args[0],args[1],from,to,path.resolve(__dirname,"../test-private.pem"),registration],/ISSUER_OUTPUT_OUTSIDE_REPO_REQUIRED/);
 const result=provision(args);
 assert.equal(result.status,"INDEPENDENT_RETRY_ISSUER_PROVISIONED_OFFLINE");
 const reg=JSON.parse(fs.readFileSync(registration,"utf8"));
 assert.equal(reg.role,"INDEPENDENT_RETRY_GOVERNANCE");
 assert.notEqual(reg.issuer_id,"mcft_cap09_operator_mylr1");
 const pub=crypto.createPublicKey(reg.public_key_pem);
 assert.equal(sha(pub.export({format:"der",type:"spki"})),reg.spki_sha256);
 assert.equal(crypto.createPrivateKey(fs.readFileSync(priv)).asymmetricKeyType,"ed25519");tests++;
 rejects(args,/ISSUER_OUTPUT_ALREADY_EXISTS/);
 const payload={schema_version:"geox_mcft_cap09_signed_retry_permit_v1",issuer_id:reg.issuer_id,key_id:reg.key_id,
 nonce:"a".repeat(64),run_id:"abcdef123456",parent_run_id:"72dc0304a21a",attempt_ordinal:2,
 subject_sha:"b".repeat(40),host_id:"synthetic-host",issued_at:iso(now-1000),expires_at:iso(now+60000),
 arm_sha256:"c".repeat(64),observations_sha256:"d".repeat(64),plan_sha256:"e".repeat(64),
 scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT"};
 const key=crypto.createPrivateKey(fs.readFileSync(priv));
 const sign=p=>({payload:p,signature_base64:crypto.sign(null,Buffer.from(DOMAIN+canonical(p)),key).toString("base64")});
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:true,execution_enabled:false,
 host_id:payload.host_id,operator_id:"synthetic-operator",ledger_root:root,issuers:[reg]};
 const context={host_id:payload.host_id,head:payload.subject_sha,main:payload.subject_sha,clean:true,now:iso(now),
 arm_sha256:payload.arm_sha256,observations_sha256:payload.observations_sha256,plan_sha256:payload.plan_sha256};
 assert.equal(verifyPermit(sign(payload),trust,context).execute_authorized,false);tests++;
 const bad=(p,t,c,re)=>{assert.throws(()=>verifyPermit(sign(p),t,c),re);tests++;};
 bad({...payload,expires_at:iso(now-1)},trust,context,/EXPIRED_OR_FUTURE/);
 bad({...payload,run_id:"72dc0304a21a"},trust,context,/FRESH_RUN/);
 bad({...payload,host_id:"another-host"},trust,context,/WRONG_HOST/);
 bad({...payload,arm_sha256:"f".repeat(64)},trust,context,/DIGEST_MISMATCH/);
 bad(payload,{...trust,operator_id:reg.issuer_id},context,/NOT_INDEPENDENT/);
 assert.throws(()=>verifyPermit({...sign(payload),signature_base64:"A".repeat(88)},trust,context));tests++;
 console.log(JSON.stringify({status:"INDEPENDENT_RETRY_ISSUER_SYNTHETIC_ACCEPTANCE_PASS",checks:tests,
 live_permit_signed:false,execution_authorized:false,production_authorized:false}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
