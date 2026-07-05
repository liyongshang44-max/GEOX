// scripts/runtime_acceptance/ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const R1_BASE_HEAD = '196f11b105b83870b66933a3bf354ee5d4ac985d';

const r1Doc = 'docs/runtime-readiness/R1-RUNTIME-EVIDENCE-STREAM-READINESS.md';
const acceptance = 'scripts/runtime_acceptance/ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1.cjs';

const allowedFiles = new Set([
  r1Doc,
  acceptance,
  'docs/runtime-readiness/R1-EVIDENCE-STREAM-CONTRACT.md',
  'docs/runtime-readiness/R1-EVIDENCE-FRESHNESS-MODEL.md',
  'docs/runtime-readiness/R1-EVIDENCE-REPLAY-EQUIVALENCE.md',
  'docs/runtime-readiness/R1-EVIDENCE-INVALID-MISSING-DELAYED-BEHAVIOR.md',
  'scripts/runtime_acceptance/lib/runtimeEvidenceReadinessScan.js',
]);

const blockedExact = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const blockedPrefixes = ['apps/web/src/', 'docs/frontend-productization/', 'scripts/frontend_acceptance/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/'];
const mojibake = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];

function p(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(p(file)); }
function read(file) { return fs.readFileSync(p(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) {
  const haystack = lower(text);
  return tokens.every((token) => haystack.includes(lower(token)));
}
function hits(text, tokens) { return tokens.filter((token) => text.includes(token)); }
function ok(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[r1-runtime-evidence-stream-readiness] ok:', name);
}
function execGit(args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function diffFiles() {
  let output = '';
  try { output = execGit(['diff', '--name-only', `${R1_BASE_HEAD}...HEAD`]); } catch (_error) {
    try { output = execGit(['diff', '--name-only', 'main...HEAD']); } catch (_fallbackError) { output = ''; }
  }
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function blocked(file) { return blockedExact.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function hasNetworkCallToken(text) { return text.includes('fet' + 'ch(') || text.includes('lis' + 'ten('); }
function lineViolations(text, tokens, negativeTokens) {
  return text.split(/\r?\n/).map((line, index) => ({ index: index + 1, line, lowerLine: lower(line) }))
    .flatMap((entry) => tokens.filter((token) => entry.lowerLine.includes(lower(token))).map((token) => ({ ...entry, token })))
    .filter((entry) => !negativeTokens.some((token) => entry.lowerLine.includes(lower(token))));
}

try {
  [r1Doc, acceptance].forEach((file) => ok('exists:' + file, exists(file), { file }));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.length > 0 && diff.every((file) => allowedFiles.has(file)), { diff, base: R1_BASE_HEAD });
  ok('no_frontend_continuation', diff.every((file) => !file.startsWith('apps/web/src/') && !file.startsWith('docs/frontend-productization/') && !file.startsWith('scripts/frontend_acceptance/')), { diff });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('backend_changed_false', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  ok('package_changed_false', diff.every((file) => !blockedExact.has(file)), { diff });

  const doc = read(r1Doc);
  ok('contract_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Non-goals', 'Evidence Stream Contract', 'Evidence Unit', 'Evidence Kinds', 'Source Identity', 'Subject Identity', 'Timestamp Semantics', 'Replay Path', 'Freshness Model', 'Invalid Evidence Behavior', 'Missing Evidence Behavior', 'Delayed Evidence Behavior', 'Duplicate Evidence Behavior', 'State Eligibility Boundary', 'Readiness Summary', 'Acceptance', 'Nonclaims', 'R2 Handoff']));
  ok('required_terms_present', includesAll(doc, ['what evidence arrives', 'from which source', 'timestamp semantics', 'identity', 'replay path', 'freshness model', 'invalid', 'missing', 'delayed', 'duplicate', 'state_eligible', 'state_ineligible_reason']));
  ok('evidence_unit_present', includesAll(doc, ['evidence_id', 'evidence_kind', 'source_ref', 'subject_ref', 'tenant_id', 'project_id', 'occurred_at', 'observed_at', 'ingested_at', 'payload_ref or raw_payload_ref', 'quality_flags', 'replay_ref', 'provenance_ref']));
  ok('evidence_kinds_present', includesAll(doc, ['sensor_sample', 'weather_sample', 'operator_observation', 'device_event', 'gateway_ingestion_event', 'replay_sample', 'trace_readback_event', 'real_observed', 'replay_backed', 'derived_readback', 'manual_observation', 'gateway_event']));
  ok('source_identity_present', includesAll(doc, ['source_type', 'source_id', 'source_name', 'source_version', 'source_location or source_scope', 'source_trust_level', 'source_mode', 'replay', 'simulated', 'manual', 'gateway_demo', 'live_candidate', 'live_verified']));
  ok('subject_identity_present', includesAll(doc, ['tenant_id', 'project_id', 'field_id', 'group_id', 'sensor_id or device_id', 'zone_id if available', 'season_id if available', 'not_state_eligible']));
  ok('timestamp_semantics_present', includesAll(doc, ['occurred_at', 'observed_at', 'ingested_at', 'available_at', 'replayed_at', 'Replay equivalence must preserve `occurred_at`', 'Freshness uses `ingested_at` or `available_at`']));
  ok('replay_path_present', includesAll(doc, ['replay_source', 'replay_window', 'replay_subject_scope', 'replay_ordering', 'replay_clock', 'replay_output', 'replay_equivalence', 'deterministic summary', 'Replay-backed evidence stream readiness does not prove live device deployment']));
  ok('freshness_model_present', includesAll(doc, ['last_evidence_at', 'last_ingested_at', 'expected_interval_ms', 'allowed_lateness_ms', 'max_staleness_ms', 'coverage_window_ms', 'coverage_ratio', 'freshness_status', 'fresh', 'late', 'stale', 'missing', 'invalid', 'unknown', 'replay_only']));
  ok('invalid_missing_delayed_present', includesAll(doc, ['do not fabricate samples', 'do not silently accept invalid evidence', 'do not use invalid evidence for state estimation', 'do not treat late evidence as live monitoring success', 'do not rewrite prior state unless R2 defines re-estimation policy', 'duplicates should not inflate coverage']));
  ok('state_eligibility_present', includesAll(doc, ['state_eligible: true | false', 'state_ineligible_reason', 'recognized source', 'stable subject identity', 'payload or payload_ref available', 'R1 provides evidence eligibility boundary for R2']));
  ok('readiness_summary_present', includesAll(doc, ['R1_RUNTIME_EVIDENCE_STREAM_READINESS', 'replay_backed_or_contract_only', 'live_claim', 'sources', 'subjects', 'freshness', 'invalid', 'missing', 'delayed', 'duplicates', 'state_eligible', 'nonclaims']));
  ok('nonclaims_present', includesAll(doc, ['no recommendation', 'no dispatch', 'no AO-ACT', 'no ROI', 'no Field Memory', 'no model update', 'no live production claim']));
  ok('r2_handoff_present', includesAll(doc, ['R2 Online State Estimation Loop', 'R1 does not estimate state', 'R1 provides evidence eligibility boundary for R2']));

  const falseClaimTokens = ['live device connected', 'production gateway online', 'continuous runtime monitoring active', 'field pilot started', 'AO-ACT dispatch enabled', 'ROI computed', 'Field Memory learned', 'model updated', 'recommendation generated', 'dispatch created'];
  const negativeTokens = ['not', 'no ', 'does not', 'false', 'disabled', 'not started', 'not online', 'not connected'];
  ok('false_live_claims_absent', lineViolations(doc, falseClaimTokens, negativeTokens).length === 0, { violations: lineViolations(doc, falseClaimTokens, negativeTokens) });

  const scanned = diff.filter((file) => exists(file) && file !== acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_r1_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const acceptanceText = read(acceptance);
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !hasNetworkCallToken(acceptanceText));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1',
    phase: 'R1 Runtime Evidence Stream Readiness',
    readiness: {
      evidence_stream_contract: 'present',
      replay_path: 'defined',
      freshness_model: 'defined',
      invalid_missing_delayed_behavior: 'defined',
      state_eligibility_boundary: 'defined',
      live_runtime_claim: false
    },
    frontend_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'R2 Online State Estimation Loop',
    changed_files_checked: diff,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
