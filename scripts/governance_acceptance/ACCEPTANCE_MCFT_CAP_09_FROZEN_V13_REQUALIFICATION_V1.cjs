"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {validatePartition,EXPECTED,resolveFreshEvidence}=require("./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs");
let count=0;function negative(f){assert.throws(f);count++;}
const runtime=Array.from({length:108},(_,i)=>"apps/server/src/runtime/"+i+".ts"),h=Array.from({length:16},(_,i)=>"scripts/runtime_acceptance/"+i+".ts");h.push(EXPECTED.historical_harness_addition);
const post=["scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_V13_RUNTIME_HARNESS_RESOLVER_MIGRATION_V1.cjs",".github/workflows/mcft-cap-09-post-merge-v13-control-plane-v1.yml",".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"],legacy=[...runtime,...h],harness=[...h,...post];
validatePartition(runtime,legacy,harness,"same","same");count++;
negative(()=>validatePartition(runtime,legacy,harness,"old","changed"));
negative(()=>validatePartition(runtime.slice(1),legacy,harness,"same","same"));
negative(()=>validatePartition(runtime,legacy.slice(1),harness,"same","same"));
negative(()=>validatePartition(runtime,legacy,[...harness.slice(1),runtime[0]],"same","same"));
negative(()=>validatePartition(runtime,legacy,harness.filter(x=>x!==EXPECTED.historical_harness_addition),"same","same"));
for(const id of ["V13_PRODUCER_DRIVEN_QUALIFICATION","END_TO_END_EVIDENCE_SUPPLY_DEADLINE","EXACT_ONE_PRODUCTION_OWNER"]){assert.equal(resolveFreshEvidence({check_id:id},{contract_ref:"invalid",entries:[{}]},"POST_MERGE_V13_QUALIFICATION","HEAD").status,"FAIL");count++;}
assert.equal(resolveFreshEvidence({check_id:EXPECTED.isolated_checks[0]},{contract_ref:"invalid",entries:[]},"POST_MERGE_V13_QUALIFICATION","HEAD").reason_code,"FROZEN_REQUALIFICATION_SECTION_INVALID");count++;
const C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FROZEN-V13-REQUALIFICATION-CONTRACT-V1.json";
const fields=["evidence_id","check_id","stage","subject_sha","dependency_digest","run_snapshot","job_name","contract_ref"];
const cp=require("node:child_process"),head=cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const entry={evidence_id:"TEST_FIXTURE_ONLY",check_id:EXPECTED.isolated_checks[0],stage:"POST_MERGE_V13_QUALIFICATION",subject_sha:head,dependency_digest:"fixture",run_snapshot:{head_sha:head,base_sha:EXPECTED.adopted_base_sha,event:"pull_request",workflow_path:EXPECTED.isolated_workflow,conclusion:"success",run_id:1},job_name:EXPECTED.isolated_checks[0],contract_ref:C};
function bind(e){e.immutable_binding_sha256=crypto.createHash("sha256").update(JSON.stringify(fields.map(k=>e[k]??null))).digest("hex");return e;}
const decision={check_id:entry.check_id,dependency_digest:"fixture",execution_workflow:EXPECTED.isolated_workflow};
const section=e=>({contract_ref:C,entries:[e]});bind(entry);
assert.equal(resolveFreshEvidence(decision,section(entry),entry.stage,head).status,"PASS");count++;
for(const edit of [e=>e.run_snapshot.conclusion="failure",e=>e.run_snapshot.event="workflow_dispatch",e=>e.run_snapshot.base_sha="0".repeat(40),e=>e.subject_sha="0".repeat(40),e=>e.job_name="EXACT_ONE_PRODUCTION_OWNER",e=>e.dependency_digest="wrong",e=>e.contract_ref="wrong",e=>e.run_snapshot.run_id=0,e=>e.run_snapshot.workflow_path="wrong"]){const e=structuredClone(entry);edit(e);bind(e);assert.equal(resolveFreshEvidence(decision,section(e),entry.stage,head).status,"FAIL");count++;}
const tampered=structuredClone(entry);tampered.job_name="wrong";assert.equal(resolveFreshEvidence(decision,section(tampered),entry.stage,head).status,"FAIL");count++;
console.log(JSON.stringify({status:"PASS",test_count:count,production_writes:0,live_claims_authorized:false}));
