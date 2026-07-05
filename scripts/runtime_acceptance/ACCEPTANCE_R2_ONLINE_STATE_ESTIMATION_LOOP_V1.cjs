// scripts/runtime_acceptance/ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const R2_BASE_HEAD = 'e7f6da764a3f6573805e2636ac514e223161219d';

const r2Doc = 'docs/runtime-readiness/R2-ONLINE-STATE-ESTIMATION-LOOP.md';
const acceptance = 'scripts/runtime_acceptance/ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1.cjs';

const allowedFiles = new Set([r2Doc, acceptance]);
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
  console.log('[r2-online-state-estimation-loop] ok:', name);
}
function execGit(args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function diffFiles() {
  let output = '';
  try { output = execGit(['diff', '--name-only', `${R2_BASE_HEAD}...HEAD`]); } catch (_error) {
    try { output = execGit(['diff', '--name-only', 'r1-runtime-evidence-stream-readiness...HEAD']); } catch (_fallbackError) { output = ''; }
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
  [r2Doc, acceptance].forEach((file) => ok('exists:' + file, exists(file), { file }));
  ok('r1_artifacts_available', exists('docs/runtime-readiness/R1-RUNTIME-EVIDENCE-STREAM-READINESS.md') && exists('scripts/runtime_acceptance/ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1.cjs'));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.length > 0 && diff.every((file) => allowedFiles.has(file)), { diff, base: R2_BASE_HEAD });
  ok('no_frontend_continuation', diff.every((file) => !file.startsWith('apps/web/src/') && !file.startsWith('docs/frontend-productization/') && !file.startsWith('scripts/frontend_acceptance/')), { diff });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('backend_changed_false', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  ok('package_changed_false', diff.every((file) => !blockedExact.has(file)), { diff });

  const doc = read(r2Doc);
  ok('contract_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Non-goals', 'State Object Contract', 'State Kinds', 'Input Evidence Window', 'Estimate Cadence', 'Estimate Values', 'Confidence and Uncertainty', 'Coverage and Gaps', 'Missing Evidence Behavior', 'Late Evidence Behavior', 'Duplicate Evidence Behavior', 'State Status', 'Replay Equivalence', 'State Read Model', 'Freshness and Usability', 'Readiness Summary', 'Acceptance', 'Nonclaims', 'R3 Handoff']));
  ok('r1_dependency_present', includesAll(doc, ['R1 Runtime Evidence Stream Readiness is complete.', 'R2 consumes only R1 state-eligible evidence.', 'state_eligible = false', 'must not enter the R2 estimate input set']));
  ok('state_object_contract_present', includesAll(doc, ['state_id', 'state_kind', 'state_window_start', 'state_window_end', 'as_of', 'estimate_generated_at', 'input_evidence_refs', 'estimate_values', 'confidence', 'uncertainty', 'coverage', 'freshness', 'quality_flags', 'state_status', 'determinism_hash']));
  ok('state_kinds_present', includesAll(doc, ['soil_moisture_state', 'soil_temperature_state', 'weather_context_state', 'field_observation_state', 'device_signal_state', 'evidence_health_state']));
  ok('input_window_present', includesAll(doc, ['window_start', 'window_end', 'lookback_ms', 'expected_interval_ms', 'min_coverage_ratio', 'max_allowed_gap_ms', 'allowed_lateness_ms', 'required_evidence_kinds', 'Use only R1 state-eligible evidence', 'Do not fabricate samples']));
  ok('cadence_present', includesAll(doc, ['estimate_interval_ms', 'as_of_tick', 'window_alignment', 'max_compute_delay_ms', 'late_evidence_reestimate_policy', 'manual_replay', 'scheduled_replay', 'runtime_candidate', 'runtime_verified']));
  ok('confidence_uncertainty_present', includesAll(doc, ['confidence_score', 'confidence_level', 'uncertainty_band', 'uncertainty_unit', 'uncertainty_reason', 'input_coverage_ratio', 'input_gap_ms', 'source_trust_level', 'method_confidence', 'High confidence must not hide high uncertainty']));
  ok('coverage_gap_present', includesAll(doc, ['points_expected', 'points_present', 'coverage_ratio', 'largest_gap_ms', 'missing_required_kinds', 'stale_sources', 'delayed_sources', 'duplicate_count', 'invalid_count', 'Coverage cannot be inflated by duplicate evidence']));
  ok('missing_late_duplicate_present', includesAll(doc, ['state_status = insufficient_evidence', 'state_ineligible_reason includes missing evidence', 'never silently mutate prior estimate', 'deduplicate for coverage', 'preserve duplicate audit count', 'never inflate coverage_ratio']));
  ok('state_status_present', includesAll(doc, ['usable', 'usable_with_caution', 'insufficient_evidence', 'stale', 'invalid_input', 'replay_only', 'not_computed', 'unknown']));
  ok('replay_equivalence_present', includesAll(doc, ['same R1 evidence input window', 'same as_of', 'same estimator version', 'same config version', 'same state output summary', 'same determinism_hash', 'same state_status', 'same confidence / uncertainty summary']));
  ok('state_read_model_present', includesAll(doc, ['state_id', 'state_kind', 'subject_ref', 'window', 'as_of', 'state_status', 'confidence', 'uncertainty', 'coverage', 'freshness', 'input_evidence_refs', 'provenance_ref', 'replay_ref', 'determinism_hash']));
  ok('freshness_usability_present', includesAll(doc, ['state_freshness_status', 'last_input_evidence_at', 'last_input_ingested_at', 'estimate_generated_at', 'max_state_age_ms', 'input_freshness_status', 'usable_for_forecast', 'R3 owns forecast and residual calibration']));
  ok('readiness_summary_present', includesAll(doc, ['R2_ONLINE_STATE_ESTIMATION_LOOP', 'contract_only_or_replay_backed', 'live_claim', 'uses_r1_state_eligible_evidence', 'state_object_contract', 'estimate_cadence_defined', 'confidence_uncertainty_defined', 'missing_late_duplicate_behavior_defined', 'replay_equivalence_defined', 'read_model_defined', 'usable_for_forecast']));
  ok('nonclaims_present', includesAll(doc, ['no forecast', 'no residual calibration', 'no recommendation', 'no dispatch', 'no AO-ACT', 'no ROI', 'no Field Memory', 'no model update', 'no field pilot execution', 'no autonomous operation']));
  ok('r3_handoff_present', includesAll(doc, ['R3 Forecast Calibration & Residual Loop follows R2.', 'R2 does not forecast.', 'R2 provides state object', 'confidence', 'uncertainty', 'freshness', 'read model', 'replay equivalence boundary for R3']));

  const falseClaimTokens = ['forecast generated', 'recommendation generated', 'dispatch enabled', 'AO-ACT enabled', 'ROI computed', 'Field Memory learned', 'autonomous operation', 'field pilot started'];
  const negativeTokens = ['not', 'no ', 'does not', 'false', 'disabled', 'has no'];
  ok('false_capability_claims_absent', lineViolations(doc, falseClaimTokens, negativeTokens).length === 0, { violations: lineViolations(doc, falseClaimTokens, negativeTokens) });

  const scanned = diff.filter((file) => exists(file) && file !== acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_r2_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const acceptanceText = read(acceptance);
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !hasNetworkCallToken(acceptanceText));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1',
    phase: 'R2 Online State Estimation Loop',
    readiness: {
      state_object_contract: 'present',
      input_evidence_window: 'defined',
      estimate_cadence: 'defined',
      confidence_uncertainty: 'defined',
      replay_equivalence: 'defined',
      state_read_model: 'defined',
      live_runtime_claim: false
    },
    frontend_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'R3 Forecast Calibration & Residual Loop',
    changed_files_checked: diff,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
