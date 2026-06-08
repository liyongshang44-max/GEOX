#!/usr/bin/env node
'use strict';

// path: scripts/governance_acceptance/ACCEPTANCE_C8_SEED_DATASET_MODULARITY_V1.cjs
// Purpose: enforce that the C8 controlled-pilot seed dataset is built by a pure dataset builder, not inline seed-runner logic.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const DATASET_REL = 'scripts/demo_seed/datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs';
const SEED_REL = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const DATASET_PATH = path.join(ROOT, DATASET_REL);
const SEED_PATH = path.join(ROOT, SEED_REL);
const PENDING_OPERATION_ID = 'op_plan_c8_irrigation_pending_001';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function must(condition, message, detail) {
  if (!condition) {
    const suffix = detail == null ? '' : `\n${JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function assertIncludes(text, needle, message) {
  assert.equal(text.includes(needle), true, message);
}

function assertNotIncludes(text, needle, message) {
  assert.equal(text.includes(needle), false, message);
}

function assertNotMatches(text, pattern, message) {
  assert.equal(pattern.test(text), false, `${message}: ${pattern}`);
}

function lineOf(text, needle) {
  const index = text.indexOf(needle);
  if (index < 0) return 0;
  return text.slice(0, index).split(/\r?\n/).length;
}

function factPayload(fact) {
  return fact && typeof fact.record_json === 'object' ? fact.record_json.payload ?? {} : {};
}

function isPendingOperationalFact(fact) {
  const record = fact && typeof fact.record_json === 'object' ? fact.record_json : {};
  const type = String(record.type ?? '').trim();
  if (type === 'controlled_pilot_full_review_manifest_v1') return false;
  if (![
    'operation_plan_v1',
    'operation_state_v1',
    'approval_request_v1',
    'approval_decision_v1',
    'decision_recommendation_v1',
    'prescription_v1',
    'ao_act_task_v0',
    'ao_act_receipt_v1',
    'acceptance_result_v1',
    'evidence_artifact_v1',
  ].includes(type)) return false;
  return JSON.stringify(fact).includes(PENDING_OPERATION_ID);
}

must(fs.existsSync(DATASET_PATH), `${DATASET_REL} must exist`);
must(fs.existsSync(SEED_PATH), `${SEED_REL} must exist`);

const datasetText = read(DATASET_REL);
const seedText = read(SEED_REL);

assertIncludes(datasetText, 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1', 'dataset builder must define/export C8_FORMAL_IRRIGATION_FULL_CHAIN_V1');
assertIncludes(datasetText, 'function buildC8FormalIrrigationFullChainDataset', 'dataset builder must define buildC8FormalIrrigationFullChainDataset');
assertIncludes(datasetText, 'module.exports', 'dataset builder must use explicit CommonJS exports');
assertIncludes(datasetText, 'buildC8FormalIrrigationFullChainDataset', 'dataset builder export must include buildC8FormalIrrigationFullChainDataset');

const exported = require(DATASET_PATH);
must(exported.C8_FORMAL_IRRIGATION_FULL_CHAIN_V1, 'dataset builder must export C8_FORMAL_IRRIGATION_FULL_CHAIN_V1');
must(typeof exported.buildC8FormalIrrigationFullChainDataset === 'function', 'dataset builder must export buildC8FormalIrrigationFullChainDataset function');
must(exported.C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.chain_id === 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1', 'dataset chain_id must be stable');

const fixedDataset = exported.buildC8FormalIrrigationFullChainDataset({
  tenant: 'tenantA',
  profile: 'c8-formal-chain',
  nowMs: 1780743364022,
  nowIso: '2026-06-06T17:36:04.022Z',
});

must(fixedDataset.dataset_id === 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1', 'dataset_id must be C8_FORMAL_IRRIGATION_FULL_CHAIN_V1');
must(fixedDataset.dataset_version === 'v1', 'dataset_version must be v1');
must(fixedDataset.tenant_id === 'tenantA', 'dataset tenant_id must come from injected options');
must(fixedDataset.project_id === 'projectA', 'dataset project_id must remain projectA');
must(fixedDataset.group_id === 'groupA', 'dataset group_id must remain groupA');
must(fixedDataset.profile === 'c8-formal-chain', 'dataset profile must round-trip');
must(Array.isArray(fixedDataset.facts) && fixedDataset.facts.length > 0, 'dataset must expose facts array');
must(fixedDataset.rows && typeof fixedDataset.rows === 'object', 'dataset must expose rows object');
must(fixedDataset.metadata && fixedDataset.metadata.field_id === 'field_c8_demo', 'dataset metadata must expose field_id');
must(fixedDataset.metadata.formal_operation_id === 'op_plan_c8_irrigation_formal_001', 'dataset metadata must expose formal_operation_id');
must(Array.isArray(fixedDataset.rows.field_index_v1), 'dataset rows must expose field_index_v1');
must(Array.isArray(fixedDataset.rows.operation_state_v1_optional), 'dataset rows must expose operation_state_v1_optional as optional rows');
must(Array.isArray(fixedDataset.rows.field_memory_v1_optional), 'dataset rows must expose field_memory_v1_optional as optional rows');
must(Array.isArray(fixedDataset.rows.roi_ledger_v1_optional), 'dataset rows must expose roi_ledger_v1_optional as optional rows');
must(fixedDataset.rows.field_index_v1.every((row) => row.field_id === 'field_c8_demo'), 'c8-formal-chain profile must only include C8 formal field', fixedDataset.rows.field_index_v1);
must(!fixedDataset.rows.device_index_v1.some((row) => row.device_id === 'dev_gateway_offline_001'), 'c8-formal-chain profile must exclude offline gateway');
must(!fixedDataset.facts.some(isPendingOperationalFact), 'c8-formal-chain profile must exclude pending operation facts', fixedDataset.facts.filter(isPendingOperationalFact).map(factPayload));
must(!fixedDataset.rows.operation_state_v1_optional.some((row) => JSON.stringify(row).includes(PENDING_OPERATION_ID)), 'c8-formal-chain profile must exclude pending operation_state_v1_optional rows', fixedDataset.rows.operation_state_v1_optional);

assertIncludes(seedText, "require('./datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs')", 'seed runner must require the C8 dataset builder');
assertIncludes(seedText, 'buildC8FormalIrrigationFullChainDataset', 'seed runner must call the dataset builder');
assertIncludes(seedText, 'datasetToSeedPlan', 'seed runner must adapt dataset output to legacy seed plan boundary');

const inlineDatasetTokens = [
  'const fieldsAll =',
  'const devicesAll =',
  'const observations = [',
  'const approvalDecision =',
  'const recommendation = { recommendation_id',
  'const operationPlan =',
  'const formalMemory =',
  'const pendingOperation =',
  'const rows = { field_index_v1',
];
for (const token of inlineDatasetTokens) {
  assertNotIncludes(seedText, token, `seed runner must not inline C8 dataset construction token ${token} at line ${lineOf(seedText, token)}`);
}

const forbiddenBuilderPatterns = [
  [/require\(['"]pg['"]\)/, 'dataset builder must not import pg'],
  [/require\(['"]node:http['"]\)/, 'dataset builder must not import node:http'],
  [/require\(['"]http['"]\)/, 'dataset builder must not import http'],
  [/require\(['"]node:https['"]\)/, 'dataset builder must not import node:https'],
  [/require\(['"]https['"]\)/, 'dataset builder must not import https'],
  [/\bpool\.query\s*\(/, 'dataset builder must not query SQL through pool.query'],
  [/\bclient\.query\s*\(/, 'dataset builder must not query SQL through client.query'],
  [/\bquery\s*\(/, 'dataset builder must not expose generic SQL query calls'],
  [/\bfetch\s*\(/, 'dataset builder must not call fetch'],
  [/\bXMLHttpRequest\b/, 'dataset builder must not use XMLHttpRequest'],
  [/\.env\.ci\b/, 'dataset builder must not read .env.ci'],
  [/\.env\b/, 'dataset builder must not read .env'],
  [/\bprocess\.env\b/, 'dataset builder must not read process.env'],
  [/\bloadEnv\b/, 'dataset builder must not call loadEnv'],
  [/\bfs\.(readFileSync|existsSync|writeFileSync)\b/, 'dataset builder must not read or write files'],
  [/\bDate\.now\s*\(/, 'dataset builder must not call Date.now'],
  [/new\s+Date\s*\(/, 'dataset builder must not instantiate Date'],
];
for (const [pattern, message] of forbiddenBuilderPatterns) {
  assertNotMatches(datasetText, pattern, message);
}

console.log('[ACCEPTANCE_C8_SEED_DATASET_MODULARITY_V1] PASS');
