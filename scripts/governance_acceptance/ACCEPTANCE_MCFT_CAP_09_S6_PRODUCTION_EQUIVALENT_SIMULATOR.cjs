const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_S6_PRODUCTION_EQUIVALENT_SIMULATOR_GOVERNANCE.json");
const boundary = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SIM-S6-BOUNDARY-V1.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SIM-S6-CONFIG-V1.json"), "utf8"));
const base = process.env.MCFT_BASE_SHA || "HEAD^";
const LEASE_OWNER_REPAIR_FILES = [
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S6_PRODUCTION_EQUIVALENT_SIMULATOR.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S6_PRODUCTION_EQUIVALENT_SIMULATOR.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_PRODUCTION_EQUIVALENT_SIMULATION.ts",
  "scripts/runtime_acceptance/mcft_cap09_s6_production_equivalent_simulator_v1.ts",
];

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function sameFiles(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

try {
  const changed = git(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean).sort();
  const lifecycle = sameFiles(changed, boundary.files)
    ? "S6_PRODUCTION_EQUIVALENT_SIMULATION_QUALIFICATION"
    : sameFiles(changed, LEASE_OWNER_REPAIR_FILES)
      ? "S6_SIMULATION_LEASE_OWNER_REPAIR"
      : null;
  assert(lifecycle, "S6_SIM_EXACT_QUALIFICATION_OR_LEASE_OWNER_REPAIR_BOUNDARY_REQUIRED");
  if (lifecycle === "S6_PRODUCTION_EQUIVALENT_SIMULATION_QUALIFICATION") {
    assert.equal(changed.length, boundary.file_count, "S6_SIM_EXACT_FILE_COUNT_REQUIRED");
  } else {
    assert.equal(changed.length, 4, "S6_SIM_EXACT_LEASE_OWNER_REPAIR_FILE_COUNT_REQUIRED");
  }
  assert.equal(boundary.canonical_runtime_reimplementation, false);
  assert.equal(boundary.canonical_object_contract_delta, 0);
  assert.equal(boundary.transaction_family_delta, 0);
  assert.equal(boundary.database_migration_delta, 0);
  assert.equal(boundary.route_delta, 0);
  assert.equal(boundary.formal_authority_delta, 0);
  assert.equal(config.formal_eligible, false);
  assert.equal(config.is_simulated, true);
  assert.equal(config.isolated_database_required, true);
  assert.equal(config.formal_database_write_allowed, false);
  assert.equal(config.formal_enablement_variable_write_allowed, false);
  assert.equal(config.wall_clock_time_mapping, "ONE_TO_ONE_WALL_PACING_WITH_SEPARATE_LOGICAL_CLOCK");
  assert.equal(config.canonical_input_secret_required, false);
  assert(config.forbidden_claims.includes("MCFT_CAP_09_COMPLETE"));
  assert(config.forbidden_claims.includes("REAL_FIELD_24_HOUR_ONLINE_PROVEN"));
  const sources = changed.map((file) => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  if (lifecycle === "S6_PRODUCTION_EQUIVALENT_SIMULATION_QUALIFICATION") {
    for (const marker of [
      "PRODUCTION_EQUIVALENT_SHADOW_SIMULATION",
      "formal_eligible",
      "is_simulated",
      "MCFT_CAP09_S6_SIMULATION_ONLY",
      "MCFT_CAP09_S6_SIMULATION_ENVIRONMENT_ID",
      "MCFT_CAP09_S6_SIMULATION_NEON_PROJECT_ID",
      "MCFT_CAP09_S6_SIMULATION_NEON_BRANCH_ID",
      "GEOX_MCFT_CAP09_S6_SIMULATION_DATABASE_URL",
      "MCFT_CAP09_S6_SIMULATION_WALL_CLOCK_START_UTC",
      "ONE_TO_ONE_WALL_PACING_WITH_SEPARATE_LOGICAL_CLOCK",
    ]) assert(sources.includes(marker), `S6_SIM_REQUIRED_MARKER_MISSING:${marker}`);
  } else {
    for (const marker of [
      "simulationLeaseOwnerV1",
      "SIMULATION_LEASE_OWNER_MUST_BE_STABLE_WITHIN_OPERATION",
      "SIMULATION_LEASE_OWNER_MUST_ISOLATE_OPERATIONS",
      "lease_owner_stable_per_operation",
      "S6_SIM_EXACT_LEASE_OWNER_REPAIR_FILE_COUNT_REQUIRED",
    ]) assert(sources.includes(marker), `S6_SIM_LEASE_OWNER_REPAIR_MARKER_MISSING:${marker}`);
  }
  assert(!changed.some((file) => /migration|routes?\//i.test(file)), "S6_SIM_MIGRATION_OR_ROUTE_DELTA_FORBIDDEN");
  const result = {
    schema_version: "geox_mcft_cap09_s6_production_equivalent_simulator_governance_v1",
    status: "PASS",
    lifecycle,
    base_sha: base,
    changed_files: changed,
    exact_file_count: changed.length,
    canonical_runtime_reimplementation: false,
    formal_authority_delta: 0,
    database_write_performed: false,
    formal_window_started: false,
    formal_effectiveness: false
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: String(error.message || error) }, null, 2) + "\n");
  throw error;
}
