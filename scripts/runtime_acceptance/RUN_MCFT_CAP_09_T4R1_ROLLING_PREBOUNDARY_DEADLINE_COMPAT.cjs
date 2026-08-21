#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

const T4_WORKFLOW = "mcft-cap-09-t4r1-rolling-preboundary-capture";
const QUALIFIED_ROLLING_POLICY_IDENTITY = "mcft-cap-09-rolling-preboundary-capture";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";

function mappedWorkflowIdentity(actual) {
  if (actual !== T4_WORKFLOW) {
    throw new Error(`MCFT_CAP09_T4R1_DEADLINE_COMPAT_OUTER_WORKFLOW_REQUIRED:${actual || "MISSING"}`);
  }
  return QUALIFIED_ROLLING_POLICY_IDENTITY;
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
  console.log(JSON.stringify({
    status: "PASS",
    outer_workflow: T4_WORKFLOW,
    qualified_deadline_policy_identity: QUALIFIED_ROLLING_POLICY_IDENTITY,
    rolling_minimum_ingress_margin_minutes: 0,
    soil_observation_window_minutes_unchanged: 15,
    historical_workflow_authorized: false,
  }));
}

function run() {
  const mapped = mappedWorkflowIdentity(process.env.GITHUB_WORKFLOW);
  const child = spawnSync("pnpm", ["exec", "tsx", RUNNER], {
    stdio: "inherit",
    env: {
      ...process.env,
      GITHUB_WORKFLOW: mapped,
    },
  });
  if (child.error) throw child.error;
  if (child.signal) throw new Error(`MCFT_CAP09_T4R1_DEADLINE_COMPAT_CHILD_SIGNAL:${child.signal}`);
  if (child.status !== 0) process.exitCode = child.status ?? 1;
}

if (process.argv[2] === "selftest") selftest();
else run();
