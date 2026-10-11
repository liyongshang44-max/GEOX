"use strict";
const assert=require("node:assert/strict"),cp=require("node:child_process"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const manifest=require("../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-LOCAL-CUTOVER-EXACT-SCOPE-CANDIDATE-20261011-V1.json");
assert.equal(manifest.governance_adopted,false,"CANDIDATE_SCOPE_CANNOT_SELF_ADOPT");
assert.equal(manifest.execution_authorized,false,"CANDIDATE_SCOPE_CANNOT_AUTHORIZE_EXECUTE");
assert.equal(manifest.frozen_runtime_changes_authorized,false,"FROZEN_RUNTIME_BOUNDARY_REQUIRED");
assert.equal(manifest.stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
assert.match(manifest.base_sha,/^[a-f0-9]{40}$/);
const unique=[...new Set(manifest.paths)];
assert.deepEqual(manifest.paths,[...unique].sort(),"DUPLICATE_OR_UNSORTED_SCOPE");
assert(!manifest.paths.some(p=>p.startsWith("apps/server/src/")),"FROZEN_APP_RUNTIME_NOT_IN_SCOPE");
function git(...args){return cp.execFileSync("git",args,{cwd:root,encoding:"utf8",timeout:30000}).trim();}
const actualCommon=git("merge-base","HEAD",manifest.base_sha);
assert.equal(actualCommon,manifest.base_sha,"EXACT_PROTECTED_MAIN_ANCESTRY_REQUIRED");
const paths=git("diff","--name-only",manifest.base_sha,"HEAD").split(/\r?\n/).filter(Boolean).sort();
assert.deepEqual(paths,manifest.paths,"CANDIDATE_EXACT_SCOPE_MISMATCH");
console.log(JSON.stringify({status:"CANDIDATE_EXACT_SCOPE_PASS_NOT_GOVERNANCE_ADOPTION",count:paths.length,base_sha:manifest.base_sha,exact_main_ancestor:true,execute_authorized:false}));
