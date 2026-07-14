// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION.cjs
// Purpose: verify the bounded pre-S8 Forecast Residual contract-conformance remediation without granting S8 orchestration or C-commit effectiveness.
// Boundary: static governance and changed-file checks only; no database mutation, Runtime execution, canonical append, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASELINE = "8340a6d4ea369ae6913b67f8d3323ce029625167";
const REMEDIATION = "MCFT-CAP-05.S8.RESIDUAL-CONTRACT-CONFORMANCE-REMEDIATION-V1";
const S8 = "MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1";
const expectedFiles = [
  "apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-RESIDUAL-CONTRACT-REMEDIATION-STATUS.json",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts",
].sort();

let pass = 0;
let fail = 0;
function check(condition, label, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}
function read(path) { return fs.readFileSync(path, "utf8"); }
function json(path) { return JSON.parse(read(path)); }
function changedFiles() {
  for (const range of [`${BASELINE}...HEAD`, `${BASELINE}..HEAD`, "origin/main...HEAD", "origin/main..HEAD"]) {
    try {
      return execFileSync("git", ["diff", "--name-only", range], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {}
  }
  return null;
}

for (const file of expectedFiles) check(fs.existsSync(file), `file exists ${file}`);
const status = json(expectedFiles[2]);
const residual = read(expectedFiles[0]);
const contract = read(expectedFiles[1]);
const wrapper = read(expectedFiles[3]);
const s2Acceptance = read(expectedFiles[5]);
const s3Acceptance = read(expectedFiles[6]);
const dedicated = read(expectedFiles[7]);
const authorization = json("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json");
const delivery = json("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json");

check(status.remediation_id === REMEDIATION && status.status === "IMPLEMENTATION_CANDIDATE", "remediation candidate identity exact");
check(status.baseline_main_commit === BASELINE, "remediation baseline is S7-settlement merged main");
check(status.s8_authority?.delivery_slice_id === S8 && status.s8_authority?.authorization_status === "AUTHORIZED_NOT_STARTED", "S8 authorization is prerequisite only");
check(status.s8_authority?.runtime_implementation_started_by_remediation === false, "remediation does not start S8 orchestration");
check(status.canonical_object_type_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0 && status.runtime_orchestration_delta === 0, "remediation creates no object, transaction, migration or orchestration");
check(status.canonical_fact_delta === 0, "remediation writes no canonical fact");
check(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(expectedFiles), "status freezes exact eight-file boundary");
check(authorization.implementation_status === "S8_AUTHORIZED_NOT_STARTED" && authorization.active_delivery_slice_id === S8, "global authorization remains S8 authorized-not-started");
check(delivery.status === "S8_AUTHORIZED_NOT_STARTED" && delivery.active_delivery_slice_id === S8, "delivery status remains S8 authorized-not-started");

for (const token of [
  "GEOX_FORECAST_POINT_SEMANTIC_MEMBER_REF_V1",
  "LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_V1",
  "FORECAST_PLUS_OBSERVATION_VARIANCE_V1",
  "CAP05_TOTAL_RESIDUAL_VARIANCE_NON_POSITIVE",
  "projection_input_hash",
  "projection_trace_hash",
  "root_zone_geometry_ref",
  "root_zone_geometry_hash",
  "actual_observation_observed_at",
  "actual_observation_quality",
]) check(residual.includes(token), `residual contract freezes ${token}`);
check(residual.includes("#/points/${positiveHorizonV1(horizonHour)}"), "canonical Forecast-point member-ref format is frozen");
check(!residual.includes("ZERO_TOTAL_VARIANCE"), "nullable zero-variance normalization path removed");
check(residual.includes("predictedVarianceUnits + effectiveObservationVarianceUnits"), "effective observation variance is added exactly once");
check(!residual.includes("predictedVarianceUnits + effectiveObservationVarianceUnits + representativenessVarianceUnits"), "representativeness variance is not double-counted");
check(residual.includes("FORECAST_ERROR_NOT_ASSIMILATION_INNOVATION") && residual.includes("FORECAST_ERROR_NOT_CAUSAL_EFFECT"), "Residual nonclaims remain explicit");
check(residual.includes("CAP05_RESIDUAL_ASSIMILATION_AUTHORITY_FORBIDDEN"), "Residual rejects Assimilation and posterior authority");

check(contract.includes("effective CAP-03 observation variance") && contract.includes("must not be added a second time"), "contract document clarifies variance authority");
check(contract.includes("<forecast_run_ref>#/points/<horizon_hour>"), "contract document freezes Forecast-point ref format");
check(contract.includes("zero or negative") && contract.includes("fail closed"), "contract document freezes non-positive variance rejection");
check(contract.includes("projection_input_hash") && contract.includes("projection_trace_hash"), "contract document freezes projection hashes");

check(s2Acceptance.includes("buildCap05ForecastPointMemberRefV1") && s2Acceptance.includes("actual_observation_variance: \"0.000008000000\""), "S2 regression uses canonical point ref and effective observation variance");
check(
  s3Acceptance.includes("buildCap05ForecastPointMemberRefV1")
    && s3Acceptance.includes('const forecastIssuedAt = "2026-06-04T02:00:00.000Z"')
    && s3Acceptance.includes("forecast_issued_at: forecastIssuedAt"),
  "S3 persistence regression uses remediated residual inputs",
);
for (const needle of [
  "GEOX Forecast-point semantic member ref resolves exact horizon 1",
  "issued_at plus horizon and observation observed_at resolve to the exact 03:00 target",
  "normalization adds Forecast variance to CAP-03 effective observation variance exactly once",
  "projection input and trace hashes are deterministic and distinct",
  "Residual preserves NON_LINEAGE_CONTEXT time mapping and no equivalence or causal claim",
  "zero total Forecast-error variance fails closed",
  "legacy or non-resolving Forecast-point refs fail closed",
  "withdrawn 02:50 observation cannot match the 03:00 Forecast point",
  "representativeness variance cannot exceed effective CAP-03 observation variance",
  "forged projection trace hash fails closed",
  "assert.equal(pass, 10)",
]) check(dedicated.includes(needle), `dedicated acceptance covers ${needle}`);
check(wrapper.includes("MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION_GATE_V1") && wrapper.includes("ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts"), "standard acceptance invokes remediation gate and runtime proof");

for (const nonclaim of [
  "NO_S8_RUNTIME_ORCHESTRATION",
  "NO_FORECAST_RESIDUAL_COMMIT",
  "NO_CAUSAL_EFFECT_ATTRIBUTION",
  "NO_STATE_OR_CHECKPOINT_MUTATION",
  "NO_CAP_06_AUTHORIZATION",
]) check(status.preserved_nonclaims.includes(nonclaim), `preserved nonclaim ${nonclaim}`);
check(!expectedFiles.some((file) => file.startsWith("apps/server/db/migrations/") || file.startsWith("apps/web/") || file.includes("route")), "boundary excludes migration, web and route files");

const mode = process.argv.includes("--candidate") ? "candidate" : process.argv.includes("--postmerge") ? "postmerge" : "auto";
const changed = changedFiles();
if (mode === "candidate") {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact eight-file candidate boundary", JSON.stringify(changed));
} else if (mode === "postmerge") {
  check(changed === null || changed.length === 0, "postmerge main has no remediation delta");
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness evidence");
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, "auto mode recognizes exact remediation candidate");
} else if (changed && changed.length === 0) {
  check(true, "auto mode recognizes remediation merged main");
} else if (changed === null) {
  check(true, "auto mode accepts shallow merge-ref checkout after static invariants pass");
} else {
  check(false, "auto mode rejects unexpected remediation boundary", JSON.stringify(changed));
}

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
