#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const OLD_MAIN = "2144d63477176f939a0d40d39b96ca97522af8db";
const NEW_MAIN = "2077b3b1cdb0945496d9974a581d2c4934e94561";
const NEW_TREE = "6714a9767bb01bee92a85bc6e6c4cd90a300c8d4";
const OLD_QUALIFIED_SUBJECT = "933ff8d491306a34f9886a2abb12d5b09402b12e";
const CARRIER = "8ca95143760725f1bdaee3fc13a1ee031f2aedac";
const CARRIER_TREE = "9f9197dac901de3b8dde34133d562bc85f7642fb";
const ARTIFACT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-MAIN-SUCCESSOR-REANCHOR-2077-V1.json";
const ACCEPTANCE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_MAIN_SUCCESSOR_REANCHOR_2077_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-current-main-successor-reanchor-2077-v1.yml";
const CI = ".github/workflows/ci.yml";

const PAYLOAD = [
  ".github/workflows/mcft-cap-09-current-main-reanchor-2144-v1.yml",
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-MAIN-REANCHOR-2144-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_MAIN_REANCHOR_2144_V1.cjs",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"
];

const BLINE_AUTHORITY = [
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_W1_IDENTITY_FOUNDATION_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_W2_CALLER_READ_WRITE_BOUNDARY_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_W3_DECISION_APPROVAL_AUTHORITY_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1.cjs"
];

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function assert(cond, code, detail) {
  if (!cond) {
    const suffix = detail === undefined ? "" : `:${JSON.stringify(detail)}`;
    throw new Error(`${code}${suffix}`);
  }
}
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function blob(ref, rel) {
  return git(["rev-parse", `${ref}:${rel}`]);
}

const head = git(["rev-parse", "HEAD"]);
const headLine = git(["rev-list", "--parents", "-n", "1", head]).split(/\s+/);
assert(headLine.length === 2, "SUCCESSOR_PROOF_HEAD_MUST_HAVE_EXACTLY_ONE_PARENT", headLine);
assert(headLine[1] === CARRIER, "SUCCESSOR_PROOF_HEAD_PARENT_MUST_BE_CARRIER", headLine);

const carrierLine = git(["rev-list", "--parents", "-n", "1", CARRIER]).split(/\s+/);
assert(
  same(carrierLine, [CARRIER, OLD_QUALIFIED_SUBJECT, NEW_MAIN]),
  "SUCCESSOR_CARRIER_PARENT_SET_DRIFT",
  carrierLine
);
assert(git(["rev-parse", `${CARRIER}^{tree}`]) === CARRIER_TREE, "SUCCESSOR_CARRIER_TREE_DRIFT");
assert(git(["rev-parse", `${NEW_MAIN}^{tree}`]) === NEW_TREE, "SUCCESSOR_NEW_MAIN_TREE_DRIFT");

const mainDelta = git(["diff", "--name-only", OLD_MAIN, NEW_MAIN]).split(/\r?\n/).filter(Boolean);
assert(same(mainDelta, [CI]), "SUCCESSOR_PROTECTED_MAIN_DELTA_NOT_CI_ONLY", mainDelta);

const proofDelta = git(["diff", "--name-only", CARRIER, head]).split(/\r?\n/).filter(Boolean).sort();
const expectedProofDelta = [ARTIFACT, ACCEPTANCE, WORKFLOW].sort();
assert(same(proofDelta, expectedProofDelta), "SUCCESSOR_PROOF_COMMIT_SCOPE_DRIFT", proofDelta);

for (const rel of PAYLOAD) {
  assert(blob(OLD_QUALIFIED_SUBJECT, rel) === blob(CARRIER, rel), "SUCCESSOR_CARRIER_PAYLOAD_BLOB_DRIFT", rel);
  assert(blob(OLD_QUALIFIED_SUBJECT, rel) === blob(head, rel), "SUCCESSOR_PROOF_HEAD_PAYLOAD_BLOB_DRIFT", rel);
}

for (const rel of BLINE_AUTHORITY) {
  assert(blob(OLD_MAIN, rel) === blob(NEW_MAIN, rel), "SUCCESSOR_BLINE_AUTHORITY_BLOB_DRIFT", rel);
}

const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, ARTIFACT), "utf8"));
assert(artifact.schema_version === "GEOX_MCFT_CAP_09_CURRENT_MAIN_SUCCESSOR_REANCHOR_V1", "SUCCESSOR_ARTIFACT_SCHEMA");
assert(artifact.status === "CANDIDATE_SUCCESSOR_REANCHOR", "SUCCESSOR_ARTIFACT_STATUS");
assert(artifact.old_qualified_subject === OLD_QUALIFIED_SUBJECT, "SUCCESSOR_ARTIFACT_OLD_SUBJECT");
assert(artifact.old_protected_main === OLD_MAIN, "SUCCESSOR_ARTIFACT_OLD_MAIN");
assert(artifact.new_protected_main === NEW_MAIN, "SUCCESSOR_ARTIFACT_NEW_MAIN");
assert(artifact.new_protected_main_tree === NEW_TREE, "SUCCESSOR_ARTIFACT_NEW_TREE");
assert(artifact.successor_carrier?.commit === CARRIER, "SUCCESSOR_ARTIFACT_CARRIER");
assert(artifact.successor_carrier?.tree === CARRIER_TREE, "SUCCESSOR_ARTIFACT_CARRIER_TREE");
assert(
  same(artifact.protected_main_transition?.expected_exact_changed_paths, [CI]),
  "SUCCESSOR_ARTIFACT_MAIN_DELTA"
);
assert(
  same(artifact.protected_main_transition?.mcft_semantic_overlap, []),
  "SUCCESSOR_ARTIFACT_MCFT_OVERLAP_MUST_BE_ZERO"
);
assert(
  same(artifact.qualified_payload_carry_forward?.paths, PAYLOAD),
  "SUCCESSOR_ARTIFACT_PAYLOAD_PATHS"
);
assert(artifact.qualified_payload_carry_forward?.byte_identity_required === true, "SUCCESSOR_ARTIFACT_PAYLOAD_IDENTITY_REQUIRED");
assert(artifact.qualification_semantics?.mode === "BOUNDED_SUCCESSOR_REANCHOR", "SUCCESSOR_ARTIFACT_MODE");
assert(artifact.qualification_semantics?.historical_required_qualification_rerun === false, "SUCCESSOR_HISTORICAL_RERUN_FORBIDDEN");
assert(artifact.qualification_semantics?.qcp_redesign_authorized === false, "SUCCESSOR_QCP_REDESIGN_FORBIDDEN");
assert(artifact.qualification_semantics?.historical_predecessor_allowlist_expansion_authorized === false, "SUCCESSOR_ALLOWLIST_EXPANSION_FORBIDDEN");

for (const [key, value] of Object.entries(artifact.non_effects || {})) {
  assert(value === false, "SUCCESSOR_NON_EFFECT_MUST_REMAIN_FALSE", { key, value });
}

console.log(`MCFT_CAP09_SUCCESSOR_REANCHOR_OLD_QUALIFIED_SUBJECT=${OLD_QUALIFIED_SUBJECT}`);
console.log(`MCFT_CAP09_SUCCESSOR_REANCHOR_NEW_PROTECTED_MAIN=${NEW_MAIN}`);
console.log(`MCFT_CAP09_SUCCESSOR_REANCHOR_CARRIER=${CARRIER}`);
console.log(`MCFT_CAP09_SUCCESSOR_REANCHOR_CURRENT_SUBJECT=${head}`);
console.log("MCFT_CAP09_SUCCESSOR_REANCHOR_MAIN_DELTA=.github/workflows/ci.yml");
console.log("MCFT_CAP09_SUCCESSOR_REANCHOR_MCFT_SEMANTIC_OVERLAP=0");
console.log("MCFT_CAP09_SUCCESSOR_REANCHOR_SIX_FILE_PAYLOAD_BYTE_IDENTITY=PASS");
console.log("MCFT_CAP09_SUCCESSOR_REANCHOR_BLINE_AUTHORITY_BLOB_IDENTITY=PASS");
console.log("MCFT_CAP09_SUCCESSOR_REANCHOR_HISTORICAL_REQUIRED_RERUN=false");
console.log("MCFT_CAP09_CURRENT_MAIN_SUCCESSOR_REANCHOR_2077_V1=PASS");
