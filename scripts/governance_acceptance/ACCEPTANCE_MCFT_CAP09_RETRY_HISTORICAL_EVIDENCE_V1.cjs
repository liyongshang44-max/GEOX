"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {DIRECTORY,FILES,verifyHistoricalEvidence}=require("./MCFT_CAP09_RETRY_HISTORICAL_EVIDENCE_V1.cjs");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-history-evidence-"));let tests=0;
try {
 const result=verifyHistoricalEvidence();assert.equal(result.execute_authorized,false);assert.equal(result.missing_v6,true);tests++;
 const restore=()=>{for(const file of Object.values(FILES))fs.copyFileSync(path.join(DIRECTORY,file),path.join(temp,file));};
 for(const [key,file] of Object.entries(FILES)) {
  restore();fs.appendFileSync(path.join(temp,file),"\n");assert.throws(()=>verifyHistoricalEvidence(temp),/RAW_BYTES_CHANGED/);tests++;
  restore();fs.unlinkSync(path.join(temp,file));assert.throws(()=>verifyHistoricalEvidence(temp),/ENOENT/);tests++;
 }
 restore();const v5=path.join(temp,FILES.artifact_closure_v5);
 fs.writeFileSync(v5,fs.readFileSync(v5,"utf8").replace(/^\uFEFF/,"").replace(/\r\n/g,"\n"));
 assert.throws(()=>verifyHistoricalEvidence(temp),/RAW_BYTES_CHANGED/);tests++;
 console.log(JSON.stringify({status:"PASS",tests,original_bytes_verified:true,v6_invented:false,execute_authorized:false}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
