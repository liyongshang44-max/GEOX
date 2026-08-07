#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const BASE='56aacb93e9f97ed0fad43e6a001df28593341565';
const S1_SUBJECT='843ed078d6d384e43e2c6bd2568d789dcd508934';
const S1_DIGEST='sha256:0f67da5732f43a427d2518e320a617f3ad3872c6c34065060e432d92128404ef';
const S1_RUN=31007579256,S1_ARTIFACT=8930987741;
const FILES=[".github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml","apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts"];
const OUT='acceptance-output/MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_RESULT.json';
const LOCKS={
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json':'767d7a8c2ab65e4bd6fb212bb2c38a4bbc40ff25',
  'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json':'479f258e58482f3596ef3f1b88e27ef109b99d4b',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md':'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json':'82320c234c663af95aaec76df213d14b3aef048e',
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml':'1c612db317e13ca95ae0bb35b6259e8c908f42eb',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs':'3badf1946bc6ec9221fed6800fb39cbbf3d10276',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs':'52a905d4f275be90f0f6bedd73a385dd92f67801'
};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const read=file=>fs.readFileSync(file,'utf8');
const json=file=>JSON.parse(read(file));
const must=(value,code)=>{if(!value)throw new Error(code)};
const same=(left,right,code)=>{try{assert.deepEqual([...left].sort(),[...right].sort())}catch{throw new Error(code)}};
function artifact(name){
  const root=path.resolve(process.env.MCFT_CAP09_S1_EFFECTIVE_ARTIFACT_DIR||'acceptance-input/cap09-s1-effective');
  const stack=[root];
  while(stack.length){
    const directory=stack.pop();
    if(!directory||!fs.existsSync(directory))continue;
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const full=path.join(directory,entry.name);
      if(entry.isDirectory())stack.push(full);else if(entry.name===name)return full;
    }
  }
  throw new Error('ARTIFACT_MISSING:'+name);
}
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(value,null,2)+'\n')}
(async()=>{try{
  must(process.argv.includes('--postmerge-semantic-correction'),'CORRECTION_MODE_FLAG_REQUIRED');
  const base=process.env.MCFT_BASE_SHA;
  const head=git('rev-parse','HEAD');
  must(base===BASE,'EXACT_CORRECTION_BASE_REQUIRED');
  must(git('rev-list','--count',`${base}..HEAD`)==='1','ONE_COMMIT_REQUIRED');
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean);
  same(changed,FILES,'EXACT_TEN_FILE_CORRECTION_BOUNDARY_REQUIRED');
  const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
  for(const file of FILES)must(!read(file).includes(marker),'DECLARATION_IN_REPOSITORY:'+file);
  for(const [file,blob] of Object.entries(LOCKS)){
    must(git('rev-parse',`HEAD:${file}`)===blob,'FROZEN_AUTHORITY_DRIFT:'+file);
    must(git('diff','--quiet',`${base}...HEAD`,'--',file)==='','FROZEN_FILE_CHANGED:'+file);
  }
  const before=JSON.parse(git('show',`${base}:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json`));
  const status=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json');
  must(before.s2_candidate_implemented===true&&status.s2_candidate_implemented===true,'EXISTING_S2_CANDIDATE_SIGNAL_MUST_REMAIN_TRUE');
  must(status.canonical_epistemic_compatibility_correction_base_main_sha===BASE&&status.canonical_epistemic_compatibility_correction_implemented===true,'CORRECTION_STATUS_REQUIRED');
  must(status.canonical_epistemic_compatibility_correction_declaration_required===false&&status.canonical_epistemic_compatibility_correction_externally_effective===false&&status.externally_effective===false,'CORRECTION_MUST_NOT_SELF_EFFECT');
  for(const key of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(status[key]===false,'AUTHORITY_MUST_REMAIN_FALSE:'+key);
  const config=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json');
  const expected={soil_moisture_observation_v1:'OBSERVED',observed_rainfall_v1:'OBSERVED',historical_et0_estimate_v1:'ESTIMATED',future_weather_assumption_v1:'ASSUMED',future_et0_assumption_v1:'ASSUMED'};
  assert.deepEqual(config.epistemic_class_by_record_type,expected);
  must(config.epistemic_authority_ref==='docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING-CONTRACT.md','MCFT00_EPISTEMIC_AUTHORITY_REQUIRED');
  must(config.epistemic_policy==='EXACT_FROZEN_CLASS_BY_RECORD_TYPE_FAIL_CLOSED','EXACT_EPISTEMIC_POLICY_REQUIRED');
  const boundary=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json');
  must(boundary.base_main_sha===BASE&&boundary.changed_file_count===10&&boundary.candidate_transition===false&&boundary.candidate_declaration===false,'BOUNDARY_INVALID');
  same(boundary.changed_files,FILES,'BOUNDARY_FILES');
  const hard=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json');
  must(hard.required_check_count===22&&hard.checks.length===22,'HARD_ACCEPTANCE_COUNT');
  const predecessor=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json');
  must(predecessor.subject_sha===S1_SUBJECT&&predecessor.exact_sha_r2_run_id===S1_RUN&&predecessor.artifact_id===S1_ARTIFACT&&predecessor.semantic_artifact_digest===S1_DIGEST,'PREDECESSOR_IDENTITY');
  const attestation=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S1_EXACT_SHA_ATTESTATION.json'),'utf8'));
  const locator=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S1_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));
  must(attestation.status==='PASS'&&attestation.subject_sha===S1_SUBJECT&&attestation.semantic_artifact_digest===S1_DIGEST,'S1_ATTESTATION');
  must(locator.retention_level==='R2'&&locator.readback_verified===true&&locator.locked_version_delete_denied===true,'S1_R2_LOCATOR');
  const source=read('apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts');
  for(const token of ['BEGIN TRANSACTION READ ONLY','epistemic_class_by_record_type','historical_et0_estimate_v1: "ESTIMATED"','future_weather_assumption_v1: "ASSUMED"','future_et0_assumption_v1: "ASSUMED"','expectedEpistemicClass','CONFLICTING_DUPLICATE_OBSERVATION','intervalBucketCoverage'])must(source.includes(token),'SOURCE_TOKEN_REQUIRED:'+token);
  for(const token of ['epistemicClass.includes("FUTURE")','item.is_actual_observation && epistemicClass !== "OBSERVED"'])must(!source.includes(token),'BROAD_EPISTEMIC_RULE_FORBIDDEN:'+token);
  const runtime=read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts');
  for(const token of ['buildCap04FutureForcingSnapshotV1','CAP04_CANONICAL_ASSUMED_FUTURE_FORCING_REQUIRED','CANONICAL_ESTIMATED_HISTORICAL_ET0_REQUIRED','NONCANONICAL_EPISTEMIC_CLASS_MUST_FAIL_CLOSED'])must(runtime.includes(token),'RUNTIME_TOKEN_REQUIRED:'+token);
  if(process.env.MCFT_EVENT_NAME==='pull_request'){
    const number=Number(process.env.MCFT_PR_NUMBER);
    must(Number.isInteger(number)&&number>0,'PR_NUMBER_REQUIRED');
    const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls/${number}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','User-Agent':'geox-cap09-s2-epistemic-correction'}});
    const pr=await response.json();
    must(response.ok,`GITHUB_API_${response.status}`);
    must(pr.head.sha===head&&pr.base.sha===base,'PR_EXACT_SHA_BINDING');
    must(!String(pr.body||'').includes(`<!-- ${marker}`),'CORRECTION_PR_DECLARATION_FORBIDDEN');
  }
  const result={schema_version:'geox_mcft_cap09_s2_database_evidence_ingress_result_v3',status:'PASS',lifecycle_mode:'POSTMERGE_PRE_EFFECTIVENESS_CANONICAL_EPISTEMIC_COMPATIBILITY_CORRECTION',base_sha:base,head_sha:head,changed_files:FILES,exact_new_candidate_signal_count:0,candidate_declaration_present:false,canonical_epistemic_class_mapping_aligned:true,canonical_cap04_future_forcing_compatible:true,canonical_historical_et0_compatible:true,shared_core_duplicate_identity_aligned:true,interval_bucket_coverage_aligned:true,explicit_trust_fail_closed:true,actual_observation_freshness_only:true,future_forcing_known_at_boundary_eligible:true,database_write_performed:false,scheduler_loop_executed:false,canonical_write_performed:false,production_wiring_present:false,runtime_source_delta:1,runtime_executable_delta:1,migration_delta:0,external_effectiveness:false,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION_OF_CORRECTED_S2_SUBJECT'};
  write(result);console.log(JSON.stringify(result,null,2));
}catch(error){const failure={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(error instanceof Error?error.message:error)};write(failure);console.error(JSON.stringify(failure,null,2));process.exitCode=1}})();
