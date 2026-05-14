#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
function read(rel) { const full = path.join(root, rel); if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`); return fs.readFileSync(full, 'utf8'); }
function has(file, token, label) { const text = read(file); if (!text.includes(token)) throw new Error(`${label}: missing ${token}`); }

const dynamic = 'scripts/governance_acceptance/ACCEPTANCE_BASE_CONTRACT_DYNAMIC_NEGATIVE_E2E_V1.cjs';
const pkg = 'package.json';

has(dynamic, 'acceptanceReceiptDoesNotPass', 'receipt success must not pass acceptance dynamic check');
has(dynamic, 'flightTableDynamicBoundary', 'Flight Table must not be customer-valid dynamic check');
has(dynamic, 'roiFromAsExecutedNotCustomerVisible', 'as_executed ROI must not be customer visible dynamic check');
has(dynamic, 'technicalMemoryDoesNotBecomeLearning', 'skill/judge technical memory must not be formal learning dynamic check');
has(dynamic, 'runExistingVariableTaskDynamic', 'variable task no-auto-ACK dynamic check');
has(dynamic, 'ACCEPTANCE_VARIABLE_ACTION_TASK_V1.cjs', 'variable dynamic script integration');
has(dynamic, '/api/v1/acceptance/evaluate', 'acceptance API live call');
has(dynamic, '/api/v1/roi-ledger/from-as-executed', 'ROI API live call');
has(dynamic, '/api/v1/operator/learning-validation', 'learning validation API live call');
has(dynamic, 'customer_visible_value', 'ROI customer visible assertion');
has(dynamic, 'FORMAL_ACCEPTED', 'formal ROI forbidden assertion');
has(dynamic, 'FORMAL_LEARNING_ACCEPTED', 'formal learning forbidden assertion');
has(dynamic, 'operation_plan_not_auto_acked', 'operation plan ACK dynamic assertion');
has(pkg, 'ci:governance:base-contract-dynamic-negative', 'package dynamic gate script');
has(pkg, 'ACCEPTANCE_BASE_CONTRACT_DYNAMIC_NEGATIVE_E2E_V1.cjs', 'package dynamic gate target');

console.log('[BASE_CONTRACT_DYNAMIC_NEGATIVE_GATE_V1] PASSED');
console.log('[BASE_CONTRACT_DYNAMIC_NEGATIVE_GATE_V1] Checked dynamic negative e2e gate coverage and package entrypoint.');
