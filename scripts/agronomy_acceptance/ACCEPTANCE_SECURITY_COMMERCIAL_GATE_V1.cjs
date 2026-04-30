#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE_DIR = __dirname;
const SCRIPTS = [
  'ACCEPTANCE_SECURITY_IAM_SCOPE_V1.cjs',
  'ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1.cjs',
  'ACCEPTANCE_SECURITY_APPROVAL_EXECUTION_SEPARATION_V1.cjs',
  'ACCEPTANCE_SECURITY_SKILL_BOUNDARY_V1.cjs',
  'ACCEPTANCE_SECURITY_AUDIT_LOG_V1.cjs',
  'ACCEPTANCE_SECURITY_FAIL_SAFE_MANUAL_TAKEOVER_V1.cjs',
  'ACCEPTANCE_SECURITY_RUNTIME_HARDENING_V1.cjs',
  'ACCEPTANCE_VARIABLE_PRESCRIPTION_V1.cjs',
  'ACCEPTANCE_FIELD_MEMORY_V1.cjs',
];

const CHECK_KEYS = [
  'iam_scope_gate_passed','tenant_isolation_gate_passed','approval_execution_separation_gate_passed','skill_boundary_gate_passed','security_audit_gate_passed','fail_safe_manual_takeover_gate_passed','runtime_hardening_gate_passed','variable_prescription_gate_passed','field_memory_gate_passed',
];

function assertNonTrivialAcceptanceScript(script) {
  const full = path.join(BASE_DIR, script);
  const text = fs.readFileSync(full, 'utf8');

  const staticSuccessPatterns = [
    /console\.log\s*\(\s*JSON\.stringify\s*\(\s*\{\s*ok\s*:\s*true/s,
    /process\.stdout\.write\s*\(\s*`\$\{JSON\.stringify\s*\(\s*\{\s*ok\s*:\s*true/s,
  ];

  const looksStaticSuccess = staticSuccessPatterns.some((re) => re.test(text));
  const hasRealAction =
    text.includes('fetchJson(') ||
    text.includes('spawn(') ||
    text.includes('pool.query(') ||
    text.includes('GET /') ||
    text.includes('POST /');

  if (looksStaticSuccess && !hasRealAction) {
    return {
      ok: false,
      error: 'SECURITY_GATE_STATIC_SUCCESS_SCRIPT_FORBIDDEN',
      script,
    };
  }

  return { ok: true };
}

function parseLastJson(stdout) {
  const t = String(stdout || '').trim();
  const start = t.lastIndexOf('{');
  if (start < 0) return null;
  for (let i = start; i >= 0; i = t.lastIndexOf('{', i - 1)) {
    try { return JSON.parse(t.slice(i)); } catch {}
    if (i === 0) break;
  }
  return null;
}

function runScript(script) {
  return new Promise((resolve) => {
    const full = path.join(BASE_DIR, script);
    if (!fs.existsSync(full)) return resolve({ missing: true, script });
    const env = { ...process.env, BASE_URL: process.env.BASE_URL || process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001', TENANT_ID: process.env.TENANT_ID || 'tenantA', PROJECT_ID: process.env.PROJECT_ID || 'projectA', GROUP_ID: process.env.GROUP_ID || 'groupA', FIELD_ID: process.env.FIELD_ID || 'field_c8_demo', SEASON_ID: process.env.SEASON_ID || 'season_demo', DEVICE_ID: process.env.DEVICE_ID || 'dev_onboard_accept_001' };
    const t0 = Date.now();
    const cp = spawn(process.execPath, [full], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    cp.stdout.on('data', (d) => { out += d.toString(); });
    cp.stderr.on('data', (d) => { err += d.toString(); });
    cp.on('close', (code) => {
      const json = parseLastJson(out);
      const checks = json && json.checks && typeof json.checks === 'object' ? json.checks : {};
      const failedChecks = Object.entries(checks).filter(([,v]) => v === false).map(([k]) => k);
      resolve({ script, exit_code: code ?? 1, duration_ms: Date.now() - t0, json_ok: Boolean(json && json.ok === true), checks, failed_checks: failedChecks, stdout: out, stderr: err });
    });
  });
}

(async () => {
  const results = [];
  for (const s of SCRIPTS) {
    const guard = assertNonTrivialAcceptanceScript(s);
    if (!guard.ok) {
      return console.log(JSON.stringify({
        ok: false,
        gate: 'SECURITY_COMMERCIAL_GATE_V1',
        error: guard.error,
        failed_script: s,
        results,
      }, null, 2));
    }
    const r = await runScript(s);
    if (r.missing) {
      return console.log(JSON.stringify({ ok:false, gate:'SECURITY_COMMERCIAL_GATE_V1', error:'SECURITY_GATE_MISSING_ACCEPTANCE_SCRIPT', failed_script:s, results }, null, 2));
    }
    results.push(r);
    if (r.exit_code !== 0 || !r.json_ok || (r.failed_checks && r.failed_checks.length)) {
      const blockedByFailSafe = /FAIL_SAFE_TRIGGERED|DEVICE_OFFLINE|FAIL_SAFE_OPEN/.test(String(r.stdout) + String(r.stderr));
      return console.log(JSON.stringify({ ok:false, gate:'SECURITY_COMMERCIAL_GATE_V1', error: blockedByFailSafe ? 'SECURITY_GATE_BUSINESS_CHAIN_BLOCKED_BY_FAIL_SAFE' : 'SECURITY_GATE_FAILED', failed_script:r.script, failed_checks:r.failed_checks || [], results }, null, 2));
    }
  }
  const totalChecks = results.reduce((n,r)=>n+Object.keys(r.checks||{}).length,0);
  const failedChecks = results.reduce((n,r)=>n+(r.failed_checks||[]).length,0);
  const checks = {
    iam_scope_gate_passed:true, tenant_isolation_gate_passed:true, approval_execution_separation_gate_passed:true, skill_boundary_gate_passed:true, security_audit_gate_passed:true, fail_safe_manual_takeover_gate_passed:true, runtime_hardening_gate_passed:true, variable_prescription_gate_passed:true, field_memory_gate_passed:true, no_missing_acceptance_scripts:true, no_failed_checks:true, no_static_success_acceptance_scripts:true
  };
  console.log(JSON.stringify({ ok:true, gate:'SECURITY_COMMERCIAL_GATE_V1', summary:{ total_scripts:9, passed_scripts:9, failed_scripts:0, total_checks:totalChecks, failed_checks:failedChecks }, checks, results: results.map(r=>({script:r.script, ok:true, duration_ms:r.duration_ms, checks:r.checks})) }, null, 2));
})();
