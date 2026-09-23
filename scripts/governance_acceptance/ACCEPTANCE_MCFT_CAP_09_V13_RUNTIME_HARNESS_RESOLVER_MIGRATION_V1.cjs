#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  resolveDependencyResolvers,
  dependencyDigestForPaths,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_RUNTIME_HARNESS_RESOLVER_MIGRATION_V1_RESULT.json");
const LEGACY = "V13_AUTONOMOUS_FORCING_IMPORT_CLOSURE";
const RUNTIME = "V13_RUNTIME_SEMANTIC_CLOSURE";
const HARNESS = "V13_QUALIFICATION_HARNESS_CLOSURE";
const SELF = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_V13_RUNTIME_HARNESS_RESOLVER_MIGRATION_V1.cjs";
const POST_MIGRATION_HARNESS_ADDITIONS = [
  SELF,
  ".github/workflows/mcft-cap-09-post-merge-v13-control-plane-v1.yml",
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs",
];
const BF1D = "bf1d345f925f543779718973f8c9419684498e2a";
const LEGACY_AGGREGATE_DIGEST = "sha256:db6bbfe41052d262481bb2a911cbe1501247c32ed111daa2af0b8ab5c58088b3";
const PRODUCER_CHECKS = {
  V13_AUTONOMOUS_FORCING_FOUNDATION: {
    run_id: 33605700749,
    source_evidence_id: "V13_AUTONOMOUS_FORCING_FOUNDATION_POSTMERGE_BF1D345F",
    projected_evidence_id: "V13_AUTONOMOUS_FORCING_FOUNDATION_POSTMERGE_BF1D345F_RUNTIME_PROJECTION_V1",
  },
  V13_HOLISTIC_SCHEMA: {
    run_id: 33605700771,
    source_evidence_id: "V13_HOLISTIC_SCHEMA_POSTMERGE_BF1D345F",
    projected_evidence_id: "V13_HOLISTIC_SCHEMA_POSTMERGE_BF1D345F_RUNTIME_PROJECTION_V1",
  },
  V13_NEXT_TICK_VIABILITY: {
    run_id: 33605700731,
    source_evidence_id: "V13_NEXT_TICK_VIABILITY_POSTMERGE_BF1D345F",
    projected_evidence_id: "V13_NEXT_TICK_VIABILITY_POSTMERGE_BF1D345F_RUNTIME_PROJECTION_V1",
  },
  V13_PRODUCER_DRIVEN_QUALIFICATION: {
    run_id: 33605700840,
    source_evidence_id: "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F",
    projected_evidence_id: "V13_PRODUCER_DRIVEN_QUALIFICATION_POSTMERGE_BF1D345F_RUNTIME_PROJECTION_V1",
  },
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const aggregate = (resolverId, resolverDigest) =>
  "sha256:" + sha256(resolverId + "\u0000" + resolverDigest);

function setEqual(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

try {
  const authority = JSON.parse(fs.readFileSync(path.join(ROOT, AUTHORITY_PATH), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRY_PATH), "utf8"));
  const head = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  assert.match(head, /^[0-9a-f]{40}$/, "V13_MIGRATION_HEAD_REQUIRED");
  assert.equal(cp.spawnSync("git", ["merge-base", "--is-ancestor", BF1D, head], { cwd: ROOT }).status, 0, "BF1D_MUST_BE_ANCESTOR");

  const resolvedResult = resolveDependencyResolvers(ROOT, authority);
  assert.deepEqual(resolvedResult.errors, [], "V13_MIGRATION_RESOLVER_ERRORS_FORBIDDEN");
  const legacy = resolvedResult.resolved[LEGACY];
  const runtime = resolvedResult.resolved[RUNTIME];
  const harness = resolvedResult.resolved[HARNESS];
  assert.ok(legacy && runtime && harness, "V13_MIGRATION_RESOLVERS_REQUIRED");
  assert.deepEqual(legacy.missing, [], "V13_MIGRATION_LEGACY_MISSING_FORBIDDEN");
  assert.deepEqual(runtime.missing, [], "V13_MIGRATION_RUNTIME_MISSING_FORBIDDEN");
  assert.deepEqual(harness.missing, [], "V13_MIGRATION_HARNESS_MISSING_FORBIDDEN");

  const legacySet = new Set(legacy.paths);
  const runtimeSet = new Set(runtime.paths);
  const harnessSet = new Set(harness.paths);
  assert.equal(legacySet.size, 124, "V13_MIGRATION_LEGACY_PATH_COUNT_CHANGED");
  assert.equal(runtimeSet.size, 108, "V13_MIGRATION_RUNTIME_PATH_COUNT_CHANGED");
  assert.equal(harnessSet.size, 20, "V13_MIGRATION_HARNESS_PATH_COUNT_CHANGED");
  for (const rel of POST_MIGRATION_HARNESS_ADDITIONS) {
    assert.equal(harnessSet.has(rel), true, "V13_MIGRATION_POST_ADDITION_MUST_BE_HARNESS_GOVERNED:" + rel);
    assert.equal(legacySet.has(rel), false, "V13_MIGRATION_POST_ADDITION_MUST_NOT_ENTER_LEGACY_EVIDENCE:" + rel);
  }

  const legacyHarnessSet = new Set([...harnessSet].filter((value) => !POST_MIGRATION_HARNESS_ADDITIONS.includes(value)));
  assert.equal(legacyHarnessSet.size, 16, "V13_MIGRATION_LEGACY_HARNESS_PATH_COUNT_REQUIRED");
  assert.equal([...runtimeSet].some((value) => legacyHarnessSet.has(value)), false, "V13_MIGRATION_RUNTIME_HARNESS_OVERLAP_FORBIDDEN");
  assert.equal([...runtimeSet].every((value) => legacySet.has(value)), true, "V13_MIGRATION_RUNTIME_MUST_BE_LEGACY_SUBSET");
  assert.equal([...legacyHarnessSet].every((value) => legacySet.has(value)), true, "V13_MIGRATION_HARNESS_MUST_BE_LEGACY_SUBSET");
  assert.equal(setEqual(new Set([...runtimeSet, ...legacyHarnessSet]), legacySet), true, "V13_MIGRATION_LEGACY_PARTITION_MUST_BE_EXACT");

  for (const rel of runtimeSet) {
    assert.equal(rel.startsWith(".github/workflows/"), false, "V13_MIGRATION_WORKFLOW_IN_RUNTIME_RESOLVER_FORBIDDEN:" + rel);
    assert.equal(rel.startsWith("scripts/governance_acceptance/"), false, "V13_MIGRATION_GOVERNANCE_HARNESS_IN_RUNTIME_RESOLVER_FORBIDDEN:" + rel);
    assert.equal(rel.startsWith("scripts/runtime_acceptance/"), false, "V13_MIGRATION_RUNTIME_ACCEPTANCE_HARNESS_IN_RUNTIME_RESOLVER_FORBIDDEN:" + rel);
    assert.notEqual(rel, AUTHORITY_PATH, "V13_MIGRATION_QCP_AUTHORITY_IN_RUNTIME_RESOLVER_FORBIDDEN");
  }

  const legacyAtBf1d = dependencyDigestForPaths(ROOT, BF1D, legacy.paths, false);
  const runtimeAtBf1d = dependencyDigestForPaths(ROOT, BF1D, runtime.paths, false);
  const runtimeAtHead = dependencyDigestForPaths(ROOT, head, runtime.paths, true);
  assert.deepEqual(legacyAtBf1d.missing, [], "V13_MIGRATION_LEGACY_BF1D_PATH_MISSING");
  assert.deepEqual(runtimeAtBf1d.missing, [], "V13_MIGRATION_RUNTIME_BF1D_PATH_MISSING");
  assert.deepEqual(runtimeAtHead.missing, [], "V13_MIGRATION_RUNTIME_HEAD_PATH_MISSING");

  const legacyAggregate = aggregate(LEGACY, legacyAtBf1d.digest);
  const projectedAtBf1d = aggregate(RUNTIME, runtimeAtBf1d.digest);
  const projectedAtHead = aggregate(RUNTIME, runtimeAtHead.digest);
  assert.equal(legacyAggregate, LEGACY_AGGREGATE_DIGEST, "V13_MIGRATION_BF1D_LEGACY_DIGEST_MISMATCH");
  assert.equal(runtimeAtBf1d.digest, runtimeAtHead.digest, "V13_MIGRATION_RUNTIME_PATH_DIGEST_DRIFT");
  assert.equal(projectedAtBf1d, projectedAtHead, "V13_MIGRATION_PROJECTED_AGGREGATE_DIGEST_DRIFT");

  const entries = registry.requalification_evidence?.entries || [];
  const anchors = new Map((registry.requalification_evidence?.durable_anchors?.entries || []).map((row) => [row.evidence_id, row]));
  const sourceEvidence = {};
  const bindingFields = [
    "evidence_id", "check_id", "evidence_class", "generation", "stage", "subject_sha",
    "workflow_name", "workflow_path", "run_id", "run_conclusion", "artifact_id", "artifact_digest",
    "dependency_subject_sha", "dependency_digest_strategy", "dependency_digest",
    "artifact_absence_reason", "immutable",
  ];
  const expectedBinding = (entry) => sha256(JSON.stringify(bindingFields.map((key) => entry?.[key] ?? null)));
  for (const [checkId, spec] of Object.entries(PRODUCER_CHECKS)) {
    const runId = spec.run_id;
    const row = entries.find((entry) => entry.evidence_id === spec.source_evidence_id);
    assert.ok(row, "V13_MIGRATION_BF1D_SOURCE_EVIDENCE_REQUIRED:" + checkId);
    assert.equal(row.check_id, checkId, "V13_MIGRATION_BF1D_SOURCE_CHECK_MISMATCH:" + checkId);
    assert.equal(row.subject_sha, BF1D, "V13_MIGRATION_BF1D_SOURCE_SUBJECT_MISMATCH:" + checkId);
    assert.equal(row.run_id, runId, "V13_MIGRATION_BF1D_SOURCE_RUN_MISMATCH:" + checkId);
    assert.equal(row.dependency_digest, LEGACY_AGGREGATE_DIGEST, "V13_MIGRATION_BF1D_SOURCE_DIGEST_MISMATCH:" + checkId);
    assert.equal(row.run_conclusion, "success", "V13_MIGRATION_BF1D_SOURCE_RUN_SUCCESS_REQUIRED:" + checkId);
    assert.equal(row.immutable, true, "V13_MIGRATION_BF1D_SOURCE_IMMUTABLE_REQUIRED:" + checkId);
    const anchor = anchors.get(row.evidence_id);
    assert.ok(anchor, "V13_MIGRATION_BF1D_SOURCE_ANCHOR_REQUIRED:" + checkId);
    assert.equal(anchor.run_id, runId, "V13_MIGRATION_BF1D_SOURCE_ANCHOR_RUN_MISMATCH:" + checkId);
    assert.equal(anchor.run_snapshot?.head_sha, BF1D, "V13_MIGRATION_BF1D_SOURCE_ANCHOR_HEAD_MISMATCH:" + checkId);
    assert.equal(anchor.run_snapshot?.base_sha, "46367333d228a2b90a86ff6a33aebc334f3d73a2", "V13_MIGRATION_BF1D_SOURCE_ANCHOR_BASE_MISMATCH:" + checkId);

    const projected = entries.find((entry) => entry.evidence_id === spec.projected_evidence_id);
    assert.ok(projected, "V13_MIGRATION_PROJECTED_EVIDENCE_REQUIRED:" + checkId);
    assert.equal(projected.check_id, checkId, "V13_MIGRATION_PROJECTED_CHECK_MISMATCH:" + checkId);
    assert.equal(projected.subject_sha, BF1D, "V13_MIGRATION_PROJECTED_SUBJECT_MISMATCH:" + checkId);
    assert.equal(projected.run_id, runId, "V13_MIGRATION_PROJECTED_RUN_MISMATCH:" + checkId);
    assert.equal(projected.dependency_digest, projectedAtHead, "V13_MIGRATION_PROJECTED_DIGEST_MISMATCH:" + checkId);
    assert.equal(projected.projection_source_evidence_id, row.evidence_id, "V13_MIGRATION_PROJECTED_SOURCE_MISMATCH:" + checkId);
    assert.equal(projected.projection_migration_proof_subject_sha, "5e162fceb5758aa3eaf7894a474a5886fa069057", "V13_MIGRATION_PROJECTED_PROOF_SUBJECT_MISMATCH:" + checkId);
    assert.equal(projected.projection_legacy_dependency_digest, LEGACY_AGGREGATE_DIGEST, "V13_MIGRATION_PROJECTED_LEGACY_DIGEST_MISMATCH:" + checkId);
    assert.equal(projected.projection_runtime_resolver_id, RUNTIME, "V13_MIGRATION_PROJECTED_RESOLVER_MISMATCH:" + checkId);
    assert.equal(projected.projection_runtime_path_digest, runtimeAtHead.digest, "V13_MIGRATION_PROJECTED_PATH_DIGEST_MISMATCH:" + checkId);
    assert.equal(projected.projection_authorizes_new_live_claim, false, "V13_MIGRATION_PROJECTED_LIVE_CLAIM_FORBIDDEN:" + checkId);
    assert.equal(projected.immutable_binding_sha256, expectedBinding(projected), "V13_MIGRATION_PROJECTED_BINDING_MISMATCH:" + checkId);
    const projectedAnchor = anchors.get(projected.evidence_id);
    assert.ok(projectedAnchor, "V13_MIGRATION_PROJECTED_ANCHOR_REQUIRED:" + checkId);
    assert.equal(projectedAnchor.run_id, runId, "V13_MIGRATION_PROJECTED_ANCHOR_RUN_MISMATCH:" + checkId);
    assert.deepEqual(projectedAnchor.run_snapshot, anchor.run_snapshot, "V13_MIGRATION_PROJECTED_ANCHOR_SNAPSHOT_MISMATCH:" + checkId);
    sourceEvidence[checkId] = {
      source_evidence_id: row.evidence_id,
      projected_evidence_id: projected.evidence_id,
      run_id: runId,
    };
  }

  const producerWorkflow = fs.readFileSync(path.join(ROOT, ".github/workflows/mcft-cap-09-v13-producer-driven-live-qualification.yml"), "utf8");
  const applicabilityIndex = producerWorkflow.indexOf("- name: Resolve governed producer live applicability");
  const durableIndex = producerWorkflow.indexOf("- name: Accept durable producer evidence without live rerun");
  const armIndex = producerWorkflow.indexOf("- name: Resolve explicit live arm");
  const requireArmIndex = producerWorkflow.indexOf("- name: Require live arm when live requalification is required");
  assert(applicabilityIndex >= 0 && durableIndex > applicabilityIndex && armIndex > durableIndex && requireArmIndex > armIndex, "V13_MIGRATION_PRODUCER_APPLICABILITY_ARM_ORDER_INVALID");
  assert.equal(producerWorkflow.includes("id: applicability\n        if: steps.arm.outputs.armed == 'true'"), false, "V13_MIGRATION_APPLICABILITY_MUST_NOT_BE_ARM_GATED");
  assert.equal(producerWorkflow.includes("if: steps.applicability.outputs.live_required == 'false'"), true, "V13_MIGRATION_DURABLE_SKIP_MUST_BE_APPLICABILITY_GATED");
  assert.equal(producerWorkflow.includes("id: arm\n        if: steps.applicability.outputs.live_required == 'true'"), true, "V13_MIGRATION_ARM_MUST_REQUIRE_LIVE_REQUALIFICATION");
  assert.equal(producerWorkflow.includes("V13_LIVE_ARM_FIRST_BASE_MUST_LEAD_BY_MORE_THAN_6H"), true, "V13_MIGRATION_LIVE_ARM_FRESHNESS_GUARD_MUST_REMAIN");

  write({
    schema_version: "geox_mcft_cap09_v13_runtime_harness_resolver_migration_v1",
    status: "PASS",
    subject_sha: head,
    source_subject_sha: BF1D,
    legacy_resolver_id: LEGACY,
    runtime_resolver_id: RUNTIME,
    harness_resolver_id: HARNESS,
    legacy_path_count: legacySet.size,
    runtime_path_count: runtimeSet.size,
    legacy_harness_path_count: legacyHarnessSet.size,
    current_harness_path_count: harnessSet.size,
    post_migration_harness_addition_count: POST_MIGRATION_HARNESS_ADDITIONS.length,
    exact_partition_proven: true,
    runtime_harness_overlap_count: 0,
    legacy_aggregate_digest: legacyAggregate,
    expected_legacy_aggregate_digest: LEGACY_AGGREGATE_DIGEST,
    runtime_path_digest_bf1d: runtimeAtBf1d.digest,
    runtime_path_digest_current: runtimeAtHead.digest,
    projected_runtime_aggregate_digest_bf1d: projectedAtBf1d,
    projected_runtime_aggregate_digest_current: projectedAtHead,
    projected_runtime_digest_stable: true,
    source_evidence: sourceEvidence,
    projected_evidence_registry_complete: true,
    applicability_resolved_before_live_arm: true,
    stale_arm_checked_only_when_live_requalification_required: true,
    projection_authorizes_new_live_claim: false,
    production_runtime_mutation: false,
    provider_request_count: 0,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_v13_runtime_harness_resolver_migration_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    production_runtime_mutation: false,
    provider_request_count: 0,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  process.exitCode = 1;
}
