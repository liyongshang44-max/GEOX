"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const runnerPath = path.join(root, "scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1");
const configPath = path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-800C-CONFIG-V1.json");
const workflowPath = path.join(root, ".github/workflows/mcft-cap09-windows-deployment-runner-v1.yml");
const docPath = path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-V1.md");

const runner = fs.readFileSync(runnerPath, "utf8");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const workflow = fs.readFileSync(workflowPath, "utf8");
const doc = fs.readFileSync(docPath, "utf8");
let checks = 0;
const pass = fn => { fn(); checks++; };

pass(() => assert.equal(config.schema_version, "MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_CONFIG_V1"));
pass(() => assert.equal(config.run_id, "800c023cf337"));
pass(() => assert.equal(config.subject_commit_sha, "a44b294f684027c0d1dd7a28c3735442fca736a4"));
pass(() => assert.equal(config.source.expected_release_files, 6414));
pass(() => assert.equal(config.source.expected_entrypoints.length, 7));
pass(() => assert.equal(config.pg.port, 55434));
pass(() => assert.match(config.pg.container_name, /800c023cf337/));
pass(() => assert.equal(config.authority.execution_authorized, false));
pass(() => assert.equal(config.authority.production_authorized, false));
pass(() => assert.equal(config.authority.test_only_hold, true));
pass(() => assert.equal(config.authority.production_hold, true));
pass(() => assert.equal(config.pg.expected_acl_digest_sha256.evidence, null));
pass(() => assert.equal(config.pg.expected_acl_digest_sha256.twin, null));
pass(() => assert.equal(config.minio.prefix, null));
pass(() => assert.equal(config.minio.aws_profile, null));
pass(() => assert.equal(config.minio.expected_policy_sha256, null));

for (const marker of [
  "execution_authorized = $false",
  "production_authorized = $false",
  "BEGIN READ ONLY",
  "permission denied for database",
  "PG_FROZEN_ACL_DIGEST_REQUIRED",
  "MINIO_SCOPED_RESTRICTED_INPUT_REQUIRED",
  "list-objects-v2",
  "head-bucket",
  "mutable_checkout_used = $false",
  "operator_supplied_exact_archive",
  "github_exact_commit_archive",
  "RELEASE_CANONICAL_BYTE_VERIFICATION_FAILED"
]) pass(() => assert.ok(runner.includes(marker), marker));

for (const forbidden of [
  "s3api put-object",
  "s3api delete-object",
  "mc admin",
  "docker restart",
  "ALTER ROLE",
  "CREATE ROLE ",
  "GRANT geox_",
  "REVOKE ALL ON",
  "--execute"
]) pass(() => assert.ok(!runner.toLowerCase().includes(forbidden.toLowerCase()), forbidden));

pass(() => assert.match(workflow, /windows-latest/));
pass(() => assert.match(workflow, /-SelfTest/));
pass(() => assert.match(workflow, /ACCEPTANCE_MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1\.cjs/));
pass(() => assert.match(doc, /never starts Producer/i));
pass(() => assert.match(doc, /does not issue or consume a permit/i));
pass(() => assert.match(doc, /FullReadOnly/i));

console.log(JSON.stringify({
  status: "WINDOWS_DEPLOYMENT_RUNNER_STATIC_ACCEPTANCE_PASS",
  checks,
  run_id: config.run_id,
  current_800c_full_admission_expected: "HOLD_UNTIL_FROZEN_PG_ACL_AND_MINIO_RESTRICTED_IDENTITY_ARE_PINNED",
  execution_authorized: false,
  production_authorized: false
}));
