#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BASE = 'f78f5b32c45348fdb48129c01790933644edc6f0';
const S1_SUBJECT = '843ed078d6d384e43e2c6bd2568d789dcd508934';
const S1_RUN = 31007579256;
const S1_ARTIFACT = 8930987741;
const S1_DIGEST = 'sha256:0f67da5732f43a427d2518e320a617f3ad3872c6c34065060e432d92128404ef';
const D = 'docs/digital_twin/mcft/cap_09/';
const W = '.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml';
const S = 'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts';
const C = D + 'GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json';
const N = D + 'GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json';
const Y = D + 'GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json';
const T = D + 'GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json';
const H = D + 'GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json';
const P = D + 'GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json';
const V = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs';
const X = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts';
const FILES = [W,S,Y,N,C,T,H,P,V,X].sort();
const OUTPUT = 'acceptance-output/MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_RESULT.json';

const FROZEN_BLOBS = {
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json': 'd368a0d5a3b6189dd84ecb75a6643719cd37844e',
  'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json': '479f258e58482f3596ef3f1b88e27ef109b99d4b',
  [D + 'GEOX-MCFT-CAP-09-TASK.md']: 'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
  [D + 'GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json']: '82320c234c663af95aaec76df213d14b3aef048e',
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml': '471f134b969844084c1ef9297794d888c63fec44',
  '.github/workflows/mcft-cap-09-s1-registry-registration.yml': '53b45d8d23fb88d536f0fb2eaad12e405709f438',
  '.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml': '59bcaf459184af39b7076b5d6e7f8640e762e89b',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs': 'e89e8346ddebfd776ea04fa7369b376b415d7162',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs': '3c46e3f81083cdadf247b6567eab30bd5baf8db2',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs': 'fbc01cbaea116336302022dcd0531855c249d4a5',
};

const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const ok = (value, code) => { if (!value) throw new Error(code); };
const same = (a,b,code) => { try { assert.deepEqual(a,b); } catch { throw new Error(code); } };
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), {recursive:true});
  fs.writeFileSync(OUTPUT, JSON.stringify(value,null,2)+'\n');
}
function findArtifact(name) {
  const stack=[path.resolve(process.env.MCFT_CAP09_S1_EFFECTIVE_ARTIFACT_DIR || 'acceptance-input/cap09-s1-effective')];
  while (stack.length) {
    const dir=stack.pop();
    if (!dir || !fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      const full=path.join(dir,entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name===name) return full;
    }
  }
  throw new Error('ARTIFACT_MISSING:'+name);
}
async function api(relative) {
  ok(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${relative}`,{
    headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','User-Agent':'geox-cap09-s2-correction-r2'}
  });
  const body=await response.text();
  ok(response.ok, `GITHUB_API_${response.status}:${body}`);
  return JSON.parse(body);
}
function authoritiesFalse(status) {
  for (const key of [
    'implementation_authorized','runtime_source_authorized','live_ingestion_authorized',
    'background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized',
    'model_activation_authorized','controlled_action_authorized'
  ]) ok(status[key]===false, `AUTHORITY_MUST_REMAIN_FALSE:${key}`);
}

(async()=>{
  try {
    ok(process.argv.includes('--postmerge-semantic-correction'), 'CORRECTION_MODE_FLAG_REQUIRED');
    const base=process.env.MCFT_BASE_SHA;
    const head=git('rev-parse','HEAD');
    ok(base===BASE, 'EXACT_CORRECTION_BASE_REQUIRED');
    ok(git('rev-list','--count',`${base}..HEAD`)==='1', 'ONE_COMMIT_REQUIRED');
    const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
    same(changed, FILES, 'EXACT_TEN_FILE_CORRECTION_BOUNDARY_REQUIRED');

    const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
    for (const file of FILES) ok(!read(file).includes(marker), `DECLARATION_IN_REPOSITORY:${file}`);
    for (const [file,blob] of Object.entries(FROZEN_BLOBS)) {
      ok(git('rev-parse',`HEAD:${file}`)===blob, `FROZEN_AUTHORITY_DRIFT:${file}`);
    }

    const before=JSON.parse(git('show',`${base}:${T}`));
    const status=json(T), candidate=json(N), boundary=json(Y), config=json(C), hard=json(H), predecessor=json(P);
    ok(before.s2_candidate_implemented===true && status.s2_candidate_implemented===true,
      'EXISTING_S2_CANDIDATE_SIGNAL_MUST_REMAIN_TRUE');
    ok(status.postmerge_semantic_correction_implemented===true, 'CORRECTION_STATUS_REQUIRED');
    ok(status.postmerge_semantic_correction_declaration_required===false, 'CORRECTION_DECLARATION_MUST_BE_FALSE');
    ok(status.externally_effective===false && status.postmerge_semantic_correction_externally_effective===false,
      'CORRECTION_MUST_NOT_SELF_EFFECT');
    ok(status.postmerge_semantic_correction_base_main_sha===BASE, 'STATUS_CORRECTION_BASE');
    ok(status.historical_registry_lane_compatibility_merge_sha===BASE, 'STATUS_HISTORICAL_LANE_BASE');
    for (const key of ['shared_core_duplicate_identity_aligned','interval_bucket_coverage_aligned',
      'explicit_trust_fail_closed','actual_observation_freshness_only']) ok(status[key]===true, `STATUS_PROOF_REQUIRED:${key}`);
    authoritiesFalse(status);

    ok(boundary.base_main_sha===BASE && boundary.changed_file_count===10, 'BOUNDARY_BASE_OR_COUNT');
    same(boundary.changed_files.slice().sort(), FILES, 'BOUNDARY_FILES');
    ok(boundary.candidate_transition===false && boundary.candidate_declaration===false, 'BOUNDARY_CANDIDATE_SIGNAL_FORBIDDEN');
    ok(boundary.registry_delta===0 && boundary.taskbook_delta===0 && boundary.migration_delta===0, 'BOUNDARY_FROZEN_DELTA');

    ok(candidate.postmerge_semantic_correction_base_main_sha===BASE, 'CANDIDATE_CORRECTION_BASE');
    ok(candidate.historical_registry_lane_compatibility_merge_sha===BASE, 'CANDIDATE_HISTORICAL_LANE_BASE');
    ok(candidate.postmerge_semantic_correction_declaration_required===false, 'CANDIDATE_DECLARATION_FALSE');
    ok(candidate.external_effectiveness===false, 'CANDIDATE_EFFECTIVENESS_FALSE');
    ok(candidate.focused_workflow_blob_sha===git('rev-parse',`HEAD:${W}`), 'CANDIDATE_WORKFLOW_BLOB');
    ok(candidate.registry_lifecycle_classifier_blob_sha===FROZEN_BLOBS['scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'],
      'CANDIDATE_CLASSIFIER_BLOB');
    ok(candidate.registry_lifecycle_router_blob_sha===FROZEN_BLOBS['scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'],
      'CANDIDATE_ROUTER_BLOB');

    ok(config.repository_envelope==='FACTS_TYPE_PLUS_CANONICAL_REPLAY_PAYLOAD_V1','CONFIG_ENVELOPE');
    ok(config.window_rule==='OPEN_START_CLOSED_END_PT1H_V1','CONFIG_WINDOW');
    ok(config.duplicate_policy.shared_core_semantic_identity==='record_type+origin_source_id+role_event_time','CONFIG_DUPLICATE_IDENTITY');
    ok(config.coverage_policy==='ACTUAL_OBSERVATION_INTERVAL_BUCKETS_ONLY_V1','CONFIG_COVERAGE');
    ok(config.freshness_policy==='ACTUAL_OBSERVATIONS_ONLY_V1','CONFIG_FRESHNESS');
    ok(config.explicit_trust_fail_closed.missing_quality_ineligible===true,'CONFIG_MISSING_QUALITY');
    ok(config.database_write_allowed===false && config.scheduler_loop_allowed===false,'CONFIG_NONCLAIMS');
    ok(hard.required_check_count===20 && hard.checks.length===20,'HARD_ACCEPTANCE_COUNT');
    ok(predecessor.subject_sha===S1_SUBJECT && predecessor.exact_sha_r2_run_id===S1_RUN &&
      predecessor.artifact_id===S1_ARTIFACT && predecessor.semantic_artifact_digest===S1_DIGEST,'PREDECESSOR_IDENTITY');
    ok(predecessor.historical_registry_lane_compatibility_merge_sha===BASE,'PREDECESSOR_HISTORICAL_LANE_BASE');

    const attestation=JSON.parse(fs.readFileSync(findArtifact('MCFT_CAP_09_S1_EXACT_SHA_ATTESTATION.json'),'utf8'));
    const locator=JSON.parse(fs.readFileSync(findArtifact('MCFT_CAP_09_S1_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));
    ok(attestation.status==='PASS' && attestation.subject_sha===S1_SUBJECT &&
      attestation.semantic_artifact_digest===S1_DIGEST,'S1_ATTESTATION');
    ok(locator.retention_level==='R2' && locator.readback_verified===true &&
      locator.locked_version_delete_denied===true,'S1_R2_LOCATOR');

    const source=read(S);
    for (const token of ['BEGIN TRANSACTION READ ONLY','FACTS_TYPE_PLUS_CANONICAL_REPLAY_PAYLOAD_V1',
      'semantic_identity','CONFLICTING_DUPLICATE_OBSERVATION','intervalBucketCoverage',
      'actualObservationTimes','formal_eligible','is_simulated','evidence_level',
      'ACTUAL_OBSERVATION_INTERVAL_BUCKETS_ONLY_V1','ACTUAL_OBSERVATIONS_ONLY_V1']) {
      ok(source.includes(token), `SOURCE_TOKEN_REQUIRED:${token}`);
    }
    for (const forbidden of ['observed.length / expectedObservations','Math.min(1, observed.length','quality_status || "ELIGIBLE"']) {
      ok(!source.includes(forbidden), `WEAK_SEMANTIC_FORBIDDEN:${forbidden}`);
    }

    const runtime=read(X);
    for (const token of ['REAL_POSTGRESQL_ISOLATED_FACTS_READBACK',
      'SAME_REF_DIFFERENT_HASH_MUST_FAIL_CLOSED',
      'SHARED_CORE_SEMANTIC_DUPLICATE_CONFLICT_MUST_FAIL_CLOSED',
      'INTERVAL_BUCKET_COVERAGE_REQUIRED',
      'SIMULATED_DEBUG_EVIDENCE_MUST_FAIL_CLOSED',
      'MISSING_QUALITY_MUST_FAIL_CLOSED',
      'FUTURE_FORCING_MUST_NOT_MASK_ACTUAL_FRESHNESS',
      'ADAPTER_MUST_NOT_WRITE_FACTS']) ok(runtime.includes(token), `RUNTIME_TOKEN_REQUIRED:${token}`);

    const workflow=read(W);
    for (const token of ['--postmerge-semantic-correction','image: postgres:16',
      'semantic_duplicate_conflict_rejected','interval_bucket_coverage_proven',
      'actual_observation_freshness_only','clustered_interval_coverage_ratio']) {
      ok(workflow.includes(token), `WORKFLOW_TOKEN_REQUIRED:${token}`);
    }

    let prBinding={mode:'MERGE_GROUP_POLICY'};
    if (process.env.MCFT_EVENT_NAME==='pull_request') {
      const number=Number(process.env.MCFT_PR_NUMBER);
      const pr=await api(`/pulls/${number}`);
      ok(pr.head.sha===head && pr.base.sha===base,'PR_EXACT_BINDING');
      ok(!String(pr.body||'').includes(`<!-- ${marker}`),'CORRECTION_PR_DECLARATION_FORBIDDEN');
      prBinding={mode:'PR_BODY_NO_DECLARATION_VALIDATED',pr_number:number};
    }

    const result={
      schema_version:'geox_mcft_cap09_s2_database_evidence_ingress_result_v3',
      status:'PASS',
      lifecycle_mode:'POSTMERGE_PRE_EFFECTIVENESS_SEMANTIC_CORRECTION',
      base_sha:base,
      head_sha:head,
      changed_files:FILES,
      exact_new_candidate_signal_count:0,
      candidate_declaration_present:false,
      repository_evidence_envelope_bound:true,
      database_read_adapter_implemented:true,
      real_postgresql_acceptance_required:true,
      shared_core_duplicate_identity_aligned:true,
      interval_bucket_coverage_aligned:true,
      explicit_trust_fail_closed:true,
      actual_observation_freshness_only:true,
      future_forcing_known_at_boundary_eligible:true,
      database_write_performed:false,
      scheduler_loop_executed:false,
      canonical_write_performed:false,
      production_wiring_present:false,
      runtime_source_delta:1,
      runtime_executable_delta:1,
      migration_delta:0,
      external_effectiveness:false,
      pr_binding:prBinding,
      first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION_OF_CORRECTED_SUBJECT'
    };
    write(result);
    console.log(JSON.stringify(result,null,2));
  } catch (error) {
    const failure={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(error instanceof Error?error.message:error)};
    write(failure);
    console.error(JSON.stringify(failure,null,2));
    process.exitCode=1;
  }
})();
