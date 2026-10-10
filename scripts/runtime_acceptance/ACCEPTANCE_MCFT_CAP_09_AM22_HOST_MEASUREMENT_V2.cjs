"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const m=require("./MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs"),{PHASES,measureEnvelope}=require("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const stage=JSON.parse(fs.readFileSync(path.join(m.ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-08T04Z-V1.json"),"utf8"));
let cases=0;const check=fn=>{fn();cases++;};
check(()=>m.isolatedUrl("postgres://unit:unit@127.0.0.1:5432/am22_measure_abcdef012345"));
for(const url of ["postgres://unit:unit@remote.example/am22_measure_abcdef012345","postgres://unit:unit@localhost/geox_mcft_cap09_s6_formal_t4r1_24h_v5","postgres://unit:unit@localhost/geox_mcft_cap09_production_runtime_v1","postgres://unit:unit@localhost/am22_measure_abcdef012345?host=remote.example","postgres://unit:unit@localhost/am22_o00"])check(()=>assert.throws(()=>m.isolatedUrl(url)));
check(()=>assert.equal(m.stageCoverage(stage,"2026-10-08T06:00:00.000Z","2026-10-08T05:30:00.000Z").o23,"2026-10-09T06:00:00.000Z"));
for(const [a0,now] of [["2026-10-09T04:00:00.000Z","2026-10-09T02:00:00.000Z"],["2026-10-08T03:00:00.000Z","2026-10-08T02:00:00.000Z"],["2026-10-09T11:00:00.000Z","2026-10-09T10:01:00.000Z"],["2026-10-08T06:00:00.000Z","2026-10-08T06:00:00.000Z"]])check(()=>assert.throws(()=>m.stageCoverage(stage,a0,now)));
for(const field of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"])check(()=>assert.throws(()=>m.stageCoverage({...stage,scope:{...stage.scope,[field]:"other"}},"2026-10-08T06:00:00.000Z","2026-10-08T05:30:00.000Z"),/SCOPE_MISMATCH/));
check(()=>assert.throws(()=>m.stageCoverage({...stage,architecture_effective:false},"2026-10-08T06:00:00.000Z","2026-10-08T05:30:00.000Z")));
check(()=>assert.throws(()=>m.stageCoverage({...stage,lifecycle:{...stage.lifecycle,authority_mode:"BIOLOGICAL_STAGE_DERIVED"}},"2026-10-08T06:00:00.000Z","2026-10-08T05:30:00.000Z")));
check(()=>assert.throws(()=>m.stageCoverage({...stage,biological_stage:{...stage.biological_stage,authority_valid_until:"2026-10-10T10:00:00.000Z"}},"2026-10-08T06:00:00.000Z","2026-10-08T05:30:00.000Z")));
async function main(){
 const gov=require("../governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs"),cp=require("node:child_process");
 const before=JSON.parse(cp.execFileSync("git",["show",gov.MEASUREMENT_BASE+":"+gov.QCP],{cwd:m.ROOT,encoding:"utf8"})),after=JSON.parse(cp.execFileSync("git",["show","84afa1f2fd14618860780275809a6a473761beca:"+gov.QCP],{cwd:m.ROOT,encoding:"utf8"})),policy=JSON.parse(fs.readFileSync(path.join(m.ROOT,gov.POLICY),"utf8"));
 const changes=gov.MEASUREMENT_PATHS.map(rel=>({rel,status:gov.MEASUREMENT_NEW.includes(rel)?"A":"M"}));
 check(()=>gov.validateMeasurementBoundary(changes,before,after,policy,policy));
 check(()=>assert.throws(()=>gov.validateMeasurementBoundary([...changes,{rel:"apps/server/src/runtime/unsafe.ts",status:"A"}],before,after,policy,policy),/EXACT_PATHS_REQUIRED/));
 check(()=>assert.throws(()=>gov.validateMeasurementBoundary(changes.slice(1),before,after,policy,policy),/EXACT_PATHS_REQUIRED/));
 check(()=>assert.throws(()=>gov.validateMeasurementBoundary(changes.map(x=>({...x,status:"D"})),before,after,policy,policy),/DESTRUCTIVE_OR_EXISTING_CHANGE/));
 for(const flag of ["production_start_authorized","formal_v5_arm_authorized","a0_authorized","complete_pre_a0_measurement_qualified"])check(()=>assert.throws(()=>gov.validateMeasurementBoundary(changes,before,after,{...policy,[flag]:true},policy),/PRODUCTION_POLICY_CHANGED/));
 check(()=>{const bad=structuredClone(after);bad.checks[0].owner="changed";assert.throws(()=>gov.validateMeasurementBoundary(changes,before,bad,policy,policy),/PREDECESSOR_QCP_CHANGED/);});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"am22-measure-tests-")),binding={subject_sha:"a".repeat(40),host_id:"UNIT_FIXTURE",image_id:"sha256:"+"b".repeat(64),preparation_profile_sha256:m.profileDigest()};
 try{
  const out=path.join(root,"pass");fs.mkdirSync(out);let tick=0;
  const tasks=Object.fromEntries(PHASES.map(phase=>[phase,async()=>({phase,status:"PASS",unit_fixture:true})]));
  const trace=await m.measure(tasks,binding,out,()=>++tick);cases++;assert.equal(trace.trials[0].phases.length,6);assert.equal(trace.complete_production_pre_a0_qualified,false);
  check(()=>assert.throws(()=>measureEnvelope(trace,{...binding,safety_margin_ms:120000}),/TRACE_SCHEMA_REQUIRED/));
  check(()=>assert.deepEqual(trace.production_equivalence_limitations,["PRODUCTION_DOCKER_OWNER_CUTOVER_NOT_MEASURED","FORMAL_RAW_PUT_AND_FORMAL_PROMOTION_NOT_EXECUTED"]));
  for(const phase of trace.trials[0].phases)check(()=>assert.equal(m.hash(fs.readFileSync(path.join(out,phase.evidence_file))),phase.evidence_sha256));
  await assert.rejects(()=>m.measure(tasks,binding,out,()=>++tick),/EEXIST/);cases++;
  const failed=path.join(root,"failed");fs.mkdirSync(failed);const failTasks={...tasks,[PHASES[2]]:async()=>{throw new Error("AM22_MEASUREMENT_CAUSAL_INPUT_NOT_READY: secret-like details must not escape");}};
  await assert.rejects(()=>m.measure(failTasks,binding,failed,()=>++tick));cases++;assert.ok(!fs.existsSync(path.join(failed,"measurement-trace.json")));check(()=>assert.equal(JSON.parse(fs.readFileSync(path.join(failed,"failed.json"))).terminal_code,"AM22_MEASUREMENT_CAUSAL_INPUT_NOT_READY"));
  const timed=path.join(root,"timed");fs.mkdirSync(timed);let timer=0;await assert.rejects(()=>m.measure(tasks,binding,timed,()=>{timer+=m.TIMEOUT_MS;return timer;}),/COMPLETE_TIMEOUT/);cases++;
  check(()=>assert.ok(!fs.existsSync(path.join(timed,"measurement-trace.json"))));
  await assert.rejects(()=>m.measure(Object.fromEntries([...Object.entries(tasks)].reverse()),binding,root),/FIXED_ORDER_REQUIRED/);cases++;
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 console.log(JSON.stringify({status:"PASS",cases,unit_fixtures_only:true,actual_host_measurement:false,production_database_write_count:0,service_stop_count:0,formal_v5_arm:false,a0_execution:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
