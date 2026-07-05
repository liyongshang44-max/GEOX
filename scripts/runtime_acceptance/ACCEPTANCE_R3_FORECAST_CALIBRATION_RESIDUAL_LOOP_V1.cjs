// scripts/runtime_acceptance/ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const R3_BASE_HEAD = '4f3058b3f9cc36a87a0eabd5e8dd46d533f85aac';

const r3Doc = 'docs/runtime-readiness/R3-FORECAST-CALIBRATION-RESIDUAL-LOOP.md';
const acceptance = 'scripts/runtime_acceptance/ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1.cjs';

const allowedFiles = new Set([r3Doc, acceptance]);
const stackIntegratedFiles = new Set([
  'docs/runtime-readiness/R1-RUNTIME-EVIDENCE-STREAM-READINESS.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1.cjs',
  'docs/runtime-readiness/R2-ONLINE-STATE-ESTIMATION-LOOP.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1.cjs',
  'docs/runtime-readiness/R3-FORECAST-CALIBRATION-RESIDUAL-LOOP.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1.cjs',
  'docs/runtime-readiness/R4-RUNTIME-HEALTH-SERVICE-GATE.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1.cjs',
  'docs/runtime-readiness/R5-FIELD-PILOT-RUNTIME-READINESS.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R5_FIELD_PILOT_RUNTIME_READINESS_V1.cjs',
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
  console.log('[r3-forecast-calibration-residual-loop] ok:', name);
}
function execGit(args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function diffFiles() {
  let output = '';
  try { output = execGit(['diff', '--name-only', `${R3_BASE_HEAD}...HEAD`]); } catch (_error) {
    try { output = execGit(['diff', '--name-only', 'r2-runtime-state-readiness...HEAD']); } catch (_fallbackError) { output = ''; }
  }
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function hasStackIntegratedArtifacts() { return Array.from(stackIntegratedFiles).every((file) => exists(file)); }
function diffAllowed(diff) {
  const stackIntegrated = hasStackIntegratedArtifacts();
  return diff.length > 0 && diff.every((file) => allowedFiles.has(file) || (stackIntegrated && stackIntegratedFiles.has(file)));
}
function diffMode() { return hasStackIntegratedArtifacts() ? 'stack_integrated' : 'phase'; }
function blocked(file) { return blockedExact.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function hasNetworkCallToken(text) { return text.includes('fet' + 'ch(') || text.includes('lis' + 'ten('); }
function lineViolations(text, tokens, negativeTokens) {
  return text.split(/\r?\n/).map((line, index) => ({ index: index + 1, line, lowerLine: lower(line) }))
    .flatMap((entry) => tokens.filter((token) => entry.lowerLine.includes(lower(token))).map((token) => ({ ...entry, token })))
    .filter((entry) => !negativeTokens.some((token) => entry.lowerLine.includes(lower(token))));
}

try {
  [r3Doc, acceptance].forEach((file) => ok('exists:' + file, exists(file), { file }));
  ok('r2_artifacts_available', exists('docs/runtime-readiness/R2-ONLINE-STATE-ESTIMATION-LOOP.md') && exists('scripts/runtime_acceptance/ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1.cjs'));

  const diff = diffFiles();
  ok('changed_files_allowlist', diffAllowed(diff), { diff, base: R3_BASE_HEAD, mode: diffMode() });
  ok('no_frontend_continuation', diff.every((file) => !file.startsWith('apps/web/src/') && !file.startsWith('docs/frontend-productization/') && !file.startsWith('scripts/frontend_acceptance/')), { diff });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('backend_changed_false', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  ok('package_changed_false', diff.every((file) => !blockedExact.has(file)), { diff });

  const doc = read(r3Doc);
  ok('required_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Non-goals', 'R2 Dependency', 'Forecast Object', 'Forecast Vector', 'Forecast Horizon', 'Verification Window', 'Post-event Evidence', 'Residual Calculation', 'Error Bucket', 'Calibration Review Packet', 'Forecast Replay', 'Forecast Freshness', 'Forecast / Residual Read Model', 'Versioning', 'R3 Nonclaims', 'Acceptance', 'R4 Handoff']));
  ok('r2_dependency_present', includesAll(doc, ['R2 Online State Estimation Loop', 'base_state_estimate_ref', 'state_replay_equivalence_hash', 'R3 consumes state estimates from R2']));
  ok('forecast_object_present', includesAll(doc, ['forecast_id', 'tenant_id', 'project_id', 'subject_ref', 'forecast_kind', 'forecast_mode', 'issued_at', 'base_state_estimate_ref', 'horizon', 'forecast_vector', 'confidence', 'uncertainty', 'assumptions', 'input_evidence_refs', 'verification', 'replay', 'nonclaims', 'field_runtime_forecast']));
  ok('forecast_vector_present', includesAll(doc, ['forecast_vector is a prediction about future state', 'water_state_forecast', 'temperature_state_forecast', 'coverage_state_forecast', 'target_time', 'dry_candidate', 'normal_candidate', 'wet_candidate', 'cold_candidate', 'hot_candidate', 'insufficient', 'partial', 'sufficient', 'Forecast values are not actions']));
  ok('forecast_vector_forbidden_present', includesAll(doc, ['recommendation', 'suggestion', 'action', 'dispatch', 'AO-ACT', 'ROI', 'yield impact', 'profit impact', 'Field Memory', 'prescription', 'priority', 'severity', 'next action', 'automatic update']));
  ok('forecast_horizon_present', includesAll(doc, ['horizon.start', 'horizon.end', 'horizon_ms', 'target_times', 'forecast_granularity', 'short_horizon', 'medium_horizon', 'long_horizon', 'contract-defined horizon, not live forecast engine', 'A defined forecast horizon is not a claim that a live forecast service is running.']));
  ok('verification_window_present', includesAll(doc, ['verification_window.start', 'verification_window.end', 'target_time', 'allowed_early_ms', 'allowed_late_ms', 'required_evidence_kinds', 'minimum_coverage_ratio', 'verification_as_of', 'pending', 'verifiable', 'verified', 'not_verifiable', 'expired', 'invalid']));
  ok('post_event_evidence_present', includesAll(doc, ['post_event_evidence_refs', 'post_event_state_estimate_refs', 'verification_evidence_window', 'verification_evidence_coverage', 'excluded_post_event_evidence_refs', 'exclusion_reasons', 'outside_verification_window', 'invalid_timestamp', 'missing_subject_identity', 'unrecognized_source', 'insufficient_coverage', 'duplicate_evidence', 'not_state_eligible']));
  ok('residual_calculation_present', includesAll(doc, ['residual_id', 'forecast_id', 'forecast_value', 'observed_value', 'residual_value', 'residual_kind', 'residual_magnitude', 'calculation_method', 'numeric residual', 'categorical residual', 'observed_value - forecast_value', 'category_distance', 'not_calculable', 'Forecast error severity is not agronomic severity and does not create action priority.']));
  ok('error_bucket_present', includesAll(doc, ['not_calculable', 'accurate', 'minor_error', 'material_error', 'severe_error', 'missing_verification_evidence', 'invalid_forecast', 'invalid_post_event_evidence', 'Error bucket does not trigger action']));
  ok('calibration_packet_present', includesAll(doc, ['calibration_review_packet_id', 'forecast_id', 'residual_id', 'base_state_estimate_ref', 'forecast_summary', 'verification_summary', 'residual_summary', 'error_bucket', 'uncertainty_drivers', 'review_status', 'pending_review', 'reviewed', 'not_reviewable', 'model_update', 'allowed: false', 'applied: false']));
  ok('forecast_replay_present', includesAll(doc, ['forecast_replay_equivalence_hash', 'forecast_engine_version', 'state_replay_equivalence_hash', 'same forecast summary', 'same verification relation', 'same residual calculation', 'same error bucket', 'same calibration review packet summary', 'Forecast replay equivalence does not prove live forecast service is active.']));
  ok('forecast_freshness_present', includesAll(doc, ['forecast_freshness.status', 'issued_at', 'horizon.end', 'verification_window.end', 'verification_status', 'residual_status', 'calibration_review_status', 'pending_verification', 'ready_for_verification', 'expired_unverified', 'replay_only']));
  ok('read_model_present', includesAll(doc, ['forecast_id', 'subject_ref', 'forecast_kind', 'forecast_mode', 'issued_at', 'base_state_estimate_ref', 'horizon', 'forecast_vector', 'verification_status', 'verification_window', 'post_event_evidence_refs', 'residual_ref', 'residual_summary', 'error_bucket', 'calibration_review_packet_ref', 'forecast_replay_equivalence_hash', 'nonclaims']));
  ok('read_model_ban_present', includesAll(doc, ['recommendation', 'action', 'dispatch command', 'AO-ACT task', 'ROI impact', 'Field Memory write', 'model update applied', 'prescription', 'priority', 'next action']));
  ok('versioning_present', includesAll(doc, ['forecast_engine_id', 'forecast_engine_version', 'forecast_contract_version', 'residual_method_version', 'error_bucket_policy_version', 'calibration_review_contract_version', 'input_state_contract_version']));
  ok('nonclaims_present', includesAll(doc, ['no automatic recommendation', 'no dispatch', 'no model auto-update', 'no AO-ACT', 'no ROI', 'no Field Memory', 'Forecast is not a recommendation', 'Residual is not agronomic severity', 'Error bucket does not create action priority']));
  ok('r4_handoff_present', includesAll(doc, ['R4 Runtime Health Service Gate', 'R3 provides forecast/residual/calibration review readiness for R4']));

  const falseClaimTokens = ['recommendation generated', 'dispatch created', 'AO-ACT task created', 'ROI computed', 'Field Memory learned', 'model updated', 'model auto-updated', 'calibration applied automatically', 'live forecast service active', 'production runtime active'];
  const negativeTokens = ['not', 'no ', 'does not', 'false', 'disabled', 'not active', 'not created', 'not computed', 'not applied'];
  ok('false_capability_claims_absent', lineViolations(doc, falseClaimTokens, negativeTokens).length === 0, { violations: lineViolations(doc, falseClaimTokens, negativeTokens) });

  const scanned = diff.filter((file) => exists(file) && file.endsWith('.md'));
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_r3_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const acceptanceText = read(acceptance);
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !hasNetworkCallToken(acceptanceText));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1',
    phase: 'R3 Forecast Calibration & Residual Loop',
    readiness: {
      forecast_object: 'defined',
      forecast_horizon: 'defined',
      verification_window: 'defined',
      post_event_evidence: 'defined',
      residual_calculation: 'defined',
      error_bucket: 'defined',
      calibration_review_packet: 'defined',
      forecast_replay: 'defined',
      automatic_recommendation_or_model_update: false
    },
    frontend_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'R4 Runtime Health Service Gate',
    changed_files_checked: diff,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
