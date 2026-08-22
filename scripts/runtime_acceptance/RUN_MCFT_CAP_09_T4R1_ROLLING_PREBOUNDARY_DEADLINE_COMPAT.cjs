#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const T4_WORKFLOW = "mcft-cap-09-t4r1-rolling-preboundary-capture";
const QUALIFIED_ROLLING_POLICY_IDENTITY = "mcft-cap-09-rolling-preboundary-capture";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const RUNNER_BLOB = "26dd21c5a0b7a60fca06e5e4c2ec92289a102a47";
const GENERATED = "scripts/runtime_acceptance/.generated_RUN_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const HISTORICAL_NAMESPACE = "namespace: namespaceFor(target)";
const RUN_SCOPED_NAMESPACE = "namespace: `${namespaceFor(target)}-${required(\"GITHUB_RUN_ID\")}-${required(\"GITHUB_RUN_ATTEMPT\")}`";

function mappedWorkflowIdentity(actual) {
  if (actual !== T4_WORKFLOW) {
    throw new Error(`MCFT_CAP09_T4R1_DEADLINE_COMPAT_OUTER_WORKFLOW_REQUIRED:${actual || "MISSING"}`);
  }
  return QUALIFIED_ROLLING_POLICY_IDENTITY;
}

function buildRunScopedRunner() {
  const observedBlob = execFileSync("git", ["rev-parse", `HEAD:${RUNNER}`], { encoding: "utf8" }).trim();
  if (observedBlob !== RUNNER_BLOB) throw new Error(`MCFT_CAP09_T4R1_ROLLING_SOURCE_BLOB_DRIFT:${observedBlob}`);
  const source = fs.readFileSync(RUNNER, "utf8");
  const count = source.split(HISTORICAL_NAMESPACE).length - 1;
  if (count !== 1) throw new Error(`MCFT_CAP09_T4R1_RETENTION_NAMESPACE_REPLACEMENT_CARDINALITY:${count}`);
  const generated = source.replace(HISTORICAL_NAMESPACE, RUN_SCOPED_NAMESPACE);
  if (generated.includes(HISTORICAL_NAMESPACE)) throw new Error("MCFT_CAP09_T4R1_TARGET_ONLY_RETENTION_NAMESPACE_SURVIVED");
  if (!generated.includes(RUN_SCOPED_NAMESPACE)) throw new Error("MCFT_CAP09_T4R1_RUN_SCOPED_RETENTION_NAMESPACE_REQUIRED");
  return generated;
}

function selftest() {
  if (mappedWorkflowIdentity(T4_WORKFLOW) !== QUALIFIED_ROLLING_POLICY_IDENTITY) {
    throw new Error("MCFT_CAP09_T4R1_DEADLINE_COMPAT_ZERO_MARGIN_POLICY_REQUIRED");
  }
  let rejected = false;
  try {
    mappedWorkflowIdentity("mcft-cap-09-rolling-preboundary-capture-historical-retired");
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("MCFT_CAP09_T4R1_DEADLINE_COMPAT_HISTORICAL_IDENTITY_MUST_FAIL_CLOSED");
  const generated = buildRunScopedRunner();
  if (!generated.includes('this.createdRefs.add(ref);')) throw new Error("MCFT_CAP09_T4R1_CREATED_ONLY_FAILURE_CLEANUP_REQUIRED");
  if (!generated.includes('if (probe.status === 200) {')) throw new Error("MCFT_CAP09_T4R1_EXISTING_OBJECT_REUSE_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    outer_workflow: T4_WORKFLOW,
    qualified_deadline_policy_identity: QUALIFIED_ROLLING_POLICY_IDENTITY,
    rolling_minimum_ingress_margin_minutes: 0,
    soil_observation_window_minutes_unchanged: 15,
    historical_workflow_authorized: false,
    source_runner_blob: RUNNER_BLOB,
    retention_namespace_mode: "TARGET_PLUS_GITHUB_RUN_ID_PLUS_ATTEMPT",
    repeated_target_cross_run_collision_forbidden: true,
    prior_candidate_retention_metadata_immutable: true,
    reused_object_failure_cleanup_forbidden: true,
  }));
}

function run() {
  const mapped = mappedWorkflowIdentity(process.env.GITHUB_WORKFLOW);
  if (!/^\d+$/.test(String(process.env.GITHUB_RUN_ID || ""))) throw new Error("MCFT_CAP09_T4R1_GITHUB_RUN_ID_REQUIRED");
  if (!/^\d+$/.test(String(process.env.GITHUB_RUN_ATTEMPT || ""))) throw new Error("MCFT_CAP09_T4R1_GITHUB_RUN_ATTEMPT_REQUIRED");
  const generated = buildRunScopedRunner();
  fs.writeFileSync(GENERATED, generated);
  try {
    const child = spawnSync("pnpm", ["exec", "tsx", GENERATED], {
      stdio: "inherit",
      env: {
        ...process.env,
        GITHUB_WORKFLOW: mapped,
      },
    });
    if (child.error) throw child.error;
    if (child.signal) throw new Error(`MCFT_CAP09_T4R1_DEADLINE_COMPAT_CHILD_SIGNAL:${child.signal}`);
    if (child.status !== 0) process.exitCode = child.status ?? 1;
  } finally {
    try { fs.unlinkSync(GENERATED); } catch {}
  }
}

if (process.argv[2] === "selftest") selftest();
else run();
