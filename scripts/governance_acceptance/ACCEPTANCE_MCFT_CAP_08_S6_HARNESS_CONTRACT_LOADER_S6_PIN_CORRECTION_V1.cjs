#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const BASE='6c17cf1043081621609371b6a46c6ecbeb1ad706';
const OLD_S6='9cecc1aa6bd4063b770304f2539bc68a1ed2390c';
const CURRENT_S6='47ff4215d711b229604b29ce6c663e62b59efc39';
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_HARNESS_CONTRACT_LOADER_S6_PIN_CORRECTION_RESULT.json');
const FILES=[
'.github/workflows/mcft-cap-08-s6-harness-contract-loader-s6-pin-correction.yml',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARNESS-CONTRACT-LOADER-S6-PIN-CORRECTION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARNESS-CONTRACT-LOADER-S6-PIN-CORRECTION-ADJUDICATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_HARNESS_CONTRACT_LOADER_S6_PIN_CORRECTION_V1.cjs',
'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs'];
const P={workflow:FILES[0],boundary:FILES[1],adjudication:FILES[2],loader:FILES[4],harness:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs',identity:'scripts/runtime_acceptance/mcft_cap08_s6_final_formal_run/identity_v1.cjs',portContract:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/port_contract_v1.cjs',portBundle:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs',databaseWorkflow:'.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml',s6:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json'};
const PINS={authority:'e517aa42b51557d7ced75db92ff4c104945ecc36',effect:'05ca47c17e9700dfdee042ae396395494d099fc7',orchestrator:'c5d1232bcb1810a3ebd0898c213578ca49d0cd1d',run:'7a5feecbdb204c8fdf8c21ee8ea66576133c17dd',s6:CURRENT_S6,dataset:'b7baa289daf9f391f0b200d77c6d7ee7f18e7252'};
function git(...a){return execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();}
function gitRaw(...a){return execFileSync('git',a,{cwd:ROOT,encoding:'utf8'});}
function json(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function digest(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`;}
function machine(v){const c=structuredClone(v);delete c.record_status;delete c.review_contract;delete c.semantic_digest;return c;}
function write(v){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,`${JSON.stringify(v,null,2)}\n`);}
async function main(){
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'EXACT_BASE');
 assert.equal(git('merge-base',base,'HEAD'),base,'BASE_ANCESTOR');
 assert.equal(git('rev-list','--count',`${base}..HEAD`),'1','SINGLE_COMMIT');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...FILES].sort(),'EXACT_BOUNDARY');
 const boundary=json(P.boundary),adjudication=json(P.adjudication);
 assert.equal(boundary.semantic_digest,digest(boundary),'BOUNDARY_DIGEST');
 assert.equal(adjudication.semantic_digest,digest(adjudication),'ADJUDICATION_DIGEST');
 assert.equal(boundary.base_main_sha,BASE);assert.equal(boundary.changed_file_count,5);
 assert.deepEqual([...boundary.changed_files].sort(),[...FILES].sort());
 assert.equal(boundary.loader_source.previous_blob_sha,'810ee6fc0944364ed825b80f922d977f37c56b34');
 assert.equal(boundary.loader_source.corrected_blob_sha,'27903ddc8566505053e3e6ccf4e8d08dfc576869');
 assert.equal(boundary.database_execution_performed,false);assert.equal(boundary.workflow_dispatch_performed,false);assert.equal(boundary.replacement_authority_present,false);assert.equal(boundary.run_b_dispatch_authorized,false);
 assert.equal(adjudication.trigger.closed_pull_request_number,2754);assert.equal(adjudication.trigger.focused_workflow_run_id,30740234139);assert.equal(adjudication.trigger.observed_failure,'HARNESS_AUTHORITY_BLOB_DRIFT:s6');
 assert.equal(adjudication.root_cause.pinned_s6_blob_sha,OLD_S6);assert.equal(adjudication.root_cause.current_s6_blob_sha,CURRENT_S6);assert.equal(adjudication.root_cause.amendment_pull_request_number,2748);assert.equal(adjudication.root_cause.amendment_scope,'REVIEW_GOVERNANCE_ONLY');assert.equal(adjudication.root_cause.technical_gate_relaxation,false);assert.equal(adjudication.root_cause.execution_machine_semantics_changed,false);
 assert.equal(adjudication.correction.other_five_contract_pins_changed,false);assert.equal(adjudication.correction.exact_blob_pinning_removed,false);assert.equal(adjudication.correction.formal_identity_basis_changed,false);assert.equal(adjudication.invalidated_authority_candidate.identity_reuse_authorized,false);
 const loader=fs.readFileSync(path.join(ROOT,P.loader),'utf8');
 const baseLoader=gitRaw('show',`${base}:${P.loader}`);
 const expected=baseLoader.replace(`s6:'${OLD_S6}'`,`s6:'${CURRENT_S6}'`);
 assert.notEqual(expected,baseLoader,'OLD_PIN_ON_BASE');assert.equal(loader,expected,'ONLY_S6_PIN_MAY_CHANGE');
 assert.equal(git('rev-parse',`${base}:${P.loader}`),'810ee6fc0944364ed825b80f922d977f37c56b34');assert.equal(git('rev-parse',`HEAD:${P.loader}`),'27903ddc8566505053e3e6ccf4e8d08dfc576869');
 const {PATHS,loadSingleRunHarnessContractsV1}=require(path.join(ROOT,P.loader));
 for(const [k,v] of Object.entries(PINS))assert.equal(git('rev-parse',`HEAD:${PATHS[k]}`),v,`PIN:${k}`);
 const contracts=loadSingleRunHarnessContractsV1();
 assert.equal(contracts.s6.record_status,'FROZEN_PRE_CANDIDATE_FINAL_CLOSURE_MACHINE_CONTRACT_CTO_REVIEW_AMENDED');assert.equal(contracts.s6.review_contract.independent_review_requirement_state,'SUSPENDED_BY_CTO_RULING');assert.equal(contracts.s6.review_contract.technical_gate_relaxation,false);assert.equal(contracts.s6.formal_run_contract.run_count,2);assert.equal(contracts.s6.hard_acceptance_contract.ledger_item_count,24);assert.equal(contracts.s6.retention_contract.days,730);
 const oldS6=JSON.parse(gitRaw('cat-file','-p',OLD_S6)),currentS6=json(P.s6);
 assert.deepEqual(machine(currentS6),machine(oldS6),'MACHINE_CONTRACT_UNCHANGED');assert.notDeepEqual(currentS6.review_contract,oldS6.review_contract,'REVIEW_AMENDMENT_PRESENT');
 assert.equal(git('rev-parse',`HEAD:${P.identity}`),'9da7fb9f3c4a89d14a864043867dec7d68fab58a');
 const {deriveFormalIdentityV1}=require(path.join(ROOT,P.identity));const identity=deriveFormalIdentityV1(contracts);assert.equal(identity.identity_basis.s6_contract_blob,OLD_S6,'IDENTITY_BASIS_STABLE');
 assert.equal(git('rev-parse',`HEAD:${P.harness}`),'1833c793a10bba383f54200a35cb3f8912b60b94');assert.equal(git('rev-parse',`HEAD:${P.portContract}`),'1f7b4a8aaac0a2db2e9ec6826672dd1a3a341681');assert.equal(git('rev-parse',`HEAD:${P.portBundle}`),'2f574588ba3010a94e64f965bb17fc97b3b33c72');assert.equal(git('rev-parse',`HEAD:${P.databaseWorkflow}`),'47b5f7748c917a099dc92219f1cbd4055bfb4862');
 const child=`'use strict';const {executeSingleRunDatabaseHarnessV1}=require('./${P.harness}');const calls=[];const sentinel=new Error('PRE_DISPATCH_FRESH_DATABASE_SENTINEL');const ports={freshDatabase:{async assertFreshDisposable(){calls.push('freshDatabase');throw sentinel;}},materializer:{async executeDirectFormalRun(){calls.push('materializer');}},closureReader:{async query(){calls.push('closureReader');}},recovery:{async executeVector(){calls.push('recovery');}},cap07Reader:{async request(){calls.push('cap07Reader');}},artifactWriter:{async writeBundle(){calls.push('artifactWriter');}}};executeSingleRunDatabaseHarnessV1({input:{runLabel:'RUN_A',operationalRunInstanceId:'MCFT-CAP-08-S6-LOADER-PIN-PREFLIGHT-001',exactSubjectSha:'${BASE}'},ports,executionAuthority:{record_status:'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED',exact_subject_sha:'${BASE}'}}).then(()=>process.exit(2)).catch(e=>{if(e===sentinel&&JSON.stringify(calls)===JSON.stringify(['freshDatabase'])){console.log('FRESH_PROCESS_HARNESS_SENTINEL_PASS');process.exit(0);}console.error(e&&e.stack||e);console.error(JSON.stringify({calls}));process.exit(3);});`;
 const fresh=spawnSync(process.execPath,['-e',child],{cwd:ROOT,encoding:'utf8',env:{...process.env,MCFT_LOCAL_REPLAY:'0'}});
 assert.equal(fresh.status,0,`FRESH_PROCESS_HARNESS:${fresh.stderr||fresh.stdout}`);assert.match(fresh.stdout,/FRESH_PROCESS_HARNESS_SENTINEL_PASS/);assert.doesNotMatch(`${fresh.stdout}\n${fresh.stderr}`,/HARNESS_AUTHORITY_BLOB_DRIFT/);
 const workflow=fs.readFileSync(path.join(ROOT,P.workflow),'utf8');assert.doesNotMatch(workflow,/workflow_dispatch:|postgres|psql|DATABASE_URL/i);assert.equal(changed.some(r=>r.startsWith('apps/server/')||r.startsWith('apps/web/')||/migration/i.test(r)),false);assert.equal(changed.some(r=>/AUTHORITY-CANDIDATE|AUTHORITY-EFFECTIVENESS/i.test(r)),false);
 const result={schema_version:'geox_mcft_cap08_s6_harness_contract_loader_s6_pin_correction_result_v1',status:'PASS',base_main_sha:base,exact_head_sha:git('rev-parse','HEAD'),previous_loader_blob_sha:'810ee6fc0944364ed825b80f922d977f37c56b34',corrected_loader_blob_sha:'27903ddc8566505053e3e6ccf4e8d08dfc576869',previous_s6_pin:OLD_S6,current_s6_pin:CURRENT_S6,other_five_contract_pins_unchanged:true,exact_blob_pinning_preserved:true,s6_machine_contract_unchanged:true,s6_review_governance_amendment_present:true,formal_identity_basis_unchanged:true,fresh_process_harness_contract_loading:'PASS',harness_reached_fresh_database_sentinel:true,later_port_invocation_count:0,invalidated_pr_number:2754,invalidated_identity_reuse_authorized:false,database_execution_performed:false,workflow_dispatch_performed:false,replacement_authority_present:false,run_b_dispatch_authorized:false,formal_run_result_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};write(result);console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{write({schema_version:'geox_mcft_cap08_s6_harness_contract_loader_s6_pin_correction_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1;});
