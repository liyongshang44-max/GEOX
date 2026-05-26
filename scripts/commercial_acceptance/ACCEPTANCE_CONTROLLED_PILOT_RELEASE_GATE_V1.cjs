#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const REPORT_PATH = path.join(ROOT, 'docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md');

const REQUIRED_GATES = [
  { id: 'runtime_workers', label: 'Runtime workers production packaging', command: 'pnpm run ci:runtime:workers' },
  { id: 'base_contract_p0', label: 'Base Contract P0', command: 'pnpm run ci:base-contract:p0' },
  { id: 'pest_disease_inspection', label: 'Pest Disease Inspection scenario', command: 'pnpm run ci:scenario:pest-disease-inspection' },
  { id: 'formal_irrigation_e2e', label: 'Formal irrigation E2E scenario bundle', command: 'pnpm run ci:scenario:formal-e2e' },
  { id: 'scenario_productization', label: 'Scenario report/dashboard/frontend productization', command: 'pnpm run ci:scenario:productization' },
  { id: 'device_anomaly_backend', label: 'Device anomaly controlled pilot backend gate', command: 'node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs' },
  { id: 'device_anomaly_frontend', label: 'Device anomaly customer report frontend gate', command: 'node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs' },
  { id: 'server_typecheck', label: 'Server typecheck', command: 'pnpm --filter @geox/server typecheck' },
  { id: 'web_typecheck', label: 'Web typecheck', command: 'pnpm --filter @geox/web typecheck' },
];

const OPTIONAL_EXPERIMENTAL_GATES = [
  { id: 'formal_fertilization', label: 'Formal fertilization scenario', command: 'pnpm run ci:scenario:fertilization', status: 'experimental_not_required' },
];

const PILOT_ELIGIBLE_SCENARIOS = [
  { scenario: 'FORMAL_IRRIGATION', status: 'pilot_eligible', required_gate_ids: ['formal_irrigation_e2e', 'scenario_productization'] },
  { scenario: 'FORMAL_PEST_DISEASE_INSPECTION', status: 'pilot_eligible', required_gate_ids: ['pest_disease_inspection', 'scenario_productization'] },
  { scenario: 'DEVICE_ANOMALY', status: 'pilot_eligible', required_gate_ids: ['device_anomaly_backend', 'device_anomaly_frontend', 'scenario_productization'] },
];

const EXPERIMENTAL_SCENARIOS = [
  { scenario: 'FORMAL_FERTILIZATION', status: 'conditional_pending_ci_proof', required_for_controlled_pilot: false, note: 'Not counted as a mandatory Controlled Pilot sales scenario until ci:scenario:fertilization is green and promoted by contract.' },
];

const KNOWN_LIMITS = [
  'Controlled Pilot covers three sellable scenarios only: formal irrigation, formal pest/disease inspection, and device anomaly/execution failure.',
  'Formal fertilization remains conditional and is not part of the mandatory sales package in this gate.',
  'Device anomaly reports must remain review-gated and not be represented as successful execution without later formal acceptance.',
];

const NOT_FOR_SALE_CLAIMS = [
  'Do not claim full-platform agriculture automation readiness.',
  'Do not claim formal fertilization as a mandatory Controlled Pilot sellable scenario from this gate.',
  'Do not claim device anomaly creates ROI or customer-visible Field Memory before formal acceptance.',
  'Do not claim BEST_EFFORT release readiness when any required gate fails.',
];

function nowIso() { return new Date().toISOString(); }
function tail(s, n = 3000) { return String(s || '').slice(-n); }

function runGate(gate) {
  const started_at = nowIso();
  const r = spawnSync(gate.command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, CONTROLLED_PILOT_GATE: 'STRICT' },
  });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  const output = `${stdout}\n${stderr}`.trim();
  const passed = r.status === 0;
  return {
    id: gate.id,
    label: gate.label,
    command: gate.command,
    required: true,
    passed,
    exit_code: r.status,
    signal: r.signal || null,
    started_at,
    finished_at: nowIso(),
    output_tail: passed ? '' : tail(output),
  };
}

function mdList(items, render) {
  if (!items.length) return '- none';
  return items.map(render).join('\n');
}

function renderReport(payload) {
  const passed = payload.passed_gates;
  const failed = payload.failed_gates;
  return `# Controlled Pilot Readiness Report\n\n` +
    `Generated: ${payload.generated_at}\n\n` +
    `Gate: ${payload.gate}\n\n` +
    `Mode: ${payload.mode}\n\n` +
    `Status: **${payload.status}**\n\n` +
    `## Passed gates\n\n${mdList(passed, (g) => `- ${g.id}: ${g.label} (${g.command})`)}\n\n` +
    `## Failed gates\n\n${mdList(failed, (g) => `- ${g.id}: ${g.label} (${g.command}) exit=${g.exit_code}\\n  - tail: ${JSON.stringify(g.output_tail).slice(0, 1200)}`)}\n\n` +
    `## Pilot eligible scenarios\n\n${mdList(payload.pilot_eligible_scenarios, (s) => `- ${s.scenario}: ${s.status}; gates=${s.required_gate_ids.join(', ')}`)}\n\n` +
    `## Experimental scenarios\n\n${mdList(payload.experimental_scenarios, (s) => `- ${s.scenario}: ${s.status}; required_for_controlled_pilot=${s.required_for_controlled_pilot}; ${s.note}`)}\n\n` +
    `## Known limits\n\n${mdList(payload.known_limits, (x) => `- ${x}`)}\n\n` +
    `## Not for sale claims\n\n${mdList(payload.not_for_sale_claims, (x) => `- ${x}`)}\n\n` +
    `## Machine readable summary\n\n` +
    '```json\n' + JSON.stringify(payload.summary, null, 2) + '\n```\n';
}

function main() {
  const results = REQUIRED_GATES.map(runGate);
  const passed_gates = results.filter((x) => x.passed);
  const failed_gates = results.filter((x) => !x.passed);
  const status = failed_gates.length === 0 ? 'PASS' : 'FAIL';
  const payload = {
    gate: 'CONTROLLED_PILOT_RELEASE_GATE_V1',
    mode: 'STRICT',
    generated_at: nowIso(),
    status,
    passed_gates,
    failed_gates,
    pilot_eligible_scenarios: PILOT_ELIGIBLE_SCENARIOS,
    experimental_scenarios: EXPERIMENTAL_SCENARIOS,
    optional_experimental_gates: OPTIONAL_EXPERIMENTAL_GATES,
    known_limits: KNOWN_LIMITS,
    not_for_sale_claims: NOT_FOR_SALE_CLAIMS,
    summary: {
      status,
      required_gate_count: results.length,
      passed_gate_count: passed_gates.length,
      failed_gate_count: failed_gates.length,
      passed_gate_ids: passed_gates.map((x) => x.id),
      failed_gate_ids: failed_gates.map((x) => x.id),
      pilot_eligible_scenarios: PILOT_ELIGIBLE_SCENARIOS.map((x) => x.scenario),
      experimental_scenarios: EXPERIMENTAL_SCENARIOS.map((x) => x.scenario),
    },
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, renderReport(payload));
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`Controlled Pilot readiness report written to ${path.relative(ROOT, REPORT_PATH)}`);
  if (status !== 'PASS') process.exit(1);
}

main();
