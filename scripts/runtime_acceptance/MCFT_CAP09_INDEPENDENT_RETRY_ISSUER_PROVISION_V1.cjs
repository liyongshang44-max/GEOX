"use strict";
// Windows-only offline provisioning. NEVER checks in a private key, changes trust,
// signs a retry permit, or activates any production/test execution.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const {sha} = require("./MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const TRUST = path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V1.json");
const ID = /^[A-Za-z0-9_-]{1,128}$/;
function epoch(s) {
  assert(typeof s === "string" && Number.isFinite(Date.parse(s)) &&
    new Date(Date.parse(s)).toISOString() === s, "ISSUER_CANONICAL_TIME_REQUIRED");
  return Date.parse(s);
}
function noLinks(p) {
  let at=path.resolve(p);
  for (;;) {
    assert(!fs.lstatSync(at).isSymbolicLink(),"ISSUER_LINK_FORBIDDEN");
    const parent=path.dirname(at); if(parent===at)break; at=parent;
  }
}
function provision(args,opts={}) {
  assert(args.length===6,"USAGE: provision issuer-id key-id not-before-UTC not-after-UTC private.pem registration.json");
  const [issuerId,keyId,from,to,privateFile,registrationFile]=args;
  assert(ID.test(issuerId)&&ID.test(keyId),"ISSUER_ID_INVALID");
  const start=epoch(from),end=epoch(to),now=Date.now();
  assert(start<=now&&now<end&&end-start<=90*86400000,"ISSUER_LIFETIME_INVALID");
  const trust=JSON.parse(fs.readFileSync(TRUST,"utf8"));
  assert(issuerId!==trust.operator_id,"ISSUER_NOT_INDEPENDENT");
  assert(!trust.issuers.some(i=>i.issuer_id===issuerId||i.key_id===keyId),"ISSUER_DUPLICATE");
  assert(trust.adopted===false&&trust.execution_enabled===false,"TRUST_MUST_REMAIN_DISABLED");
  const root=path.resolve(__dirname,"../..");
  const outside=p=>{const rel=path.relative(root,p);return rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel);};
  const a=path.resolve(privateFile),b=path.resolve(registrationFile);
  assert(path.isAbsolute(privateFile)&&path.isAbsolute(registrationFile),"ISSUER_ABSOLUTE_PATH_REQUIRED");
  assert(outside(a)&&outside(b)&&a!==b,"ISSUER_OUTPUT_OUTSIDE_REPO_REQUIRED");
  assert(!fs.existsSync(a)&&!fs.existsSync(b),"ISSUER_OUTPUT_ALREADY_EXISTS");
  assert(fs.existsSync(path.dirname(a))&&fs.existsSync(path.dirname(b)),"ISSUER_PARENT_MISSING");
  noLinks(path.dirname(a)); noLinks(path.dirname(b));
  assert(!fs.existsSync(path.join(path.dirname(a),"adoption-private.pem")) || path.basename(a)!=="adoption-private.pem","ISSUER_ADOPTION_KEY_REUSE_FORBIDDEN");
  const pair=crypto.generateKeyPairSync("ed25519");
  const privatePem=pair.privateKey.export({format:"pem",type:"pkcs8"});
  const publicPem=pair.publicKey.export({format:"pem",type:"spki"});
  const reg={issuer_id:issuerId,key_id:keyId,role:"INDEPENDENT_RETRY_GOVERNANCE",revoked:false,
    not_before:from,not_after:to,public_key_pem:publicPem,
    spki_sha256:sha(pair.publicKey.export({format:"der",type:"spki"}))};
  let privateCreated=false;
  try {
    fs.writeFileSync(a,privatePem,{flag:"wx",mode:0o600});privateCreated=true;
    fs.writeFileSync(b,JSON.stringify(reg,null,2)+"\n",{flag:"wx",mode:0o600});
  } catch(e) {
    // Do not remove a newly created secret on write failure: preserve for incident audit.
    throw e;
  }
  return {status:"INDEPENDENT_RETRY_ISSUER_PROVISIONED_OFFLINE",
    registration_file:b,private_key_location:a,spki_sha256:reg.spki_sha256,
    repository_modified:false,permit_signed:false,execution_authorized:false,production_authorized:false};
}
if(require.main===module){
  try {
    assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"ISSUER_PROVISION_WINDOWS_OFFLINE_ONLY");
    assert(process.argv[2]==="provision","ISSUER_PROVISION_MODE_REQUIRED");
    console.log(JSON.stringify(provision(process.argv.slice(3))));
  } catch(e) {
    console.error(JSON.stringify({status:"ISSUER_PROVISION_REJECTED",reason:String(e.message||e),
      execution_authorized:false,production_authorized:false}));
    process.exitCode=1;
  }
}
module.exports={provision};
