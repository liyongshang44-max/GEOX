#!/usr/bin/env node
"use strict";

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

const AUTHORITY_REL =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";

const SELF_REL =
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs";

function fail(code, detail) {
  throw new Error(detail === undefined ? code : `${code}:${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

function git(args, options = {}) {
  return cp.execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  }).trim();
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function assertSha(code, value) {
  if (!/^[0-9a-f]{40}$/.test(String(value || ""))) {
    fail(code, String(value || ""));
  }
}

function isAncestor(ancestor, descendant) {
  try {
    cp.execFileSync(
      "git",
      ["merge-base", "--is-ancestor", ancestor, descendant],
      { cwd: ROOT, stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

function readAuthority() {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, AUTHORITY_REL), "utf8"),
  );
}

function loadContract() {
  const authority = readAuthority();

  const exact = authority.proof_bound_exact_base_admissions || [];
  if (exact.length !== 1) {
    fail("SUCCESSOR_CHAIN_EXACT_ANCHOR_CARDINALITY", exact.length);
  }

  const exactAnchor = exact[0] || {};
  const contract =
    authority.proof_bound_first_parent_successor_chain_admission || {};

  if (
    contract.schema_version !==
    "geox_mcft_cap09_proof_bound_first_parent_successor_chain_admission_v1"
  ) {
    fail("SUCCESSOR_CHAIN_CONTRACT_SCHEMA");
  }

  if (
    contract.mode !==
    "STRUCTURAL_FIRST_PARENT_MERGE_TREE_EQUIVALENCE_WITH_CURRENT_QCP"
  ) {
    fail("SUCCESSOR_CHAIN_MODE");
  }

  if (contract.anchor_base_sha !== exactAnchor.base_sha) {
    fail(
      "SUCCESSOR_CHAIN_ANCHOR_NOT_EXACT_PROOF_BOUND_BASE",
      {
        chain: contract.anchor_base_sha,
        exact: exactAnchor.base_sha,
      },
    );
  }

  if (contract.acceptance !== SELF_REL) {
    fail("SUCCESSOR_CHAIN_ACCEPTANCE_BINDING", contract.acceptance);
  }

  for (const key of [
    "bare_sha_allowlist_admission_authorized",
    "historical_authority_promotion_authorized",
    "baseline_qualification_carry_forward_authorized",
    "production_runtime_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_authorized",
    "a0_authorized",
    "o00_o23_authorized",
  ]) {
    if (contract[key] !== false) {
      fail(`SUCCESSOR_CHAIN_AUTHORITY_CEILING:${key}`);
    }
  }

  for (const key of [
    "first_parent_continuity_required",
    "exact_two_parent_merge_required",
    "merge_tree_equals_candidate_tree_required",
    "candidate_descends_from_previous_base_required",
    "candidate_to_merge_zero_delta_required",
    "current_protected_main_match_required",
    "current_qcp_planner_pass_required",
    "current_qcp_zero_new_unknown_paths_required",
    "current_qcp_zero_authority_errors_required",
    "current_qcp_zero_resolver_errors_required",
    "current_qcp_zero_blockers_required",
  ]) {
    if (contract[key] !== true) {
      fail(`SUCCESSOR_CHAIN_FAIL_CLOSED_REQUIREMENT:${key}`);
    }
  }

  const maxHops = Number(contract.max_successor_hops);

  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 256) {
    fail("SUCCESSOR_CHAIN_MAX_HOPS_INVALID", contract.max_successor_hops);
  }

  return {
    authority,
    exactAnchor,
    contract,
    maxHops,
  };
}

function validateHop(hop, expectedFirstParent) {
  if (hop.parent_count !== 2) {
    fail(
      "SUCCESSOR_CHAIN_EXACT_TWO_PARENT_MERGE_REQUIRED",
      hop.commit_sha,
    );
  }

  if (hop.first_parent_sha !== expectedFirstParent) {
    fail(
      "SUCCESSOR_CHAIN_FIRST_PARENT_DISCONTINUITY",
      {
        commit: hop.commit_sha,
        expected: expectedFirstParent,
        actual: hop.first_parent_sha,
      },
    );
  }

  if (hop.candidate_descends_from_first_parent !== true) {
    fail(
      "SUCCESSOR_CHAIN_CANDIDATE_NOT_DESCENDANT_OF_PREVIOUS_BASE",
      hop.commit_sha,
    );
  }

  if (hop.merge_tree_sha !== hop.candidate_tree_sha) {
    fail(
      "SUCCESSOR_CHAIN_MERGE_TREE_NOT_CANDIDATE_TREE",
      hop.commit_sha,
    );
  }

  if (hop.candidate_to_merge_delta_count !== 0) {
    fail(
      "SUCCESSOR_CHAIN_CANDIDATE_TO_MERGE_DELTA_NOT_ZERO",
      {
        commit: hop.commit_sha,
        paths: hop.candidate_to_merge_changed_paths,
      },
    );
  }

  const a = [...hop.previous_to_merge_changed_paths].sort();
  const b = [...hop.previous_to_candidate_changed_paths].sort();

  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail(
      "SUCCESSOR_CHAIN_MERGE_AND_CANDIDATE_PATHSET_DIVERGENCE",
      hop.commit_sha,
    );
  }
}

function expectFail(label, fn, prefix) {
  try {
    fn();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (!message.startsWith(prefix)) {
      fail(
        "SUCCESSOR_CHAIN_SELFTEST_WRONG_FAILURE",
        `${label}:${message}`,
      );
    }
    return;
  }

  fail("SUCCESSOR_CHAIN_SELFTEST_EXPECTED_FAILURE_MISSING", label);
}

function runSelftest() {
  const good = {
    commit_sha: "c".repeat(40),
    parent_count: 2,
    first_parent_sha: "a".repeat(40),
    second_parent_sha: "b".repeat(40),
    candidate_descends_from_first_parent: true,
    merge_tree_sha: "1".repeat(40),
    candidate_tree_sha: "1".repeat(40),
    candidate_to_merge_delta_count: 0,
    candidate_to_merge_changed_paths: [],
    previous_to_merge_changed_paths: ["x", "y"],
    previous_to_candidate_changed_paths: ["y", "x"],
  };

  validateHop(good, "a".repeat(40));

  expectFail(
    "parent-count",
    () => validateHop({ ...good, parent_count: 1 }, "a".repeat(40)),
    "SUCCESSOR_CHAIN_EXACT_TWO_PARENT_MERGE_REQUIRED",
  );

  expectFail(
    "first-parent",
    () =>
      validateHop(
        { ...good, first_parent_sha: "d".repeat(40) },
        "a".repeat(40),
      ),
    "SUCCESSOR_CHAIN_FIRST_PARENT_DISCONTINUITY",
  );

  expectFail(
    "candidate-ancestry",
    () =>
      validateHop(
        { ...good, candidate_descends_from_first_parent: false },
        "a".repeat(40),
      ),
    "SUCCESSOR_CHAIN_CANDIDATE_NOT_DESCENDANT_OF_PREVIOUS_BASE",
  );

  expectFail(
    "tree-equivalence",
    () =>
      validateHop(
        { ...good, candidate_tree_sha: "2".repeat(40) },
        "a".repeat(40),
      ),
    "SUCCESSOR_CHAIN_MERGE_TREE_NOT_CANDIDATE_TREE",
  );

  expectFail(
    "candidate-merge-delta",
    () =>
      validateHop(
        {
          ...good,
          candidate_to_merge_delta_count: 1,
          candidate_to_merge_changed_paths: ["z"],
        },
        "a".repeat(40),
      ),
    "SUCCESSOR_CHAIN_CANDIDATE_TO_MERGE_DELTA_NOT_ZERO",
  );

  expectFail(
    "pathset-divergence",
    () =>
      validateHop(
        {
          ...good,
          previous_to_candidate_changed_paths: ["x"],
        },
        "a".repeat(40),
      ),
    "SUCCESSOR_CHAIN_MERGE_AND_CANDIDATE_PATHSET_DIVERGENCE",
  );

  return {
    status: "PASS",
    check:
      "MCFT_CAP09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_SELFTEST_V1",
    positive_cases: 1,
    negative_cases: 6,
  };
}

function inspectChain(anchor, base, maxHops) {
  assertSha("SUCCESSOR_CHAIN_ANCHOR_SHA_INVALID", anchor);
  assertSha("SUCCESSOR_CHAIN_BASE_SHA_INVALID", base);

  git(["cat-file", "-e", `${anchor}^{commit}`]);
  git(["cat-file", "-e", `${base}^{commit}`]);

  if (anchor === base) {
    fail("SUCCESSOR_CHAIN_REQUIRES_POST_ANCHOR_SUCCESSOR", base);
  }

  const reverse = [];
  let current = base;

  while (current !== anchor) {
    if (reverse.length >= maxHops) {
      fail(
        "SUCCESSOR_CHAIN_MAX_HOPS_EXCEEDED",
        `${maxHops}:${base}`,
      );
    }

    const row = git([
      "rev-list",
      "--parents",
      "-n",
      "1",
      current,
    ]).split(/\s+/);

    const parents = row.slice(1);

    if (parents.length !== 2) {
      fail(
        "SUCCESSOR_CHAIN_EXACT_TWO_PARENT_MERGE_REQUIRED",
        `${current}:${parents.length}`,
      );
    }

    const firstParent = parents[0];
    const secondParent = parents[1];

    const mergeTree = git(["rev-parse", `${current}^{tree}`]);
    const candidateTree = git([
      "rev-parse",
      `${secondParent}^{tree}`,
    ]);

    const candidateToMergeChangedPaths = lines(
      git([
        "diff",
        "--name-only",
        `${secondParent}..${current}`,
      ]),
    );

    const previousToMergeChangedPaths = lines(
      git([
        "diff",
        "--name-only",
        `${firstParent}..${current}`,
      ]),
    );

    const previousToCandidateChangedPaths = lines(
      git([
        "diff",
        "--name-only",
        `${firstParent}..${secondParent}`,
      ]),
    );

    reverse.push({
      commit_sha: current,
      parent_count: parents.length,
      first_parent_sha: firstParent,
      second_parent_sha: secondParent,
      candidate_descends_from_first_parent:
        isAncestor(firstParent, secondParent),
      merge_tree_sha: mergeTree,
      candidate_tree_sha: candidateTree,
      candidate_to_merge_delta_count:
        candidateToMergeChangedPaths.length,
      candidate_to_merge_changed_paths:
        candidateToMergeChangedPaths,
      previous_to_merge_changed_paths:
        previousToMergeChangedPaths,
      previous_to_candidate_changed_paths:
        previousToCandidateChangedPaths,
    });

    current = firstParent;
  }

  const hops = reverse.reverse();

  let previous = anchor;

  for (const hop of hops) {
    validateHop(hop, previous);
    previous = hop.commit_sha;
  }

  if (previous !== base) {
    fail(
      "SUCCESSOR_CHAIN_FINAL_BASE_MISMATCH",
      `${previous}:${base}`,
    );
  }

  return hops;
}

function main() {
  if (process.argv.includes("--selftest")) {
    process.stdout.write(
      JSON.stringify(runSelftest(), null, 2) + "\n",
    );
    return;
  }

  const { exactAnchor, contract, maxHops } = loadContract();

  const anchor =
    String(arg("--anchor") || contract.anchor_base_sha || "").trim();

  const base =
    String(arg("--base") || "").trim();

  const out =
    String(arg("--out") || "").trim();

  if (!base) {
    fail("SUCCESSOR_CHAIN_BASE_REQUIRED");
  }

  if (anchor !== contract.anchor_base_sha) {
    fail(
      "SUCCESSOR_CHAIN_REQUESTED_ANCHOR_CONTRACT_MISMATCH",
      `${anchor}:${contract.anchor_base_sha}`,
    );
  }

  if (anchor !== exactAnchor.base_sha) {
    fail(
      "SUCCESSOR_CHAIN_REQUESTED_ANCHOR_EXACT_ADMISSION_MISMATCH",
      `${anchor}:${exactAnchor.base_sha}`,
    );
  }

  let currentProtectedMain;

  try {
    currentProtectedMain = git(["rev-parse", "origin/main"]);
  } catch {
    fail("SUCCESSOR_CHAIN_ORIGIN_MAIN_REQUIRED");
  }

  assertSha(
    "SUCCESSOR_CHAIN_CURRENT_PROTECTED_MAIN_SHA_INVALID",
    currentProtectedMain,
  );

  if (base !== currentProtectedMain) {
    fail(
      "SUCCESSOR_CHAIN_BASE_NOT_CURRENT_PROTECTED_MAIN",
      { base, current_protected_main: currentProtectedMain },
    );
  }

  const hops = inspectChain(anchor, base, maxHops);

  const result = {
    status: "PASS",
    acceptance_id:
      "MCFT_CAP09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1",
    mode: contract.mode,
    anchor_base_sha: anchor,
    admitted_base_sha: base,
    current_protected_main_sha: currentProtectedMain,
    current_protected_main_match: true,
    hop_count: hops.length,
    first_parent_chain_complete: true,
    merge_tree_equivalence_all: hops.every(
      (x) => x.merge_tree_sha === x.candidate_tree_sha,
    ),
    candidate_to_merge_zero_delta_all: hops.every(
      (x) => x.candidate_to_merge_delta_count === 0,
    ),
    hops,
    admission_effect:
      "QCP_EVALUATION_ENTRY_ONLY_CURRENT_QCP_STILL_REQUIRED",
    bare_sha_allowlist_admission_authorized: false,
    historical_authority_promotion_authorized: false,
    baseline_qualification_carry_forward_authorized: false,
    runtime_mutation: false,
    database_mutation: false,
    production_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_authorized: false,
    a0_authorized: false,
    o00_o23_authorized: false,
  };

  if (out) {
    const full = path.resolve(ROOT, out);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(
      full,
      JSON.stringify(result, null, 2) + "\n",
      "utf8",
    );
  }

  process.stdout.write(
    JSON.stringify(result, null, 2) + "\n",
  );
}

// Post-closure preparation may append qualified crop authority without changing
// the qualified Runtime. This is a separate, read-only proof, not an exemption
// from the structural chain or current QCP qualification above.
function verifyFormalV5AuthorityContinuity(headRef = "HEAD", historicalReplay = false) {
  const assert = require("node:assert/strict");
  const crypto = require("node:crypto");
  const zlib = require("node:zlib");
  const baseline = "f97bb9b9f29dc276c382e8d02c4644aa9ae2ca0b";
  const head = git(["rev-parse", headRef]);
  if (head === baseline || !isAncestor(baseline, head)) return null;
  const registryRel = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
  const prefix = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-";
  const governance = new Set([
    SELF_REL,
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs",
  ]);
  const changes = lines(git(["diff", "--name-status", baseline, head])).map(row => {
    const [status, rel] = row.split("\t");
    return {status, rel};
  });
  const added = [];
  for (const {status, rel} of changes) {
    if (governance.has(rel) && status === "M") continue;
    if (rel === registryRel && status === "M") continue;
    if (status === "A" && rel.startsWith(prefix)
        && /^\d{4}-\d{2}-\d{2}T\d{2}Z-V1\.json$/.test(rel.slice(prefix.length))) {
      added.push(rel);
      continue;
    }
    fail("FORMAL_V5_AUTHORITY_CONTINUITY_PATH_FORBIDDEN", {status, rel});
  }
  const before = JSON.parse(git(["show", baseline + ":" + registryRel]));
  const after = JSON.parse(fs.readFileSync(path.join(ROOT, registryRel), "utf8"));
  const {entries: oldEntries, ...oldContract} = before;
  const {entries: newEntries, ...newContract} = after;
  assert.deepEqual(newContract, oldContract, "FORMAL_V5_AUTHORITY_REGISTRY_CONTRACT_CHANGED");
  assert.deepEqual(newEntries.slice(0, oldEntries.length), oldEntries, "FORMAL_V5_AUTHORITY_REGISTRY_HISTORY_CHANGED");
  const appended = newEntries.slice(oldEntries.length);
  assert.equal(appended.length, added.length, "FORMAL_V5_AUTHORITY_REGISTRY_APPEND_COUNT");
  assert.deepEqual(appended.map(x => x.authority_ref).sort(), added.sort(), "FORMAL_V5_AUTHORITY_REGISTRY_APPEND_REFS");
  const observedProtectedMain = git(["rev-parse", "origin/main"]);
  if (historicalReplay) {
    assert.notEqual(headRef, "HEAD", "FORMAL_V5_HISTORICAL_REPLAY_EXPLICIT_HEAD_REQUIRED");
    assert.ok(isAncestor(head, observedProtectedMain), "FORMAL_V5_HISTORICAL_REPLAY_NOT_ADOPTED_BY_CURRENT_MAIN");
  }
  const protectedMain = historicalReplay ? head : observedProtectedMain;
  assert.ok(isAncestor(protectedMain, head), "FORMAL_V5_AUTHORITY_BASE_NOT_CURRENT_MAIN_ANCESTOR");
  for (const commit of lines(git(["rev-list", "--first-parent", baseline + ".." + protectedMain]))) {
    for (const row of lines(git(["diff", "--name-status", commit + "^1", commit]))) {
      const [status, rel] = row.split("\t");
      if (rel.startsWith(prefix)) assert.equal(status, "A", "FORMAL_V5_AUTHORITY_PROTECTED_HISTORY_MUTATION");
    }
  }
  const expectedScope = JSON.parse(git(["show", baseline + ":" + oldEntries.at(-1).authority_ref])).scope;
  const digest = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  const expectedFiles = [
    "MCFT_CAP09_T4R1_ROLLING_THERMAL_SNAPSHOT_OVERLAY_PROOF.json",
    "MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_PROBE_RESULT.json",
    "MCFT_CAP09_T4R1_PROTECTED_MAIN_SUCCESSOR_CHAIN_RESULT.json",
    "MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json",
    "MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json",
    "MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json",
  ].sort();
  for (const entry of appended) {
    let protectedBlob = null;
    try { protectedBlob = git(["rev-parse", protectedMain + ":" + entry.authority_ref], {stdio: ["ignore", "pipe", "ignore"]}); } catch {}
    if (protectedBlob) assert.equal(git(["rev-parse", head + ":" + entry.authority_ref]), protectedBlob, "FORMAL_V5_AUTHORITY_ALREADY_ADOPTED_MUTATION");
    const bytes = fs.readFileSync(path.join(ROOT, entry.authority_ref));
    assert.equal(digest(bytes), entry.authority_sha256, "FORMAL_V5_AUTHORITY_DIGEST");
    const authority = JSON.parse(bytes);
    assert.deepEqual(authority.scope, expectedScope, "FORMAL_V5_AUTHORITY_EXACT_SCOPE");
    const evidence = authority.qualification_evidence;
    assert.equal(authority.status, "PASS");
    assert.equal(authority.architecture_effective, true);
    assert.equal(authority.runtime_consumption_authorized, true);
    assert.equal(authority.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
    assert.equal(entry.graduation_status, authority.graduation.status);
    assert.equal(entry.authority_as_of, authority.biological_stage.authority_as_of);
    assert.equal(entry.authority_valid_until, authority.biological_stage.authority_valid_until);
    assert.equal(Date.parse(entry.authority_valid_until) - Date.parse(entry.authority_as_of), 30 * 3600000);
    const qualificationMs = Date.parse(authority.refresh.qualification_time);
    assert.ok(qualificationMs >= Date.parse(entry.authority_as_of) && qualificationMs <= Date.parse(entry.authority_valid_until), "FORMAL_V5_AUTHORITY_STALE_AT_QUALIFICATION");
    assert.equal(authority.biological_stage.epistemic_class, "THERMAL_MODEL_DERIVED");
    assert.equal(authority.biological_stage.observed_biological_stage_claimed, false);
    assert.equal(evidence.subject_sha, authority.subject_head_sha);
    assert.ok(isAncestor(evidence.subject_sha, head), "FORMAL_V5_AUTHORITY_SUBJECT_NOT_ANCESTOR");
    assert.equal(evidence.archive_encoding, "base64");
    assert.ok(Number.isSafeInteger(evidence.run_id) && Number.isSafeInteger(evidence.artifact_id));
    assert.equal(evidence.run_url, "https://github.com/liyongshang44-max/GEOX/actions/runs/" + evidence.run_id);
    assert.deepEqual(Object.keys(evidence.files).sort(), expectedFiles, "FORMAL_V5_AUTHORITY_SIX_FILE_ENVELOPE");
    const zip = Buffer.from(evidence.archive_bytes, "base64");
    assert.equal(digest(zip), evidence.artifact_sha256, "FORMAL_V5_AUTHORITY_ARCHIVE_DIGEST");
    const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.ok(end >= 0, "FORMAL_V5_AUTHORITY_ZIP_DIRECTORY_REQUIRED");
    assert.equal(zip.readUInt16LE(end + 10), 6, "FORMAL_V5_AUTHORITY_ZIP_FILE_COUNT");
    let cursor = zip.readUInt32LE(end + 16);
    const files = {};
    for (let i = 0; i < 6; i++) {
      assert.equal(zip.readUInt32LE(cursor), 0x02014b50);
      const nameLength = zip.readUInt16LE(cursor + 28);
      const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
      assert.ok(expectedFiles.includes(name) && !files[name], "FORMAL_V5_AUTHORITY_ZIP_FILE_IDENTITY");
      const offset = zip.readUInt32LE(cursor + 42);
      assert.equal(zip.readUInt32LE(offset), 0x04034b50);
      const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
      const compressed = zip.subarray(start, start + zip.readUInt32LE(cursor + 20));
      const method = zip.readUInt16LE(cursor + 10);
      assert.ok(method === 0 || method === 8, "FORMAL_V5_AUTHORITY_ZIP_COMPRESSION");
      const data = method === 8 ? zlib.inflateRawSync(compressed, {maxOutputLength: 16 * 1024 * 1024}) : compressed;
      assert.equal(data.length, zip.readUInt32LE(cursor + 24));
      assert.equal(digest(data), evidence.files[name].sha256, "FORMAL_V5_AUTHORITY_EVIDENCE_FILE_DIGEST");
      files[name] = JSON.parse(data);
      cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
    }
    for (const file of Object.values(files)) assert.equal(file.status, "PASS");
    const candidate = files["MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json"];
    const lifecycle = files["MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json"];
    const gov = files["MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json"];
    const chain = files["MCFT_CAP09_T4R1_PROTECTED_MAIN_SUCCESSOR_CHAIN_RESULT.json"];
    assert.equal(candidate.subject_head_sha, evidence.subject_sha);
    assert.equal(lifecycle.subject_sha, evidence.subject_sha);
    assert.equal(gov.subject_sha, evidence.subject_sha);
    assert.equal(chain.admitted_base_sha, evidence.subject_sha);
    assert.equal(gov.subject_is_current_protected_main, true);
    assert.equal(gov.successor_chain_effectiveness_adjudicated, true);
    assert.equal(lifecycle.qualification_outcome, "ACTIVE_CANDIDATE");
    assert.equal(lifecycle.protected_main_authority_context.live_result_eligible_for_protected_main_adoption, true);
    assert.equal(candidate.architecture_effective, false);
    assert.equal(candidate.runtime_consumption_authorized, false);
    assert.deepEqual(authority.scope, candidate.scope);
    assert.deepEqual(authority.lifecycle, candidate.lifecycle);
    assert.deepEqual(authority.crop_model_parameter, candidate.crop_model_parameter);
    assert.equal(authority.crop_water_use_stage, candidate.crop_water_use_stage);
    const {authority_valid_until, ...bio} = authority.biological_stage;
    assert.deepEqual(bio, candidate.biological_stage);
    assert.equal(authority.evidence_digest, candidate.evidence_digest);
    const request = authority.refresh_request;
    assert.equal(digest(Buffer.from(JSON.stringify(request, null, 2) + "\n")), authority.graduation.refresh_request_sha256);
    assert.equal(request.target_artifact.ref, entry.authority_ref);
    assert.equal(request.protected_main_base_sha, evidence.subject_sha);
    assert.equal(request.qualification_time, authority.refresh.qualification_time);
    const previous = request.previous_effective_current_crop_authority;
    assert.equal(previous.overwrite_forbidden, true);
    assert.equal(digest(fs.readFileSync(path.join(ROOT, previous.ref))), previous.sha256);
    const certificate = request.architecture_effectiveness;
    assert.equal(digest(fs.readFileSync(path.join(ROOT, certificate.ref))), certificate.sha256);
    assert.equal(certificate.sha256, authority.graduation.architecture_effectiveness_sha256);
    for (const key of ["database_write_authorized", "runtime_config_write_authorized", "scheduler_write_authorized", "formal_evidence_write_authorized", "production_runtime_start_authorized", "production_owner_activation_authorized", "formal_v5_authorized", "a0_authorized", "o00_o23_authorized", "mcft_cap09_completed"]) {
      assert.equal(authority[key], false, "FORMAL_V5_AUTHORITY_CEILING:" + key);
      assert.equal(candidate[key], false, "FORMAL_V5_CANDIDATE_CEILING:" + key);
    }
  }
  return {baseline, changedPaths: changes.map(x => x.rel), authorityCount: added.length};
}

module.exports = {verifyFormalV5AuthorityContinuity};
if (require.main === module) main();
