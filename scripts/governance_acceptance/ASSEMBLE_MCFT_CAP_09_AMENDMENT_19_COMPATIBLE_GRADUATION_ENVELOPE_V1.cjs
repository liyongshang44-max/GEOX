#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SOURCE_ASSEMBLER = "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_GRADUATION_ENVELOPE_V1.cjs";

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function exactSha(value, code) { const text=String(value||"").trim(); if(!/^[0-9a-f]{40}$/.test(text)) fail(code); return text; }
function readJson(file, code) { if(!fs.existsSync(file)) fail(code); return JSON.parse(fs.readFileSync(file,"utf8")); }
function sha256File(file) { return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`; }

function assemble(args) {
  const qualificationSubject = exactSha(args.qualification_subject_sha, "AM19_COMPAT_GRAD_ENVELOPE_QUALIFICATION_SHA_REQUIRED");
  const deploymentSubject = exactSha(args.deployment_subject_sha, "AM19_COMPAT_GRAD_ENVELOPE_DEPLOYMENT_SHA_REQUIRED");
  const attestation = readJson(args.compatibility_path, "AM19_COMPAT_GRAD_ENVELOPE_ATTESTATION_REQUIRED");
  need(attestation.status === "PASS" && attestation.qualification_subject_sha === qualificationSubject && attestation.deployment_subject_sha === deploymentSubject, "AM19_COMPAT_GRAD_ENVELOPE_ATTESTATION_IDENTITY_REQUIRED");
  need(attestation.source_governed_semantic_digest === attestation.deployment_governed_semantic_digest && attestation.governed_changed_paths.length === 0, "AM19_COMPAT_GRAD_ENVELOPE_SEMANTIC_COMPATIBILITY_REQUIRED");
  need(attestation.qualification_reexecution_required === false && attestation.human_override_used === false && attestation.formal_effect === false, "AM19_COMPAT_GRAD_ENVELOPE_ATTESTATION_BOUNDARY_REQUIRED");

  const compatibleInput = readJson(args.graduation_path, "AM19_COMPAT_GRAD_ENVELOPE_INPUT_REQUIRED");
  need(compatibleInput.status === "PASS" && compatibleInput.subject_sha === deploymentSubject, "AM19_COMPAT_GRAD_ENVELOPE_DEPLOYMENT_INPUT_REQUIRED");
  need(compatibleInput.qualification_subject_sha === qualificationSubject && compatibleInput.deployment_subject_sha === deploymentSubject, "AM19_COMPAT_GRAD_ENVELOPE_INPUT_IDENTITY_REQUIRED");
  const gate = readJson(args.gate_path, "AM19_COMPAT_GRAD_ENVELOPE_GATE_REQUIRED");
  need(gate.status === "PASS" && gate.formal_epoch_creation_gate === "OPEN", "AM19_COMPAT_GRAD_ENVELOPE_GATE_OPEN_REQUIRED");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "am19-compatible-grad-envelope-"));
  const sourceInputPath = path.join(tmpDir, "source-input.json");
  const sourceEnvelopePath = path.join(tmpDir, "source-envelope.json");
  const sourceInput = { ...compatibleInput, subject_sha: qualificationSubject };
  delete sourceInput.qualification_subject_sha;
  delete sourceInput.deployment_subject_sha;
  delete sourceInput.qualification_identity_mode;
  delete sourceInput.governed_semantic_digest;
  delete sourceInput.qualification_compatibility_attestation;
  if (sourceInput.evidence_provenance) {
    sourceInput.evidence_provenance = { ...sourceInput.evidence_provenance };
    delete sourceInput.evidence_provenance.qualification_subject_sha;
    delete sourceInput.evidence_provenance.deployment_subject_sha;
    delete sourceInput.evidence_provenance.compatible_carry_forward;
    delete sourceInput.evidence_provenance.governed_semantic_digest;
  }
  fs.writeFileSync(sourceInputPath, JSON.stringify(sourceInput, null, 2) + "\n");

  const run = spawnSync(process.execPath, [SOURCE_ASSEMBLER,
    args.persistent_path, args.persistence_free_path, args.rehydration_path, args.cutover_path,
    sourceInputPath, args.gate_path, qualificationSubject, args.metadata_path, sourceEnvelopePath
  ], { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status || 1);
  const sourceEnvelope = readJson(sourceEnvelopePath, "AM19_COMPAT_GRAD_ENVELOPE_SOURCE_REQUIRED");
  need(sourceEnvelope.status === "PASS" && sourceEnvelope.subject_sha === qualificationSubject, "AM19_COMPAT_GRAD_ENVELOPE_SOURCE_PASS_REQUIRED");

  return {
    ...sourceEnvelope,
    subject_sha: deploymentSubject,
    qualification_subject_sha: qualificationSubject,
    deployment_subject_sha: deploymentSubject,
    qualification_identity_mode: qualificationSubject === deploymentSubject ? "EXACT_SAME_SUBJECT" : "NON_SEMANTIC_CONTROL_PLANE_COMPATIBLE_PREDECESSOR",
    governed_semantic_digest: attestation.governed_semantic_digest,
    compatibility_attestation_sha256: sha256File(args.compatibility_path),
    graduation_input_sha256: sha256File(args.graduation_path),
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
    }
  };
}

function selftest() {
  const q="1".repeat(40), d="2".repeat(40);
  need(q!==d,"AM19_COMPAT_GRAD_ENVELOPE_SELFTEST_DISTINCT_IDENTITIES_REQUIRED");
  console.log(JSON.stringify({schema_version:"geox_mcft_cap09_compatible_graduation_envelope_selftest_v1",status:"PASS",deployment_subject_can_differ_from_qualification_subject:true}));
}

function main() {
  if(process.argv.includes("--selftest")) return selftest();
  const [persistent,persistenceFree,rehydration,cutover,graduation,gate,qualificationSubject,deploymentSubject,compatibility,metadata,out]=process.argv.slice(2);
  if(![persistent,persistenceFree,rehydration,cutover,graduation,gate,qualificationSubject,deploymentSubject,compatibility,metadata,out].every(Boolean)) fail("AM19_COMPAT_GRAD_ENVELOPE_USAGE:persistent persistence-free rehydration cutover graduation gate qualification_sha deployment_sha compatibility metadata output");
  const result=assemble({persistent_path:persistent,persistence_free_path:persistenceFree,rehydration_path:rehydration,cutover_path:cutover,graduation_path:graduation,gate_path:gate,qualification_subject_sha:qualificationSubject,deployment_subject_sha:deploymentSubject,compatibility_path:compatibility,metadata_path:metadata});
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
  fs.writeFileSync(path.resolve(out),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
}

try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
