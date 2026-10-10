"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),vm=require("node:vm"),crypto=require("node:crypto");
const g=require("./VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs");
const read=rel=>fs.readFileSync(path.join(g.ROOT,rel),"utf8"),at=rel=>cp.execFileSync("git",["show",g.BASE+":"+rel],{cwd:g.ROOT,encoding:"utf8"});
const before=JSON.parse(at(g.QCP)),after=JSON.parse(cp.execFileSync("git",["show","bb0f4f351d13436a451ac085fc30eaed539dd91a:"+g.QCP],{cwd:g.ROOT,encoding:"utf8"})),policy=read(g.POLICY),changes=g.PATHS.map(rel=>({rel,status:g.ADDED.includes(rel)?"A":"M"}));
let cases=0;const check=fn=>{fn();cases++;};
check(()=>g.validateBoundary(changes,before,after,policy,at(g.POLICY)));
check(()=>assert.throws(()=>g.validateBoundary(changes.slice(1),before,after,policy,policy),/EXACT_PATHS/));
check(()=>assert.throws(()=>g.validateBoundary([...changes,{rel:"apps/server/src/runtime/unsafe.ts",status:"M"}],before,after,policy,policy),/EXACT_PATHS/));
check(()=>assert.throws(()=>g.validateBoundary(changes.map(x=>({...x,status:"D"})),before,after,policy,policy),/DESTRUCTIVE/));
check(()=>assert.throws(()=>g.validateBoundary(changes,before,after,policy+" ",policy),/ROOT_POLICY/));
check(()=>{const bad=structuredClone(after);bad.checks[0].owner="unsafe";assert.throws(()=>g.validateBoundary(changes,before,bad,policy,policy),/PREDECESSOR_QCP/);});
check(()=>{const bad=structuredClone(after);bad.checks.at(-1).carry_forward_policy="ALL";assert.throws(()=>g.validateBoundary(changes,before,bad,policy,policy),/CHECK_CHANGED/);});
const authority=JSON.parse(read(g.AUTHORITY)),registry=JSON.parse(cp.execFileSync("git",["show","bb0f4f351d13436a451ac085fc30eaed539dd91a:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"],{cwd:g.ROOT,encoding:"utf8"}));
// Archive negatives are fixtures using the same frozen verifier body. They cannot
// authorize source adoption, production execution or claim live host measurement.
function fixture(mutator){
 const a=structuredClone(authority);mutator(a);const bytes=JSON.stringify(a,null,2)+"\n",reg=structuredClone(registry);reg.entries.at(-1).authority_sha256="sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");
 const mockFs={readFileSync(file){if(file===path.join(g.ROOT,g.AUTHORITY))return Buffer.from(bytes);if(file===path.join(g.ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"))return JSON.stringify(reg);return fs.readFileSync(file);}};
 const fakeGit=(args)=>{if(args[0]==="rev-parse")return args[1]==="origin/main"?g.BASE:"a".repeat(40);if(args[0]==="diff")return "A\t"+g.AUTHORITY+"\nM\t"+"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";if(args[0]==="rev-list")return "";return cp.execFileSync("git",args,{cwd:g.ROOT,encoding:"utf8"}).trim();};
 return vm.runInNewContext("("+g.verifyFormalV5AuthorityContinuity.toString()+")()",{require,Buffer,BASE:g.BASE,ROOT:g.ROOT,PATHS:g.PATHS,ADDED:g.ADDED,AUTHORITY:g.AUTHORITY,SELF_REL:"scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs",fs:mockFs,path,git:fakeGit,lines:s=>s.split(/\r?\n/).filter(Boolean),isAncestor:()=>true,fail:code=>{throw new Error(code);}});
}
check(()=>assert.equal(fixture(()=>{}).authorityCount,1));
for(const key of ["database_write_authorized","runtime_config_write_authorized","scheduler_write_authorized","formal_evidence_write_authorized","production_runtime_start_authorized","production_owner_activation_authorized","formal_v5_authorized","a0_authorized","o00_o23_authorized","mcft_cap09_completed"])check(()=>assert.throws(()=>fixture(a=>{a[key]=true;})));
for(const mutate of [a=>{a.architecture_effective=false;},a=>{a.runtime_consumption_authorized=false;},a=>{a.scope.zone_id="other";},a=>{a.lifecycle.domain_state="INACTIVE";},a=>{a.crop_model_parameter.value=0.7;},a=>{a.biological_stage.authority_valid_until="2026-10-11T10:00:00.000Z";},a=>{a.qualification_evidence.artifact_sha256="sha256:"+"0".repeat(64);},a=>{a.qualification_evidence.files["MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json"].sha256="sha256:"+"0".repeat(64);},a=>{a.refresh_request.non_effects.a0_authorized=true;},a=>{a.refresh_request.previous_effective_current_crop_authority.sha256="sha256:"+"0".repeat(64);},a=>{a.refresh.qualification_time="2026-10-11T00:00:00.000Z";}])check(()=>assert.throws(()=>fixture(mutate)));
const m=require("../runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs");
check(()=>assert.equal(m.stageCoverage(authority,"2026-10-09T05:00:00.000Z",authority.refresh.qualification_time).all_25_contexts_covered,true));
check(()=>assert.throws(()=>m.stageCoverage(authority,"2026-10-09T11:00:00.000Z",authority.refresh.qualification_time),/FULL_24T/));
console.log(JSON.stringify({status:"PASS",cases,unit_fixtures_only:true,actual_host_measurement:false,production_authorized:false,a0_execution:false}));
