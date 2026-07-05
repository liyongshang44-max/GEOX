// scripts/runtime_acceptance/ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const R4_BASE_HEAD = 'be382359baee4da9aed79be25ebdd39a8fd25869';

const r4Doc = 'docs/runtime-readiness/R4-RUNTIME-HEALTH-SERVICE-GATE.md';
const acceptance = 'scripts/runtime_acceptance/ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1.cjs';

const allowedFiles = new Set([r4Doc, acceptance]);
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
  console.log('[r4-runtime-health-service-gate] ok:', name);
}
function execGit(args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function diffFiles() {
  let output = '';
  try { output = execGit(['diff', '--name-only', `${R4_BASE_HEAD}...HEAD`]); } catch (_error) {
    try { output = execGit(['diff', '--name-only', 'r3-runtime-review-readiness...HEAD']); } catch (_fallbackError) { output = ''; }
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
  [r4Doc, acceptance].forEach((file) => ok('exists:' + file, exists(file), { file }));
  ok('r3_artifacts_available', exists('docs/runtime-readiness/R3-FORECAST-CALIBRATION-RESIDUAL-LOOP.md') && exists('scripts/runtime_acceptance/ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1.cjs'));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.length > 0 && diff.every((file) => allowedFiles.has(file)), { diff, base: R4_BASE_HEAD });
  ok('no_frontend_continuation', diff.every((file) => !file.startsWith('apps/web/src/') && !file.startsWith('docs/frontend-productization/') && !file.startsWith('scripts/frontend_acceptance/')), { diff });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('backend_changed_false', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  ok('package_changed_false', diff.every((file) => !blockedExact.has(file)), { diff });

  const doc = read(r4Doc);
  ok('required_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Non-goals', 'R1/R2/R3 Dependency', 'Review Health', 'Service Health', 'Live Monitoring', 'Production Gateway', 'Device Evidence', 'Runtime Freshness', 'Runtime Health Service Gate Object', 'Health Freshness Model', 'Service Health Model', 'Device Evidence Requirements', 'Gateway Evidence Requirements', 'Live Monitoring Eligibility', 'Failure Modes', 'Health Read Model', 'Versioning', 'R4 Nonclaims', 'Acceptance', 'R5 Handoff']));
  ok('dependency_present', includesAll(doc, ['R1 Runtime Evidence Stream Readiness', 'R2 Online State Estimation Loop', 'R3 Forecast Calibration & Residual Loop', 'R5 Field Pilot Runtime Readiness', 'R4 consumes R1/R2/R3 readiness signals.', 'R4 provides health gate prerequisites for R5.']));
  ok('separation_present', includesAll(doc, ['review health', 'service health', 'live monitoring', 'production gateway', 'device evidence', 'runtime freshness', 'These six concepts must not be mixed.']));
  ok('review_health_boundary_present', includesAll(doc, ['Review Health cannot prove production gateway online.', 'Review Health cannot prove live device connected.', 'Review Health cannot prove continuous live monitoring active.']));
  ok('gate_object_present', includesAll(doc, ['runtime_health_gate_id', 'review_health', 'service_health', 'runtime_freshness', 'device_evidence', 'gateway_evidence', 'live_monitoring', 'nonclaims']));
  ok('service_health_present', includesAll(doc, ['not_enabled', 'contract_defined', 'replay_validated', 'service_candidate', 'service_verified', 'degraded', 'unavailable', 'unknown', 'service_health.status = contract_defined']));
  ok('freshness_present', includesAll(doc, ['last_evidence_at', 'last_state_estimated_at', 'last_forecast_verified_at', 'last_gateway_seen_at', 'last_device_seen_at', 'last_health_evaluated_at', 'max_allowed_health_staleness_ms', 'current', 'late', 'stale', 'partial', 'missing', 'invalid', 'replay_only', 'unknown']));
  ok('device_evidence_present', includesAll(doc, ['device_id', 'device_kind', 'source_id', 'source_mode', 'subject_ref', 'last_seen_at', 'last_payload_ref', 'clock_status', 'identity_binding_status', 'accepted_evidence_refs', 'rejected_evidence_refs', 'freshness_status', 'device evidence must distinguish replay_only from live_verified']));
  ok('gateway_evidence_present', includesAll(doc, ['gateway_id', 'gateway_version', 'gateway_mode', 'deployment_environment', 'last_seen_at', 'last_accepted_packet_at', 'last_rejected_packet_at', 'source_identity_binding', 'device_identity_binding', 'clock_sync_status', 'duplicate_policy_status', 'ingestion_status', 'evidence_package_ref', 'replay_demo', 'production_candidate', 'production_verified', 'replay_demo cannot support production gateway online claim']));
  ok('live_monitoring_present', includesAll(doc, ['live_monitoring.eligible = false', 'live_monitoring.active = false', 'R4 defines live monitoring eligibility but does not claim live monitoring is active', 'source_mode = live_verified', 'gateway evidence status = production_verified', 'service health status service_verified', 'runtime freshness status = current']));
  ok('failure_modes_present', includesAll(doc, ['missing_evidence_stream', 'stale_evidence_stream', 'missing_state_estimate', 'stale_state_estimate', 'missing_device_evidence', 'stale_device_evidence', 'missing_gateway_evidence', 'stale_gateway_evidence', 'gateway_replay_only', 'device_replay_only', 'health_evaluation_overdue', 'service_not_enabled']));
  ok('health_read_model_present', includesAll(doc, ['runtime_health_gate_id', 'subject_ref', 'review_health.status', 'service_health.status', 'runtime_freshness.status', 'device_evidence.status', 'gateway_evidence.status', 'live_monitoring.eligible', 'live_monitoring.active', 'failure_modes', 'evidence_refs', 'nonclaims']));
  ok('read_model_ban_present', includesAll(doc, ['recommendation', 'action', 'dispatch command', 'AO-ACT task', 'ROI impact', 'Field Memory write', 'model update applied', 'pilot start command']));
  ok('versioning_present', includesAll(doc, ['runtime_health_gate_contract_version', 'health_evaluation_policy_version', 'device_evidence_contract_version', 'gateway_evidence_contract_version', 'freshness_policy_version', 'input_evidence_contract_version', 'input_state_contract_version', 'input_forecast_contract_version']));
  ok('nonclaims_present', includesAll(doc, ['does not claim production gateway online', 'does not claim live device connected', 'does not claim continuous live monitoring active', 'does not start field pilot', 'does not dispatch', 'does not create AO-ACT task', 'does not compute ROI', 'does not write Field Memory']));
  ok('r5_handoff_present', includesAll(doc, ['R5 Field Pilot Runtime Readiness follows R4.', 'R4 provides health gate prerequisites for R5.', 'R4 does not start field pilot.']));

  const falseClaimTokens = ['production gateway online', 'live device connected', 'continuous live monitoring active', 'field pilot started', 'dispatch enabled', 'AO-ACT task created', 'ROI computed', 'Field Memory learned', 'model updated'];
  const negativeTokens = ['not', 'no ', 'does not', 'false', 'disabled', 'not active', 'not created', 'not computed', 'not online', 'not connected', 'not started', 'cannot prove', 'cannot support'];
  ok('false_live_claims_absent', lineViolations(doc, falseClaimTokens, negativeTokens).length === 0, { violations: lineViolations(doc, falseClaimTokens, negativeTokens) });

  const scanned = diff.filter((file) => exists(file) && file !== acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_r4_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const acceptanceText = read(acceptance);
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !hasNetworkCallToken(acceptanceText));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1',
    phase: 'R4 Runtime Health Service Gate',
    readiness: {
      runtime_health_service_gate: 'defined',
      review_health: 'separated',
      service_health: 'separated',
      runtime_freshness: 'defined',
      device_evidence_requirements: 'defined',
      gateway_evidence_requirements: 'defined',
      live_monitoring_claim: false
    },
    frontend_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'R5 Field Pilot Runtime Readiness',
    changed_files_checked: diff,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
