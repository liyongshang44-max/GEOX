"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const runnerPath = path.join(root, "scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1");
const configPath = path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-800C-CONFIG-V1.json");
const workflowPath = path.join(root, ".github/workflows/mcft-cap09-windows-deployment-runner-v1.yml");
const docPath = path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-V1.md");
const qcpPath = path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json");

const runner = fs.readFileSync(runnerPath, "utf8");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const workflow = fs.readFileSync(workflowPath, "utf8");
const doc = fs.readFileSync(docPath, "utf8");
const qcp = JSON.parse(fs.readFileSync(qcpPath, "utf8"));
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
pass(() => assert.equal(config.minio.denied_bucket, "mcft-cap09-requal-72dc0304a21a"));
pass(() => assert.equal(config.minio.expected_container_id, "952016cb6e18295242b6ea895004ae2541470be460708147ba001521bf907c70"));
pass(() => assert.equal(config.minio.expected_policy_sha256, "47b07f9e6dfbe6377fe628eb972f388c3f7cece28757afe86cc36e75530728b6"));
pass(() => assert.ok(config.minio.expected_policy_actions.includes("s3:PutObject")));
pass(() => assert.ok(config.minio.expected_policy_actions.includes("s3:DeleteObject")));
pass(() => assert.ok(!config.minio.expected_policy_actions.includes("s3:ListAllMyBuckets")));

for (const marker of [
  "execution_authorized = $false",
  "production_authorized = $false",
  "BEGIN READ ONLY",
  "permission denied for database",
  "PG_FROZEN_ACL_DIGEST_REQUIRED",
  "MINIO_SCOPED_RESTRICTED_INPUT_REQUIRED",
  "list-objects-v2",
  "list-buckets",
  "System.Diagnostics.ProcessStartInfo",
  "RedirectStandardError",
  "MINIO_GLOBAL_LIST_EXPOSES_OUT_OF_SCOPE_BUCKETS",
  "EPHEMERAL_CHILD_PROCESS_ENV_ONLY",
  "MinioCredentialJsonPath",
  "mutable_checkout_used = $false",
  "operator_supplied_exact_archive",
  "github_exact_commit_archive",
  "RELEASE_CANONICAL_BYTE_VERIFICATION_FAILED"
]) pass(() => assert.ok(runner.includes(marker), marker));

for (const forbidden of [
  "'s3api','put-object'",
  "'s3api','delete-object'",
  "Invoke-External 'mc'",
  "Invoke-External 'docker' @('restart'",
  "ALTER ROLE ",
  "CREATE ROLE ",
  "--execute"
]) pass(() => assert.ok(!runner.toLowerCase().includes(forbidden.toLowerCase()), forbidden));

pass(() => assert.match(workflow, /windows-latest/));
pass(() => assert.match(workflow, /-SelfTest/));
pass(() => assert.match(workflow, /ACCEPTANCE_MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1\.cjs/));
pass(() => assert.match(doc, /never starts Producer/i));
pass(() => assert.match(doc, /does not issue or consume a permit/i));
pass(() => assert.match(doc, /private credential JSON/i));
pass(() => assert.match(doc, /ProcessStartInfo/i));
pass(() => assert.match(doc, /ListBuckets/i));
pass(() => assert.match(doc, /FullReadOnly/i));

const runnerResolverId = "WINDOWS_DEPLOYMENT_RUNNER_20261014_V1";
const runnerCheckId = "WINDOWS_DEPLOYMENT_RUNNER_20261014_ENGINEERING_ONLY";
const expectedOwnedPaths = [
  ".github/workflows/mcft-cap09-windows-deployment-runner-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-800C-CONFIG-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-V1.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1"
];
pass(() => assert.equal(qcp.checks.length, 54));
pass(() => assert.deepEqual(qcp.dependency_resolvers[runnerResolverId], {kind:"EXACT_PATH_SET", paths:expectedOwnedPaths}));
const runnerCheck = qcp.checks.find(x => x.check_id === runnerCheckId);
pass(() => assert.ok(runnerCheck));
pass(() => assert.deepEqual(runnerCheck.resolver_ids, [runnerResolverId]));
pass(() => assert.equal(runnerCheck.execution_workflow, ".github/workflows/mcft-cap09-windows-deployment-runner-v1.yml"));
pass(() => assert.equal(runnerCheck.execution_workflow_status, "ENGINEERING_ONLY_NO_LIVE_EXECUTE"));
pass(() => assert.equal(runnerCheck.carry_forward_policy, "NONE"));
pass(() => assert.equal(runnerCheck.carry_forward_evidence_id, null));
pass(() => assert.deepEqual(runnerCheck.applicable_stages, ["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"]));

console.log(JSON.stringify({
  status: "WINDOWS_DEPLOYMENT_RUNNER_STATIC_ACCEPTANCE_PASS",
  checks,
  run_id: config.run_id,
  current_800c_full_admission_expected: "HOLD_UNTIL_FROZEN_PG_ACL_AND_MINIO_RESTRICTED_IDENTITY_ARE_PINNED",
  execution_authorized: false,
  production_authorized: false
}));
