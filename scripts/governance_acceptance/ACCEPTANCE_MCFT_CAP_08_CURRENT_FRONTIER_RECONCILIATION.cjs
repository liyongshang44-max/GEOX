const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'acceptance-output');
const outPath = path.join(outDir, 'MCFT_CAP_08_CURRENT_FRONTIER_RECONCILIATION_RESULT.json');
fs.mkdirSync(outDir, { recursive: true });

const expectedFiles = [
  '.github/workflows/mcft-cap-08-current-frontier-reconciliation.yml',
  'docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json',
  'docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_CURRENT_FRONTIER_RECONCILIATION.cjs',
].sort();

const candidateMarker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const writeResult = (result) => fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

const baseSha = process.env.MCFT_BASE_SHA;
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

try {
  assert(/^[0-9a-f]{40}$/.test(baseSha || ''), 'MCFT_BASE_SHA must be an exact Git SHA');

  const changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', `${baseSha}...HEAD`],
    { cwd: root, encoding: 'utf8' },
  ).trim().split(/\r?\n/).filter(Boolean).sort();

  assert(
    JSON.stringify(changedFiles) === JSON.stringify(expectedFiles),
    `CURRENT_FRONTIER_CHANGED_FILE_BOUNDARY_MISMATCH\nexpected=${JSON.stringify(expectedFiles)}\nactual=${JSON.stringify(changedFiles)}`,
  );

  for (const file of changedFiles) {
    const content = read(file);
    assert(!content.includes(candidateMarker), `Candidate Declaration forbidden: ${file}`);
    assert(!file.startsWith('apps/'), `Runtime source forbidden: ${file}`);
    assert(!file.startsWith('packages/'), `package source forbidden: ${file}`);
    assert(!file.startsWith('migrations/'), `migration forbidden: ${file}`);
    assert(file !== 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json', 'Registry delta forbidden');
    assert(!/GEOX-MCFT-CAP-08-S[1-6]-DELIVERY-STATUS-V1\.json$/.test(file), 'delivery status mutation forbidden');
    assert(file !== 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md', 'taskbook byte mutation forbidden');
  }

  const frontier = json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json');
  const pointer = json('docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json');
  const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json');
  const registry = json('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');
  const s4Status = json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-DELIVERY-STATUS-V1.json');
  const s5Status = json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json');
  const s6Status = json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json');
  const master = read('docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md');
  const implementationMap = read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md');

  const expectedBase = '75fc9c509d455c12202ae6c5597f7185796ec3d6';
  const expectedS4Subject = 'bda9d37519ca536d3d83d68cb3a2d4b395ff2ee9';
  const expectedS4Candidate = 'a8c8abccbe2ab25dad5f0fa4a9653269f6c4acc4';
  const expectedS4Tree = '4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a';
  const expectedS4Digest = 'sha256:c3ba7d058898ed073dbc907a1a0d957903c312c955be45300cb6f62e49ea7338';

  assert(frontier.repository_main_at_reconciliation === expectedBase, 'frontier base mismatch');
  assert(frontier.current_effective_slice_id === 'MCFT-CAP-08.S4', 'effective Slice mismatch');
  assert(frontier.current_effective_status === 'S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE', 'effective status mismatch');
  assert(frontier.next_authorized_slice_id === 'MCFT-CAP-08.S5', 'next Slice mismatch');
  assert(frontier.s5_implementation_authorized === true, 'S5 implementation authority missing');
  assert(frontier.s5_candidate_implemented === false && frontier.s5_effective === false, 'S5 must remain not implemented/effective');
  assert(frontier.s6_implementation_authorized === false, 'S6 must remain unauthorized');
  assert(frontier.residual_calibration_shadow_authorized === false, 'S5 capability projected effective early');
  assert(frontier.model_activation_authorized === false, 'Model Activation must remain false');
  assert(frontier.production_runtime_source_authorized === false, 'production Runtime source must remain false');
  assert(frontier.mcft_cap_09_authorized === false, 'CAP-09 must remain false');
  assert(frontier.candidate_declaration_present === false, 'reconciliation must remain non-candidate');
  assert(frontier.runtime_source_delta === 0 && frontier.canonical_runtime_data_delta === 0 && frontier.database_acl_delta === 0, 'zero-delta contract violated');

  const s4 = frontier.effective_slices.find((entry) => entry.slice_id === 'MCFT-CAP-08.S4');
  assert(s4, 'S4 evidence missing');
  assert(s4.subject_sha === expectedS4Subject, 'S4 subject mismatch');
  assert(s4.candidate_head_sha === expectedS4Candidate, 'S4 candidate mismatch');
  assert(s4.candidate_tree_sha === expectedS4Tree && s4.merge_tree_sha === expectedS4Tree, 'S4 tree mismatch');
  assert(s4.candidate_to_merge_tree_delta === 0, 'S4 tree delta must be zero');
  assert(s4.workflow_run_id === 30154846799 && s4.artifact_id === 8618701918, 'S4 workflow/artifact mismatch');
  assert(s4.semantic_artifact_digest === expectedS4Digest, 'S4 semantic digest mismatch');
  assert(s4.immutable_readback_verified === true, 'S4 immutable readback missing');

  assert(s4Status.s4_candidate_implemented === true, 'S4 candidate state missing');
  assert(s4Status.effective_status_when_attested === frontier.current_effective_status, 'S4 projection mismatch');
  assert(s5Status.s5_candidate_implemented === false, 'S5 seed must remain false');
  assert(s6Status.s6_candidate_implemented === false, 'S6 seed must remain false');
  assert(s6Status.independent_review_required === true, 'S6 review requirement missing');
  assert(s6Status.mcft_cap_09_authorized === false, 'S6 must not authorize CAP-09');

  const cap08 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
  assert(cap08, 'CAP-08 Registry entry missing');
  const hasRule = (statusFile, fieldPath) => cap08.candidate_transition_fields.some(
    (entry) => entry.status_file === statusFile
      && entry.field_path === fieldPath
      && entry.allowed_candidate_values.includes(true),
  );
  assert(hasRule('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json', 's5_candidate_implemented'), 'S5 Registry rule missing');
  assert(hasRule('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json', 's6_candidate_implemented'), 'S6 Registry rule missing');
  assert(cap08.mcft_cap_09_authorized === false, 'Registry must not authorize CAP-09');

  assert(pointer.settlement_subject_main === expectedBase, 'SSOT base mismatch');
  assert(pointer.current_authority.cap_08_current_frontier.endsWith('GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json'), 'frontier pointer missing');
  assert(pointer.cap_08_current_frontier_projection.current_effective_slice_id === frontier.current_effective_slice_id, 'SSOT effective Slice mismatch');
  assert(pointer.cap_08_current_frontier_projection.next_authorized_slice_id === frontier.next_authorized_slice_id, 'SSOT next Slice mismatch');
  assert(pointer.candidate_transition === false && pointer.mcft_cap_09_authorized === false, 'SSOT nonclaim mismatch');

  const cap08Matrix = matrix.capability_lines.find((entry) => entry.capability_line_id === 'MCFT-CAP-08');
  assert(cap08Matrix?.effective_slice_id === frontier.current_effective_slice_id, 'matrix effective Slice mismatch');
  assert(cap08Matrix?.next_authorized_slice_id === frontier.next_authorized_slice_id, 'matrix next Slice mismatch');
  assert(matrix.current_frontier.effective_slice_id === frontier.current_effective_slice_id, 'matrix frontier mismatch');
  assert(matrix.current_frontier.candidate_implemented === false, 'matrix must not claim S5 candidate');

  for (const text of [master, implementationMap]) {
    assert(text.includes('MCFT-CAP-08.S4'), 'S4 frontier missing from navigation document');
    assert(text.includes('MCFT-CAP-08.S5'), 'S5 next Slice missing from navigation document');
    assert(text.includes(expectedS4Subject), 'S4 subject missing from navigation document');
    assert(text.includes('v0.3.9'), 'taskbook version missing from navigation document');
  }

  const result = {
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    change_class: 'NON_CANDIDATE_CURRENT_FRONTIER_RECONCILIATION',
    base_sha: baseSha,
    head_sha: headSha,
    changed_files: changedFiles,
    effective_slice_id: frontier.current_effective_slice_id,
    effective_status: frontier.current_effective_status,
    next_authorized_slice_id: frontier.next_authorized_slice_id,
    s4_subject_sha: s4.subject_sha,
    s4_workflow_run_id: s4.workflow_run_id,
    s4_artifact_id: s4.artifact_id,
    s4_semantic_artifact_digest: s4.semantic_artifact_digest,
    s5_seed_and_rule_present: true,
    s5_candidate_implemented: false,
    s6_seed_and_rule_present: true,
    s6_implementation_authorized: false,
    candidate_declaration: false,
    runtime_source_delta: 0,
    registry_delta: 0,
    delivery_status_delta: 0,
    taskbook_byte_delta: 0,
    canonical_runtime_data_delta: 0,
    database_acl_delta: 0,
    model_activation_authorized: false,
    production_runtime_source_authorized: false,
    mcft_cap_09_authorized: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    status: 'FAIL',
    capability_line_id: 'MCFT-CAP-08',
    change_class: 'NON_CANDIDATE_CURRENT_FRONTIER_RECONCILIATION',
    base_sha: baseSha || null,
    head_sha: headSha,
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
