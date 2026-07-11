// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs
// Purpose: enforce the exact S5 implementation boundary, including the controlled PostgreSQL versioned-predecessor validation remediation.
// Boundary: governance and source-shape acceptance only; no database mutation or Runtime execution.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");

const STATUS_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json",
);

const CONTRACT_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE.md",
);

const DELIVERY_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json",
);

const REPOSITORY_PATH = path.join(
  ROOT,
  "apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts",
);

const SLICE_ID =
  "MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1";

const REVISION_ID =
  "V2_POSTGRES_VERSIONED_PREDECESSOR_VALIDATION_REMEDIATION";

const REMEDIATION_ID =
  "S5_POSTGRES_VERSIONED_PREDECESSOR_VALIDATION_V1";

const EXPECTED_FILES = [
  "apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE.md",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_NEGATIVE.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts",
  "scripts/runtime_acceptance/mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.ts",
];

let pass = 0;

function ok(condition, message) {
  assert.equal(Boolean(condition), true, message);
  pass += 1;
  console.log(`PASS ${message}`);
}

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  );
}

function sorted(values) {
  return [...values].sort();
}

const status = readJson(STATUS_PATH);
const delivery = readJson(DELIVERY_PATH);
const contract = fs.readFileSync(CONTRACT_PATH, "utf8");
const repository = fs.readFileSync(REPOSITORY_PATH, "utf8");

ok(
  status.schema_version
    === "geox_mcft_cap_03_twenty_four_observation_aware_tick_range_status_v2",
  "status schema is remediation revision v2",
);

ok(
  status.implementation_boundary_revision === REVISION_ID,
  "status records the exact remediation boundary revision",
);

ok(
  status.authorized_remediation.remediation_id
    === REMEDIATION_ID,
  "status records the exact remediation identifier",
);

ok(
  status.authorized_remediation.authorized_file
    === EXPECTED_FILES[1],
  "status authorizes only the assimilated PostgreSQL repository",
);

assert.deepEqual(
  status.frozen_implementation_changed_file_boundary,
  EXPECTED_FILES,
);

ok(
  true,
  "status frozen implementation boundary is exact",
);

const slices = delivery.slices.filter(
  (item) => item.delivery_slice_id === SLICE_ID,
);

ok(
  slices.length === 1,
  "delivery status contains exactly one S5 slice",
);

const s5 = slices[0];

ok(
  s5.implementation_boundary_revision === REVISION_ID,
  "delivery slice records the exact remediation revision",
);

ok(
  s5.authorized_remediation.remediation_id
    === REMEDIATION_ID,
  "delivery slice records the exact remediation identifier",
);

assert.deepEqual(
  s5.exact_changed_file_boundary,
  EXPECTED_FILES,
);

ok(
  true,
  "delivery slice changed-file boundary is exact",
);

ok(
  contract.includes(EXPECTED_FILES[1]),
  "contract includes the authorized repository path",
);

ok(
  contract.includes(
    "first CAP-03 tick committed successfully",
  ),
  "contract records the observed PostgreSQL trigger",
);

ok(
  repository.includes(
    "validateVersionedPredecessorMembersV1",
  ),
  "repository contains versioned predecessor validation",
);

ok(
  repository.includes(
    "member_object_ids ? $1",
  ),
  "repository resolves predecessor membership through the A2 guard",
);

ok(
  !repository.includes(
    "expected.previous_forecast_result_ref,\n      validateContinuationMemberV1,",
  ),
  "repository no longer hard-wires the CAP-02 validator for every predecessor Forecast",
);

ok(
  repository.includes(
    "expected.previous_checkpoint_ref,\n      null,",
  ),
  "predecessor members are read without the A0-only canonical validator",
);

ok(
  !repository.includes(
    "for (const member of members) {\n      validateCanonicalObjectV1(member);",
  ),
  "CAP-03 predecessor members are not prematurely validated as A0 members",
);

const staged = execFileSync(
  "git",
  [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
  ],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((value) => value.replaceAll("\\", "/"));

assert.deepEqual(
  sorted(staged),
  sorted(EXPECTED_FILES),
);

ok(
  true,
  "actual staged implementation changed-file set is exact",
);

ok(
  status.implementation_boundary.schema_migration
    === "FORBIDDEN"
    && status.implementation_boundary.route
      === "FORBIDDEN"
    && status.implementation_boundary.scheduler
      === "FORBIDDEN"
    && status.implementation_boundary.successful_forecast
      === "FORBIDDEN",
  "migration, route, scheduler, and successful Forecast remain forbidden",
);

console.log(
  `MCFT-CAP-03 twenty-four observation-aware tick range governance: ${pass} PASS, 0 FAIL`,
);
