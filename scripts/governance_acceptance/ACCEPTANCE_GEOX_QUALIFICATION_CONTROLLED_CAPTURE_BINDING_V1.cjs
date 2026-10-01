#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const AUTH_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CONTROLLED-CAPTURE-SOURCE-BINDING-V1.json");
const PREPARE = path.join(ROOT, "scripts/qualification/PREPARE_MCFT_CAP09_CONTROLLED_T4R1_CAPTURE_SOURCE_V1.cjs");
const auth = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
const prepareSource = fs.readFileSync(PREPARE, "utf8");

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

assert.equal(auth.producer_identity.protected_main_sha, "8f63c498bd48978e2dd525ad57b6b8fdb7ada560");
assert.equal(auth.producer_identity.role, "CAPTURE_PRODUCER_IDENTITY");
assert.equal(auth.producer_identity.same_path_source_blob_is_authority, false);
assert.equal(auth.provider_source_authority.historical_capture_commit, "75d4961279bd64dc1c9dd7d68aac189c72c98846");
assert.equal(auth.provider_source_authority.historical_capture_workflow_blob, "800cbd91a5d84801405affa6f372c0aa6388b173");
assert.equal(auth.provider_source_authority.historical_compatibility_shim_blob, "9d0ba5913fada1573da954c24b59490376a32ef7");
assert.equal(auth.provider_source_authority.exact_provider_runner_blob, "26dd21c5a0b7a60fca06e5e4c2ec92289a102a47");
assert.equal(auth.provider_source_authority.source_resolution, "GIT_BLOB_OBJECT_NOT_CURRENT_MAIN_PATH_EQUALITY");
assert.equal(auth.controlled_adapter.purpose, "REMOVE_GITHUB_EXECUTION_IDENTITY_COUPLING_ONLY");
assert.equal(auth.secret_values_stored_in_repository, false);
assert.equal(auth.authority_ceiling.production_mutation, false);
assert.equal(auth.authority_ceiling.runtime_semantic_change, false);
assert.equal(auth.authority_ceiling.formal_v5_arm, false);
assert.equal(auth.authority_ceiling.a0, false);
assert.equal(auth.authority_ceiling.o00_o23, false);

const workflowBlob = git(["rev-parse", `${auth.provider_source_authority.historical_capture_commit}:${auth.provider_source_authority.historical_capture_workflow_path}`]);
const shimBlob = git(["rev-parse", `${auth.provider_source_authority.historical_capture_commit}:${auth.provider_source_authority.historical_compatibility_shim_path}`]);
const runnerType = git(["cat-file", "-t", auth.provider_source_authority.exact_provider_runner_blob]);
const currentMainPathBlob = git(["rev-parse", `${auth.producer_identity.protected_main_sha}:${auth.provider_source_authority.provider_runner_path}`]);

assert.equal(workflowBlob, auth.provider_source_authority.historical_capture_workflow_blob);
assert.equal(shimBlob, auth.provider_source_authority.historical_compatibility_shim_blob);
assert.equal(runnerType, "blob");
assert.match(currentMainPathBlob, /^[0-9a-f]{40}$/);

const shim = git(["show", `${auth.provider_source_authority.historical_capture_commit}:${auth.provider_source_authority.historical_compatibility_shim_path}`]);
assert.ok(shim.includes(`const RUNNER_BLOB = "${auth.provider_source_authority.exact_provider_runner_blob}";`));
assert.match(prepareSource, /git\", \[\"cat-file\", \"blob\"/);
assert.match(prepareSource, /MCFT_QMIG_CAPTURE_POLICY_IDENTITY/);
assert.match(prepareSource, /MCFT_QMIG_RUN_ID/);
assert.match(prepareSource, /QMIG_CAPTURE_GITHUB_IDENTITY_SURVIVED/);
assert.doesNotMatch(prepareSource, /currentPathBlob\s*!==\s*a\.exact_provider_runner_blob/);

const materializer = JSON.parse(execFileSync(process.execPath, [PREPARE, "selftest"], { cwd: ROOT, encoding: "utf8" }));
assert.equal(materializer.status, "PASS");
assert.equal(materializer.provider_runner_blob, auth.provider_source_authority.exact_provider_runner_blob);
assert.equal(materializer.current_main_same_path_blob_observed_not_authority, currentMainPathBlob);
assert.equal(materializer.github_execution_identity_removed, true);
assert.equal(materializer.provider_semantics_changed, false);

process.stdout.write(JSON.stringify({
  schema_version: "geox_qualification_controlled_capture_binding_acceptance_v1",
  status: "PASS",
  protected_main_producer_identity: auth.producer_identity.protected_main_sha,
  historical_provider_source_authority: auth.provider_source_authority.historical_capture_commit,
  exact_provider_runner_blob: auth.provider_source_authority.exact_provider_runner_blob,
  current_main_same_path_blob_observed_not_authority: currentMainPathBlob,
  historical_workflow_blob: workflowBlob,
  historical_compatibility_shim_blob: shimBlob,
  github_execution_identity_removed: true,
  provider_semantics_changed: false,
  current_main_blob_equality_required: false,
  production_mutation: false,
  runtime_semantic_change: false
}, null, 2) + "\n");
