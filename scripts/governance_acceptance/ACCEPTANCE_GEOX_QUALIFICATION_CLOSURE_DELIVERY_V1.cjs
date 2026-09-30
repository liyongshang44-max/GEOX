#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function fail(code) { throw new Error(code); }
function assert(value, code) { if (!value) fail(code); }

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const builderRef = 'scripts/qualification/BUILD_GEOX_QUALIFICATION_CLOSURE_DELIVERY_V1.cjs';
const verifierRef = 'scripts/qualification/VERIFY_GEOX_QUALIFICATION_CLOSURE_DELIVERY_V1.cjs';
const interfaceRef = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CLOSURE-DELIVERY-INTERFACE-V1.json';

const builder = fs.readFileSync(path.join(repoRoot, builderRef), 'utf8');
const verifier = fs.readFileSync(path.join(repoRoot, verifierRef), 'utf8');
const spec = JSON.parse(fs.readFileSync(path.join(repoRoot, interfaceRef), 'utf8'));

assert(spec.schema_version === 'geox_mcft_cap09_qualification_closure_delivery_interface_v1', 'CLOSURE_DELIVERY_INTERFACE_SCHEMA_INVALID');
assert(spec.consumer === 'MCFT_CAP_09_CLOSURE_TEAM', 'CLOSURE_DELIVERY_CONSUMER_INVALID');
assert(spec.consumer_rules.migration_team_adjudicates_blockers === false, 'CLOSURE_DELIVERY_BLOCKER_AUTHORITY_LEAK');
assert(spec.non_effects.qcp_semantics_modified === false, 'CLOSURE_DELIVERY_QCP_SEMANTICS_MUTATION_FORBIDDEN');
assert(spec.non_effects.closure_subject_modified === false, 'CLOSURE_DELIVERY_CLOSURE_SUBJECT_MUTATION_FORBIDDEN');
assert(spec.consumer_rules.latest_run_fallback === false, 'CLOSURE_DELIVERY_LATEST_FALLBACK_FORBIDDEN');

assert(builder.includes('VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs'), 'CLOSURE_DELIVERY_SOURCE_MANIFEST_VERIFIER_REQUIRED');
assert(builder.includes('FINALIZED_DELIVERY_MUST_NOT_BE_MODIFIED_IN_PLACE_NEW_DELIVERY_ID_REQUIRED'), 'CLOSURE_DELIVERY_IMMUTABILITY_RULE_REQUIRED');
assert(builder.includes('supersedes_github_lane: false'), 'CLOSURE_DELIVERY_GITHUB_SUPERSESSION_FORBIDDEN');
assert(builder.includes('qcp_semantics_modified: false'), 'CLOSURE_DELIVERY_QCP_NON_EFFECT_REQUIRED');
assert(builder.includes('closure_subject_mutated: false'), 'CLOSURE_DELIVERY_CLOSURE_NON_EFFECT_REQUIRED');
assert(verifier.includes('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_POLICY_WEAKENED'), 'CLOSURE_DELIVERY_FAIL_CLOSED_POLICY_REQUIRED');
assert(verifier.includes('descriptor.latest_run_fallback_used !== false'), 'CLOSURE_DELIVERY_LATEST_RUN_FALLBACK_GUARD_REQUIRED');

const changed = execFileSync('git', ['diff', '--name-only', '8a0012bc81ed5216ef804e61379117be8238f25c', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8'
}).trim().split(/\r?\n/).filter(Boolean);
assert(changed.length > 0, 'CLOSURE_DELIVERY_CHANGESET_EMPTY');
assert(changed.every((p) =>
  p === builderRef ||
  p === verifierRef ||
  p === interfaceRef ||
  p === 'scripts/governance_acceptance/ACCEPTANCE_GEOX_QUALIFICATION_CLOSURE_DELIVERY_V1.cjs'
), 'CLOSURE_DELIVERY_CHANGESET_OUT_OF_SCOPE');
assert(!changed.some((p) => p.startsWith('.github/workflows/')), 'CLOSURE_DELIVERY_GITHUB_WORKFLOW_MUTATION_FORBIDDEN');
assert(!changed.some((p) => p.startsWith('apps/server/src/runtime/')), 'CLOSURE_DELIVERY_RUNTIME_MUTATION_FORBIDDEN');
assert(!changed.some((p) => p.includes('QUALIFICATION-CONTROL-PLANE')), 'CLOSURE_DELIVERY_QCP_MUTATION_FORBIDDEN');

process.stdout.write(`${JSON.stringify({
  schema_version: 'geox_qualification_closure_delivery_acceptance_v1',
  status: 'PASS',
  delivery_interface: 'GEOXQualificationClosureDeliveryV1',
  source_manifest_interface: 'QualificationEvidenceManifestV1',
  exact_subject_binding_guarded: true,
  immutable_delivery_guarded: true,
  latest_run_fallback_forbidden: true,
  blocker_adjudication_authority_retained_by_closure_team: true,
  qcp_semantics_modified: false,
  closure_subject_modified: false,
  github_lane_superseded: false,
  changed_files: changed
}, null, 2)}\n`);
