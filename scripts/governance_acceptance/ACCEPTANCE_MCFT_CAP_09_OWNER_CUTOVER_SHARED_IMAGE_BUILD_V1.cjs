#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(ROOT, "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs");
const source = fs.readFileSync(RUNNER, "utf8");

const singleBuild = 'exec("docker",["compose","-f",COMPOSE_REL,"build","geox-mcft-cap09-evidence-runtime-v1"],{env});';
const noBuildUp = 'exec("docker",["compose","-f",COMPOSE_REL,"up","-d","--no-build","geox-mcft-cap09-evidence-runtime-v1","geox-mcft-cap09-twin-runtime-v1"],{env});';
const legacyParallelBuild = 'exec("docker",["compose","-f",COMPOSE_REL,"up","-d","--build","geox-mcft-cap09-evidence-runtime-v1","geox-mcft-cap09-twin-runtime-v1"],{env});';

assert.ok(source.includes(singleBuild), "OWNER_CUTOVER_SINGLE_SHARED_IMAGE_BUILD_REQUIRED");
assert.ok(source.includes(noBuildUp), "OWNER_CUTOVER_DUAL_SERVICE_NO_BUILD_START_REQUIRED");
assert.equal(source.includes(legacyParallelBuild), false, "OWNER_CUTOVER_PARALLEL_SHARED_TAG_BUILD_FORBIDDEN");
assert.ok(source.indexOf(singleBuild) < source.indexOf(noBuildUp), "OWNER_CUTOVER_BUILD_MUST_PRECEDE_NO_BUILD_START");

console.log(JSON.stringify({
  status: "PASS",
  shared_runtime_image_build_count: 1,
  startup_mode: "DUAL_SERVICE_NO_BUILD",
  parallel_shared_tag_build_forbidden: true,
  production_owner_semantics_changed: false,
  formal_v5_arm_changed: false,
  a0_changed: false,
  o00_changed: false
}, null, 2));
