#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const AUTH_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CONTROLLED-CAPTURE-SOURCE-BINDING-V1.json");
const AUTH = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));

const HISTORICAL_NAMESPACE = "namespace: namespaceFor(target)";
const RUN_SCOPED_NAMESPACE = "namespace: `${namespaceFor(target)}-${required(\"MCFT_QMIG_RUN_ID\")}-${required(\"MCFT_QMIG_RUN_ATTEMPT\")}`";
const HISTORICAL_RETRIEVAL_VALIDATION = 'canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");';
const CURRENT_RETRIEVAL_CLOCK = 'const retrievedAt = canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");';
const HISTORICAL_REUSE_BLOCK = `if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
    }`;
const CAUSAL_REUSE_BLOCK = `if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      if (Date.parse(retainedAt) >= Date.parse(retrievedAt)) {
        return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
      }
      await this.deleteRetainedRawEvidence(ref);
    }`;

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", ...options }).trimEnd();
}

function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}

function replaceAtLeastOnce(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count < 1) throw new Error(`${code}:0`);
  return source.split(oldValue).join(newValue);
}

function assertAuthorityObjects() {
  const a = AUTH.provider_source_authority;
  const workflowBlob = git(["rev-parse", `${a.historical_capture_commit}:${a.historical_capture_workflow_path}`]);
  if (workflowBlob !== a.historical_capture_workflow_blob) throw new Error(`QMIG_CAPTURE_WORKFLOW_BLOB_DRIFT:${workflowBlob}`);
  const shimBlob = git(["rev-parse", `${a.historical_capture_commit}:${a.historical_compatibility_shim_path}`]);
  if (shimBlob !== a.historical_compatibility_shim_blob) throw new Error(`QMIG_CAPTURE_SHIM_BLOB_DRIFT:${shimBlob}`);
  const runnerBlob = git(["rev-parse", `${a.exact_provider_runner_source_commit}:${a.provider_runner_path}`]);
  if (runnerBlob !== a.exact_provider_runner_blob) throw new Error(`QMIG_CAPTURE_PROVIDER_RUNNER_BLOB_DRIFT:${runnerBlob}`);
  execFileSync("git", ["merge-base", "--is-ancestor", a.exact_provider_runner_source_commit, a.historical_capture_commit], { cwd: ROOT, stdio: "ignore" });
  const shim = git(["show", `${a.historical_capture_commit}:${a.historical_compatibility_shim_path}`]);
  if (!shim.includes(`const RUNNER_BLOB = "${a.exact_provider_runner_blob}";`)) throw new Error("QMIG_CAPTURE_SHIM_RUNNER_BINDING_DRIFT");
  const currentPathBlob = git(["rev-parse", `${AUTH.producer_identity.protected_main_sha}:${a.provider_runner_path}`]);
  if (!/^[0-9a-f]{40}$/.test(currentPathBlob)) throw new Error("QMIG_CAPTURE_CURRENT_MAIN_PATH_BLOB_INVALID");
  return { workflowBlob, shimBlob, runnerBlob, currentPathBlob };
}

function buildControlledSource() {
  const a = AUTH.provider_source_authority;
  let source = execFileSync("git", ["show", `${a.exact_provider_runner_source_commit}:${a.provider_runner_path}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  source = exactReplace(source, HISTORICAL_NAMESPACE, RUN_SCOPED_NAMESPACE, "QMIG_CAPTURE_RETENTION_NAMESPACE_REPLACEMENT_CARDINALITY");
  source = exactReplace(source, HISTORICAL_RETRIEVAL_VALIDATION, CURRENT_RETRIEVAL_CLOCK, "QMIG_CAPTURE_RETRIEVAL_CLOCK_REPLACEMENT_CARDINALITY");
  source = exactReplace(source, HISTORICAL_REUSE_BLOCK, CAUSAL_REUSE_BLOCK, "QMIG_CAPTURE_CAUSAL_REUSE_REPLACEMENT_CARDINALITY");

  source = replaceAtLeastOnce(source, "process.env.GITHUB_WORKFLOW", "process.env.MCFT_QMIG_CAPTURE_POLICY_IDENTITY", "QMIG_CAPTURE_WORKFLOW_IDENTITY_REPLACEMENT_REQUIRED");
  source = replaceAtLeastOnce(source, 'required("GITHUB_RUN_ID")', 'required("MCFT_QMIG_RUN_ID")', "QMIG_CAPTURE_RUN_ID_REPLACEMENT_REQUIRED");
  source = replaceAtLeastOnce(source, "process.env.GITHUB_EVENT_NAME", "process.env.MCFT_QMIG_EVENT_NAME", "QMIG_CAPTURE_EVENT_IDENTITY_REPLACEMENT_REQUIRED");
  source = replaceAtLeastOnce(source, "process.env.GITHUB_REF", "process.env.MCFT_QMIG_REF", "QMIG_CAPTURE_REF_IDENTITY_REPLACEMENT_REQUIRED");
  source = replaceAtLeastOnce(source, "process.env.GITHUB_SHA", "process.env.MCFT_QMIG_SUBJECT_SHA", "QMIG_CAPTURE_SHA_IDENTITY_REPLACEMENT_REQUIRED");

  if (source.includes("GITHUB_")) throw new Error("QMIG_CAPTURE_GITHUB_IDENTITY_SURVIVED");
  if (!source.includes('Date.parse(retainedAt) >= Date.parse(retrievedAt)')) throw new Error("QMIG_CAPTURE_CAUSAL_REUSE_GUARD_REQUIRED");
  if (!source.includes("await this.deleteRetainedRawEvidence(ref);")) throw new Error("QMIG_CAPTURE_STALE_RETENTION_DELETE_REQUIRED");
  if (!source.includes('const KBS_RAW_HOURLY_URL = "https://lter.kbs.msu.edu/datatables/13.csv";')) throw new Error("QMIG_CAPTURE_KBS_PROVIDER_SEMANTICS_DRIFT");
  if (!source.includes('const GFS_ROOT = "https://nomads.ncep.noaa.gov/";')) throw new Error("QMIG_CAPTURE_GFS_PROVIDER_SEMANTICS_DRIFT");
  if (!source.includes('const FORMAL_RAW_BUCKET = "geox-mcft-cap09-formal-raw-v1";')) throw new Error("QMIG_CAPTURE_RETENTION_BUCKET_DRIFT");
  if (!source.includes('formal_database_write_count: 0')) throw new Error("QMIG_CAPTURE_ZERO_FORMAL_EFFECT_DRIFT");
  return source;
}

function parseOut(argv) {
  const index = argv.indexOf("--out");
  if (index < 0 || !argv[index + 1]) throw new Error("QMIG_CAPTURE_OUTPUT_PATH_REQUIRED");
  return path.resolve(argv[index + 1]);
}

function summary(source, objects, outputPath) {
  return {
    schema_version: "geox_mcft_cap09_controlled_capture_source_materialization_v1",
    status: "PASS",
    producer_subject_sha: AUTH.producer_identity.protected_main_sha,
    historical_capture_commit: AUTH.provider_source_authority.historical_capture_commit,
    provider_runner_source_commit: AUTH.provider_source_authority.exact_provider_runner_source_commit,
    provider_runner_blob: objects.runnerBlob,
    historical_workflow_blob: objects.workflowBlob,
    historical_compatibility_shim_blob: objects.shimBlob,
    current_main_same_path_blob_observed_not_authority: objects.currentPathBlob,
    github_execution_identity_removed: true,
    provider_semantics_changed: false,
    output_path: outputPath || null,
    generated_sha256: `sha256:${crypto.createHash("sha256").update(source).digest("hex")}`,
  };
}

const mode = process.argv[2] || "selftest";
const objects = assertAuthorityObjects();
const source = buildControlledSource();

if (mode === "selftest") {
  process.stdout.write(JSON.stringify(summary(source, objects, null), null, 2) + "\n");
  process.exit(0);
}
if (mode !== "materialize") throw new Error("QMIG_CAPTURE_SOURCE_MODE_INVALID");
const outputPath = parseOut(process.argv.slice(3));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");
process.stdout.write(JSON.stringify(summary(source, objects, outputPath), null, 2) + "\n");
