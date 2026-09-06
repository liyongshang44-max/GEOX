#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PRSEC1_BASE = 'bcc78fb00e73292362f237a95db3441e07389f6f';
const BLINE_ACCEPTED = '413386acc04fa2d3404f09d2d1fa8702472e83f1';
const PROTECTED_MAIN = 'ca2a96d131bc1d3b2935e7b7460752bdbf79f9bd';
const EXPECTED_EXTERNAL_MERGE_BASE = '26c1383f7f45abb76c99e28ec3d06714e85d1b2c';
const FROZEN_INVENTORY_BLOB = '29794eab2c7ff4732a84dc410dd0b55fb4afff15';
const SHARED_MAIN_MIGRATION_ORDER_COMMIT = '32d574e488b1cf8811ab7df6716d42bda987143c';
const SHARED_MAIN_MIGRATION_ORDER_BLOB = 'dbf9a1f9cb77aa90981e017d2a2bea4599cc6011';

const GATE = 'scripts/governance_acceptance/ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1.cjs';
const INVENTORY = 'docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json';
const W6B2_GATE = 'scripts/governance_acceptance/ACCEPTANCE_BLINE_W6B2_COMMERCIAL_PRINCIPAL_ISOLATION_V1.cjs';
const DIST = 'apps/server/scripts/write_dist_entries.cjs';

const BLINE_AUTHORITY_ARTIFACTS = [
  INVENTORY,
  'docs/architecture/semantic_convergence/GEOX-BLINE-W2-CALLER-READ-WRITE-BOUNDARY-V1.json',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W3-DECISION-APPROVAL-AUTHORITY-V1.json',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W4-EXECUTION-DEVICE-RECEIPT-PROVENANCE-V1.json',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W5-LEGACY-RUNTIME-CONTAINMENT-V1.json',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W6A-EXACT-PREDECESSOR-SELECTION-V1.json',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W6B1-INTERNAL-TASK-ISSUER-PRINCIPAL-V1.json',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W6B2-COMMERCIAL-PRINCIPAL-ISOLATION-V1.json',
  W6B2_GATE
];

const PRODUCTION_AUTHORITY_ROOTS = [
  'apps/server/src',
  'apps/server/db/migrations',
  'apps/server/scripts/write_dist_entries.cjs',
  'apps/executor/src',
  'apps/telemetry-ingest/src',
  'apps/web/src/api',
  'scripts/loadfact.ts',
  'docker/runtime.Dockerfile',
  'docker-compose.commercial_v1.yml',
  'config/auth/security_acceptance_tokens.json',
  'docker/postgres/init'
];

function sh(args, opts = {}) {
  return cp.execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', ...opts }).trim();
}
function read(p) { return fs.readFileSync(p, 'utf8'); }
function show(ref, p) { return cp.execFileSync('git', ['show', `${ref}:${p}`], { encoding: 'utf8' }); }
function assert(c, m, d) { if (!c) throw new Error(m + (d === undefined ? '' : ': ' + JSON.stringify(d))); }
function lines(s) { return String(s || '').split(/\r?\n/).filter(Boolean).sort(); }
function blob(ref, p) {
  try { return sh(['rev-parse', `${ref}:${p}`]); }
  catch { return null; }
}
function assertAncestor(ancestor, descendant, label) {
  try { cp.execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' }); }
  catch { throw new Error(`${label}: ${ancestor} is not an ancestor of ${descendant}`); }
}
function diffNames(base, head, roots = PRODUCTION_AUTHORITY_ROOTS) {
  return lines(sh(['diff', '--name-only', base, head, '--', ...roots]));
}
function patch(base, head, p) {
  return cp.execFileSync('git', ['-c', 'core.quotepath=false', 'diff', '--unified=0', base, head, '--', p], { encoding: 'utf8' });
}
function collectInventorySourcePaths(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectInventorySourcePaths(item, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (typeof value.source_path === 'string' && value.source_path.trim()) out.add(value.source_path.trim());
  for (const child of Object.values(value)) collectInventorySourcePaths(child, out);
  return out;
}
function classifyCurrentMainOwner(p) {
  if (p === 'apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts') return 'ADR';
  if (p === 'apps/server/src/infra/migrations.ts') return 'SHARED_MAIN_INFRA';
  if (
    p.startsWith('apps/server/src/external_evidence/') ||
    p.startsWith('apps/server/src/domain/twin_runtime/') ||
    p.startsWith('apps/server/src/persistence/external_evidence/') ||
    p.startsWith('apps/server/src/persistence/twin_runtime/') ||
    p.startsWith('apps/server/src/runtime/twin_runtime/') ||
    /^apps\/server\/src\/runtime\/mcft_cap09_/i.test(p) ||
    /^apps\/server\/src\/infra\/mcft_cap09_/i.test(p) ||
    p === 'apps/server/src/infra/migrations.ts' ||
    (/^apps\/server\/db\/migrations\//.test(p) && /mcft[_-]?cap[_-]?09/i.test(p)) ||
    p === DIST
  ) return 'MCFT';
  return 'UNKNOWN';
}
function assertExternalOwnershipEvidence(owner, p, deltaPatch) {
  if (owner === 'ADR') {
    assert(p === 'apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts', 'ADR ownership path drift', p);
    const text = show(PROTECTED_MAIN, p);
    for (const marker of [
      'READ_ONLY_SELECT',
      'recommendation_write_authorized: false',
      'approval_authorized: false',
      'operation_plan_or_task_creation_authorized: false',
      'dispatch_authorized: false',
      'machine_execution_authorized: false'
    ]) assert(text.includes(marker), 'ADR read-only authority marker missing', { p, marker });
    return;
  }
  if (owner === 'SHARED_MAIN_INFRA') {
    assert(p === 'apps/server/src/infra/migrations.ts', 'shared current-main infrastructure path drift', p);
    assertAncestor(SHARED_MAIN_MIGRATION_ORDER_COMMIT, PROTECTED_MAIN, 'shared migration ordering provenance');
    assert(blob(PROTECTED_MAIN, p) === SHARED_MAIN_MIGRATION_ORDER_BLOB, 'shared migration ordering protected-main blob drift');
    const pathCommits = lines(sh(['log', '--format=%H', `${EXPECTED_EXTERNAL_MERGE_BASE}..${PROTECTED_MAIN}`, '--', p]));
    assert(JSON.stringify(pathCommits) === JSON.stringify([SHARED_MAIN_MIGRATION_ORDER_COMMIT]), 'shared migration ordering provenance commit drift', pathCommits);
    const provenanceCommitPaths = lines(sh(['diff-tree', '--no-commit-id', '--name-only', '-r', SHARED_MAIN_MIGRATION_ORDER_COMMIT]));
    assert(JSON.stringify(provenanceCommitPaths) === JSON.stringify([p]), 'shared migration ordering provenance commit is not single-path', provenanceCommitPaths);
    for (const marker of [
      'schema/data migrations must precede ACL grants',
      'const aclA = /_acl\\.sql$/i.test(a) ? 1 : 0;',
      'const aclB = /_acl\\.sql$/i.test(b) ? 1 : 0;',
      'if (aclA !== aclB) return aclA - aclB;'
    ]) assert(deltaPatch.includes(marker), 'shared migration ordering provenance marker missing', marker);
    return;
  }
  if (owner === 'MCFT') {
    const ownershipEvidence = `${p}\n${deltaPatch}`;
    assert(/mcft|external_evidence|twin_runtime|cap08|biological_stage|external_formal/i.test(ownershipEvidence), 'MCFT ownership evidence missing', p);
    if (p === DIST) {
      assert(/mcft/i.test(deltaPatch), 'shared dist current-main delta lacks MCFT evidence');
      assert(!/^\+.*bline/im.test(deltaPatch), 'current-main side of shared dist seam unexpectedly contains B-Line entry');
    }
    return;
  }
  throw new Error(`UNKNOWN external ownership: ${p}`);
}
function extractBlineDistEntry(text) {
  const startMarker = '  {\n    name: path.join("database", "bline_commercial_principal_bootstrap.js"),';
  const start = text.indexOf(startMarker);
  assert(start >= 0, 'accepted B-Line dist bootstrap entry missing');
  const endMarker = '\n  },';
  const end = text.indexOf(endMarker, start);
  assert(end >= 0, 'accepted B-Line dist bootstrap entry is unterminated');
  return text.slice(start, end + endMarker.length);
}
function runHistoricalGate(ref, gatePath, prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    cp.execFileSync('git', ['worktree', 'add', '--detach', tmp, ref], { stdio: 'ignore' });
    const replayNodePath = [path.join(process.cwd(), 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    cp.execFileSync(process.execPath, [gatePath], {
      cwd: tmp,
      stdio: 'inherit',
      env: { ...process.env, NODE_PATH: replayNodePath }
    });
  } finally {
    try { cp.execFileSync('git', ['worktree', 'remove', '--force', tmp], { stdio: 'ignore' }); } catch {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

const head = sh(['rev-parse', 'HEAD']);
assert(head !== PRSEC1_BASE, 'successor governance gate must not replace historical PR-SEC-1 execution');
assertAncestor(PRSEC1_BASE, BLINE_ACCEPTED, 'accepted B-Line lineage');
assertAncestor(BLINE_ACCEPTED, head, 'candidate accepted B-Line lineage');
assertAncestor(PROTECTED_MAIN, head, 'candidate protected-main lineage');

// Layer A — frozen PR-SEC-1 remains immutable and the original machine scanner
// is executed at its exact historical predecessor, never against the successor.
assert(blob(PRSEC1_BASE, INVENTORY) === FROZEN_INVENTORY_BLOB, 'historical frozen inventory blob drift');
assert(blob('HEAD', INVENTORY) === FROZEN_INVENTORY_BLOB, 'candidate frozen inventory blob drift');
assert(read(INVENTORY) === show(PRSEC1_BASE, INVENTORY), 'frozen PR-SEC-1 inventory byte drift');
const inventory = JSON.parse(read(INVENTORY));
const inventoriedSourcePaths = [...collectInventorySourcePaths(inventory)].sort();
assert(inventoriedSourcePaths.length > 0, 'frozen inventory contains no source_path authority');
runHistoricalGate(PRSEC1_BASE, GATE, 'geox-prsec1-replay-');

// Layer B — candidate must preserve the accepted B-Line authority artifacts and
// every historically inventoried source exactly as accepted at 413386..., while
// W6-B2's own exact accepted machine gate is replayed at that accepted head.
for (const p of BLINE_AUTHORITY_ARTIFACTS) {
  const acceptedBlob = blob(BLINE_ACCEPTED, p);
  const candidateBlob = blob('HEAD', p);
  assert(acceptedBlob, 'accepted B-Line authority file missing', p);
  assert(candidateBlob === acceptedBlob, 'accepted B-Line authority artifact drift', { p, acceptedBlob, candidateBlob });
}
for (const p of inventoriedSourcePaths) {
  const acceptedBlob = blob(BLINE_ACCEPTED, p);
  const candidateBlob = blob('HEAD', p);
  assert(acceptedBlob, 'accepted B-Line reference deleted historical inventoried surface', p);
  // The shared dist manifest is reconciled below as exact protected-main bytes
  // plus the frozen accepted B-Line bootstrap entry. Requiring whole-file B-Line
  // identity here would reject that already-adjudicated additive seam before its
  // stricter composite-byte proof can run.
  if (p === DIST) continue;
  assert(candidateBlob === acceptedBlob, 'historically inventoried caller surface changed after accepted B-Line reference', { p, acceptedBlob, candidateBlob });
}
runHistoricalGate(BLINE_ACCEPTED, W6B2_GATE, 'geox-w6b2-accepted-replay-');

// Layer C — classify the current protected-main production/runtime delta by
// actual ownership. This is not a path ignore: every changed production path
// must classify as MCFT or ADR, must not overlap a frozen B-Line caller surface,
// and the integration candidate must carry the current-main blob unchanged
// (except the separately adjudicated additive shared packaging seam).
const externalMergeBase = sh(['merge-base', PRSEC1_BASE, PROTECTED_MAIN]);
assert(externalMergeBase === EXPECTED_EXTERNAL_MERGE_BASE, 'current-main external ownership merge-base drift', externalMergeBase);
const currentMainExternalDelta = diffNames(externalMergeBase, PROTECTED_MAIN);
const currentMainOwnership = { MCFT: [], ADR: [], SHARED_MAIN_INFRA: [], BLINE: [], UNKNOWN: [] };
const externalSet = new Set();
for (const p of currentMainExternalDelta) {
  const owner = classifyCurrentMainOwner(p);
  currentMainOwnership[owner].push(p);
  if (owner === 'UNKNOWN') continue;
  externalSet.add(p);
  // DIST is the one adjudicated cross-lineage packaging seam. Its MCFT delta
  // and exact additive B-Line realization are proven independently below.
  if (p !== DIST) {
    assert(!inventoriedSourcePaths.includes(p), 'current-main external delta intersects frozen B-Line caller surface without adjudication', p);
  }
  assertExternalOwnershipEvidence(owner, p, patch(externalMergeBase, PROTECTED_MAIN, p));
  if (p !== DIST) {
    assert(blob('HEAD', p) === blob(PROTECTED_MAIN, p), `${owner} current-main source modified by integration candidate`, p);
  }
}
assert(currentMainOwnership.UNKNOWN.length === 0, 'UNKNOWN current-main production ownership', currentMainOwnership.UNKNOWN);

// Layer D — classify every product/runtime/config delta from exact protected main
// to this candidate. A B-Line-owned change is admissible only when the candidate
// blob is exactly the accepted 413386... blob. External-owned files remain exact
// current-main bytes. Anything else fails closed as unadjudicated caller authority.
const candidateDelta = diffNames(PROTECTED_MAIN, head);
const acceptedBlineRealization = [];
const unadjudicatedCallerAuthorityDelta = [];
const unknownOwnership = [];

const acceptedDist = show(BLINE_ACCEPTED, DIST);
const protectedMainDist = show(PROTECTED_MAIN, DIST);
const currentDist = read(DIST);
const blineDistEntry = extractBlineDistEntry(acceptedDist);
const closeMarker = '\n];';
assert(protectedMainDist.includes(closeMarker), 'protected-main dist entries closing marker missing');
const expectedDist = protectedMainDist.replace(closeMarker, `\n${blineDistEntry}${closeMarker}`);
assert(currentDist === expectedDist, 'shared dist packaging seam is not exact protected-main plus frozen B-Line bootstrap entry');

for (const p of candidateDelta) {
  if (p === DIST) {
    acceptedBlineRealization.push(p);
    continue;
  }
  if (externalSet.has(p)) {
    const mainBlob = blob(PROTECTED_MAIN, p);
    const candidateBlob = blob('HEAD', p);
    if (candidateBlob !== mainBlob) unadjudicatedCallerAuthorityDelta.push(p);
    continue;
  }
  const acceptedBlob = blob(BLINE_ACCEPTED, p);
  const candidateBlob = blob('HEAD', p);
  if (acceptedBlob && candidateBlob === acceptedBlob) {
    acceptedBlineRealization.push(p);
  } else {
    unknownOwnership.push(p);
    unadjudicatedCallerAuthorityDelta.push(p);
  }
}
assert(unadjudicatedCallerAuthorityDelta.length === 0, 'unadjudicated caller-authority production delta', unadjudicatedCallerAuthorityDelta);
assert(unknownOwnership.length === 0, 'UNKNOWN integration candidate production ownership', unknownOwnership);

console.log(JSON.stringify({
  result: 'PASS',
  suite: 'ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1_SUCCESSOR_GOVERNANCE_RECONCILIATION',
  work_package: 'BLINE-CALLER-INVENTORY-GOV-RECON-01',
  prsec1_base: PRSEC1_BASE,
  protected_main: PROTECTED_MAIN,
  accepted_bline_reference: BLINE_ACCEPTED,
  successor_head: head,
  FROZEN_PR_SEC_1_REPLAY: 'PASS',
  FROZEN_INVENTORY_UNCHANGED: true,
  ACCEPTED_BLINE_SUCCESSOR_CHAIN_PRESERVED: true,
  CURRENT_MAIN_EXTERNAL_DELTA_CLASSIFIED: true,
  BLINE_CALLER_AUTHORITY_DELTA: [],
  UNADJUDICATED_CALLER_AUTHORITY_DELTA: [],
  UNKNOWN_OWNERSHIP: [],
  MCFT_SEMANTIC_MODIFICATION: 0,
  ADR_SEMANTIC_MODIFICATION: 0,
  historical_inventory_blob: FROZEN_INVENTORY_BLOB,
  inventoried_source_count: inventoriedSourcePaths.length,
  current_main_external_merge_base: externalMergeBase,
  current_main_external_ownership: currentMainOwnership,
  accepted_bline_realization_paths: acceptedBlineRealization.sort(),
  shared_packaging_seam: 'EXACT_PROTECTED_MAIN_PLUS_FROZEN_BLINE_BOOTSTRAP_ENTRY',
  historical_prsec1_machine_gate_replayed: true,
  accepted_w6b2_machine_gate_replayed: true
}, null, 2));
