"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const DIRECTORY=path.resolve(__dirname,"../../docs/digital_twin/mcft/cap_09/evidence/retry-history-20261011");
const FILES=Object.freeze({
 audit_v2:"failed-first-execute-readonly-audit-v2.json",
 postflight_v4:"post3689-windows-postflight-closure-v4.json",
 artifact_closure_v5:"post3689-windows-artifact-closure-v5.json"
});
const HASHES=Object.freeze({
 audit_v2:"4f1dfce2d859a9d9be29f615d88cb3c325d48c07c1920ed17e2f0965b6cc6cd9",
 postflight_v4:"549622fd350df3b09729aed5beec840c154803d6bf34f97b044e43ce809bf46a",
 artifact_closure_v5:"3580789b38fa0e428953b27dea6a3a08d096e420fefaeaec88d3361c63a3150e"
});
function verifyHistoricalEvidence(directory=DIRECTORY) {
 const reports={};
 for(const [key,file] of Object.entries(FILES)) {
  const bytes=fs.readFileSync(path.join(directory,file));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),HASHES[key],"HISTORY_RAW_BYTES_CHANGED:"+key);
  reports[key]=JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,""));
 }
 const a=reports.audit_v2,v4=reports.postflight_v4,v5=reports.artifact_closure_v5;
 assert.equal(a.run_id,"72dc0304a21a");
 assert.equal(a.status,"READONLY_AUDIT_COMPLETED_NOT_QUALIFIED");
 assert.equal(a.execute_retry_authorized,false);assert.equal(a.first_execution_provider_calls,null);
 assert.equal(a.databases.length,2);
 for(const db of a.databases) {
  assert.equal(db.identity.username,"qual_admin");assert.equal(db.identity.read_only,"on");
  assert.equal(db.transport,"WINDOWS_HOST_TCP_127.0.0.1_55432");
  assert.equal(db.table_count,29);assert.equal(db.tables.length,29);
  assert.equal(new Set(db.tables.map(t=>t.table)).size,29);
  assert(db.tables.every(t=>t.row_count==="0"));
 }
 for(const key of ["current","versions","multipart"]) {
  assert.equal(a.bucket[key].status,"READBACK_PASS");assert.equal(a.bucket[key].truncated,false);
  assert(Object.values(a.bucket[key].entries_observed).every(n=>n===0));
 }
 assert.equal(v4.v3_wrapper_final_clean_gate,"FAIL");
 assert.equal(v4.artifact_provenance_verified,false);
 assert.equal(v4.historical_replay.authorize_execute,false);
 assert.equal(v4.historical_replay.frozen_runtime_108_unchanged,true);
 assert.equal(v5.v3_gate,"FAIL_RETAINED");assert.equal(v5.execute_authorized,false);
 assert.equal(v5.main,v4.protected_main);
 assert.equal(v5.sha256,v4.artifact_manifest[0].sha256);
 assert.equal(v5.bytes,v4.artifact_manifest[0].bytes);
 return {status:"HISTORICAL_FILES_VERIFIED_NOT_CURRENT_AUTHORITY",hashes:HASHES,
  historical_main:v5.main,missing_v6:true,retry_adjudication_verified:false,
  current_resource_readback:false,execute_authorized:false};
}
module.exports={FILES,HASHES,DIRECTORY,verifyHistoricalEvidence};
if(require.main===module){try{console.log(JSON.stringify(verifyHistoricalEvidence()));}catch(e){console.error(e.message);process.exitCode=1;}}
