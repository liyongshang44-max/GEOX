'use strict';

const fs = require('node:fs');

const task = 'BLINE_B5H7F1_H58_SELFLABEL_RECON_V1';
const h58Path = 'scripts/governance_acceptance/H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY.cjs';
const childPath = 'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`REQUIRED_FILE_MISSING:${path}`);
  return fs.readFileSync(path, 'utf8');
}

const h58 = read(h58Path);
const child = read(childPath);
const checks = {
  h58_reads_exact_child_path: h58.includes("const fieldMemoryAcceptance = read('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');"),
  brittle_child_selflabel_requirement_removed: !h58.includes("  'ACCEPTANCE_FIELD_MEMORY_V1',"),
  successor_boundary_semantics_preserved: [
    "'formal_field_memory_not_auto_promoted'",
    "'formal_memory_lane_not_auto_promoted'",
    "'technical_memory_not_customer_visible'",
    "'technical_memory_not_learning_eligible'",
    "'formal_promotion_route_present'",
    "'DEVICE_RELIABILITY_MEMORY'",
    "'SKILL_PERFORMANCE_MEMORY'",
    "'memory_linked_to_current_chain'",
    "'openapi_matches_routes'",
  ].every((token) => h58.includes(token)),
  child_successor_boundary_semantics_present: [
    'formal_field_memory_not_auto_promoted',
    'formal_memory_lane_not_auto_promoted',
    'technical_memory_not_customer_visible',
    'technical_memory_not_learning_eligible',
    'formal_promotion_route_present',
  ].every((token) => child.includes(token)),
};

const ok = Object.values(checks).every(Boolean);
process.stdout.write(`${JSON.stringify({
  ok,
  task,
  checks: Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v ? 'PASS' : 'FAIL'])),
}, null, 2)}\n`);
if (!ok) process.exit(1);
