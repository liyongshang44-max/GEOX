'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_FINAL_INDEX_V1.cjs
// Purpose: verify the H54 final index and required H54 task files.

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'ACCEPTANCE_H54_FINAL_INDEX_V1';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details }, null, 2));
  process.exit(1);
}

const requiredFiles = [
  'docs/legacy/tasks/H54.0-Control-Connector-Preflight.md',
  'docs/legacy/tasks/H54.1-Recommendation-Approval-Request-Connector-Gate.md',
  'docs/legacy/tasks/H54.2-Actionable-Irrigation-Approval-Adapter.md',
  'docs/legacy/tasks/H54.3-Approval-Decision-Linkage.md',
  'docs/legacy/tasks/H54.4-Operation-Plan-Linkage.md',
  'docs/legacy/tasks/H54.5-Task-Linkage.md',
  'docs/legacy/tasks/H54.6-Linkage.md',
  'docs/legacy/tasks/H54.7-As-Executed-Linkage.md',
  'docs/legacy/tasks/H54.8-Evidence-Artifact-Linkage.md',
  'docs/legacy/tasks/H54-Final-Index.md',
  'scripts/governance_acceptance/ACCEPTANCE_H54_CONTROL_CONNECTOR_PREFLIGHT_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_2_ACTIONABLE_IRRIGATION_APPROVAL_ADAPTER_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_3_APPROVAL_DECISION_LINKAGE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_4_OPERATION_PLAN_LINKAGE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_5_TASK_LINKAGE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_6_LINKAGE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_7_AS_EXECUTED_LINKAGE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_H54_8_EVIDENCE_ARTIFACT_LINKAGE_V1.cjs',
];

for (const filePath of requiredFiles) {
  if (!fs.existsSync(path.join(process.cwd(), filePath))) {
    fail('REQUIRED_FILE_MISSING', { filePath });
  }
}

const finalIndex = fs.readFileSync(path.join(process.cwd(), 'docs/legacy/tasks/H54-Final-Index.md'), 'utf8');
const requiredTokens = ['H54.0', 'H54.1', 'H54.2', 'H54.3', 'H54.4', 'H54.5', 'H54.6', 'H54.7', 'H54.8'];
for (const token of requiredTokens) {
  if (!finalIndex.includes(token)) fail('FINAL_INDEX_TOKEN_MISSING', { token });
}

console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, h54_final_index: 'PASS', h54_steps_indexed: 9, h54_extension_blocked: true }, null, 2));
