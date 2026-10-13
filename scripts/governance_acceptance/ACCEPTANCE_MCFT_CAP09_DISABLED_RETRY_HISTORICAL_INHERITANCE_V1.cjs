#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const x=require("./MCFT_CAP09_DISABLED_RETRY_HISTORICAL_INHERITANCE_V1.cjs");
const H=x.HISTORICAL_MERGE,BASE=x.BASE;
const head="f".repeat(40),main=head,second="e".repeat(40);
const good=()=>({head,main,firstParent:[head,H],parents:()=>[BASE,second],
 tree:sha=>sha===H||sha===second?"matched":"other",
 changedPaths:()=>["scripts/governance_acceptance/VERIFY_MCFT_CAP_09_DISABLED_RETRY_SUCCESSOR_V1.cjs"],
 verifyHistorical:()=>({status:"PASS",head:H,qcp_check_count:52,frozen_runtime_108_unchanged:true})});
let count=0;
const pass=x.assertLineage(good());assert.equal(pass.status,"PASS");assert.equal(pass.downstream_qcp_applicability_required,true);assert.equal(pass.execute_authorized,false);
function reject(mutate,expected){const test=good();mutate(test);assert.throws(()=>x.assertLineage(test),new RegExp(expected));count++;}
reject(t=>t.firstParent=[head],"DISABLED_RETRY_FIRST_PARENT_CHAIN_BROKEN");
reject(t=>t.parents=()=>["a".repeat(40),second],"HISTORICAL_FIRST_PARENT_CHANGED");
reject(t=>t.tree=sha=>sha===H?"wrong":"matched","HISTORICAL_MERGE_TREE_CHANGED");
reject(t=>t.verifyHistorical=()=>({...good().verifyHistorical(),status:"FAIL"}),"HISTORICAL_EXACT_PROOF_NOT_PASS");
reject(t=>t.verifyHistorical=()=>({...good().verifyHistorical(),head:"d".repeat(40)}),"HISTORICAL_SUBJECT_CHANGED");
reject(t=>t.verifyHistorical=()=>({...good().verifyHistorical(),frozen_runtime_108_unchanged:false}),"HISTORICAL_FROZEN_RUNTIME_CHANGED");
reject(t=>t.verifyHistorical=()=>({...good().verifyHistorical(),qcp_check_count:51}),"HISTORICAL_52_CHECKS_CHANGED");
reject(t=>t.firstParent=[H,head],"CURRENT_HEAD_NOT_FIRST_PARENT_TIP");
console.log(JSON.stringify({status:"PASS",acceptance_id:"MCFT_CAP09_DISABLED_RETRY_HISTORICAL_INHERITANCE_V1",positive:1,negative:count,history_replay_executed:false,production_authorized:false}));
