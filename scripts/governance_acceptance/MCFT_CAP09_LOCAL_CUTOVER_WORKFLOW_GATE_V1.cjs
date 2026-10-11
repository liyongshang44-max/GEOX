#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {runAdoptedMainWorkflowGate}=require("./REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs");
try {
 const mode=process.argv[2];
 assert.equal(process.argv.length,3,"EXACTLY_ONE_WORKFLOW_GATE_REQUIRED");
 assert(["--current-baseline-preparation","--current-baseline-successor"].includes(mode),"UNKNOWN_LOCAL_CUTOVER_WORKFLOW_MODE");
 const evidence=runAdoptedMainWorkflowGate(mode);
 assert.equal(evidence.status,"PASS","HISTORIC_WORKFLOW_GATE_NOT_PASS");
 assert.equal(evidence.execute_authorized,false,"HISTORIC_REPLAY_CANNOT_AUTHORIZE_EXECUTE");
 console.log(JSON.stringify(evidence));
} catch(e) {console.error(e.stack||String(e));process.exitCode=1;}
