"use strict";
const fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const {EXPECTED,verifyMigration}=require("./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs");
const id=process.argv[2];if(!EXPECTED.isolated_checks.includes(id))throw Error("ISOLATED_CHECK_REQUIRED");
const root=path.resolve(__dirname,"../.."),head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const proofs={V13_AUTONOMOUS_FORCING_FOUNDATION:["MCFT_CAP_09_V13_AUTONOMOUS_FORCING_FOUNDATION_RESULT.json",["stale_fencing_token_rejected","payload_time_travel_rejected_by_physical_visibility","end_to_end_budget_requires_real_samples"]],V13_HOLISTIC_SCHEMA:["MCFT_CAP_09_V13_HOLISTIC_SCHEMA_POSTGRES_RESULT.json",["canonical_facts_schema_unchanged","all_new_relations_zero_state"]],V13_NEXT_TICK_VIABILITY:["MCFT_CAP_09_V13_NEXT_TICK_VIABILITY_POSTGRES_RESULT.json",["exact_predecessor_forcing_base_required","successor_claim_forbidden_when_next_tick_viable_false"]]};
if(id==="EA5C1_DURABLE_RAW_RESTRICTED_INGRESS"){
 for(const [file,count] of [["FROZEN_EA5C1_SUCCESSOR.log",11],["FROZEN_EA5C1_RETENTION.log",15]])if(!fs.readFileSync(path.join(root,"acceptance-output",file),"utf8").includes(`${count} PASS, 0 FAIL`))throw Error("EA5C1_REAL_ACCEPTANCE_REQUIRED");
}else{const [file,flags]=proofs[id],proof=JSON.parse(fs.readFileSync(path.join(root,"acceptance-output",file),"utf8"));if(proof.status!=="PASS"||flags.some(k=>proof[k]!==true))throw Error("REAL_ACCEPTANCE_PROOF_REQUIRED");}
const migration=verifyMigration();const result={status:"PASS",check_id:id,subject_sha:head,adopted_base_sha:EXPECTED.adopted_base_sha,frozen_runtime_sha:EXPECTED.frozen_runtime_sha,runtime_path_digest:migration.runtime_path_digest,evidence_scope:"ISOLATED_IMPLEMENTATION_QUALIFICATION",production_writes:0,live_qualification:false,formal_v5_arm:false,a0_execution:false,o00_execution:false};
fs.mkdirSync(path.join(root,"acceptance-output"),{recursive:true});fs.writeFileSync(path.join(root,"acceptance-output",id+"_FROZEN_REQUALIFICATION_V1.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
