"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const ARM = "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json";
const ISOLATED_ARM = "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json";
const BASE = "96984439d8587f13ba57b6b0948a1c81d55da9e5";
function canonical(v) { const n = Date.parse(v); assert(Number.isFinite(n) && new Date(n).toISOString() === v, "CURRENT_EXECUTION_CANONICAL_TIME_REQUIRED"); return n; }
function validateArm(a, mode, context) {
  assert.equal(a.schema_version, "geox_mcft_cap09_current_baseline_execution_arm_v1");
  assert.equal(a.armed, true, "CURRENT_EXECUTION_NOT_ARMED");
  assert.equal(a.mode, mode, "CURRENT_EXECUTION_MODE_MISMATCH");
  assert.equal(a.adopted_base_sha, BASE, "CURRENT_EXECUTION_BASE_MISMATCH");
  assert.equal(a.execution_subject_binding, "EXACT_ADOPTED_PROTECTED_MAIN");
  assert.match(context.head, /^[a-f0-9]{40}$/);
  assert.equal(context.head, context.main, "CURRENT_EXECUTION_EXACT_MAIN_REQUIRED");
  assert.equal(context.clean, true, "CURRENT_EXECUTION_CLEAN_SOURCE_REQUIRED");
  assert.equal(context.base_ancestor, true, "CURRENT_EXECUTION_ADOPTED_BASE_REQUIRED");
  assert.equal(context.frozen_runtime_identical, true, "CURRENT_EXECUTION_RUNTIME_DRIFT");
  assert.equal(context.ci, false, "CURRENT_EXECUTION_LOCAL_HOST_ONLY");
  assert.equal(context.platform, "win32", "CURRENT_EXECUTION_WINDOWS_HOST_REQUIRED");
  const now = canonical(context.now), end = canonical(a.expires_at);
  assert(end > now && end <= now + 24 * 3600000, "CURRENT_EXECUTION_AUTHORIZATION_EXPIRED_OR_TOO_LONG");
  for (const k of ["formal_v5_arm_authorized", "a0_authorized", "o00_authorized", "historical_attempt_reset_authorized"]) assert.equal(a[k], false, "CURRENT_EXECUTION_LATER_EFFECT_FORBIDDEN:" + k);
  if (mode === "ISOLATED_QUALIFICATION") {
    assert.equal(a.qualification_execution_authorized, true);
    assert.equal(a.production_recovery_authorized, false);
    assert.equal(a.new_image_build_and_two_role_cutover_authorized, false);
    assert.match(a.isolated_run_id, /^[a-f0-9]{12}$/);
    const first = canonical(a.qualification_first_base);
    assert(a.qualification_first_base.endsWith(":00:00.000Z"));
    assert(first > now + 6 * 3600000, "CURRENT_QUALIFICATION_TARGET_MUST_LEAD_BY_MORE_THAN_6H");
  } else {
    assert.equal(mode, "CANONICAL_RECOVERY_REBOOTSTRAP");
    assert.equal(a.qualification_execution_authorized, false);
    assert.equal(a.production_recovery_authorized, true);
    assert.equal(a.new_image_build_and_two_role_cutover_authorized, true);
    assert.match(a.source_failed_receipt_sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(typeof a.stage_ref, "string");
  }
  return {...a, execution_subject_sha: context.head};
}
// Split the Windows worktree read into bounded Git queries. A single
// `git status --porcelain` call may exceed 30s on this checkout and masks
// later qualification diagnostics. Include staged, unstaged and untracked
// non-ignored paths; do not relax the clean-exact-main requirement.
function sourceWorktreeClean(gitRead) {
  return gitRead(["diff", "--name-only", "--"]) === ""
    && gitRead(["diff", "--cached", "--name-only", "--"]) === ""
    && gitRead(["ls-files", "--others", "--exclude-standard"]) === "";
}
function frozenRuntimePaths(root, authority) {
  const spec = authority.dependency_resolvers?.V13_RUNTIME_SEMANTIC_CLOSURE;
  assert.equal(spec?.kind, "IMPORT_CLOSURE", "CURRENT_EXECUTION_V13_IMPORT_CLOSURE_REQUIRED");
  const closure = require("../governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs")
    .buildImportClosure(root, spec.roots);
  assert.deepEqual(closure.missing, [], "CURRENT_EXECUTION_FROZEN_IMPORT_CLOSURE_MISSING");
  const paths = [...new Set([...closure.paths, ...(spec.additional_exact_paths || [])])].sort();
  assert.equal(paths.length, 108, "CURRENT_EXECUTION_FROZEN_108_PATHS_REQUIRED");
  for (const rel of paths) {
    assert(!path.isAbsolute(rel) && !rel.split(/[\\/]/).includes(".."), "CURRENT_EXECUTION_FROZEN_PATH_ESCAPE");
    assert(fs.existsSync(path.join(root, rel)), "CURRENT_EXECUTION_FROZEN_PATH_MISSING:" + rel);
  }
  return paths;
}
function sourceContext() {
  const git = args => {
    try {
      return cp.execFileSync("git", args, {
        cwd: ROOT, encoding: "utf8", timeout: 90000,
        maxBuffer: 16 * 1024 * 1024, windowsHide: true,
      }).trim();
    } catch (error) {
      throw new Error("CURRENT_EXECUTION_GIT_READ_FAILED:" + args[0] + ":" + (error.code || error.message));
    }
  };
  const head = git(["rev-parse", "HEAD"]);
  const main = git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json")));
  // Resolving *every* QCP dependency may materialize GENERATED_GRAPH_OUTPUT
  // artifacts in the source checkout. Resolve only V13's read-only import graph.
  const paths = frozenRuntimePaths(ROOT, q);
  const frozen = git(["diff", "--name-only",
    "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a", "HEAD", "--", ...paths]);
  return {
    head, main, clean: sourceWorktreeClean(git),
    base_ancestor: cp.spawnSync("git", ["merge-base", "--is-ancestor", BASE, head],
      {cwd: ROOT, timeout: 90000, windowsHide: true}).status === 0,
    frozen_runtime_identical: frozen === "",
    ci: Boolean(process.env.CI || process.env.GITHUB_ACTIONS),
    platform: process.platform, now: new Date().toISOString(),
  };
}
function authorize(mode) {
  // Check disabled policy and local-only scope before even contacting GitHub.
  // Only a reviewed protected-main artifact may authorize the one scoped
  // local qualification run. Preserve the original disabled ARM for CI and
  // every recovery/production mode. No operator-controlled arm file path.
  const authorityPath = mode === "ISOLATED_QUALIFICATION" &&
    !process.env.CI && !process.env.GITHUB_ACTIONS ? ISOLATED_ARM : ARM;
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, authorityPath), "utf8"));
  assert.equal(a.armed, true, "CURRENT_EXECUTION_NOT_ARMED");
  assert(!process.env.CI && !process.env.GITHUB_ACTIONS && process.platform === "win32", "CURRENT_EXECUTION_WINDOWS_LOCAL_ONLY");
  return validateArm(a, mode, sourceContext());
}
function isolatedTargets(a, env) {
  assert.match(a.isolated_run_id, /^[a-f0-9]{12}$/);
  const positive = "mcft_cap09_requal_" + a.isolated_run_id + "_positive";
  const negative = "mcft_cap09_requal_" + a.isolated_run_id + "_negative";
  function localDb(value, name) {
    const u = new URL(value);
    assert(["postgres:", "postgresql:"].includes(u.protocol));
    assert(["127.0.0.1", "localhost", "[::1]"].includes(u.hostname), "CURRENT_QUALIFICATION_LOCAL_DATABASE_REQUIRED");
    assert.equal(decodeURIComponent(u.pathname.slice(1)), name, "CURRENT_QUALIFICATION_DISTINCT_DATABASE_REQUIRED");
    assert(!u.searchParams.has("host") && !u.searchParams.has("hostaddr"), "CURRENT_QUALIFICATION_ENDPOINT_OVERRIDE_FORBIDDEN");
  }
  localDb(env.DATABASE_URL, positive); localDb(env.BLOCKED_DATABASE_URL, negative);
  const s = new URL(env.MCFT_CAP09_FORMAL_RAW_ENDPOINT);
  assert(["127.0.0.1", "localhost", "[::1]"].includes(s.hostname), "CURRENT_QUALIFICATION_LOCAL_STORAGE_REQUIRED");
  assert(["http:", "https:"].includes(s.protocol));
  assert(!s.username && !s.password && !s.search && !s.hash, "CURRENT_QUALIFICATION_STORAGE_ENDPOINT_INVALID");
  const bucket = "mcft-cap09-requal-" + a.isolated_run_id;
  assert.equal(env.MCFT_CAP09_FORMAL_RAW_BUCKET, bucket, "CURRENT_QUALIFICATION_DISTINCT_BUCKET_REQUIRED");
  assert.equal(env.MCFT_QUALIFICATION_FIRST_BASE, a.qualification_first_base);
  const out = path.resolve(String(env.MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR || ""));
  assert(env.MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR && path.relative(ROOT, out).startsWith(".." + path.sep), "CURRENT_QUALIFICATION_OUTPUT_OUTSIDE_REPO_REQUIRED");
  return {positive, negative, bucket, out, allow_insecure_http_for_test: s.protocol === "http:"};
}
function qualificationTargets() { const a = authorize("ISOLATED_QUALIFICATION"); assert.equal(process.env.MCFT_SUBJECT_SHA, sourceContext().head); return isolatedTargets(a, process.env); }
function outputPath(targets, name) { assert(/^[A-Z0-9_]+\.json$/.test(name)); const out = path.join(targets.out, name); assert(!fs.existsSync(out), "CURRENT_QUALIFICATION_IMMUTABLE_OUTPUT_EXISTS"); return out; }
function measureStartupMs(launch, now) { const start=Number(launch); assert(Number.isSafeInteger(start)&&start>0&&Number.isSafeInteger(now)&&now>=start,"CURRENT_TIMING_VALID_LOCAL_LAUNCH_CLOCK_REQUIRED"); return now-start; }
module.exports = {ROOT, ARM, BASE, canonical, validateArm, sourceContext, sourceWorktreeClean, frozenRuntimePaths, authorize, isolatedTargets, qualificationTargets, outputPath, measureStartupMs};
