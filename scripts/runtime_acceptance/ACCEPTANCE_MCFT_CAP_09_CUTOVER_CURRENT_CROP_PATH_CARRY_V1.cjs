#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(ROOT, "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs");
const source = fs.readFileSync(RUNNER, "utf8");

assert.match(
  source,
  /return \{crop,ref:selected\.ref,resolved:selected\.resolved,digest:observedDigest,authorityAsOf:artifactAsOf,validUntil:artifactValidUntil,graduationStatus:graduation\};/,
  "CUTOVER_SELECTED_CURRENT_CROP_RESOLVED_PATH_MUST_BE_CARRIED_FORWARD",
);

assert.match(
  source,
  /GEOX_MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_PATH:selectedCurrentCrop\.resolved/,
  "CUTOVER_COMPOSE_ENV_MUST_BIND_SELECTED_CURRENT_CROP_RESOLVED_PATH",
);

assert.match(
  source,
  /return \{index,ref:ref\.ref,resolved:ref\.resolved,digest,asOf,validUntil,graduation\};/,
  "CUTOVER_REGISTRY_SELECTION_MUST_RETAIN_REPOSITORY_RESOLVED_PATH",
);

const result = {
  schema_version: "geox_mcft_cap09_cutover_current_crop_path_carry_acceptance_v1",
  status: "PASS",
  qualification: "SELECTED_EFFECTIVE_CURRENT_CROP_REPOSITORY_PATH_CARRIED_INTO_COMPOSE_ENV",
  runtime_start_count: 0,
  production_owner_activation: false,
  database_write_count: 0,
  provider_request_count: 0,
  formal_v5_arm: false,
  a0: false,
  o00: false,
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
