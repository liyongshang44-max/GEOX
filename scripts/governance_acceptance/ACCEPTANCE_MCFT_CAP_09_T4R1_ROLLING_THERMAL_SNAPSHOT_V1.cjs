#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = process.cwd();
const BASE = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-THERMAL-BIOLOGICAL-STAGE-AUTHORITY-V1.json");
const BUILDER = path.join(ROOT, "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_T4R1_ROLLING_THERMAL_SNAPSHOT_V1.cjs");

function sha(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}
function run(now, out) {
  return JSON.parse(cp.execFileSync(process.execPath, [BUILDER, "--now", now, "--out", out], { encoding: "utf8" }));
}
function stripSnapshot(value) {
  const clone = JSON.parse(JSON.stringify(value));
  delete clone.qualification_snapshot;
  return clone;
}

const beforeBytes = fs.readFileSync(BASE);
const before = JSON.parse(beforeBytes.toString("utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-rolling-stage-"));

const sep5Out = path.join(tmp, "sep5.json");
const sep5 = run("2026-09-05T04:17:00.000Z", sep5Out);
const sep5Config = JSON.parse(fs.readFileSync(sep5Out, "utf8"));
assert.equal(sep5.status, "PASS");
assert.equal(sep5.time_zone, "America/Detroit");
assert.equal(sep5.current_local_date, "2026-09-05");
assert.equal(sep5.last_complete_temperature_local_date, "2026-09-04");
assert.equal(sep5.as_of_logical_time, "2026-09-05T04:00:00.000Z");
assert.equal(sep5.future_observations_authorized, false);
assert.equal(sep5.scheduler_write_authorized, false);
assert.equal(sep5.runtime_config_write_authorized, false);
assert.equal(sep5.production_effect, false);
assert.equal(sep5Config.qualification_snapshot.temperature_start_local_date, before.qualification_snapshot.temperature_start_local_date);
assert.equal(sep5Config.qualification_snapshot.last_complete_temperature_local_date, "2026-09-04");
assert.equal(sep5Config.qualification_snapshot.as_of_logical_time, "2026-09-05T04:00:00.000Z");
assert.equal(sep5Config.qualification_snapshot.future_observations_authorized, false);
assert.deepEqual(stripSnapshot(sep5Config), stripSnapshot(before));

const dstOut = path.join(tmp, "dst.json");
const dst = run("2026-11-02T05:17:00.000Z", dstOut);
assert.equal(dst.current_local_date, "2026-11-02");
assert.equal(dst.last_complete_temperature_local_date, "2026-11-01");
assert.equal(dst.as_of_logical_time, "2026-11-02T05:00:00.000Z");

const afterBytes = fs.readFileSync(BASE);
assert.equal(sha(afterBytes), sha(beforeBytes));
assert.equal(sep5.base_config_sha256, sha(beforeBytes));

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_t4r1_rolling_thermal_snapshot_acceptance_v1",
  status: "PASS",
  frozen_config_byte_preserved: true,
  deterministic_next_boundary: "2026-09-05T04:00:00.000Z",
  deterministic_last_complete_local_date: "2026-09-04",
  dst_boundary_case: "2026-11-02T05:00:00.000Z",
  scientific_probe_path_reused: "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T4R1_THERMAL_BIOLOGICAL_STAGE_AUTHORITY_V1.py",
  second_scientific_algorithm_created: false,
  production_effect: false,
}));
