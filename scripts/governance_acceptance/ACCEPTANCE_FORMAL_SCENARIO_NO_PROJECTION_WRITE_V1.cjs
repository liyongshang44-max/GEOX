#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const SCAN_TARGETS = [
  {
    label: 'formal_scenario_scripts',
    dir: path.join(ROOT, 'scripts', 'agronomy_acceptance'),
    filePattern: /^ACCEPTANCE_FORMAL_.*\.cjs$/,
  },
  {
    label: 'device_anomaly_scenario_script',
    dir: path.join(ROOT, 'scripts', 'agronomy_acceptance'),
    filePattern: /^ACCEPTANCE_DEVICE_ANOMALY_E2E_V1\.cjs$/,
  },
  {
    label: 'formal_scenario_kernel',
    dir: path.join(ROOT, 'apps', 'server', 'src', 'services', 'scenarios'),
    filePattern: /\.ts$/,
  },
];

const BANNED_PROJECTION_PREFIXES = [
  'derived_sensing_state_index_v1',
  'device_observation_index_v1',
  'operation_state_v1',
  'customer_report',
  'roi_ledger',
  'field_memory',
  'acceptance_result',
];

const ALLOWED_SURFACES = [
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
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function normalizeForSqlSearch(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/[`"'\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function lineOf(source, index) {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function tablePattern() {
  return BANNED_PROJECTION_PREFIXES
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

function detectViolations(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const normalized = normalizeForSqlSearch(raw);
  const table = tablePattern();
  const patterns = [
    {
      kind: 'sql_insert_update',
      re: new RegExp(`\\b(insert\\s+into|update)\\s+(?:[a-z0-9_]+\\s*\\.\\s*)?(${table})(?:[a-z0-9_]*)\\b`, 'gi'),
    },
    {
      kind: 'query_builder_insert_update',
      re: new RegExp(`\\b(insertinto|updatetable|insert|update)\\s*\\(\\s*(${table})(?:[a-z0-9_]*)\\b`, 'gi'),
    },
  ];
  const violations = [];
  for (const p of patterns) {
    for (const match of normalized.matchAll(p.re)) {
      const tableName = match[2];
      violations.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: lineOf(normalized, match.index ?? 0),
        kind: p.kind,
        operation: match[1],
        banned_projection: tableName,
        snippet: normalized.slice(Math.max(0, (match.index ?? 0) - 80), (match.index ?? 0) + 160).trim(),
      });
    }
  }
  return violations;
}

function filesToScan() {
  const files = [];
  for (const target of SCAN_TARGETS) {
    for (const file of walk(target.dir)) {
      if (target.filePattern.test(path.basename(file))) {
        files.push({ target: target.label, file });
      }
    }
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

const scanned = filesToScan();
const violations = scanned.flatMap(({ file }) => detectViolations(file));
const output = {
  ok: violations.length === 0,
  gate: 'FORMAL_SCENARIO_NO_PROJECTION_WRITE_V1',
  scan_scope: SCAN_TARGETS.map((x) => ({ label: x.label, dir: path.relative(ROOT, x.dir).replace(/\\/g, '/'), file_pattern: String(x.filePattern) })),
  scanned_files: scanned.map((x) => path.relative(ROOT, x.file).replace(/\\/g, '/')),
  banned_projection_prefixes: BANNED_PROJECTION_PREFIXES,
  allowed_surfaces: ALLOWED_SURFACES,
  violations,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
