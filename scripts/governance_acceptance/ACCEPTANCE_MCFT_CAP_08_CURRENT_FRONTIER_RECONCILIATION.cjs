#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'acceptance-output', 'MCFT_CAP_08_CURRENT_FRONTIER_RECONCILIATION_RESULT.json');
const BASE = '67bd71560268046a7fa9a9433ee074ad3999cb71';
const SUBJECT = '67bd71560268046a7fa9a9433ee074ad3999cb71';
const RUN_ID = 30908130962;
const ARTIFACT_ID = 8891897316;
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-08-current-frontier-reconciliation.yml',
  'docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json',
  'docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
  'docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_CURRENT_FRONTIER_RECONCILIATION.cjs',
].sort();

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const assert = (ok, code) => { if (!ok) throw new Error(code); };
const write = (value) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + '\n'); };
const candidateMarker = ['MCFT','CANDIDATE','DECLARATION','V2'].join('_');

async function api(pathname) {
  const token = process.env.GITHUB_TOKEN;
  assert(token, 'GITHUB_TOKEN_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${pathname}`, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'geox-cap08-final-frontier' } });
  const body = await response.text();
  assert(response.ok, `GITHUB_API_FAILED:${response.status}:${pathname}:${body.slice(0,300)}`);
  return body ? JSON.parse(body) : null;
}

function findArtifactFile(name) {
  const base = path.resolve(process.env.MCFT_S6_ARTIFACT_DIR || 'acceptance-input/s6-exact-sha');
  const direct = path.join(base, name);
  if (fs.existsSync(direct)) return direct;
  const stack=[base];
  while (stack.length) {
    const current=stack.pop();
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
      const p=path.join(current,entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.name===name) return p;
    }
  }
  throw new Error(`ARTIFACT_FILE_NOT_FOUND:${name}`);
}

(async () => {
  const baseSha = process.env.MCFT_BASE_SHA;
  const headSha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  try {
    assert(baseSha === BASE, `BASE_SHA_MISMATCH:${baseSha}`);
    const changed = execFileSync('git',['diff','--name-only',`${baseSha}...HEAD`],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).sort();
    assert(JSON.stringify(changed)===JSON.stringify(EXPECTED_FILES), `CHANGED_FILE_BOUNDARY_MISMATCH:${JSON.stringify(changed)}`);
    for (const file of changed) {
      const content=read(file);
      assert(!content.includes(candidateMarker), `CANDIDATE_DECLARATION_FORBIDDEN:${file}`);
      assert(!file.startsWith('apps/'), `RUNTIME_SOURCE_FORBIDDEN:${file}`);
      assert(!file.startsWith('packages/'), `PACKAGE_SOURCE_FORBIDDEN:${file}`);
      assert(!file.startsWith('migrations/'), `MIGRATION_FORBIDDEN:${file}`);
      assert(file!=='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','REGISTRY_DELTA_FORBIDDEN');
      assert(!/GEOX-MCFT-CAP-08-S[1-6]-DELIVERY-STATUS-V1\.json$/.test(file),'DELIVERY_STATUS_DELTA_FORBIDDEN');
      assert(file!=='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md','TASKBOOK_DELTA_FORBIDDEN');
    }

    const attestation=JSON.parse(fs.readFileSync(findArtifactFile('MCFT_CAP_08_S6_EXACT_SHA_ATTESTATION.json'),'utf8'));
    const locator=JSON.parse(fs.readFileSync(findArtifactFile('MCFT_CAP_08_S6_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));
    assert(attestation.status==='PASS','ATTESTATION_NOT_PASS');
    assert(attestation.subject_sha===SUBJECT,'ATTESTATION_SUBJECT_MISMATCH');
    assert(attestation.capability_complete===true,'CAPABILITY_NOT_COMPLETE');
    assert(attestation.completion_level==='STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE','COMPLETION_LEVEL_MISMATCH');
    assert(attestation.candidate_to_merge_tree_delta===0,'TREE_DELTA_NONZERO');
    assert(attestation.hard_acceptance_resolution?.effective_resolved_item_count===24,'HA_EFFECTIVE_COUNT_MISMATCH');
    assert(attestation.hard_acceptance_resolution?.failed_item_count===0,'HA_FAILURE_PRESENT');
    assert(attestation.effective_delivery_frontier_projection?.mcft_cap_09_authorized===false,'ATTESTATION_CAP09_MUST_BE_FALSE');
    assert(locator.retention_level==='R2','R2_REQUIRED');
    assert(locator.readback_verified===true,'R2_READBACK_REQUIRED');
    assert(locator.locked_version_delete_denied===true,'LOCKED_DELETE_DENIAL_REQUIRED');
    assert(locator.retain_until==='2028-08-03T12:13:37.980Z','RETAIN_UNTIL_MISMATCH');
    assert(Object.keys(locator.object_versions||{}).length===4,'R2_OBJECT_COUNT_MISMATCH');

    const run=await api(`/actions/runs/${RUN_ID}`);
    assert(run.head_sha===SUBJECT && run.event==='push' && run.run_attempt===1 && run.status==='completed' && run.conclusion==='success','EXACT_RUN_METADATA_MISMATCH');
    const artifacts=await api(`/actions/runs/${RUN_ID}/artifacts?per_page=100`);
    const artifact=(artifacts.artifacts||[]).find((x)=>x.id===ARTIFACT_ID);
    assert(artifact && artifact.expired===false,'EXACT_ARTIFACT_MISSING_OR_EXPIRED');
    assert(artifact.digest==='sha256:ceb2dc797d6a9a3c54a6476435f9b1cc5f7dd0f08993af3d8ced424c65afe497','EXACT_ARTIFACT_DIGEST_MISMATCH');
    const status=await api(`/commits/${SUBJECT}/status`);
    const exact=(status.statuses||[]).find((x)=>x.context==='mcft-cap-08/s6-exact-sha-attestation');
    assert(exact?.state==='success','EXACT_STATUS_CONTEXT_NOT_SUCCESS');

    const frontier=json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json');
    const ssot=json('docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json');
    const matrix=json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json');
    const registry=json('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');
    const s6=json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json');
    const taskbookBlob=execFileSync('git',['rev-parse','HEAD:docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md'],{encoding:'utf8'}).trim();
    const registryBlob=execFileSync('git',['rev-parse','HEAD:docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'],{encoding:'utf8'}).trim();
    const s6Blob=execFileSync('git',['rev-parse','HEAD:docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json'],{encoding:'utf8'}).trim();
    assert(taskbookBlob==='a24114ff629560345b3bd3cda6b4024b9f3d61e4','TASKBOOK_BLOB_DRIFT');
    assert(registryBlob==='823c8afc5b149daad7b9635618d33d2eac1b2088','REGISTRY_BLOB_DRIFT');
    assert(s6Blob==='6efdaa0e46dd463c8884b0085c71f5cfe39a6e79','S6_STATUS_BLOB_DRIFT');
    assert(s6.externally_effective===false && s6.mcft_cap_08_complete===false,'S6_STATUS_MUST_REMAIN_CANDIDATE_STATE');
    assert(s6.postmerge_ssot_writeback_allowed===false,'POSTMERGE_STATUS_WRITEBACK_MUST_REMAIN_FALSE');

    assert(frontier.repository_main_at_reconciliation===SUBJECT,'FRONTIER_SUBJECT_MISMATCH');
    assert(frontier.current_effective_slice_id==='MCFT-CAP-08.S6','FRONTIER_SLICE_MISMATCH');
    assert(frontier.current_effective_status==='MCFT_CAP_08_COMPLETE','FRONTIER_STATUS_MISMATCH');
    assert(frontier.mcft_cap_08_complete===true && frontier.stage_1a_replay_backed_closure_complete===true,'FRONTIER_COMPLETION_MISSING');
    assert(frontier.next_authorized_slice_id===null && frontier.blocked_slice_id==='MCFT-CAP-09','SUCCESSOR_BOUNDARY_MISMATCH');
    assert(frontier.mcft_cap_09_authorized===false,'FRONTIER_CAP09_MUST_BE_FALSE');
    assert(frontier.runtime_source_delta===0 && frontier.registry_delta===0 && frontier.delivery_status_delta===0 && frontier.taskbook_byte_delta===0,'ZERO_DELTA_CONTRACT_VIOLATED');
    assert(frontier.s6_exact_sha_authority?.semantic_artifact_digest===attestation.semantic_artifact_digest,'FRONTIER_SEMANTIC_DIGEST_MISMATCH');
    assert(frontier.r2_retention_authority?.retain_until===locator.retain_until,'FRONTIER_RETENTION_MISMATCH');

    assert(ssot.settlement_subject_main===SUBJECT,'SSOT_SUBJECT_MISMATCH');
    assert(ssot.current_frontier?.effective_status==='MCFT_CAP_08_COMPLETE','SSOT_STATUS_MISMATCH');
    assert(ssot.current_frontier?.mcft_cap_08_complete===true,'SSOT_COMPLETION_MISSING');
    assert(ssot.current_frontier?.mcft_cap_09_authorized===false && ssot.mcft_cap_09_authorized===false,'SSOT_CAP09_MUST_BE_FALSE');
    assert(ssot.candidate_transition===false && ssot.registry_delta===0 && ssot.delivery_status_delta===0 && ssot.taskbook_byte_delta===0,'SSOT_RECONCILIATION_BOUNDARY_VIOLATED');

    const cap08=matrix.capability_lines.find((x)=>x.capability_line_id==='MCFT-CAP-08');
    const cap09=matrix.capability_lines.find((x)=>x.capability_line_id==='MCFT-CAP-09');
    assert(cap08?.status==='COMPLETE' && cap08?.complete===true,'MATRIX_CAP08_NOT_COMPLETE');
    assert(cap09?.status==='NOT_AUTHORIZED' && cap09?.implementation_authorized===false,'MATRIX_CAP09_AUTHORITY_DRIFT');
    assert(matrix.cap_08_status?.effective_subject_sha===SUBJECT,'MATRIX_SUBJECT_MISMATCH');
    assert(matrix.cap_08_status?.hard_acceptance_effective_count===24,'MATRIX_HA_COUNT_MISMATCH');

    const reg08=registry.capabilities.find((x)=>x.capability_line==='MCFT-CAP-08');
    assert(reg08?.mcft_cap_09_authorized===false,'REGISTRY_CAP09_MUST_BE_FALSE');
    assert(!registry.capabilities.some((x)=>x.capability_line==='MCFT-CAP-09'),'CAP09_REGISTRY_ENTRY_MUST_BE_ABSENT');

    const master=read('docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md');
    const map=read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md');
    const handoff=read('docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md');
    for (const text of [master,map,handoff]) {
      assert(text.includes(SUBJECT),'NAV_SUBJECT_MISSING');
      assert(text.includes('MCFT_CAP_08_COMPLETE'),'NAV_COMPLETION_MISSING');
      assert(text.includes('MCFT-CAP-09') && text.includes('NOT AUTHORIZED'),'NAV_CAP09_NONCLAIM_MISSING');
      assert(text.includes('2028-08-03T12:13:37.980Z'),'NAV_RETENTION_MISSING');
    }

    const result={status:'PASS',capability_line_id:'MCFT-CAP-08',change_class:'NON_CANDIDATE_POST_CLOSURE_CURRENT_FRONTIER_RECONCILIATION',base_sha:baseSha,head_sha:headSha,changed_files:changed,completion_subject_sha:SUBJECT,exact_sha_workflow_run_id:RUN_ID,exact_sha_artifact_id:ARTIFACT_ID,exact_sha_artifact_digest:artifact.digest,semantic_artifact_digest:attestation.semantic_artifact_digest,candidate_to_merge_tree_delta:attestation.candidate_to_merge_tree_delta,hard_acceptance_effective_count:attestation.hard_acceptance_resolution.effective_resolved_item_count,retention_level:locator.retention_level,retain_until:locator.retain_until,readback_verified:locator.readback_verified,locked_version_delete_denied:locator.locked_version_delete_denied,mcft_cap_08_complete:true,stage_1a_replay_backed_closure_complete:true,mcft_cap_09_authorized:false,first_legal_next_action:'MCFT_CAP_09_SUCCESSOR_DESIGN_AND_PRE_CANDIDATE_GOVERNANCE_REVIEW',candidate_declaration:false,runtime_source_delta:0,registry_delta:0,delivery_status_delta:0,taskbook_byte_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,postmerge_status_writeback:false};
    write(result); console.log(JSON.stringify(result,null,2));
  } catch (error) {
    const result={status:'FAIL',capability_line_id:'MCFT-CAP-08',change_class:'NON_CANDIDATE_POST_CLOSURE_CURRENT_FRONTIER_RECONCILIATION',base_sha:baseSha||null,head_sha:headSha,error:error instanceof Error?error.message:String(error)};
    write(result); console.error(JSON.stringify(result,null,2)); process.exitCode=1;
  }
})();
