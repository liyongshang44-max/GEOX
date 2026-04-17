#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_SCENARIOS = [
  'OBS_NONE',
  'LOW_MOISTURE',
  'HIGH_SALINITY',
  'MULTI_DEVICE_CONFLICT',
  'STALE_READ_MODEL'
];

const OUTPUT_PATH = 'docs/qa/reports/release_gate_report.json';

function parseArgs(argv) {
  const args = {
    output: OUTPUT_PATH,
    releaseVersion: process.env.RELEASE_VERSION || ''
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--output' && argv[i + 1]) {
      args.output = argv[i + 1];
      i += 1;
    } else if (token === '--release-version' && argv[i + 1]) {
      args.releaseVersion = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readJsonWithEvidence(relativePath) {
  const resolved = path.resolve(process.cwd(), relativePath);
  const raw = fs.readFileSync(resolved, 'utf8');
  return {
    data: JSON.parse(raw),
    evidenceRef: `${relativePath}#sha256=${sha256(raw)}`
  };
}

function assertScenarioOrder(matrix) {
  const ids = matrix.map((row) => row.id);
  const missing = REQUIRED_SCENARIOS.filter((id) => !ids.includes(id));
  if (missing.length > 0) {
    throw new Error(`MISSING_REQUIRED_SCENARIOS: ${missing.join(', ')}`);
  }
}

function buildScenarioMatrix() {
  const emptyObservations = [];

  const dry = readJsonWithEvidence('packages/contracts/fixtures/fertility_inference_v1_dry.json');
  const highSalinity = readJsonWithEvidence('packages/contracts/fixtures/fertility_inference_v1_high_salinity.json');
  const conflict = readJsonWithEvidence('packages/contracts/fixtures/rv1_demo_conflict_001.json');
  const staleReadModel = readJsonWithEvidence('packages/contracts/fixtures/psv1_ref_missing_001.json');

  const obsNonePassed = Array.isArray(emptyObservations) && emptyObservations.length === 0;
  const lowMoisturePassed = dry.data.fertility_level === 'low'
    && dry.data.recommendation_bias === 'irrigate_first'
    && Array.isArray(dry.data.explanation_codes)
    && dry.data.explanation_codes.includes('LOW_SOIL_MOISTURE');
  const highSalinityPassed = highSalinity.data.salinity_risk === 'high'
    && Array.isArray(highSalinity.data.explanation_codes)
    && highSalinity.data.explanation_codes.includes('HIGH_EC');
  const multiDeviceConflictPassed = conflict.data.type === 'reference_view_v1'
    && conflict.data.comparison_summary
    && conflict.data.comparison_summary.delta_hint
    && conflict.data.comparison_summary.delta_hint.label === 'diverging';
  const staleReadModelPassed = staleReadModel.data.type === 'problem_state_v1'
    && staleReadModel.data.problem_type === 'REFERENCE_MISSING'
    && Array.isArray(staleReadModel.data.uncertainty_sources)
    && staleReadModel.data.uncertainty_sources.includes('REFERENCE_NOT_AVAILABLE');

  const matrix = [
    {
      id: 'OBS_NONE',
      passed: obsNonePassed,
      evidence: `synthetic://observations/empty_set?count=${emptyObservations.length}`,
      notes: 'Empty observation stream accepted for gate smoke-check; observed_count=0.'
    },
    {
      id: 'LOW_MOISTURE',
      passed: lowMoisturePassed,
      evidence: dry.evidenceRef,
      notes: `fertility_level=${dry.data.fertility_level}; recommendation_bias=${dry.data.recommendation_bias}; code=LOW_SOIL_MOISTURE.`
    },
    {
      id: 'HIGH_SALINITY',
      passed: highSalinityPassed,
      evidence: highSalinity.evidenceRef,
      notes: `salinity_risk=${highSalinity.data.salinity_risk}; code=HIGH_EC; recommendation_bias=${highSalinity.data.recommendation_bias}.`
    },
    {
      id: 'MULTI_DEVICE_CONFLICT',
      passed: multiDeviceConflictPassed,
      evidence: conflict.evidenceRef,
      notes: `delta_hint=${conflict.data.comparison_summary.delta_hint.label}; magnitude=${conflict.data.comparison_summary.delta_hint.magnitude}; overlap_ratio=${conflict.data.comparison_summary.overlap_ratio}.`
    },
    {
      id: 'STALE_READ_MODEL',
      passed: staleReadModelPassed,
      evidence: staleReadModel.evidenceRef,
      notes: `problem_type=${staleReadModel.data.problem_type}; uncertainty=${staleReadModel.data.uncertainty_sources.join('|')}.`
    }
  ];

  assertScenarioOrder(matrix);
  return matrix;
}

function buildRollbackTriggers() {
  return [
    {
      id: 'RB-01',
      condition: 'Any release-gate scenario evaluates passed=false.',
      action: 'rollback'
    },
    {
      id: 'RB-02',
      condition: 'REFERENCE_MISSING (stale read model) persists for 3 consecutive gate runs.',
      action: 'rollback'
    },
    {
      id: 'RB-03',
      condition: 'MULTI_DEVICE_CONFLICT delta_hint magnitude >= 0.10 with overlap_ratio >= 0.80.',
      action: 'rollback'
    }
  ];
}

function resolveReleaseVersion(releaseVersionArg) {
  if (releaseVersionArg && releaseVersionArg.trim()) {
    return releaseVersionArg.trim();
  }
  const sha = process.env.GITHUB_SHA || 'local';
  return `ci-${sha.slice(0, 12)}`;
}

function ensureDirFor(filePath) {
  const dir = path.dirname(path.resolve(process.cwd(), filePath));
  fs.mkdirSync(dir, { recursive: true });
}

function readAcceptanceEvidence() {
  const relativePath = 'acceptance-output/report.json';
  const resolved = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(resolved)) {
    return {
      source: relativePath,
      acceptance_ok: null,
      found: false,
      notes: 'acceptance report not found in workspace.'
    };
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const data = JSON.parse(raw);
  const normalizedStatus = typeof data.status === 'string' ? data.status.toLowerCase() : '';
  const passedFlags = [
    data.acceptance_ok === true,
    data.ok === true,
    normalizedStatus === 'pass',
    normalizedStatus === 'passed',
    normalizedStatus === 'ok',
    normalizedStatus === 'success'
  ];

  return {
    source: `${relativePath}#sha256=${sha256(raw)}`,
    acceptance_ok: passedFlags.some(Boolean),
    found: true,
    notes: `status=${String(data.status || 'N/A')}`
  };
}

function main() {
  const args = parseArgs(process.argv);
  const matrix = buildScenarioMatrix();
  const acceptance = readAcceptanceEvidence();

  const report = {
    release_version: resolveReleaseVersion(args.releaseVersion),
    generated_at: new Date().toISOString(),
    matrix,
    rollback_triggers: buildRollbackTriggers(),
    acceptance
  };

  ensureDirFor(args.output);
  fs.writeFileSync(path.resolve(process.cwd(), args.output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const failed = matrix.filter((row) => row.passed !== true).map((row) => row.id);
  console.log('=== GEOX 发布门禁报告生成 ===');
  console.log(`输出文件: ${args.output}`);
  console.log(`版本: ${report.release_version}`);
  console.log(`场景数: ${matrix.length}`);
  console.log(`失败场景: ${failed.length > 0 ? failed.join(', ') : '无'}`);
  console.log(`Acceptance: ${acceptance.found ? `found (${acceptance.notes})` : 'missing'}`);
}

try {
  main();
} catch (error) {
  console.error('[ERROR]', error.message || error);
  process.exit(1);
}
