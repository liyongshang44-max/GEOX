// scripts/governance_acceptance/.MATERIALIZE_MCFT_CAP_06_S0_V2_CANDIDATE.cjs
// Purpose: synchronize the three current-state frontiers to the already-proven MCFT-CAP-06 S0 v2 candidate, then remove this temporary materializer and its workflow before the candidate commit is pushed.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const BASELINE = "ca819ba51bdf3017dbefa96015f76bd3b66a647c";
const PROOF_COMMIT = "d3c5341707b35982df84ce63e8aef310ce304b31";
const PROOF_RUN = 29469336992;
const S0 = "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1";
const S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1";
const DELIVERY = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json";
const MAP = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md";
const MATRIX = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json";
const SELF = "scripts/governance_acceptance/.MATERIALIZE_MCFT_CAP_06_S0_V2_CANDIDATE.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-06-s0-v2-materialize.yml";

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(absolute(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  fs.writeFileSync(absolute(relativePath), `${value.replace(/\r\n/g, "\n").trimEnd()}\n`, "utf8");
}

function assertExactlyOne(values, predicate, code) {
  const matches = values.filter(predicate);
  if (matches.length !== 1) throw new Error(`${code}:${matches.length}`);
  return matches[0];
}

const delivery = readJson(DELIVERY);
if (delivery.capability_line_id !== "MCFT-CAP-06") throw new Error("CAP06_DELIVERY_STATUS_ID_MISMATCH");
if (delivery.implementation_status !== "P0_MERGED_EFFECTIVE_S0_AUTHORIZED_NOT_STARTED") {
  throw new Error(`CAP06_DELIVERY_FRONTIER_UNEXPECTED:${delivery.implementation_status}`);
}
delivery.status = "READY_FOR_MERGE_CANDIDATE";
delivery.implementation_status = "S0_V2_CANDIDATE";
delivery.authorization_effective = false;
delivery.runtime_source_authorized = false;
delivery.active_delivery_slice_id = null;
delivery.candidate_slices = [{
  delivery_slice_id: S0,
  status: "READY_FOR_MERGE_CANDIDATE",
  implementation_generation: "S0_V2",
  pull_request: 2509,
  proof_commit: PROOF_COMMIT,
  proof_workflow_run: PROOF_RUN,
  case_graph_validation_status: "PASS",
  dataset_qualification_status: "INSUFFICIENT_MATCHED_PAIRS",
  eligible_residual_count: 1,
  authorization_effective: false,
  runtime_source_authorized: false,
}];
delivery.authorized_not_started_slices = [];
delivery.next_repository_action = "MERGE_S0_V2_CANDIDATE_AND_PROVE_EXACT_MERGED_MAIN_EFFECTIVENESS";
delivery.next_repository_action_after_p0_effectiveness = delivery.next_repository_action;
delivery.next_authorized_slice_ids = [];
delivery.next_authorized_slice_id_after_s0_effectiveness = S1;
delivery.predecessor_lock_ref = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json";
delivery.dataset_qualification_ref = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json";
delivery.s0_authorization_status_ref = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-AUTHORIZATION-STATUS.json";
delivery.effectiveness_condition = "S0_V2_PR_MERGED_TO_MAIN_AND_EXACT_MERGED_MAIN_S0_AUTHORIZATION_GATE_PASS";
delivery.effectiveness_condition_satisfied = false;
writeJson(DELIVERY, delivery);

const matrix = readJson(MATRIX);
matrix.baseline = {
  branch: "main",
  commit: BASELINE,
  meaning: "MCFT-CAP-06 P-1 and P0 merged-main effective; S0 v2 exact predecessor and dataset qualification candidate proven; CAP-06 Runtime remains unauthorized",
};
const cap06 = assertExactlyOne(
  matrix.capability_lines,
  (entry) => entry.capability_line_id === "MCFT-CAP-06",
  "CAP06_MATRIX_ENTRY_CARDINALITY",
);
cap06.status = "READY_FOR_MERGE_CANDIDATE";
cap06.implementation_status = "S0_V2_CANDIDATE";
cap06.authorization_effective = false;
cap06.runtime_source_authorized = false;
cap06.active_delivery_slice_id = null;
cap06.next_repository_action = "MERGE_S0_V2_CANDIDATE_AND_PROVE_EXACT_MERGED_MAIN_EFFECTIVENESS";
cap06.next_repository_action_after_p0_effectiveness = cap06.next_repository_action;
cap06.s0 = {
  delivery_slice_id: S0,
  status: "READY_FOR_MERGE_CANDIDATE",
  implementation_generation: "S0_V2",
  authorization_scope: "PREDECESSOR_QUALIFICATION_ONLY",
  authorization_effective: false,
  runtime_source_authorized: false,
  pull_request: 2509,
  superseded_pull_request: 2500,
  proof_commit: PROOF_COMMIT,
  proof_workflow_run: PROOF_RUN,
  predecessor_lock_ref: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json",
  dataset_qualification_ref: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json",
  authorization_status_ref: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-AUTHORIZATION-STATUS.json",
  case_graph_validation_status: "PASS",
  dataset_qualification_status: "INSUFFICIENT_MATCHED_PAIRS",
  eligible_residual_count: 1,
  next_authorized_slice_ids: [],
  next_authorized_slice_id_after_effectiveness: S1,
  effectiveness_condition_satisfied: false,
};
cap06.preserved_nonclaims = [
  "NO_RUNTIME_SOURCE_AUTHORIZATION_BEFORE_S0_EFFECTIVENESS",
  "NO_MIGRATION",
  "NO_CANONICAL_WRITE",
  "NO_RESIDUAL_CREATED_BY_S0",
  "NO_CALIBRATION_CANDIDATE",
  "NO_SHADOW_EVALUATION",
  "NO_MODEL_ACTIVATION",
  "NO_ACTIVE_CONFIG_SWITCH",
  "NO_ACTIVE_CONFIG_INDEX",
  "NO_PUBLIC_ROUTE",
  "NO_WEB",
  "NO_SCHEDULER",
  "NO_MCFT_CAP_07_AUTHORIZATION",
  "NO_CAPABILITY_COMPLETION",
];
matrix.latest_governance_update = S0;
writeJson(MATRIX, matrix);

const map = fs.readFileSync(absolute(MAP), "utf8").replace(/\r\n/g, "\n");
if (!map.includes("<!-- MCFT-CAP-06-P0-CURRENT-STATE-END -->")) throw new Error("CAP06_MAP_BASE_MARKER_REQUIRED");
if (map.includes("<!-- MCFT-CAP-06-S0-V2-CURRENT-STATE-BEGIN -->")) throw new Error("CAP06_MAP_S0_V2_SECTION_ALREADY_EXISTS");
const section = `

<!-- MCFT-CAP-06-S0-V2-CURRENT-STATE-BEGIN -->
## MCFT-CAP-06 S0 v2 candidate frontier

\`\`\`text
baseline main: ${BASELINE}
S0 implementation generation: S0_V2
S0 status: READY_FOR_MERGE_CANDIDATE
S0 PR: #2509
formal proof commit: ${PROOF_COMMIT}
formal proof workflow: ${PROOF_RUN}
CAP-05 checkpoint reconstruction: 72 -> 80 PASS
canonical State fact count: 33
case graph validation: PASS
eligible canonical Residuals: 1
dataset qualification: INSUFFICIENT_MATCHED_PAIRS
Forecast-time and Residual-time Config identities: DISTINCT_AND_EXACTLY_CLOSED
homogeneity cardinalities: 1/1/1/1/1/1
public facts mutated by qualification: false
authorization effective: false
runtime source authorized: false
migration authorized: false
canonical write authorized: false
active delivery slice: null
next authorized slices before effectiveness: []
next eligible after exact merged-main S0 Gate: ${S1}
Calibration Candidate implemented: false
Shadow Evaluation implemented: false
Model Activation implemented: false
capability complete: false
successor MCFT-CAP-07 authorized: false
\`\`\`

The S0 v2 candidate establishes an exact read-only predecessor and dataset qualification boundary. It does not create Residual history, execute parameter search, canonicalize a Calibration Candidate or Evaluation, mutate State/checkpoint, or authorize Runtime, migration, public routes, Web, scheduler, active Config or CAP-07.
<!-- MCFT-CAP-06-S0-V2-CURRENT-STATE-END -->`;
writeText(MAP, `${map.trimEnd()}${section}`);

fs.rmSync(absolute(SELF), { force: true });
fs.rmSync(absolute(WORKFLOW), { force: true });
process.stdout.write("MATERIALIZED MCFT-CAP-06 S0 v2 candidate frontier and removed temporary infrastructure\n");
