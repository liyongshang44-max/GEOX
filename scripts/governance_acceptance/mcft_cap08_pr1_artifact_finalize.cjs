#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output');
const ARTIFACT_PATH = path.join(OUTPUT, 'MCFT_CAP_08_PR1_AUTHORITY_ARTIFACT.json');
const RESULT_FILES = [
  'MCFT_CAP_08_AUTHORITY_RECONCILIATION_RESULT.json',
  'MCFT_CAP_08_CHANGED_FILE_BOUNDARY_RESULT.json',
  'MCFT_CAP_08_CANDIDATE_MERGE_TREE_EQUIVALENCE_RESULT.json',
  'MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB_RESULT.json',
  'MCFT_CAP_08_WRITER_PRIVILEGE_NEGATIVE_DB_RESULT.json',
  'MCFT_CAP_08_LATE_CORRECTION_MATH_RESULT.json',
  'MCFT_CAP_08_PROGRESS_PREDICATES_DB_RESULT.json',
  'MCFT_CAP_08_ZERO_RUNTIME_DATA_DELTA_DB_RESULT.json',
];

function readResult(name) {
  const file = path.join(OUTPUT, name);
  if (!fs.existsSync(file)) throw new Error(`RESULT_MISSING:${name}`);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value.status !== 'PASS') throw new Error(`RESULT_NOT_PASS:${name}:${value.error || 'UNKNOWN'}`);
  return value;
}

function sha256(relativePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

try {
  const results = Object.fromEntries(RESULT_FILES.map((name) => [name, readResult(name)]));
  const tree = results['MCFT_CAP_08_CANDIDATE_MERGE_TREE_EQUIVALENCE_RESULT.json'];
  const platform = results['MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB_RESULT.json'];
  const negative = results['MCFT_CAP_08_WRITER_PRIVILEGE_NEGATIVE_DB_RESULT.json'];
  const late = results['MCFT_CAP_08_LATE_CORRECTION_MATH_RESULT.json'];
  const progress = results['MCFT_CAP_08_PROGRESS_PREDICATES_DB_RESULT.json'];
  const zeroDelta = results['MCFT_CAP_08_ZERO_RUNTIME_DATA_DELTA_DB_RESULT.json'];
  if (platform.relation_count !== 30
      || platform.production_schema_path !== 'DOCKER_INIT_PLUS_CAP07_REGISTERED_LEGACY_AND_VISIBILITY_MIGRATION'
      || platform.zero_canonical_runtime_data_delta !== true
      || platform.cap07_visibility_migration?.trigger_enabled !== true
      || platform.cap07_visibility_migration?.runtime_metadata_direct_dml !== 'FORBIDDEN'
      || !Array.isArray(platform.effective_privilege_graph?.alternateConnectRoles)
      || platform.effective_privilege_graph.alternateConnectRoles.length !== 0) {
    throw new Error('PLATFORM_SECURITY_RESULT_SEMANTICS_INVALID');
  }
  if (negative.real_fact_inserted !== true
      || negative.cap07_visibility_trigger_observed !== true
      || negative.visibility_anchor_kind !== 'FACT_INSERT_TRANSACTION'
      || negative.transaction_rolled_back !== true
      || negative.facts_count_before !== negative.facts_count_after
      || negative.visibility_count_before !== negative.visibility_count_after) {
    throw new Error('WRITER_NEGATIVE_RESULT_SEMANTICS_INVALID');
  }
  if (late.vector_count !== 12
      || late.full_posterior_transition_recomputed !== true
      || late.intermediate_ordinary_assimilation_covered !== true
      || late.deterministic_rerun !== true) {
    throw new Error('LATE_CORRECTION_RESULT_SEMANTICS_INVALID');
  }
  if (progress.state_count !== 25
      || progress.witness_state_count !== 25
      || progress.query_count !== 6
      || progress.real_schema_query_qualified !== true
      || progress.transaction_rolled_back !== true
      || progress.repository_write_performed !== false) {
    throw new Error('PROGRESS_RESULT_SEMANTICS_INVALID');
  }
  if (zeroDelta.zero_runtime_data_delta !== true) throw new Error('ZERO_RUNTIME_DATA_DELTA_RESULT_INVALID');
  const mergeStage = typeof tree.merge_commit_sha === 'string'
    && tree.merge_commit_sha.length === 40
    && tree.candidate_to_merge_tree_delta === 0;
  const subjectSha = mergeStage ? tree.merge_commit_sha : tree.candidate_head_sha;
  if (!/^[0-9a-f]{40}$/.test(String(subjectSha || ''))) throw new Error('ARTIFACT_SUBJECT_SHA_INVALID');
  if (!/^[0-9a-f]{40}$/.test(String(tree.candidate_head_sha || ''))) throw new Error('ARTIFACT_CANDIDATE_HEAD_SHA_INVALID');
  if (!/^[0-9a-f]{40}$/.test(String(tree.candidate_tree_sha || ''))) throw new Error('ARTIFACT_CANDIDATE_TREE_SHA_INVALID');
  if (typeof platform.effective_privilege_graph_digest !== 'string') {
    throw new Error('EFFECTIVE_PRIVILEGE_GRAPH_DIGEST_REQUIRED');
  }

  const artifact = {
    schema_version: 'geox_mcft_cap08_pr1_authority_artifact_v2',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S0',
    stage: mergeStage ? 'EXACT_MERGE_SHA' : 'CANDIDATE_HEAD',
    subject_sha: subjectSha,
    subject_commit: subjectSha,
    candidate_head_sha: tree.candidate_head_sha,
    candidate_tree_sha: tree.candidate_tree_sha,
    merge_commit_sha: tree.merge_commit_sha ?? null,
    merge_tree_sha: tree.merge_tree_sha ?? null,
    candidate_to_merge_tree_delta: tree.candidate_to_merge_tree_delta ?? null,
    taskbook_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md'),
    resolved_manifest_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESOLVED-MANIFEST-V1.json'),
    changed_file_boundary_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json'),
    writer_authority_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-WRITER-AUTHORITY-V1.json'),
    progress_contract_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PROGRESS-RECOVERY-ADJUDICATION-V1.json'),
    progress_query_catalog_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PROGRESS-QUERY-CATALOG-V1.json'),
    progress_witness_catalog_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PROGRESS-WITNESS-CATALOG-V1.json'),
    late_vectors_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json'),
    schema_privilege_digest_policy_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-SCHEMA-PRIVILEGE-DIGEST-POLICY-V1.json'),
    workflow_declaration_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-WORKFLOW-DECLARATION-V1.json'),
    pr1_effectiveness_contract_digest: sha256('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PR1-EFFECTIVENESS-CONTRACT-V1.json'),
    platform_bootstrap_source_digest: sha256('apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts'),
    effective_privilege_graph_digest: platform.effective_privilege_graph_digest,
    zero_canonical_runtime_data_delta: true,
    effective_delivery_frontier_projection: {
      effective_status: mergeStage ? 'IN_PROGRESS' : 'CONDITIONAL_NOT_EFFECTIVE',
      effective_next_slice: mergeStage ? 'S1' : 'S1_AFTER_EXACT_SHA',
    },
    effective_authority_projection: {
      bounded_replay_runner_authorized: mergeStage,
      bounded_canonical_transaction_authorized: mergeStage,
      production_runtime_source_authorized: false,
    },
    results,
  };
  artifact.semantic_artifact_digest = `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(artifact))).digest('hex')}`;
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(artifact)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
