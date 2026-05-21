#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  schema: path.join(root, 'packages/contracts/src/schema/evidence_artifact_v1.ts'),
  policy: path.join(root, 'apps/server/src/domain/evidence/formal_evidence_policy_v1.ts'),
  service: path.join(root, 'apps/server/src/services/flight_table/flight_table_evidence_v1.ts'),
  route: path.join(root, 'apps/server/src/routes/dev/flight_table_evidence_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function fail(message) {
  console.error(`[flight-table-not-formal-evidence] FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}

function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

const schema = read(files.schema);
const policy = read(files.policy);
const service = read(files.service);
const route = read(files.route);

// Contract schema must support real evidence kinds and trust metadata.
for (const kind of ['image', 'note', 'metric', 'trajectory', 'water_delivery_receipt', 'media', 'log']) {
  assertIncludes(schema, `"${kind}"`, 'evidence_artifact_v1 schema kind set');
}
for (const field of ['source_lane', 'is_simulated', 'formal_eligible', 'evidence_level', 'dev_source', 'run_id']) {
  assertIncludes(schema, field, 'evidence_artifact_v1 schema trust fields');
}
assertIncludes(schema, 'EvidenceArtifactV1PayloadSchema', 'evidence_artifact_v1 schema');
assertIncludes(schema, 'assertFlightTableEvidenceArtifactNotFormalV1', 'flight table schema guard');
assertIncludes(schema, 'FLIGHT_TABLE_EVIDENCE_MUST_NOT_BE_FORMAL', 'flight table schema guard');

// Formal policy classifier must hard-code Flight Table as dev-only, simulated, non-formal DEBUG evidence.
assertIncludes(policy, 'classifyEvidenceArtifactV1', 'formal evidence policy classifier');
assertIncludes(policy, 'FLIGHT_TABLE_MARKERS', 'formal evidence policy flight table markers');
assertIncludes(policy, 'isFlightTableEvidence', 'formal evidence policy flight table predicate');
assertIncludes(policy, 'FLIGHT_TABLE_DEV_EVIDENCE_NOT_FORMAL', 'formal evidence policy blocking reason');
assertIncludes(policy, 'FLIGHT_TABLE_FORMAL_ELIGIBLE_FORBIDDEN', 'formal evidence policy forbidden formal eligible reason');
assertIncludes(policy, 'flightTableEvidence ? false', 'formal evidence policy formal eligible hard false');
assertIncludes(policy, 'flightTableEvidence ? "SIMULATED_DEV_ONLY"', 'formal evidence policy source lane hard downgrade');
assertIncludes(policy, 'flightTableEvidence ? "DEBUG"', 'formal evidence policy evidence level hard downgrade');
assertIncludes(policy, 'formal_evidence_passed: formal.length > 0', 'formal evidence policy pass calculation');

// Flight Table artifact creation must write explicit dev-only evidence fields and validate against regression.
assertIncludes(service, 'EvidenceArtifactV1PayloadSchema.parse', 'flight table service artifact schema parse');
assertIncludes(service, 'assertFlightTableEvidenceArtifactNotFormalV1(payload)', 'flight table service schema guard');
assertIncludes(service, 'classifyEvidenceArtifactV1(payload', 'flight table service classifier guard');
assertIncludes(service, 'FLIGHT_TABLE_EVIDENCE_CLASSIFICATION_REGRESSION', 'flight table service classifier regression error');
assertIncludes(service, 'source_lane: "SIMULATED_DEV_ONLY"', 'flight table service source lane');
assertIncludes(service, 'formal_eligible: false', 'flight table service formal eligible false');
assertIncludes(service, 'is_simulated: true', 'flight table service simulated true');
assertIncludes(service, 'evidence_level: "DEBUG"', 'flight table service debug evidence level');
assertIncludes(service, 'source: "FLIGHT_TABLE_DEV_EVIDENCE"', 'flight table service dev source');
assertIncludes(service, 'dev_source: "FLIGHT_TABLE"', 'flight table service dev source marker');
assertIncludes(service, 'kind: "metric"', 'flight table service metric artifact');
assertIncludes(service, 'kind: "trajectory"', 'flight table service trajectory artifact');
assertIncludes(service, 'kind: "water_delivery_receipt"', 'flight table service water delivery receipt artifact');

// Dev route must remain feature-flagged and admin scoped.
assertIncludes(route, 'ENABLE_FLIGHT_TABLE_API', 'flight table dev route feature flag');
assertIncludes(route, 'security.admin', 'flight table dev route admin scope');
assertIncludes(route, '/api/v1/dev/flight-table/runs/:runId/evidence/run', 'flight table dev route path');
assertNotIncludes(route, 'acceptance.evaluate', 'flight table dev route must not use ordinary acceptance scope');

// Direct textual regression checks.
assert(!/source:\s*["']FLIGHT_TABLE[^"']*["'][\s\S]{0,500}formal_eligible:\s*true/.test(service), 'Flight Table source must not write formal_eligible=true');
assert(!/dev_source:\s*["']FLIGHT_TABLE["'][\s\S]{0,500}formal_eligible:\s*true/.test(service), 'Flight Table dev_source must not write formal_eligible=true');
assert(!/source_lane:\s*["']FORMAL_OPERATION["'][\s\S]{0,500}source:\s*["']FLIGHT_TABLE/.test(service), 'Flight Table source must not be FORMAL_OPERATION');

console.log('[flight-table-not-formal-evidence] PASS');
