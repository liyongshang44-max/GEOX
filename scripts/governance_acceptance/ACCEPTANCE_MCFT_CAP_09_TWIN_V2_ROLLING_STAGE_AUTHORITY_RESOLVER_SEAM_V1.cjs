#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "d67a2b3cce037c1eaad4d7d051d1f6a11eb09fc3";
const RESOLVER = "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.ts";
const TEST = "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.test.ts";
const COMPOSITION = "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts";
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const PROCESS = "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts";
const EFFECTIVE_GRADUATION_STATUSES = new Set([
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
]);
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
function readJson(p) {
  return JSON.parse(read(p));
}
function changed() {
  const out = cp.execFileSync("git", ["diff", "--name-only", `${BASE}...HEAD`], {encoding:"utf8"});
  return out.trim().split(/\r?\n/).filter(Boolean);
}

const resolver = read(RESOLVER);
const test = read(TEST);
const composition = read(COMPOSITION);
const registry = readJson(REGISTRY);
const registryEntries = Array.isArray(registry.entries) ? registry.entries : [];
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
  resolver_registry_source_port_present:
    resolver.includes("McftCap09EffectiveCurrentCropAuthoritySourcePortV1") &&
    resolver.includes("createRegistryBackedMcftCap09CurrentCropAuthorityResolverV1") &&
    resolver.includes("read_registry()") &&
    resolver.includes("read_authority("),
  resolver_has_no_direct_io:
    !/\b(?:fs|node:fs|child_process|node:child_process|fetch\s*\(|Pool\b|pg\b|process\.env)\b/.test(resolver),
  registry_contract_present:
    registry.schema_version === "geox_mcft_cap09_effective_current_crop_authority_registry_v1" &&
    registry.registry_id === "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1" &&
    registry.status === "ACTIVE" &&
    registry.selection_policy === "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW" &&
    registry.candidate_artifacts_admissible === false &&
    registryEntries.length > 0,
  registry_entries_effective_only:
    registryEntries.every((entry) =>
      typeof entry.authority_ref === "string" && entry.authority_ref.length > 0 &&
      /^sha256:[0-9a-f]{64}$/.test(String(entry.authority_sha256 || "")) &&
      EFFECTIVE_GRADUATION_STATUSES.has(String(entry.graduation_status || "")) &&
      Number.isFinite(Date.parse(String(entry.authority_as_of || ""))) &&
      Number.isFinite(Date.parse(String(entry.authority_valid_until || ""))) &&
      Date.parse(String(entry.authority_valid_until || "")) >= Date.parse(String(entry.authority_as_of || ""))
    ),
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
    test.includes("fails closed when selected authority is stale") &&
    test.includes("registry-backed resolver selects only graduated effective authorities by logical time") &&
    test.includes("registry-backed resolver rejects candidate-only authority") &&
    test.includes("registry-backed resolver rejects authority bytes that drift"),
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
  governed_registry_path: REGISTRY,
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
