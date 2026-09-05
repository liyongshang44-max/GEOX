#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const HISTORICAL_BASE = "5050f1c08d2528048c56d56add4cbb068b956925";
const HISTORICAL_SUBJECT = "b7c6ebf48cae05e877b2f61639849e25b2ebb38f";
const HISTORICAL_CHECKER_BLOB = "19fb9fba262687d34232dc7aa55f1f0748cf221f";
const REPAIR_PREDECESSOR = "f94f7890ea351573363c331ee0d144034f821f9c";

const CHECKER = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TWIN_V2_ROLLING_STAGE_AUTHORITY_RESOLVER_SEAM_V1.cjs";
const RESOLVER = "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.ts";
const TEST = "apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.test.ts";
const COMPOSITION = "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts";
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const PROCESS = "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts";
const DIST = "apps/server/scripts/write_dist_entries.cjs";

const EFFECTIVE_GRADUATION_STATUSES = new Set([
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
]);

const FORBIDDEN_PRODUCTION_SURFACES = [
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_start_authority_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_start_authority_v2.ts",
  DIST,
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

function git(args, options = {}) {
  return cp.execFileSync("git", args, {
    encoding: "utf8",
    ...options,
  }).trim();
}

function lines(text) {
  return String(text || "").split(/\r?\n/).filter(Boolean);
}

function exactCommitAvailable(sha) {
  return cp.spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

function changedPathsForCommit(commitSha) {
  return lines(git(["diff-tree", "--no-commit-id", "--name-only", "-r", commitSha]));
}

function historicalReplay() {
  const result = {
    historical_base_sha: HISTORICAL_BASE,
    historical_subject_sha: HISTORICAL_SUBJECT,
    historical_checker_blob_expected: HISTORICAL_CHECKER_BLOB,
    historical_checker_blob_actual: null,
    historical_gate_replay_status: "FAIL",
    historical_gate_replay_failed_assertions: [],
    historical_gate_replay_error: null,
  };

  if (!exactCommitAvailable(HISTORICAL_BASE) || !exactCommitAvailable(HISTORICAL_SUBJECT)) {
    result.historical_gate_replay_error = "HISTORICAL_EXACT_COMMITS_UNAVAILABLE";
    return result;
  }

  try {
    result.historical_checker_blob_actual = git(["rev-parse", `${HISTORICAL_SUBJECT}:${CHECKER}`]);
    if (result.historical_checker_blob_actual !== HISTORICAL_CHECKER_BLOB) {
      result.historical_gate_replay_error = "HISTORICAL_CHECKER_BLOB_DRIFT";
      return result;
    }
  } catch (error) {
    result.historical_gate_replay_error = `HISTORICAL_CHECKER_LOOKUP_FAILED:${error.message}`;
    return result;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-resolver-seam-history-"));
  const worktree = path.join(tempRoot, "historical-subject");
  let worktreeAdded = false;

  try {
    cp.execFileSync("git", ["worktree", "add", "--detach", worktree, HISTORICAL_SUBJECT], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    worktreeAdded = true;

    const stdout = cp.execFileSync(process.execPath, [CHECKER], {
      cwd: worktree,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const proof = JSON.parse(stdout);

    result.historical_gate_replay_failed_assertions = Array.isArray(proof.failed_assertions)
      ? proof.failed_assertions
      : [];
    const originalAllowedChangedStillPasses =
      proof.status === "PASS" &&
      proof.base_sha === HISTORICAL_BASE &&
      proof.head_sha === HISTORICAL_SUBJECT &&
      proof.assertions?.bounded_adoption_surface_only === true &&
      proof.assertions?.forbidden_production_surfaces_unchanged === true;

    result.historical_gate_replay_status = originalAllowedChangedStillPasses ? "PASS" : "FAIL";
    if (!originalAllowedChangedStillPasses && !result.historical_gate_replay_error) {
      result.historical_gate_replay_error = "HISTORICAL_EXACT_REPLAY_DID_NOT_PASS";
    }
  } catch (error) {
    result.historical_gate_replay_error = `HISTORICAL_EXACT_REPLAY_FAILED:${error.message}`;
  } finally {
    if (worktreeAdded) {
      cp.spawnSync("git", ["worktree", "remove", "--force", worktree], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  return result;
}

function evaluateCurrentSeam(input) {
  const {
    resolver,
    test,
    composition,
    processV2,
    dist,
    registry,
    forbiddenProductionSurfaceDrift,
  } = input;
  const registryEntries = Array.isArray(registry.entries) ? registry.entries : [];

  return {
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
        typeof entry.authority_ref === "string" &&
        entry.authority_ref.length > 0 &&
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

    process_selector_is_explicit_injection_only:
      processV2.includes("selectMcftCap09TwinRuntimeCurrentCropAuthorityResolverV2") &&
      processV2.includes("explicit_resolver?: McftCap09CurrentCropAuthorityResolverPortV1") &&
      processV2.includes("input.explicit_resolver") &&
      processV2.includes("createStaticMcftCap09CurrentCropAuthorityResolverV1") &&
      processV2.includes("input?.current_crop_authority_resolver") &&
      processV2.includes("current_crop_authority_resolver: currentCropAuthorityResolver"),

    production_default_remains_static_exact_bound:
      composition.includes("STATIC_EXACT_BOUND_SNAPSHOT") &&
      processV2.includes("STATIC_EXACT_BOUND_SNAPSHOT_DEFAULT_WITH_EXPLICIT_DEPENDENCY_INJECTION_ONLY") &&
      processV2.includes("production_rolling_authority_env_switch: false") &&
      processV2.includes("production_registry_path_discovery: false"),

    production_process_has_no_registry_or_rolling_env_switch:
      !/GEOX_[A-Z0-9_]*(?:REGISTRY|ROLLING)[A-Z0-9_]*/.test(processV2) &&
      !processV2.includes("EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1.json"),

    production_dist_entry_remains_zero_argument:
      dist.includes("runMcftCap09TwinRuntimeProcessV2().catch") &&
      !dist.includes("runMcftCap09TwinRuntimeProcessV2({"),

    focused_adoption_tests_present:
      test.includes("Process V2 resolver selector preserves the mounted static snapshot by default") &&
      test.includes("Process V2 resolver selector carries an explicitly injected registry-backed resolver only") &&
      test.includes("registry-backed resolver selects only graduated effective authorities by logical time") &&
      test.includes("registry-backed resolver rejects candidate-only authority") &&
      test.includes("registry-backed resolver rejects authority bytes that drift"),

    forbidden_production_surfaces_unchanged:
      Array.isArray(forbiddenProductionSurfaceDrift) &&
      forbiddenProductionSurfaceDrift.length === 0,
  };
}

function allTrue(object) {
  return Object.values(object).every((value) => value === true);
}

const currentHeadSha = git(["rev-parse", "HEAD"]);
const resolver = read(RESOLVER);
const test = read(TEST);
const composition = read(COMPOSITION);
const processV2 = read(PROCESS);
const dist = read(DIST);
const registry = readJson(REGISTRY);

const forbiddenProductionSurfaceDrift = FORBIDDEN_PRODUCTION_SURFACES.filter((p) =>
  cp.spawnSync("git", ["diff", "--quiet", HISTORICAL_SUBJECT, "--", p]).status !== 0
);

const currentSeamAssertions = evaluateCurrentSeam({
  resolver,
  test,
  composition,
  processV2,
  dist,
  registry,
  forbiddenProductionSurfaceDrift,
});

const lastCheckerCommit = git(["log", "-1", "--format=%H", "--", CHECKER]);
const lastCheckerCommitParents = lines(git(["rev-list", "--parents", "-n", "1", lastCheckerCommit]))[0]
  .split(/\s+/)
  .slice(1);
const currentSubjectPredecessorSha = lastCheckerCommitParents[0] || null;
const currentRepairChangedPaths = changedPathsForCommit(lastCheckerCommit);

const currentRepairAssertions = {
  current_repair_commit_is_ancestor_of_head:
    cp.spawnSync("git", ["merge-base", "--is-ancestor", lastCheckerCommit, currentHeadSha]).status === 0,

  current_repair_predecessor_exact:
    currentSubjectPredecessorSha === REPAIR_PREDECESSOR,

  current_repair_delta_bounded:
    currentRepairChangedPaths.length === 1 &&
    currentRepairChangedPaths[0] === CHECKER,
};

const historical = historicalReplay();

const negativeFailClosedCases = {
  rolling_default_fails_closed: (() => {
    const mutated = evaluateCurrentSeam({
      resolver,
      test,
      composition,
      processV2: processV2.replace(
        "STATIC_EXACT_BOUND_SNAPSHOT_DEFAULT_WITH_EXPLICIT_DEPENDENCY_INJECTION_ONLY",
        "ROLLING_REGISTRY_DEFAULT"
      ),
      dist,
      registry,
      forbiddenProductionSurfaceDrift,
    });
    return mutated.production_default_remains_static_exact_bound === false;
  })(),

  rolling_or_registry_env_switch_fails_closed: (() => {
    const mutated = evaluateCurrentSeam({
      resolver,
      test,
      composition,
      processV2: `${processV2}\nconst GEOX_MCFT_CAP09_ROLLING_REGISTRY = process.env.GEOX_MCFT_CAP09_ROLLING_REGISTRY;\n`,
      dist,
      registry,
      forbiddenProductionSurfaceDrift,
    });
    return mutated.production_process_has_no_registry_or_rolling_env_switch === false;
  })(),

  production_registry_autodiscovery_fails_closed: (() => {
    const mutated = evaluateCurrentSeam({
      resolver,
      test,
      composition,
      processV2: `${processV2}\nconst discovered = "EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1.json";\n`,
      dist,
      registry,
      forbiddenProductionSurfaceDrift,
    });
    return mutated.production_process_has_no_registry_or_rolling_env_switch === false;
  })(),

  production_entrypoint_argument_rewrite_fails_closed: (() => {
    const mutatedDist = dist.replace(
      "runMcftCap09TwinRuntimeProcessV2().catch",
      "runMcftCap09TwinRuntimeProcessV2({ current_crop_authority_resolver: injected }).catch"
    );
    const mutated = evaluateCurrentSeam({
      resolver,
      test,
      composition,
      processV2,
      dist: mutatedDist,
      registry,
      forbiddenProductionSurfaceDrift,
    });
    return mutated.production_dist_entry_remains_zero_argument === false;
  })(),

  forbidden_production_surface_mutation_fails_closed: (() => {
    const mutated = evaluateCurrentSeam({
      resolver,
      test,
      composition,
      processV2,
      dist,
      registry,
      forbiddenProductionSurfaceDrift: [FORBIDDEN_PRODUCTION_SURFACES[0]],
    });
    return mutated.forbidden_production_surfaces_unchanged === false;
  })(),
};

const assertions = {
  historical_adoption_boundary_replay:
    historical.historical_gate_replay_status === "PASS",

  current_successor_semantic_preservation:
    allTrue(currentSeamAssertions),

  current_repair_delta_bounded:
    allTrue(currentRepairAssertions),

  negative_fail_closed_selftest:
    allTrue(negativeFailClosedCases),
};

const failedAssertions = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

const proof = {
  schema_version: "geox_mcft_cap09_twin_v2_rolling_stage_authority_resolver_seam_v2",
  status: failedAssertions.length ? "FAIL" : "PASS",

  historical_base_sha: HISTORICAL_BASE,
  historical_subject_sha: HISTORICAL_SUBJECT,
  historical_gate_replay_status: historical.historical_gate_replay_status,
  historical_checker_blob_expected: historical.historical_checker_blob_expected,
  historical_checker_blob_actual: historical.historical_checker_blob_actual,
  historical_gate_replay_failed_assertions: historical.historical_gate_replay_failed_assertions,
  historical_gate_replay_error: historical.historical_gate_replay_error,

  current_head_sha: currentHeadSha,
  current_subject_predecessor_sha: currentSubjectPredecessorSha,
  current_repair_commit_sha: lastCheckerCommit,
  current_repair_changed_paths: currentRepairChangedPaths,

  governed_registry_path: REGISTRY,
  qualification_model: "HISTORICAL_EXACT_REPLAY_PLUS_CURRENT_SUCCESSOR_SEMANTIC_PRESERVATION",
  historical_adoption_allowlist_extended: false,

  current_successor_semantic_assertions: currentSeamAssertions,
  current_repair_assertions: currentRepairAssertions,
  negative_fail_closed_selftest: negativeFailClosedCases,
  assertions,
  failed_assertions: failedAssertions,

  authority_ceiling: {
    runtime_mutation: false,
    production_runtime_start: false,
    production_runtime_restart: false,
    production_owner_activation: false,
    production_rolling_authority_activation: false,
    formal_v5_arm: false,
    a0_execution: false,
    o00_started: false,
    mcft_cap09_completed: false,
  },
};

fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync(
  "acceptance-output/MCFT_CAP_09_TWIN_V2_ROLLING_STAGE_AUTHORITY_RESOLVER_SEAM_V1.json",
  JSON.stringify(proof, null, 2) + "\n"
);
console.log(JSON.stringify(proof, null, 2));

if (failedAssertions.length) {
  throw new Error(`ROLLING_STAGE_RESOLVER_SEAM_NOT_PASS:${failedAssertions.join(",")}`);
}
