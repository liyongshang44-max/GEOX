#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const SCENARIO_SCRIPT_DIR = path.join(REPO_ROOT, 'scripts', 'agronomy_acceptance');
const SCENARIO_SERVICE_DIR = path.join(REPO_ROOT, 'apps', 'server', 'src', 'services', 'scenarios');

const BANNED_TARGETS = [
  'derived_sensing_state_index_v1',
  'device_observation_index_v1',
  'operation_state_v1',
  'customer_report',
  'roi_ledger',
  'field_memory',
  'acceptance_result',
];

const DIRECT_WRITE_PATTERNS = [
  'insert\\s+into',
  'update',
  'delete\\s+from',
  'truncate\\s+table',
  'merge\\s+into',
];

function listFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...listFiles(p, predicate));
    else if (predicate(p)) out.push(p);
  }
  return out.sort();
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function tableRegex(target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffix = target === 'customer_report' || target === 'roi_ledger' || target === 'field_memory' || target === 'acceptance_result'
    ? '(?:_[a-z0-9]+)*'
    : '';
  return `(?:"|\\b)${escaped}${suffix}(?:"|\\b)`;
}

function findViolations(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const cleaned = stripComments(source);
  const violations = [];
  const lines = cleaned.split(/\r?\n/);

  for (const target of BANNED_TARGETS) {
    const table = tableRegex(target);
    for (const writePattern of DIRECT_WRITE_PATTERNS) {
      const re = new RegExp(`${writePattern}\\s+${table}`, 'i');
      lines.forEach((line, idx) => {
        if (re.test(line)) {
          violations.push({
            file: path.relative(REPO_ROOT, filePath).replace(/\\/g, '/'),
            line: idx + 1,
            banned_target: target,
            write_pattern: writePattern.replace(/\\s\+/g, ' '),
            snippet: line.trim().slice(0, 240),
          });
        }
      });
    }

    const multiLineRe = new RegExp(`(?:${DIRECT_WRITE_PATTERNS.join('|')})[\\s\\S]{0,240}${table}`, 'i');
    if (multiLineRe.test(cleaned)) {
      const match = cleaned.match(multiLineRe);
      const before = cleaned.slice(0, match.index ?? 0);
      const line = before.split(/\r?\n/).length;
      const snippet = String(match[0] ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (!violations.some((v) => v.line === line && v.banned_target === target)) {
        violations.push({
          file: path.relative(REPO_ROOT, filePath).replace(/\\/g, '/'),
          line,
          banned_target: target,
          write_pattern: 'multi_line_sql_write',
          snippet,
        });
      }
    }
  }
  return violations;
}

const checkedFiles = [
  ...listFiles(SCENARIO_SCRIPT_DIR, (p) => /ACCEPTANCE_FORMAL_.*\.cjs$/.test(path.basename(p))),
  ...listFiles(SCENARIO_SERVICE_DIR, (p) => /\.ts$/.test(path.basename(p))),
];

const violations = checkedFiles.flatMap(findViolations);
const checks = {
  formal_scenario_scripts_scanned: checkedFiles.some((p) => p.includes(`${path.sep}scripts${path.sep}agronomy_acceptance${path.sep}`)),
  scenario_kernel_services_scanned: checkedFiles.some((p) => p.includes(`${path.sep}apps${path.sep}server${path.sep}src${path.sep}services${path.sep}scenarios${path.sep}`)),
  no_direct_projection_or_result_table_write: violations.length === 0,
};

const output = {
  ok: Object.values(checks).every(Boolean),
  scenario: 'FORMAL_SCENARIO_NO_PROJECTION_WRITE_V1',
  checked_paths: [
    'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_*.cjs',
    'apps/server/src/services/scenarios/*.ts',
  ],
  banned_targets: BANNED_TARGETS,
  allowed_fixture_scope: [
    'field fixture',
    'device fixture',
    'credential fixture',
    'management_zone fixture',
    'geometry fixture',
    'formal raw sample route/service',
    'formal AO-ACT service/API',
    'formal acceptance service/API',
    'formal report service/API',
    'formal ROI domain service',
    'formal memory domain service',
  ],
  checks,
  checked_files: checkedFiles.map((p) => path.relative(REPO_ROOT, p).replace(/\\/g, '/')),
  violations,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
