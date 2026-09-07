#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PRSEC1_BASE = 'bcc78fb00e73292362f237a95db3441e07389f6f';
const BLINE_ACCEPTED = '413386acc04fa2d3404f09d2d1fa8702472e83f1';
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
const QCP = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
const QCP_PLANNER = 'scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs';
const ADR_LINEAGE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PROTECTED-MAIN-LINEAGE-ADVANCEMENT-E1F8-TO-F41D-V1.json';
const FORCING_CONTRACT = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_V13_FORCING_CONTROLLER_CONTRACT.ts';
const FORCING_WORKFLOW = '.github/workflows/mcft-cap-09-v13-forcing-controller-contract.yml';
const GOVERNANCE_SETTLEMENT_PATHS = [GATE,
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_V1.cjs',
  'docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json'
].sort();

function validateTopology(parents, refs, checkedOutHead) {
  assert(parents.length === 2, 'PR synthetic merge must have exactly two parents');
  assert(parents[0] === refs.main, 'protected main drift from synthetic parent 1');
  assert(parents[1] === refs.candidate, 'candidate drift from synthetic parent 2');
  assert(checkedOutHead === refs.candidate || checkedOutHead === refs.merge || refs.boundedLocalSuccessor,
    'checkout is not the verified PR subject');
  return { protectedMain: parents[0], candidate: parents[1], merge: refs.merge };
}
function verifiedPrTopology(checkedOutHead) {
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(read(process.env.GITHUB_EVENT_PATH)) : {};
  const pr = String(event.number || process.env.BLINE_PR_NUMBER ||
    (process.env.GITHUB_REF || '').match(/^refs\/pull\/(\d+)\//)?.[1] || '');
  assert(/^\d+$/.test(pr), 'verified PR context required; no static current-main fallback');
  const names = ['refs/heads/main', `refs/pull/${pr}/head`, `refs/pull/${pr}/merge`];
  function remoteRefs() {
    const rows = sh(['ls-remote', 'origin', ...names], { timeout: 30000 });
    const refs = Object.fromEntries(rows.split(/\r?\n/).filter(Boolean).map(row => {
      const [sha, name] = row.split(/\s+/); return [name, sha];
    }));
    for (const name of names) assert(/^[0-9a-f]{40}$/.test(refs[name] || ''), 'remote PR topology ref missing', name);
    return { main: refs[names[0]], candidate: refs[names[1]], merge: refs[names[2]] };
  }
  const refs = remoteRefs();
  try { sh(['cat-file', '-e', refs.merge + '^{commit}']); }
  catch { sh(['fetch', '--no-tags', 'origin', names[2]], { timeout: 30000 }); }
  const parents = sh(['show', '-s', '--format=%P', refs.merge]).split(' ');
  // Permit the single unpublished governance successor for bounded preflight.
  // Its main authority still comes exclusively from the live PR merge parents.
  // This does not qualify that successor as a final integrated PR merge.
  if (checkedOutHead !== refs.candidate && checkedOutHead !== refs.merge) {
    assert(sh(['show', '-s', '--format=%P', checkedOutHead]) === refs.candidate,
      'unpublished successor must be one commit directly on verified PR candidate');
    assert(JSON.stringify(diffNames(refs.candidate, checkedOutHead, [])) === JSON.stringify(GOVERNANCE_SETTLEMENT_PATHS),
      'unpublished successor must contain exactly the three governance paths');
    refs.boundedLocalSuccessor = true;
  }
  const result = validateTopology(parents, refs, checkedOutHead);
  const after = remoteRefs();
  for (const key of ['main', 'candidate', 'merge']) assert(after[key] === refs[key], 'remote topology drift during verification', key);
  return { ...result, pr: Number(pr), bounded_local_successor: Boolean(refs.boundedLocalSuccessor) };
}

function exactCandidateObject(p) {
  const candidateBlob = blob(head, p);
  assert(candidateBlob, 'exact candidate evidence object absent', p);
  assert(read(p) === show(head, p), 'working evidence differs from exact candidate object', p);
  return candidateBlob;
}
function governedEvidenceObject(p) {
  const evidenceBlob = exactCandidateObject(p);
  assert(evidenceBlob === blob(PROTECTED_MAIN, p), 'owner evidence not carried from exact protected main', p);
  return evidenceBlob;
}
function exactMcftEvidence() {
  const qcpBlob = governedEvidenceObject(QCP);
  governedEvidenceObject(QCP_PLANNER);
  const qcp = JSON.parse(show(head, QCP));
  assert(qcp.path_semantics === 'EXACT_PATH_OR_GENERATED_DEPENDENCY_CLOSURE_ONLY', 'QCP path semantics drift');
  const planner = require(path.resolve(QCP_PLANNER));
  const evidence = new Map();
  function add(paths, resolver, kind, evidencePath = QCP, evidenceBlob = qcpBlob) {
    for (const p of paths) {
      exactCandidateObject(p);
      if (!evidence.has(p)) evidence.set(p, { owner: 'MCFT', owner_evidence_type: kind,
        owner_evidence_ref: head, owner_evidence_path: evidencePath, owner_evidence_blob: evidenceBlob,
        resolver, exact_path_membership: true });
    }
  }
  for (const [id, spec] of Object.entries(qcp.dependency_resolvers)) {
    if (spec.kind === 'EXACT_PATH_SET') add(spec.paths || [], id, 'EXACT_PATH_SET');
    else if (spec.kind === 'IMPORT_CLOSURE') {
      add(spec.additional_exact_paths || [], id, 'EXACT_PATH_SET');
      const closure = planner.buildImportClosure(process.cwd(), spec.roots || []);
      // An incomplete closure cannot establish generated dependency ownership.
      if (!closure.missing.length) add(closure.paths, id, 'IMPORT_CLOSURE');
    } else assert(spec.kind === 'GENERATED_GRAPH_OUTPUT', 'UNKNOWN QCP resolver kind', spec.kind);
  }
  // Independent exact machine-acceptance object, selected by its governed workflow.
  const contractBlob = governedEvidenceObject(FORCING_CONTRACT);
  governedEvidenceObject(FORCING_WORKFLOW);
  const workflow = show(head, FORCING_WORKFLOW);
  assert(workflow.includes('run: pnpm exec tsx ' + FORCING_CONTRACT), 'forcing contract is not workflow-selected');
  const closure = planner.buildImportClosure(process.cwd(), [FORCING_CONTRACT]);
  assert(closure.missing.length === 0, 'forcing contract import closure incomplete', closure.missing);
  // Workflow membership is exact, never a filename/owner token inference.
  const selected = new Set([...workflow.matchAll(/^\s+- ['"]([^'"*]+)['"]\s*$/gm)].map(m => m[1]));
  add(closure.paths.filter(p => selected.has(p)), 'FORCING_CONTROLLER_CONTRACT',
    'EXACT_MACHINE_ACCEPTANCE_OBJECT_IMPORT', FORCING_CONTRACT, contractBlob);
  return evidence;
}
function classifyCurrentMainOwner(p) {
  if (p === DIST) return 'SHARED_PACKAGING';
  if (p === 'apps/server/src/infra/migrations.ts') return 'SHARED_MAIN_INFRA';
  if (p === 'apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts') return 'ADR';
  return mcftOwnerEvidence.has(p) ? 'MCFT' : 'UNKNOWN';
}
function assertExternalOwnershipEvidence(owner, p, deltaPatch) {
  if (owner === 'ADR') {
    assert(p === 'apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts', 'ADR ownership path drift', p);
    governedEvidenceObject(ADR_LINEAGE);
    const authority = JSON.parse(show(head, ADR_LINEAGE));
    assert(authority.status === 'PASS' && authority.external_owner === 'ADR' && authority.changed_paths.includes(p), 'exact ADR path evidence missing', p);
    assertAncestor(authority.current_protected_main, PROTECTED_MAIN, 'ADR historical adjudication lineage');
    assert(blob(authority.current_protected_main, p) === blob(PROTECTED_MAIN, p), 'ADR adjudicated postimage drift', p);
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
  if (owner === 'SHARED_PACKAGING') {
    assert(p === DIST, 'shared packaging path drift');
    // Exact composite adjudication is mandatory in Layer D below.
    return;
  }
  if (owner === 'MCFT') {
    assert(mcftOwnerEvidence.has(p), 'exact MCFT owner evidence missing', p);
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
const topology = verifiedPrTopology(head);
const PROTECTED_MAIN = topology.protectedMain;
const mcftOwnerEvidence = exactMcftEvidence();
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
const currentMainOwnership = { MCFT: [], ADR: [], SHARED_MAIN_INFRA: [], SHARED_PACKAGING: [], BLINE: [], UNKNOWN: [] };
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
  verified_pr_synthetic_topology: topology,
  UNKNOWN_CURRENT_MAIN_OWNER: currentMainOwnership.UNKNOWN,
  exact_mcft_owner_manifest: currentMainOwnership.MCFT.map(p => ({ path: p, protected_main_blob: blob(PROTECTED_MAIN, p), candidate_blob: blob(head, p), ...mcftOwnerEvidence.get(p) })),
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
