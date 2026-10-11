"use strict";
const assert=require("node:assert/strict"),path=require("node:path"),os=require("node:os"),fs=require("node:fs"),cp=require("node:child_process");
const host=require("../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const runner=path.join(ROOT,"scripts/runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-host-dispatch-"));
const file=path.join(temp,"does-not-exist.json");
const valid=["--operator-authorized","--governed-retry","--preflight-only","--all","--retry-bundle",file];
let tests=0;
try {
 assert.equal(host.parseArgs(valid).file,file);tests++;
 for(const args of [valid.concat("--execute"),valid.concat("--governed-retry"),valid.concat("--unknown"),valid.filter(x=>x!=="--operator-authorized"),valid.slice(0,-1),valid.map(x=>x===file?"relative.json":x)]){
  assert.throws(()=>host.parseArgs(args));tests++;
 }
 const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",stages:host.STAGES.map(s=>({id:s[0],timeout_ms:1000}))};
 host.validatePlan(plan);tests++;
 for(const mutate of [p=>p.stages.reverse(),p=>p.stages.pop(),p=>p.stages[0].timeout_ms=0,p=>p.stages[0].command="arbitrary",p=>p.stages[1].id="DROP_SCHEMA"]){
  const p=structuredClone(plan);mutate(p);assert.throws(()=>host.validatePlan(p));tests++;
 }
 for(const mode of ["--preflight-only","--execute"]){
  const r=cp.spawnSync(process.execPath,[runner,...valid.map(x=>x==="--preflight-only"?mode:x)],{cwd:temp,encoding:"utf8",timeout:15000});
  assert.equal(r.status,1);const result=JSON.parse(r.stderr.trim());
  assert.match(result.reason,/GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED/);
  assert(!/CURRENT_EXECUTION|6H|ENOENT/.test(result.reason));tests++;
 }
 const modulePath=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
 for(const env of [{MCFT_GOVERNED_RETRY_BUNDLE:file,MCFT_GOVERNED_RETRY_STAGE:"PRODUCER"},{MCFT_GOVERNED_RETRY_STAGE:"PRODUCER"},{MCFT_GOVERNED_RETRY_BUNDLE:file}]){
  const r=cp.spawnSync(process.execPath,["-e","require(process.argv[1]).qualificationTargets()",modulePath],{cwd:temp,encoding:"utf8",env:{...process.env,...env},timeout:15000});
  assert.equal(r.status,1);assert.match(r.stderr,/GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED|RETRY_CHILD_CONTEXT_REQUIRED/);assert(!r.stderr.includes("CURRENT_EXECUTION_NOT_ARMED"));tests++;
 }
 assert.deepEqual(fs.readdirSync(temp),[]);tests++;
 console.log(JSON.stringify({status:"PASS",tests,actual_runner_and_child_boundary_checked:true,legacy_fallback:false,provider_calls:0,execute_authorized:false}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
