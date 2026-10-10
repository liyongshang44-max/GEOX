#!/usr/bin/env node
"use strict";
// Read-only preparation. Deliberately cannot invoke any qualification or recovery executor.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const CONTRACT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-BASELINE-PREPARATION-CONTRACT-V1.json";
const QCP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const hash = b => crypto.createHash("sha256").update(b).digest("hex");
const git = args => cp.execFileSync("git", args, {cwd: ROOT, encoding: "utf8", timeout: 30000}).trim();

function verifyDeploymentBinding(c, paths) {
  const d = c.deployment_observation;
  assert.equal(d.evidence_class, "OPERATOR_DOCKER_INSPECT_NOT_BUILD_ATTESTATION");
  assert.equal(d.deployment_subject, "3b46be1dda2406ffdcc869c55758f3393d69c716");
  assert.equal(d.image_id, "sha256:b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456");
  assert.equal(d.image_tag, "geox-mcft-cap09-runtime:" + d.deployment_subject);
  assert.equal(d.image_contents_attested, false);
  assert.equal(d.qualification_subject_equals_deployment_subject_required, false);
  assert.equal(d.qualification_subject_retagging_allowed, false);
  assert.equal(d.production_recovery_authorized, false);
  git(["merge-base", "--is-ancestor", d.deployment_subject, c.adopted_baseline]);
  assert.equal(git(["diff", "--name-only", d.deployment_subject, c.adopted_baseline, "--", ...paths]),
    "", "DEPLOYED_SOURCE_FROZEN_RUNTIME_DRIFT");
  const bootstrapPaths = [
    "apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.ts",
    "apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts",
    "docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml",
    "docker/mcft-cap09-runtime.Dockerfile",
    "pnpm-lock.yaml"
  ];
  assert.equal(git(["diff", "--name-only", d.deployment_subject, c.adopted_baseline, "--", ...bootstrapPaths]),
    "", "DEPLOYED_BOOTSTRAP_OR_BUILD_INPUT_CHANGED");
  return {...d, frozen_source_runtime_matches_current_baseline: true,
    bootstrap_source_and_selected_build_inputs_match: true,
    image_contents_attested: false, owner_qualified: false};
}

const ADOPTED_ENTRY_MAIN = "9625680d4bec137956d79960e0f9feaad4ebf6ab";
const ISOLATED_AUTHORIZATION_BASE = "6c6f2d77301a852dbb2f52538df89e3098b5aee5";
const ISOLATED_ADOPTED_MAIN = "2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b";
const ISOLATED_BUCKET_SUCCESSOR_PATHS = [
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-PRODUCER-BUCKET-SEAM-20261010-V1.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
  "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"
];
const ISOLATED_AUTHORIZATION_SUCCESSOR_PATHS = [
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-QUALIFICATION-ARM-AUTHORIZATION-20261010-V1.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
  "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json"
];
const ENGINEERING_SOURCE_GUARD_SUCCESSOR_PATHS = [
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
  "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
].sort();
function validateMainAdoption({
  anchor, head, main, parents, candidate_tree, main_tree,
  head_descends_from_main = false, successor_paths = [],
}) {
  if (main === anchor) return "PRE_MERGE_ANCHOR";
  assert(Array.isArray(parents) && parents.length === 2, "EXACT_TWO_PARENT_ADOPTION_REQUIRED");
  assert([anchor, ADOPTED_ENTRY_MAIN, ISOLATED_AUTHORIZATION_BASE, ISOLATED_ADOPTED_MAIN].includes(parents[0]), "FIRST_PARENT_BASE_CHANGED");
  assert.match(parents[1], /^[a-f0-9]{40}$/);
  assert.match(candidate_tree, /^[a-f0-9]{40}$/);
  assert.equal(main_tree, candidate_tree, "MERGE_CANDIDATE_ZERO_DELTA_REQUIRED");
  if (parents[0] === ISOLATED_ADOPTED_MAIN) {
    assert.equal(head,main,"ISOLATED_BUCKET_SUCCESSOR_MAIN_NOT_ADOPTED");
    assert.deepEqual(successor_paths,ISOLATED_BUCKET_SUCCESSOR_PATHS,
      "ISOLATED_BUCKET_POST_MERGE_SCOPE_CHANGED");
    return "POST_MERGE_ISOLATED_BUCKET_SEAM_ENGINEERING_ONLY";
  }
  if (main === ISOLATED_ADOPTED_MAIN && head !== main) {
    assert.equal(head_descends_from_main,true,"ISOLATED_BUCKET_MUST_DESCEND_EXACT_MAIN");
    assert.deepEqual(successor_paths,ISOLATED_BUCKET_SUCCESSOR_PATHS,
      "ISOLATED_BUCKET_PRE_MERGE_SCOPE_CHANGED");
    return "PRE_MERGE_ISOLATED_BUCKET_SEAM_ENGINEERING_ONLY";
  }
  if (parents[0] === ISOLATED_AUTHORIZATION_BASE) {
    assert.equal(head,main,"ISOLATED_AUTHORIZATION_NOT_ADOPTED");
    assert.deepEqual(successor_paths,ISOLATED_AUTHORIZATION_SUCCESSOR_PATHS,
      "ISOLATED_AUTHORIZATION_POST_MERGE_SCOPE_MISMATCH");
    return "POST_MERGE_ISOLATED_QUALIFICATION_AUTHORIZATION";
  }
  if (main === ISOLATED_AUTHORIZATION_BASE && head !== main) {
    assert.equal(head_descends_from_main,true,"AUTHORIZATION_BRANCH_MUST_DESCEND_EXACT_MAIN");
    assert.deepEqual(successor_paths,ISOLATED_AUTHORIZATION_SUCCESSOR_PATHS,
      "ISOLATED_AUTHORIZATION_PRE_MERGE_SCOPE_MISMATCH");
    return "PRE_MERGE_ISOLATED_QUALIFICATION_AUTHORIZATION";
  }
  if (parents[0] === ADOPTED_ENTRY_MAIN) {
    assert.equal(head, main, "SOURCE_GUARD_SUCCESSOR_MAIN_NOT_ADOPTED");
    assert.deepEqual(successor_paths, ENGINEERING_SOURCE_GUARD_SUCCESSOR_PATHS,
      "ADOPTED_GUARD_SUCCESSOR_SCOPE_MISMATCH");
    return "POST_MERGE_SOURCE_GUARD_ZERO_DELTA_ADOPTION";
  }
  if (head !== main) {
    assert.equal(head_descends_from_main, true, "CURRENT_MAIN_NOT_ANCESTOR_OF_SUCCESSOR");
    assert.deepEqual(successor_paths, ENGINEERING_SOURCE_GUARD_SUCCESSOR_PATHS,
      "CURRENT_BASELINE_ENGINEERING_SUCCESSOR_SCOPE_MISMATCH");
    return "PROTECTED_MAIN_DESCENDANT_ENGINEERING_ONLY_CANDIDATE";
  }
  assert.deepEqual(successor_paths, [], "CURRENT_MAIN_EXECUTION_CANDIDATE_PATHS_FORBIDDEN");
  return "PROTECTED_MAIN_EXACT_MERGE_TREE_ADOPTION";
}
function verifySources() {
  const c = read(CONTRACT);
  assert.equal(c.status, "PREPARATION_ONLY_NOT_EXECUTION_AUTHORITY");
  assert.equal(c.adopted_baseline, "96984439d8587f13ba57b6b0948a1c81d55da9e5");
  assert.equal(c.frozen_runtime, "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a");
  for (const [effect, allowed] of Object.entries(c.authorization)) assert.equal(allowed, false, "EFFECT_FORBIDDEN:" + effect);
  git(["merge-base", "--is-ancestor", c.adopted_baseline, "HEAD"]);
  const head = git(["rev-parse", "HEAD"]), main = git(["rev-parse", "origin/main"]);
  const parents = main === c.adopted_baseline ? [] : git(["show", "-s", "--format=%P", main]).split(" ");
  if (parents.length === 2) git(["merge-base", "--is-ancestor", c.adopted_baseline, parents[1]]);
  const adoptedParent = parents[0] === ISOLATED_ADOPTED_MAIN ?
    ISOLATED_ADOPTED_MAIN : parents[0] === ISOLATED_AUTHORIZATION_BASE ?
    ISOLATED_AUTHORIZATION_BASE : ADOPTED_ENTRY_MAIN;
  const successorPaths = head===main &&
    ![ADOPTED_ENTRY_MAIN,ISOLATED_AUTHORIZATION_BASE,ISOLATED_ADOPTED_MAIN].includes(parents[0]) ? [] :
    git(["diff", "--name-only",
      head===main ? adoptedParent : main, head]).split(/\r?\n/).filter(Boolean).sort();
  const descends = head===main ? false :
    cp.spawnSync("git", ["merge-base", "--is-ancestor", main, head],
      {cwd:ROOT, timeout:30000}).status === 0;
  const adoption = validateMainAdoption({anchor:c.adopted_baseline,head,main,parents,
    candidate_tree:parents.length===2?git(["rev-parse",parents[1]+"^{tree}"]):null,
    main_tree:main===c.adopted_baseline?null:git(["rev-parse",main+"^{tree}"]),
    head_descends_from_main:descends,successor_paths:successorPaths});
  const paths = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs")
    .resolveDependencyResolvers(ROOT, read(QCP)).resolved[c.runtime_resolver].paths;
  assert.equal(paths.length, c.runtime_path_count, "FROZEN_PARTITION_CHANGED");
  for (const p of paths) {
    const historical = cp.execFileSync("git", ["show", c.frozen_runtime + ":" + p], {cwd: ROOT});
    assert.equal(hash(fs.readFileSync(path.join(ROOT, p))), hash(historical), "FROZEN_RUNTIME_DRIFT:" + p);
  }
  for (const [p, expected] of Object.entries(c.preserved_artifacts)) {
    assert.equal(hash(fs.readFileSync(path.join(ROOT, p))), expected, "HISTORICAL_ARTIFACT_CHANGED:" + p);
  }
  const tracked = git(["diff", "--name-only", c.adopted_baseline]).split(/\r?\n/).filter(Boolean);
  // Generated, untracked acceptance receipts are not source; tracked modifications remain checked.
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(p => p && !p.startsWith("acceptance-output/"));
  const newScope = ["PRE_MERGE_ISOLATED_BUCKET_SEAM_ENGINEERING_ONLY",
    "POST_MERGE_ISOLATED_BUCKET_SEAM_ENGINEERING_ONLY"].includes(adoption) ?
    ISOLATED_BUCKET_SUCCESSOR_PATHS :
    ["PRE_MERGE_ISOLATED_QUALIFICATION_AUTHORIZATION",
      "POST_MERGE_ISOLATED_QUALIFICATION_AUTHORIZATION"].includes(adoption) ?
    ISOLATED_AUTHORIZATION_SUCCESSOR_PATHS : [];
  for (const p of [...tracked, ...untracked]) assert(
    c.preparation_paths.includes(p) || newScope.includes(p),
    "PREPARATION_SCOPE_EXCEEDED:" + p);
  return {contract: c, subject_sha: head, protected_main_adoption:adoption, frozen_runtime_paths_verified: paths.length,
    deployment_binding: verifyDeploymentBinding(c, paths)};
}

function diagnoseHealth(observation) {
  if (!observation) return {status: "NOT_OBSERVED", owner_qualified: false};
  const age = observation.log_age_seconds;
  const rows = observation.recent_health_records;
  const latest = Array.isArray(rows) ? rows.at(-1) : null;
  const role = latest?.runtime_role;
  const accepted = role === "EVIDENCE_RUNTIME" ? ["HEALTHY", "STANDBY"]
    : role === "TWIN_RUNTIME" ? ["HEALTHY", "BACKPRESSURE", "OWNER_LEASE_HEALTHY"] : [];
  const blockers = [];
  if (!Number.isFinite(age) || age < -5 || age > 180) blockers.push("CURRENT_HEALTH_REQUIRED");
  if (!accepted.includes(latest?.status)) blockers.push("RUNTIME_READY_HEALTH_REQUIRED");
  return {status: blockers.length ? "BLOCKED" : "HEALTH_PRECONDITION_ONLY",
    latest_status: latest?.status ?? null, owner_qualified: false,
    lease_t1_t2_observed: false, blockers};
}

function prepare({source, now = new Date(), evidence, twin}) {
  const c = source.contract;
  assert(Number.isFinite(now.getTime()), "PREPARATION_CLOCK_INVALID");
  const producerArm = read("scripts/runtime_acceptance/MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_ARM.json");
  const timingArm = read("scripts/runtime_acceptance/MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_ARM_V1.json");
  const entries = read(REGISTRY).entries.filter(e =>
    ["EFFECTIVE_FOR_RUNTIME_CONSUMPTION", "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"].includes(e.graduation_status)
    && Number.isFinite(Date.parse(e.authority_as_of)) && Date.parse(e.authority_as_of) <= now.getTime());
  entries.sort((a, b) => Date.parse(b.authority_as_of) - Date.parse(a.authority_as_of));
  const stage = entries[0];
  return {
    status: "PREPARATION_COMPLETE_EXECUTION_BLOCKED",
    qualification_pass: false,
    adopted_baseline: c.adopted_baseline, subject_sha: source.subject_sha,
    frozen_runtime_paths_verified: source.frozen_runtime_paths_verified,
    observed_at: now.toISOString(),
    contract_ref: CONTRACT,
    recovery: {
      evidence: diagnoseHealth(evidence), twin: diagnoseHealth(twin),
      deployment_binding: source.deployment_binding,
      deployed_image_provenance_verified: false,
      failed_receipt_and_historical_attempts_verified: false,
      stage_registry_candidate: stage ? {
        authority_ref: stage.authority_ref, authority_as_of: stage.authority_as_of,
        authority_valid_until: stage.authority_valid_until
      } : null,
      all_25_context_coverage_verified: false,
      recovery_executor_authorized: false,
      blockers: ["DEPLOYED_IMAGE_AND_FAILED_RECEIPT_RECONCILIATION_REQUIRED",
        "GOVERNED_RECOVERY_EXECUTION_ROUTE_REQUIRED", "FRESH_ADOPTED_STAGE_AND_WINDOW_REQUIRED",
        "BOTH_ROLES_LIVE_OWNER_RENEWAL_REQUIRED"]
    },
    qualification: {
      lead_applies_to: c.qualification_requirements.lead_applies_to,
      historical_producer_arm_reused: false,
      historical_producer_arm_currently_future: Date.parse(producerArm.qualification_first_base) > now.getTime(),
      historical_timing_arm_enabled: timingArm.armed === true,
      first_base_must_be_after: new Date(now.getTime() + 6 * 3600000).toISOString(),
      blockers: ["CURRENT_SUBJECT_GOVERNED_EXECUTOR_AND_QCP_SUCCESSOR_REQUIRED",
        "EXPLICIT_ISOLATED_DATABASE_AND_OBJECT_STORAGE_AUTHORITY_REQUIRED",
        "FRESH_QUALIFICATION_ARM_REQUIRED", "REAL_PRODUCER_AND_TIMING_EVIDENCE_REQUIRED"],
      historical_evidence_preserved: true
    },
    effects_authorized: {...c.authorization},
    provider_request_count: 0, database_write_count: 0, object_write_count: 0,
    container_mutation_count: 0, historical_attempt_reset: false
  };
}

function main() {
  const args = process.argv.slice(2);
  assert(args.every(a => a === "--plan-only"), "ONLY_PLAN_ONLY_SUPPORTED_NO_EXECUTION_AUTHORITY");
  console.log(JSON.stringify(prepare({source: verifySources()}), null, 2));
}
module.exports = {verifySources, verifyDeploymentBinding, diagnoseHealth, prepare, validateMainAdoption};
if (require.main === module) {
  try { main(); } catch (e) {
    console.error(JSON.stringify({status: "PREPARATION_BLOCKED", reason: e.message, execution_authorized: false}));
    process.exitCode = 1;
  }
}
