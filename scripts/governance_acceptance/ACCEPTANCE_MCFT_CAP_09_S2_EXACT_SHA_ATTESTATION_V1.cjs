#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');

const ROOT=process.cwd();
const OUTPUT=path.join(ROOT,'acceptance-output');
const SUBJECT='a4db631f5bab234d9a6f7c25607f4fd027d224a1';
const CORRECTION_BASE='56aacb93e9f97ed0fad43e6a001df28593341565';
const CORRECTION_HEAD='bc98724737166e3a902f67a1dd0fb60076c56f49';
const CORRECTION_TREE='1e87b0dcd74e3da895aab4cd7e2cf4ac24e6a539';
const CORRECTION_PR=2941;
const CORRECTION_FOCUSED_RUN=31150334462;
const CORRECTION_FOCUSED_ARTIFACT=8983045619;
const CORRECTION_FOCUSED_DIGEST='sha256:61e4790bb865efdb24b49beb6ec132be24f3d99cbed8514c9ddcdc746b25f392';
const CORRECTION_STANDARD_CI=31150334496;
const S4_SUBJECT='6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f';
const S4_RUN=31108834682;
const S4_ARTIFACT=8970768718;
const S4_SEMANTIC_DIGEST='sha256:64e14355edad6e2711cdde26cc3ac2bd6c7795c7e64439b194679350ce7cc80c';

const WORKFLOW='.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL_FILES=[WORKFLOW,VALIDATOR].sort();
const CORRECTION_FILES=[
  '.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml',
  'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts',
].sort();
const CORRECTION_BLOBS={
  '.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml':'9ca2831801c4f6a4e6da15710b7fc4dc9243339b',
  'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts':'d573e743c013c350394685aa09193fc53f3dd73b',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json':'e0f85f21cb4a9acbfac372267d6a6efec5fec9e7',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json':'735e4bd22af16fc2ff5d4ce97b5b37b050d1a7fe',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json':'0dfe401feaf420e669c5ebe759de56246bd6b14c',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json':'e95dbb80ac5cb972fe89dd0aa6d656a9d6bb846a',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json':'778f993559cebe0a8a45f8b828add7c2e0a60933',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json':'6f8a4d45aee3182c21685c4f28c6e4db597615fe',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs':'c47af7e05a6b84d9972c196e786e8be8164c961d',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts':'e520b897c8609cf861915101dc6da21541ea818f',
};
const FROZEN_CONTROL={
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json':'767d7a8c2ab65e4bd6fb212bb2c38a4bbc40ff25',
  'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json':'479f258e58482f3596ef3f1b88e27ef109b99d4b',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md':'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json':'82320c234c663af95aaec76df213d14b3aef048e',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs':'3badf1946bc6ec9221fed6800fb39cbbf3d10276',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs':'52a905d4f275be90f0f6bedd73a385dd92f67801',
};

const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const must=(v,c)=>{if(!v)throw new Error(c)};
const equal=(a,b,c)=>{try{assert.deepEqual(a,b)}catch{throw new Error(c)}};
const parents=sha=>git('rev-list','--parents','-n','1',sha).split(/\s+/);
const changed=(base,head)=>git('diff','--name-only',`${base}...${head}`).split(/\r?\n/).filter(Boolean).sort();
const blob=(sha,file)=>git('rev-parse',`${sha}:${file}`);
const read=file=>fs.readFileSync(file,'utf8');
function write(name,value){fs.mkdirSync(OUTPUT,{recursive:true});fs.writeFileSync(path.join(OUTPUT,name),JSON.stringify(value,null,2)+'\n')}
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;return JSON.stringify(value)}
function isAncestor(a,b){return cp.spawnSync('git',['merge-base','--is-ancestor',a,b],{cwd:ROOT}).status===0}
function verifyBlobs(sha,map,prefix){for(const [file,expected] of Object.entries(map))must(blob(sha,file)===expected,`${prefix}_BLOB_DRIFT:${file}`)}
async function api(endpoint){must(process.env.GITHUB_TOKEN&&process.env.GITHUB_REPOSITORY,'GITHUB_ENV_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${endpoint}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'geox-cap09-s2-epistemic-exact-sha'}});const t=await r.text();must(r.ok,`GITHUB_API_${r.status}:${t.slice(0,300)}`);return t?JSON.parse(t):{}}
function authorityFalse(value){for(const key of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(value[key]===false,`AUTHORITY_MUST_REMAIN_FALSE:${key}`)}

function controlPlaneCandidate(){
  const base=process.env.MCFT_BASE_SHA;const head=git('rev-parse','HEAD');
  must(base===SUBJECT,'EXACT_CONTROL_PLANE_BASE_REQUIRED');
  must(git('rev-list','--count',`${base}..${head}`)==='1','ONE_COMMIT_REQUIRED');
  equal(changed(base,head),CONTROL_FILES,'EXACT_TWO_FILE_CONTROL_PLANE_REQUIRED');
  const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
  must(!read(WORKFLOW).includes(marker)&&!read(VALIDATOR).includes(marker),'CONTROL_PLANE_DECLARATION_FORBIDDEN');
  for(const token of ['name: mcft-cap-09-s2-exact-sha-attestation',SUBJECT,String(CORRECTION_FOCUSED_RUN),String(CORRECTION_FOCUSED_ARTIFACT),CORRECTION_FOCUSED_DIGEST,'MCFT_RETENTION_LEVEL: R2',"MCFT_RETENTION_DAYS: '730'",'mcft-cap-09/s2-exact-sha-attestation'])must(read(WORKFLOW).includes(token),`WORKFLOW_TOKEN_REQUIRED:${token}`);
  for(const token of [SUBJECT,CORRECTION_HEAD,CORRECTION_TREE,String(CORRECTION_PR),String(CORRECTION_FOCUSED_RUN),String(CORRECTION_FOCUSED_ARTIFACT),CORRECTION_FOCUSED_DIGEST,String(CORRECTION_STANDARD_CI),S4_SUBJECT,S4_SEMANTIC_DIGEST,'REBASE_AND_REVALIDATE_MCFT_CAP_09_S5_CANDIDATE'])must(read(VALIDATOR).includes(token),`VALIDATOR_TOKEN_REQUIRED:${token}`);
  verifyBlobs(SUBJECT,CORRECTION_BLOBS,'SUBJECT');verifyBlobs(head,CORRECTION_BLOBS,'CONTROL_HEAD_CORRECTION');verifyBlobs(SUBJECT,FROZEN_CONTROL,'SUBJECT_CONTROL');verifyBlobs(head,FROZEN_CONTROL,'CONTROL_HEAD_FROZEN');
  const s5=JSON.parse(git('show',`${SUBJECT}:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json`));
  must(s5.s5_registry_registration_implemented===true&&s5.s5_candidate_implemented===false&&s5.externally_effective===false,'S5_FRONTIER_MUST_REMAIN_REGISTRY_ONLY');
  const result={schema_version:'geox_mcft_cap09_s2_epistemic_exact_sha_control_plane_result_v1',status:'PASS',change_class:'MCFT_CAP_09_S2_CANONICAL_EPISTEMIC_COMPATIBILITY_EXACT_SHA_R2_CONTROL_PLANE',base_sha:base,head_sha:head,changed_files:CONTROL_FILES,corrected_s2_subject_sha:SUBJECT,correction_focused_run_id:CORRECTION_FOCUSED_RUN,correction_focused_artifact_id:CORRECTION_FOCUSED_ARTIFACT,correction_standard_ci_run_id:CORRECTION_STANDARD_CI,s4_effective_subject_sha:S4_SUBJECT,external_effectiveness:false,runtime_source_delta:0,registry_delta:0,taskbook_delta:0,first_legal_next_action:'PROTECTED_MERGE_TRIGGERS_CORRECTED_S2_EXACT_SHA_R2_ATTESTATION'};
  write('MCFT_CAP_09_S2_EXACT_SHA_CONTROL_PLANE_RESULT.json',result);console.log(JSON.stringify(result,null,2));
}

async function attest(){
  must(process.env.MCFT_SUBJECT_SHA===SUBJECT,'EXACT_SUBJECT_REQUIRED');const controlMerge=git('rev-parse','HEAD');
  equal(parents(CORRECTION_HEAD),[CORRECTION_HEAD,CORRECTION_BASE],'CORRECTION_HEAD_PARENT_IDENTITY');
  equal(parents(SUBJECT),[SUBJECT,CORRECTION_BASE,CORRECTION_HEAD],'CORRECTED_SUBJECT_PARENT_IDENTITY');
  must(git('rev-parse',`${CORRECTION_HEAD}^{tree}`)===CORRECTION_TREE,'CORRECTION_HEAD_TREE_REQUIRED');
  must(git('rev-parse',`${SUBJECT}^{tree}`)===CORRECTION_TREE,'SUBJECT_TREE_REQUIRED');
  equal(changed(CORRECTION_BASE,CORRECTION_HEAD),CORRECTION_FILES,'EXACT_CORRECTION_BOUNDARY_REQUIRED');
  verifyBlobs(CORRECTION_HEAD,CORRECTION_BLOBS,'CORRECTION_HEAD');verifyBlobs(SUBJECT,CORRECTION_BLOBS,'SUBJECT');verifyBlobs(controlMerge,CORRECTION_BLOBS,'CONTROL_MERGE_CORRECTION');verifyBlobs(controlMerge,FROZEN_CONTROL,'CONTROL_MERGE_FROZEN');
  const cpParents=parents(controlMerge);must(cpParents.length===3&&cpParents[1]===SUBJECT,'CONTROL_MERGE_FIRST_PARENT_REQUIRED');const controlHead=cpParents[2];
  equal(parents(controlHead),[controlHead,SUBJECT],'CONTROL_HEAD_PARENT_REQUIRED');equal(changed(SUBJECT,controlHead),CONTROL_FILES,'EXACT_CONTROL_HEAD_BOUNDARY_REQUIRED');equal(changed(SUBJECT,controlMerge),CONTROL_FILES,'EXACT_CONTROL_MERGE_BOUNDARY_REQUIRED');must(git('rev-parse',`${controlHead}^{tree}`)===git('rev-parse',`${controlMerge}^{tree}`),'CONTROL_HEAD_MERGE_TREE_IDENTITY');
  const pulls=await api(`/commits/${SUBJECT}/pulls`);const pr=pulls.find(p=>p.number===CORRECTION_PR&&p.merge_commit_sha===SUBJECT&&p.head?.sha===CORRECTION_HEAD&&p.base?.sha===CORRECTION_BASE);must(Boolean(pr),'CORRECTION_PR_BINDING_REQUIRED');const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');must(!String(pr.body||'').includes(`<!-- ${marker}`),'CORRECTION_PR_DECLARATION_FORBIDDEN');
  const focused=await api(`/actions/runs/${CORRECTION_FOCUSED_RUN}`);const artifacts=await api(`/actions/runs/${CORRECTION_FOCUSED_RUN}/artifacts?per_page=100`);const artifact=artifacts.artifacts.find(a=>a.id===CORRECTION_FOCUSED_ARTIFACT&&a.name===`mcft-cap-09-s2-database-evidence-${CORRECTION_HEAD}`&&!a.expired);must(focused.head_sha===CORRECTION_HEAD&&focused.conclusion==='success','CORRECTION_FOCUSED_RUN_REQUIRED');must(Boolean(artifact)&&artifact.digest===CORRECTION_FOCUSED_DIGEST,'CORRECTION_FOCUSED_ARTIFACT_REQUIRED');
  const ci=await api(`/actions/runs/${CORRECTION_STANDARD_CI}`);const jobs=await api(`/actions/runs/${CORRECTION_STANDARD_CI}/jobs?per_page=100`);must(ci.head_sha===CORRECTION_HEAD&&ci.conclusion==='success','CORRECTION_STANDARD_CI_REQUIRED');for(const name of ['build-test','acceptance'])must(jobs.jobs.some(j=>j.name===name&&j.conclusion==='success'),`CORRECTION_STANDARD_JOB_REQUIRED:${name}`);
  must(isAncestor(S4_SUBJECT,SUBJECT),'S4_EFFECTIVE_SUBJECT_MUST_BE_ANCESTOR');
  const status=JSON.parse(git('show',`${SUBJECT}:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json`));must(status.canonical_epistemic_compatibility_correction_implemented===true&&status.canonical_epistemic_class_mapping_aligned===true&&status.canonical_cap04_future_forcing_compatible===true&&status.canonical_historical_et0_compatible===true,'CORRECTED_S2_STATUS_REQUIRED');must(status.externally_effective===false&&status.canonical_epistemic_compatibility_correction_externally_effective===false,'SUBJECT_MUST_BE_PRE_EFFECTIVENESS');authorityFalse(status);
  const s5=JSON.parse(git('show',`${SUBJECT}:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json`));must(s5.s5_registry_registration_implemented===true&&s5.s5_candidate_implemented===false&&s5.externally_effective===false,'S5_REGISTRY_FRONTIER_REQUIRED');
  const attestation={schema_version:'geox_mcft_cap09_s2_canonical_epistemic_compatibility_exact_sha_r2_attestation_v1',status:'PASS',capability_line_id:'MCFT-CAP-09',slice_id:'MCFT-CAP-09.S2',subject_sha:SUBJECT,merge_commit_sha:SUBJECT,correction_base_main_sha:CORRECTION_BASE,correction_pr_number:CORRECTION_PR,correction_head_sha:CORRECTION_HEAD,correction_tree_sha:CORRECTION_TREE,merge_tree_sha:CORRECTION_TREE,correction_to_merge_tree_delta:0,control_plane_head_sha:controlHead,control_plane_merge_sha:controlMerge,control_plane_changed_files:CONTROL_FILES,correction_focused_workflow_run_id:CORRECTION_FOCUSED_RUN,correction_focused_artifact_id:CORRECTION_FOCUSED_ARTIFACT,correction_focused_artifact_digest:CORRECTION_FOCUSED_DIGEST,correction_standard_ci_run_id:CORRECTION_STANDARD_CI,s4_existing_effective_authority:{subject_sha:S4_SUBJECT,exact_sha_r2_run_id:S4_RUN,artifact_id:S4_ARTIFACT,semantic_artifact_digest:S4_SEMANTIC_DIGEST,preserved:true},s2_effectiveness_resolution:{protected_correction_merge_verified:true,exact_corrected_merge_subject_verified:true,correction_head_tree_equals_merge_tree:true,exact_ten_file_correction_boundary_verified:true,exact_two_file_control_plane_verified:true,repository_facts_envelope_bound:true,six_key_scope_sql_verified:true,type_aware_role_time_verified:true,open_start_closed_end_window_verified:true,read_only_transaction_verified:true,shared_core_duplicate_identity_aligned:true,semantic_duplicate_conflict_fail_closed:true,interval_bucket_coverage_aligned:true,explicit_trust_fail_closed:true,actual_observation_freshness_only:true,canonical_epistemic_class_mapping_aligned:true,canonical_cap04_assumed_future_forcing_compatible:true,canonical_historical_et0_estimated_compatible:true,noncanonical_epistemic_aliases_fail_closed:true,real_postgresql_acceptance_pass:true,focused_workflow_pass:true,standard_ci_pass:true},effective_authority:{s0_authorization_effective:true,s1_adapter_contracts_effective:true,s2_database_evidence_ingress_effective:true,s2_canonical_epistemic_compatibility_effective:true,s3_persistent_sequential_scheduler_authority_preserved:true,s4_restart_backfill_stale_detection_authority_preserved:true,s5_registry_registration_preserved:true,effective_status:'IN_PROGRESS',effective_frontier:'S5_REVALIDATION',s5_candidate_revalidation_authorized:true,implementation_authorized:false,runtime_source_authorized:false,live_ingestion_authorized:false,background_scheduler_authorized:false,canonical_write_authorized:false,public_http_writer_authorized:false,model_activation_authorized:false,controlled_action_authorized:false},retention_contract:{level:'R2',days:730,upload_readback_required:true,locked_version_delete_denied_required:true},first_legal_next_action:'REBASE_AND_REVALIDATE_MCFT_CAP_09_S5_CANDIDATE',postmerge_ssot_writeback:false,nonclaims:['NO_NEW_S2_CANDIDATE_TRANSITION','NO_REWIND_OF_EFFECTIVE_S3_OR_S4_AUTHORITY','NO_LIVE_DEVICE_GATEWAY','NO_BACKGROUND_SCHEDULER_AUTHORITY_EXPANSION','NO_CANONICAL_WRITE_AUTHORITY_EXPANSION','NO_MODEL_ACTIVATION','NO_CONTROLLED_ACTION','NO_MCFT_CAP_09_COMPLETION']};const semantic={...attestation};attestation.semantic_artifact_digest=`sha256:${crypto.createHash('sha256').update(canonical(semantic)).digest('hex')}`;write('MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION.json',attestation);console.log(JSON.stringify({status:'PASS',subject_sha:SUBJECT,s2_canonical_epistemic_compatibility_effective:true,effective_frontier:'S5_REVALIDATION',first_legal_next_action:attestation.first_legal_next_action,semantic_artifact_digest:attestation.semantic_artifact_digest},null,2));
}

(async()=>{const mode=process.argv[2];try{if(mode==='--control-plane-candidate')controlPlaneCandidate();else if(mode==='--attest')await attest();else throw new Error('MODE_REQUIRED')}catch(error){const failure={status:'FAIL',mode:mode||null,error:String(error instanceof Error?error.message:error)};write(mode==='--attest'?'MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION.json':'MCFT_CAP_09_S2_EXACT_SHA_CONTROL_PLANE_RESULT.json',failure);console.error(JSON.stringify(failure,null,2));process.exitCode=1}})();
