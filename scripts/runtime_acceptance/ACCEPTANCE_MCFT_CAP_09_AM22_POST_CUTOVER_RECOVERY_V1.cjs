#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {adjudicate}=require("./RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V1.cjs");
const head="3b46be1dda2406ffdcc869c55758f3393d69c716",image="sha256:"+"a".repeat(64),a0="2026-10-10T09:00:00.000Z";
const roles=["evidence_runtime","twin_runtime_scheduler"];
function fixture(){
 const containers=roles.map((_,i)=>({Id:"container"+i,Image:image,Config:{Image:"geox-mcft-cap09-runtime:"+head},State:{Running:true}}));
 const proof={status:"PASS",adjudication:"EXACT_ONE_EFFECTIVE_OWNER_PER_RUNTIME_ROLE_WITH_CONTAINER_IMAGE_HOST_AND_RENEWAL_PROVEN",subject_main_sha:head,authorized_image_id:image,host_identity_contract_status:"PASS",artifact_attestation_status:"PASS_EXACT_CLEAN_SUBJECT_TO_IMMUTABLE_LOCAL_IMAGE_ID",blockers:[]};
 for(let i=0;i<roles.length;i++)proof[roles[i]]={t1:{status:"PASS",lease_owner:"owner"+i},t2:{status:"PASS",lease_owner:"owner"+i,container_id:containers[i].Id},renewal:{status:"PASS",same_effective_owner:true,same_container_instance:true,heartbeat_advanced:true,expiry_advanced:true}};
 return {failed:{status:"FAIL",phase:"GFS_PAIR_WAIT",owner_verified:true,operator_reconciliation_required:true,formal_v5_arm:false,a0_execution:false,o00_started:false,image_id:image},proof,containers,head,image,stageEntry:{authority_valid_until:Date.parse(a0)+86400000},a0,twinCounts:{twin_state_history_projection_v1:0,twin_state_latest_index_v1:0,twin_shadow_online_scheduler_cursor_v1:0,twin_shadow_online_scheduler_slot_v1:0}};
}
const cases=[
 ["baseline",null],
 ["wrong_previous_phase",x=>x.failed.phase="OWNER_CUTOVER"],
 ["unverified_previous_owner",x=>x.failed.owner_verified=false],
 ["missing_reconciliation",x=>x.failed.operator_reconciliation_required=false],
 ["previous_formal_arm",x=>x.failed.formal_v5_arm=true],
 ["previous_a0",x=>x.failed.a0_execution=true],
 ["previous_o00",x=>x.failed.o00_started=true],
 ["changed_image",x=>x.containers[0].Image="sha256:"+"b".repeat(64)],
 ["stopped_container",x=>x.containers[0].State.Running=false],
 ["changed_container_instance",x=>x.proof.evidence_runtime.t2.container_id="forged"],
 ["changed_lease_owner",x=>x.proof.twin_runtime_scheduler.t2.lease_owner="forged"],
 ["no_heartbeat_renewal",x=>x.proof.twin_runtime_scheduler.renewal.heartbeat_advanced=false],
 ["no_expiry_renewal",x=>x.proof.evidence_runtime.renewal.expiry_advanced=false],
 ["invalid_live_proof",x=>x.proof.status="FAIL"],
 ["owner_blocker",x=>x.proof.blockers.push("fenced")],
 ["wrong_subject",x=>x.proof.subject_main_sha="f".repeat(40)],
 ["expired_stage",x=>x.stageEntry.authority_valid_until-=1],
 ["twin_has_state",x=>x.twinCounts.twin_state_latest_index_v1=1],
 ["twin_has_scheduler",x=>x.twinCounts.twin_shadow_online_scheduler_slot_v1=1],
 ["changed_image_tag",x=>x.containers[1].Config.Image="wrong"],
];
for(const [name,mutate] of cases){const v=fixture();if(mutate){mutate(v);assert.throws(()=>adjudicate(v),undefined,name);}else{const r=adjudicate(v);assert.equal(r.owner_status,"PASS");assert.equal(r.source_gfs_pair_status,"NOT_EVALUATED");assert.equal(r.six_phase_status,"NOT_EXECUTED");}}
process.stdout.write(JSON.stringify({status:"PASS",suite:"AM22_POST_CUTOVER_RECOVERY_V1",cases:cases.length,negative_cases:cases.length-1,no_production_effects:true})+"\n");
