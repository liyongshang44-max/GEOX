#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const QCP_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
const REGISTRY_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json';
const REGISTRATION_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-SUCCESSOR-VERIFIED-DELIVERY-REGISTRATION-V1.json';
const ACCEPTANCE_REF = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_VERIFIED_DELIVERY_REGISTRATION_V1.cjs';
const ACCEPTANCE = path.join(ROOT, ACCEPTANCE_REF);
const EXPECTED_QCP_BLOB = '63a04286600a03463b22bb066ca88c1860b2d9d5';
const EXPECTED_REGISTRY_BLOB = '626d5c277b7f8fbd194d3c0849a9337082d6e2b5';
const EXPECTED_FROZEN_SUBJECT = '3bbf096ee5cb73e8e0e0251dc400733d6cab501f';

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QCP_VERIFIED_DELIVERY_REGISTRAR_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  if (!out.apply) throw new Error('QCP_VERIFIED_DELIVERY_REGISTRAR_APPLY_REQUIRED');
  if (!out['delivery-dir'] || !out['run-dir']) throw new Error('QCP_VERIFIED_DELIVERY_REGISTRAR_DELIVERY_AND_RUN_DIR_REQUIRED');
  return out;
}

function runAcceptance(extraArgs) {
  const r = spawnSync(process.execPath, [ACCEPTANCE, ...extraArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`QCP_VERIFIED_DELIVERY_REGISTRAR_ACCEPTANCE_FAILED:${r.status}:${String(r.stderr || r.stdout || '').trim()}`);
  return JSON.parse(r.stdout);
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assert.equal(git('status', '--porcelain'), '', 'QCP_VERIFIED_DELIVERY_REGISTRAR_CLEAN_WORKTREE_REQUIRED');
  assert.equal(git('rev-parse', `HEAD:${QCP_REF}`), EXPECTED_QCP_BLOB, 'QCP_VERIFIED_DELIVERY_REGISTRAR_QCP_BASE_BLOB_DRIFT');
  assert.equal(git('rev-parse', `HEAD:${REGISTRY_REF}`), EXPECTED_REGISTRY_BLOB, 'QCP_VERIFIED_DELIVERY_REGISTRAR_REGISTRY_BLOB_DRIFT');

  const pre = runAcceptance([
    '--require-qcp-unregistered',
    '--delivery-dir', args['delivery-dir'],
    '--run-dir', args['run-dir'],
  ]);
  assert.equal(pre.status, 'PASS', 'QCP_VERIFIED_DELIVERY_REGISTRAR_PRE_ACCEPTANCE_REQUIRED');
  assert.equal(pre.local_delivery_reverified, true, 'QCP_VERIFIED_DELIVERY_REGISTRAR_LOCAL_REVERIFY_REQUIRED');
  assert.equal(pre.qcp_central_ownership_registered, false, 'QCP_VERIFIED_DELIVERY_REGISTRAR_PREMATURE_REGISTRATION_FORBIDDEN');

  const qcpPath = path.join(ROOT, QCP_REF);
  const raw = fs.readFileSync(qcpPath, 'utf8');
  const qcp = JSON.parse(raw);
  assert.equal(canonical(qcp), raw, 'QCP_VERIFIED_DELIVERY_REGISTRAR_QCP_MUST_BE_CANONICAL_JSON');
  assert.equal(qcp.authority_id, 'MCFT_CAP09_CHECK_APPLICABILITY_V1', 'QCP_VERIFIED_DELIVERY_REGISTRAR_QCP_AUTHORITY_REQUIRED');
  assert.equal(qcp.frozen_successor_subject_sha, EXPECTED_FROZEN_SUBJECT, 'QCP_VERIFIED_DELIVERY_REGISTRAR_FROZEN_SUBJECT_DRIFT');

  const control = qcp.dependency_resolvers?.CONTROL_PLANE_FILES;
  assert.equal(control?.kind, 'EXACT_PATH_SET', 'QCP_VERIFIED_DELIVERY_REGISTRAR_CONTROL_PLANE_RESOLVER_REQUIRED');
  assert(Array.isArray(control.paths), 'QCP_VERIFIED_DELIVERY_REGISTRAR_CONTROL_PLANE_PATHS_REQUIRED');
  const beforeCount = control.paths.length;
  assert.equal(new Set(control.paths).size, beforeCount, 'QCP_VERIFIED_DELIVERY_REGISTRAR_PREEXISTING_DUPLICATES_FORBIDDEN');
  assert.equal(control.paths.includes(REGISTRATION_REF), false, 'QCP_VERIFIED_DELIVERY_REGISTRAR_BASIS_ALREADY_PRESENT');
  assert.equal(control.paths.includes(ACCEPTANCE_REF), false, 'QCP_VERIFIED_DELIVERY_REGISTRAR_ACCEPTANCE_ALREADY_PRESENT');

  const v13Before = JSON.stringify(qcp.dependency_resolvers?.V13_QUALIFICATION_HARNESS_CLOSURE ?? null);
  const checksBefore = JSON.stringify(qcp.checks ?? qcp.check_definitions ?? qcp.qualification_checks ?? null);
  const topLevelBefore = { ...qcp, dependency_resolvers: { ...qcp.dependency_resolvers } };
  delete topLevelBefore.dependency_resolvers.CONTROL_PLANE_FILES;
  const topLevelBeforeJson = JSON.stringify(topLevelBefore);

  control.paths.push(REGISTRATION_REF, ACCEPTANCE_REF);
  assert.equal(control.paths.length, beforeCount + 2, 'QCP_VERIFIED_DELIVERY_REGISTRAR_POST_COUNT_INVALID');
  assert.equal(new Set(control.paths).size, beforeCount + 2, 'QCP_VERIFIED_DELIVERY_REGISTRAR_POST_DUPLICATES_FORBIDDEN');

  assert.equal(JSON.stringify(qcp.dependency_resolvers?.V13_QUALIFICATION_HARNESS_CLOSURE ?? null), v13Before, 'QCP_VERIFIED_DELIVERY_REGISTRAR_V13_RESOLVER_MUTATION_FORBIDDEN');
  assert.equal(JSON.stringify(qcp.checks ?? qcp.check_definitions ?? qcp.qualification_checks ?? null), checksBefore, 'QCP_VERIFIED_DELIVERY_REGISTRAR_CHECK_SEMANTICS_MUTATION_FORBIDDEN');
  const topLevelAfter = { ...qcp, dependency_resolvers: { ...qcp.dependency_resolvers } };
  delete topLevelAfter.dependency_resolvers.CONTROL_PLANE_FILES;
  assert.equal(JSON.stringify(topLevelAfter), topLevelBeforeJson, 'QCP_VERIFIED_DELIVERY_REGISTRAR_NON_CONTROL_PLANE_MUTATION_FORBIDDEN');

  fs.writeFileSync(qcpPath, canonical(qcp), 'utf8');

  const changed = git('diff', '--name-only').split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed, [QCP_REF], 'QCP_VERIFIED_DELIVERY_REGISTRAR_ONLY_QCP_FILE_MAY_CHANGE');
  execFileSync('git', ['diff', '--check'], { cwd: ROOT, stdio: 'inherit', windowsHide: true });

  const post = runAcceptance([
    '--require-qcp-registered',
    '--delivery-dir', args['delivery-dir'],
    '--run-dir', args['run-dir'],
  ]);
  assert.equal(post.status, 'PASS', 'QCP_VERIFIED_DELIVERY_REGISTRAR_POST_ACCEPTANCE_REQUIRED');
  assert.equal(post.local_delivery_reverified, true, 'QCP_VERIFIED_DELIVERY_REGISTRAR_POST_LOCAL_REVERIFY_REQUIRED');
  assert.equal(post.qcp_central_ownership_registered, true, 'QCP_VERIFIED_DELIVERY_REGISTRAR_QCP_OWNERSHIP_REQUIRED');
  assert.equal(post.qcp_frozen_successor_subject_unchanged, true, 'QCP_VERIFIED_DELIVERY_REGISTRAR_FROZEN_SUBJECT_GUARD_REQUIRED');
  assert.equal(post.legacy_registry_blob_unchanged, true, 'QCP_VERIFIED_DELIVERY_REGISTRAR_LEGACY_REGISTRY_GUARD_REQUIRED');
  assert.equal(post.v13_harness_dependency_set_modified, false, 'QCP_VERIFIED_DELIVERY_REGISTRAR_V13_RESOLVER_GUARD_REQUIRED');
  assert.equal(post.qcp_check_decision_semantics_modified, false, 'QCP_VERIFIED_DELIVERY_REGISTRAR_DECISION_GUARD_REQUIRED');

  process.stdout.write(`${JSON.stringify({
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_qcp_registration_patch_v1',
    status: 'PASS',
    qcp_ref: QCP_REF,
    qcp_pre_registration_blob_sha: EXPECTED_QCP_BLOB,
    registry_blob_sha: EXPECTED_REGISTRY_BLOB,
    frozen_successor_subject_sha: EXPECTED_FROZEN_SUBJECT,
    control_plane_paths_before: beforeCount,
    control_plane_paths_after: beforeCount + 2,
    added_paths: [REGISTRATION_REF, ACCEPTANCE_REF],
    local_delivery_reverified: true,
    legacy_registry_unchanged: true,
    v13_harness_dependency_set_modified: false,
    qcp_check_decision_semantics_modified: false,
    changed_files: changed,
    commit_performed: false,
    push_performed: false,
    closure_adjudication_performed: false,
    formal_v5_arm: false,
    a0: false,
    o00_o23: false
  }, null, 2)}\n`);
}

main();
