const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.resolve(ROOT, 'docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md');

const REQUIRED_GATES = [
  { id: 'runtime_workers', command: 'pnpm run ci:runtime:workers' },
  { id: 'base_contract_p0', command: 'pnpm run ci:base-contract:p0' },
  { id: 'scenario_pest_disease_inspection', command: 'pnpm run ci:scenario:pest-disease-inspection' },
  { id: 'scenario_formal_e2e', command: 'pnpm run ci:scenario:formal-e2e' },
  { id: 'scenario_productization', command: 'pnpm run ci:scenario:productization' },
  { id: 'device_anomaly_controlled_pilot', command: 'node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs' },
  { id: 'customer_device_anomaly_report', command: 'node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs' },
  { id: 'server_typecheck', command: 'pnpm --filter @geox/server typecheck' },
  { id: 'web_typecheck', command: 'pnpm --filter @geox/web typecheck' }
];

const pilot_eligible_scenarios = ['FORMAL_IRRIGATION', 'FORMAL_PEST_DISEASE_INSPECTION', 'DEVICE_ANOMALY'];
const experimental_scenarios = ['FORMAL_FERTILIZATION'];
const known_limits = [
  'FORMAL_FERTILIZATION = conditional_pending_ci_proof',
  'required_for_controlled_pilot = false',
  'ci:controlled-pilot expects the acceptance runtime to be running; it does not start Docker services or downgrade missing runtime to PASS.'
];
const not_for_sale_claims = [
  'FORMAL_FERTILIZATION is NOT part of mandatory controlled pilot sales gate.',
  'No BEST_EFFORT sales claim is allowed when any required gate fails.',
  'Device anomaly does not create ROI or customer-visible Field Memory before formal acceptance.'
];

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^[ '"]|[ '"]$/g, '');
    out[key] = value;
  }
  return out;
}

function loadAcceptanceTokens() {
  const tokenPath = path.join(ROOT, 'config/auth/security_acceptance_tokens.json');
  if (!fs.existsSync(tokenPath)) return {};
  const parsed = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const tokens = Array.isArray(parsed.tokens) ? parsed.tokens : [];
  const active = (predicate) => tokens.find((token) => predicate(token) && !token.revoked)?.token;
  const admin = active((token) => token.role === 'admin' && Array.isArray(token.scopes) && token.scopes.includes('security.admin'));
  const client = active((token) => token.role === 'client');
  const tenantB = active((token) => token.tenant_id === 'tenantB');
  return {
    ...(admin ? { ADMIN_TOKEN: admin, AO_ACT_TOKEN: admin, TOKEN: admin, GEOX_TOKEN: admin, GEOX_AO_ACT_TOKEN: admin } : {}),
    ...(client ? { READ_ONLY_TOKEN: client, CLIENT_TOKEN: client, NON_ACCEPTANCE_TOKEN: client } : {}),
    ...(tenantB ? { OTHER_TENANT_TOKEN: tenantB } : {}),
    INVALID_TOKEN: 'definitely_invalid_token'
  };
}

function buildGateEnv() {
  const dotEnvCi = loadDotEnvFile(path.join(ROOT, '.env.ci'));
  const dotEnv = loadDotEnvFile(path.join(ROOT, '.env'));
  const tokenEnv = loadAcceptanceTokens();
  const env = {
    ...process.env,
    ...dotEnv,
    ...dotEnvCi,
    ...tokenEnv
  };
  env.BASE_URL = env.BASE_URL || 'http://127.0.0.1:3001';
  env.API_BASE_URL = env.API_BASE_URL || env.BASE_URL;
  env.DATABASE_URL = env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
  env.TENANT_ID = env.TENANT_ID || 'tenantA';
  env.PROJECT_ID = env.PROJECT_ID || 'projectA';
  env.GROUP_ID = env.GROUP_ID || 'groupA';
  return env;
}

function tail(value, max = 4200) {
  const raw = String(value || '').trim();
  return raw.length <= max ? raw : raw.slice(raw.length - max);
}

function runGate(gate, env) {
  const started_at = new Date().toISOString();
  console.log(`[controlled-pilot-release-gate] START ${gate.id}: ${gate.command}`);
  const result = spawnSync(gate.command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output_tail = result.status === 0 ? '' : tail(`${stdout}\n${stderr}`);
  const record = {
    id: gate.id,
    command: gate.command,
    ok: result.status === 0,
    exit_code: result.status,
    signal: result.signal || null,
    started_at,
    finished_at: new Date().toISOString(),
    output_tail,
  };
  if (record.ok) {
    console.log(`[controlled-pilot-release-gate] PASS ${gate.id}`);
  } else {
    console.error(`[controlled-pilot-release-gate] FAIL ${gate.id} exit=${record.exit_code}`);
    console.error(`[controlled-pilot-release-gate] ${gate.id} output_tail=${JSON.stringify(output_tail)}`);
  }
  return record;
}

function toList(items) {
  return items.length === 0 ? '- none' : items.map((item) => `- ${item}`).join('\n');
}

function jsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
}

function writeReport(summary, passed_gates, failed_gates) {
  const report = [
    '# Controlled Pilot Readiness Report',
    '',
    `Status: ${summary.status}`,
    '',
    '## Passed gates',
    toList(passed_gates.map((gate) => `${gate.id}: ${gate.command}`)),
    '',
    '## Failed gates',
    toList(failed_gates.map((gate) => `${gate.id}: ${gate.command} (exit=${gate.exit_code})`)),
    '',
    '## Failed gate output tails',
    failed_gates.length === 0 ? '- none' : failed_gates.map((gate) => `### ${gate.id}\n\n${jsonBlock({ command: gate.command, exit_code: gate.exit_code, output_tail: gate.output_tail })}`).join('\n\n'),
    '',
    '## Pilot eligible scenarios',
    toList(pilot_eligible_scenarios),
    '',
    '## Experimental scenarios',
    toList(experimental_scenarios),
    '',
    '## Known limits',
    toList(known_limits),
    '',
    '## Not for sale claims',
    toList(not_for_sale_claims),
    '',
    '## Machine readable summary',
    jsonBlock(summary),
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
}

const gateEnv = buildGateEnv();
console.log('[controlled-pilot-release-gate] strict mode environment', {
  BASE_URL: gateEnv.BASE_URL,
  API_BASE_URL: gateEnv.API_BASE_URL,
  DATABASE_URL: gateEnv.DATABASE_URL ? '<set>' : '<missing>',
  ADMIN_TOKEN: gateEnv.ADMIN_TOKEN ? '<set>' : '<missing>',
  AO_ACT_TOKEN: gateEnv.AO_ACT_TOKEN ? '<set>' : '<missing>',
  CLIENT_TOKEN: gateEnv.CLIENT_TOKEN ? '<set>' : '<missing>',
});

const results = REQUIRED_GATES.map((gate) => ({ ...gate, ...runGate(gate, gateEnv) }));
const passed_gates = results.filter((gate) => gate.ok);
const failed_gates = results.filter((gate) => !gate.ok);

const summary = {
  status: failed_gates.length === 0 ? 'PASS' : 'FAIL',
  required_gate_count: REQUIRED_GATES.length,
  passed_gate_count: passed_gates.length,
  failed_gate_count: failed_gates.length,
  passed_gate_ids: passed_gates.map((gate) => gate.id),
  failed_gate_ids: failed_gates.map((gate) => gate.id),
  pilot_eligible_scenarios,
  experimental_scenarios
};

writeReport(summary, passed_gates, failed_gates);
process.stdout.write(`${JSON.stringify({
  ...summary,
  passed_gates: passed_gates.map((gate) => ({ id: gate.id, command: gate.command })),
  failed_gates: failed_gates.map((gate) => ({ id: gate.id, command: gate.command, exit_code: gate.exit_code, output_tail: gate.output_tail })),
  known_limits,
  not_for_sale_claims
}, null, 2)}\n`);
if (summary.status !== 'PASS') process.exit(1);
