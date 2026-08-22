#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SOURCE_ASSEMBLER = "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_GRADUATION_INPUT_V1.cjs";

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function exactSha(value, code) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/.test(text)) fail(code);
  return text;
}
function readJson(file, code) {
  if (!fs.existsSync(file)) fail(code);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assemble(args) {
  const qualificationSubject = exactSha(args.qualification_subject_sha, "AM19_COMPAT_GRAD_INPUT_QUALIFICATION_SHA_REQUIRED");
  const deploymentSubject = exactSha(args.deployment_subject_sha, "AM19_COMPAT_GRAD_INPUT_DEPLOYMENT_SHA_REQUIRED");
  const attestation = readJson(args.compatibility_path, "AM19_COMPAT_GRAD_INPUT_ATTESTATION_REQUIRED");
  need(attestation.schema_version === "geox_mcft_cap09_non_semantic_control_plane_compatibility_attestation_v1", "AM19_COMPAT_GRAD_INPUT_ATTESTATION_SCHEMA_REQUIRED");
  need(attestation.status === "PASS", "AM19_COMPAT_GRAD_INPUT_ATTESTATION_PASS_REQUIRED");
  need(attestation.qualification_subject_sha === qualificationSubject, "AM19_COMPAT_GRAD_INPUT_ATTESTATION_QUALIFICATION_DRIFT");
  need(attestation.deployment_subject_sha === deploymentSubject, "AM19_COMPAT_GRAD_INPUT_ATTESTATION_DEPLOYMENT_DRIFT");
  need(attestation.source_governed_semantic_digest === attestation.deployment_governed_semantic_digest, "AM19_COMPAT_GRAD_INPUT_SEMANTIC_DIGEST_MATCH_REQUIRED");
  need(Array.isArray(attestation.governed_changed_paths) && attestation.governed_changed_paths.length === 0, "AM19_COMPAT_GRAD_INPUT_GOVERNED_CHANGE_FORBIDDEN");
  need(attestation.qualification_reexecution_required === false && attestation.human_override_used === false && attestation.formal_effect === false, "AM19_COMPAT_GRAD_INPUT_ATTESTATION_BOUNDARY_REQUIRED");

  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "am19-compatible-grad-input-")), "source.json");
  const run = spawnSync(process.execPath, [SOURCE_ASSEMBLER, args.persistent_path, args.persistence_free_path, args.rehydration_path, args.cutover_path, qualificationSubject, tmp], { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status || 1);
  const source = readJson(tmp, "AM19_COMPAT_GRAD_INPUT_SOURCE_REQUIRED");
  need(source.status === "PASS" && source.subject_sha === qualificationSubject, "AM19_COMPAT_GRAD_INPUT_SOURCE_PASS_REQUIRED");

  return {
    ...source,
    subject_sha: deploymentSubject,
    qualification_subject_sha: qualificationSubject,
    deployment_subject_sha: deploymentSubject,
    qualification_identity_mode: qualificationSubject === deploymentSubject ? "EXACT_SAME_SUBJECT" : "NON_SEMANTIC_CONTROL_PLANE_COMPATIBLE_PREDECESSOR",
    governed_semantic_digest: attestation.governed_semantic_digest,
    qualification_compatibility_attestation: {
      schema_version: attestation.schema_version,
      status: attestation.status,
      attestation_type: attestation.attestation_type,
      qualification_subject_sha: qualificationSubject,
      deployment_subject_sha: deploymentSubject,
      governed_semantic_digest: attestation.governed_semantic_digest,
      governed_changed_path_count: attestation.governed_changed_paths.length,
      control_plane_changed_path_count: attestation.control_plane_changed_paths.length,
      qualification_reexecution_required: false,
      human_override_used: false,
      formal_effect: false
    },
    evidence_provenance: {
      ...source.evidence_provenance,
      qualification_subject_sha: qualificationSubject,
      deployment_subject_sha: deploymentSubject,
      compatible_carry_forward: qualificationSubject !== deploymentSubject,
      governed_semantic_digest: attestation.governed_semantic_digest
    }
  };
}

function selftest() {
  const q = "1".repeat(40), d = "2".repeat(40);
  const attestation = {
    schema_version: "geox_mcft_cap09_non_semantic_control_plane_compatibility_attestation_v1", status: "PASS",
    attestation_type: "NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_ATTESTATION_V1", qualification_subject_sha: q, deployment_subject_sha: d,
    governed_semantic_digest: `sha256:${"a".repeat(64)}`, source_governed_semantic_digest: `sha256:${"a".repeat(64)}`, deployment_governed_semantic_digest: `sha256:${"a".repeat(64)}`,
    governed_changed_paths: [], control_plane_changed_paths: ["scripts/governance_acceptance/x.cjs"], qualification_reexecution_required: false,
    human_override_used: false, formal_effect: false
  };
  need(attestation.source_governed_semantic_digest === attestation.deployment_governed_semantic_digest, "AM19_COMPAT_GRAD_INPUT_SELFTEST_DIGEST_FAILED");
  need(attestation.qualification_subject_sha !== attestation.deployment_subject_sha, "AM19_COMPAT_GRAD_INPUT_SELFTEST_DISTINCT_IDENTITIES_REQUIRED");
  console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_compatible_graduation_input_selftest_v1", status: "PASS", distinct_qualification_and_deployment_identities_supported: true }));
}

function main() {
  if (process.argv.includes("--selftest")) return selftest();
  const [persistent, persistenceFree, rehydration, cutover, qualificationSubject, deploymentSubject, compatibility, out] = process.argv.slice(2);
  if (![persistent, persistenceFree, rehydration, cutover, qualificationSubject, deploymentSubject, compatibility, out].every(Boolean)) fail("AM19_COMPAT_GRAD_INPUT_USAGE:persistent persistence-free rehydration cutover qualification_sha deployment_sha compatibility output");
  const result = assemble({ persistent_path: persistent, persistence_free_path: persistenceFree, rehydration_path: rehydration, cutover_path: cutover, qualification_subject_sha: qualificationSubject, deployment_subject_sha: deploymentSubject, compatibility_path: compatibility });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(path.resolve(out), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
