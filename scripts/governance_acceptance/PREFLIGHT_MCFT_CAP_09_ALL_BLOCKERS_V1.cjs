#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");

const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  planApplicability,
  evidenceIsStructurallyValid,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_OUT = "acceptance-output/MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json";
const REQUALIFICATION_BINDING_STRATEGY = "MCFT_CAP09_REQUALIFICATION_RUN_BINDING_V1";
const PHASE6_RETIREMENT_AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE6-GITHUB-PRODUCTION-EXECUTION-RETIREMENT-AUTHORITY-V1.json";
const PHASE6_OWNER_AUDITOR_PATH = "scripts/governance_acceptance/AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs";
const PROTECTED_MAIN_ADOPTION_DURABLE_REQUALIFICATION_CHECKS = new Set([
  "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  "PHASE2_EVIDENCE_PROVIDER_MODULES",
  "T4R1_BIOLOGICAL_STAGE_AUTHORITY",
  "T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION",
  "A18_BIOLOGICAL_STAGE_CONTEXT_V4",
  "TWIN_V2_STAGE_AUTHORITY_SUCCESSOR",
  "PRODUCTION_TWIN_PROCESS_V2_ROUTING",
  "BIOLOGICAL_STAGE_EFFECTIVENESS_GRADUATION",
]);
const REQUALIFICATION_BINDING_FIELDS = [
  "evidence_id", "check_id", "evidence_class", "generation", "stage", "subject_sha",
  "workflow_name", "workflow_path", "run_id", "run_conclusion", "artifact_id", "artifact_digest",
  "dependency_subject_sha", "dependency_digest_strategy", "dependency_digest",
  "artifact_absence_reason", "immutable",
];

const T0_GRADUATION_CARRY_FORWARD_V1 = Object.freeze({
  closure_subject_sha: "18fa562804124f69f5a64f0fa549bdf69c656ea3",
  protected_main_base_sha: "8f63c498bd48978e2dd525ad57b6b8fdb7ada560",
  qcp_base_sha: "4ee4989fc4f40cc52a3819be282c1d192b58a9b2",
  frozen_runtime_sha: "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a",
  preflight_path: "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
  am19: Object.freeze({
    check_id: "LEGACY_AM19_PERSISTENT_24T",
    qualification_subject_sha: "4ee4989fc4f40cc52a3819be282c1d192b58a9b2",
    closure_semantic_subject_sha: "da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9",
    dependency_digest: "sha256:2ec59117bc25b8848fed8acaeccfe0f20a20fcc0db87ecb7258722bc320263f0",
    registration_path: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-SUCCESSOR-VERIFIED-DELIVERY-REGISTRATION-V1.json",
    acceptance_path: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_VERIFIED_DELIVERY_REGISTRATION_V1.cjs",
    contract_path: "scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1.json",
    legacy_evidence_id: "LEGACY_AM19_24T_SUCCESSOR_ROUTING_3BBF096E",
  }),
  phase5: Object.freeze({
    check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
    qualification_subject_sha: "dc9ea15a26c718594807fd0ac7158742518981b4",
    durable_package_anchor_sha: "e74f4348cc0318bb1fd3b3345bce7fe6c9c9dba6",
    dependency_digest: "sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965",
    contract_path: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE5-CAUSAL-TEMPORAL-SUPERSESSION-CONTRACT-V1.json",
    proof_path: "docs/digital_twin/mcft/cap_09/evidence/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-POSTGRES-PROOF-DC9EA15-V1.json",
    basis_path: "docs/digital_twin/mcft/cap_09/evidence/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-BASIS-ACCEPTANCE-DC9EA15-V1.json",
    checker_path: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_V1.cjs",
  }),
});
const RUNTIME_CUTOVER_PHASE5_REQUALIFICATION_V1 = {
  evidence_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_7C5A74CD_RUNTIME_CUTOVER_V1",
  check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  subject_sha: "7c5a74cd202028b0c5252bb8dfc113c3152b804d",
  base_sha: "0630bb63b82c9ba108854f5aa26b096f9221f031",
  run_id: 33788575046,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase5-two-service-accelerated-24t",
  workflow_path: ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
  event: "pull_request",
  dependency_digest: "sha256:63e8aac2a5c8f27d4e7e78514f3858647ac72a105ed33d5228be3a6e0ae3dd41",
};
const PROOF_BOUND_PHASE3_REQUALIFICATION_V1 = {
  evidence_id: "PHASE3_EVIDENCE_RUNTIME_FOUNDATION_REQUAL_4C61E5EF_PROOF_BOUND_1E59_V1",
  check_id: "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
  subject_sha: "4c61e5ef0483fc466b2bde71922ddabb99a07c5f",
  base_sha: "1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20",
  run_id: 34625038137,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase3-evidence-runtime-persistence",
  workflow_path: ".github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml",
  event: "pull_request",
  dependency_digest: "sha256:3d8a9077ad0897ab5848426f202887a1e1f807c51be8c246f7ec8d2cd2feddaf",
};
const PROOF_BOUND_PHASE5_REQUALIFICATION_V1 = {
  evidence_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_4C61E5EF_PROOF_BOUND_1E59_V1",
  check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  subject_sha: "4c61e5ef0483fc466b2bde71922ddabb99a07c5f",
  base_sha: "1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20",
  run_id: 34625038090,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase5-two-service-accelerated-24t",
  workflow_path: ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
  event: "pull_request",
  dependency_digest: "sha256:617d09a11a5797e0a1e3793a79561613d7a1b672df76593fe9a1e0b7f24483b7",
};
const SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_V1 = {
  evidence_id: "PHASE3_EVIDENCE_RUNTIME_FOUNDATION_REQUAL_24CD4B59_SUCCESSOR_2CE0C90_V1",
  check_id: "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
  subject_sha: "24cd4b592d671974f5b3a1449a6194bfca0806cb",
  base_sha: "1137e327df07011ec54186feb88d7a544301fe70",
  final_head_sha: "24cd4b592d671974f5b3a1449a6194bfca0806cb",
  merge_commit_sha: "2ce0c90ef30b3c04ed112639c87926ac19be4e03",
  run_id: 35369069593,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase3-evidence-runtime-persistence",
  workflow_path: ".github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml",
  event: "pull_request",
  dependency_digest: "sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b",
};
const SUCCESSOR_CHAIN_PHASE5_REQUALIFICATION_V1 = {
  evidence_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_24CD4B59_SUCCESSOR_2CE0C90_V1",
  check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  subject_sha: "24cd4b592d671974f5b3a1449a6194bfca0806cb",
  base_sha: "1137e327df07011ec54186feb88d7a544301fe70",
  final_head_sha: "24cd4b592d671974f5b3a1449a6194bfca0806cb",
  merge_commit_sha: "2ce0c90ef30b3c04ed112639c87926ac19be4e03",
  run_id: 35369069614,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase5-two-service-accelerated-24t",
  workflow_path: ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
  event: "pull_request",
  dependency_digest: "sha256:e4c2d6c263f4de4f0dee9beb0f688005295c96cb4e795d21fd92359489b1964d",
};
const CURRENT_PR_PHASE3_REQUALIFICATION_C12_V1 = {
  evidence_id: "PHASE3_EVIDENCE_RUNTIME_FOUNDATION_REQUAL_C12E6F66_GFS_PLANNER_V1",
  check_id: "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
  subject_sha: "c12e6f666e39d8a436f8d7880e8903e3a1bc6bfd",
  base_sha: "1137e327df07011ec54186feb88d7a544301fe70",
  run_id: 35365650837,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase3-evidence-runtime-persistence",
  workflow_path: ".github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml",
  event: "pull_request",
  dependency_digest: "sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b",
};
const CURRENT_PR_PHASE5_REQUALIFICATION_C12_V1 = {
  evidence_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_C12E6F66_GFS_PLANNER_V1",
  check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  subject_sha: "c12e6f666e39d8a436f8d7880e8903e3a1bc6bfd",
  base_sha: "1137e327df07011ec54186feb88d7a544301fe70",
  run_id: 35365650950,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase5-production-equivalent-containers",
  workflow_path: ".github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml",
  event: "pull_request",
  dependency_digest: "sha256:e4c2d6c263f4de4f0dee9beb0f688005295c96cb4e795d21fd92359489b1964d",
};

const CURRENT_PR_PHASE5_REQUALIFICATION_V1 = {
  evidence_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS_REQUAL_D0713268_INFLIGHT_OWNER_KEEPALIVE_V1",
  check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
  subject_sha: "d07132684bed574e304ea7099209285b4fe0efc2",
  base_sha: "7a9482104e0bbced906f48df220657f39da23b51",
  run_id: 35352230742,
  run_conclusion: "success",
  workflow_name: "mcft-cap-09-phase5-two-service-accelerated-24t",
  workflow_path: ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
  event: "pull_request",
  dependency_digest: "sha256:b41e59b68847d083747e0d43326a1a4cc15f9d9a4f90a74621773e45fe3d4052",
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i += 1; } else out[key] = true;
  }
  return out;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function changedPaths(base, head) {
  if (!base || !head) throw new Error("ALL_BLOCKERS_BASE_AND_HEAD_REQUIRED");
  const text = cp.execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: ROOT, encoding: "utf8" });
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function runDiagnostic(command, extraEnv = {}) {
  const result = cp.spawnSync(command, {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, ...extraEnv, MCFT_CAP09_ALL_BLOCKERS_CHILD: "1" },
  });
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  return {
    status: result.status === 0 ? "PASS" : "FAIL",
    exit_code: result.status,
    signal: result.signal || null,
    stdout_tail: stdout.slice(-4000),
    stderr_tail: stderr.slice(-4000),
  };
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function isAncestor(ancestor, descendant) {
  if (!/^[0-9a-f]{40}$/.test(String(ancestor || "")) || !/^[0-9a-f]{40}$/.test(String(descendant || ""))) return false;
  return cp.spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: ROOT, stdio: "ignore" }).status === 0;
}

function exactCommitParents(commitSha) {
  if (!/^[0-9a-f]{40}$/.test(String(commitSha || ""))) return [];
  try {
    const text = cp.execFileSync("git", ["show", "-s", "--format=%P", commitSha], { cwd: ROOT, encoding: "utf8" }).trim();
    return text ? text.split(/\s+/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function expectedRequalificationBinding(entry) {
  return sha256(JSON.stringify(REQUALIFICATION_BINDING_FIELDS.map((key) => entry?.[key] ?? null)));
}

function phase6RetirementActive(head) {
  const rel = PHASE6_RETIREMENT_AUTHORITY_PATH;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  let authority;
  try { authority = JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch { return false; }
  const status = String(authority?.status || "");
  const phase5 = String(authority?.phase5_closure_head || "");
  return status.startsWith("PHASE6_") && /^[0-9a-f]{40}$/.test(phase5) && isAncestor(phase5, head);
}

function fetchGithubRunSnapshot(runId) {
  const repository = String(process.env.GITHUB_REPOSITORY || "liyongshang44-max/GEOX").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return { status: "FAIL", reason_code: "PHASE5_REQUALIFICATION_GITHUB_REPOSITORY_INVALID" };
  }
  const url = `https://api.github.com/repos/${repository}/actions/runs/${runId}`;
  const args = [
    "-fsSL",
    "-H", "Accept: application/vnd.github+json",
    "-H", "X-GitHub-Api-Version: 2022-11-28",
    "-H", "User-Agent: geox-mcft-cap09-qcp",
  ];
  const token = String(process.env.GITHUB_TOKEN || "").trim();
  if (token) args.push("-H", `Authorization: Bearer ${token}`);
  args.push(url);
  let raw;
  try {
    raw = cp.execFileSync("curl", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    return {
      status: "FAIL",
      reason_code: "PHASE5_REQUALIFICATION_GITHUB_RUN_FETCH_FAILED",
      detail: String(error?.stderr || error?.message || error).slice(-2000),
    };
  }
  try {
    return { status: "PASS", run: JSON.parse(raw) };
  } catch {
    return { status: "FAIL", reason_code: "PHASE5_REQUALIFICATION_GITHUB_RUN_JSON_INVALID" };
  }
}

function validateExactRunAnchor(decision, head, base, anchor, reasonPrefix, options = {}) {
  const fetchResult = fetchGithubRunSnapshot(anchor.run_id);
  if (fetchResult.status !== "PASS") {
    return {
      status: "FAIL",
      reason_code: `${reasonPrefix}_GITHUB_RUN_FETCH_FAILED`,
      evidence_id: anchor.evidence_id,
      detail: fetchResult,
    };
  }
  const run = fetchResult.run;
  const liveBase = Array.isArray(run.pull_requests)
    ? run.pull_requests.map((pr) => pr?.base?.sha).find((value) => typeof value === "string") || null
    : null;
  const allowSuccessorBase = options.allowSuccessorBase === true;
  const mergeParents = allowSuccessorBase ? exactCommitParents(anchor.merge_commit_sha) : [];
  const checks = {
    check_id_match: decision.check_id === anchor.check_id,
    dependency_digest_match: decision.dependency_digest === anchor.dependency_digest,
    requested_base_match: allowSuccessorBase ? isAncestor(anchor.merge_commit_sha, base) : base === anchor.base_sha,
    subject_is_ancestor_of_head: isAncestor(anchor.subject_sha, head),
    run_id_match: run.id === anchor.run_id,
    run_success: run.status === "completed" && run.conclusion === anchor.run_conclusion,
    run_head_match: run.head_sha === anchor.subject_sha,
    run_base_match: allowSuccessorBase
      ? mergeParents.length === 2 && mergeParents[0] === anchor.base_sha && mergeParents[1] === anchor.final_head_sha
      : liveBase === anchor.base_sha,
    successor_run_head_to_final_head_match: !allowSuccessorBase || isAncestor(anchor.subject_sha, anchor.final_head_sha),
    successor_merge_commit_to_requested_base_match: !allowSuccessorBase || isAncestor(anchor.merge_commit_sha, base),
    run_event_match: run.event === anchor.event,
    run_workflow_name_match: run.name === anchor.workflow_name,
    run_workflow_path_match: run.path === anchor.workflow_path,
  };
  const valid = Object.values(checks).every(Boolean);
  return {
    status: valid ? "PASS" : "FAIL",
    reason_code: valid
      ? `${reasonPrefix}_EXACT_RUN_AND_DEPENDENCY_DIGEST_VALID`
      : `${reasonPrefix}_EXACT_RUN_OR_DEPENDENCY_DIGEST_INVALID`,
    evidence_id: anchor.evidence_id,
    run_id: anchor.run_id,
    subject_sha: anchor.subject_sha,
    dependency_digest: anchor.dependency_digest,
    checks,
  };
}


function gitJsonAt(ref, rel) {
  return JSON.parse(cp.execFileSync("git", ["show", `${ref}:${rel}`], {
    cwd: ROOT,
    encoding: "utf8",
  }));
}

function gitBlobAt(ref, rel) {
  try {
    return cp.execFileSync("git", ["rev-parse", `${ref}:${rel}`], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function jsonStableEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function t0GraduationPostClosureDelta(head) {
  const authority = T0_GRADUATION_CARRY_FORWARD_V1;
  let currentHead = null;
  let changed = [];
  try {
    currentHead = cp.execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    changed = cp.execFileSync(
      "git",
      ["diff", "--name-only", `${authority.closure_subject_sha}..${head}`],
      { cwd: ROOT, encoding: "utf8" },
    ).trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return {
      exact_checkout: false,
      changed_paths: [],
      forbidden_paths: ["GIT_DELTA_UNRESOLVABLE"],
    };
  }
  const allowed = new Set([
    AUTHORITY_PATH,
    REGISTRY_PATH,
    authority.preflight_path,
  ]);
  return {
    exact_checkout: currentHead === head,
    changed_paths: changed,
    forbidden_paths: changed.filter((rel) => !allowed.has(rel)),
  };
}

function validateAm19T0GraduationCarryForwardV1(decision, head, base, authority, registry) {
  const t0 = T0_GRADUATION_CARRY_FORWARD_V1;
  const anchor = t0.am19;
  const delta = t0GraduationPostClosureDelta(head);
  const currentQcp = authority;
  const t0Qcp = gitJsonAt(t0.closure_subject_sha, AUTHORITY_PATH);
  const t0Registry = gitJsonAt(t0.closure_subject_sha, REGISTRY_PATH);
  const contract = readJson(anchor.contract_path);
  const registration = readJson(anchor.registration_path);
  const currentCheck = (currentQcp.checks || []).find((row) => row.check_id === anchor.check_id);
  const t0Check = (t0Qcp.checks || []).find((row) => row.check_id === anchor.check_id);
  const currentResolver = currentQcp.dependency_resolvers?.[anchor.check_id];
  const t0Resolver = t0Qcp.dependency_resolvers?.[anchor.check_id];
  const currentLegacy = (registry.entries || []).find((row) => row.evidence_id === anchor.legacy_evidence_id);
  const t0Legacy = (t0Registry.entries || []).find((row) => row.evidence_id === anchor.legacy_evidence_id);

  const registrationInvocation = cp.spawnSync(
    process.execPath,
    [anchor.acceptance_path, "--require-qcp-registered"],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, MCFT_CAP09_ALL_BLOCKERS_CHILD: "1" },
    },
  );
  let registrationAcceptance = null;
  try {
    registrationAcceptance = JSON.parse(String(registrationInvocation.stdout || "").trim());
  } catch {
    registrationAcceptance = null;
  }

  const frozenRefs = [
    anchor.registration_path,
    anchor.acceptance_path,
    anchor.contract_path,
  ];
  const frozenRefChecks = frozenRefs.map((rel) => ({
    path: rel,
    t0_blob_sha: gitBlobAt(t0.closure_subject_sha, rel),
    current_blob_sha: gitBlobAt(head, rel),
  })).map((row) => ({ ...row, match: row.t0_blob_sha !== null && row.t0_blob_sha === row.current_blob_sha }));

  const expectedRegistrationNonEffects = [
    "runtime_mutated",
    "production_mutation",
    "blocker_semantics_modified",
    "qcp_semantics_modified",
    "closure_subject_mutated",
    "supersedes_github_lane",
  ];
  const registrationNonEffectsClear = expectedRegistrationNonEffects.every(
    (key) => registration.closure_delivery?.[key] === false,
  );

  const checks = {
    exact_checkout: delta.exact_checkout,
    check_id_match: decision.check_id === anchor.check_id,
    requalification_state: decision.status === "REQUALIFY",
    protected_main_base_match: base === t0.protected_main_base_sha,
    protected_main_precedes_qualification_subject:
      isAncestor(base, anchor.qualification_subject_sha),
    qualification_subject_precedes_t0_closure:
      isAncestor(anchor.qualification_subject_sha, t0.closure_subject_sha),
    t0_closure_precedes_current_head:
      isAncestor(t0.closure_subject_sha, head),
    dependency_digest_match:
      decision.dependency_digest === anchor.dependency_digest,
    contract_id_match:
      contract.contract_id === "MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1",
    contract_pilot_base_match:
      contract.pilot_base_sha === t0.protected_main_base_sha,
    contract_runtime_match:
      contract.frozen_runtime_sha === t0.frozen_runtime_sha,
    contract_closure_subject_match:
      contract.closure_semantic_subject_sha === anchor.closure_semantic_subject_sha,
    contract_dependency_digest_match:
      contract.closure_authoritative_dependency_digest === anchor.dependency_digest,
    registration_subject_match:
      registration.qualification?.qualification_subject_sha === anchor.qualification_subject_sha,
    registration_runtime_match:
      registration.qualification?.runtime_subject_sha === t0.frozen_runtime_sha,
    registration_13_of_13:
      registration.qualification?.fresh_historical_successor_13_of_13 === true,
    registration_verifier_1_pass:
      registration.manifest?.verifier_1_status === "PASS",
    registration_verifier_2_pass:
      registration.closure_delivery?.verifier_2_status === "PASS",
    registration_latest_fallback_forbidden:
      registration.manifest?.latest_run_fallback_used === false &&
      registration.closure_delivery?.latest_run_fallback_used === false,
    registration_non_effects_clear:
      registrationNonEffectsClear,
    qcp_resolver_unchanged_since_t0:
      jsonStableEqual(currentResolver, t0Resolver),
    qcp_check_semantics_unchanged_since_t0:
      jsonStableEqual(currentCheck, t0Check),
    legacy_registry_entry_preserved:
      Boolean(currentLegacy) && Boolean(t0Legacy) &&
      jsonStableEqual(currentLegacy, t0Legacy),
    verified_delivery_files_unchanged_since_t0:
      frozenRefChecks.every((row) => row.match),
    post_t0_delta_closure_control_only:
      delta.forbidden_paths.length === 0,
    registration_acceptance_exit_zero:
      registrationInvocation.status === 0,
    registration_acceptance_pass:
      registrationAcceptance?.status === "PASS",
    qcp_central_ownership_registered:
      registrationAcceptance?.qcp_central_ownership_registered === true,
    legacy_registry_boundary_preserved:
      registrationAcceptance?.legacy_registry_boundary_preserved === true,
    successor_not_inserted_into_legacy_registry:
      registrationAcceptance?.current_successor_inserted_into_legacy_registry === false,
  };

  const valid = Object.values(checks).every(Boolean);
  return {
    status: valid ? "PASS" : "FAIL",
    reason_code: valid
      ? "AM19_T0_VERIFIED_DELIVERY_GRADUATION_CARRY_FORWARD_VALID"
      : "AM19_T0_VERIFIED_DELIVERY_GRADUATION_CARRY_FORWARD_INVALID",
    evidence_id: registration.registration_id || null,
    subject_sha: anchor.qualification_subject_sha,
    dependency_digest: anchor.dependency_digest,
    t0_closure_subject_sha: t0.closure_subject_sha,
    checks,
    frozen_ref_checks: frozenRefChecks,
    post_t0_delta: delta,
    registration_acceptance: registrationAcceptance,
    registration_acceptance_exit_status: registrationInvocation.status,
    registration_acceptance_stderr: String(registrationInvocation.stderr || "").slice(-4000),
  };
}

function validatePhase5T0GraduationCarryForwardV1(decision, head, base, authority) {
  const t0 = T0_GRADUATION_CARRY_FORWARD_V1;
  const anchor = t0.phase5;
  const delta = t0GraduationPostClosureDelta(head);
  const currentQcp = authority;
  const t0Qcp = gitJsonAt(t0.closure_subject_sha, AUTHORITY_PATH);
  const qualificationQcp = gitJsonAt(anchor.qualification_subject_sha, AUTHORITY_PATH);
  const currentCheck = (currentQcp.checks || []).find((row) => row.check_id === anchor.check_id);
  const t0Check = (t0Qcp.checks || []).find((row) => row.check_id === anchor.check_id);
  const qualificationCheck = (qualificationQcp.checks || []).find((row) => row.check_id === anchor.check_id);
  const currentResolver = currentQcp.dependency_resolvers?.[anchor.check_id];
  const t0Resolver = t0Qcp.dependency_resolvers?.[anchor.check_id];
  const qualificationResolver = qualificationQcp.dependency_resolvers?.[anchor.check_id];
  const contract = readJson(anchor.contract_path);

  const phase5PathBlobChecks = (currentResolver?.paths || []).map((rel) => ({
    path: rel,
    t0_blob_sha: gitBlobAt(t0.closure_subject_sha, rel),
    current_blob_sha: gitBlobAt(head, rel),
  })).map((row) => ({ ...row, match: row.t0_blob_sha !== null && row.t0_blob_sha === row.current_blob_sha }));

  const durableRefs = [
    anchor.contract_path,
    anchor.proof_path,
    anchor.basis_path,
    anchor.checker_path,
  ];
  const durableRefChecks = durableRefs.map((rel) => ({
    path: rel,
    package_blob_sha: gitBlobAt(anchor.durable_package_anchor_sha, rel),
    current_blob_sha: gitBlobAt(head, rel),
  })).map((row) => ({ ...row, match: row.package_blob_sha !== null && row.package_blob_sha === row.current_blob_sha }));

  const contractNonEffectsClear = [
    "runtime_mutation",
    "production_database_mutation",
    "production_owner_activation",
    "provider_request",
    "formal_v5_arm",
    "a0",
    "o00_o23",
    "stage_1b_closure_claim",
    "mcft_cap09_completion_claim",
  ].every((key) => contract.non_effects?.[key] === false);

  const checks = {
    exact_checkout: delta.exact_checkout,
    check_id_match: decision.check_id === anchor.check_id,
    requalification_state: decision.status === "REQUALIFY",
    protected_main_base_match: base === t0.protected_main_base_sha,
    protected_main_precedes_qcp_base:
      isAncestor(base, t0.qcp_base_sha),
    qcp_base_precedes_qualification_subject:
      isAncestor(t0.qcp_base_sha, anchor.qualification_subject_sha),
    qualification_subject_precedes_package_anchor:
      isAncestor(anchor.qualification_subject_sha, anchor.durable_package_anchor_sha),
    package_anchor_precedes_t0_closure:
      isAncestor(anchor.durable_package_anchor_sha, t0.closure_subject_sha),
    t0_closure_precedes_current_head:
      isAncestor(t0.closure_subject_sha, head),
    dependency_digest_match:
      decision.dependency_digest === anchor.dependency_digest,
    contract_id_match:
      contract.contract_id === "MCFT_CAP09_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_DC9EA15_V1",
    contract_status_match:
      contract.status === "QUALIFIED_SUBJECT_SUCCESSOR_ADMISSION_CONTRACT",
    contract_subject_match:
      contract.qualification_subject_sha === anchor.qualification_subject_sha,
    contract_qcp_base_match:
      contract.qcp_base_sha === t0.qcp_base_sha,
    contract_runtime_match:
      contract.frozen_runtime_subject_sha === t0.frozen_runtime_sha,
    contract_dependency_digest_match:
      contract.phase5_dependency_digest === anchor.dependency_digest,
    historical_24t_not_reinterpreted:
      contract.supersession?.historical_24t_reinterpreted_for_new_semantics === false,
    current_resolver_matches_t0:
      jsonStableEqual(currentResolver, t0Resolver),
    current_resolver_matches_qualification_subject:
      jsonStableEqual(currentResolver, qualificationResolver),
    current_check_matches_t0:
      jsonStableEqual(currentCheck, t0Check),
    current_check_matches_qualification_subject:
      jsonStableEqual(currentCheck, qualificationCheck),
    phase5_governed_surface_unchanged_since_t0:
      phase5PathBlobChecks.length === 56 &&
      phase5PathBlobChecks.every((row) => row.match),
    durable_supersession_package_unchanged:
      durableRefChecks.every((row) => row.match),
    contract_non_effects_clear:
      contractNonEffectsClear,
    post_t0_delta_closure_control_only:
      delta.forbidden_paths.length === 0,
  };

  const valid = Object.values(checks).every(Boolean);
  return {
    status: valid ? "PASS" : "FAIL",
    reason_code: valid
      ? "PHASE5_T0_CAUSAL_TEMPORAL_SUPERSESSION_GRADUATION_CARRY_FORWARD_VALID"
      : "PHASE5_T0_CAUSAL_TEMPORAL_SUPERSESSION_GRADUATION_CARRY_FORWARD_INVALID",
    evidence_id: contract.contract_id || null,
    subject_sha: anchor.qualification_subject_sha,
    dependency_digest: anchor.dependency_digest,
    package_sha: anchor.durable_package_anchor_sha,
    t0_closure_subject_sha: t0.closure_subject_sha,
    checks,
    phase5_path_blob_checks: phase5PathBlobChecks,
    durable_ref_checks: durableRefChecks,
    post_t0_delta: delta,
  };
}

function validateRuntimeCutoverPhase5Requalification(decision, head, base) {
  return validateExactRunAnchor(
    decision,
    head,
    base,
    RUNTIME_CUTOVER_PHASE5_REQUALIFICATION_V1,
    "RUNTIME_CUTOVER_PHASE5",
  );
}

function validateProofBoundPhase3Requalification(decision, head, base) {
  return validateExactRunAnchor(
    decision,
    head,
    base,
    PROOF_BOUND_PHASE3_REQUALIFICATION_V1,
    "PROOF_BOUND_PHASE3",
  );
}

function validateProofBoundPhase5Requalification(decision, head, base) {
  return validateExactRunAnchor(
    decision,
    head,
    base,
    PROOF_BOUND_PHASE5_REQUALIFICATION_V1,
    "PROOF_BOUND_PHASE5",
  );
}

function validatePhase5CausalTemporalSupersessionV1(decision, head, base) {
  const anchor = Object.freeze({
    package_sha: "e74f4348cc0318bb1fd3b3345bce7fe6c9c9dba6",
    qualification_subject_sha: "dc9ea15a26c718594807fd0ac7158742518981b4",
    base_sha: "4ee4989fc4f40cc52a3819be282c1d192b58a9b2",
    frozen_runtime_sha: "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a",
    dependency_digest: "sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965",
    check_id: "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS",
    workflow_path: ".github/workflows/mcft-cap-09-phase5-two-service-accelerated-24t.yml",
    contract_id: "MCFT_CAP09_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_DC9EA15_V1",
    checker_path: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_V1.cjs",
  });

  const durablePaths = [
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE5-CAUSAL-TEMPORAL-SUPERSESSION-CONTRACT-V1.json",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
    "docs/digital_twin/mcft/cap_09/evidence/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-BASIS-ACCEPTANCE-DC9EA15-V1.json",
    "docs/digital_twin/mcft/cap_09/evidence/GEOX-MCFT-CAP-09-CAUSAL-REVISION-TEMPORAL-SEMANTICS-POSTGRES-PROOF-DC9EA15-V1.json",
    anchor.checker_path,
  ];

  const checks = {
    check_id_match:
      decision.check_id === anchor.check_id,

    applicability_required:
      decision.status === "REQUIRED",

    expected_required_reason:
      decision.reason_code === "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE",

    requested_base_match:
      base === anchor.base_sha,

    qualification_subject_is_ancestor:
      isAncestor(anchor.qualification_subject_sha, head),

    durable_package_is_ancestor:
      isAncestor(anchor.package_sha, head),

    dependency_digest_match:
      decision.dependency_digest === anchor.dependency_digest,

    workflow_path_match:
      decision.execution_workflow === anchor.workflow_path,

    phase5_dependency_delta_empty:
      Array.isArray(decision.changed_dependencies) &&
      decision.changed_dependencies.length === 0,
  };

  if (!Object.values(checks).every(Boolean)) {
    return {
      status: "FAIL",
      reason_code:
        "PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_PRECONDITION_INVALID",
      evidence_id: anchor.contract_id,
      subject_sha: anchor.qualification_subject_sha,
      dependency_digest: anchor.dependency_digest,
      package_sha: anchor.package_sha,
      checks,
      package_blob_checks: [],
      adjudication_checks: null,
      adjudication: null,
    };
  }

  const packageBlobChecks = durablePaths.map((rel) => {
    let anchored = null;
    let current = null;

    try {
      anchored = cp.execFileSync(
        "git",
        ["rev-parse", `${anchor.package_sha}:${rel}`],
        { cwd: ROOT, encoding: "utf8" },
      ).trim();

      current = cp.execFileSync(
        "git",
        ["rev-parse", `HEAD:${rel}`],
        { cwd: ROOT, encoding: "utf8" },
      ).trim();
    } catch {
      return {
        path: rel,
        anchored_blob_sha: anchored,
        current_blob_sha: current,
        match: false,
      };
    }

    return {
      path: rel,
      anchored_blob_sha: anchored,
      current_blob_sha: current,
      match: anchored === current,
    };
  });

  if (!packageBlobChecks.every((row) => row.match)) {
    return {
      status: "FAIL",
      reason_code:
        "PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_DURABLE_PACKAGE_DRIFT",
      evidence_id: anchor.contract_id,
      subject_sha: anchor.qualification_subject_sha,
      dependency_digest: anchor.dependency_digest,
      package_sha: anchor.package_sha,
      checks,
      package_blob_checks: packageBlobChecks,
      adjudication_checks: null,
      adjudication: null,
    };
  }

  const invocation = cp.spawnSync(
    process.execPath,
    [
      anchor.checker_path,
      "--base",
      base,
      "--head",
      head,
      "--dependency-digest",
      decision.dependency_digest,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        MCFT_CAP09_ALL_BLOCKERS_CHILD: "1",
      },
    },
  );

  let adjudication = null;

  try {
    adjudication = JSON.parse(
      String(invocation.stdout || "").trim(),
    );
  } catch {
    adjudication = null;
  }

  const expectedNonEffects = [
    "runtime_mutation",
    "production_database_mutation",
    "production_owner_activation",
    "provider_request",
    "formal_v5_arm",
    "a0",
    "o00_o23",
    "stage_1b_closure_claim",
    "mcft_cap09_completion_claim",
  ];

  const nonEffectsClear =
    adjudication &&
    expectedNonEffects.every(
      (key) => adjudication.non_effects?.[key] === false,
    );

  const adjudicationChecks = {
    checker_exit_zero:
      invocation.status === 0,

    checker_json_present:
      adjudication !== null,

    status_pass:
      adjudication?.status === "PASS",

    check_id_match:
      adjudication?.check_id === anchor.check_id,

    qualification_subject_match:
      adjudication?.qualification_subject_sha ===
      anchor.qualification_subject_sha,

    adjudicated_head_match:
      adjudication?.adjudicated_head_sha === head,

    base_match:
      adjudication?.qcp_base_sha === anchor.base_sha,

    frozen_runtime_match:
      adjudication?.frozen_runtime_subject_sha ===
      anchor.frozen_runtime_sha,

    dependency_digest_match:
      adjudication?.dependency_digest ===
      anchor.dependency_digest,

    exact_subject_proof:
      adjudication?.proof_subject_exact === true,

    real_postgres_temporal_proof:
      adjudication?.real_postgresql_causal_temporal_proof === true,

    old_24t_not_reinterpreted:
      adjudication?.historical_24t_reinterpreted === false,

    phase5_resolver_preserved:
      adjudication?.phase5_resolver_unchanged_from_subject === true,

    phase5_qcp_check_preserved:
      adjudication?.phase5_qcp_check_semantics_unchanged_from_subject === true,

    frozen_resolver_path_count:
      adjudication?.frozen_phase5_resolver_path_count === 56,

    frozen_difference_count:
      adjudication?.frozen_phase5_difference_count === 1,

    image_digest_set_preserved:
      adjudication?.qualification_image_digest_set_preserved === true,

    forbidden_successor_paths_empty:
      Array.isArray(
        adjudication?.forbidden_successor_changed_paths,
      ) &&
      adjudication.forbidden_successor_changed_paths.length === 0,

    non_effects_clear:
      nonEffectsClear,
  };

  const valid =
    Object.values(adjudicationChecks).every(Boolean);

  return {
    status: valid ? "PASS" : "FAIL",
    reason_code: valid
      ? "PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_VALID"
      : "PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_INVALID",
    evidence_id: anchor.contract_id,
    subject_sha: anchor.qualification_subject_sha,
    dependency_digest: anchor.dependency_digest,
    package_sha: anchor.package_sha,
    checks,
    package_blob_checks: packageBlobChecks,
    adjudication_checks: adjudicationChecks,
    adjudication,
    checker_exit_status: invocation.status,
    checker_stderr: String(invocation.stderr || ""),
  };
}

function resolveRequalificationEvidence(decision, authority, registry, stage, head) {
  const section = registry.requalification_evidence;
  if (!section || section.binding_strategy !== REQUALIFICATION_BINDING_STRATEGY) {
    return { status: "FAIL", reason_code: "REQUALIFICATION_EVIDENCE_REGISTRY_MISSING_OR_UNSUPPORTED", candidates: [] };
  }
  const governedPredecessors = section.durable_anchors?.rules?.governed_successor_predecessors;
  const governedPredecessorSet = Array.isArray(governedPredecessors) ? new Set(governedPredecessors) : null;
  const governedPredecessorsValid =
    Array.isArray(governedPredecessors) &&
    governedPredecessors.length > 0 &&
    governedPredecessorSet.size === governedPredecessors.length &&
    governedPredecessors.every((sha) => /^[0-9a-f]{40}$/.test(String(sha || ""))) &&
    governedPredecessorSet.has(authority.frozen_successor_subject_sha);
  if (!governedPredecessorsValid) {
    return { status: "FAIL", reason_code: "REQUALIFICATION_GOVERNED_PREDECESSOR_SET_INVALID", candidates: [] };
  }
  const anchors = new Map((section.durable_anchors?.entries || []).map((row) => [row.evidence_id, row]));
  const candidates = (section.entries || []).filter((entry) => entry.check_id === decision.check_id);
  const adjudications = candidates.map((entry) => {
    const anchor = anchors.get(entry.evidence_id);
    const snapshot = anchor?.run_snapshot || null;
    const checks = {
      evidence_class: entry.evidence_class === "IMMUTABLE_WORKFLOW_RUN",
      immutable: entry.immutable === true,
      run_success: entry.run_conclusion === "success",
      no_artifact_claim: entry.artifact_id === null && entry.artifact_digest === null,
      stage_match: entry.stage === stage,
      dependency_strategy_match: entry.dependency_digest_strategy === registry.dependency_digest_strategy,
      dependency_digest_match: entry.dependency_digest === decision.dependency_digest,
      dependency_subject_match: entry.dependency_subject_sha === entry.subject_sha,
      workflow_path_match: entry.workflow_path === decision.execution_workflow,
      binding_match: entry.immutable_binding_sha256 === expectedRequalificationBinding(entry),
      anchor_present: Boolean(anchor),
      anchor_run_match: anchor?.run_id === entry.run_id,
      anchor_head_match: snapshot?.head_sha === entry.subject_sha,
      anchor_base_match: governedPredecessorSet.has(snapshot?.base_sha),
      anchor_event_match: snapshot?.event === "pull_request",
      anchor_workflow_path_match: snapshot?.workflow_path === entry.workflow_path,
      anchor_workflow_name_match: snapshot?.workflow_name === entry.workflow_name,
      subject_is_ancestor_of_head: isAncestor(entry.subject_sha, head),
    };
    return { entry, checks, valid: Object.values(checks).every(Boolean) };
  });
  const valid = adjudications.filter((row) => row.valid);
  if (valid.length !== 1) {
    return {
      status: "FAIL",
      reason_code: valid.length === 0 ? "NO_VALID_REQUALIFICATION_EVIDENCE" : "AMBIGUOUS_REQUALIFICATION_EVIDENCE",
      candidates: adjudications.map((row) => ({ evidence_id: row.entry.evidence_id, checks: row.checks, valid: row.valid })),
    };
  }
  return {
    status: "PASS",
    reason_code: "DURABLE_REQUALIFICATION_EVIDENCE_AND_DEPENDENCY_DIGEST_VALID",
    evidence_id: valid[0].entry.evidence_id,
    run_id: valid[0].entry.run_id,
    subject_sha: valid[0].entry.subject_sha,
    dependency_digest: valid[0].entry.dependency_digest,
    candidates: adjudications.map((row) => ({ evidence_id: row.entry.evidence_id, checks: row.checks, valid: row.valid })),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const authority = readJson(AUTHORITY_PATH);
  const registry = readJson(REGISTRY_PATH);
  const registryById = new Map((registry.entries || []).map((entry) => [entry.evidence_id, entry]));
  const stage = args.stage || authority.default_stage;
  const changed = args["changed-paths-file"]
    ? fs.readFileSync(path.resolve(ROOT, args["changed-paths-file"]), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : changedPaths(args.base, args.head);

  const plan = planApplicability({
    root: ROOT,
    authority,
    registry,
    changedPaths: changed,
    stage,
    generation: args.generation || null,
    baseSha: args.base || null,
    headSha: args.head || null,
  });

  const results = [];
  const blockers = [];
  const phase6Active = phase6RetirementActive(args.head || "");
  const proofBoundAdmissions = authority.proof_bound_exact_base_admissions || [];
  const proofBoundAdmission = proofBoundAdmissions.length === 1 ? proofBoundAdmissions[0] : null;
  const proofBoundAdmissionActive =
    stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
    process.env.MCFT_CAP09_PROOF_BOUND_BASE_ADMITTED === "true" &&
    proofBoundAdmissions.length === 1 &&
    proofBoundAdmission?.base_sha === args.base &&
    proofBoundAdmission?.base_sha === String(process.env.CURRENT_MAIN_REANCHOR_PROOF_BOUND_SHA || "") &&
    proofBoundAdmission?.mode === "PROOF_BOUND_EXACT_BASE" &&
    proofBoundAdmission?.proof_acceptance === String(process.env.CURRENT_MAIN_REANCHOR_PROOF_ACCEPTANCE || "") &&
    proofBoundAdmission?.bare_sha_allowlist_admission_authorized === false &&
    proofBoundAdmission?.admission_requires_exact_lineage_and_overlap_proof === true &&
    isAncestor(args.base || "", args.head || "");
  const proofBoundBaselineActive =
    proofBoundAdmissionActive &&
    proofBoundAdmission?.baseline_qualification_carry_forward_authorized !== false;
  const proofBoundFreshRequalificationActive =
    proofBoundAdmissionActive &&
    proofBoundAdmission?.baseline_qualification_carry_forward_authorized === false;

  const successorChainAdmissionPath =
    "acceptance-output/MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json";
  let successorChainAdmission = null;
  try {
    if (fs.existsSync(path.join(ROOT, successorChainAdmissionPath))) {
      successorChainAdmission = readJson(successorChainAdmissionPath);
    }
  } catch {
    successorChainAdmission = null;
  }

  const successorChainAdmissionActive =
    stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
    process.env.MCFT_CAP09_SUCCESSOR_CHAIN_BASE_ADMITTED === "true" &&
    successorChainAdmission?.status === "PASS" &&
    successorChainAdmission?.acceptance_id ===
      "MCFT_CAP09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1" &&
    successorChainAdmission?.admitted_base_sha === args.base &&
    successorChainAdmission?.current_protected_main_sha === args.base &&
    successorChainAdmission?.current_protected_main_match === true &&
    successorChainAdmission?.first_parent_chain_complete === true &&
    successorChainAdmission?.merge_tree_equivalence_all === true &&
    successorChainAdmission?.candidate_to_merge_zero_delta_all === true &&
    successorChainAdmission?.admission_effect ===
      "QCP_EVALUATION_ENTRY_ONLY_CURRENT_QCP_STILL_REQUIRED" &&
    successorChainAdmission?.baseline_qualification_carry_forward_authorized === false &&
    successorChainAdmission?.historical_authority_promotion_authorized === false &&
    successorChainAdmission?.runtime_mutation === false &&
    successorChainAdmission?.production_runtime_start_authorized === false &&
    successorChainAdmission?.formal_v5_authorized === false;

  const proofBoundPreservedRequiredCheckIds = [];

  for (const error of plan.authority_errors || []) blockers.push({ blocker_class: "AUTHORITY_DEFINITION_FAILURE", check_id: null, detail: error });
  for (const unknownPath of plan.unknown_changed_paths) blockers.push({ blocker_class: "UNKNOWN_CHANGED_PATH", check_id: null, detail: unknownPath });
  for (const error of plan.resolver_errors) blockers.push({ blocker_class: "DEPENDENCY_RESOLVER_FAILURE", check_id: null, detail: error });

  for (const decision of plan.decisions) {
    let result;
    const common = {
      check_id: decision.check_id,
      applicability: decision.status,
      reason_code: decision.reason_code,
      dependency_digest: decision.dependency_digest ?? null,
      historical_dependency_digest: decision.historical_dependency_digest ?? null,
      dependency_digest_match: decision.dependency_digest_match ?? false,
      historical_evidence_ref: decision.historical_evidence_ref ?? null,
    };
    const protectedMainAdoptionBase = String(process.env.PROTECTED_MAIN_ADOPTION_PREDECESSOR_SHA || "");
    const postAdoptionEffectivenessBase = String(process.env.POST_ADOPTION_EFFECTIVENESS_PREDECESSOR_SHA || "");
    const postEffectivenessRuntimeCutoverBase = String(process.env.POST_EFFECTIVENESS_RUNTIME_CUTOVER_PREDECESSOR_SHA || "");
    const postRuntimeCutoverProductionLiveBase = String(process.env.POST_RUNTIME_CUTOVER_PRODUCTION_LIVE_PREDECESSOR_SHA || "");
    const postProductionLiveRollingRefreshBase = String(process.env.POST_PRODUCTION_LIVE_ROLLING_REFRESH_PREDECESSOR_SHA || "");
    const rollingStageResolverProtectedMainBase = String(process.env.ROLLING_STAGE_RESOLVER_PROTECTED_MAIN_PREDECESSOR_SHA || "");
    const effectiveCurrentCropRegistryResolverProtectedMainBase = String(process.env.EFFECTIVE_CURRENT_CROP_REGISTRY_RESOLVER_PROTECTED_MAIN_PREDECESSOR_SHA || "");
    const twinV2RuntimeSelectionAdoptionProtectedMainBase = String(process.env.TWIN_V2_RUNTIME_SELECTION_ADOPTION_PROTECTED_MAIN_PREDECESSOR_SHA || "");
    const twinV2RuntimeSelectionAdoptionMergeProtectedMainBase = String(process.env.TWIN_V2_RUNTIME_SELECTION_ADOPTION_MERGE_PROTECTED_MAIN_PREDECESSOR_SHA || "");
    const ownerCutoverRegistrySelectionProtectedMainBase = String(process.env.OWNER_CUTOVER_REGISTRY_SELECTION_PROTECTED_MAIN_PREDECESSOR_SHA || "");
    const currentProtectedMainRefreshPredecessorBase = String(process.env.CURRENT_PROTECTED_MAIN_REFRESH_PREDECESSOR_SHA || "");
    const currentCropContinuityRefreshMergeBase = String(process.env.CURRENT_CROP_CONTINUITY_REFRESH_MERGE_PREDECESSOR_SHA || "");
    const adoptionDurableRequalification =
      stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
      PROTECTED_MAIN_ADOPTION_DURABLE_REQUALIFICATION_CHECKS.has(decision.check_id) &&
      (
        (/^[0-9a-f]{40}$/.test(protectedMainAdoptionBase) && args.base === protectedMainAdoptionBase) ||
        (/^[0-9a-f]{40}$/.test(postAdoptionEffectivenessBase) && args.base === postAdoptionEffectivenessBase) ||
        (/^[0-9a-f]{40}$/.test(postEffectivenessRuntimeCutoverBase) && args.base === postEffectivenessRuntimeCutoverBase) ||
        (/^[0-9a-f]{40}$/.test(postRuntimeCutoverProductionLiveBase) && args.base === postRuntimeCutoverProductionLiveBase) ||
        (/^[0-9a-f]{40}$/.test(postProductionLiveRollingRefreshBase) && args.base === postProductionLiveRollingRefreshBase) ||
        (/^[0-9a-f]{40}$/.test(rollingStageResolverProtectedMainBase) && args.base === rollingStageResolverProtectedMainBase) ||
        (/^[0-9a-f]{40}$/.test(effectiveCurrentCropRegistryResolverProtectedMainBase) && args.base === effectiveCurrentCropRegistryResolverProtectedMainBase) ||
        (/^[0-9a-f]{40}$/.test(twinV2RuntimeSelectionAdoptionProtectedMainBase) && args.base === twinV2RuntimeSelectionAdoptionProtectedMainBase) ||
        (/^[0-9a-f]{40}$/.test(twinV2RuntimeSelectionAdoptionMergeProtectedMainBase) && args.base === twinV2RuntimeSelectionAdoptionMergeProtectedMainBase) ||
        (/^[0-9a-f]{40}$/.test(ownerCutoverRegistrySelectionProtectedMainBase) && args.base === ownerCutoverRegistrySelectionProtectedMainBase) ||
        (/^[0-9a-f]{40}$/.test(currentProtectedMainRefreshPredecessorBase) && args.base === currentProtectedMainRefreshPredecessorBase) ||
        (/^[0-9a-f]{40}$/.test(currentCropContinuityRefreshMergeBase) && args.base === currentCropContinuityRefreshMergeBase) ||
        proofBoundFreshRequalificationActive ||
        successorChainAdmissionActive
      );
    const proofBoundBaselineRequirementPreserved =
      proofBoundBaselineActive &&
      decision.status === "REQUIRED" &&
      decision.reason_code === "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE" &&
      Array.isArray(decision.changed_dependencies) &&
      decision.changed_dependencies.length === 0;
    const successorChainUnchangedPrivateStoreSelftest =
      successorChainAdmissionActive &&
      decision.check_id === "PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING" &&
      decision.status === "REQUIRED" &&
      decision.reason_code === "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE" &&
      Array.isArray(decision.changed_dependencies) &&
      decision.changed_dependencies.length === 0 &&
      decision.diagnostic_command ===
        "node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING_V1.cjs";
    if (decision.status === "NOT_APPLICABLE") {
      result = { ...common, execution: "NOT_APPLICABLE", status: "NOT_APPLICABLE" };
    } else if (decision.status === "CARRY_FORWARD") {
      const entry = registryById.get(decision.carry_forward_evidence_id);
      const valid = evidenceIsStructurallyValid(entry, authority, ROOT, registry) && entry.check_id === decision.check_id && decision.dependency_digest_match === true;
      result = {
        ...common,
        execution: "DURABLE_IMMUTABLE_EVIDENCE_AND_DEPENDENCY_DIGEST_VALIDATION",
        status: valid ? "PASS" : "FAIL",
        reason_code: valid ? "CARRY_FORWARD_EVIDENCE_AND_DEPENDENCY_DIGEST_VALID" : "CARRY_FORWARD_EVIDENCE_OR_DEPENDENCY_DIGEST_INVALID",
        evidence_id: decision.carry_forward_evidence_id,
      };
      if (!valid) blockers.push({ blocker_class: "INVALID_CARRY_FORWARD_EVIDENCE_OR_DIGEST", check_id: decision.check_id, detail: decision.carry_forward_evidence_id });
    } else if (proofBoundBaselineRequirementPreserved) {
      proofBoundPreservedRequiredCheckIds.push(decision.check_id);
      result = {
        ...common,
        execution: "PROOF_BOUND_ACCEPTED_BASELINE_PRESERVATION",
        status: "PASS",
        reason_code: "PROOF_BOUND_ACCEPTED_BASELINE_UNCHANGED_IN_PR",
        proof_bound_base_sha: args.base,
        proof_bound_admission_mode: proofBoundAdmission.mode,
        historical_requirement_preserved: true,
        qualification_rerun: false,
      };
    } else if (decision.status === "REQUALIFY" || decision.status === "REQUIRED") {
      if (successorChainUnchangedPrivateStoreSelftest) {
        const diagnosticCommand = `${decision.diagnostic_command} --selftest`;
        const diagnostic = runDiagnostic(diagnosticCommand);
        result = {
          ...common,
          execution: "SUCCESSOR_CHAIN_UNCHANGED_CURRENT_STATE_SELFTEST",
          status: diagnostic.status,
          reason_code: diagnostic.status === "PASS"
            ? "SUCCESSOR_CHAIN_UNCHANGED_CURRENT_STATE_SELFTEST_PASS"
            : "SUCCESSOR_CHAIN_UNCHANGED_CURRENT_STATE_SELFTEST_FAIL",
          diagnostic_command: diagnosticCommand,
          admitted_current_main_base_sha: args.base,
          candidate_dependency_delta_count: decision.changed_dependencies.length,
          qualification_rerun: true,
          baseline_qualification_carry_forward: false,
          diagnostic,
        };
        if (diagnostic.status !== "PASS") blockers.push({
          blocker_class: "DIAGNOSTIC_FAILURE",
          check_id: decision.check_id,
          detail: diagnostic,
        });
      } else if (phase6Active && decision.check_id === "EA5E2_RUNTIME_DEPENDENCY_GRAPH") {
        const diagnostic = runDiagnostic(`node ${PHASE6_OWNER_AUDITOR_PATH} enforce`);
        result = {
          ...common,
          execution: "PHASE6_GITHUB_PRODUCTION_EXECUTION_RETIREMENT_AUDIT",
          status: diagnostic.status,
          reason_code: diagnostic.status === "PASS"
            ? "PHASE6_RETIRED_EA5E2_PRODUCTION_GRAPH_ACCEPTED"
            : "PHASE6_RETIRED_EA5E2_PRODUCTION_GRAPH_AUDIT_FAIL",
          diagnostic_command: `node ${PHASE6_OWNER_AUDITOR_PATH} enforce`,
          diagnostic,
        };
        if (diagnostic.status !== "PASS") blockers.push({
          blocker_class: "PHASE6_GITHUB_PRODUCTION_EXECUTION_RETIREMENT_FAILURE",
          check_id: decision.check_id,
          detail: diagnostic,
        });
      } else if (
        decision.check_id === T0_GRADUATION_CARRY_FORWARD_V1.am19.check_id &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        successorChainAdmissionActive &&
        args.base === T0_GRADUATION_CARRY_FORWARD_V1.protected_main_base_sha &&
        isAncestor(
          T0_GRADUATION_CARRY_FORWARD_V1.closure_subject_sha,
          args.head || "",
        )
      ) {
        const evidence = validateAm19T0GraduationCarryForwardV1(
          decision,
          args.head || "",
          args.base || "",
          authority,
          registry,
        );
        result = {
          ...common,
          execution: "AM19_T0_VERIFIED_DELIVERY_GRADUATION_CARRY_FORWARD",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_dependency_digest: evidence.dependency_digest ?? null,
          t0_closure_subject_sha: evidence.t0_closure_subject_sha ?? null,
          t0_graduation_carry_forward: evidence,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_AM19_T0_GRADUATION_CARRY_FORWARD",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === T0_GRADUATION_CARRY_FORWARD_V1.phase5.check_id &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        successorChainAdmissionActive &&
        args.base === T0_GRADUATION_CARRY_FORWARD_V1.protected_main_base_sha &&
        isAncestor(
          T0_GRADUATION_CARRY_FORWARD_V1.closure_subject_sha,
          args.head || "",
        )
      ) {
        const evidence = validatePhase5T0GraduationCarryForwardV1(
          decision,
          args.head || "",
          args.base || "",
          authority,
        );
        result = {
          ...common,
          execution: "PHASE5_T0_CAUSAL_TEMPORAL_SUPERSESSION_GRADUATION_CARRY_FORWARD",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_dependency_digest: evidence.dependency_digest ?? null,
          evidence_package_sha: evidence.package_sha ?? null,
          t0_closure_subject_sha: evidence.t0_closure_subject_sha ?? null,
          t0_graduation_carry_forward: evidence,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_PHASE5_T0_GRADUATION_CARRY_FORWARD",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === PROOF_BOUND_PHASE3_REQUALIFICATION_V1.check_id &&
        proofBoundFreshRequalificationActive &&
        args.base === PROOF_BOUND_PHASE3_REQUALIFICATION_V1.base_sha
      ) {
        const evidence = validateProofBoundPhase3Requalification(decision, args.head || "", args.base || "");
        result = {
          ...common,
          execution: "PROOF_BOUND_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_checks: evidence.checks ?? null,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_OR_MISSING_PROOF_BOUND_PHASE3_REQUALIFICATION_EVIDENCE",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === PROOF_BOUND_PHASE5_REQUALIFICATION_V1.check_id &&
        proofBoundFreshRequalificationActive &&
        args.base === PROOF_BOUND_PHASE5_REQUALIFICATION_V1.base_sha
      ) {
        const evidence = validateProofBoundPhase5Requalification(decision, args.head || "", args.base || "");
        result = {
          ...common,
          execution: "PROOF_BOUND_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_checks: evidence.checks ?? null,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_OR_MISSING_PROOF_BOUND_PHASE5_REQUALIFICATION_EVIDENCE",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === CURRENT_PR_PHASE3_REQUALIFICATION_C12_V1.check_id &&
        successorChainAdmissionActive &&
        args.base === CURRENT_PR_PHASE3_REQUALIFICATION_C12_V1.base_sha &&
        isAncestor(CURRENT_PR_PHASE3_REQUALIFICATION_C12_V1.subject_sha, args.head || "")
      ) {
        const evidence = validateExactRunAnchor(
          decision,
          args.head || "",
          args.base || "",
          CURRENT_PR_PHASE3_REQUALIFICATION_C12_V1,
          "CURRENT_PR_PHASE3_C12",
        );
        result = {
          ...common,
          execution: "CURRENT_PR_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_checks: evidence.checks ?? null,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_OR_MISSING_CURRENT_PR_PHASE3_REQUALIFICATION_EVIDENCE",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === CURRENT_PR_PHASE5_REQUALIFICATION_C12_V1.check_id &&
        successorChainAdmissionActive &&
        args.base === CURRENT_PR_PHASE5_REQUALIFICATION_C12_V1.base_sha &&
        isAncestor(CURRENT_PR_PHASE5_REQUALIFICATION_C12_V1.subject_sha, args.head || "")
      ) {
        const evidence = validateExactRunAnchor(
          decision,
          args.head || "",
          args.base || "",
          CURRENT_PR_PHASE5_REQUALIFICATION_C12_V1,
          "CURRENT_PR_PHASE5_C12",
        );
        result = {
          ...common,
          execution: "CURRENT_PR_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_checks: evidence.checks ?? null,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_OR_MISSING_CURRENT_PR_PHASE5_REQUALIFICATION_EVIDENCE",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === CURRENT_PR_PHASE5_REQUALIFICATION_V1.check_id &&
        successorChainAdmissionActive &&
        args.base === CURRENT_PR_PHASE5_REQUALIFICATION_V1.base_sha &&
        isAncestor(CURRENT_PR_PHASE5_REQUALIFICATION_V1.subject_sha, args.head || "")
      ) {
        const evidence = validateExactRunAnchor(
          decision,
          args.head || "",
          args.base || "",
          CURRENT_PR_PHASE5_REQUALIFICATION_V1,
          "CURRENT_PR_PHASE5",
        );
        result = {
          ...common,
          execution: "CURRENT_PR_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_checks: evidence.checks ?? null,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_OR_MISSING_CURRENT_PR_PHASE5_REQUALIFICATION_EVIDENCE",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (
        decision.check_id === SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_V1.check_id &&
        successorChainAdmissionActive &&
        isAncestor(SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_V1.merge_commit_sha, args.base || "")
      ) {
        const fresh = resolveRequalificationEvidence(decision, authority, registry, stage, args.head || null);
        if (fresh.status === "PASS") {
          result = {
            ...common,
            execution: "DURABLE_REQUALIFICATION_EVIDENCE_SUCCESSOR_CHAIN_REFRESH",
            status: "PASS",
            reason_code: fresh.reason_code,
            evidence_id: fresh.evidence_id ?? null,
            evidence_run_id: fresh.run_id ?? null,
            evidence_subject_sha: fresh.subject_sha ?? null,
            evidence_adjudication: fresh.candidates,
            historical_successor_chain_fallback_used: false,
          };
        } else {
          const evidence = validateExactRunAnchor(
            decision,
            args.head || "",
            args.base || "",
            SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_V1,
            "SUCCESSOR_CHAIN_PHASE3",
            { allowSuccessorBase: true },
          );
          result = {
            ...common,
            execution: "SUCCESSOR_CHAIN_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
            status: evidence.status,
            reason_code: evidence.reason_code,
            evidence_id: evidence.evidence_id ?? null,
            evidence_run_id: evidence.run_id ?? null,
            evidence_subject_sha: evidence.subject_sha ?? null,
            evidence_checks: evidence.checks ?? null,
            fresh_durable_evidence_adjudication: fresh.candidates,
            historical_successor_chain_fallback_used: true,
          };
          if (evidence.status !== "PASS") blockers.push({
            blocker_class: "INVALID_OR_MISSING_SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_EVIDENCE",
            check_id: decision.check_id,
            detail: { historical_anchor: evidence, fresh_durable_evidence: fresh },
          });
        }
      } else if (
        decision.check_id === "PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS" &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "4ee4989fc4f40cc52a3819be282c1d192b58a9b2" &&
        isAncestor(
          "e74f4348cc0318bb1fd3b3345bce7fe6c9c9dba6",
          args.head || "",
        )
      ) {
        const evidence =
          validatePhase5CausalTemporalSupersessionV1(
            decision,
            args.head || "",
            args.base || "",
          );

        result = {
          ...common,
          execution:
            "PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_ADMISSION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_dependency_digest:
            evidence.dependency_digest ?? null,
          evidence_package_sha:
            evidence.package_sha ?? null,
          evidence_checks:
            evidence.checks ?? null,
          causal_temporal_supersession:
            evidence,
        };

        if (evidence.status !== "PASS") {
          blockers.push({
            blocker_class:
              "INVALID_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_ADMISSION",
            check_id: decision.check_id,
            detail: evidence,
          });
        }
      } else if (
        decision.check_id === SUCCESSOR_CHAIN_PHASE5_REQUALIFICATION_V1.check_id &&
        successorChainAdmissionActive &&
        isAncestor(SUCCESSOR_CHAIN_PHASE5_REQUALIFICATION_V1.merge_commit_sha, args.base || "")
      ) {
        const fresh = resolveRequalificationEvidence(decision, authority, registry, stage, args.head || null);
        if (fresh.status === "PASS") {
          result = {
            ...common,
            execution: "DURABLE_REQUALIFICATION_EVIDENCE_SUCCESSOR_CHAIN_REFRESH",
            status: "PASS",
            reason_code: fresh.reason_code,
            evidence_id: fresh.evidence_id ?? null,
            evidence_run_id: fresh.run_id ?? null,
            evidence_subject_sha: fresh.subject_sha ?? null,
            evidence_adjudication: fresh.candidates,
            historical_successor_chain_fallback_used: false,
          };
        } else {
          const evidence = validateExactRunAnchor(
            decision,
            args.head || "",
            args.base || "",
            SUCCESSOR_CHAIN_PHASE5_REQUALIFICATION_V1,
            "SUCCESSOR_CHAIN_PHASE5",
            { allowSuccessorBase: true },
          );
          result = {
            ...common,
            execution: "SUCCESSOR_CHAIN_EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
            status: evidence.status,
            reason_code: evidence.reason_code,
            evidence_id: evidence.evidence_id ?? null,
            evidence_run_id: evidence.run_id ?? null,
            evidence_subject_sha: evidence.subject_sha ?? null,
            evidence_checks: evidence.checks ?? null,
            fresh_durable_evidence_adjudication: fresh.candidates,
            historical_successor_chain_fallback_used: true,
          };
          if (evidence.status !== "PASS") blockers.push({
            blocker_class: "INVALID_OR_MISSING_SUCCESSOR_CHAIN_PHASE5_REQUALIFICATION_EVIDENCE",
            check_id: decision.check_id,
            detail: { historical_anchor: evidence, fresh_durable_evidence: fresh },
          });
        }
      } else if (
        decision.check_id === RUNTIME_CUTOVER_PHASE5_REQUALIFICATION_V1.check_id &&
        args.base === RUNTIME_CUTOVER_PHASE5_REQUALIFICATION_V1.base_sha
      ) {
        const evidence = validateRuntimeCutoverPhase5Requalification(decision, args.head || "", args.base || "");
        result = {
          ...common,
          execution: "EXACT_WORKFLOW_RUN_AND_DEPENDENCY_DIGEST_VALIDATION",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_checks: evidence.checks ?? null,
        };
        if (evidence.status !== "PASS") blockers.push({
          blocker_class: "INVALID_OR_MISSING_RUNTIME_CUTOVER_PHASE5_REQUALIFICATION_EVIDENCE",
          check_id: decision.check_id,
          detail: evidence,
        });
      } else if (decision.diagnostic_command && !adoptionDurableRequalification) {
        const durableBeforeDiagnostic =
          PROTECTED_MAIN_ADOPTION_DURABLE_REQUALIFICATION_CHECKS.has(
            decision.check_id,
          )
            ? resolveRequalificationEvidence(
                decision,
                authority,
                registry,
                stage,
                args.head || null,
              )
            : null;

        if (durableBeforeDiagnostic?.status === "PASS") {
          result = {
            ...common,
            execution:
              "DURABLE_REQUALIFICATION_EVIDENCE_BEFORE_HISTORICAL_DIAGNOSTIC",
            status: "PASS",
            reason_code: durableBeforeDiagnostic.reason_code,
            evidence_id:
              durableBeforeDiagnostic.evidence_id ?? null,
            evidence_run_id:
              durableBeforeDiagnostic.run_id ?? null,
            evidence_subject_sha:
              durableBeforeDiagnostic.subject_sha ?? null,
            evidence_adjudication:
              durableBeforeDiagnostic.candidates,
            historical_diagnostic_skipped: true,
          };
        } else {
          const diagnosticEnv =
            decision.check_id ===
            "TWIN_V2_ROLLING_STAGE_AUTHORITY_RESOLVER_SEAM"
              ? {
                  GEOX_MCFT_CAP09_CURRENT_DELTA_BASE_SHA:
                    args.base || "",
                }
              : {};

          if (decision.check_id === "T4R1_CURRENT_CROP_ROLLING_REFRESH") {

            diagnosticEnv.MCFT_CAP09_CURRENT_CROP_BASE_SHA = args.base || "";

            diagnosticEnv.MCFT_CAP09_CURRENT_CROP_HEAD_SHA = args.head || "";

          }

          if (decision.check_id === "FORMAL_V5_H6_SUCCESSOR_SEAM") {

            diagnosticEnv.H6_SUCCESSOR_BASE_SHA = args.base || "";

          }

          const diagnostic = runDiagnostic(
            decision.diagnostic_command,
            diagnosticEnv,
          );

          result = {
            ...common,
            execution: "DIAGNOSTIC_COMMAND",
            status: diagnostic.status,
            reason_code:
              diagnostic.status === "PASS"
                ? "DIAGNOSTIC_PASS"
                : "DIAGNOSTIC_FAIL",
            diagnostic_command:
              decision.diagnostic_command,
            diagnostic,
            durable_requalification_precheck:
              durableBeforeDiagnostic,
          };

          if (diagnostic.status !== "PASS") {
            blockers.push({
              blocker_class: "DIAGNOSTIC_FAILURE",
              check_id: decision.check_id,
              detail: diagnostic,
            });
          }
        }
      } else {
        const evidence = resolveRequalificationEvidence(decision, authority, registry, stage, args.head || null);
        result = {
          ...common,
          execution: "DURABLE_REQUALIFICATION_EVIDENCE",
          status: evidence.status,
          reason_code: evidence.reason_code,
          evidence_id: evidence.evidence_id ?? null,
          evidence_run_id: evidence.run_id ?? null,
          evidence_subject_sha: evidence.subject_sha ?? null,
          evidence_adjudication: evidence.candidates,
        };
        if (evidence.status !== "PASS") {
          blockers.push({
            blocker_class: decision.status === "REQUIRED" ? "UNRESOLVED_REQUIRED_CHECK" : "INVALID_OR_MISSING_REQUALIFICATION_EVIDENCE",
            check_id: decision.check_id,
            detail: evidence,
          });
        }
      }
    } else {
      result = { ...common, execution: "FAIL_CLOSED", status: "FAIL" };
      blockers.push({ blocker_class: `APPLICABILITY_${decision.status}`, check_id: decision.check_id, detail: decision.reason_code });
    }
    results.push(result);
  }

  const counts = {
    total_checks: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    not_applicable: results.filter((r) => r.status === "NOT_APPLICABLE").length,
    carry_forward: plan.decisions.filter((d) => d.status === "CARRY_FORWARD").length,
    required: plan.decisions.filter((d) => d.status === "REQUIRED").length,
    requalify: plan.decisions.filter((d) => d.status === "REQUALIFY").length,
    proof_bound_preserved_required: proofBoundPreservedRequiredCheckIds.length,
    unknown: plan.decisions.filter((d) => d.status === "UNKNOWN").length,
    forbidden: plan.decisions.filter((d) => d.status === "FORBIDDEN").length,
    authority_errors: (plan.authority_errors || []).length,
    unknown_changed_paths: plan.unknown_changed_paths.length,
    blocker_count: blockers.length,
  };

  const output = {
    preflight_id: "MCFT_CAP09_ALL_BLOCKERS_PREFLIGHT_V1",
    status: blockers.length === 0 ? "PASS" : "FAIL",
    stage,
    generation: plan.generation,
    generation_context: plan.generation_context,
    base_sha: args.base || null,
    head_sha: args.head || null,
    planner_status: plan.status,
    counts,
    authority_errors: plan.authority_errors || [],
    unknown_changed_paths: plan.unknown_changed_paths,
    results,
    blockers,
    proof_bound_baseline_preservation: {
      active: proofBoundBaselineActive,
      base_sha: proofBoundBaselineActive ? args.base : null,
      admission_mode: proofBoundBaselineActive ? proofBoundAdmission.mode : null,
      preserved_required_check_ids: [...proofBoundPreservedRequiredCheckIds].sort(),
      preserved_required_count: proofBoundPreservedRequiredCheckIds.length,
      qualification_rerun: false,
    },
    non_fail_fast: true,
    non_effects: { ...authority.non_effects },
  };

  const outPath = path.resolve(ROOT, args.out || DEFAULT_OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  if (output.status !== "PASS") process.exitCode = 1;
}

module.exports = {
  resolveRequalificationEvidence,
  expectedRequalificationBinding,
  validateExactRunAnchor,
};

if (require.main === module) main();
