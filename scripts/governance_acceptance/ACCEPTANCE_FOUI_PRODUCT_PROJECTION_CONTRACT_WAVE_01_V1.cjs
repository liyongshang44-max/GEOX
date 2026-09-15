'use strict';

// GEOX FOUI-PROJECTION-CONTRACT-WAVE-01 governance gate.
// This gate proves the first product-projection contracts remain read-only, non-authoritative,
// decision-time aware, and fail-closed against UI/command semantic promotion.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const root = process.cwd();
const contractPath = path.join(root, 'apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts');
const schemaPath = path.join(root, 'apps/server/src/product_projection/contracts/product_projection_contracts_v1.schema.json');
const negativePath = path.join(root, 'scripts/governance_acceptance/FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_NEGATIVE_V1.ts');
const projectionRoot = path.join(root, 'apps/server/src/product_projection');

function read(file) {
  assert.ok(fs.existsSync(file), `missing required file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function mustContain(text, needle, label) {
  assert.ok(text.includes(needle), `${label}: missing ${needle}`);
}

function mustNotMatch(text, pattern, label) {
  assert.equal(pattern.test(text), false, `${label}: forbidden pattern ${pattern}`);
}

const contract = read(contractPath);
const schemaText = read(schemaPath);
read(negativePath);
const schema = JSON.parse(schemaText);

// P0 common envelope invariants.
mustContain(contract, 'NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY', 'P0 authority ceiling');
mustContain(contract, 'non_authoritative: true', 'P0 non-authoritative invariant');
mustContain(contract, 'CURRENT_PROJECTION', 'P0 current semantics');
mustContain(contract, 'DECISION_TIME_SNAPSHOT', 'P0 decision-time semantics');
mustContain(contract, 'HISTORICAL_REPLAY', 'P0 historical replay semantics');
mustContain(contract, 'requires_command_reauthorization: true', 'P0 query/command separation');

// Amendment-03: current world and decision-time world are separate contract surfaces.
mustContain(contract, 'current_context', 'P1 current context');
mustContain(contract, 'decision_time_basis', 'P1 decision-time basis');
mustContain(contract, 'current_state_substitution_forbidden: true', 'P1 no-current-state fallback');
mustContain(contract, 'later_changes', 'P1 later changes isolation');
mustContain(contract, 'EXACT_REF_LINKED', 'P1 exact composition');
mustContain(contract, 'UNRESOLVED', 'P1 unresolved composition');

// Product triage is explicitly not product-owned risk authority.
mustContain(contract, 'presentation_rank', 'P3 presentation rank');
mustContain(contract, 'source_declared_severity', 'P3 source-declared severity');
mustContain(contract, 'ATTENTION_QUEUE_PRODUCT_OWNED_PRIORITY_FORBIDDEN', 'P3 priority negative guard');
mustContain(contract, 'ATTENTION_QUEUE_PRODUCT_OWNED_SEVERITY_FORBIDDEN', 'P3 severity negative guard');
mustContain(contract, 'ATTENTION_QUEUE_PRODUCT_OWNED_RISK_SCORE_FORBIDDEN', 'P3 risk-score negative guard');

// Capability availability is a three-axis derivation, not route/API existence.
mustContain(contract, 'product_implementation', 'P2 implementation axis');
mustContain(contract, 'authority_maturity', 'P2 authority axis');
mustContain(contract, 'operational_eligibility', 'P2 operational axis');
mustContain(contract, 'CAPABILITY_AVAILABILITY_DERIVATION_MISMATCH', 'P2 deterministic mapping guard');

// JSON schema must carry the same safety boundary.
assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
for (const def of ['ProductProjectionEnvelopeV1', 'GovernedActionCaseProjectionV1', 'CapabilityAvailabilityProjectionV1', 'AttentionQueueProjectionV1']) {
  assert.ok(schema.$defs && schema.$defs[def], `JSON schema missing $defs.${def}`);
}
assert.equal(schema.$defs.ProductProjectionEnvelopeV1.properties.non_authoritative.const, true);
assert.equal(schema.$defs.ProductProjectionEnvelopeV1.properties.authority_ceiling.const, 'NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY');
assert.equal(schema.$defs.InteractionIntentHint.properties.requires_command_reauthorization.const, true);
assert.equal(schema.$defs.GovernedActionCaseProjectionV1.properties.decision_time_basis.properties.current_state_substitution_forbidden.const, true);

// FOUI-PROJ physical boundary: read/composition code must not grow command or authority-write behavior.
const files = walk(projectionRoot).filter((file) => /\.(ts|mts|cts|js|mjs|cjs)$/.test(file));
for (const file of files) {
  const relative = path.relative(root, file);
  const text = read(file);
  mustNotMatch(text, /\bapp\.(?:post|put|patch|delete)\s*\(/, `${relative} command route`);
  mustNotMatch(text, /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z0-9_.]+\s+SET|DELETE\s+FROM)\b/i, `${relative} domain/database write`);
  mustNotMatch(text, /buildRecommendationApprovalDecisionSubmissionV1|buildOperationPlanFromApprovalDecisionV1|transitionDispatchQueueState|buildAcceptanceResultFromEvidenceArtifactsV1/, `${relative} authority builder import/use`);
}

// Contract source itself must remain transport/database independent.
mustNotMatch(contract, /from\s+["']pg["']/, 'contract pg import');
mustNotMatch(contract, /FastifyInstance/, 'contract Fastify dependency');
mustNotMatch(contract, /Date\.now\s*\(/, 'contract wall-clock dependency');

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  assert.equal(result.status, 0, `${label} failed with status ${result.status}`);
}

// Machine-execute negative behavior and a focused type compilation of the contract file.
run('pnpm', ['exec', 'tsx', 'scripts/governance_acceptance/FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_NEGATIVE_V1.ts'], 'FOUI negative contract qualification');
run('pnpm', ['exec', 'tsc', '--pretty', 'false', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts'], 'FOUI contract type compilation');

console.log('ACCEPTANCE_FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_V1=PASS');
