"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {REQUIRED,validateDelayPlan,inspectSqlFile}=require("../runtime_acceptance/MCFT_CAP09_NONDESTRUCTIVE_REAL_DELAY_BOUNDARY_V1.cjs");
const plan={schema_version:"geox_mcft_cap09_non_destructive_delay_plan_v1",target:{kind:"DISPOSABLE_ISOLATED_TEST_FIXTURE",name:"mcft_cap09_delay_scratch_abcdef123456"},
 cases:REQUIRED.map(id=>({id,delay_ms:100}))};let count=0;
assert.equal(validateDelayPlan(plan).run_authorized,false);count++;
for(const change of [
 p=>p.target.kind="RETAINED_QUALIFICATION_DB",p=>p.target.name="mcft_cap09_requal_72dc0304a21a_positive",
 p=>p.cases.reverse(),p=>p.cases.pop(),p=>p.cases[0].delay_ms=-1,p=>p.cases[0].delay_ms=150000,
 p=>p.cases[0].sql="DROP SCHEMA public CASCADE",p=>p.cases[0].command="psql"
]) {const x=structuredClone(plan);change(x);assert.throws(()=>validateDelayPlan(x));count++;}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-delay-safe-"));
try{
 const file=path.join(dir,"controller.sql");fs.writeFileSync(file,"SELECT 1;");assert.equal(inspectSqlFile(file).execution_authorized,false);count++;
 for(const sql of ["DROP SCHEMA public CASCADE;","TRUNCATE TABLE telemetry;","DELETE FROM evidence;","ALTER DATABASE main;","SET search_path=public;"]){
  fs.writeFileSync(file,sql);assert.throws(()=>inspectSqlFile(file));count++;
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log(JSON.stringify({status:"PASS",tests:count,non_destructive_guard_only:true,real_delay_executed:false}));
