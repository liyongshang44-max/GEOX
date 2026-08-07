#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=process.cwd(),OUT=path.join(ROOT,'acceptance-output');
const SUBJECT='afc882c49d6ec0a475552686200c369eb819b6cd';
const BASE='9a7e61bc306161c256a43469ab37185c524d1cd8';
const HEAD='b9a018384563232c9d26a88096764c04dc3b7568';
const PR=2940,FOCUSED_RUN=31157579292,FOCUSED_ARTIFACT=8985755771,CI_RUN=31157579256;
const CONTROL_BASE='71ee906aa2a96f6c36341738f29ff1f7fadf211a';
const FOCUSED_DIGEST='sha256:600b996e4d5a4c7ad1985dcb1c8a402d644955b20b8f1ced94a544219e81a8e2';
const WORKFLOW='.github/workflows/mcft-cap-09-s5-exact-sha-attestation.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL=[WORKFLOW,VALIDATOR].sort();
const BLOBS=Object.freeze({
'.github/workflows/mcft-cap-09-s5-shadow-online-canonical-integration.yml':'75a66056ec0207a8d67033490c1e6c24d643c9ab',
'apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.ts':'f84bca91bf0367d29bda8ea24a4ed7674574d851',
'apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts':'39a097a2343bd95dcc6b7621a4acc0e31772c563',
'apps/server/src/runtime/twin_runtime/postgres_read_only_execution_evidence_adapter_v1.ts':'3ce47be523d0ba3b0f92cc2875783655cc82767b',
'apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.ts':'df3de78aba2931b1237555035564a0a2500e7ec9',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json':'08fc09605561a5fce5beb597c4eea8164275d5ac',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-HARD-ACCEPTANCE-EVIDENCE-V1.json':'40d937eeee59d2255d9033c197eb43ae9a5976b4',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json':'3f67ca317ded1865932c3873f43000ca436daca8',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-BOUNDARY-V1.json':'fb52c79462b3f0d3b61e0fe68c3b5e0b90e91644',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-V1.json':'76e1076c12061dd1bab7d7433835d566fb91199e',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CONFIG-V1.json':'ae32682f9a0984f62e810e6ddeb34b8f9979fa06',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION.cjs':'4730663a9ebbbd5b82d6464840845fd47a71796e',
'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION_DB.ts':'5f98b2a6720cd71d439675e54751faf1919ee088'});
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const req=(x,c)=>{if(!x)throw Error(c)},eq=(a,b,c)=>{try{assert.deepEqual(a,b)}catch{throw Error(c)}};
const files=(a,b)=>git('diff','--name-only',a+'...'+b).split(/\r?\n/).filter(Boolean).sort();
const parents=s=>git('rev-list','--parents','-n','1',s).split(/\s+/);
const blob=(s,f)=>git('rev-parse',s+':'+f);
function write(n,x){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,n),JSON.stringify(x,null,2)+'\n')}
function walk(r){if(!fs.existsSync(r))return[];return fs.readdirSync(r,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(r,e.name)):[path.join(r,e.name)])}
function json(r,n){const f=walk(r).find(x=>path.basename(x)===n);req(f,'ARTIFACT_FILE:'+n);return JSON.parse(fs.readFileSync(f,'utf8'))}
function canon(x){if(Array.isArray(x))return'['+x.map(canon).join(',')+']';if(x&&typeof x==='object')return'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}';return JSON.stringify(x)}
function digest(x){return'sha256:'+crypto.createHash('sha256').update(canon(x)).digest('hex')}
function fixed(s){for(const[f,h]of Object.entries(BLOBS))req(blob(s,f)===h,'BLOB_DRIFT:'+f)}
async function api(e){const r=await fetch('https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+e,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'geox-cap09-s5-exact'}});const t=await r.text();req(r.ok,'API_'+r.status+':'+t.slice(0,200));return t?JSON.parse(t):{}}
function control(){
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');
 req(base===CONTROL_BASE,'CONTROL_BASE');req(git('merge-base','--is-ancestor',SUBJECT,base)==='', 'SUBJECT_BASE_ANCESTRY');eq(files(base,head),CONTROL,'CONTROL_TWO_FILES');req(git('rev-list','--count',base+'..'+head)==='1','CONTROL_ONE_COMMIT');
 const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 req(!fs.readFileSync(WORKFLOW,'utf8').includes(marker)&&!fs.readFileSync(VALIDATOR,'utf8').includes(marker),'DECLARATION_FORBIDDEN');
 fixed(SUBJECT);fixed(head);
 write('MCFT_CAP_09_S5_EXACT_SHA_CONTROL_PLANE_RESULT.json',{schema_version:'geox_mcft_cap09_s5_exact_sha_control_plane_v1',status:'PASS',base_sha:base,head_sha:head,changed_files:CONTROL,subject_sha:SUBJECT,focused_run_id:FOCUSED_RUN,focused_artifact_id:FOCUSED_ARTIFACT,standard_ci_run_id:CI_RUN,external_effectiveness:false,runtime_source_delta:0,registry_delta:0,taskbook_delta:0,first_legal_next_action:'PROTECTED_MERGE_TRIGGERS_S5_EXACT_SHA_R2_ATTESTATION'});
}
async function attest(){
 req(process.env.MCFT_SUBJECT_SHA===SUBJECT,'SUBJECT');
 eq(parents(SUBJECT),[SUBJECT,BASE,HEAD],'SUBJECT_PARENTS');
 const tree=git('rev-parse',HEAD+'^{tree}');req(git('rev-parse',SUBJECT+'^{tree}')===tree,'TREE_IDENTITY');
 eq(files(BASE,HEAD),Object.keys(BLOBS).sort(),'CANDIDATE_BOUNDARY');fixed(HEAD);fixed(SUBJECT);
 const merge=git('rev-parse','HEAD'),p=parents(merge);req(p.length===3&&p[1]===CONTROL_BASE,'CONTROL_MERGE_PARENT');
 const controlHead=p[2];req(git('merge-base','--is-ancestor',SUBJECT,CONTROL_BASE)==='', 'SUBJECT_CONTROL_BASE_ANCESTRY');eq(files(CONTROL_BASE,controlHead),CONTROL,'CONTROL_BOUNDARY');eq(files(CONTROL_BASE,merge),CONTROL,'CONTROL_MERGE_BOUNDARY');fixed(merge);
 const pulls=await api('/commits/'+SUBJECT+'/pulls');const pr=pulls.find(x=>x.number===PR&&x.merge_commit_sha===SUBJECT&&x.head?.sha===HEAD&&x.base?.sha===BASE);req(pr,'PR_BINDING');req(String(pr.body||'').includes('<!-- '+['MCFT','CANDIDATE','DECLARATION','V2'].join('_')),'DECLARATION');
 const run=await api('/actions/runs/'+FOCUSED_RUN);req(run.conclusion==='success'&&run.head_sha===HEAD&&run.event==='pull_request','FOCUSED_RUN');
 const arts=await api('/actions/runs/'+FOCUSED_RUN+'/artifacts?per_page=100');const art=(arts.artifacts||[]).find(x=>x.id===FOCUSED_ARTIFACT);req(art&&art.digest===FOCUSED_DIGEST,'FOCUSED_ARTIFACT');
 const root=process.env.MCFT_CAP09_S5_FOCUSED_ARTIFACT_DIR;req(root&&fs.existsSync(root),'FOCUSED_DIR');
 const gov=json(root,'MCFT_CAP_09_S5_GOVERNANCE_ACCEPTANCE_RESULT.json'),db=json(root,'MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION_DB_RESULT.json'),focus=json(root,'MCFT_CAP_09_S5_FOCUSED_ACCEPTANCE_RESULT.json');
 req(gov.status==='PASS'&&db.status==='PASS'&&focus.status==='PASS','FOCUSED_PASS');
 req(gov.corrected_s2_r2_consumed===true&&focus.corrected_s2_exact_sha_r2_consumed===true,'S2_R2');
 req(JSON.stringify(db.canonical_families_proven)===JSON.stringify(['A','B','C','F']),'FAMILIES');
 for(const k of ['completed','blocked','cap05_no_residual','cap05_positive_residual']){const x=db[k];req(x?.status==='PASS'&&x.exact_frozen_evidence_reused===true&&x.shared_scheduler_canonical_fence===true&&x.forbidden_fact_count===0&&x.g_write_count===0&&x.action_creation_count===0,'PATH:'+k)}
 req(db.cap05_no_residual.c_residual_disposition==='NO_ELIGIBLE_HISTORICAL_FORECAST'&&db.cap05_no_residual.current_observation_exact_target_time===true&&db.cap05_no_residual.postgres_forecast_projection_count_before_tick===0,'NO_C');
 req(db.cap05_positive_residual.c_residual_count===1&&db.cap05_positive_residual.h_read_only_consumed===true&&db.cap05_positive_residual.s5_h_write_count===0,'POSITIVE_C_H');
 const ci=await api('/actions/runs/'+CI_RUN);req(ci.conclusion==='success'&&ci.head_sha===HEAD,'CI');const jobs=await api('/actions/runs/'+CI_RUN+'/jobs?per_page=100');for(const n of['build-test','acceptance'])req((jobs.jobs||[]).find(x=>x.name===n)?.conclusion==='success','CI_JOB:'+n);
 const a={schema_version:'geox_mcft_cap09_s5_exact_sha_attestation_v1',status:'PASS',capability_line_id:'MCFT-CAP-09',slice_id:'MCFT-CAP-09.S5',authority_claim:'MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION_EFFECTIVE',subject_sha:SUBJECT,candidate_head_sha:HEAD,candidate_tree_sha:tree,candidate_to_merge_tree_delta:0,control_plane_merge_sha:merge,focused_run_id:FOCUSED_RUN,focused_artifact_id:FOCUSED_ARTIFACT,focused_artifact_digest:FOCUSED_DIGEST,standard_ci_run_id:CI_RUN,semantic_digest_policy:'CANONICAL_SORTED_KEYS_V1',semantic_artifact:{subject_sha:SUBJECT,candidate_base_sha:BASE,candidate_head_sha:HEAD,candidate_tree_sha:tree,candidate_pr_number:PR,semantic_files:Object.entries(BLOBS).map(([path,blob_sha])=>({path,blob_sha})),canonical_families_proven:db.canonical_families_proven,g_write_count:db.g_write_count,action_creation_count:db.action_creation_count,corrected_s2_subject_sha:gov.corrected_s2_subject_sha},effective_authority:{s5_shadow_online_canonical_integration_effective:true,effective_next_slice:'S6',s6_registry_registration_authorized:true,s6_authorized_scope:'FORMAL_24_HOUR_STAGE_1B_CLOSURE_ONLY',implementation_authorized:false,runtime_source_authorized:false,live_ingestion_authorized:false,background_scheduler_authorized:false,canonical_write_authorized:false,public_http_writer_authorized:false,model_activation_authorized:false,controlled_action_authorized:false,first_legal_next_action:'MCFT_CAP_09_S6_REGISTRY_REGISTRATION'},retention_required:{level:'R2',days:730,readback_required:true,locked_delete_denial_required:true}};
 a.semantic_artifact_digest=digest(a);write('MCFT_CAP_09_S5_EXACT_SHA_ATTESTATION.json',a);
}
const mode=process.argv[2];(async()=>{try{if(mode==='--control-plane-candidate')control();else if(mode==='--attest')await attest();else throw Error('MODE')}catch(e){write(mode==='--attest'?'MCFT_CAP_09_S5_EXACT_SHA_ATTESTATION.json':'MCFT_CAP_09_S5_EXACT_SHA_CONTROL_PLANE_RESULT.json',{status:'FAIL',error:String(e.message||e)});console.error(e);process.exitCode=1}})();
