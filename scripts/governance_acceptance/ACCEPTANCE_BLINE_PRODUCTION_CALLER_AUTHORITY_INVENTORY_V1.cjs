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

const CLEAN_SETTLEMENT_BASE = '41c64e6b56bf78fac192d2aaf4333986c41b55f1';
const W4_GOV_SUCCESSOR = '6b98279a4d4e50b5b4957594a0aaebbf74d23984';
const W4_GOV_TREE = '405885ed8fefec2a13889508c085ccb169370668';
const CLEAN_PROVENANCE_MAIN = 'd19913c88b81b618507ff6da6fc4f3699123cdd6';
const SEALED_EVIDENCE = '459933bc4be0d8b9a5fbe7d330e579d74357ad1a';
const SEALED_TREE = '511a38a6eec77a8484a0e1d17f4f66afc40af4e3';

const W4_GATE =
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs';

const SEALED_SUCCESSOR_PRODUCTION_PATHS = [
  'apps/server/db/migrations/2026_09_08_bline_stage1_overview_preprovision_v1.sql',
  'apps/server/scripts/write_dist_entries.cjs',
  'apps/server/src/domain/controlplane/approval_execution_context_v1.ts',
  'apps/server/src/domain/controlplane/task_service.ts',
  'apps/server/src/infra/bline_stage1_schema_preprovision_v1.ts',
  'apps/server/src/routes/appleii_stage1_evidence_gate_v1.ts'
].sort();

const SEALED_INVENTORIED_SUCCESSOR_PATHS = [
  'apps/server/src/domain/controlplane/task_service.ts',
  'apps/server/src/routes/appleii_stage1_evidence_gate_v1.ts'
].sort();

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
function isAncestor(ancestor, descendant) {
  try {
    cp.execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
function commitParents(ref) {
  const row = sh(['rev-list', '--parents', '-n', '1', ref]).split(/\s+/);
  return row.slice(1);
}
function tree(ref) {
  return sh(['rev-parse', `${ref}^{tree}`]);
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

function optionalExpectedSha(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) return null;
  assert(/^[0-9a-f]{40}$/.test(value), `${name} must be an exact 40-hex object id`);
  return value;
}
function exactAuthoritySha(value, label) {
  const normalized = String(value || '').trim();
  assert(/^[0-9a-f]{40}$/.test(normalized), `${label} must be an exact 40-hex object id`);
  return normalized;
}
function verifiedPrTopology(checkedOutHead) {
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(read(process.env.GITHUB_EVENT_PATH)) : {};
  const pr = String(event.number || process.env.BLINE_PR_NUMBER ||
    (process.env.GITHUB_REF || '').match(/^refs\/pull\/(\d+)\//)?.[1] || '');
  assert(/^\d+$/.test(pr), 'verified PR context required; no static current-main fallback');

  const explicitMain = optionalExpectedSha('EXPECTED_MAIN_SHA');
  const explicitCandidate = optionalExpectedSha('EXPECTED_CANDIDATE_SHA');
  const explicitSynthetic = optionalExpectedSha('EXPECTED_SYNTHETIC_SHA');
  const expectedTree = optionalExpectedSha('EXPECTED_SYNTHETIC_TREE');

  const eventMain = String(event?.pull_request?.base?.sha || '').trim();
  const eventCandidate = String(event?.pull_request?.head?.sha || '').trim();
  const githubSynthetic = String(process.env.GITHUB_SHA || '').trim();

  const eventAuthorityAvailable =
    /^[0-9a-f]{40}$/.test(eventMain) &&
    /^[0-9a-f]{40}$/.test(eventCandidate) &&
    /^[0-9a-f]{40}$/.test(githubSynthetic);

  const explicitAuthorityAvailable =
    Boolean(explicitMain && explicitCandidate && explicitSynthetic);

  assert(
    eventAuthorityAvailable || explicitAuthorityAvailable,
    'verified PR authority inputs required from pull_request event or complete EXPECTED_* contract'
  );

  if (eventAuthorityAvailable) {
    if (explicitMain) {
      assert(explicitMain === eventMain, 'EXPECTED_MAIN_SHA disagrees with pull_request base SHA');
    }
    if (explicitCandidate) {
      assert(explicitCandidate === eventCandidate, 'EXPECTED_CANDIDATE_SHA disagrees with pull_request head SHA');
    }
    if (explicitSynthetic) {
      assert(explicitSynthetic === githubSynthetic, 'EXPECTED_SYNTHETIC_SHA disagrees with GITHUB_SHA');
    }
  }

  const expectedMain = explicitMain ||
    exactAuthoritySha(eventMain, 'pull_request base SHA');

  const expectedCandidate = explicitCandidate ||
    exactAuthoritySha(eventCandidate, 'pull_request head SHA');

  const expectedSynthetic = explicitSynthetic ||
    exactAuthoritySha(githubSynthetic, 'GITHUB_SHA');

  const authorityInputSource =
    eventAuthorityAvailable
      ? 'GITHUB_PULL_REQUEST_EVENT'
      : 'EXPLICIT_EXPECTED_ENV';
  const names = ['refs/heads/main', `refs/pull/${pr}/head`, `refs/pull/${pr}/merge`];

  function remoteRefs() {
    const rows = sh(['ls-remote', 'origin', ...names], { timeout: 30000 });
    const byName = Object.fromEntries(rows.split(/\r?\n/).filter(Boolean).map(row => {
      const [sha, name] = row.split(/\s+/); return [name, sha];
    }));
    for (const name of names.slice(0, 2)) {
      assert(/^[0-9a-f]{40}$/.test(byName[name] || ''), 'remote PR topology authority ref missing', name);
    }
    return {
      main: byName[names[0]],
      candidate: byName[names[1]],
      merge: /^[0-9a-f]{40}$/.test(byName[names[2]] || '') ? byName[names[2]] : null
    };
  }

  const refs = remoteRefs();
  assert(refs.main === expectedMain, 'protected main drift from expected authority', { expected: expectedMain, actual: refs.main });
  assert(refs.candidate === expectedCandidate, 'PR head drift from expected authority', { expected: expectedCandidate, actual: refs.candidate });
  assert(checkedOutHead === expectedSynthetic, 'checkout is not the authoritative synthetic subject', {
    expected: expectedSynthetic,
    actual: checkedOutHead
  });

  const parents = sh(['show', '-s', '--format=%P', checkedOutHead]).split(' ').filter(Boolean);
  assert(parents.length === 2, 'authoritative synthetic must have exactly two parents');
  assert(parents[0] === refs.main, 'protected main drift from synthetic parent 1');
  assert(parents[1] === refs.candidate, 'candidate drift from synthetic parent 2');

  const tree = sh(['rev-parse', `${checkedOutHead}^{tree}`]);
  if (expectedTree) {
    assert(
      tree === expectedTree,
      'authoritative synthetic tree drift',
      { expected: expectedTree, actual: tree }
    );
  }

  assert(
    refs.merge === checkedOutHead,
    'remote PR merge ref differs from authoritative synthetic subject',
    { remote: refs.merge, checkedOutHead }
  );

  const mergeTreeInvocation = `git merge-tree --write-tree ${refs.main} ${refs.candidate}`;
  const computedMergeTree = sh(['merge-tree', '--write-tree', refs.main, refs.candidate], { timeout: 30000 })
    .split(/\r?\n/)[0].trim();
  assert(/^[0-9a-f]{40}$/.test(computedMergeTree), 'independent merge-tree did not return an exact tree');
  assert(computedMergeTree === tree, 'independent merge-tree differs from authoritative synthetic tree', {
    computed: computedMergeTree,
    actual: tree
  });

  const status = sh(['status', '--porcelain=v1', '--untracked-files=all']);
  assert(status === '', 'working tree is not clean', status);

  const after = remoteRefs();
  for (const key of ['main', 'candidate']) {
    assert(after[key] === refs[key], 'remote topology authority drift during verification', key);
  }

  return {
    authority_input_source: authorityInputSource,
    protectedMain: refs.main,
    candidate: refs.candidate,
    synthetic: checkedOutHead,
    tree,
    computed_merge_tree: computedMergeTree,
    merge_tree_invocation: mergeTreeInvocation,
    merge_tree_exit_status: 0,
    git_version: sh(['version']),
    remote_pr_merge_sha: refs.merge,
    remote_pr_merge_matches_authoritative_subject: refs.merge === checkedOutHead,
    remote_pr_merge_sha_after: after.merge,
    pr: Number(pr)
  };
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

function verifiedPushMainTopology(checkedOutHead) {
  assert(
    process.env.GITHUB_EVENT_PATH,
    'push-main execution requires GITHUB_EVENT_PATH'
  );

  const event = JSON.parse(
    read(process.env.GITHUB_EVENT_PATH)
  );

  const eventName =
    String(process.env.GITHUB_EVENT_NAME || '').trim();

  const githubRef =
    String(process.env.GITHUB_REF || '').trim();

  const eventRef =
    String(event.ref || '').trim();

  assert(
    eventName === 'push',
    'post-merge topology requires push event',
    eventName
  );

  assert(
    githubRef === 'refs/heads/main',
    'post-merge GITHUB_REF must be protected main',
    githubRef
  );

  assert(
    eventRef === 'refs/heads/main',
    'post-merge event ref must be protected main',
    eventRef
  );

  const before =
    exactAuthoritySha(
      event.before,
      'push before SHA'
    );

  const after =
    exactAuthoritySha(
      event.after,
      'push after SHA'
    );

  const githubSha =
    exactAuthoritySha(
      process.env.GITHUB_SHA,
      'GITHUB_SHA'
    );

  assert(
    checkedOutHead === after,
    'post-merge checkout differs from push event after SHA',
    { checkedOutHead, after }
  );

  assert(
    githubSha === after,
    'post-merge GITHUB_SHA differs from event after SHA',
    { githubSha, after }
  );

  assert(
    isAncestor(before, checkedOutHead),
    'push before SHA is not an ancestor of post-merge HEAD',
    { before, checkedOutHead }
  );

  function remoteMainSha() {
    const rows = sh(
      [
        'ls-remote',
        'origin',
        'refs/heads/main'
      ],
      { timeout: 30000 }
    );

    const row =
      rows
        .split(/\r?\n/)
        .filter(Boolean)[0] || '';

    const sha =
      row.split(/\s+/)[0] || '';

    assert(
      /^[0-9a-f]{40}$/.test(sha),
      'remote protected-main authority ref missing'
    );

    return sha;
  }

  const remoteMainBefore =
    remoteMainSha();

  assert(
    remoteMainBefore === after,
    'remote protected main differs from push event after SHA',
    { remoteMainBefore, after }
  );

  const parents =
    commitParents(checkedOutHead);

  const carrierKind =
    parents.length === 2 &&
    parents[0] === before
      ? 'POST_MERGE_TWO_PARENT'
      : 'POST_MERGE_FAST_FORWARD_DESCENDANT';

  assert(
    parents.length === 1 ||
    parents.length === 2,
    'post-merge main has unsupported parent cardinality',
    parents
  );

  if (parents.length === 2) {
    assert(
      parents[0] === before,
      'post-merge merge parent1 differs from push before SHA',
      { parents, before }
    );
  }

  const status =
    sh([
      'status',
      '--porcelain=v1',
      '--untracked-files=all'
    ]);

  assert(
    status === '',
    'post-merge main working tree is not clean',
    status
  );

  const remoteMainAfter =
    remoteMainSha();

  assert(
    remoteMainAfter === remoteMainBefore,
    'remote protected main drift during post-merge verification',
    {
      before: remoteMainBefore,
      after: remoteMainAfter
    }
  );

  return {
    authority_input_source:
      'GITHUB_PUSH_EVENT',

    protectedMain:
      before,

    candidate:
      checkedOutHead,

    merge:
      null,

    execution_context:
      'POST_MERGE_MAIN',

    carrier_kind:
      carrierKind,

    event_before:
      before,

    event_after:
      after,

    remote_main:
      remoteMainAfter
  };
}

function verifiedExecutionTopology(checkedOutHead) {
  const eventName =
    String(process.env.GITHUB_EVENT_NAME || '').trim();

  if (eventName === 'push') {
    return verifiedPushMainTopology(
      checkedOutHead
    );
  }

  const topology =
    verifiedPrTopology(
      checkedOutHead
    );

  return {
    ...topology,
    execution_context:
      'PULL_REQUEST',
    carrier_kind:
      'PR_SYNTHETIC'
  };
}

function findCallerGovernanceAnchor(ref) {
  const commits =
    lines(
      sh([
        'rev-list',
        '--ancestry-path',
        `${W4_GOV_SUCCESSOR}..${ref}`
      ])
    );

  const currentGateBlob =
    blob(ref, GATE);

  const matches = [];

  for (const commit of commits) {
    const parents =
      commitParents(commit);

    if (
      parents.length !== 1 ||
      parents[0] !== W4_GOV_SUCCESSOR
    ) {
      continue;
    }

    const drift =
      lines(
        sh([
          'diff',
          '--name-only',
          W4_GOV_SUCCESSOR,
          commit
        ])
      );

    if (
      JSON.stringify(drift) !==
      JSON.stringify([GATE])
    ) {
      continue;
    }

    if (
      blob(commit, GATE) !==
      currentGateBlob
    ) {
      continue;
    }

    matches.push(commit);
  }

  assert(
    matches.length === 1,
    'caller governance anchor identity drift',
    matches
  );

  return matches[0];
}

const head =
  sh(['rev-parse', 'HEAD']);

const topology =
  verifiedExecutionTopology(head);

const PROTECTED_MAIN =
  topology.protectedMain;

assert(
  head !== PRSEC1_BASE,
  'successor governance gate must not replace historical PR-SEC-1 execution'
);

assertAncestor(
  PRSEC1_BASE,
  BLINE_ACCEPTED,
  'accepted B-Line lineage'
);

const historicalLineage =
  isAncestor(BLINE_ACCEPTED, head) &&
  isAncestor(PROTECTED_MAIN, head);

let qualificationMode =
  'HISTORICAL_SUCCESSOR';

let cleanCandidateGovernanceDrift =
  [];

let callerGovernanceAnchor =
  null;

let callerGovernanceAnchorAdopted =
  false;

if (historicalLineage) {
  assertAncestor(
    BLINE_ACCEPTED,
    head,
    'candidate accepted B-Line lineage'
  );

  assertAncestor(
    PROTECTED_MAIN,
    head,
    'candidate protected-main lineage'
  );
} else {
  const cleanParents =
    commitParents(
      CLEAN_SETTLEMENT_BASE
    );

  assert(
    cleanParents.length === 1 &&
    cleanParents[0] === CLEAN_PROVENANCE_MAIN,
    'clean settlement provenance main drift',
    {
      cleanParents,
      expected:
        CLEAN_PROVENANCE_MAIN
    }
  );

  assert(
    tree(CLEAN_SETTLEMENT_BASE) ===
      SEALED_TREE,
    'clean settlement base tree differs from sealed tree'
  );

  assert(
    tree(SEALED_EVIDENCE) ===
      SEALED_TREE,
    'sealed evidence tree drift'
  );

  assert(
    sh([
      'diff',
      '--name-only',
      CLEAN_SETTLEMENT_BASE,
      SEALED_EVIDENCE
    ]) === '',
    'clean settlement base differs from sealed evidence'
  );

  const w4Parents =
    commitParents(
      W4_GOV_SUCCESSOR
    );

  assert(
    w4Parents.length === 1 &&
    w4Parents[0] === CLEAN_SETTLEMENT_BASE,
    'W4 governance successor topology drift',
    w4Parents
  );

  assert(
    tree(W4_GOV_SUCCESSOR) ===
      W4_GOV_TREE,
    'W4 governance successor tree drift'
  );

  const w4GovernanceDrift =
    lines(
      sh([
        'diff',
        '--name-only',
        CLEAN_SETTLEMENT_BASE,
        W4_GOV_SUCCESSOR
      ])
    );

  assert(
    JSON.stringify(w4GovernanceDrift) ===
      JSON.stringify([W4_GATE]),
    'W4 governance successor contains non-W4-governance drift',
    w4GovernanceDrift
  );

  callerGovernanceAnchor =
    findCallerGovernanceAnchor(head);

  const anchorParents =
    commitParents(
      callerGovernanceAnchor
    );

  assert(
    anchorParents.length === 1 &&
    anchorParents[0] === W4_GOV_SUCCESSOR,
    'caller governance anchor parent drift',
    {
      callerGovernanceAnchor,
      anchorParents
    }
  );

  const anchorCommitCount =
    Number(
      sh([
        'rev-list',
        '--count',
        `${W4_GOV_SUCCESSOR}..${callerGovernanceAnchor}`
      ])
    );

  assert(
    anchorCommitCount === 1,
    'caller governance anchor must be exactly one commit after W4 governance',
    anchorCommitCount
  );

  cleanCandidateGovernanceDrift =
    lines(
      sh([
        'diff',
        '--name-only',
        W4_GOV_SUCCESSOR,
        callerGovernanceAnchor
      ])
    );

  assert(
    JSON.stringify(cleanCandidateGovernanceDrift) ===
      JSON.stringify([GATE]),
    'caller governance anchor contains non-governance drift',
    cleanCandidateGovernanceDrift
  );

  callerGovernanceAnchorAdopted =
    isAncestor(
      callerGovernanceAnchor,
      PROTECTED_MAIN
    );

  if (callerGovernanceAnchorAdopted) {
    qualificationMode =
      'CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR';

    assertAncestor(
      callerGovernanceAnchor,
      PROTECTED_MAIN,
      'caller governance anchor adopted into protected main'
    );

    assertAncestor(
      PROTECTED_MAIN,
      head,
      'adopted successor lost live protected-main lineage'
    );
  } else {
    qualificationMode =
      'CLEAN_SETTLEMENT_INTEGRATION';

    assert(
      PROTECTED_MAIN === CLEAN_PROVENANCE_MAIN,
      'clean settlement integration must originate from exact provenance main',
      {
        protectedMain:
          PROTECTED_MAIN,
        expected:
          CLEAN_PROVENANCE_MAIN
      }
    );

    if (
      topology.execution_context ===
      'PULL_REQUEST'
    ) {
      assert(
        topology.candidate ===
          callerGovernanceAnchor,
        'clean integration PR candidate is not exact caller governance anchor',
        {
          candidate:
            topology.candidate,
          callerGovernanceAnchor
        }
      );

      const syntheticParents =
        commitParents(head);

      assert(
        syntheticParents.length === 2 &&
        syntheticParents[0] ===
          PROTECTED_MAIN &&
        syntheticParents[1] ===
          callerGovernanceAnchor,
        'clean integration PR synthetic carrier topology drift',
        syntheticParents
      );

      assert(
        tree(head) ===
          tree(callerGovernanceAnchor),
        'clean integration PR tree differs from caller governance anchor tree'
      );
    } else {
      if (head === callerGovernanceAnchor) {
        assert(
          isAncestor(
            PROTECTED_MAIN,
            head
          ),
          'clean fast-forward integration lost provenance-main ancestry'
        );
      } else {
        const mergeParents =
          commitParents(head);

        assert(
          mergeParents.length === 2 &&
          mergeParents[0] ===
            PROTECTED_MAIN &&
          mergeParents[1] ===
            callerGovernanceAnchor,
          'clean post-merge integration carrier topology drift',
          mergeParents
        );

        assert(
          tree(head) ===
            tree(callerGovernanceAnchor),
          'clean post-merge integration tree differs from caller governance anchor tree'
        );
      }
    }
  }
}
const mcftOwnerEvidence = exactMcftEvidence();

// Layer A 閳?frozen PR-SEC-1 remains immutable and the original machine scanner
// is executed at its exact historical predecessor, never against the successor.
assert(blob(PRSEC1_BASE, INVENTORY) === FROZEN_INVENTORY_BLOB, 'historical frozen inventory blob drift');
assert(blob('HEAD', INVENTORY) === FROZEN_INVENTORY_BLOB, 'candidate frozen inventory blob drift');
assert(read(INVENTORY) === show(PRSEC1_BASE, INVENTORY), 'frozen PR-SEC-1 inventory byte drift');
const inventory = JSON.parse(read(INVENTORY));
const inventoriedSourcePaths = [...collectInventorySourcePaths(inventory)].sort();
assert(inventoriedSourcePaths.length > 0, 'frozen inventory contains no source_path authority');
runHistoricalGate(PRSEC1_BASE, GATE, 'geox-prsec1-replay-');

// Layer B 閳?candidate must preserve the accepted B-Line authority artifacts and
// every historically inventoried source exactly as accepted at 413386..., while
// W6-B2's own exact accepted machine gate is replayed at that accepted head.
for (const p of BLINE_AUTHORITY_ARTIFACTS) {
  const acceptedBlob = blob(BLINE_ACCEPTED, p);
  const candidateBlob = blob('HEAD', p);
  assert(acceptedBlob, 'accepted B-Line authority file missing', p);
  assert(candidateBlob === acceptedBlob, 'accepted B-Line authority artifact drift', { p, acceptedBlob, candidateBlob });
}
const inventoriedSuccessorDrift = [];

for (const p of inventoriedSourcePaths) {
  const acceptedBlob =
    blob(BLINE_ACCEPTED, p);

  const candidateBlob =
    blob('HEAD', p);

  assert(
    acceptedBlob,
    'accepted B-Line reference deleted historical inventoried surface',
    p
  );

  if (p === DIST) {
    continue;
  }

  if (candidateBlob === acceptedBlob) {
    continue;
  }

  if (
    qualificationMode ===
    'HISTORICAL_SUCCESSOR'
  ) {
    assert(
      candidateBlob === acceptedBlob,
      'historically inventoried caller surface changed after accepted B-Line reference',
      {
        p,
        acceptedBlob,
        candidateBlob
      }
    );
  }

  assert(
    SEALED_INVENTORIED_SUCCESSOR_PATHS.includes(p),
    'unadjudicated historically inventoried successor drift',
    p
  );

  const sealedBlob =
    blob(SEALED_EVIDENCE, p);

  assert(
    candidateBlob === sealedBlob,
    'inventoried successor drift is not exact sealed evidence',
    {
      p,
      candidateBlob,
      sealedBlob
    }
  );

  inventoriedSuccessorDrift.push(p);
}

if (
  qualificationMode !==
  'HISTORICAL_SUCCESSOR'
) {
  assert(
    JSON.stringify(
      inventoriedSuccessorDrift.sort()
    ) ===
    JSON.stringify(
      SEALED_INVENTORIED_SUCCESSOR_PATHS
    ),
    'clean inventoried successor drift set is not exact',
    inventoriedSuccessorDrift
  );
}
runHistoricalGate(BLINE_ACCEPTED, W6B2_GATE, 'geox-w6b2-accepted-replay-');

// Layer C 閳?classify the current protected-main production/runtime delta by
// actual ownership. This is not a path ignore: every changed production path
// must classify as MCFT or ADR, must not overlap a frozen B-Line caller surface,
// and the integration candidate must carry the current-main blob unchanged
// (except the separately adjudicated additive shared packaging seam).
const externalMergeBase =
  qualificationMode === 'CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR'
    ? callerGovernanceAnchor
    : sh(['merge-base', PRSEC1_BASE, PROTECTED_MAIN]);

if (
  qualificationMode !==
  'CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR'
) {
  assert(
    externalMergeBase === EXPECTED_EXTERNAL_MERGE_BASE,
    'current-main external ownership merge-base drift',
    externalMergeBase
  );
}

const currentMainExternalDelta =
  diffNames(
    externalMergeBase,
    PROTECTED_MAIN
  );
const currentMainOwnership = { MCFT: [], ADR: [], SHARED_MAIN_INFRA: [], SHARED_PACKAGING: [], BLINE: [], UNKNOWN: [] };
const externalSet = new Set();
for (const p of currentMainExternalDelta) {
  const owner = classifyCurrentMainOwner(p);
  currentMainOwnership[owner].push(p);

  if (
    qualificationMode ===
      'CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR'
  ) {
    assert(
      owner !== 'BLINE',
      'post-adoption protected-main contains unadjudicated B-Line production evolution',
      p
    );
  }

  if (owner === 'UNKNOWN') continue;
  externalSet.add(p);
  // DIST is the one adjudicated cross-lineage packaging seam. Its MCFT delta
  // and exact additive B-Line realization are proven independently below.
  if (p !== DIST) {
    assert(!inventoriedSourcePaths.includes(p), 'current-main external delta intersects frozen B-Line caller surface without adjudication', p);
  }
  assertExternalOwnershipEvidence(owner, p, patch(externalMergeBase, PROTECTED_MAIN, p));
  if (
    p !== DIST &&
    qualificationMode !==
      'CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR'
  ) {
    assert(
      blob('HEAD', p) ===
        blob(PROTECTED_MAIN, p),
      `${owner} current-main source modified by integration candidate`,
      p
    );
  }
}
assert(currentMainOwnership.UNKNOWN.length === 0, 'UNKNOWN current-main production ownership', currentMainOwnership.UNKNOWN);

// Layer D 閳?classify every product/runtime/config delta from exact protected main
// to this candidate. A B-Line-owned change is admissible only when the candidate
// blob is exactly the accepted 413386... blob. External-owned files remain exact
// current-main bytes. Anything else fails closed as unadjudicated caller authority.
// Layer D — durable clean-settlement baseline plus live incremental delta.
const candidateDelta =
  diffNames(
    PROTECTED_MAIN,
    head
  );

const acceptedBlineRealization = [];
const sealedSuccessorRealization = [];
const baselineAcceptedExact = [];
const baselineSealedSuccessorRealization = [];
const baselineUnknown = [];
const externalCandidateOwnership = [];
const unadjudicatedCallerAuthorityDelta = [];
const unknownOwnership = [];

const currentDist =
  read(DIST);

let sharedPackagingSeam;

if (
  qualificationMode ===
  'HISTORICAL_SUCCESSOR'
) {
  const acceptedDist =
    show(
      BLINE_ACCEPTED,
      DIST
    );

  const protectedMainDist =
    show(
      PROTECTED_MAIN,
      DIST
    );

  const blineDistEntry =
    extractBlineDistEntry(
      acceptedDist
    );

  const closeMarker =
    '\n];';

  assert(
    protectedMainDist.includes(closeMarker),
    'protected-main dist entries closing marker missing'
  );

  const expectedDist =
    protectedMainDist.replace(
      closeMarker,
      `\n${blineDistEntry}${closeMarker}`
    );

  assert(
    currentDist === expectedDist,
    'shared dist packaging seam is not exact protected-main plus frozen B-Line bootstrap entry'
  );

  sharedPackagingSeam =
    'EXACT_PROTECTED_MAIN_PLUS_FROZEN_BLINE_BOOTSTRAP_ENTRY';

  for (const p of candidateDelta) {
    if (p === DIST) {
      acceptedBlineRealization.push(p);
      continue;
    }

    if (externalSet.has(p)) {
      const mainBlob =
        blob(PROTECTED_MAIN, p);

      const candidateBlob =
        blob('HEAD', p);

      if (candidateBlob !== mainBlob) {
        unadjudicatedCallerAuthorityDelta.push(p);
      }

      continue;
    }

    const acceptedBlob =
      blob(BLINE_ACCEPTED, p);

    const candidateBlob =
      blob('HEAD', p);

    if (
      acceptedBlob &&
      candidateBlob === acceptedBlob
    ) {
      acceptedBlineRealization.push(p);
    } else {
      unknownOwnership.push(p);
      unadjudicatedCallerAuthorityDelta.push(p);
    }
  }
} else {
  assert(
    callerGovernanceAnchor,
    'clean successor requires caller governance anchor'
  );

  const baselineDelta =
    diffNames(
      CLEAN_PROVENANCE_MAIN,
      callerGovernanceAnchor
    );

  for (const p of baselineDelta) {
    const acceptedBlob =
      blob(BLINE_ACCEPTED, p);

    const anchorBlob =
      blob(
        callerGovernanceAnchor,
        p
      );

    if (
      acceptedBlob &&
      anchorBlob === acceptedBlob
    ) {
      baselineAcceptedExact.push(p);
      acceptedBlineRealization.push(p);
      continue;
    }

    if (
      SEALED_SUCCESSOR_PRODUCTION_PATHS.includes(p)
    ) {
      const sealedBlob =
        blob(
          SEALED_EVIDENCE,
          p
        );

      assert(
        anchorBlob === sealedBlob,
        'caller governance anchor production baseline is not exact sealed evidence',
        {
          p,
          anchorBlob,
          sealedBlob
        }
      );

      baselineSealedSuccessorRealization.push(p);
      sealedSuccessorRealization.push(p);
      acceptedBlineRealization.push(p);
      continue;
    }

    baselineUnknown.push(p);
  }

  assert(
    baselineDelta.length === 190,
    'clean settlement durable production baseline count drift',
    baselineDelta.length
  );

  assert(
    baselineAcceptedExact.length === 184,
    'clean settlement accepted-exact durable baseline count drift',
    baselineAcceptedExact.length
  );

  assert(
    JSON.stringify(
      baselineSealedSuccessorRealization.sort()
    ) ===
    JSON.stringify(
      SEALED_SUCCESSOR_PRODUCTION_PATHS
    ),
    'clean settlement sealed-successor durable baseline set drift',
    baselineSealedSuccessorRealization
  );

  assert(
    baselineUnknown.length === 0,
    'clean settlement durable baseline contains unknown production realization',
    baselineUnknown
  );

  for (
    const p of
    SEALED_SUCCESSOR_PRODUCTION_PATHS
  ) {
    if (p === DIST) continue;

    assert(
      blob('HEAD', p) ===
        blob(SEALED_EVIDENCE, p),
      'sealed B-Line successor production path drift after adoption',
      p
    );
  }

  const anchorDist =
    show(
      callerGovernanceAnchor,
      DIST
    );

  const sealedDist =
    show(
      SEALED_EVIDENCE,
      DIST
    );

  assert(
    anchorDist === sealedDist,
    'caller governance anchor shared dist is not exact sealed evidence'
  );

  assert(
    currentDist.includes(
      'bline_commercial_principal_bootstrap.js'
    ),
    'current dist lost frozen B-Line principal bootstrap entry'
  );

  assert(
    currentDist.includes(
      'runBlineCommercialPrincipalBootstrapFromEnvironmentV1'
    ),
    'current dist lost frozen B-Line principal bootstrap runner'
  );

  assert(
    currentDist.includes(
      'runBlineStage1SchemaPreprovisionFromEnvironmentV1'
    ),
    'current dist lost Stage1 schema preprovision runner'
  );

  if (
    qualificationMode ===
    'CLEAN_SETTLEMENT_INTEGRATION'
  ) {
    assert(
      tree(head) ===
        tree(callerGovernanceAnchor),
      'clean integration execution tree differs from caller governance anchor tree'
    );

    assert(
      candidateDelta.length === 190,
      'clean integration production delta count drift',
      candidateDelta.length
    );

    assert(
      currentDist === sealedDist,
      'clean integration shared dist is not exact sealed evidence'
    );

    sharedPackagingSeam =
      'EXACT_SEALED_CLEAN_SETTLEMENT_PACKAGING';
  } else {
    sharedPackagingSeam =
      'SEALED_BLINE_BASELINE_WITH_GOVERNED_POST_ADOPTION_PACKAGING';

    for (const p of candidateDelta) {
      const owner =
        classifyCurrentMainOwner(p);

      if (
        owner === 'BLINE' ||
        owner === 'UNKNOWN'
      ) {
        unadjudicatedCallerAuthorityDelta.push(p);
        unknownOwnership.push(p);
        continue;
      }

      assertExternalOwnershipEvidence(
        owner,
        p,
        patch(
          PROTECTED_MAIN,
          head,
          p
        )
      );

      externalCandidateOwnership.push({
        path: p,
        owner
      });
    }
  }
}

assert(
  unadjudicatedCallerAuthorityDelta.length === 0,
  'unadjudicated caller-authority production delta',
  unadjudicatedCallerAuthorityDelta
);

assert(
  unknownOwnership.length === 0,
  'UNKNOWN integration candidate production ownership',
  unknownOwnership
);
console.log(JSON.stringify({
  result: 'PASS',
  suite:
    'ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1_SUCCESSOR_GOVERNANCE_RECONCILIATION',
  work_package:
    'BLINE-CALLER-INVENTORY-GOV-RECON-01',

  prsec1_base:
    PRSEC1_BASE,

  protected_main:
    PROTECTED_MAIN,

  execution_head:
    head,

  verified_execution_topology:
    topology,

  qualification_mode:
    qualificationMode,

  authority_input_source:
    topology.authority_input_source,

  caller_governance_anchor:
    callerGovernanceAnchor,

  caller_governance_anchor_adopted:
    callerGovernanceAnchorAdopted,

  FROZEN_PR_SEC_1_REPLAY:
    'PASS',

  FROZEN_INVENTORY_UNCHANGED:
    true,

  ACCEPTED_BLINE_SUCCESSOR_CHAIN_PRESERVED:
    qualificationMode ===
      'HISTORICAL_SUCCESSOR',

  CLEAN_SETTLEMENT_PROVENANCE_PRESERVED:
    qualificationMode !==
      'HISTORICAL_SUCCESSOR',

  CALLER_GOVERNANCE_ANCHOR_PRESERVED:
    qualificationMode ===
      'HISTORICAL_SUCCESSOR'
      ? null
      : Boolean(callerGovernanceAnchor),

  CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR:
    qualificationMode ===
      'CLEAN_SETTLEMENT_ADOPTED_SUCCESSOR',

  baseline_accepted_exact_count:
    baselineAcceptedExact.length,

  baseline_sealed_successor_count:
    baselineSealedSuccessorRealization.length,

  baseline_unknown_count:
    baselineUnknown.length,

  live_candidate_production_delta_count:
    candidateDelta.length,

  external_candidate_ownership:
    externalCandidateOwnership,

  inventoried_successor_drift:
    inventoriedSuccessorDrift.sort(),

  sealed_successor_production_paths:
    sealedSuccessorRealization.sort(),

  SEALED_SUCCESSOR_PRODUCTION_PATHS_PRESERVED:
    qualificationMode ===
      'HISTORICAL_SUCCESSOR'
      ? null
      : true,

  shared_packaging_seam:
    sharedPackagingSeam,

  current_main_external_merge_base:
    externalMergeBase,

  current_main_external_ownership:
    currentMainOwnership,

  UNKNOWN_CURRENT_MAIN_OWNER:
    currentMainOwnership.UNKNOWN,

  PRODUCT_SEMANTIC_DELTA:
    0,

  BLINE_CALLER_AUTHORITY_DELTA:
    [],

  UNADJUDICATED_CALLER_AUTHORITY_DELTA:
    [],

  UNKNOWN_OWNERSHIP:
    [],

  historical_prsec1_machine_gate_replayed:
    true,

  accepted_w6b2_machine_gate_replayed:
    true
}, null, 2));