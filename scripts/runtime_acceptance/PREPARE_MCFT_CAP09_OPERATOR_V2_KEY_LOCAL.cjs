#!/usr/bin/env node
"use strict";
/* WINDOWS LOCAL ONLY. Generates one CANDIDATE key after private directory ACL
 * restriction. No trust modification, no signature, no permit, no upload.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function main(argv){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"R4285_WINDOWS_OPERATOR_ONLY");
 assert(argv.length===1&&path.isAbsolute(argv[0]),"USAGE: node PREPARE_...cjs ABSOLUTE_NEW_PRIVATE_DIRECTORY");
 const target=path.resolve(argv[0]),source=path.resolve(__dirname,"../..");
 const rel=path.relative(source,target);
 assert(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel),"R4285_PRIVATE_DIR_OUTSIDE_REPO");
 assert(!fs.existsSync(target),"R4285_PRIVATE_DIRECTORY_MUST_BE_NEW");
 assert(fs.existsSync(path.dirname(target)),"R4285_PRIVATE_PARENT_MISSING");
 fs.mkdirSync(target,{recursive:false,mode:0o700});
 const user=process.env.USERNAME;
 assert(/^[A-Za-z0-9_.-]{1,128}$/.test(user||""),"R4285_WINDOWS_USER_UNKNOWN");
 const acl=cp.spawnSync("icacls.exe",[target,"/inheritance:r","/grant:r",user+":(OI)(CI)F"],{windowsHide:true,timeout:15000,encoding:"utf8"});
 assert.equal(acl.status,0,"R4285_PRIVATE_DIRECTORY_ACL_FAILED");
 const pair=crypto.generateKeyPairSync("ed25519");
 const spki=pair.publicKey.export({format:"der",type:"spki"}),digest=sha(spki);
 const reg={issuer_id:"mcft_cap09_operator_mylr1",key_id:"mcft_cap09_operator_v2_"+digest.slice(0,16),
  role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,not_before:null,not_after:null,
  public_key_pem:pair.publicKey.export({format:"pem",type:"spki"}),spki_sha256:digest,
  registration_status:"CANDIDATE_ONLY_NOT_AUTHORIZED"};
 const privatePath=path.join(target,"operator-private.pem"),pubPath=path.join(target,"operator-public-candidate.json");
 fs.writeFileSync(privatePath,pair.privateKey.export({format:"pem",type:"pkcs8"}),{flag:"wx",mode:0o600});
 fs.writeFileSync(pubPath,JSON.stringify(reg,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:"LOCAL_OPERATOR_V2_KEY_CANDIDATE_CREATED_NOT_REGISTERED",
   public_candidate_file:pubPath,spki_sha256:digest,key_id:reg.key_id,
   private_key_exported:false,private_key_location_is_local:true,production_authorized:false,
   permit_authorized:false,trust_mutation:false}));
}
try{main(process.argv.slice(2));}catch(e){console.error("R4285_LOCAL_KEY_PREP_HOLD:"+String(e.message||e));process.exitCode=1;}
