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

main();