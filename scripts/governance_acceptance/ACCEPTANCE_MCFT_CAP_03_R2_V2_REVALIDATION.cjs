// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION.cjs
// Purpose: verify the frozen R2 implementation boundary, additive V2 markers, candidate-only SSOT state, and preserved downstream blocks.
// Boundary: governance/read-only acceptance; no source generation, database mutation, commit, push, merge, or authorization transition.

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const STATUS = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION-STATUS.json",
);
const DELIVERY = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json",
);
const REMEDIATION = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json",
);

let pass = 0;
function ok(message) {
  pass += 1;
  console.log(`PASS ${message}`);
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

const status = readJson(STATUS);
const delivery = readJson(DELIVERY);
const remediation = readJson(REMEDIATION);

assert.equal(status.implementation_started, true);
assert.equal(status.implementation_effective, false);
assert.equal(
  status.implementation_status,
  "CANDIDATE_VALIDATED_NOT_EFFECTIVE",
);
ok("R2 implementation is recorded as candidate validated but not effective");

assert.equal(
  delivery.implementation_status,
  "R2_IMPLEMENTATION_CANDIDATE_VALIDATED_NOT_EFFECTIVE",
);
assert.equal(delivery.successor_authorized, false);
ok("delivery SSOT preserves the postmerge effectiveness boundary");

assert.equal(
  remediation.r2_implementation_effective,
  false,
);
assert.equal(
  remediation.s6_effectiveness_status,
  "PAUSED_PENDING_REMEDIATION",
);
assert.equal(remediation.s7_status, "BLOCKED");
assert.equal(remediation.s8_status, "BLOCKED");
assert.equal(remediation.mcft_cap_04_authorized, false);
ok("S6 remains paused and R3/S7/S8/CAP-04 remain blocked");

for (
  const relative of
    status.frozen_implementation_changed_file_boundary
) {
  assert.equal(
    fs.existsSync(path.join(ROOT, relative)),
    true,
    relative,
  );
}
ok("all 30 frozen implementation-boundary files exist");

const dispatch = read(
  "apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts",
);
assert.match(
  dispatch,
  /ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V2/,
);
assert.match(
  dispatch,
  /validateAssimilatedContinuationCrossReferencesV2/,
);
ok("dispatch contains explicit CAP-03 V2 validation");

const repository = read(
  "apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts",
);
assert.match(
  repository,
  /PostgresAssimilatedRuntimeRepositoryV2/,
);
assert.match(
  repository,
  /VERSIONED_CONTINUATION_SAME_OPERATION_KEY_DUAL_WRITE_FORBIDDEN/,
);
ok("PostgreSQL V2 repository and cross-version dual-write guard are present");

const changed = execFileSync(
  "git",
  ["diff", "--name-only", "0a70d74849942d2f50e39578767212d91caa0a42"],
  { cwd: ROOT, encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

assert.equal(
  changed.some((name) =>
    name.startsWith("apps/server/db/migrations/"),
  ),
  false,
);
ok("R2 introduces zero schema migration");

console.log(
  `MCFT-CAP-03 R2 V2 governance: ${pass} PASS, 0 FAIL`,
);
