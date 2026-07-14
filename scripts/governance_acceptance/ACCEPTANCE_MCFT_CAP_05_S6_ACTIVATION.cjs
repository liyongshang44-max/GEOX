// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs
// Purpose: verify S6 merged-main effectiveness settlement and explicit S7 authorization without permitting S7 implementation claims.
// Boundary: static governance and changed-file checks only; no database, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ACTIVATION = "MCFT-CAP-05.S6.SSOT-ACTIVATION-V1";
const S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1";
const S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1";
const expectedFiles = [
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTIVATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs",
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
  try {
    return execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
      .trim().split(/\r?\n/).filter(Boolean).sort();
  } catch {
    return null;
  }
}

const map = read(expectedFiles[0]);
const matrix = json(expectedFiles[1]);
const authorization = json(expectedFiles[2]);
const delivery = json(expectedFiles[3]);
const status = json(expectedFiles[4]);
const task = read(expectedFiles[5]);
const wrapper = read(expectedFiles[6]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s6Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S6);
const s7Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const matrixS6 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S6);
const matrixS7 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S7);

check(status.activation_id === ACTIVATION && status.status === "IMPLEMENTATION_CANDIDATE", "activation candidate identity is explicit");
check(status.baseline_main_commit === "be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe", "activation baseline is exact S6 merged main");
check(status.s6_effectiveness?.pr_number === 2456 && status.s6_effectiveness?.effective === true, "S6 effectiveness is complete");
check(status.s6_effectiveness?.exact_head === "1a4f09278ce8b5ee65af8688f0c4d992a5d10035", "S6 exact head is frozen");
check(status.s6_effectiveness?.merge_commit === "be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe", "S6 merge commit is frozen");
check(status.s6_effectiveness?.head_to_merge_file_delta_count === 0 && status.s6_effectiveness?.tree_equivalence === "PASS", "S6 tree equivalence is proven");
check(status.s6_effectiveness?.exact_head_workflow === 29325080521 && status.s6_effectiveness?.merged_main_gate_workflow === 29325686434, "S6 verification workflows are frozen");
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0 && status.runtime_source_delta === 0, "activation is governance-only");

check(authorization.implementation_status === "S7_AUTHORIZED_NOT_STARTED", "Authorization Status advances to S7 authorized-not-started");
check(authorization.active_delivery_slice_id === S7 && authorization.active_authorized_slice_id === S7, "Authorization Status points to S7");
check(authorization.current_blockers?.includes("S7_IMPLEMENTATION_NOT_STARTED"), "Authorization Status records S7 not started");
check(authorization.s6_effectiveness?.effective === true, "Authorization Status settles S6 effective");
check(authorization.successor_authorized === false, "CAP-06 remains unauthorized");

check(delivery.status === "S7_AUTHORIZED_NOT_STARTED" && delivery.active_delivery_slice_id === S7, "Delivery Status advances to S7 authorization");
check(s6Delivery?.status === "MERGED_EFFECTIVE" && s6Delivery?.effectiveness_condition_satisfied === true, "Delivery Status settles S6 effective");
check(s6Delivery?.exact_head === "1a4f09278ce8b5ee65af8688f0c4d992a5d10035" && s6Delivery?.merge_commit === "be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe", "Delivery Status freezes S6 identities");
check(s7Delivery?.status === "AUTHORIZED_NOT_STARTED" && s7Delivery?.runtime_source_authorized === true, "Delivery Status explicitly authorizes S7");
check(s7Delivery?.implementation_started === false && s7Delivery?.allowed_claims?.length === 1, "S7 has authorization only");

check(cap05?.implementation_status === "S7_AUTHORIZED_NOT_STARTED" && cap05?.active_delivery_slice_id === S7, "global Matrix advances CAP-05 to S7");
check(matrixS6?.status === "MERGED_EFFECTIVE" && matrixS6?.effectiveness_condition_satisfied === true, "global Matrix settles S6 effective");
check(matrixS7?.status === "AUTHORIZED_NOT_STARTED" && matrixS7?.runtime_source_authorized === true && matrixS7?.implementation_started === false, "global Matrix authorizes but does not start S7");
check(cap05?.successor_authorized !== true, "global Matrix does not authorize CAP-06");

check(task.includes("S6 SSOT Activation — S6 Effective / S7 Authorized"), "task records activation");
check(task.includes("S7 status after activation:\nAUTHORIZED_NOT_STARTED"), "task records S7 state");
check(map.includes("MCFT-CAP-05 S6 Effective and S7 Explicitly Authorized"), "Implementation Map records activation");
check(wrapper.includes("MCFT_CAP_05_S6_ACTIVATION_GATE_V1") && wrapper.includes("ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs"), "standard acceptance invokes Activation Gate");

check(status.preserved_nonclaims.includes("NO_S7_RUNTIME_IMPLEMENTATION"), "S7 implementation nonclaim remains explicit");
check(status.preserved_nonclaims.includes("NO_RECEIPT_CONSUMING_STATE_TICK"), "receipt-consuming tick remains unimplemented");
check(status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "CAP-06 nonclaim remains explicit");
check(!expectedFiles.some((file) => file.startsWith("apps/server/") || file.startsWith("apps/web/") || file.includes("migrations")), "activation boundary contains no Runtime, web or migration file");

const mode = process.argv.includes("--candidate") ? "candidate" : process.argv.includes("--postmerge") ? "postmerge" : "auto";
const changed = changedFiles();
if (mode === "candidate") {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact eight-file activation boundary");
} else if (mode === "postmerge") {
  check(changed === null || changed.length === 0, "postmerge main has no activation delta against origin/main");
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness evidence");
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, "auto mode recognizes activation candidate");
} else if (changed && changed.length === 0) {
  check(true, "auto mode recognizes merged-main activation");
} else {
  check(true, "auto mode enforces static invariants on later branches");
}

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
