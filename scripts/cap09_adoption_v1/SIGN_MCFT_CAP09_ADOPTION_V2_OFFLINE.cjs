"use strict";
/**
 * Offline owner-controlled Adoption V2 signing. No Permit, no DB/S3, no Host.
 * Requires a real Windows release, proof bundle, registered non-revoked key,
 * current exact artifact hashes, and complete verification BEFORE write.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const c=require("./contract.cjs"),offline=require("./offline-context.cjs");
const v2=require("./MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs");
const ROOT=path.resolve(__dirname,"../..");
function outside(root,file){const relative=path.relative(path.resolve(root),path.resolve(file));return relative===".."||relative.startsWith(".."+path.sep)||path.isAbsolute(relative);}
function sign(candidateFile,materialFile,releaseRoot,keyFile,outputFile,scopeGrantFile=null){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"A3_ADOPTION_V2_WINDOWS_OFFLINE_ONLY");
 releaseRoot=fs.realpathSync(path.resolve(releaseRoot));
 for(const p of [candidateFile,materialFile,keyFile,outputFile])assert(path.isAbsolute(p)&&outside(releaseRoot,p)&&outside(ROOT,p),"A3_V2_PRIVATE_OR_EVIDENCE_FILE_INSIDE_RELEASE");
 assert(!fs.existsSync(outputFile),"A3_V2_SIGNED_OUTPUT_EXISTS");
 c.noLinks(keyFile);c.noLinks(releaseRoot);
 const candidate=c.read(candidateFile),material=c.read(materialFile),policy=c.read(offline.POLICY);
 c.exact(candidate,["schema_version","payload","evidence_root"]);
 assert.equal(candidate.schema_version,"MCFT_CAP09_ADOPTION_V2_UNSIGNED_CANDIDATE_V1");
 const p=candidate.payload;
 const issuer=policy.issuers.filter(x=>x.issuer_id===p.issuer_id&&x.key_id===p.key_id&&x.purpose==="ADOPTION");
 assert.equal(issuer.length,1,"A3_V2_SIGNER_NOT_REGISTERED");
 assert.equal(issuer[0].revoked,false,"A3_V2_SIGNER_REVOKED");
 const key=crypto.createPrivateKey(fs.readFileSync(keyFile));
 assert.equal(key.asymmetricKeyType,"ed25519");assert.equal(c.sha(crypto.createPublicKey(key).export({type:"spki",format:"der"})),issuer[0].spki_sha256,"A3_V2_SIGNER_KEY_MISMATCH");
 const sig=crypto.sign(null,Buffer.from(v2.DOMAIN+c.canonical(p)),key).toString("base64");
 const request={schema_version:"MCFT_CAP09_SIGNED_ADOPTION_V2_REQUEST_V1",
   qualification:{payload:p,signature_base64:sig},material,evidence_root:candidate.evidence_root,
   ...(scopeGrantFile?{operator_scope_grant:c.read(scopeGrantFile)}:{})};
 const ctx=v2.verify(request,releaseRoot,{host:os.hostname()});
 assert.equal(ctx.status,"SIGNED_QCP65_ADOPTION_V2_EVIDENCE_VERIFIED_NOT_PERMIT");
 const fd=fs.openSync(outputFile,"wx",0o600);
 try{fs.writeFileSync(fd,JSON.stringify(request,null,2)+"\n");fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
 return {status:"SIGNED_ADOPTION_V2_EVIDENCE_SAVED_NOT_EXECUTION_AUTHORITY",
  subject_sha:ctx.subject_sha,run_id:ctx.run_id,sha256:c.sha(fs.readFileSync(outputFile)),
  permit_authorized:false,execution_authorized:false,production_authorized:false};
}
if(require.main===module){try{
 const args=process.argv.slice(2);
 assert(args.length===5||args.length===6,"USAGE: candidate.json material.json releaseRoot privateKey outputSigned.json [operatorScopeGrant.json]");
 console.log(JSON.stringify(sign(...args)));
}catch(e){console.error(JSON.stringify({status:"A3_ADOPTION_V2_SIGNING_HOLD",reason_code:String(e.message||e),permit_authorized:false,execution_authorized:false}));process.exitCode=1;}}
module.exports={sign};
