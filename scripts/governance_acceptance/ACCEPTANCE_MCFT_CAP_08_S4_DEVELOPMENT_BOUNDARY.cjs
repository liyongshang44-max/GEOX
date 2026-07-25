#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.MCFT_BASE_SHA || '41073db21c550bbed160295ca5ef76d0a04f2f91';
const expected = [
  '.github/workflows/mcft-cap-08-s4-development-preflight.yml',
  'apps/server/src/domain/twin_runtime/cap08_s4_append_forward_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/cap08_s4_late_correction_math_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s4_corrected_canonical_set_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s4_persisted_chain_reader_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_DEVELOPMENT_BOUNDARY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_LATE_CORRECTION_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_APPEND_FORWARD_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s4_acceptance_support_v1.ts',
].sort();

const actual = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`CAP08_S4_DEVELOPMENT_BOUNDARY_MISMATCH:${JSON.stringify({base,actual,expected})}`);
}
const forbiddenPrefixes = [
  'apps/server/src/routes/', 'apps/web/', 'apps/server/src/migrations/',
  'apps/server/src/scheduler/', 'apps/server/src/jobs/',
];
if (actual.some((file) => forbiddenPrefixes.some((prefix) => file.startsWith(prefix)))) {
  throw new Error('CAP08_S4_DEVELOPMENT_FORBIDDEN_PRODUCT_OR_SCHEMA_DELTA');
}
const source = actual.map((file) => fs.readFileSync(path.resolve(file), 'utf8')).join('\n');
for (const token of ['MCFT_CANDIDATE_DECLARATION_V2','"s4_candidate_implemented": true','production_runtime_source_authorized: true','mcft_cap_09_authorized: true']) {
  if (source.includes(token)) throw new Error(`CAP08_S4_DEVELOPMENT_PREMATURE_AUTHORITY:${token}`);
}
console.log(JSON.stringify({status:'PASS',base,changed_file_count:actual.length,files:actual,formal_candidate:false}));
