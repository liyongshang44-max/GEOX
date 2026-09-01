#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  resolveDependencyResolvers,
  resolveFailedV4ForbiddenEvidencePolicy,
  planApplicability,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json");
const CURRENT_HEAD_SHA = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();

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
    headSha: CURRENT_HEAD_SHA,
  });
}

function hasAuthorityError(result, code) {
  return (result.authority_errors || []).some((row) => row.code === code);
}

function assertCheckContract(authority) {
  const resolverIds = new Set(Object.keys(authority.dependency_resolvers || {}));
  const allowedStages = new Set(authority.allowed_stages || []);
  for (const check of authority.checks || []) {
    const id = check.check_id || "<missing>";
    for (const field of ["owner", "historical_evidence_policy", "execution_workflow_status", "fail_policy", "carry_forward_policy"]) {
      assert.equal(typeof check[field], "string", `CHECK_CONTRACT_STRING_REQUIRED:${id}:${field}`);
      assert.ok(check[field].length > 0, `CHECK_CONTRACT_STRING_EMPTY:${id}:${field}`);
    }
    assert(Array.isArray(check.generation_scope) && check.generation_scope.length > 0, `CHECK_GENERATION_SCOPE_REQUIRED:${id}`);
    assert(check.generation_scope.every((value) => typeof value === "string" && value.length > 0), `CHECK_GENERATION_SCOPE_INVALID:${id}`);
    assert(Array.isArray(check.authority_refs) && check.authority_refs.length > 0, `CHECK_AUTHORITY_REFS_REQUIRED:${id}`);
    for (const ref of check.authority_refs) {
      assert.equal(typeof ref, "string", `CHECK_AUTHORITY_REF_INVALID:${id}`);
      assert(fs.existsSync(path.join(ROOT, ref)), `CHECK_AUTHORITY_REF_UNRESOLVABLE:${id}:${ref}`);
    }
    assert(Array.isArray(check.resolver_ids) && check.resolver_ids.length > 0, `CHECK_RESOLVER_IDS_REQUIRED:${id}`);
    for (const resolverId of check.resolver_ids) assert(resolverIds.has(resolverId), `CHECK_RESOLVER_REF_UNRESOLVABLE:${id}:${resolverId}`);
    assert(Array.isArray(check.requalification_triggers) && check.requalification_triggers.length > 0, `CHECK_REQUALIFICATION_TRIGGERS_REQUIRED:${id}`);
    for (const resolverId of check.requalification_triggers) assert(resolverIds.has(resolverId), `CHECK_REQUALIFICATION_TRIGGER_UNRESOLVABLE:${id}:${resolverId}`);
    assert(Array.isArray(check.applicable_stages) && check.applicable_stages.length > 0, `CHECK_APPLICABLE_STAGES_REQUIRED:${id}`);
    for (const stage of check.applicable_stages) assert(allowedStages.has(stage), `CHECK_STAGE_UNDECLARED:${id}:${stage}`);

    if (check.execution_workflow_status === "NOT_IMPLEMENTED_AT_FROZEN_SUBJECT") {
      assert.equal(check.execution_workflow, null, `UNIMPLEMENTED_WORKFLOW_MUST_NOT_INVENT_PATH:${id}`);
    } else {
      assert.equal(typeof check.execution_workflow, "string", `IMPLEMENTED_WORKFLOW_PATH_REQUIRED:${id}`);
      assert(fs.existsSync(path.join(ROOT, check.execution_workflow)), `IMPLEMENTED_WORKFLOW_PATH_UNRESOLVABLE:${id}:${check.execution_workflow}`);
    }
  }
}

function main() {
  const authority = readJson(AUTHORITY_PATH);
  const registry = readJson(REGISTRY_PATH);
  assert.equal(authority.authority_id, "MCFT_CAP09_CHECK_APPLICABILITY_V1");
  assert.equal(registry.frozen_subject_sha, authority.frozen_successor_subject_sha);

  // CP-1: every registered check must expose a complete central machine-readable contract.
  assertCheckContract(authority);

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

  // CP-4: control-plane-only maintenance cannot carry historical evidence whose resolved
  // dependency digest has already changed on the current successor. Shared collector refactoring
  // therefore keeps EA5C1 fail-closed as REQUALIFY even when this synthetic changed-path set
  // contains only the control-plane authority itself.
  const controlOnly = plan(authority, registry, [AUTHORITY_PATH]);
  assert.equal(controlOnly.status, "PASS");
  assert.equal(controlOnly.unknown_changed_paths.length, 0);
  assert.equal(controlOnly.authority_errors.length, 0);
  assert.equal(byId(controlOnly, "CONTROL_PLANE_INTEGRITY").status, "REQUALIFY");
  for (const id of [
    "V13_AUTONOMOUS_FORCING_FOUNDATION",
    "V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY",
  ]) {
    const row = byId(controlOnly, id);
    assert.equal(row.status, "REQUALIFY", `EXPANDED_V13_RESOLVER_MUST_REQUALIFY:${id}`);
    assert.equal(row.reason_code, "DEPENDENCY_SET_EXPANDED_SINCE_FROZEN_SUBJECT", `EXPANDED_V13_RESOLVER_REASON_REQUIRED:${id}`);
    assert.equal(row.dependency_digest_match, false, `EXPANDED_V13_RESOLVER_DIGEST_MUST_DIFFER:${id}`);
  }
  const controlOnlyEa5c1 = byId(controlOnly, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS");
  assert.equal(controlOnlyEa5c1.status, "REQUALIFY", "SHARED_COLLECTOR_DIGEST_DRIFT_MUST_REQUALIFY_EA5C1");
  assert.equal(controlOnlyEa5c1.dependency_digest_match, false, "EA5C1_SHARED_COLLECTOR_DIGEST_MUST_DIFFER");
  assert(
    ["DEPENDENCY_DIGEST_CHANGED", "DEPENDENCY_SET_EXPANDED_SINCE_FROZEN_SUBJECT"].includes(controlOnlyEa5c1.reason_code),
    "EA5C1_SHARED_COLLECTOR_REQUALIFICATION_REASON_REQUIRED",
  );
  for (const id of [
    "EA5E2_RUNTIME_DEPENDENCY_GRAPH",
    "LEGACY_AM19_PERSISTENT_24T",
    "PHASE1_TYPED_RUNTIME_COMPOSITION",
    "PHASE2_EVIDENCE_PROVIDER_MODULES",
    "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
    "PHASE4_TWIN_RUNTIME_FOUNDATION",
    "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  ]) assert.equal(byId(controlOnly, id).status, "REQUIRED", `EXPANDED_DEPENDENCY_SET_REQUIRES_FRESH_PROOF:${id}`);
  for (const id of ["V13_PRODUCER_DRIVEN_QUALIFICATION", "END_TO_END_EVIDENCE_SUPPLY_DEADLINE", "EXACT_ONE_PRODUCTION_OWNER", "FORMAL_V5_ACTIVATION"]) {
    assert.equal(byId(controlOnly, id).status, "NOT_APPLICABLE", `PREMERGE_FUTURE_CHECK_MUST_BE_NA:${id}`);
  }

  // CP-4: unknown changed path must fail closed. No regex fallback is allowed.
  const unknown = plan(authority, registry, ["docs/__mcft_cap09_unowned_path_should_fail__.md"]);
  assert.equal(unknown.status, "FAIL");
  assert.deepEqual(unknown.unknown_changed_paths, ["docs/__mcft_cap09_unowned_path_should_fail__.md"]);

  const ea5c1Check = authority.checks.find((row) => row.check_id === "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS");
  assert.ok(ea5c1Check, "EA5C1_CHECK_REQUIRED");
  assert.equal(ea5c1Check.execution_workflow_status, "IMPLEMENTED_AT_SUCCESSOR_HEAD");
  assert.equal(ea5c1Check.execution_workflow, ".github/workflows/mcft-cap-09-ea5c1-durable-raw-restricted-ingress.yml");

  const successorEa5c1AcceptancePath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C1_SUCCESSOR_REPLAY_COMPLETE_INGRESS_V1.ts";
  const successorEa5c1AcceptancePlan = plan(authority, registry, [successorEa5c1AcceptancePath]);
  assert.equal(successorEa5c1AcceptancePlan.status, "PASS");
  assert.equal(successorEa5c1AcceptancePlan.unknown_changed_paths.length, 0);
  assert.equal(byId(successorEa5c1AcceptancePlan, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").status, "REQUALIFY");
  assert(
    byId(successorEa5c1AcceptancePlan, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS")
      .changed_dependencies.includes(successorEa5c1AcceptancePath),
  );

  // CP-4: shared collector maintenance has a legal successor requalification route.
  const collectorPath = "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts";
  const collectorChange = plan(authority, registry, [collectorPath]);
  assert.equal(collectorChange.status, "PASS");
  assert.equal(collectorChange.unknown_changed_paths.length, 0);
  assert.equal(byId(collectorChange, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").status, "REQUALIFY");
  assert(byId(collectorChange, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").changed_dependencies.includes(collectorPath));

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

  // CP-4: forward ACL carry-forward remediation crosses Phase3, V13,
  // production-equivalent containers, and production-owner provisioning.
  const evidenceAclCarryforwardPath = "apps/server/db/migrations/2026_09_01_mcft_cap_09_v13_evidence_runtime_phase3_acl_carryforward.sql";
  const evidenceAclCarryforward = plan(authority, registry, [evidenceAclCarryforwardPath]);
  assert.equal(evidenceAclCarryforward.status, "PASS");
  assert.equal(evidenceAclCarryforward.unknown_changed_paths.length, 0);
  for (const id of [
    "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
    "V13_AUTONOMOUS_FORCING_FOUNDATION",
    "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  ]) {
    const row = byId(evidenceAclCarryforward, id);
    assert.equal(row.status, "REQUALIFY", "EVIDENCE_ACL_CARRYFORWARD_MUST_REQUALIFY:" + id);
    assert(row.changed_dependencies.includes(evidenceAclCarryforwardPath), "EVIDENCE_ACL_CARRYFORWARD_DEPENDENCY_REQUIRED:" + id);
  }
  assert.equal(byId(evidenceAclCarryforward, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");
  const evidenceAclCarryforwardPostMerge = plan(
    authority,
    registry,
    [evidenceAclCarryforwardPath],
    "POST_MERGE_V13_QUALIFICATION",
  );
  assert.equal(evidenceAclCarryforwardPostMerge.status, "PASS");
  const ownerCarryforward = byId(evidenceAclCarryforwardPostMerge, "EXACT_ONE_PRODUCTION_OWNER");
  assert.equal(ownerCarryforward.status, "REQUALIFY", "EVIDENCE_ACL_CARRYFORWARD_OWNER_CLOSURE_MUST_REQUALIFY");
  assert(ownerCarryforward.changed_dependencies.includes(evidenceAclCarryforwardPath), "EVIDENCE_ACL_CARRYFORWARD_OWNER_DEPENDENCY_REQUIRED");

  // CP-4: planner-readiness focused proofs are centrally owned and may not become unknown paths.
  const kbsMultiIntervalPlannerProofPath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_RAW_HOURLY_MULTI_INTERVAL_PRODUCT_PATH_V1.ts";
  const kbsMultiIntervalPlannerProof = plan(authority, registry, [kbsMultiIntervalPlannerProofPath]);
  assert.equal(kbsMultiIntervalPlannerProof.status, "PASS");
  assert.equal(kbsMultiIntervalPlannerProof.unknown_changed_paths.length, 0);
  assert.equal(byId(kbsMultiIntervalPlannerProof, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");

  // CP-4: source-specific progress is production Evidence Runtime code and must be Phase3-owned.
  const sourceProgressRuntime = plan(authority, registry, ["apps/server/src/external_evidence/mcft_cap09_evidence_source_progress_v1.ts"]);
  assert.equal(sourceProgressRuntime.status, "PASS");
  assert.equal(sourceProgressRuntime.unknown_changed_paths.length, 0);
  assert.equal(byId(sourceProgressRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert(byId(sourceProgressRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes("apps/server/src/external_evidence/mcft_cap09_evidence_source_progress_v1.ts"));

  const sourceProgressProof = plan(authority, registry, ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PROGRESS_V1.ts"]);
  assert.equal(sourceProgressProof.status, "PASS");
  assert.equal(sourceProgressProof.unknown_changed_paths.length, 0);
  assert.equal(byId(sourceProgressProof, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");

  // CP-4: acquisition-horizon runtime contract is Phase3-owned; policy/proof are planner-owner closure paths.
  const horizonRuntime = plan(authority, registry, ["apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.ts"]);
  assert.equal(horizonRuntime.status, "PASS");
  assert.equal(horizonRuntime.unknown_changed_paths.length, 0);
  assert.equal(byId(horizonRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert(byId(horizonRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes("apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.ts"));

  for (const horizonPlannerPath of [
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_V1.ts",
    "apps/server/src/external_evidence/mcft_cap09_production_evidence_source_planner_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_V1.ts",
    "apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.ts",
    "apps/server/src/external_evidence/kbs_raw_hourly_publication_baseline_store_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_BASELINE_V1.ts",
    "apps/server/db/migrations/2026_09_01_mcft_cap_09_kbs_publication_baseline_pointer.sql",
    "apps/server/src/external_evidence/mcft_cap09_kbs_publication_baseline_pointer_v1.ts",
    "apps/server/src/persistence/external_evidence/postgres_kbs_publication_baseline_pointer_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_BASELINE_POINTER_V1.ts",
    "apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_SNAPSHOT_COMPARISON_V1.ts",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-KBS-BASELINE-POINTER-SCHEMA-REMEDIATION-AUTHORITY-V1.json",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_ARM_V1.json",
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_V1.cjs",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_V1.cjs",
    ".github/workflows/mcft-cap-09-production-kbs-baseline-pointer-schema-remediation.yml",
  ]) {
    const horizonPlanner = plan(authority, registry, [horizonPlannerPath]);
    assert.equal(horizonPlanner.status, "PASS");
    assert.equal(horizonPlanner.unknown_changed_paths.length, 0);
    assert.equal(byId(horizonPlanner, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");
  }

  // CP-4: pure production Evidence planner core is Phase3-owned; focused proof is owner-closure-owned.
  const purePlannerRuntime = plan(authority, registry, ["apps/server/src/external_evidence/mcft_cap09_production_evidence_source_planner_v1.ts"]);
  assert.equal(purePlannerRuntime.status, "PASS");
  assert.equal(purePlannerRuntime.unknown_changed_paths.length, 0);
  assert.equal(byId(purePlannerRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert(byId(purePlannerRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes("apps/server/src/external_evidence/mcft_cap09_production_evidence_source_planner_v1.ts"));

  const purePlannerProof = plan(authority, registry, ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PLANNER_V1.ts"]);
  assert.equal(purePlannerProof.status, "PASS");
  assert.equal(purePlannerProof.unknown_changed_paths.length, 0);
  assert.equal(byId(purePlannerProof, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");

  // CP-4: KBS publication snapshot inspection and private baseline manifest are Phase3-owned.
  for (const kbsPublicationRuntimePath of ["apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.ts", "apps/server/src/external_evidence/kbs_raw_hourly_publication_baseline_store_v1.ts"]) {
    const result = plan(authority, registry, [kbsPublicationRuntimePath]);
    assert.equal(result.status, "PASS");
    assert.equal(result.unknown_changed_paths.length, 0);
    assert.equal(byId(result, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert(byId(result, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes(kbsPublicationRuntimePath));
  }
  const kbsPublicationProof = plan(authority, registry, ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_BASELINE_V1.ts"]);
  assert.equal(kbsPublicationProof.status, "PASS");
  assert.equal(kbsPublicationProof.unknown_changed_paths.length, 0);
  assert.equal(byId(kbsPublicationProof, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");

  // CP-4: KBS publication baseline pointer schema/contract/repository are Phase3-owned.
  for (const kbsBaselinePointerRuntimePath of [
    "apps/server/db/migrations/2026_09_01_mcft_cap_09_kbs_publication_baseline_pointer.sql",
    "apps/server/src/external_evidence/mcft_cap09_kbs_publication_baseline_pointer_v1.ts",
    "apps/server/src/persistence/external_evidence/postgres_kbs_publication_baseline_pointer_v1.ts",
  ]) {
    const result = plan(authority, registry, [kbsBaselinePointerRuntimePath]);
    assert.equal(result.status, "PASS");
    assert.equal(result.unknown_changed_paths.length, 0);
    assert.equal(byId(result, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert(byId(result, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes(kbsBaselinePointerRuntimePath));
  }
  const kbsBaselinePointerProof = plan(authority, registry, ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_BASELINE_POINTER_V1.ts"]);
  assert.equal(kbsBaselinePointerProof.status, "PASS");
  assert.equal(kbsBaselinePointerProof.unknown_changed_paths.length, 0);
  assert.equal(byId(kbsBaselinePointerProof, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");

  // CP-4: production KBS pointer schema remediation control surfaces are owner-closure-owned.
  for (const kbsPointerRemediationPath of ["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-KBS-BASELINE-POINTER-SCHEMA-REMEDIATION-AUTHORITY-V1.json","scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_ARM_V1.json","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_V1.cjs","scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_V1.cjs",".github/workflows/mcft-cap-09-production-kbs-baseline-pointer-schema-remediation.yml"]) {
    const result = plan(authority, registry, [kbsPointerRemediationPath]);
    assert.equal(result.status, "PASS");
    assert.equal(result.unknown_changed_paths.length, 0);
    assert.equal(byId(result, "EXACT_ONE_PRODUCTION_OWNER").status, "REQUALIFY");
    assert(byId(result, "EXACT_ONE_PRODUCTION_OWNER").changed_dependencies.includes(kbsPointerRemediationPath));
  }

  // CP-4: KBS retained snapshot comparison is Phase3-owned; focused proof is owner-closure-owned.
  const kbsSnapshotComparisonRuntime = plan(authority, registry, ["apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.ts"]);
  assert.equal(kbsSnapshotComparisonRuntime.status, "PASS");
  assert.equal(kbsSnapshotComparisonRuntime.unknown_changed_paths.length, 0);
  assert.equal(byId(kbsSnapshotComparisonRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert(byId(kbsSnapshotComparisonRuntime, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes("apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.ts"));
  const kbsSnapshotComparisonProof = plan(authority, registry, ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLICATION_SNAPSHOT_COMPARISON_V1.ts"]);
  assert.equal(kbsSnapshotComparisonProof.status, "PASS");
  assert.equal(kbsSnapshotComparisonProof.unknown_changed_paths.length, 0);
  assert.equal(byId(kbsSnapshotComparisonProof, "EXACT_ONE_PRODUCTION_OWNER").status, "NOT_APPLICABLE");

  // CP-4: shared verified retained-raw replay is governed by both Phase3 and Phase7 import closure.
  const retainedReplayShared = plan(authority, registry, ["apps/server/src/external_evidence/verified_retained_raw_replay_v1.ts"]);
  assert.equal(retainedReplayShared.status, "PASS");
  assert.equal(retainedReplayShared.unknown_changed_paths.length, 0);
  assert.equal(byId(retainedReplayShared, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert.equal(byId(retainedReplayShared, "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION").status, "REQUALIFY");
  assert(byId(retainedReplayShared, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes("apps/server/src/external_evidence/verified_retained_raw_replay_v1.ts"));
  assert(byId(retainedReplayShared, "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION").changed_dependencies.includes("apps/server/src/external_evidence/verified_retained_raw_replay_v1.ts"));
  const retainedReplayProof = plan(authority, registry, ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_VERIFIED_RETAINED_RAW_REPLAY_V1.ts"]);
  assert.equal(retainedReplayProof.status, "PASS");
  assert.equal(retainedReplayProof.unknown_changed_paths.length, 0);
  assert.equal(byId(retainedReplayProof, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert.equal(byId(retainedReplayProof, "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION").status, "REQUALIFY");

  // CP-4: KBS publication cycle service is Phase3-owned and owner-closure-visible.
  for (const kbsPublicationCyclePath of ["apps/server/src/external_evidence/mcft_cap09_kbs_raw_hourly_publication_cycle_service_v1.ts","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_V1.ts"]) {
    const result = plan(authority, registry, [kbsPublicationCyclePath]);
    assert.equal(result.status, "PASS");
    assert.equal(result.unknown_changed_paths.length, 0);
    assert.equal(byId(result, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert.equal(byId(result, "EXACT_ONE_PRODUCTION_OWNER").status, "REQUALIFY");
    assert(byId(result, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes(kbsPublicationCyclePath));
    assert(byId(result, "EXACT_ONE_PRODUCTION_OWNER").changed_dependencies.includes(kbsPublicationCyclePath));
  }

  // CP-4: exact fact replay provenance is Phase3-owned and production-owner-visible.
  for (const replayPath of ["apps/server/src/persistence/external_evidence/postgres_external_evidence_fact_replay_provenance_v1.ts","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_V1.ts"]) {
    const replayPlan = plan(authority, registry, [replayPath]);
    assert.equal(replayPlan.status, "PASS");
    assert.equal(replayPlan.unknown_changed_paths.length, 0);
    assert.equal(byId(replayPlan, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert.equal(byId(replayPlan, "EXACT_ONE_PRODUCTION_OWNER").status, "REQUALIFY");
    assert(byId(replayPlan, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes(replayPath));
    assert(byId(replayPlan, "EXACT_ONE_PRODUCTION_OWNER").changed_dependencies.includes(replayPath));
  }

  // CP-4: GFS partial-pair rehydration is Phase3-owned and owner-visible.
  for (const gfsPartialPath of ["apps/server/src/external_evidence/mcft_cap09_gfs_partial_pair_rehydration_v1.ts", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_GFS_PARTIAL_PAIR_REHYDRATION_V1.ts"]) {
    const gfsPartialPlan = plan(authority, registry, [gfsPartialPath]);
    assert.equal(gfsPartialPlan.status, "PASS");
    assert.equal(gfsPartialPlan.unknown_changed_paths.length, 0);
    assert.equal(byId(gfsPartialPlan, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert.equal(byId(gfsPartialPlan, "EXACT_ONE_PRODUCTION_OWNER").status, "REQUALIFY");
  }

  // CP-4: Phase3 Evidence Runtime changes require fresh exact-head workflow evidence.
  const phase3Path = "apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.ts";
  const phase3 = plan(authority, registry, [phase3Path]);
  assert.equal(phase3.status, "PASS");
  assert.equal(byId(phase3, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert(byId(phase3, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes(phase3Path));

  // CP-4: the Phase7 capture/promotion adapter crosses three governed closures.
  const phase7CrossPlaneAdapter = "apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts";
  const phase7CrossPlane = plan(authority, registry, [phase7CrossPlaneAdapter]);
  assert.equal(phase7CrossPlane.status, "PASS");
  assert.equal(phase7CrossPlane.unknown_changed_paths.length, 0);
  for (const id of [
    "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
    "V13_AUTONOMOUS_FORCING_FOUNDATION",
    "V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY",
    "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION",
  ]) {
    const row = byId(phase7CrossPlane, id);
    assert.equal(row.status, "REQUALIFY", `PHASE7_CROSS_PLANE_ADAPTER_MUST_REQUALIFY:${id}`);
    assert(row.changed_dependencies.includes(phase7CrossPlaneAdapter), `PHASE7_CROSS_PLANE_ADAPTER_DEPENDENCY_REQUIRED:${id}`);
  }

  // CP-4: Phase3 cadence/fenced-writer dependencies must be centrally owned.
  for (const phase3Path of [
    "apps/server/src/external_evidence/mcft_cap09_evidence_supply_cadence_profile_v1.ts",
    "apps/server/src/persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE3_EVIDENCE_SUPPLY_CADENCE_PROFILES_V1.ts",
  ]) {
    const phase3Owned = plan(authority, registry, [phase3Path]);
    assert.equal(phase3Owned.status, "PASS");
    assert.equal(phase3Owned.unknown_changed_paths.length, 0);
    assert.equal(byId(phase3Owned, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert(byId(phase3Owned, "PHASE3_EVIDENCE_RUNTIME_FOUNDATION").changed_dependencies.includes(phase3Path));
  }

  // CP-4: Phase4 Twin Runtime product roots and transitive canonical dependencies
  // are governed by import closure and require fresh exact-head qualification.
  for (const phase4Path of [
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts",
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE4_TWIN_RUNTIME_HOST_V1.ts",
  ]) {
    const phase4 = plan(authority, registry, [phase4Path]);
    assert.equal(phase4.status, "PASS");
    assert.equal(phase4.unknown_changed_paths.length, 0);
    assert.equal(byId(phase4, "PHASE4_TWIN_RUNTIME_FOUNDATION").status, "REQUALIFY");
    assert(byId(phase4, "PHASE4_TWIN_RUNTIME_FOUNDATION").changed_dependencies.includes(phase4Path));
  }
  const phase4Spec = authority.dependency_resolvers.PHASE4_TWIN_RUNTIME_FOUNDATION;
  const phase4Explicit = new Set([...(phase4Spec.roots || []), ...(phase4Spec.additional_exact_paths || [])]);
  const phase4Resolved = resolved.resolved.PHASE4_TWIN_RUNTIME_FOUNDATION.paths;
  const phase4Transitive = phase4Resolved.find((candidate) => !phase4Explicit.has(candidate));
  assert.ok(phase4Transitive, "PHASE4_TRANSITIVE_CANONICAL_DEPENDENCY_REQUIRED_FOR_SELFTEST");
  const phase4TransitivePlan = plan(authority, registry, [phase4Transitive]);
  assert.equal(phase4TransitivePlan.status, "PASS");
  assert.equal(byId(phase4TransitivePlan, "PHASE4_TWIN_RUNTIME_FOUNDATION").status, "REQUALIFY");
  assert(byId(phase4TransitivePlan, "PHASE4_TWIN_RUNTIME_FOUNDATION").changed_dependencies.includes(phase4Transitive));

  // CP-4: Phase5 production-equivalent packaging is explicitly and narrowly owned.
  // Resolve the complete path set in one plan so generated-graph resolvers are materialized once.
  const phase5Paths = [
    ".github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml",
    "apps/server/scripts/write_dist_entries.cjs",
    "apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts",
    "apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts",
    "apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts",
    "apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts",
    "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts",
    "apps/server/src/external_evidence/qualification/mcft_cap09_phase5_controlled_evidence_work_items_v1.ts",
    "apps/server/src/external_evidence/qualification/mcft_cap09_phase5_evidence_runtime_qualification_v1.ts",
    "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEMS_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_EVIDENCE_QUALIFICATION_ENTRYPOINT_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_TWIN_QUALIFICATION_CLOCK_V1.ts",
    "docker-compose.mcft-cap09-phase5-qualification.yml",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_QUALIFICATION_COMPOSE_V1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_mcft_cap09_twin_canonical_fact_writer_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts",
    "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_TWIN_CANONICAL_FACT_WRITER_V1.ts",
    ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
    "docker/mcft-cap09-runtime.Dockerfile",
    "apps/server/src/external_evidence/qualification/mcft_cap09_phase5_capture_a0_fixture_v1.ts",
    "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_prepare_24t_v1.ts",
    "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_verify_24t_v1.ts",
  ];
  const phase5 = plan(authority, registry, phase5Paths);
  assert.equal(phase5.status, "PASS");
  assert.deepEqual(phase5.unknown_changed_paths, []);
  const phase5Decision = byId(phase5, "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS");
  assert.equal(phase5Decision.status, "REQUALIFY");
  for (const phase5Path of phase5Paths) assert(phase5Decision.changed_dependencies.includes(phase5Path));

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

  // CP-4: a missing central authority ref must make the meta-gate fail closed.
  const missingCentralAuthority = clone(authority);
  const missingCentralAuthorityCheck = missingCentralAuthority.checks.find((row) => row.check_id === "V13_AUTONOMOUS_FORCING_FOUNDATION");
  missingCentralAuthorityCheck.authority_refs = ["docs/__mcft_cap09_missing_authority_ref__.json"];
  assert.throws(() => assertCheckContract(missingCentralAuthority), /CHECK_AUTHORITY_REF_UNRESOLVABLE/);

  // CP-4: a check pointing at a missing dependency authority/resolver ref must fail closed in the planner.
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

  // CP-4: step 4 may be implemented at the successor head without being treated as qualified.
  const producerQualification = authority.checks.find((row) => row.check_id === "V13_PRODUCER_DRIVEN_QUALIFICATION");
  assert.ok(producerQualification, "FUTURE_CHECK_REQUIRED:V13_PRODUCER_DRIVEN_QUALIFICATION");
  assert.equal(producerQualification.execution_workflow_status, "IMPLEMENTED_AT_SUCCESSOR_HEAD");
  assert.equal(producerQualification.execution_workflow, ".github/workflows/mcft-cap-09-v13-producer-driven-live-qualification.yml");
  assert.equal(producerQualification.diagnostic_command, null, "V13_PRODUCER_DRIVEN_QUALIFICATION_MUST_USE_IMMUTABLE_WORKFLOW_EVIDENCE_NOT_INLINE_DIAGNOSTIC");
  assert.equal(byId(plan(authority, registry, [], "POST_MERGE_V13_QUALIFICATION"), "V13_PRODUCER_DRIVEN_QUALIFICATION").status, "REQUIRED");

  // Step 5 may be implemented without being treated as qualified. Its dependency
  // closure is deliberately separate from Step 4 so timing work cannot invalidate
  // the already-closed producer-driven qualification.
  const timingQualification = authority.checks.find((row) => row.check_id === "END_TO_END_EVIDENCE_SUPPLY_DEADLINE");
  assert.ok(timingQualification, "FUTURE_CHECK_REQUIRED:END_TO_END_EVIDENCE_SUPPLY_DEADLINE");
  assert.deepEqual(timingQualification.resolver_ids, ["V13_TIMING_QUALIFICATION_CLOSURE"]);
  assert.equal(timingQualification.execution_workflow_status, "IMPLEMENTED_AT_SUCCESSOR_HEAD");
  assert.equal(timingQualification.execution_workflow, ".github/workflows/mcft-cap-09-v13-frozen-timing-authority.yml");
  assert.equal(timingQualification.diagnostic_command, null);
  const timingPaths = new Set(resolved.resolved.V13_TIMING_QUALIFICATION_CLOSURE.paths);
  const step4Paths = new Set(resolved.resolved.V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE.paths);
  for (const timingOnlyPath of [
    ".github/workflows/mcft-cap-09-v13-exact-head-timing-measurement.yml",
    ".github/workflows/mcft-cap-09-v13-exact-head-timing-sample.yml",
    ".github/workflows/mcft-cap-09-v13-frozen-timing-authority.yml",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V1.ts",
    "scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V1.ts",
    "scripts/runtime_acceptance/VALIDATE_MCFT_CAP_09_V13_FROZEN_TIMING_AUTHORITY_V1.ts",
    "scripts/runtime_acceptance/MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_ARM_V1.json",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json",
    ".github/workflows/mcft-cap-09-v13-controlled-timing-delay-matrix.yml",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_CONTROLLED_TIMING_DELAY_MATRIX_V1.ts",
  ]) {
    assert(timingPaths.has(timingOnlyPath), `TIMING_CLOSURE_PATH_REQUIRED:${timingOnlyPath}`);
    assert(!step4Paths.has(timingOnlyPath), `TIMING_PATH_MUST_NOT_REOPEN_STEP4:${timingOnlyPath}`);
  }
  assert.equal(byId(plan(authority, registry, [], "POST_MERGE_V13_QUALIFICATION"), "END_TO_END_EVIDENCE_SUPPLY_DEADLINE").status, "REQUIRED");

  // Production-owner graduation has its own bounded closure. The workflow is
  // intentionally fail-closed while the arm is false / non-GitHub host binding is absent,
  // so a read-only preflight success cannot be registered as exact-owner closure evidence.
  const ownerQualification = authority.checks.find((row) => row.check_id === "EXACT_ONE_PRODUCTION_OWNER");
  assert.ok(ownerQualification, "FUTURE_CHECK_REQUIRED:EXACT_ONE_PRODUCTION_OWNER");
  assert.deepEqual(ownerQualification.resolver_ids, ["PRODUCTION_OWNER_GRADUATION_CLOSURE"]);
  assert.equal(ownerQualification.execution_workflow_status, "IMPLEMENTED_AT_SUCCESSOR_HEAD");
  assert.equal(ownerQualification.execution_workflow, ".github/workflows/mcft-cap-09-production-owner-graduation-gate.yml");
  assert.equal(ownerQualification.diagnostic_command, null);
  const ownerPaths = new Set(resolved.resolved.PRODUCTION_OWNER_GRADUATION_CLOSURE.paths);
  for (const ownerOnlyPath of [
    ".github/workflows/mcft-cap-09-production-owner-graduation-gate.yml",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-GRADUATION-GATE-V1.json",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_CUTOVER_ARM_V1.json",
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_OWNER_GRADUATION_V1.cjs",
    ".github/workflows/mcft-cap-09-production-owner-provisioning-readiness.yml",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json",
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_V1.cjs",
    ".github/workflows/mcft-cap-09-production-runtime-credential-bind-one-shot.yml",
    ".github/workflows/mcft-cap-09-production-runtime-credential-readiness.yml",
    "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_RUNTIME_CREDENTIAL_READINESS_V1.cjs",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-LOCAL-OPERATOR-HOST-STATIC-ADMISSION-EVIDENCE-V1.json",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json",
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_V1.cjs",
    "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_READINESS_V1.cjs",
    ".github/workflows/mcft-cap-09-production-non-github-host-binding-readiness.yml",
    ".github/workflows/mcft-cap-09-production-owner-provisioning-bundle-postgres.yml",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_BUNDLE_POSTGRES_V1.ts",
    ".github/workflows/mcft-cap-09-production-service-login-provision-one-shot.yml",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_PROVISIONING_V1.ts",
    ".github/workflows/mcft-cap-09-production-service-login-readiness.yml",
    "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1.cjs",
    ".github/workflows/mcft-cap-09-production-operational-database-candidate-preflight.yml",
    ".github/workflows/mcft-cap-09-production-operational-database-provision-one-shot.yml",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OPERATIONAL-DATABASE-CANDIDATE-V1.json",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OPERATIONAL_DATABASE_PROVISION_ARM_V1.json",
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_OPERATIONAL_DATABASE_CANDIDATE_V1.cjs",
    ".github/workflows/mcft-cap-09-production-operational-schema-acl-readiness.yml",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_ARM_V1.json",
    ".github/workflows/mcft-cap-09-production-operational-schema-acl-materialize-one-shot.yml",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_MATERIALIZATION_V1.ts",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACL-CARRYFORWARD-REMEDIATION-AUTHORITY-V1.json",
    "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_ARM_V1.json",
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",
    ".github/workflows/mcft-cap-09-production-evidence-acl-carryforward-remediation.yml",
    ".github/workflows/mcft-cap-09-production-evidence-target-planner-readiness.yml",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_TARGET_PLANNER_READINESS_V1.cjs",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-TARGET-PLANNER-READINESS-V1.json",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_RAW_HOURLY_MULTI_INTERVAL_PRODUCT_PATH_V1.ts",
    "apps/server/src/external_evidence/mcft_cap09_evidence_source_progress_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PROGRESS_V1.ts",
    "apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.ts",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACQUISITION_HORIZON_V1.ts",
  ]) {
    assert(ownerPaths.has(ownerOnlyPath), `OWNER_CLOSURE_PATH_REQUIRED:${ownerOnlyPath}`);
    assert(!timingPaths.has(ownerOnlyPath), `OWNER_PATH_MUST_NOT_REOPEN_TIMING:${ownerOnlyPath}`);
    assert(!step4Paths.has(ownerOnlyPath), `OWNER_PATH_MUST_NOT_REOPEN_STEP4:${ownerOnlyPath}`);
  }
  assert.equal(byId(plan(authority, registry, [], "POST_MERGE_V13_QUALIFICATION"), "EXACT_ONE_PRODUCTION_OWNER").status, "REQUIRED");

  // Formal-v5 remains unimplemented and fail closed until owner graduation closes.
  const formalActivation = authority.checks.find((row) => row.check_id === "FORMAL_V5_ACTIVATION");
  assert.ok(formalActivation, "FUTURE_CHECK_REQUIRED:FORMAL_V5_ACTIVATION");
  assert.equal(formalActivation.execution_workflow_status, "NOT_IMPLEMENTED_AT_FROZEN_SUBJECT");
  assert.equal(formalActivation.execution_workflow, null);

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
    central_check_contract_complete_and_resolvable: true,
    unimplemented_future_workflows_explicit_without_invented_paths: true,
    control_plane_only_change_preserves_only_resolvable_frozen_dependencies: true,
    expanded_dependency_sets_require_fresh_requalification: true,
    phase7_cross_plane_adapter_requalifies_phase3_v13_and_phase7: true,
    known_changed_dependency_requalifies: true,
    unknown_changed_path_fails_closed: true,
    shared_ingress_dependency_change_requalifies_ea5c1: true,
    historical_source_change_requalifies_historical_evidence: true,
    transitive_shared_dependency_uses_generated_closure: true,
    historical_evidence_mutation_fails_closed: true,
    duplicate_check_id_fails_closed: true,
    missing_central_authority_ref_fails_closed: true,
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
    mcft_cap09_completed: false
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
