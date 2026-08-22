#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CONTRACT_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-QUALIFICATION-COMPATIBILITY-CONTRACT-V1.json");

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function exactSha(value, code) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/.test(text)) fail(code);
  return text;
}
function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...options }).trim();
}
function contract() {
  const value = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));
  need(value.schema_version === "geox_mcft_cap09_amendment19_qualification_compatibility_contract_v1", "AM19_COMPAT_CONTRACT_SCHEMA_REQUIRED");
  need(value.carry_forward_rule?.governed_semantic_digest_must_match === true, "AM19_COMPAT_DIGEST_MATCH_AUTHORITY_REQUIRED");
  need(value.carry_forward_rule?.human_override_authorized === false, "AM19_COMPAT_HUMAN_OVERRIDE_FORBIDDEN");
  return value;
}
function isGoverned(rel, c) {
  return c.governed_semantic_exact_paths.includes(rel)
    || c.governed_semantic_path_prefixes.some((prefix) => rel.startsWith(prefix));
}
function treeEntries(sha) {
  const raw = git(["ls-tree", "-r", sha]);
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const match = line.match(/^\d+\s+\w+\s+([0-9a-f]{40})\t(.+)$/);
    if (!match) fail(`AM19_COMPAT_TREE_PARSE_FAILED:${line}`);
    return { blob_sha: match[1], path: match[2] };
  });
}
function governedSnapshot(sha, c) {
  const entries = treeEntries(sha).filter((entry) => isGoverned(entry.path, c)).sort((a, b) => a.path.localeCompare(b.path));
  need(entries.length > 0, "AM19_COMPAT_GOVERNED_SET_EMPTY");
  const canonical = entries.map((entry) => `${entry.path}\0${entry.blob_sha}`).join("\n");
  return {
    entries,
    digest: `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`,
  };
}
function changedPaths(base, head) {
  const raw = git(["diff", "--name-only", `${base}..${head}`]);
  return raw ? raw.split("\n").filter(Boolean).sort() : [];
}
function assertAncestor(base, head) {
  const result = require("node:child_process").spawnSync("git", ["merge-base", "--is-ancestor", base, head]);
  if (result.status !== 0) fail("AM19_COMPAT_QUALIFICATION_NOT_ANCESTOR_OF_DEPLOYMENT");
}
function assemble(qualificationSha, deploymentSha) {
  const c = contract();
  qualificationSha = exactSha(qualificationSha, "AM19_COMPAT_QUALIFICATION_SHA_REQUIRED");
  deploymentSha = exactSha(deploymentSha, "AM19_COMPAT_DEPLOYMENT_SHA_REQUIRED");
  git(["cat-file", "-e", `${qualificationSha}^{commit}`]);
  git(["cat-file", "-e", `${deploymentSha}^{commit}`]);
  assertAncestor(qualificationSha, deploymentSha);

  const source = governedSnapshot(qualificationSha, c);
  const deployment = governedSnapshot(deploymentSha, c);
  const changed = changedPaths(qualificationSha, deploymentSha);
  const governedChanged = changed.filter((rel) => isGoverned(rel, c));
  const controlPlaneChanged = changed.filter((rel) => !isGoverned(rel, c));

  need(source.digest === deployment.digest, "AM19_COMPAT_GOVERNED_SEMANTIC_DIGEST_DRIFT");
  need(governedChanged.length === 0, `AM19_COMPAT_GOVERNED_PATH_CHANGED:${governedChanged.join(",")}`);

  return {
    schema_version: "geox_mcft_cap09_non_semantic_control_plane_compatibility_attestation_v1",
    status: "PASS",
    attestation_type: "NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_ATTESTATION_V1",
    qualification_subject_sha: qualificationSha,
    deployment_subject_sha: deploymentSha,
    qualification_subject_preserved: true,
    deployment_subject_is_current_code_identity: true,
    governed_semantic_digest: source.digest,
    source_governed_semantic_digest: source.digest,
    deployment_governed_semantic_digest: deployment.digest,
    governed_semantic_path_count: source.entries.length,
    governed_changed_paths: governedChanged,
    control_plane_changed_paths: controlPlaneChanged,
    changed_path_count: changed.length,
    qualification_reexecution_required: false,
    qualification_database_rewrite_authorized: false,
    human_override_used: false,
    formal_database_write_count: 0,
    formal_r2_write_count: 0,
    scheduler_write_count: 0,
    runtime_write_count: 0,
    formal_effect: false,
  };
}

function selftest() {
  const head = exactSha(git(["rev-parse", "HEAD"]), "AM19_COMPAT_SELFTEST_HEAD_REQUIRED");
  const pass = assemble(head, head);
  need(pass.status === "PASS" && pass.qualification_reexecution_required === false && pass.formal_effect === false, "AM19_COMPAT_SELFTEST_PASS_FAILED");
  const c = contract();
  need(isGoverned("apps/server/src/runtime/twin_runtime/x.ts", c), "AM19_COMPAT_SELFTEST_RUNTIME_MUST_BE_GOVERNED");
  need(isGoverned("scripts/runtime_acceptance/x.ts", c), "AM19_COMPAT_SELFTEST_QUALIFIER_MUST_BE_GOVERNED");
  need(!isGoverned("scripts/governance_acceptance/ASSEMBLE_X.cjs", c), "AM19_COMPAT_SELFTEST_CONTROL_PLANE_MUST_NOT_BE_GOVERNED");
  console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_non_semantic_control_plane_compatibility_attestation_selftest_v1", status: "PASS", governed_semantic_path_count: pass.governed_semantic_path_count }));
}

function main() {
  if (process.argv.includes("--selftest")) return selftest();
  const [qualificationSha, deploymentSha, outPath] = process.argv.slice(2);
  if (![qualificationSha, deploymentSha, outPath].every(Boolean)) fail("AM19_COMPAT_USAGE:qualification_sha deployment_sha output");
  const result = assemble(qualificationSha, deploymentSha);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
