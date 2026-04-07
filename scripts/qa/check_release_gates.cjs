#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REQUIRED_SCENARIOS = [
  'OBS_NONE',
  'LOW_MOISTURE',
  'HIGH_SALINITY',
  'MULTI_DEVICE_CONFLICT',
  'STALE_READ_MODEL'
];

function parseArgs(argv) {
  const args = { report: 'docs/qa/reports/release_gate_report.json' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--report' && argv[i + 1]) {
      args.report = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function loadReport(reportPath) {
  const resolved = path.resolve(process.cwd(), reportPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`REPORT_NOT_FOUND: ${reportPath}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function main() {
  const args = parseArgs(process.argv);
  const report = loadReport(args.report);
  const matrix = Array.isArray(report.matrix) ? report.matrix : [];

  const matrixById = new Map(matrix.map((row) => [String(row.id || ''), row]));
  const missing = REQUIRED_SCENARIOS.filter((id) => !matrixById.has(id));
  const failed = REQUIRED_SCENARIOS.filter((id) => matrixById.has(id) && matrixById.get(id).passed !== true);

  const hasRollbackRules = Array.isArray(report.rollback_triggers) && report.rollback_triggers.length > 0;

  console.log('=== GEOX 发布门禁核对 ===');
  console.log(`报告: ${args.report}`);
  console.log(`版本: ${report.release_version || 'N/A'}`);
  console.log(`时间: ${report.generated_at || 'N/A'}`);

  if (missing.length > 0) {
    console.log(`缺失场景: ${missing.join(', ')}`);
  }
  if (failed.length > 0) {
    console.log(`失败场景: ${failed.join(', ')}`);
  }

  if (!hasRollbackRules) {
    console.log('缺失回滚触发条件: rollback_triggers 为空');
  }

  const passed = missing.length === 0 && failed.length === 0 && hasRollbackRules;
  console.log(`门禁结论: ${passed ? 'PASS（可发布）' : 'FAIL（禁止发布）'}`);

  if (!passed) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('[ERROR]', error.message || error);
  process.exit(1);
}
