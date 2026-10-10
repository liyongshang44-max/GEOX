'use strict';

const fs = require('node:fs');

const gatePath =
  'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_RELEASE_GATE.cjs';

const h58Path =
  'scripts/governance_acceptance/H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY.cjs';

const h7Path =
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_B5H7_FIELD_MEMORY_SUCCESSOR_BOUNDARY_RECON_V1.cjs';

const gate = fs.readFileSync(gatePath, 'utf8');
const h58 = fs.readFileSync(h58Path, 'utf8');
const h7 = fs.readFileSync(h7Path, 'utf8');

const checks = {};

const childTokens = [
  "run('skill_contract_gap_closure'",
  "run('field_memory'",
  "run('roi_commercial'",
  "run('irrigation_mvp0'",
  "run('d_failure_stale_observation'",
  "run('d_failure_insufficient_evidence'",
  "run('d_failure_approval_rejected'",
];

let previous = -1;
checks.child_order_preserved = childTokens.every((token) => {
  const at = gate.indexOf(token);
  const ok = at > previous;
  previous = at;
  return ok;
});

checks.stale_auto_formal_type_requirement_removed =
  !gate.includes(
    "exactTypes.has('FIELD_RESPONSE_MEMORY') && exactTypes.has('SKILL_PERFORMANCE_MEMORY')"
  );

checks.technical_types_required =
  gate.includes("exactTypes.has('SKILL_PERFORMANCE_MEMORY')")
  && gate.includes("exactTypes.has('DEVICE_RELIABILITY_MEMORY')");

checks.formal_field_response_absence_explicit =
  gate.includes("!exactTypes.has('FIELD_RESPONSE_MEMORY')");

checks.technical_memory_trust_boundary_explicit =
  gate.includes('technicalMemoryTrustBoundaryOk')
  && gate.includes("'FORMAL_FIELD_MEMORY'")
  && gate.includes("'FORMAL_ACCEPTED'")
  && gate.includes('customer_visible_memory')
  && gate.includes('learning_eligible');

checks.exact_memory_gate_preserved =
  gate.includes('exactIdsOk')
  && gate.includes('exactMemoryOk')
  && gate.includes('fmIds.length >= 3');

checks.strict_mode_support_preserved =
  gate.includes('STRICT_RELEASE_GATE');

checks.no_formal_roi_promotion_added =
  !gate.includes('/api/v1/roi-ledger/formalize-from-acceptance');

checks.h58_authority_boundary_preserved =
  h58.includes('technical_memory_not_formal_learning')
  && h58.includes('operator_learning_requires_formal_memory');

checks.h7_successor_boundary_preserved =
  h7.includes('technical_memory_remains_non_formal_in_service')
  && h7.includes('formal_promotion_authority_requires_committed_successor_chain');

const rendered = Object.fromEntries(
  Object.entries(checks).map(
    ([key, value]) => [key, value === true ? 'PASS' : 'FAIL']
  )
);

const ok = Object.values(checks).every((value) => value === true);

process.stdout.write(
  JSON.stringify(
    {
      ok,
      task: 'BLINE_B5RG1_RELEASE_GATE_FIELD_MEMORY_RECON_V1',
      checks: rendered,
    },
    null,
    2
  ) + '\n'
);

if (!ok) process.exitCode = 1;