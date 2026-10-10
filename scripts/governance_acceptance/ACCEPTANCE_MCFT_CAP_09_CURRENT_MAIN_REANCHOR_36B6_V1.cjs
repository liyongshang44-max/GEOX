#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const ARTIFACT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-MAIN-REANCHOR-36B6-V1.json";
const ACCEPTANCE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_MAIN_REANCHOR_36B6_V1.cjs";
const QCP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json";
const ARTIFACT_SHA256 = "7b9d1e455adac6de8d3a8376d656624bd6cfb5e4a177f278a5d933262c3da4a4";
const OLD_BASE = "0ac2d2cf98d553285a2051a1b0b86131a23fc413";
const NEW_BASE = "36b671ce83652e7d3ba350c3e9118342226c13a8";
const QUALIFIED_CANDIDATE = "dd8257c069e1841da3f13c9efb2ab104d4251414";
const NEW_TREE = "3d84247bc622a9a5187e085f3e93acba9429c4f3";

function git(args) {
  return cp.execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  }).trim();
}

function lines(v) {
  return String(v).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function verifyObserved(artifact, observed) {
  assert.equal(
    observed.current_main,
    NEW_BASE,
    "REANCHOR_36B6_PROTECTED_MAIN_DRIFT"
  );
  assert.equal(observed.tree, NEW_TREE, "REANCHOR_36B6_TREE_DRIFT");
  assert.equal(
    observed.qualified_candidate_tree,
    NEW_TREE,
    "REANCHOR_36B6_QUALIFIED_CANDIDATE_TREE_DRIFT"
  );
  assert.deepEqual(
    observed.merge_parents,
    [OLD_BASE, QUALIFIED_CANDIDATE],
    "REANCHOR_36B6_MERGE_PARENT_DRIFT"
  );
  assert.deepEqual(
    observed.candidate_to_merge_changed_paths,
    [],
    "REANCHOR_36B6_CANDIDATE_TO_MERGE_DIFF_NOT_EMPTY"
  );
  assert.equal(
    observed.old_is_ancestor,
    true,
    "REANCHOR_36B6_OLD_BASE_NOT_ANCESTOR"
  );
  assert.equal(
    observed.head_descends_from_main,
    true,
    "REANCHOR_36B6_HEAD_NOT_DESCENDANT"
  );
  assert.deepEqual(
    observed.first_parent_successors,
    artifact.exact_first_parent_successors,
    "REANCHOR_36B6_FIRST_PARENT_LINEAGE_DRIFT"
  );
  assert.deepEqual(
    observed.changed_paths,
    artifact.exact_changed_paths.map((row) => row.path).sort(),
    "REANCHOR_36B6_CHANGED_PATH_SET_DRIFT"
  );
  for (const row of artifact.exact_changed_paths) {
    assert.equal(
      observed.blobs[row.path],
      row.blob_sha,
      `REANCHOR_36B6_ADOPTED_BLOB_DRIFT:${row.path}`
    );
  }
}

function main() {
  const bytes = fs.readFileSync(path.join(ROOT, ARTIFACT));
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    ARTIFACT_SHA256,
    "REANCHOR_36B6_DECLARATION_DIGEST_DRIFT"
  );

  const artifact = JSON.parse(bytes);
  assert.equal(artifact.previous_accepted_mcft_base, OLD_BASE);
  assert.equal(artifact.current_protected_main, NEW_BASE);
  assert.equal(artifact.current_protected_main_tree, NEW_TREE);
  assert.equal(
    artifact.merge_tree_equivalence.qualified_candidate_sha,
    QUALIFIED_CANDIDATE
  );
  assert.equal(
    artifact.merge_tree_equivalence.qualified_candidate_base_sha,
    OLD_BASE
  );
  assert.equal(
    artifact.merge_tree_equivalence.candidate_to_merge_tree_equivalent,
    true
  );
  assert.deepEqual(
    artifact.merge_tree_equivalence.candidate_to_merge_changed_paths,
    []
  );
  assert.equal(
    artifact.merge_tree_equivalence.registry_base_admission_carried_forward,
    false
  );
  assert.equal(
    artifact.qcp_admission.baseline_qualification_carry_forward_authorized,
    false
  );
  assert.equal(
    artifact.qcp_admission.new_phase3_phase5_run_materialized,
    false
  );
  for (const value of Object.values(artifact.non_effects)) {
    assert.equal(value, false);
  }

  if (process.argv.includes("--selftest")) {
    const good = {
      current_main: NEW_BASE,
      tree: NEW_TREE,
      qualified_candidate_tree: NEW_TREE,
      merge_parents: [OLD_BASE, QUALIFIED_CANDIDATE],
      candidate_to_merge_changed_paths: [],
      old_is_ancestor: true,
      head_descends_from_main: true,
      first_parent_successors: structuredClone(
        artifact.exact_first_parent_successors
      ),
      changed_paths: artifact.exact_changed_paths.map((r) => r.path).sort(),
      blobs: Object.fromEntries(
        artifact.exact_changed_paths.map((r) => [r.path, r.blob_sha])
      )
    };

    verifyObserved(artifact, good);

    const cases = [
      ["MAIN_DRIFT", (x) => { x.current_main = OLD_BASE; }],
      ["TREE_DRIFT", (x) => { x.tree = "0".repeat(40); }],
      [
        "QUALIFIED_CANDIDATE_TREE_DRIFT",
        (x) => { x.qualified_candidate_tree = "0".repeat(40); }
      ],
      [
        "MERGE_PARENT_DRIFT",
        (x) => { x.merge_parents[1] = "0".repeat(40); }
      ],
      [
        "CANDIDATE_TO_MERGE_DIFF_NOT_EMPTY",
        (x) => { x.candidate_to_merge_changed_paths.push("unexpected"); }
      ],
      ["OLD_BASE_NOT_ANCESTOR", (x) => { x.old_is_ancestor = false; }],
      ["HEAD_NOT_DESCENDANT", (x) => { x.head_descends_from_main = false; }],
      [
        "FIRST_PARENT_LINEAGE_DRIFT",
        (x) => { x.first_parent_successors[0].sha = "0".repeat(40); }
      ],
      [
        "CHANGED_PATH_SET_DRIFT",
        (x) => { x.changed_paths.push("apps/server/src/runtime/unadjudicated.ts"); }
      ],
      [
        "ADOPTED_BLOB_DRIFT",
        (x) => { x.blobs[x.changed_paths[0]] = "0".repeat(40); }
      ]
    ];

    for (const [code, mutate] of cases) {
      const altered = structuredClone(good);
      mutate(altered);
      assert.throws(() => verifyObserved(artifact, altered), new RegExp(code));
    }

    console.log("REANCHOR_36B6_NEGATIVE_TESTS = PASS");
    console.log(
      JSON.stringify({
        status: "PASS",
        check: "REANCHOR_36B6_NEGATIVE_TESTS",
        positive_cases: 1,
        negative_cases: cases.length,
        base_admitted: false
      })
    );
    return;
  }

  const observed = {
    current_main: git(["rev-parse", "origin/main"]),
    tree: git(["rev-parse", `${NEW_BASE}^{tree}`]),
    qualified_candidate_tree: git([
      "rev-parse",
      `${QUALIFIED_CANDIDATE}^{tree}`
    ]),
    merge_parents: git(["rev-list", "--parents", "-n", "1", NEW_BASE])
      .split(/\s+/)
      .slice(1),
    candidate_to_merge_changed_paths: lines(
      git(["diff", "--name-only", `${QUALIFIED_CANDIDATE}..${NEW_BASE}`])
    ),
    old_is_ancestor:
      cp.spawnSync(
        "git",
        ["merge-base", "--is-ancestor", OLD_BASE, NEW_BASE],
        { cwd: ROOT }
      ).status === 0,
    head_descends_from_main:
      cp.spawnSync(
        "git",
        ["merge-base", "--is-ancestor", NEW_BASE, "HEAD"],
        { cwd: ROOT }
      ).status === 0,
    first_parent_successors: lines(
      git(["rev-list", "--first-parent", "--reverse", `${OLD_BASE}..${NEW_BASE}`])
    ).map((sha) => {
      const parents = git(["rev-list", "--parents", "-n", "1", sha])
        .split(/\s+/)
        .slice(1);
      const match = git(["show", "-s", "--format=%s", sha]).match(
        /^Merge pull request #(\d+) /
      );
      assert(match, "REANCHOR_36B6_MERGE_PR_IDENTITY_MISSING");
      return { sha, parents, pr_number: Number(match[1]) };
    }),
    changed_paths: lines(
      git(["diff", "--name-only", `${OLD_BASE}..${NEW_BASE}`])
    ).sort(),
    blobs: Object.fromEntries(
      artifact.exact_changed_paths.map((r) => [
        r.path,
        git(["rev-parse", `${NEW_BASE}:${r.path}`])
      ])
    )
  };

  verifyObserved(artifact, observed);

  const qcp = JSON.parse(
    fs.readFileSync(path.join(ROOT, QCP), "utf8")
  );
  const priorQcp = JSON.parse(
    git(["show", `${NEW_BASE}:${QCP}`])
  );

  assert.deepEqual(
    qcp.governed_successor_predecessor_shas,
    priorQcp.governed_successor_predecessor_shas,
    "REANCHOR_36B6_HISTORICAL_ALLOWLIST_CHANGE_FORBIDDEN"
  );
  assert(
    !qcp.governed_successor_predecessor_shas.includes(NEW_BASE),
    "REANCHOR_36B6_BARE_ALLOWLIST_FORBIDDEN"
  );
  assert.equal(
    qcp.proof_bound_exact_base_admissions?.length,
    1,
    "REANCHOR_36B6_ADMISSION_CARDINALITY"
  );

  const admission = qcp.proof_bound_exact_base_admissions[0];
  assert.equal(admission.base_sha, NEW_BASE);
  assert.equal(admission.current_protected_main_tree, NEW_TREE);
  assert.equal(admission.proof_artifact, ARTIFACT);
  assert.equal(admission.proof_acceptance, ACCEPTANCE);
  assert.equal(
    admission.proof_workflow,
    ".github/workflows/mcft-cap-09-current-main-reanchor-2144-v1.yml"
  );
  assert.equal(admission.mode, "PROOF_BOUND_EXACT_BASE");
  assert.equal(admission.bare_sha_allowlist_admission_authorized, false);
  assert.equal(
    admission.admission_requires_exact_lineage_and_overlap_proof,
    true
  );
  assert.equal(
    admission.baseline_qualification_carry_forward_authorized,
    false
  );

  for (const rel of [ARTIFACT, ACCEPTANCE]) {
    assert(
      qcp.dependency_resolvers.CONTROL_PLANE_FILES.paths.includes(rel),
      `REANCHOR_36B6_CONTROL_PLANE_PATH_MISSING:${rel}`
    );
  }

  const registry = JSON.parse(
    fs.readFileSync(path.join(ROOT, REGISTRY), "utf8")
  );
  const priorRegistry = JSON.parse(
    git(["show", `${NEW_BASE}:${REGISTRY}`])
  );

  const priorDurableBases =
    priorRegistry.requalification_evidence?.durable_anchors?.rules
      ?.governed_successor_predecessors;
  const currentDurableBases =
    registry.requalification_evidence?.durable_anchors?.rules
      ?.governed_successor_predecessors;

  assert(
    Array.isArray(priorDurableBases) && Array.isArray(currentDurableBases),
    "REANCHOR_36B6_DURABLE_BASE_LIST_MISSING"
  );
  assert(
    !priorDurableBases.includes(NEW_BASE),
    "REANCHOR_36B6_BASE_ALREADY_PRESENT_IN_PRIOR_REGISTRY"
  );
  assert.deepEqual(
    currentDurableBases,
    [...priorDurableBases, NEW_BASE],
    "REANCHOR_36B6_DURABLE_BASE_ADMISSION_NOT_EXACT_APPEND"
  );

  const normalizedCurrentRegistry = structuredClone(registry);
  normalizedCurrentRegistry.requalification_evidence.durable_anchors.rules
    .governed_successor_predecessors = structuredClone(priorDurableBases);

  assert.deepEqual(
    normalizedCurrentRegistry,
    priorRegistry,
    "REANCHOR_36B6_REGISTRY_MUTATION_OUTSIDE_DURABLE_BASE_ADMISSION"
  );

  const historicalContains36B6 =
    qcp.governed_successor_predecessor_shas.includes(NEW_BASE);
  const durableBaseContains36B6 = currentDurableBases.includes(NEW_BASE);

  const result = {
    status: "PASS",
    scope:
      "EXACT_MERGE_TREE_EQUIVALENCE_AND_CURRENT_MAIN_PROOF_BOUND_ADMISSION_ONLY",
    base_sha: NEW_BASE,
    head_sha: git(["rev-parse", "HEAD"]),
    tree_sha: NEW_TREE,
    qualified_candidate_sha: QUALIFIED_CANDIDATE,
    qualified_candidate_tree_equivalence: true,
    candidate_to_merge_delta_count:
      observed.candidate_to_merge_changed_paths.length,
    exact_merged_delta_count: observed.changed_paths.length,
    registry_durable_base_admission_only: true,
    new_phase3_phase5_run_materialized: false,
    baseline_qualification_carried_forward: false,
    historical_contains_36b6: historicalContains36B6,
    durable_base_contains_36b6: durableBaseContains36B6,
    production_owner_proven: false,
    production_runtime_started: false,
    formal_v5_armed: false
  };

  assert.equal(result.candidate_to_merge_delta_count, 0);
  assert.equal(result.exact_merged_delta_count, 12);
  assert.equal(result.new_phase3_phase5_run_materialized, false);
  assert.equal(result.baseline_qualification_carried_forward, false);
  assert.equal(result.historical_contains_36b6, false);
  assert.equal(result.durable_base_contains_36b6, true);

  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(
      ROOT,
      "acceptance-output/MCFT_CAP_09_CURRENT_MAIN_REANCHOR_36B6_V1_RESULT.json"
    ),
    JSON.stringify(result, null, 2) + "\\n"
  );

  console.log(
    "EXACT_MERGE_TREE_EQUIVALENCE_AND_CURRENT_MAIN_PROOF_BOUND_ADMISSION_ONLY = PASS"
  );
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();
module.exports = { verifyObserved };
