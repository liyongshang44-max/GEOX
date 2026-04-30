#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASE_URL = process.env.BASE_URL || process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001';
const RELEASE_AUDIT = 'GEOX_RELEASE_AUDIT_EVIDENCE_BUNDLE_V1';

const GATE_SCRIPTS = [
  'ACCEPTANCE_SECURITY_COMMERCIAL_GATE_V1.cjs',
  'ACCEPTANCE_VARIABLE_PRESCRIPTION_V1.cjs',
  'ACCEPTANCE_FIELD_MEMORY_V1.cjs',
];
const securityAcceptanceScripts = [
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_IAM_SCOPE_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_APPROVAL_EXECUTION_SEPARATION_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_SKILL_BOUNDARY_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_AUDIT_LOG_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_FAIL_SAFE_MANUAL_TAKEOVER_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_RUNTIME_HARDENING_V1.cjs',
];

const mustExist = {
  fieldMemory: [
    'apps/server/src/services/field_memory_service.ts',
    'apps/server/src/routes/field_memory_v1.ts',
    'packages/contracts/src/field_memory/field_memory_v1.ts',
    'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs',
  ],
  variablePrescription: [
    'apps/server/src/domain/field/management_zone_v1.ts',
    'apps/server/src/routes/management_zones_v1.ts',
    'apps/server/src/domain/prescription/variable_prescription_v1.ts',
    'apps/server/src/domain/prescription/variable_action_task_v1.ts',
    'apps/server/src/domain/execution/as_executed_v1.ts',
    'apps/server/src/domain/acceptance/skills.ts',
    'apps/server/src/domain/roi/roi_ledger_v1.ts',
    'scripts/agronomy_acceptance/ACCEPTANCE_VARIABLE_PRESCRIPTION_V1.cjs',
  ],
  security: [
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_IAM_SCOPE_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_APPROVAL_EXECUTION_SEPARATION_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_SKILL_BOUNDARY_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_AUDIT_LOG_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_FAIL_SAFE_MANUAL_TAKEOVER_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_RUNTIME_HARDENING_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_COMMERCIAL_GATE_V1.cjs',
  ],
  securityDocs: [
    'docs/security/GEOX_SEMI_INDUSTRIAL_CONTROL_SAFETY_BOUNDARY_V1.md',
    'docs/security/GEOX_TENANT_ISOLATION_V1.md',
    'docs/security/GEOX_APPROVAL_EXECUTION_SEPARATION_V1.md',
    'docs/security/GEOX_SKILL_SAFETY_BOUNDARY_V1.md',
    'docs/security/GEOX_SECURITY_AUDIT_LOG_V1.md',
    'docs/security/GEOX_FAIL_SAFE_MANUAL_TAKEOVER_V1.md',
    'docs/security/GEOX_RUNTIME_HARDENING_V1.md',
    'docs/security/GEOX_SECURITY_COMMERCIAL_GATE_V1.md',
  ],
  hardeningFiles: [
    '.env.production.example',
    'docker-compose.prod.yml',
    'docker-compose.staging.yml',
  ],
};

function parseLastJson(output) {
  const t = String(output || '').trim();
  for (let i = t.lastIndexOf('{'); i >= 0; i = t.lastIndexOf('{', i - 1)) {
    try { return JSON.parse(t.slice(i)); } catch {}
    if (i === 0) break;
  }
  return null;
}

function findText(root, needles) {
  const stack = [root];
  let blob = '';
  while (stack.length) {
    const cur = stack.pop();
    const list = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of list) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (/\.(ts|js|cjs|mjs|sql|yml|yaml|md|json)$/i.test(e.name)) {
        blob += `\n${fs.readFileSync(full, 'utf8')}`;
      }
    }
  }
  return Object.fromEntries(needles.map((n) => [n, blob.includes(n)]));
}

function runGate(script) {
  return new Promise((resolve) => {
    const full = path.join(__dirname, script);
    if (!fs.existsSync(full)) return resolve({ ok: false, error: 'MISSING_GATE_SCRIPT', script });
    const cp = spawn(process.execPath, [full], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    cp.stdout.on('data', (d) => { out += d.toString(); });
    cp.stderr.on('data', (d) => { err += d.toString(); });
    cp.on('close', (code) => {
      const json = parseLastJson(out);
      resolve({ script, exit_code: code ?? 1, json, ok: code === 0 && json && json.ok === true, stdout: out, stderr: err });
    });
  });
}

function detectStaticSuccessScript(relativePath) {
  const full = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(full)) return { missing: true, static_success: false };

  const text = fs.readFileSync(full, 'utf8');
  const staticSuccess =
    /console\.log\s*\(\s*JSON\.stringify\s*\(\s*\{\s*ok\s*:\s*true/s.test(text);

  const hasRealAction =
    text.includes('fetchJson(') ||
    text.includes('spawn(') ||
    text.includes('pool.query(') ||
    text.includes('GET /') ||
    text.includes('POST /');

  return {
    missing: false,
    static_success: staticSuccess && !hasRealAction,
  };
}

async function getOpenApiSnapshot() {
  const res = await fetch(`${BASE_URL}/api/v1/openapi.json`);
  if (!res.ok) throw new Error(`OPENAPI_FETCH_FAILED_${res.status}`);
  return res.json();
}

(async () => {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const evidenceDir = path.join(REPO_ROOT, 'artifacts/release_evidence', ts);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const gateResults = [];
  for (const s of GATE_SCRIPTS) gateResults.push(await runGate(s));

  const staticChecks = {
    fieldMemoryFiles: mustExist.fieldMemory.every((p) => fs.existsSync(path.join(REPO_ROOT, p))),
    variablePrescriptionFiles: mustExist.variablePrescription.every((p) => fs.existsSync(path.join(REPO_ROOT, p))),
    securityFiles: mustExist.security.every((p) => fs.existsSync(path.join(REPO_ROOT, p))),
    securityDocs: mustExist.securityDocs.every((p) => fs.existsSync(path.join(REPO_ROOT, p))),
    hardeningFiles: mustExist.hardeningFiles.every((p) => fs.existsSync(path.join(REPO_ROOT, p))),
  };

  const migrationText = findText(path.join(REPO_ROOT, 'apps/server/db/migrations'), ['field_memory_v1', 'management_zone_v1', 'security_audit_event_v1', 'fail_safe_event_v1', 'manual_takeover_v1']);
  const prodCodeText = findText(path.join(REPO_ROOT, 'apps/server/src'), ['VARIABLE_BY_ZONE', 'variable_irrigation_acceptance_v1', 'VARIABLE_WATER_SAVED', 'ZONE_COMPLETION_RATE', 'VARIABLE_EXECUTION_RELIABILITY', 'GEOX_ALLOWED_ORIGINS', 'GEOX_RUNTIME_ENV', 'AUTH_PRODUCTION_TOKEN_SOURCE_INVALID']);

  const securityEverywhere = findText(REPO_ROOT, ['security_audit_event_v1', 'fail_safe_event_v1', 'manual_takeover_v1']);
  const staticSecurityAcceptanceScripts = securityAcceptanceScripts.map((p) => ({ path: p, ...detectStaticSuccessScript(p) }));

  let openapi = {};
  let openapiError = null;
  try { openapi = await getOpenApiSnapshot(); } catch (e) { openapiError = String(e.message || e); }

  const schemas = openapi?.components?.schemas || {};
  const paths = openapi?.paths || {};
  const openapiChecks = {
    schemas: ['FieldMemoryV1', 'ManagementZoneV1', 'VariablePrescriptionPlanV1', 'VariableActionTaskFromPrescriptionRequest', 'VariableZoneApplicationV1', 'VariableAcceptanceMetricsV1', 'SecurityAuditEventV1', 'FailSafeEventV1', 'ManualTakeoverV1'].every((k) => Object.prototype.hasOwnProperty.call(schemas, k)),
    paths: ['/api/v1/field-memory', '/api/v1/field-memory/summary', '/api/v1/fields/{field_id}/zones', '/api/v1/prescriptions/variable/from-recommendation', '/api/v1/actions/task/from-variable-prescription', '/api/v1/as-executed/from-receipt', '/api/v1/acceptance/evaluate', '/api/v1/roi-ledger/from-as-executed', '/api/v1/security/audit-events', '/api/v1/fail-safe/events', '/api/v1/manual-takeovers'].every((k) => Object.prototype.hasOwnProperty.call(paths, k)),
  };

  const releaseFiles = [
    'scripts/agronomy_acceptance/ACCEPTANCE_VARIABLE_PRESCRIPTION_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs',
    'scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_COMMERCIAL_GATE_V1.cjs',
  ];
  const legacyViolations = [];
  for (const f of releaseFiles) {
    const text = fs.existsSync(path.join(REPO_ROOT, f)) ? fs.readFileSync(path.join(REPO_ROOT, f), 'utf8') : '';
    if (text.includes('/api/control/')) legacyViolations.push(`${f}:/api/control/`);
    if (text.includes('/api/devices/')) legacyViolations.push(`${f}:/api/devices/`);
  }

  fs.writeFileSync(path.join(evidenceDir, 'security_gate_result.json'), JSON.stringify(gateResults[0] || {}, null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'variable_prescription_result.json'), JSON.stringify(gateResults[1] || {}, null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'field_memory_result.json'), JSON.stringify(gateResults[2] || {}, null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'openapi_contract_snapshot.json'), JSON.stringify({ openapi_error: openapiError, schemas: Object.keys(schemas), paths: Object.keys(paths) }, null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'repo_static_checks.json'), JSON.stringify({ staticChecks, migrationText, prodCodeText, securityEverywhere, legacyViolations, staticSecurityAcceptanceScripts }, null, 2));

  const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const serverPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps/server/package.json'), 'utf8'));
  const packageScriptPresent =
    rootPkg?.scripts?.['acceptance:release-audit:evidence-bundle:v1'] === 'node scripts/agronomy_acceptance/ACCEPTANCE_RELEASE_AUDIT_EVIDENCE_BUNDLE_V1.cjs' &&
    serverPkg?.scripts?.['acceptance:release-audit:evidence-bundle:v1'] === 'node ../../scripts/agronomy_acceptance/ACCEPTANCE_RELEASE_AUDIT_EVIDENCE_BUNDLE_V1.cjs';

  const checks = {
    security_commercial_gate_passed: Boolean(gateResults[0]?.ok),
    variable_prescription_gate_passed: Boolean(gateResults[1]?.ok),
    field_memory_gate_passed: Boolean(gateResults[2]?.ok),
    field_memory_files_present: staticChecks.fieldMemoryFiles,
    variable_prescription_files_present: staticChecks.variablePrescriptionFiles,
    security_files_present: staticChecks.securityFiles && staticChecks.securityDocs,
    no_static_security_acceptance_scripts:
      securityAcceptanceScripts.every((p) => !detectStaticSuccessScript(p).static_success),
    field_memory_migration_present: migrationText.field_memory_v1,
    management_zone_migration_present: migrationText.management_zone_v1,
    security_audit_migration_present: migrationText.security_audit_event_v1,
    fail_safe_migration_present: migrationText.fail_safe_event_v1 && migrationText.manual_takeover_v1,
    openapi_contains_field_memory: openapiChecks.schemas && openapiChecks.paths,
    openapi_contains_variable_prescription: openapiChecks.schemas && openapiChecks.paths,
    openapi_contains_security_audit: openapiChecks.schemas && openapiChecks.paths,
    openapi_contains_fail_safe: openapiChecks.schemas && openapiChecks.paths,
    no_legacy_routes_in_release_acceptance: legacyViolations.length === 0,
    package_release_script_present: packageScriptPresent,
    release_evidence_bundle_written: true,
  };

  const summary = {
    ok: Object.values(checks).every(Boolean),
    release_audit: RELEASE_AUDIT,
    generated_at: now.toISOString(),
    summary: {
      runtime_gates_passed: checks.security_commercial_gate_passed && checks.variable_prescription_gate_passed && checks.field_memory_gate_passed,
      static_checks_passed: checks.field_memory_files_present && checks.variable_prescription_files_present && checks.security_files_present,
      openapi_checks_passed: checks.openapi_contains_field_memory && checks.openapi_contains_variable_prescription && checks.openapi_contains_security_audit && checks.openapi_contains_fail_safe,
      legacy_checks_passed: checks.no_legacy_routes_in_release_acceptance,
      evidence_files_written: checks.release_evidence_bundle_written,
    },
    checks,
  };
  fs.writeFileSync(path.join(evidenceDir, 'release_audit_summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, release_audit: RELEASE_AUDIT, checks, evidence_dir: path.relative(REPO_ROOT, evidenceDir) }, null, 2));
  process.exit(summary.ok ? 0 : 1);
})();
