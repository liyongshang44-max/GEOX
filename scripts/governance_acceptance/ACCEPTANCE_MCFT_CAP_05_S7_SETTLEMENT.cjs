// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs
// Purpose: verify S7 merged-main effectiveness settlement and explicit S8 Forecast Residual authorization without permitting S8 implementation claims.
// Boundary: static governance and changed-file checks only; no database, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ACTIVATION = "MCFT-CAP-05.S7.SSOT-SETTLEMENT-V1";
const S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1";
const S8 = "MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1";
const S7_EXACT = "bda7dc07293fbfb187dd8c5cc0109ac5c577952d";
const S7_MERGE = "a4ea0f0c6af45a5d8daaad94be6b95bc3efefd78";
const expectedFiles = [
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S7-SETTLEMENT-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs",
].sort();

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}
function read(path) { return fs.readFileSync(path, "utf8"); }
function json(path) { return JSON.parse(read(path)); }
function changedFiles() {
  for (const range of ["origin/main...HEAD", "origin/main..HEAD"]) {
    try {
      return execFileSync("git", ["diff", "--name-only", range], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {}
  }
  return null;
}

const map = read(expectedFiles[0]);
const matrix = json(expectedFiles[1]);
const authorization = json(expectedFiles[2]);
const delivery = json(expectedFiles[3]);
const status = json(expectedFiles[4]);
const task = read(expectedFiles[5]);
const wrapper = read(expectedFiles[6]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const matrixS7 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S7);
const matrixS8 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S8);
const deliveryS7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const deliveryS8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);

check(status.activation_id === ACTIVATION && status.status === "IMPLEMENTATION_CANDIDATE", "settlement candidate identity is explicit");
check(status.baseline_main_commit === S7_MERGE, "settlement baseline is exact S7 merged main");
check(status.s7_effectiveness?.exact_head === S7_EXACT && status.s7_effectiveness?.merge_commit === S7_MERGE, "S7 exact identities are frozen");
check(status.s7_effectiveness?.candidate_ci_workflow === 29339485877 && status.s7_effectiveness?.merged_main_gate_workflow === 29340134021, "S7 verification workflows are frozen");
check(status.s7_effectiveness?.head_to_merge_file_delta_count === 0 && status.s7_effectiveness?.tree_equivalence === "PASS" && status.s7_effectiveness?.effective === true, "S7 tree equivalence and effectiveness are proven");
check(status.s7_effectiveness?.validated_path === "15_PASS_0_FAIL" && status.s7_effectiveness?.not_yet_validated_path === "7_PASS_0_FAIL" && status.s7_effectiveness?.postgresql_source_path === "8_PASS_0_FAIL", "S7 validated, NOT_YET_VALIDATED and PostgreSQL proofs are frozen");
check(status.s8_authorization?.delivery_slice_id === S8 && status.s8_authorization?.status_after_activation === "AUTHORIZED_NOT_STARTED", "S8 authorization target is explicit");
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0 && status.runtime_source_delta === 0, "settlement is governance-only");

check(authorization.implementation_status === "S8_AUTHORIZED_NOT_STARTED", "Authorization Status advances to S8 authorized-not-started");
check(authorization.active_delivery_slice_id === S8 && authorization.active_authorized_slice_id === S8, "Authorization Status points to S8");
check(authorization.current_blockers?.includes("S8_IMPLEMENTATION_NOT_STARTED"), "Authorization Status records S8 not started");
check(authorization.s7_effectiveness?.effective === true, "Authorization Status settles S7 effective");
check(authorization.successor_authorized === false, "CAP-06 remains unauthorized");

check(delivery.status === "S8_AUTHORIZED_NOT_STARTED" && delivery.active_delivery_slice_id === S8, "Delivery Status advances to S8 authorization");
check(deliveryS7?.status === "MERGED_EFFECTIVE" && deliveryS7?.effectiveness_condition_satisfied === true, "Delivery Status settles S7 effective");
check(deliveryS7?.exact_head === S7_EXACT && deliveryS7?.merge_commit === S7_MERGE, "Delivery Status freezes S7 identities");
check(deliveryS8?.status === "AUTHORIZED_NOT_STARTED" && deliveryS8?.runtime_source_authorized === true, "Delivery Status explicitly authorizes S8");
check(deliveryS8?.implementation_started === false && deliveryS8?.allowed_claims?.length === 1, "S8 has authorization only");

check(cap05?.implementation_status === "S8_AUTHORIZED_NOT_STARTED" && cap05?.active_delivery_slice_id === S8, "global Matrix advances CAP-05 to S8");
check(matrixS7?.status === "MERGED_EFFECTIVE" && matrixS7?.effectiveness_condition_satisfied === true, "global Matrix settles S7 effective");
check(matrixS8?.status === "AUTHORIZED_NOT_STARTED" && matrixS8?.runtime_source_authorized === true && matrixS8?.implementation_started === false, "global Matrix authorizes but does not start S8");
check(cap05?.successor_authorized !== true, "global Matrix does not authorize CAP-06");

check(task.includes("S7 SSOT Settlement — S7 Effective / S8 Authorized"), "task records settlement");
check(task.includes("implementation_status:\nS8_AUTHORIZED_NOT_STARTED"), "task current status advances to S8");
check(task.includes(`active_delivery_slice_id:\n${S8}`), "task current slice points to S8");
check(map.includes("MCFT-CAP-05 S7 Effective and S8 Explicitly Authorized"), "Implementation Map records settlement");
check(wrapper.includes("MCFT_CAP_05_S7_SSOT_SETTLEMENT_GATE_V1") && wrapper.includes("ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs"), "standard acceptance invokes Settlement Gate");

check(status.preserved_nonclaims.includes("NO_S8_RUNTIME_IMPLEMENTATION"), "S8 implementation nonclaim remains explicit");
check(status.preserved_nonclaims.includes("NO_FORECAST_RESIDUAL_COMMIT"), "Forecast Residual remains unimplemented");
check(status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "CAP-06 nonclaim remains explicit");
check(!expectedFiles.some((file) => file.startsWith("apps/server/") || file.startsWith("apps/web/") || file.includes("migrations")), "settlement boundary contains no Runtime, web or migration file");

const mode = process.argv.includes("--candidate") ? "candidate" : process.argv.includes("--postmerge") ? "postmerge" : "auto";
const changed = changedFiles();
if (mode === "candidate") {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact eight-file settlement boundary");
} else if (mode === "postmerge") {
  check(changed === null || changed.length === 0, "postmerge main has no settlement delta against origin/main");
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness evidence after merge");
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, "auto mode recognizes settlement candidate");
} else if (changed && changed.length === 0) {
  check(true, "auto mode recognizes merged-main settlement");
} else {
  check(false, "auto mode rejects an unexpected settlement boundary");
}

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
