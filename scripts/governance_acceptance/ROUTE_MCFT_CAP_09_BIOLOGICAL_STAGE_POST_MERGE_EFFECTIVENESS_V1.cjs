#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const EFFECTIVENESS_MERGE_SHA="0630bb63b82c9ba108854f5aa26b096f9221f031";
const CERT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const CANONICAL="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_BIOLOGICAL_STAGE_POST_MERGE_EFFECTIVENESS_V1.cjs";
const EXPECTED_CERT_SHA256="sha256:acffd98b6e014db4d11a3374a50a2e576be3396aef33ed456f7ee104ee72a1c6";

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function isAncestor(a,b){return cp.spawnSync("git",["merge-base","--is-ancestor",a,b],{cwd:ROOT,stdio:"ignore"}).status===0;}
function blob(ref,rel){return git("rev-parse",ref+":"+rel);}
function worktreeBlob(rel){return git("hash-object",rel);}
function digest(rel){return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,rel))).digest("hex");}
function runCanonical(){
  cp.execFileSync(process.execPath,[path.join(ROOT,CANONICAL)],{cwd:ROOT,stdio:"inherit",env:process.env});
  process.stdout.write(JSON.stringify({status:"PASS",mode:"CANONICAL_EXACT_EFFECTIVENESS_QUALIFICATION",runtime_mutation:false,production_owner_activation:false,formal_v5_armed:false,a0_started:false,o00_started:false})+"\n");
}

const head=git("rev-parse","HEAD");
if(!isAncestor(EFFECTIVENESS_MERGE_SHA,head)){
  runCanonical();
  process.exit(0);
}

assert.equal(blob(EFFECTIVENESS_MERGE_SHA,CERT),worktreeBlob(CERT),"SUCCESSOR_EFFECTIVENESS_CERT_BLOB_DRIFT");
assert.equal(blob(EFFECTIVENESS_MERGE_SHA,CANONICAL),worktreeBlob(CANONICAL),"SUCCESSOR_CANONICAL_EFFECTIVENESS_ACCEPTANCE_DRIFT");
assert.equal(digest(CERT),EXPECTED_CERT_SHA256,"SUCCESSOR_EFFECTIVENESS_CERT_SHA256_DRIFT");
const cert=JSON.parse(fs.readFileSync(path.join(ROOT,CERT),"utf8"));
assert.equal(cert.schema_version,"geox_dt02_biological_stage_authority_effectiveness_v1");
assert.equal(cert.amendment_id,"DT02-AMENDMENT-03");
assert.equal(cert.status,"EFFECTIVE");
assert.equal(cert.effective,true);
assert.equal(cert.protected_main_sha,"ddfdbc0ee88e7845e03eaf4b14e6077dbf645a23");
for(const key of ["runtime_start_authorized","production_owner_activation_authorized","formal_v5_authorized","a0_authorized","o00_o23_authorized"]){
  assert.equal(cert[key],false,"SUCCESSOR_EFFECTIVENESS_CERT_CEILING_DRIFT:"+key);
}
process.stdout.write(JSON.stringify({
  status:"PASS",
  mode:"SUCCESSOR_PRESERVATION",
  effectiveness_merge_sha:EFFECTIVENESS_MERGE_SHA,
  subject_head_sha:head,
  certificate_sha256:EXPECTED_CERT_SHA256,
  canonical_exact_acceptance_preserved:true,
  runtime_mutation:false,
  production_owner_activation:false,
  formal_v5_armed:false,
  a0_started:false,
  o00_started:false
},null,2)+"\n");
