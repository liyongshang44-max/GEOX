// scripts/runtime_acceptance/ACCEPTANCE_R5_FIELD_PILOT_RUNTIME_READINESS_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const R5_BASE_HEAD = '990d1caee8076cee70e41d914896b77520a19101';

const r5Doc = 'docs/runtime-readiness/R5-FIELD-PILOT-RUNTIME-READINESS.md';
const acceptance = 'scripts/runtime_acceptance/ACCEPTANCE_R5_FIELD_PILOT_RUNTIME_READINESS_V1.cjs';

const requiredRArtifacts = [
  'docs/runtime-readiness/R1-RUNTIME-EVIDENCE-STREAM-READINESS.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1.cjs',
  'docs/runtime-readiness/R2-ONLINE-STATE-ESTIMATION-LOOP.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1.cjs',
  'docs/runtime-readiness/R3-FORECAST-CALIBRATION-RESIDUAL-LOOP.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1.cjs',
  'docs/runtime-readiness/R4-RUNTIME-HEALTH-SERVICE-GATE.md',
  'scripts/runtime_acceptance/ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1.cjs',
];

const allowedFiles = new Set([r5Doc, acceptance]);
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
  console.log('[r5-field-pilot-runtime-readiness] ok:', name);
}
function execGit(args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function diffFiles() {
  let output = '';
  try { output = execGit(['diff', '--name-only', `${R5_BASE_HEAD}...HEAD`]); } catch (_error) {
    try { output = execGit(['diff', '--name-only', 'r4-runtime-health-readiness...HEAD']); } catch (_fallbackError) { output = ''; }
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
  [r5Doc, acceptance].forEach((file) => ok('exists:' + file, exists(file), { file }));
  requiredRArtifacts.forEach((file) => ok('exists:' + file, exists(file), { file }));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.length > 0 && diff.every((file) => allowedFiles.has(file)), { diff, base: R5_BASE_HEAD });
  ok('no_frontend_continuation', diff.every((file) => !file.startsWith('apps/web/src/') && !file.startsWith('docs/frontend-productization/') && !file.startsWith('scripts/frontend_acceptance/')), { diff });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('backend_changed_false', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  ok('package_changed_false', diff.every((file) => !blockedExact.has(file)), { diff });

  const doc = read(r5Doc);
  ok('required_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Non-goals', 'R1 Evidence Stream Gate', 'R2 State Estimation Gate', 'R3 Calibration / Residual Gate', 'R4 Runtime Health Service Gate', 'Controlled Field Pilot Readiness Criteria', 'Field Scope Readiness', 'Safety / Stop Rules', 'Human Role Matrix', 'Execution Gating', 'AO-ACT Boundary', 'ROI / Field Memory Boundary', 'Readiness Packet', 'Incident / Rollback Readiness', 'Audit / Traceability', 'Versioning', 'R5 Nonclaims', 'Acceptance', 'Post-R5 Boundary']));
  ok('r1_r4_gate_reference_present', includesAll(doc, ['R1 evidence stream passed', 'R2 state estimation passed', 'R3 calibration loop passed', 'R4 runtime health service gate passed', 'evidence_stream_not_ready', 'state_estimation_not_ready', 'forecast_calibration_not_ready', 'runtime_health_gate_not_ready']));
  ok('readiness_criteria_present', includesAll(doc, ['runtime evidence readiness', 'state estimation readiness', 'forecast / calibration readiness', 'runtime health service gate readiness', 'field scope readiness', 'device / gateway evidence readiness', 'safety / stop-rule readiness', 'human role readiness', 'execution gating readiness', 'rollback / incident readiness', 'audit / traceability readiness']));
  ok('readiness_outcomes_present', includesAll(doc, ['not_ready', 'blocked', 'conditional_ready', 'ready_for_human_review', 'ready_candidate', 'ready_candidate is not pilot start', 'ready_for_human_review is not pilot authorization']));
  ok('field_scope_present', includesAll(doc, ['tenant_id', 'project_id', 'field_id', 'zone_id if applicable', 'pilot_scope_mode', 'field boundary ref', 'device/source binding refs', 'human owner ref', 'safety owner ref', 'operator owner ref', 'not_bound', 'replay_only', 'single_field', 'bounded_zone', 'multi_field_candidate']));
  ok('safety_stop_rules_present', includesAll(doc, ['manual stop authority', 'device / gateway uncertainty stop', 'evidence freshness stop', 'state confidence stop', 'forecast residual stop', 'health service degradation stop', 'weather / environment stop', 'human availability stop', 'communication loss stop', 'scope boundary violation stop', 'unexpected execution receipt stop', 'Stop rules may block readiness or require review, but R5 does not dispatch, pause machinery, or control equipment.']));
  ok('human_role_matrix_present', includesAll(doc, ['pilot_owner', 'field_operator', 'runtime_operator', 'safety_owner', 'agronomy_reviewer', 'device/gateway_operator', 'incident_responder', 'approval_authority', 'decision_rights', 'required_before_pilot', 'required_during_pilot', 'required_for_stop', 'required_for_restart', 'Human roles do not authorize automatic dispatch inside R5.']));
  ok('execution_gating_present', includesAll(doc, ['field pilot execution still gated', 'AO-ACT dispatch still separately gated', 'explicit pilot authorization packet', 'human approval', 'field scope binding', 'device/gateway verification', 'execution receipt contract', 'incident / stop protocol', 'post-run review protocol']));
  ok('ao_act_boundary_present', includesAll(doc, ['AO-ACT dispatch remains separately gated', 'R5 does not create AO-ACT task', 'R5 does not dispatch']));
  ok('roi_field_memory_boundary_present', includesAll(doc, ['R5 does not write ROI', 'R5 does not write Field Memory']));
  ok('readiness_packet_present', includesAll(doc, ['field_pilot_readiness_id', 'field_scope', 'R1 gate ref', 'R2 gate ref', 'R3 gate ref', 'R4 gate ref', 'safety / stop-rule summary', 'human role matrix summary', 'execution gating summary', 'open blockers', 'limitations', 'required human approvals', 'readiness outcome', 'nonclaims', 'A readiness packet is not a pilot start command, not a dispatch command, and not an AO-ACT task.']));
  ok('incident_rollback_present', includesAll(doc, ['incident detection source', 'human contact path', 'manual stop path', 'device/gateway disconnect response', 'evidence stream failure response', 'health degradation response', 'rollback owner', 'post-incident review requirement']));
  ok('audit_traceability_present', includesAll(doc, ['R1 evidence stream artifact', 'R2 state estimate artifact', 'R3 forecast/residual/calibration artifact', 'R4 health service gate artifact', 'safety rule artifact', 'human role matrix artifact', 'execution gating artifact', 'R5 readiness cannot be decided by verbal assertion alone.']));
  ok('versioning_present', includesAll(doc, ['field_pilot_readiness_contract_version', 'safety_stop_rule_version', 'human_role_matrix_version', 'execution_gating_policy_version', 'input_r1_contract_version', 'input_r2_contract_version', 'input_r3_contract_version', 'input_r4_contract_version']));
  ok('nonclaims_present', includesAll(doc, ['does not start pilot automatically', 'does not dispatch', 'does not create AO-ACT task', 'does not write ROI', 'does not write Field Memory', 'does not update model', 'does not create recommendations', 'does not authorize autonomous operation', 'does not bypass human approval']));
  ok('post_r5_boundary_present', includesAll(doc, ['Pilot Execution Authorization', 'explicit human approval', 'runtime health check at execution time', 'AO-ACT dispatch contract if execution uses AO-ACT', 'R5 does not start pilot.']));

  const falseClaimTokens = ['pilot started', 'field pilot started', 'dispatch enabled', 'AO-ACT task created', 'ROI computed', 'Field Memory learned', 'model updated', 'recommendation generated', 'autonomous operation authorized', 'production field operation active', 'automatic equipment stop', 'automatic dispatch cancellation', 'automatic field operation rollback'];
  const negativeTokens = ['not', 'no ', 'does not', 'false', 'disabled', 'not active', 'not created', 'not computed', 'not started', 'separately gated', 'not implemented', 'requires later gate'];
  ok('false_capability_claims_absent', lineViolations(doc, falseClaimTokens, negativeTokens).length === 0, { violations: lineViolations(doc, falseClaimTokens, negativeTokens) });

  const scanned = diff.filter((file) => exists(file) && file !== acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_r5_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const acceptanceText = read(acceptance);
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !hasNetworkCallToken(acceptanceText));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_R5_FIELD_PILOT_RUNTIME_READINESS_V1',
    phase: 'R5 Field Pilot Runtime Readiness',
    readiness: {
      r1_evidence_stream: 'referenced',
      r2_state_estimation: 'referenced',
      r3_calibration_loop: 'referenced',
      r4_runtime_health_service_gate: 'referenced',
      controlled_field_pilot_criteria: 'defined',
      safety_stop_rules: 'validity-required',
      human_role_matrix: 'validity-required',
      execution_gated: true,
      ao_act_dispatch_separately_gated: true
    },
    pilot_started: false,
    dispatch_created: false,
    ao_act_task_created: false,
    roi_written: false,
    field_memory_written: false,
    frontend_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'Pilot Execution Authorization requires a separate gated task line',
    changed_files_checked: diff,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_R5_FIELD_PILOT_RUNTIME_READINESS_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
