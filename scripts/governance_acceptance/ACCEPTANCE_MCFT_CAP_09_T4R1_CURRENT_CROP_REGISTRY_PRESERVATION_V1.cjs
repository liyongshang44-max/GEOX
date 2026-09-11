#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const CERT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-current-crop-refresh-v1.yml";
const CHECKER = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_CURRENT_CROP_REGISTRY_PRESERVATION_V1.cjs";
const CONTROL_PLANE = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const AUTHORITY_PREFIX = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY";
const REQUEST_PREFIX = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-REFRESH-REQUEST-";

function fail(code, detail = "") {
  throw new Error(code + (detail ? `:${detail}` : ""));
}

function parseArgs(argv) {
  const out = { base: null, head: null, invocation: "qcp", output: null, selftest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") out.base = argv[++i] || null;
    else if (arg === "--head") out.head = argv[++i] || null;
    else if (arg === "--invocation") out.invocation = argv[++i] || null;
    else if (arg === "--out") out.output = argv[++i] || null;
    else if (arg === "--selftest") out.selftest = true;
    else fail("CURRENT_CROP_PRESERVATION_UNKNOWN_ARG", arg);
  }
  return out;
}

function git(args, options = {}) {
  return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8", ...options }).trim();
}

function sha256Bytes(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(rel) {
  return sha256Bytes(fs.readFileSync(path.join(ROOT, rel)));
}

function stable(value) {
  return JSON.stringify(value);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function readJsonAt(ref, rel) {
  return JSON.parse(git(["show", `${ref}:${rel}`]));
}

function eventRefs() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return { base: null, head: null };
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    return {
      base: event?.pull_request?.base?.sha || null,
      head: event?.pull_request?.head?.sha || null,
    };
  } catch {
    return { base: null, head: null };
  }
}

function assertSha(label, value) {
  if (!/^[0-9a-f]{40}$/.test(String(value || ""))) fail(label, String(value || ""));
}

function assertFalseMap(obj, prefix) {
  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== false) fail(`${prefix}${key}`, String(value));
  }
}

function validateRegistryEnvelope(registry, label) {
  if (registry?.schema_version !== "geox_mcft_cap09_effective_current_crop_authority_registry_v1") fail(`REFRESH_${label}_REGISTRY_SCHEMA`);
  if (registry?.status !== "ACTIVE") fail(`REFRESH_${label}_REGISTRY_NOT_ACTIVE`);
  if (registry?.selection_policy !== "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW") fail(`REFRESH_${label}_REGISTRY_SELECTION_POLICY_DRIFT`);
  if (registry?.candidate_artifacts_admissible !== false) fail(`REFRESH_${label}_CANDIDATE_ADMISSIBILITY_DRIFT`);
  assertFalseMap(registry?.non_effects, `REFRESH_${label}_REGISTRY_NON_EFFECT_DRIFT:`);
  if (!Array.isArray(registry?.entries) || registry.entries.length < 2) fail(`REFRESH_${label}_REGISTRY_ENTRIES_INVALID`);
}

function classifyTransition(baseRegistry, headRegistry) {
  const baseEntries = baseRegistry.entries;
  const headEntries = headRegistry.entries;
  if (headEntries.length === baseEntries.length) {
    if (stable(headEntries) !== stable(baseEntries)) fail("REFRESH_REGISTRY_MUTATED_WITHOUT_APPEND");
    if (stable(headRegistry) !== stable(baseRegistry)) fail("REFRESH_REGISTRY_ENVELOPE_MUTATED_WITHOUT_APPEND");
    return "PRESERVATION_ONLY";
  }
  if (headEntries.length === baseEntries.length + 1) {
    if (stable(headEntries.slice(0, -1)) !== stable(baseEntries)) fail("REFRESH_REGISTRY_HISTORY_REWRITE");
    return "SINGLE_AUTHORITY_APPEND";
  }
  fail("REFRESH_REGISTRY_CARDINALITY_DELTA", `${baseEntries.length}->${headEntries.length}`);
}

function validateEntryShapeAndOrder(entries) {
  let previousAsOf = null;
  for (const entry of entries) {
    if (typeof entry?.authority_ref !== "string" || !entry.authority_ref.startsWith(AUTHORITY_PREFIX)) {
      fail("REFRESH_AUTHORITY_REF_INVALID", String(entry?.authority_ref));
    }
    if (entry.authority_ref.includes("CANDIDATE")) fail("REFRESH_CANDIDATE_ARTIFACT_FORBIDDEN", entry.authority_ref);
    if (!/^sha256:[0-9a-f]{64}$/.test(String(entry?.authority_sha256 || ""))) fail("REFRESH_AUTHORITY_DIGEST_INVALID", String(entry?.authority_sha256));
    const asOf = Date.parse(entry.authority_as_of);
    const until = Date.parse(entry.authority_valid_until);
    if (!Number.isFinite(asOf) || !Number.isFinite(until) || asOf >= until) fail("REFRESH_AUTHORITY_WINDOW_INVALID", entry.authority_ref);
    if (previousAsOf !== null && asOf <= previousAsOf) fail("REFRESH_AUTHORITY_AS_OF_NOT_MONOTONIC", entry.authority_ref);
    previousAsOf = asOf;
  }
}

function currentCropSurface(rel) {
  return rel === REGISTRY || rel === CERT || rel.startsWith(AUTHORITY_PREFIX) || rel.startsWith(REQUEST_PREFIX);
}

function expectFail(label, fn, expectedPrefix) {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith(expectedPrefix)) fail("SELFTEST_WRONG_FAILURE", `${label}:${message}`);
    return;
  }
  fail("SELFTEST_EXPECTED_FAILURE_MISSING", label);
}

function runSelftest() {
  const e1 = { authority_ref: `${AUTHORITY_PREFIX}-A.json`, authority_sha256: `sha256:${"1".repeat(64)}`, authority_as_of: "2026-09-01T00:00:00.000Z", authority_valid_until: "2026-09-02T00:00:00.000Z", graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH" };
  const e2 = { authority_ref: `${AUTHORITY_PREFIX}-B.json`, authority_sha256: `sha256:${"2".repeat(64)}`, authority_as_of: "2026-09-02T00:00:00.000Z", authority_valid_until: "2026-09-03T00:00:00.000Z", graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH" };
  const e3 = { authority_ref: `${AUTHORITY_PREFIX}-C.json`, authority_sha256: `sha256:${"3".repeat(64)}`, authority_as_of: "2026-09-03T00:00:00.000Z", authority_valid_until: "2026-09-04T00:00:00.000Z", graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH" };
  const envelope = (entries) => ({ schema_version: "geox_mcft_cap09_effective_current_crop_authority_registry_v1", status: "ACTIVE", selection_policy: "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW", candidate_artifacts_admissible: false, entries, non_effects: { formal_v5_authorized: false, a0_authorized: false, o00_o23_authorized: false } });
  const base = envelope([e1, e2]);
  const preserved = JSON.parse(JSON.stringify(base));
  if (classifyTransition(base, preserved) !== "PRESERVATION_ONLY") fail("SELFTEST_PRESERVATION_MODE");
  const appended = envelope([e1, e2, e3]);
  if (classifyTransition(base, appended) !== "SINGLE_AUTHORITY_APPEND") fail("SELFTEST_APPEND_MODE");
  validateEntryShapeAndOrder(appended.entries);
  expectFail("same-cardinality rewrite", () => classifyTransition(base, envelope([e1, e3])), "REFRESH_REGISTRY_MUTATED_WITHOUT_APPEND");
  expectFail("deletion", () => classifyTransition(base, envelope([e1])), "REFRESH_REGISTRY_CARDINALITY_DELTA");
  expectFail("double append", () => classifyTransition(base, envelope([e1, e2, e3, { ...e3, authority_ref: `${AUTHORITY_PREFIX}-D.json`, authority_as_of: "2026-09-04T00:00:00.000Z", authority_valid_until: "2026-09-05T00:00:00.000Z" }])), "REFRESH_REGISTRY_CARDINALITY_DELTA");
  expectFail("candidate admissible", () => validateRegistryEnvelope({ ...base, candidate_artifacts_admissible: true }, "SELFTEST"), "REFRESH_SELFTEST_CANDIDATE_ADMISSIBILITY_DRIFT");
  expectFail("candidate ref", () => validateEntryShapeAndOrder([{ ...e1, authority_ref: `${AUTHORITY_PREFIX}-CANDIDATE.json` }, e2]), "REFRESH_CANDIDATE_ARTIFACT_FORBIDDEN");
  expectFail("non-monotonic", () => validateEntryShapeAndOrder([e2, e1]), "REFRESH_AUTHORITY_AS_OF_NOT_MONOTONIC");
  expectFail("authority ceiling", () => assertFalseMap({ formal_v5_authorized: true }, "REFRESH_SELFTEST_AUTHORITY_CEILING_DRIFT:"), "REFRESH_SELFTEST_AUTHORITY_CEILING_DRIFT:formal_v5_authorized");
  return { status: "PASS", acceptance_id: "MCFT_CAP09_T4R1_CURRENT_CROP_REGISTRY_PRESERVATION_SELFTEST_V1", positive_cases: 3, negative_cases: 7 };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) {
    process.stdout.write(`${JSON.stringify(runSelftest(), null, 2)}\n`);
    return;
  }
  if (!["workflow", "qcp"].includes(args.invocation)) fail("CURRENT_CROP_PRESERVATION_INVOCATION_INVALID", String(args.invocation));

  const refs = eventRefs();
  const head = args.head || process.env.MCFT_CAP09_CURRENT_CROP_HEAD_SHA || process.env.PR_HEAD_SHA || refs.head || git(["rev-parse", "HEAD"]);
  const base = args.base || process.env.MCFT_CAP09_CURRENT_CROP_BASE_SHA || process.env.PR_BASE_SHA || refs.base;
  assertSha("CURRENT_CROP_PRESERVATION_BASE_SHA_REQUIRED", base);
  assertSha("CURRENT_CROP_PRESERVATION_HEAD_SHA_INVALID", head);

  const actualHead = git(["rev-parse", "HEAD"]);
  if (actualHead !== head) fail("REFRESH_HEAD_DRIFT", `${actualHead}!=${head}`);
  git(["cat-file", "-e", `${base}^{commit}`]);
  try {
    cp.execFileSync("git", ["merge-base", "--is-ancestor", base, head], { cwd: ROOT, stdio: "ignore" });
  } catch {
    fail("REFRESH_BASE_NOT_ANCESTOR", `${base}->${head}`);
  }

  const registry = readJson(REGISTRY);
  const baseRegistry = readJsonAt(base, REGISTRY);
  validateRegistryEnvelope(baseRegistry, "BASE");
  validateRegistryEnvelope(registry, "HEAD");
  validateEntryShapeAndOrder(registry.entries);

  const mode = classifyTransition(baseRegistry, registry);
  const changedFiles = git(["diff", "--name-only", `${base}...${head}`]).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
  const relevantChanged = changedFiles.filter(currentCropSurface).sort();

  const latest = registry.entries[registry.entries.length - 1];
  const previous = registry.entries[registry.entries.length - 2];
  if (!latest || !previous) fail("REFRESH_LATEST_PREVIOUS_REQUIRED");

  if (mode === "PRESERVATION_ONLY") {
    if (relevantChanged.length !== 0) fail("REFRESH_PRESERVATION_ONLY_CURRENT_CROP_SURFACE_DRIFT", relevantChanged.join(","));
  } else {
    const expectedRelevant = [REGISTRY, latest.authority_ref].sort();
    if (stable(relevantChanged) !== stable(expectedRelevant)) fail("REFRESH_MATERIALIZATION_SCOPE_DRIFT", relevantChanged.join(","));
  }

  for (const entry of registry.entries) {
    const full = path.join(ROOT, entry.authority_ref);
    if (!fs.existsSync(full)) fail("REFRESH_AUTHORITY_MISSING", entry.authority_ref);
    const digest = sha256File(entry.authority_ref);
    if (digest !== entry.authority_sha256) fail("REFRESH_REGISTRY_AUTHORITY_DIGEST_MISMATCH", `${entry.authority_ref}:${entry.authority_sha256}!=${digest}`);
  }

  const current = readJson(latest.authority_ref);
  if (current.schema_version !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1") fail("REFRESH_CURRENT_SCHEMA");
  if (current.status !== "PASS") fail("REFRESH_CURRENT_NOT_PASS");
  if (current.qualification_outcome !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED") fail("REFRESH_CURRENT_QUALIFICATION_OUTCOME");
  if (current.architecture_effective !== true || current.runtime_consumption_authorized !== true) fail("REFRESH_CURRENT_RUNTIME_CONSUMPTION_NOT_EFFECTIVE");
  if (current.biological_stage?.observed_biological_stage_claimed !== false) fail("REFRESH_OBSERVED_STAGE_OVERCLAIM");
  if (current.crop_model_parameter?.production_effective !== false) fail("REFRESH_CROP_PARAMETER_PRODUCTION_EFFECT_DRIFT");
  if (current.lifecycle?.domain_state !== "ACTIVE" || current.lifecycle?.authority_status !== "RESOLVED" || current.lifecycle?.authority_validity !== "VALID" || current.lifecycle?.authority_mode !== "GOVERNED_PERSISTENT_STATE" || current.lifecycle?.active_consumable_candidate !== true) fail("REFRESH_LIFECYCLE_NOT_CONSUMABLE");
  if (current.graduation?.status !== "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH") fail("REFRESH_GRADUATION_STATUS");
  if (current.graduation?.amendment_id !== "DT02-AMENDMENT-03") fail("REFRESH_DT02_AMENDMENT_REQUIRED");
  if (current.refresh?.target_artifact_ref !== latest.authority_ref) fail("REFRESH_TARGET_ARTIFACT_REF_MISMATCH");
  if (current.refresh?.qualification_time !== current.graduation?.graduated_at) fail("REFRESH_QUALIFICATION_GRADUATION_TIME_MISMATCH");
  if (latest.authority_as_of !== current.biological_stage?.authority_as_of) fail("REFRESH_REGISTRY_LATEST_AS_OF_MISMATCH");
  if (latest.authority_valid_until !== current.biological_stage?.authority_valid_until) fail("REFRESH_REGISTRY_LATEST_VALID_UNTIL_MISMATCH");
  if (latest.graduation_status !== current.graduation?.status) fail("REFRESH_REGISTRY_LATEST_GRADUATION_MISMATCH");

  if (!fs.existsSync(path.join(ROOT, CERT))) fail("REFRESH_ARCHITECTURE_CERT_MISSING");
  const cert = readJson(CERT);
  if (cert.status !== "EFFECTIVE" || cert.effective !== true || cert.amendment_id !== "DT02-AMENDMENT-03") fail("REFRESH_ARCHITECTURE_CERT_NOT_EFFECTIVE");
  const certDigest = sha256File(CERT);
  if (current.graduation?.architecture_effectiveness_sha256 !== certDigest) fail("REFRESH_ARCHITECTURE_CERT_DIGEST_MISMATCH");

  if (current.graduation?.previous_effective_current_crop_authority_sha256 !== previous.authority_sha256) fail("REFRESH_PREVIOUS_AUTHORITY_LINK_MISMATCH");
  if (!fs.existsSync(path.join(ROOT, previous.authority_ref))) fail("REFRESH_PREVIOUS_AUTHORITY_MISSING");
  if (sha256File(previous.authority_ref) !== previous.authority_sha256) fail("REFRESH_PREVIOUS_AUTHORITY_DIGEST_MISMATCH");

  try {
    cp.execFileSync("git", ["diff", "--exit-code", base, head, "--", previous.authority_ref, CERT], { cwd: ROOT, stdio: "ignore" });
  } catch {
    fail("REFRESH_PREVIOUS_OR_CERT_DRIFT");
  }

  if (mode === "SINGLE_AUTHORITY_APPEND") {
    if (current.graduation?.refresh_protected_main_base_sha !== base) fail("REFRESH_MATERIALIZED_BASE_LINK_MISMATCH", `${current.graduation?.refresh_protected_main_base_sha}!=${base}`);
    assertSha("REFRESH_QUALIFICATION_SUBJECT_SHA_INVALID", current.subject_head_sha);
    if (!/^sha256:[0-9a-f]{64}$/.test(String(current.graduation?.refresh_request_sha256 || ""))) fail("REFRESH_REQUEST_DIGEST_INVALID");
  }

  for (const key of [
    "runtime_config_write_authorized",
    "database_write_authorized",
    "scheduler_write_authorized",
    "formal_evidence_write_authorized",
    "production_runtime_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_authorized",
    "a0_authorized",
    "o00_o23_authorized",
    "mcft_cap09_completed",
  ]) if (current[key] !== false) fail(`REFRESH_AUTHORITY_CEILING_DRIFT:${key}`);
  if (current.refresh?.running_preformal_mount_replaced !== false) fail("REFRESH_RUNNING_MOUNT_REPLACEMENT_FORBIDDEN");
  if (current.refresh?.production_runtime_restarted !== false) fail("REFRESH_PRODUCTION_RESTART_FORBIDDEN");
  if (current.refresh?.formal_v5_authorized !== false || current.refresh?.a0_authorized !== false || current.refresh?.o00_o23_authorized !== false) fail("REFRESH_NESTED_AUTHORITY_CEILING_DRIFT");

  const result = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_T4R1_CURRENT_CROP_REGISTRY_PRESERVATION_V1",
    invocation: args.invocation,
    mode,
    base_sha: base,
    head_sha: head,
    base_entry_count: baseRegistry.entries.length,
    head_entry_count: registry.entries.length,
    latest_authority_ref: latest.authority_ref,
    latest_authority_sha256: latest.authority_sha256,
    authority_as_of: latest.authority_as_of,
    authority_valid_until: latest.authority_valid_until,
    previous_authority_sha256: previous.authority_sha256,
    changed_files: changedFiles,
    current_crop_surface_changed_files: relevantChanged,
    harness_refs: [WORKFLOW, CHECKER, CONTROL_PLANE],
    production_effect: false,
    formal_v5_authorized: false,
    a0_authorized: false,
    o00_o23_authorized: false,
    mcft_cap09_completed: false,
  };

  if (args.output) {
    const out = path.resolve(ROOT, args.output);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
