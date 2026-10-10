'use strict';

const fs = require('node:fs');

const task = 'BLINE_B5H9F1_TECHNICAL_CONFIDENCE_PATCH_SCOPE_RECON_V1';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`REQUIRED_FILE_MISSING:${path}`);
  return fs.readFileSync(path, 'utf8');
}

function pass(checks, name, value) {
  checks[name] = value ? 'PASS' : 'FAIL';
}

const child = read('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
const h7 = read('scripts/governance_acceptance/ACCEPTANCE_BLINE_B5H7_FIELD_MEMORY_SUCCESSOR_BOUNDARY_RECON_V1.cjs');

const checks = {};

pass(
  checks,
  'legacy_universal_confidence_assertion_present_before_patch',
  child.includes('memory_has_confidence: byScopeItems.every((item) => Number(item?.confidence) > 0)'),
);

pass(
  checks,
  'image_recognition_confidence_fixture_is_unrelated_and_preserved',
  child.includes('image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 }'),
);

pass(
  checks,
  'h7_tracks_legacy_confidence_token_before_patch',
  h7.includes("'memory_has_confidence'"),
);

pass(
  checks,
  'no_field_memory_fixture_confidence_fabrication_token_present',
  !child.includes('memory_confidence_fixture')
    && !child.includes('technical_memory_confidence')
    && !child.includes('confidence_override'),
);

const ok = Object.values(checks).every((value) => value === 'PASS');
process.stdout.write(`${JSON.stringify({ ok, task, checks }, null, 2)}\n`);
if (!ok) process.exit(1);
