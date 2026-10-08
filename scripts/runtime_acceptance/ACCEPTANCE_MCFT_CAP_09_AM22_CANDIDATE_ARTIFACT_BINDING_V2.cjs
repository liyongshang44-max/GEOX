"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const {readBoundJson,verifyCandidateFiles}=require("./VERIFY_MCFT_CAP_09_AM22_START_CANDIDATE_V2.cjs");
const {fileDigest}=require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"am22-unit-"));
let cases=0;
try{
 const file=path.join(dir,"evidence.json");fs.writeFileSync(file,'{"unit_fixture":true}');
 const hash=fileDigest(file);
 assert.equal(readBoundJson(file,hash).unit_fixture,true);cases++;
 assert.throws(()=>readBoundJson(file,null),/PINNED_FILE_DIGEST_REQUIRED/);cases++;
 fs.writeFileSync(file,'{"unit_fixture":false}');
 assert.throws(()=>readBoundJson(file,hash),/FILE_DIGEST_MISMATCH/);cases++;
 assert.throws(()=>verifyCandidateFiles({policy:{schema_version:"geox_mcft_cap09_am22_effective_start_authority_v2",complete_pre_a0_measurement_qualified:false}}),/COMPLETE_PREPARATION_NOT_QUALIFIED/);cases++;
 assert.throws(()=>verifyCandidateFiles({policy:{schema_version:"geox_mcft_cap09_am22_effective_start_authority_v2",complete_pre_a0_measurement_qualified:true,qualified_subject_sha:"wrong"},binding:{subject_sha:"subject"}}),/QUALIFIED_EXECUTION_BINDING_MISMATCH/);cases++;
 const entry=path.join(__dirname,"VERIFY_MCFT_CAP_09_AM22_START_CANDIDATE_V2.cjs");
 const execution=spawnSync(process.execPath,[entry,"--execute"],{encoding:"utf8"});
 assert.equal(execution.status,1);assert.match(execution.stderr,/EXECUTION_NOT_IMPLEMENTED_OR_AUTHORIZED/);cases++;
 const input=path.join(dir,"input.json");fs.writeFileSync(input,JSON.stringify({policy:{complete_pre_a0_measurement_qualified:true}}));
 const cli=spawnSync(process.execPath,[entry,"--input="+input],{encoding:"utf8"});
 assert.equal(cli.status,1);assert.match(cli.stderr,/COMPLETE_PREPARATION_NOT_QUALIFIED/);cases++;
 console.log(JSON.stringify({status:"PASS",cases,unit_fixtures_only:true,real_host_receipt_revalidated:false,database_write_count:0,service_stop_count:0,production_start_authorized:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
