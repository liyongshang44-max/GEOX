const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

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
const known_limits = ['FORMAL_FERTILIZATION = conditional_pending_ci_proof', 'required_for_controlled_pilot = false'];
const not_for_sale_claims = ['FORMAL_FERTILIZATION is NOT part of mandatory controlled pilot sales gate.'];

function runGate(command) {
  const result = spawnSync(command, { stdio: 'inherit', shell: true, encoding: 'utf8' });
  return {
    command,
    ok: result.status === 0,
    exit_code: result.status
  };
}

function toList(items) {
  return items.length === 0 ? '- none' : items.map((item) => `- ${item}`).join('\n');
}

function writeReport(summary, passed_gates, failed_gates) {
  const reportPath = path.resolve(process.cwd(), 'docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md');
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
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf8');
}

const results = REQUIRED_GATES.map((gate) => ({ ...gate, ...runGate(gate.command) }));
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
  failed_gates: failed_gates.map((gate) => ({ id: gate.id, command: gate.command, exit_code: gate.exit_code })),
  known_limits,
  not_for_sale_claims
}, null, 2)}\n`);
if (summary.status !== 'PASS') process.exit(1);
