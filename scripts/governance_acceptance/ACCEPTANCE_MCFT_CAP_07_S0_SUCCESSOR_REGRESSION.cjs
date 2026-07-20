#!/usr/bin/env node
// Purpose: validate preserved S0 contracts and externally effective authority from S1 or later delivery contexts.
// Boundary: governance-only successor regression; no S0 seed-state or changed-file-boundary assertion.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_S0_AUTHORIZATION_RESULT.json');
const CAP = 'docs/digital_twin/mcft/cap_07';
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const checks = [];
const check = (ok, name, detail = null) => {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) throw new Error(name + (detail ? `:${detail}` : ''));
};

const required = [
  `${CAP}/GEOX-MCFT-CAP-07-TASK.md`,
  `${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-ROUTE-OWNERSHIP-LOCK-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-HARD-ACCEPTANCE-LEDGER-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-ATTESTATION-RETENTION-STORE-CONTRACT-V1.json`,
  `${CAP}/GEOX-MCFT-CAP-07-WORKFLOW-DECLARATION-V1.json`,
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
];

try {
  for (const p of required) check(exists(p), `REQUIRED_PATH:${p}`);

  const task = fs.readFileSync(path.join(ROOT, `${CAP}/GEOX-MCFT-CAP-07-TASK.md`), 'utf8');
  check(/document_status:\s*\nFROZEN/.test(task), 'TASKBOOK_FROZEN');
  check(/S0_candidate_pr_authorized:\s*\ntrue/.test(task), 'TASKBOOK_S0_HISTORICAL_AUTHORIZATION_PRESERVED');

  const manifest = load(`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`);
  const authority = load(`${CAP}/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json`);
  const matrix = load(`${CAP}/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json`);
  const routes = load(`${CAP}/GEOX-MCFT-CAP-07-ROUTE-OWNERSHIP-LOCK-V1.json`);
  const ledger = load(`${CAP}/GEOX-MCFT-CAP-07-HARD-ACCEPTANCE-LEDGER-V1.json`);
  const s1 = load(`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`);
  const predecessor = load(`${CAP}/GEOX-MCFT-CAP-07-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`);
  const retention = load(`${CAP}/GEOX-MCFT-CAP-07-ATTESTATION-RETENTION-STORE-CONTRACT-V1.json`);
  const registry = load('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');

  check(manifest.document_status === 'FROZEN', 'MANIFEST_FROZEN');
  check(manifest.s0_candidate_pr_authorized === false, 'S0_CANDIDATE_AUTHORITY_CONSUMED');
  check(manifest.implementation_authorized === true, 'SUCCESSOR_IMPLEMENTATION_AUTHORITY_PRESENT');
  check(manifest.runtime_source_authorized === false && manifest.canonical_write_authorized === false && manifest.mcft_cap_08_authorized === false, 'SUCCESSOR_AUTHORITY_NO_FORBIDDEN_ESCALATION');

  const s0Effective = manifest.s0_external_effectiveness || {};
  check(s0Effective.status === 'PASS' && s0Effective.effective_frontier === 'S1', 'S0_EXTERNAL_EFFECTIVENESS_PRESERVED');
  check(s0Effective.consumption_record_ref === `${CAP}/GEOX-MCFT-CAP-07-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`, 'S0_CONSUMPTION_RECORD_REF_EXACT');
  check(predecessor.status === 'PASS', 'S0_EXTERNAL_ATTESTATION_CONSUMABLE');
  check(predecessor.subject_commit === s0Effective.merge_commit, 'S0_ATTESTATION_SUBJECT_MATCH');
  check(predecessor.semantic_artifact_digest === s0Effective.semantic_artifact_digest, 'S0_ATTESTATION_SEMANTIC_DIGEST_MATCH');
  check(predecessor.transport_archive_sha256 === s0Effective.transport_archive_sha256, 'S0_ATTESTATION_TRANSPORT_DIGEST_MATCH');

  check(authority.status === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'S0_HISTORICAL_AUTHORITY_RECORD_PRESERVED');
  check(authority.runtime_source_authorized === false && authority.canonical_write_authorized === false && authority.mcft_cap_08_authorized === false, 'S0_HISTORICAL_ZERO_FORBIDDEN_AUTHORITY');

  check(Array.isArray(matrix.profile_families) && matrix.profile_families.length === 8 && new Set(matrix.profile_families).size === 8, 'EIGHT_PROFILE_FAMILIES');
  check(Array.isArray(matrix.rows) && matrix.rows.length === 40 && new Set(matrix.rows.map((r) => `${r.source_name}|${r.profile_family}`)).size === 40, 'SOURCE_MATRIX_EXACT_UNIQUE_ROWS');
  check(Array.isArray(routes.rows) && routes.rows.length === 20 && new Set(routes.rows.map((r) => `${r.method} ${r.exact_path}`)).size === 20, 'ROUTE_LOCK_UNIQUE');
  check(routes.rows.filter((r) => r.exact_path.includes('/runtime')).length === 10 && routes.rows.filter((r) => r.exact_path.includes('/runtime')).every((r) => r.method === 'GET'), 'CANONICAL_RUNTIME_GET_ONLY_LOCK');
  check(ledger.item_count === ledger.items.length && new Set(ledger.items.map((i) => i.item_id)).size === ledger.item_count, 'HARD_ACCEPTANCE_UNIQUE');

  check(s1.s1_candidate_implemented === true && s1.implementation_authorized === true, 'S1_SUCCESSOR_AUTHORITY_NOT_REGRESSED');
  check(s1.runtime_authority_delta === 'PURE_DOMAIN_CONTRACTS_ONLY' && s1.canonical_write_authority_delta === 'ZERO', 'S1_SUCCESSOR_BOUNDARY_PRESERVED');
  check(s1.predecessor_effective_evidence_requirement && s1.predecessor_effective_evidence_requirement.status === 'PASS', 'S1_PREDECESSOR_EVIDENCE_PRESERVED');

  const cap = registry.capabilities.find((x) => x.capability_line === 'MCFT-CAP-07');
  check(Boolean(cap), 'REGISTRY_CAP07_PRESENT');
  check(cap.authoritative_candidate_status_paths.includes(`${CAP}/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json`) && cap.authoritative_candidate_status_paths.includes(`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`), 'REGISTRY_S0_S1_PATHS');
  check(cap.candidate_transition_fields.some((x) => x.status_file.endsWith('CURRENT-AUTHORITY-V1.json') && x.field_path === 'status'), 'REGISTRY_S0_TRANSITION_PRESERVED');

  check(retention.store_contract_id === 'MCFT_ATTESTATION_S3_COMPAT_OBJECT_LOCK_V1' && retention.namespace_prefix === 'mcft-attestations-v1' && retention.product_namespace_forbidden === 'evidence-exports-v1', 'RETENTION_AUTHORITY_SEPARATE');
  check(retention.required_bucket_controls.versioning === 'Enabled' && retention.required_bucket_controls.object_lock === 'Enabled' && retention.required_bucket_controls.worm_mode === 'COMPLIANCE', 'RETENTION_WORM_CONTRACT');

  const result = {
    schema_version: 'geox_mcft_cap_07_s0_authorization_result_v1',
    status: 'PASS',
    execution_mode: 'SUCCESSOR_REGRESSION_MODE',
    subject_commit: process.env.GITHUB_SHA || null,
    checks,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  console.log(`MCFT-CAP-07 S0 successor regression: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ schema_version: 'geox_mcft_cap_07_s0_authorization_result_v1', status: 'FAIL', execution_mode: 'SUCCESSOR_REGRESSION_MODE', error: String(error && error.message || error), checks }, null, 2) + '\n');
  console.error(error);
  process.exit(1);
}
