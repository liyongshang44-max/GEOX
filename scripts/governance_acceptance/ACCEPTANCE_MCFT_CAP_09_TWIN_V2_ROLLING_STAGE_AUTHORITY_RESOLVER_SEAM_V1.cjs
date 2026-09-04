#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "d67a2b3cce037c1eaad4d7d051d1f6a11eb09fc3";
const RESOLVER = "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.ts";
const TEST = "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.test.ts";
const COMPOSITION = "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts";
const PROCESS = "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts";
const FORBIDDEN = [
  PROCESS,
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_start_authority_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_start_authority_v2.ts",
  "docker-compose.mcft-cap09-production.yml",
  "docker-compose.mcft-cap09-phase6-github-blackout.override.yml",
  ".github/workflows/mcft-cap-09-production-runtime-owner-cutover.yml",
  ".github/workflows/mcft-cap-09-production-owner-graduation-gate.yml",
];

function read(p) {
  if (!fs.existsSync(p)) throw new Error(`ROLLING_STAGE_RESOLVER_FILE_REQUIRED:${p}`);
  return fs.readFileSync(p, "utf8");
}
function changed() {
  const out = cp.execFileSync("git", ["diff", "--name-only", `${BASE}...HEAD`], {encoding:"utf8"});
  return out.trim().split(/\r?\n/).filter(Boolean);
}

const resolver = read(RESOLVER);
const test = read(TEST);
const composition = read(COMPOSITION);
const changedPaths = changed();
const forbiddenChanged = FORBIDDEN.filter((p) => changedPaths.includes(p));

const assertions = {
  exact_base_available: cp.spawnSync("git", ["cat-file", "-e", `${BASE}^{commit}`]).status === 0,
  resolver_port_read_only_shape:
    resolver.includes("McftCap09CurrentCropAuthorityResolverPortV1") &&
    resolver.includes("resolve(") &&
    resolver.includes("logical_time"),
  static_default_factory_present:
    resolver.includes("createStaticMcftCap09CurrentCropAuthorityResolverV1"),
  resolver_has_no_direct_io:
    !/\b(?:fs|node:fs|child_process|node:child_process|fetch\s*\(|Pool\b|pg\b|process\.env)\b/.test(resolver),
  composition_resolves_per_materialization:
    composition.includes("materializeMcftCap09TwinCropContextV2") &&
    composition.includes("current_crop_authority_resolver.resolve") &&
    composition.includes("logical_time: materializeInput.logical_time"),
  production_default_remains_static_exact_bound:
    composition.includes("STATIC_EXACT_BOUND_SNAPSHOT") &&
    composition.includes("createStaticMcftCap09CurrentCropAuthorityResolverV1") &&
    composition.includes("input.current_crop_authority_resolver"),
  focused_test_present:
    test.includes("resolves current-crop authority independently for each logical hour") &&
    test.includes("fails closed when selected authority is stale"),
  production_process_unchanged: !changedPaths.includes(PROCESS),
  forbidden_production_surfaces_unchanged: forbiddenChanged.length === 0,
};

const failed = Object.entries(assertions).filter(([,v]) => v !== true).map(([k]) => k);
const proof = {
  schema_version: "geox_mcft_cap09_twin_v2_rolling_stage_authority_resolver_seam_v1",
  status: failed.length ? "FAIL" : "PASS",
  base_sha: BASE,
  head_sha: cp.execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
  changed_paths: changedPaths,
  assertions,
  failed_assertions: failed,
  authority_ceiling: {
    runtime_mutation: false,
    production_runtime_restart: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_execution: false,
    o00_started: false,
    mcft_cap09_completed: false,
  },
};
fs.mkdirSync("acceptance-output", {recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_TWIN_V2_ROLLING_STAGE_AUTHORITY_RESOLVER_SEAM_V1.json", JSON.stringify(proof,null,2)+"\n");
console.log(JSON.stringify(proof,null,2));
if (failed.length) throw new Error(`ROLLING_STAGE_RESOLVER_SEAM_NOT_PASS:${failed.join(",")}`);
