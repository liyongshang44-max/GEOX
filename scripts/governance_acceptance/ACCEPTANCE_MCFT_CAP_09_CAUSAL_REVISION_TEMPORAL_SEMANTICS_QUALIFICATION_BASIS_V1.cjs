#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const BASIS_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-QUALIFICATION-BASIS-V1.json";
const DEFAULT_PROOF_PATH = "acceptance-output/MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1_RESULT.json";
const OUT_PATH = "acceptance-output/MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFICATION_BASIS_V1_RESULT.json";

const EXPECTED = Object.freeze({
  frozenRuntime: "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a",
  semanticRevision: "9ffecd38d3093c4a3f566ee996e3ad00aaf6004a",
  sourcePath: "apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts",
  sourceBlob: "5e132eb1b307f908dea6118292fb8e0e9d53084c",
  old24tHead: "12473c491b354e49305f22bfa24c8701ce5e3ff9",
  oldClaim: "PROTECTED_TEMPORAL_SEMANTIC_CORE_UNCHANGED",
  replacementClaim: "FROZEN_RUNTIME_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFIED_BY_REAL_POSTGRES_V1",
  predecessorProofHead: "f93d3ebd89e5cd3ffc41f0aab7ce2125d025df89",
  predecessorRunId: 36605719586,
  predecessorArtifactId: 11051106735,
  predecessorArtifactDigest: "sha256:8e1669a001682562b85f88870b1533eaa1f4714743b3778496b445582e38369b",
});

function git(...args) {
  return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function parseProofPath(argv) {
  const index = argv.indexOf("--proof-result");
  if (index < 0) return DEFAULT_PROOF_PATH;
  const value = argv[index + 1];
  assert.equal(typeof value, "string", "PROOF_RESULT_PATH_VALUE_REQUIRED");
  assert(value.length > 0, "PROOF_RESULT_PATH_EMPTY");
  return value;
}

function assertBooleanMap(actual, expected, prefix) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual?.[key], value, `${prefix}:${key}`);
  }
}

function main() {
  const proofPath = parseProofPath(process.argv.slice(2));
  assert(exists(BASIS_PATH), "QUALIFICATION_BASIS_AUTHORITY_REQUIRED");
  assert(exists(proofPath), "CURRENT_HEAD_CAUSAL_REVISION_PROOF_REQUIRED");

  const basis = readJson(BASIS_PATH);
  const proof = readJson(proofPath);
  const head = git("rev-parse", "HEAD");

  assert.equal(basis.schema_version, "geox_mcft_cap09_causal_revision_temporal_semantics_qualification_basis_v1");
  assert.equal(basis.authority_id, "MCFT_CAP09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFICATION_BASIS_V1");
  assert.equal(basis.status, "CANDIDATE_QCP_QUALIFICATION_BASIS_FOR_ADJUDICATION");
  assert.equal(basis.scope, "CAUSAL_REVISION_TEMPORAL_SEMANTICS_ONLY");

  assert.equal(basis.frozen_runtime?.subject_sha, EXPECTED.frozenRuntime);
  assert.equal(basis.frozen_runtime?.postgres_evidence_source_path, EXPECTED.sourcePath);
  assert.equal(basis.frozen_runtime?.postgres_evidence_source_blob_sha, EXPECTED.sourceBlob);
  assert.equal(basis.frozen_runtime?.runtime_mutation_authorized, false);

  assert.equal(basis.semantic_revision?.commit_sha, EXPECTED.semanticRevision);
  assert.equal(basis.semantic_revision?.role, "ANCESTRY_BOUND_IMPLEMENTED_SEMANTICS_NOT_WHITELIST");
  assert.equal(basis.semantic_revision?.bare_sha_whitelist_authorized, false);
  assert.equal(basis.semantic_revision?.qualification_by_commit_identity_alone_forbidden, true);

  assert.equal(basis.historical_24t_basis?.old_full_24t_head_sha, EXPECTED.old24tHead);
  assert.equal(basis.historical_24t_basis?.historical_check_id, "LEGACY_AM19_PERSISTENT_24T");
  assert.equal(basis.historical_24t_basis?.superseded_claim, EXPECTED.oldClaim);
  assert.equal(basis.historical_24t_basis?.historical_result_retained, true);
  assert.equal(basis.historical_24t_basis?.historical_result_deleted_or_weakened, false);
  assert.equal(basis.historical_24t_basis?.causal_revision_semantics_coverage, false);
  assert.equal(basis.historical_24t_basis?.reinterpret_as_covering_new_semantics_forbidden, true);

  assert.equal(basis.replacement_basis?.replacement_claim, EXPECTED.replacementClaim);
  assert.equal(basis.replacement_basis?.proof_workflow, ".github/workflows/mcft-cap-09-causal-revision-temporal-semantics-postgres-v1.yml");
  assert.equal(basis.replacement_basis?.proof_acceptance, "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1.ts");
  assert.equal(basis.replacement_basis?.basis_acceptance, "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFICATION_BASIS_V1.cjs");
  assert.equal(basis.replacement_basis?.current_basis_head_requalification_required, true);
  assert.equal(basis.replacement_basis?.predecessor_proof_is_not_current_head_substitute, true);

  const predecessor = basis.replacement_basis?.predecessor_immutable_proof;
  assert.equal(predecessor?.subject_sha, EXPECTED.predecessorProofHead);
  assert.equal(predecessor?.run_id, EXPECTED.predecessorRunId);
  assert.equal(predecessor?.run_conclusion, "success");
  assert.equal(predecessor?.artifact_id, EXPECTED.predecessorArtifactId);
  assert.equal(predecessor?.artifact_digest, EXPECTED.predecessorArtifactDigest);
  assert.equal(predecessor?.artifact_expired, false);

  assertBooleanMap(basis.required_proof_surface, {
    real_postgresql_persistence: true,
    logical_time_cutoff: true,
    causal_latest_selection: true,
    future_revision_backward_leakage_rejected: true,
    future_event_leakage_fail_closed: true,
    ambiguous_revision_fail_closed: true,
    restart_replay_determinism: true,
  }, "BASIS_REQUIRED_PROOF_SURFACE_MISMATCH");
  assert.equal(basis.required_proof_surface?.runtime_database_write_count_must_equal, 0);
  assert.equal(basis.required_proof_surface?.runtime_provider_request_count_must_equal, 0);

  assert.equal(basis.qcp_supersession_rules?.legacy_check_remains_historical, true);
  assert.equal(basis.qcp_supersession_rules?.legacy_failure_must_not_be_relabelled_success, true);
  assert.equal(basis.qcp_supersession_rules?.legacy_24t_must_not_satisfy_replacement_claim, true);
  assert.equal(basis.qcp_supersession_rules?.replacement_claim_requires_real_postgres_proof, true);
  assert.equal(basis.qcp_supersession_rules?.replacement_claim_requires_exact_frozen_runtime_source_identity, true);
  assert.equal(basis.qcp_supersession_rules?.replacement_claim_requires_semantic_revision_ancestry, true);
  assert.equal(basis.qcp_supersession_rules?.replacement_claim_requires_current_basis_head_requalification, true);
  assert.equal(basis.qcp_supersession_rules?.ambiguous_or_missing_replacement_proof, "FAIL_CLOSED");
  assert.equal(basis.qcp_supersession_rules?.future_leakage_or_ambiguous_revision, "FAIL_CLOSED");
  assert.equal(basis.qcp_supersession_rules?.unknown_basis_state, "FAIL_CLOSED");

  // The semantic implementation commit is evidence of ancestry only. It is never sufficient
  // as a whitelist or stand-alone qualification result.
  cp.execFileSync("git", ["merge-base", "--is-ancestor", EXPECTED.semanticRevision, EXPECTED.frozenRuntime], { cwd: ROOT, stdio: "ignore" });
  assert.equal(git("rev-parse", `${EXPECTED.frozenRuntime}:${EXPECTED.sourcePath}`), EXPECTED.sourceBlob, "FROZEN_RUNTIME_SOURCE_BLOB_MISMATCH");
  assert.equal(git("rev-parse", `HEAD:${EXPECTED.sourcePath}`), EXPECTED.sourceBlob, "CURRENT_HEAD_FROZEN_SOURCE_BLOB_MISMATCH");
  const sourceDiff = cp.spawnSync("git", ["diff", "--quiet", EXPECTED.frozenRuntime, "HEAD", "--", EXPECTED.sourcePath], { cwd: ROOT });
  assert.equal(sourceDiff.status, 0, "FROZEN_RUNTIME_SOURCE_MUTATION_FORBIDDEN");

  // Current-basis-head proof must be present in this same checkout/run. A predecessor run is
  // retained only as durable historical evidence and cannot substitute for this proof result.
  assert.equal(proof.schema_version, "geox_mcft_cap09_causal_revision_temporal_semantics_postgres_qualification_v1");
  assert.equal(proof.status, "PASS");
  assert.equal(
    proof.qualification_subject_sha,
    head,
    "CURRENT_HEAD_CAUSAL_REVISION_PROOF_SUBJECT_MISMATCH",
  );
  assert.equal(proof.qualified_runtime?.frozen_runtime_subject_sha, EXPECTED.frozenRuntime);
  assert.equal(proof.qualified_runtime?.semantic_revision_commit_sha, EXPECTED.semanticRevision);
  assert.equal(proof.qualified_runtime?.postgres_evidence_source_blob_sha, EXPECTED.sourceBlob);
  assert.equal(proof.qualified_runtime?.frozen_runtime_modified_by_this_qualification, false);

  assertBooleanMap(proof.proof_surface, {
    real_postgresql_persistence: true,
    logical_time_cutoff: true,
    causal_latest_selection: true,
    future_revision_backward_leakage_rejected: true,
    future_event_leakage_fail_closed: true,
    ambiguous_revision_fail_closed: true,
    restart_replay_determinism: true,
  }, "CURRENT_HEAD_PROOF_SURFACE_MISMATCH");
  assert.equal(proof.proof_surface?.runtime_database_write_count, 0);
  assert.equal(proof.proof_surface?.runtime_provider_request_count, 0);
  assert(Number.isInteger(proof.proof_surface?.persisted_fact_count_survived_process_restart));
  assert(proof.proof_surface.persisted_fact_count_survived_process_restart > 0, "POSTGRES_PERSISTENCE_RESTART_FACTS_REQUIRED");

  assert.equal(proof.temporal_semantics?.same_source_record_id_revision_selection_by_causal_availability, true);
  assert.notEqual(proof.temporal_semantics?.earlier_boundary_selected_hash, proof.temporal_semantics?.later_boundary_selected_hash, "CAUSAL_LATEST_REVISION_TRANSITION_REQUIRED");

  assert.equal(proof.qualification_supersession?.supersession_scope, "CAUSAL_REVISION_TEMPORAL_SEMANTICS_ONLY");
  assert.equal(proof.qualification_supersession?.old_full_24t_head_sha, EXPECTED.old24tHead);
  assert.equal(proof.qualification_supersession?.superseded_claim, EXPECTED.oldClaim);
  assert.equal(proof.qualification_supersession?.replacement_claim, EXPECTED.replacementClaim);
  assert.equal(proof.qualification_supersession?.old_24t_proof_reinterpreted_as_covering_new_semantics, false);
  assert.equal(proof.qualification_supersession?.old_24t_proof_causal_revision_semantics_coverage, false);
  assert.equal(proof.qualification_supersession?.old_24t_historical_result_deleted_or_weakened, false);

  assertBooleanMap(basis.non_effects, {
    frozen_runtime_mutation: false,
    production_database_mutation: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0: false,
    o00_o23: false,
    stage_1b_closure_claim: false,
    mcft_cap09_completion_claim: false,
  }, "QUALIFICATION_BASIS_NON_EFFECT_VIOLATION");

  const result = {
    schema_version: "geox_mcft_cap09_causal_revision_temporal_semantics_qualification_basis_acceptance_v1",
    status: "PASS",
    acceptance_id: "MCFT_CAP09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFICATION_BASIS_V1",
    adjudicated_head_sha: head,
    frozen_runtime_subject_sha: EXPECTED.frozenRuntime,
    frozen_runtime_source_blob_sha: EXPECTED.sourceBlob,
    semantic_revision_role: "ANCESTRY_BOUND_IMPLEMENTED_SEMANTICS_NOT_WHITELIST",
    bare_sha_whitelist_authorized: false,
    supersession_scope: "CAUSAL_REVISION_TEMPORAL_SEMANTICS_ONLY",
    historical_24t_result_retained: true,
    historical_24t_reinterpreted_for_new_semantics: false,
    current_basis_head_real_postgres_proof_required: true,
    current_basis_head_real_postgres_proof_pass: true,
    proof_qualification_subject_sha: proof.qualification_subject_sha,
    proof_subject_matches_adjudicated_head: proof.qualification_subject_sha === head,
    replacement_claim: EXPECTED.replacementClaim,
    fail_closed_preserved: true,
    non_effects: basis.non_effects,
  };

  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT_PATH), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}
