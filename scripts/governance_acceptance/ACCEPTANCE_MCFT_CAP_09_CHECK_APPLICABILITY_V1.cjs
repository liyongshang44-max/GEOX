#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  resolveDependencyResolvers,
  resolveFailedV4ForbiddenEvidencePolicy,
  planApplicability,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(plan, id) {
  const row = plan.decisions.find((item) => item.check_id === id);
  assert.ok(row, `CHECK_DECISION_REQUIRED:${id}`);
  return row;
}

function plan(authority, registry, changedPaths, stage = "SUCCESSOR_SUBJECT_PRE_MERGE") {
  return planApplicability({
    root: ROOT,
    authority,
    registry,
    changedPaths,
    stage,
    baseSha: authority.frozen_successor_subject_sha,
    headSha: "1".repeat(40),
  });
}

function hasAuthorityError(result, code) {
  return (result.authority_errors || []).some((row) => row.code === code);
}

function main() {
  const authority = readJson(AUTHORITY_PATH);
  const registry = readJson(REGISTRY_PATH);
  assert.equal(authority.authority_id, "MCFT_CAP09_CHECK_APPLICABILITY_V1");
  assert.equal(registry.frozen_subject_sha, authority.frozen_successor_subject_sha);

  // Authority itself must resolve every exact path / import root / external graph now.
  const resolved = resolveDependencyResolvers(ROOT, authority);
  assert.deepEqual(resolved.errors, [], `CONTROL_PLANE_RESOLVER_ERRORS:${JSON.stringify(resolved.errors)}`);
  for (const [id, row] of Object.entries(resolved.resolved)) {
    assert.equal(row.missing.length, 0, `CONTROL_PLANE_RESOLVER_MISSING:${id}:${JSON.stringify(row.missing)}`);
    assert(row.paths.length > 0, `CONTROL_PLANE_RESOLVER_EMPTY:${id}`);
  }
  const failedV4Policy = resolveFailedV4ForbiddenEvidencePolicy(ROOT);
  assert.deepEqual(failedV4Policy.errors, [], `FAILED_V4_AUTHORITY_POLICY_ERRORS:${JSON.stringify(failedV4Policy.errors)}`);
  assert(failedV4Policy.subjects.has("26c1383f7f45abb76c99e28ec3d06714e85d1b2c"), "FAILED_V4_SUBJECT_MUST_BE_FORBIDDEN");

  // CP-4: known unchanged dependency. Control-plane-only maintenance must not invalidate frozen runtime evidence.
  const controlOnly = plan(authority, registry, [AUTHORITY_PATH]);
  assert.equal(controlOnly.status, "PASS");
  assert.equal(controlOnly.unknown_changed_paths.length, 0);
  assert.equal(controlOnly.authority_errors.length, 0);
  assert.equal(byId(controlOnly, "CONTROL_PLANE_INTEGRITY").status, "REQUALIFY");
  for (const id of [
    "V13_AUTONOMOUS_FORCING_FOUNDATION",
    "V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY",
    "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
    "EA5E2_RUNTIME_DEPENDENCY_GRAPH",
    "LEGACY_AM19_PERSISTENT_24T",
  ]) assert.equal(byId(controlOnly, id).status, "CARRY_FORWARD", `CONTROL_ONLY_MUST_CARRY:${id}`);
  for (const id of ["V13_PRODUCER_DRIVEN_QUALIFICATION", "END_TO_END_EVIDENCE_SUPPLY_DEADLINE", "EXACT_ONE_PRODUCTION_OWNER", "FORMAL_V5_ACTIVATION"]) {
    assert.equal(byId(controlOnly, id).status, "NOT_APPLICABLE", `PREMERGE_FUTURE_CHECK_MUST_BE_NA:${id}`);
  }

  // CP-4: unknown changed path must fail closed. No regex fallback is allowed.
  const unknown = plan(authority, registry, ["docs/__mcft_cap09_unowned_path_should_fail__.md"]);
  assert.equal(unknown.status, "FAIL");
  assert.deepEqual(unknown.unknown_changed_paths, ["docs/__mcft_cap09_unowned_path_should_fail__.md"]);

  // CP-4: known changed dependency. Shared ingress changes must requalify EA5C1.
  const ingressPath = "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts";
  const ingress = plan(authority, registry, [ingressPath]);
  assert.equal(ingress.status, "PASS");
  assert.equal(byId(ingress, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").status, "REQUALIFY");
  assert(byId(ingress, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").changed_dependencies.includes(ingressPath));

  // CP-4: historical source changes must explicitly requalify historical evidence.
  const legacyPath = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";
  const legacy = plan(authority, registry, [legacyPath]);
  assert.equal(legacy.status, "PASS");
  assert.equal(byId(legacy, "LEGACY_AM19_PERSISTENT_24T").status, "REQUALIFY");
  assert(byId(legacy, "LEGACY_AM19_PERSISTENT_24T").changed_dependencies.includes(legacyPath));

  // CP-4: runtime root changes invalidate v13 carry-forward by dependency closure.
  const runtimePath = "apps/server/src/runtime/twin_runtime/external_formal_forcing_autonomous_controller_service_v1.ts";
  const runtime = plan(authority, registry, [runtimePath]);
  assert.equal(runtime.status, "PASS");
  for (const id of ["V13_AUTONOMOUS_FORCING_FOUNDATION", "V13_HOLISTIC_SCHEMA", "V13_NEXT_TICK_VIABILITY"]) {
    assert.equal(byId(runtime, id).status, "REQUALIFY", `V13_RUNTIME_CHANGE_MUST_REQUALIFY:${id}`);
  }

  // CP-4: a transitive shared dependency discovered by import closure must be governed too.
  const v13Spec = authority.dependency_resolvers.V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE;
  const v13Explicit = new Set([...(v13Spec.roots || []), ...(v13Spec.additional_exact_paths || [])]);
  const transitivePath = resolved.resolved.V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE.paths.find((candidate) => !v13Explicit.has(candidate));
  assert.ok(transitivePath, "V13_TRANSITIVE_SHARED_DEPENDENCY_REQUIRED_FOR_SELFTEST");
  const transitive = plan(authority, registry, [transitivePath]);
  assert.equal(transitive.status, "PASS");
  assert.equal(byId(transitive, "V13_AUTONOMOUS_FORCING_FOUNDATION").status, "REQUALIFY");
  assert(byId(transitive, "V13_AUTONOMOUS_FORCING_FOUNDATION").changed_dependencies.includes(transitivePath));

  // CP-4: historical evidence mutation with a still-well-formed digest string must not carry forward.
  const mutatedRegistry = clone(registry);
  const mutatedEntry = mutatedRegistry.entries.find((row) => row.evidence_id === "EA5C1_SUCCESSOR_REVALIDATION_3BBF096E");
  assert.ok(mutatedEntry);
  mutatedEntry.artifact_digest = `sha256:${"0".repeat(64)}`;
  const mutatedEvidence = plan(authority, mutatedRegistry, []);
  assert.equal(mutatedEvidence.status, "FAIL");
  assert.equal(byId(mutatedEvidence, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").status, "UNKNOWN");
  assert.equal(byId(mutatedEvidence, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").reason_code, "CARRY_FORWARD_EVIDENCE_INVALID_OR_MISSING");

  // CP-4: duplicate check IDs are a global authority-definition failure.
  const duplicateAuthority = clone(authority);
  duplicateAuthority.checks.push(clone(duplicateAuthority.checks[0]));
  const duplicateCheck = plan(duplicateAuthority, registry, []);
  assert.equal(duplicateCheck.status, "FAIL");
  assert(hasAuthorityError(duplicateCheck, "DUPLICATE_CHECK_ID"));

  // CP-4: a check pointing at a missing dependency authority ref must fail closed.
  const missingAuthority = clone(authority);
  const missingAuthorityCheck = missingAuthority.checks.find((row) => row.check_id === "V13_AUTONOMOUS_FORCING_FOUNDATION");
  missingAuthorityCheck.resolver_ids = ["__MCFT_CAP09_MISSING_AUTHORITY_REF__"];
  const missingAuthorityResult = plan(missingAuthority, registry, []);
  assert.equal(missingAuthorityResult.status, "FAIL");
  assert(hasAuthorityError(missingAuthorityResult, "CHECK_DEPENDENCY_AUTHORITY_REF_MISSING"));
  assert.equal(byId(missingAuthorityResult, "V13_AUTONOMOUS_FORCING_FOUNDATION").status, "UNKNOWN");

  // CP-4: missing immutable artifact refs must fail closed rather than silently carrying historical evidence.
  const missingArtifactRegistry = clone(registry);
  const missingArtifact = missingArtifactRegistry.entries.find((row) => row.evidence_id === "V13_HOLISTIC_SCHEMA_3BBF096E");
  assert.ok(missingArtifact);
  missingArtifact.artifact_id = null;
  const missingArtifactResult = plan(authority, missingArtifactRegistry, []);
  assert.equal(missingArtifactResult.status, "FAIL");
  assert.equal(byId(missingArtifactResult, "V13_HOLISTIC_SCHEMA").status, "UNKNOWN");

  // CP-4: a failed-v4 subject is forbidden for carry-forward by the actual Formal-store authority.
  const failedV4Registry = clone(registry);
  const failedV4Entry = failedV4Registry.entries.find((row) => row.evidence_id === "V13_SUCCESSOR_SUBJECT_3BBF096E");
  assert.ok(failedV4Entry);
  failedV4Entry.subject_sha = "26c1383f7f45abb76c99e28ec3d06714e85d1b2c";
  const failedV4Reuse = plan(authority, failedV4Registry, []);
  assert.equal(failedV4Reuse.status, "FAIL");
  assert.equal(byId(failedV4Reuse, "V13_AUTONOMOUS_FORCING_FOUNDATION").status, "FORBIDDEN");
  assert.equal(byId(failedV4Reuse, "V13_AUTONOMOUS_FORCING_FOUNDATION").reason_code, "FAILED_V4_EVIDENCE_REUSE_FORBIDDEN");

  // CP-4: generation/stage N/A must be explicit, while post-merge obligations are enumerated without serial short-circuit.
  const postMerge = plan(authority, registry, [], "POST_MERGE_V13_QUALIFICATION");
  assert.equal(postMerge.status, "PASS");
  assert.equal(byId(postMerge, "LEGACY_AM19_PERSISTENT_24T").status, "NOT_APPLICABLE");
  for (const id of ["V13_PRODUCER_DRIVEN_QUALIFICATION", "END_TO_END_EVIDENCE_SUPPLY_DEADLINE", "EXACT_ONE_PRODUCTION_OWNER"]) {
    assert.equal(byId(postMerge, id).status, "REQUIRED", `POSTMERGE_CHECK_MUST_BE_REQUIRED:${id}`);
  }
  assert.equal(byId(postMerge, "FORMAL_V5_ACTIVATION").status, "NOT_APPLICABLE");

  const formalV5 = plan(authority, registry, [], "POST_GRADUATION_FORMAL_V5_ACTIVATION");
  assert.equal(formalV5.status, "PASS");
  assert.equal(byId(formalV5, "V13_PRODUCER_DRIVEN_QUALIFICATION").status, "NOT_APPLICABLE");
  assert.equal(byId(formalV5, "END_TO_END_EVIDENCE_SUPPLY_DEADLINE").status, "NOT_APPLICABLE");
  assert.equal(byId(formalV5, "EXACT_ONE_PRODUCTION_OWNER").status, "REQUIRED");
  assert.equal(byId(formalV5, "FORMAL_V5_ACTIVATION").status, "REQUIRED");

  const proof = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_CHECK_APPLICABILITY_V1",
    frozen_successor_subject_sha: authority.frozen_successor_subject_sha,
    resolver_count: Object.keys(resolved.resolved).length,
    all_resolvers_materialized_without_missing_paths: true,
    control_plane_only_change_does_not_invalidate_frozen_runtime_evidence: true,
    known_changed_dependency_requalifies: true,
    unknown_changed_path_fails_closed: true,
    shared_ingress_dependency_change_requalifies_ea5c1: true,
    historical_source_change_requalifies_historical_evidence: true,
    transitive_shared_dependency_uses_generated_closure: true,
    historical_evidence_mutation_fails_closed: true,
    duplicate_check_id_fails_closed: true,
    missing_authority_ref_fails_closed: true,
    missing_evidence_artifact_ref_fails_closed: true,
    not_applicable_generation_is_machine_recorded: true,
    failed_v4_reuse_is_forbidden: true,
    v13_runtime_change_uses_generated_dependency_closure: true,
    postmerge_obligations_enumerated_without_serial_short_circuit: true,
    cp4_frozen_negative_case_matrix_complete: true,
    regex_fallback_used: false,
    runtime_mutation: false,
    production_workflow_activation: false,
    formal_database_mutation: false,
    provider_request: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof, null, 2) + "\n");
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  throw error;
}
