"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

const EXPECTED = Object.freeze({
  subject: "dc9ea15a26c718594807fd0ac7158742518981b4",
  base: "4ee4989fc4f40cc52a3819be282c1d192b58a9b2",
  frozen: "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a",
  semanticRevision: "9ffecd38d3093c4a3f566ee996e3ad00aaf6004a",
  dependencyDigest: "sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965",
  checkId: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  workflow: ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
  qcp: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  proof: "docs/digital_twin/mcft/cap_09/evidence/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-POSTGRES-PROOF-DC9EA15-V1.json",
  basis: "docs/digital_twin/mcft/cap_09/evidence/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-BASIS-ACCEPTANCE-DC9EA15-V1.json",
  contract: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE5-CAUSAL-TEMPORAL-SUPERSESSION-CONTRACT-V1.json",
  checker: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_V1.cjs",
  preflight: "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
});

function git(...args) {
  return cp.execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

function gitJson(ref, rel) {
  return JSON.parse(git("show", `${ref}:${rel}`));
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function sha256File(rel) {
  const bytes = fs.readFileSync(path.join(ROOT, rel));
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function arg(name, fallback) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  assert(i + 1 < argv.length, `${name}:VALUE_REQUIRED`);
  return argv[i + 1];
}

function isAncestor(ancestor, descendant) {
  const r = cp.spawnSync(
    "git",
    ["merge-base", "--is-ancestor", ancestor, descendant],
    { cwd: ROOT, stdio: "ignore" },
  );
  return r.status === 0;
}

function main() {
  const head = arg("--head", git("rev-parse", "HEAD"));
  const base = arg("--base", EXPECTED.base);
  const dependencyDigest =
    arg("--dependency-digest", EXPECTED.dependencyDigest);

  assert.match(head, /^[0-9a-f]{40}$/);
  assert.equal(base, EXPECTED.base, "PHASE5_SUPERSESSION_BASE_MISMATCH");
  assert.equal(
    dependencyDigest,
    EXPECTED.dependencyDigest,
    "PHASE5_SUPERSESSION_DEPENDENCY_DIGEST_MISMATCH",
  );

  assert(
    isAncestor(EXPECTED.subject, head),
    "PHASE5_SUPERSESSION_SUBJECT_NOT_ANCESTOR_OF_HEAD",
  );

  const contract = readJson(EXPECTED.contract);
  const proof = readJson(EXPECTED.proof);
  const basis = readJson(EXPECTED.basis);
  const qcp = readJson(EXPECTED.qcp);

  assert.equal(
    contract.schema_version,
    "geox_mcft_cap09_phase5_causal_temporal_supersession_contract_v1",
  );
  assert.equal(
    contract.status,
    "QUALIFIED_SUBJECT_SUCCESSOR_ADMISSION_CONTRACT",
  );
  assert.equal(contract.check_id, EXPECTED.checkId);
  assert.equal(contract.qualification_subject_sha, EXPECTED.subject);
  assert.equal(contract.qcp_base_sha, EXPECTED.base);
  assert.equal(contract.frozen_runtime_subject_sha, EXPECTED.frozen);
  assert.equal(
    contract.phase5_dependency_digest,
    EXPECTED.dependencyDigest,
  );

  assert.equal(
    sha256File(EXPECTED.proof),
    contract.durable_evidence.postgres_proof_sha256,
    "PHASE5_SUPERSESSION_PROOF_DIGEST_MISMATCH",
  );

  assert.equal(
    sha256File(EXPECTED.basis),
    contract.durable_evidence.basis_acceptance_sha256,
    "PHASE5_SUPERSESSION_BASIS_DIGEST_MISMATCH",
  );

  assert.equal(proof.status, "PASS");
  assert.equal(proof.qualification_subject_sha, EXPECTED.subject);
  assert.equal(
    proof.qualified_runtime.frozen_runtime_subject_sha,
    EXPECTED.frozen,
  );
  assert.equal(
    proof.qualified_runtime.semantic_revision_commit_sha,
    EXPECTED.semanticRevision,
  );
  assert.equal(
    proof.qualified_runtime.frozen_runtime_modified_by_this_qualification,
    false,
  );

  const expectedSurface = {
    real_postgresql_persistence: true,
    logical_time_cutoff: true,
    causal_latest_selection: true,
    future_revision_backward_leakage_rejected: true,
    future_event_leakage_fail_closed: true,
    ambiguous_revision_fail_closed: true,
    restart_replay_determinism: true,
  };

  for (const [key, value] of Object.entries(expectedSurface)) {
    assert.equal(
      proof.proof_surface[key],
      value,
      `PHASE5_SUPERSESSION_PROOF_SURFACE:${key}`,
    );
  }

  assert(
    Number.isInteger(
      proof.proof_surface.persisted_fact_count_survived_process_restart,
    ) &&
    proof.proof_surface.persisted_fact_count_survived_process_restart > 0,
    "PHASE5_SUPERSESSION_RESTART_PERSISTENCE_REQUIRED",
  );

  assert.equal(proof.proof_surface.runtime_database_write_count, 0);
  assert.equal(proof.proof_surface.runtime_provider_request_count, 0);

  assert.equal(
    proof.temporal_semantics
      .same_source_record_id_revision_selection_by_causal_availability,
    true,
  );

  assert.notEqual(
    proof.temporal_semantics.earlier_boundary_selected_hash,
    proof.temporal_semantics.later_boundary_selected_hash,
    "PHASE5_SUPERSESSION_CAUSAL_REVISION_TRANSITION_REQUIRED",
  );

  assert.equal(
    proof.qualification_supersession.superseded_claim,
    "PROTECTED_TEMPORAL_SEMANTIC_CORE_UNCHANGED",
  );

  assert.equal(
    proof.qualification_supersession.replacement_claim,
    "FROZEN_RUNTIME_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFIED_BY_REAL_POSTGRES_V1",
  );

  assert.equal(
    proof.qualification_supersession
      .old_24t_proof_reinterpreted_as_covering_new_semantics,
    false,
  );

  assert.equal(
    proof.qualification_supersession
      .old_24t_proof_causal_revision_semantics_coverage,
    false,
  );

  assert.equal(basis.status, "PASS");
  assert.equal(basis.adjudicated_head_sha, EXPECTED.subject);
  assert.equal(basis.proof_qualification_subject_sha, EXPECTED.subject);
  assert.equal(basis.proof_subject_matches_adjudicated_head, true);
  assert.equal(basis.fail_closed_preserved, true);

  for (const [key, value] of Object.entries(basis.non_effects)) {
    assert.equal(
      value,
      false,
      `PHASE5_SUPERSESSION_BASIS_NON_EFFECT:${key}`,
    );
  }

  const subjectQcp = gitJson(EXPECTED.subject, EXPECTED.qcp);

  assert.deepEqual(
    qcp.dependency_resolvers[EXPECTED.checkId],
    subjectQcp.dependency_resolvers[EXPECTED.checkId],
    "PHASE5_SUPERSESSION_RESOLVER_MUTATION_FORBIDDEN",
  );

  const currentCheck =
    qcp.checks.find((x) => x.check_id === EXPECTED.checkId);

  const subjectCheck =
    subjectQcp.checks.find((x) => x.check_id === EXPECTED.checkId);

  assert(currentCheck, "PHASE5_CURRENT_QCP_CHECK_REQUIRED");
  assert(subjectCheck, "PHASE5_SUBJECT_QCP_CHECK_REQUIRED");

  assert.deepEqual(
    currentCheck,
    subjectCheck,
    "PHASE5_SUPERSESSION_QCP_CHECK_SEMANTICS_MUTATION_FORBIDDEN",
  );

  const controlPaths =
    qcp.dependency_resolvers.CONTROL_PLANE_FILES.paths;

  const subjectControlPaths =
    subjectQcp.dependency_resolvers.CONTROL_PLANE_FILES.paths;

  const additions = [
    EXPECTED.proof,
    EXPECTED.basis,
    EXPECTED.contract,
    EXPECTED.checker,
  ];

  assert.deepEqual(
    controlPaths.slice(0, subjectControlPaths.length),
    subjectControlPaths,
    "PHASE5_SUPERSESSION_CONTROL_PLANE_PREFIX_MUTATED",
  );

  assert.deepEqual(
    controlPaths.slice(subjectControlPaths.length),
    additions,
    "PHASE5_SUPERSESSION_CONTROL_PLANE_APPEND_SET_INVALID",
  );

  const allowedChanged = new Set([
    EXPECTED.proof,
    EXPECTED.basis,
    EXPECTED.contract,
    EXPECTED.checker,
    EXPECTED.qcp,
    EXPECTED.preflight,
  ]);

  const changed =
    git("diff", "--name-only", EXPECTED.subject, head)
      .split(/\r?\n/)
      .filter(Boolean);

  const forbiddenChanged =
    changed.filter((p) => !allowedChanged.has(p));

  assert.deepEqual(
    forbiddenChanged,
    [],
    "PHASE5_SUPERSESSION_FORBIDDEN_SUCCESSOR_PATH_CHANGE",
  );

  const phase5Paths =
    subjectQcp.dependency_resolvers[EXPECTED.checkId].paths;

  assert.equal(
    phase5Paths.length,
    56,
    "PHASE5_SUPERSESSION_PHASE5_RESOLVER_CARDINALITY_CHANGED",
  );

  const frozenDifferences = [];

  for (const rel of phase5Paths) {
    const frozenBlob = git("rev-parse", `${EXPECTED.frozen}:${rel}`);
    const subjectBlob = git("rev-parse", `${EXPECTED.subject}:${rel}`);

    if (frozenBlob !== subjectBlob) {
      frozenDifferences.push(rel);
    }
  }

  assert.deepEqual(
    frozenDifferences,
    [EXPECTED.workflow],
    "PHASE5_SUPERSESSION_UNEXPECTED_FROZEN_RUNTIME_SURFACE_DELTA",
  );

  const workflowDiff =
    git(
      "diff",
      "--unified=0",
      EXPECTED.frozen,
      EXPECTED.subject,
      "--",
      EXPECTED.workflow,
    );

  const removed =
    workflowDiff
      .split(/\r?\n/)
      .filter((x) => x.startsWith("-") && !x.startsWith("---"));

  const added =
    workflowDiff
      .split(/\r?\n/)
      .filter((x) => x.startsWith("+") && !x.startsWith("+++"));

  assert.equal(
    removed.length,
    2,
    "PHASE5_SUPERSESSION_EXPECTED_TWO_REMOVED_LOCATORS",
  );

  assert.equal(
    added.length,
    2,
    "PHASE5_SUPERSESSION_EXPECTED_TWO_ADDED_LOCATORS",
  );

  function digestSet(lines) {
    return lines
      .map((line) => {
        const m = line.match(/sha256:[0-9a-f]{64}/);
        assert(m, "PHASE5_SUPERSESSION_IMAGE_DIGEST_REQUIRED");
        return m[0];
      })
      .sort();
  }

  assert.deepEqual(
    digestSet(removed),
    digestSet(added),
    "PHASE5_SUPERSESSION_IMAGE_DIGEST_CHANGED",
  );

  assert.deepEqual(
    digestSet(added),
    [
      "sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e",
      "sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727",
    ].sort(),
    "PHASE5_SUPERSESSION_UNEXPECTED_IMAGE_DIGEST_SET",
  );

  const result = {
    schema_version:
      "geox_mcft_cap09_phase5_causal_temporal_supersession_contract_acceptance_v1",
    status: "PASS",
    check_id: EXPECTED.checkId,
    qualification_subject_sha: EXPECTED.subject,
    adjudicated_head_sha: head,
    qcp_base_sha: EXPECTED.base,
    frozen_runtime_subject_sha: EXPECTED.frozen,
    dependency_digest: EXPECTED.dependencyDigest,

    proof_subject_exact: true,
    real_postgresql_causal_temporal_proof: true,
    historical_24t_reinterpreted: false,

    phase5_resolver_unchanged_from_subject: true,
    phase5_qcp_check_semantics_unchanged_from_subject: true,

    frozen_phase5_resolver_path_count: phase5Paths.length,
    frozen_phase5_difference_count: frozenDifferences.length,
    frozen_phase5_only_difference: frozenDifferences[0],
    qualification_image_digest_set_preserved: true,

    successor_changed_paths: changed,
    forbidden_successor_changed_paths: [],

    non_effects: contract.non_effects,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();
