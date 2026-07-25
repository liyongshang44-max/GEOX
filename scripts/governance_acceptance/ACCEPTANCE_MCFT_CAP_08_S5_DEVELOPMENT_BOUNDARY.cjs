#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '75fc9c509d455c12202ae6c5597f7185796ec3d6';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S5_DEVELOPMENT_BOUNDARY_RESULT.json');
const EXPECTED = [
  '.github/workflows/mcft-cap-08-s5-development-preflight.yml',
  'apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_cap08_s5_residual_calibration_shadow_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_case_prediction_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_persisted_source_reader_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_DEVELOPMENT_BOUNDARY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_RESIDUAL_CALIBRATION_SHADOW_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s5_acceptance_support_v1.ts',
].sort();

function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'CAP08_S5_DEVELOPMENT_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'CAP08_S5_DEVELOPMENT_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'CAP08_S5_DEVELOPMENT_DIFF_CHECK_FAILED');
  const raw = git('diff', '--name-only', `${base}...HEAD`);
  const changed = raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, EXPECTED, 'CAP08_S5_DEVELOPMENT_CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.equal(changed.length, 9);
  assert.equal(changed.filter((f) => f.startsWith('apps/server/src/')).length, 5);
  assert.equal(changed.filter((f) => f.startsWith('scripts/runtime_acceptance/')).length, 2);
  const forbidden = changed.filter((file) =>
    file.includes('/db/migrations/') || file.startsWith('apps/server/src/routes/')
    || file.startsWith('apps/web/') || file.includes('scheduler')
    || file.includes('model_activation') || file.includes('active_config'));
  assert.deepEqual(forbidden, [], 'CAP08_S5_DEVELOPMENT_FORBIDDEN_SURFACE');
  const source = changed.map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
  const declaration = ['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
  assert.equal(source.includes(declaration), false, 'CAP08_S5_DEVELOPMENT_CANDIDATE_DECLARATION_FORBIDDEN');
  const forbiddenTokens = [
    ['production_runtime_source_authorized', 'true'].join(': '),
    ['mcft_cap_09_authorized', 'true'].join(': '),
    ['model_activation_count', '1'].join(': '),
    ['active_config_switch_count', '1'].join(': '),
  ];
  for (const token of forbiddenTokens) {
    assert.equal(source.includes(token), false, `CAP08_S5_DEVELOPMENT_PREMATURE_AUTHORITY:${token}`);
  }
  const result = {
    schema_version: 'geox_mcft_cap08_s5_development_boundary_result_v1',
    status: 'PASS', base_sha: base, subject_sha: git('rev-parse','HEAD'),
    changed_file_count: changed.length, production_source_file_count: 5,
    runtime_acceptance_file_count: 2, migration_delta: 0, route_delta: 0,
    web_delta: 0, scheduler_delta: 0, candidate_declaration_present: false,
    s5_candidate_implemented: false, s5_effective: false, s6_authorized: false,
    mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({ schema_version:'geox_mcft_cap08_s5_development_boundary_result_v1', status:'FAIL', error:error instanceof Error?error.message:String(error) });
  throw error;
}
