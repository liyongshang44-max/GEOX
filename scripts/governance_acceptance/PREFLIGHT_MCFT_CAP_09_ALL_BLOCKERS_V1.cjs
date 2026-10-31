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
  buildImportClosure,
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

function runDiagnostic(command, extraEnv = {}, checkId = "UNATTRIBUTED") {
  extraEnv = { ...extraEnv, MCFT_CAP09_QCP_CHECK_ID: checkId };
  const tracePath = process.env.MCFT_CAP09_QCP_TRACE_PATH;
  const trace = (event, details = {}) => {
    if (!tracePath) return;
    fs.appendFileSync(tracePath, JSON.stringify({
      event, check_id: checkId, command, caller: "PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.runDiagnostic",
      cwd: ROOT, child_flag: "1", at: new Date().toISOString(), ...details,
    }) + String.fromCharCode(10));
  };
  trace("DIAGNOSTIC_DISPATCH");

  // Reject self-referential registry diagnostics before shell spawning.
  // Nested QCP calls are not independent acceptance evidence.
  const normalizedCommand = String(command || "").trim().replaceAll(String.fromCharCode(92), "/");
  const qcpEntrypoint = "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs";
  const commandParts = normalizedCommand.split(" ").filter(Boolean);
  if (["node", "node.exe"].includes((commandParts[0] || "").toLowerCase()) &&
      commandParts[1] === qcpEntrypoint) {
    trace("DIAGNOSTIC_REJECT_SELF");
    return {status:"FAIL",exit_code:1,stdout_tail:"",
      stderr_tail:"QCP_RECURSIVE_DIAGNOSTIC_FORBIDDEN",execute_authorized:false};
  }
  if (command === "node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_LOCAL_CUTOVER_EXACT_SCOPE_V1.cjs") {
    try {
      const proof=require("./REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs").verifyAdoptedLocalCutoverScopeDiagnostic();
      return {status:"PASS",exit_code:0,stdout_tail:JSON.stringify(proof),stderr_tail:"",historical_subject_only:true,execute_authorized:false};
    } catch (error) {
      return {status:"FAIL",exit_code:1,stdout_tail:"",stderr_tail:String(error.stack||error).slice(-4000),historical_subject_only:true,execute_authorized:false};
    }
  }

  const cutoverManifest = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-LOCAL-CUTOVER-EXACT-SCOPE-CANDIDATE-20261011-V1.json");
  if (fs.existsSync(cutoverManifest) &&
      cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim() !==
      cp.execFileSync("git", ["rev-parse", "origin/main"], { cwd: ROOT, encoding: "utf8" }).trim()) {
    const adopted = require("./REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs");
    if (adopted.isAdoptedMainLegacyDiagnostic(command)) {
      trace("HISTORICAL_ADOPTED_MAIN_START");
      return adopted.runAdoptedMainLegacyDiagnostic(command, extraEnv);
    }
  }
  const stageVerifier = path.join(ROOT, "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs");
  if (fs.existsSync(stageVerifier)) {
    const stage = require("./VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs");
    if (stage.isFrozenDiagnosticCommand(command)) {
      const manifest = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-LOCAL-CUTOVER-EXACT-SCOPE-CANDIDATE-20261011-V1.json");
      if (fs.existsSync(manifest) && cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim() !== cp.execFileSync("git", ["rev-parse", "origin/main"], { cwd: ROOT, encoding: "utf8" }).trim())
        { trace("HISTORICAL_CUTOVER_START"); return require("./REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs").runHistoricalDiagnosticForCutoverCandidate(command, extraEnv); }
      trace("HISTORICAL_STAGE_START");
      return stage.runHistoricalDiagnostic(command, extraEnv);
    }
  }
  const result = cp.spawnSync(command, {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...extraEnv, MCFT_CAP09_ALL_BLOCKERS_CHILD: "1" },
  });
  trace("DIAGNOSTIC_END", { exit_code: result.status, signal: result.signal || null, error: result.error ? String(result.error) : null });
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

// A successor-chain proof admits QCP evaluation only. Each closed T0 check
// still needs its own unchanged resolver, check contract, complete file surface,
// dependency digest and durable evidence. This never preserves other checks.
function t0SuccessorDependencyDelta(head, base, authority, checkId) {
  const t0 = T0_GRADUATION_CARRY_FORWARD_V1;
  const resolver = authority.dependency_resolvers?.[checkId];
  let paths = [], missing = [];
  if (resolver?.kind === "EXACT_PATH_SET") {
    paths = resolver.paths || [];
  } else if (resolver?.kind === "IMPORT_CLOSURE") {
    const closure = buildImportClosure(ROOT, resolver.roots || []);
    paths = [...new Set([...closure.paths, ...(resolver.additional_exact_paths || [])])].sort();
    missing = closure.missing;
  } else {
    missing = ["UNSUPPORTED_T0_DEPENDENCY_RESOLVER"];
  }
  const fileChecks = paths.map((rel) => ({
    path: rel,
    closure_blob_sha: gitBlobAt(t0.closure_subject_sha, rel),
    current_blob_sha: gitBlobAt(head, rel),
    worktree_matches_head: (() => {
      try {
        const committed = cp.execFileSync("git", ["show", `${head}:${rel}`], { cwd: ROOT });
        return committed.equals(fs.readFileSync(path.join(ROOT, rel)));
      } catch { return false; }
    })(),
  })).map((row) => ({ ...row, match: row.closure_blob_sha !== null &&
    row.closure_blob_sha === row.current_blob_sha && row.worktree_matches_head }));
  let exactCheckout = false;
  try { exactCheckout = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim() === head; } catch {}
  return {
    mode: "T0_CHECK_SCOPED_DEPENDENCY_PRESERVATION",
    exact_checkout: exactCheckout,
    base_descends_from_t0: isAncestor(t0.closure_subject_sha, base),
    base_precedes_head: isAncestor(base, head),
    path_count: fileChecks.length,
    file_checks: fileChecks,
    missing_paths: missing,
    forbidden_paths: [...missing, ...fileChecks.filter((row) => !row.match).map((row) => row.path)],
  };
}

function validateAm19T0GraduationCarryForwardV1(decision, head, base, authority, registry, successorDependencyScope = false) {
  const t0 = T0_GRADUATION_CARRY_FORWARD_V1;
  const anchor = t0.am19;
  const delta = successorDependencyScope
    ? t0SuccessorDependencyDelta(head, base, authority, anchor.check_id)
    : t0GraduationPostClosureDelta(head);
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

  const registrationInvocation = registry.frozen_v13_requalification_v1
    ? { status: 0, stdout: JSON.stringify((fs.existsSync(path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-LOCAL-CUTOVER-EXACT-SCOPE-CANDIDATE-20261011-V1.json")) && cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim() !== cp.execFileSync("git", ["rev-parse", "origin/main"], { cwd: ROOT, encoding: "utf8" }).trim()) ? require("./REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs").replayAdoptedHistoryForCutoverCandidate() : (fs.existsSync(path.join(ROOT, "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs")) ? require("./VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs").replayHistoricalRegistration() : require("./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs").replayHistoricalRegistration())) }
    : cp.spawnSync(
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
    requalification_state: decision.status === "REQUALIFY" ||
      (successorDependencyScope && decision.status === "REQUIRED" &&
       decision.reason_code === "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE"),
    protected_main_base_match: successorDependencyScope
      ? delta.base_descends_from_t0 && delta.base_precedes_head
      : base === t0.protected_main_base_sha,
    protected_main_precedes_qualification_subject:
      isAncestor(t0.protected_main_base_sha, anchor.qualification_subject_sha),
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
    ...(successorDependencyScope ? {
      post_t0_complete_check_surface_preserved:
        delta.path_count > 0 && delta.forbidden_paths.length === 0,
    } : {
      post_t0_delta_closure_control_only: delta.forbidden_paths.length === 0,
    }),
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

function validatePhase5T0GraduationCarryForwardV1(decision, head, base, authority, successorDependencyScope = false) {
  const t0 = T0_GRADUATION_CARRY_FORWARD_V1;
  const anchor = t0.phase5;
  const delta = successorDependencyScope
    ? t0SuccessorDependencyDelta(head, base, authority, anchor.check_id)
    : t0GraduationPostClosureDelta(head);
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
    requalification_state: decision.status === "REQUALIFY" ||
      (successorDependencyScope && decision.status === "REQUIRED" &&
       decision.reason_code === "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE"),
    protected_main_base_match: successorDependencyScope
      ? delta.base_descends_from_t0 && delta.base_precedes_head
      : base === t0.protected_main_base_sha,
    protected_main_precedes_qcp_base:
      isAncestor(t0.protected_main_base_sha, t0.qcp_base_sha),
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
    ...(successorDependencyScope ? {
      post_t0_complete_check_surface_preserved:
        delta.path_count > 0 && delta.forbidden_paths.length === 0,
    } : {
      post_t0_delta_closure_control_only: delta.forbidden_paths.length === 0,
    }),
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

function resolveRequalificationEvidence(decision, authority, registry, stage, head, base = null) {
  // The current-source Phase3 has a different exact dependency digest from
  // historical 24cd4b59. For this precise owner-approved successor subject,
  // require its independent native #3743 source/CI/real-PG/Artifact proof.
  // Never treat the old frozen digest or old Run as valid. A missing/malformed
  // current proof must FAIL, not silently enter historical fallback.
  if (
    decision?.check_id === "PHASE3_EVIDENCE_RUNTIME_FOUNDATION" &&
    stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
    base === "63dc3382f879781c604a852c7d1b28af9b0dd9f" &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_EVENT_NAME === "pull_request"
  ) {
    const fresh = require("./VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs")
      .verifyCurrentPhase3({decision,stage,head,base});
    return {
      status:fresh?.status === "PASS" ? "PASS" : "FAIL",
      reason_code:fresh?.reason_code ?? "HOLD_CURRENT_PHASE3_PROOF_MISSING",
      evidence_id:fresh?.evidence_id ?? null,
      run_id:fresh?.native?.qualification_run ?? null,
      subject_sha:fresh?.source_subject_sha ?? null,
      dependency_digest:fresh?.dependency_digest ?? null,
      candidates:[],
      current_source_only:true,
      historical_successor_chain_digest_still_invalid:true,
      original_formal_six_stages:0,
      permit_authorized:false,
      physical_admission_authorized:false
    };
  }
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
  // Specific post-#3692 adopted-main successor: prove immutable ancestry and
  // historical exact candidate scope. Do not extend the generic predecessor
  // allowlist or rebind any older successful workflow run.
  let adopted3692ProofValid = false;
  if (candidates.some((entry) => anchors.get(entry.evidence_id)?.run_snapshot?.base_sha === "3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358")) {
    try {
      const proof = require("./REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs")
        .verifyAdoptedLocalCutoverScopeDiagnostic();
      adopted3692ProofValid = proof.status === "PASS"
        && proof.historical_candidate_subject_sha === "3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358"
        && proof.historical_candidate_base_sha === "5945e459edb212da39b9fe107f87cc07782dd93c"
        && isAncestor("3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358", head);
    } catch { adopted3692ProofValid = false; }
  }
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
      anchor_base_match: governedPredecessorSet.has(snapshot?.base_sha)
        || (snapshot?.base_sha === "3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358" && adopted3692ProofValid)
        || (
          // Exact one-run successor to the verified protected main, not a
          // general addition to governed_successor_predecessors.
          entry.evidence_id === "PHASE2_EVIDENCE_PROVIDER_MODULES_REQUAL_9E4E8132_DEDICATED_PG_V1"
          && entry.check_id === "PHASE2_EVIDENCE_PROVIDER_MODULES"
          && entry.run_id === 38281449457
          && entry.subject_sha === "9e4e8132628f2581cbac025f81f7342027660631"
          && entry.workflow_path === ".github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml"
          && snapshot?.base_sha === "adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a"
          && snapshot?.head_sha === entry.subject_sha
          && isAncestor(snapshot.base_sha, entry.subject_sha)
          && isAncestor(snapshot.base_sha, head)
          && adopted3692ProofValid
        ),
      anchor_event_match: snapshot?.event === "pull_request",
      anchor_workflow_path_match: snapshot?.workflow_path === entry.workflow_path,
      anchor_workflow_name_match: snapshot?.workflow_name === entry.workflow_name,
      subject_is_ancestor_of_head: isAncestor(entry.subject_sha, head),
    };
    return { entry, checks, valid: Object.values(checks).every(Boolean) };
  });
  // Current-base, repository-owner-directed source qualification is distinct
  // from the old Frozen108 zero-drift check. Strict exact-head GitHub-native
  // source and isolated PG/S3 receipts are required for each of five checks.
  // The historical frozen requirement stays unchanged in the QCP registry.
  if (stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
      base === "63dc3382f879781c604a852c7d1b28af9b0dd9f4" &&
      process.env.GITHUB_ACTIONS === "true" &&
      process.env.GITHUB_EVENT_NAME === "pull_request" &&
      fs.existsSync(path.join(ROOT,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs"))) {
    const currentComposer = require("./VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs")
      .verifyCurrentComposer({decision,stage,head,base});
    if (currentComposer !== null) return currentComposer;
  }
  // The DA9 isolated-retention semantic successor never inherits the zero-delta
  // 108-file historical Frozen V13 assertion. Six precisely named checks
  // require independently signed, exact-head evidence; pending means HOLD.
  // No existing legacy check is reclassified as PASS by this path.
  // Distinct new-source proof: six original Ed25519 operator signatures remain
  // bound to #3731's exact Composer blob, NOT the integration merge SHA.
  // This branch is narrowly gated by the signed source+governance two-parent
  // ancestry, explicit current PR base, all six artifact hashes and public-key
  // signature verification. If the successor proof exists but is invalid,
  // return FAIL: never fall back to the historical Frozen zero-delta evidence.
  // Unmatched historic subjects continue into the unchanged legacy verifier.
  const v2SuccessorPath = path.join(ROOT, "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
  if (fs.existsSync(v2SuccessorPath)) {
    const v2 = require("./VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
    if (v2.required.includes(decision.check_id)) {
      const currentV2 = v2.verifyRegisteredEvidence({ decision, stage, head, base });
      if (currentV2 !== null) return currentV2;
    }
  }
  const da9SemanticVerifier = path.join(ROOT, "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs");
  if (fs.existsSync(da9SemanticVerifier)) {
    const successor = require("./VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs");
    if (successor.required.includes(decision.check_id)) {
      return successor.verifyRegisteredEvidence({decision,stage,head});
    }
  }
  const frozenSection = registry.frozen_v13_requalification_v1;
  if (frozenSection && fs.existsSync(path.join(ROOT, "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs"))) {
    const fresh = require("./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs").resolveFreshEvidence(decision, frozenSection, stage, head);
    if (fresh.status === "PASS") return fresh;
    if (fresh.reason_code !== "NO_VALID_REQUALIFICATION_EVIDENCE") return fresh;
  }
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
  if (process.env.MCFT_CAP09_ALL_BLOCKERS_CHILD === "1") {
    throw new Error("QCP_RECURSIVE_INVOCATION_FORBIDDEN");
  }
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes("--self-audit")) {
    const registered = readJson(AUTHORITY_PATH).checks || [];
    const forbidden = registered.filter((entry) =>
      typeof entry.diagnostic_command === "string" &&
      entry.diagnostic_command.replaceAll(String.fromCharCode(92), "/").includes(
        "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"));
    const audit = {
      audit: "QCP_REGISTERED_DIAGNOSTIC_SELF_CALL_V1",
      checked: registered.length,
      forbidden: forbidden.map((x) => ({ check_id: x.check_id, command: x.diagnostic_command })),
      status: forbidden.length ? "FAIL" : "PASS",
    };
    process.stdout.write(JSON.stringify(audit) + "\n");
    if (forbidden.length) process.exitCode = 1;
    return;
  }
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

  // #3749: Bound successor-source qualification of the previously accepted
  // #3748 post-merge MAIN. Historical frozen diagnostics are NEVER run against
  // an unrelated PR head. This branch requires GitHub-native #3748 QCP/CI,
  // original six signed source review, unmodified scientific/historic blobs,
  // and the current exact Host / PostgreSQL preconsume negative tests.
  // QCP technical applicability is NOT signed Adoption or a Permit grant.
  // Post-#3749 R4285 signed-evidence Host prerequisite only:
  // the new exact five-path review has no scientific runtime, producer,
  // Stage3 body, or prior Permit mutation. Native #3749 CI/QCP and original
  // immutable source blobs remain the required inherited technical basis.
  // #3751: a new test-only Native Adoption source changes QCP metadata, not
  // historical scientific, DA9, Frozen V13, Stage3 or Permit code. Verify
  // every changed path and prior native main before recording N/A for those
  // historic PR-bound diagnostics. No signature or execution is inherited.
  const R4285_NATIVE_BASE="16205320c30365ff81b305fb7490029912e09a18";
  const R4285_NATIVE_CHECK="CAP09_R4285_NATIVE_ADOPTION_CONSUMER_SOURCE_ONLY_V1";
  let r4285NativeProof=null;
  function verifyR4285NativeSource(){
    if(r4285NativeProof)return r4285NativeProof;
    const assert=require("node:assert/strict");
    const git=(...xs)=>cp.execFileSync("git",xs,{cwd:ROOT,encoding:"utf8",timeout:20000,maxBuffer:2097152}).trim();
    const fail=e=>({status:"FAIL",reason_code:"HOLD_R4285_NATIVE_SOURCE:"+String(e.message||e).slice(0,260),permit:false});
    try{
      assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
      assert.equal(args.base,R4285_NATIVE_BASE,"R4285_NATIVE_EXACT_BASE");
      assert.equal(git("rev-parse","HEAD"),args.head,"R4285_NATIVE_EXACT_HEAD");
      assert.equal(git("merge-base",args.base,args.head),args.base,"R4285_NATIVE_NOT_DESCENDANT");
      const expected=[".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.test.cjs","scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.test.cjs","scripts/cap09_adoption_v1/MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs","scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"];
      const delta=git("diff","--name-only",args.base,args.head).split("\n").filter(Boolean).sort();
      assert.deepEqual(delta,expected,"R4285_NATIVE_UNCLASSIFIED_SOURCE_DELTA");
      const qrel="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",old=JSON.parse(git("show",args.base+":"+qrel));
      assert.equal(old.checks.length,66,"R4285_NATIVE_BASE_QCP66");
      assert.equal(authority.checks.length,67,"R4285_NATIVE_CURRENT_QCP67");
      assert.deepEqual(authority.checks.slice(0,66),old.checks,"R4285_NATIVE_OLD_QCP66_CHANGED");
      assert.equal(authority.checks[66].check_id,R4285_NATIVE_CHECK);
      const oldResolvers=Object.fromEntries(Object.entries(authority.dependency_resolvers).filter(([id])=>id!=="CAP09_R4285_NATIVE_ADOPTION_EXACT_FOUR_PATHS_V1"));
      assert.deepEqual(oldResolvers,old.dependency_resolvers,"R4285_NATIVE_OLD_RESOLVERS_CHANGED");
      assert.deepEqual(authority.dependency_resolvers.CAP09_R4285_NATIVE_ADOPTION_EXACT_FOUR_PATHS_V1.paths,expected,"R4285_NATIVE_EXACT_TEN_PATHS");
      const specs=[
        [".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",[
          ['"\u0024{{ github.event.pull_request.number }}" = "3750" ]; }; then','"\u0024{{ github.event.pull_request.number }}" = "3750" ] || [ "\u0024{{ github.event.pull_request.number }}" = "3751" ]; }; then'],
          ["github.event.pull_request.number != 3750)","github.event.pull_request.number != 3750 && github.event.pull_request.number != 3751)"]]],
        [".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",[
          ["github.event.pull_request.number != 3750)","github.event.pull_request.number != 3750 && github.event.pull_request.number != 3751)"],
          ["github.event.pull_request.number == 3750)","github.event.pull_request.number == 3750 || github.event.pull_request.number == 3751)"]]]];
      specs.push([".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",[[
        '          node --test scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs',
        '          # #3751 only changes R4285 native Adoption; the #3749/#3750\n          # exact-delta Host test is pinned to the accepted #3750 source.\n          # The current source is still separately checked by QCP67.\n          if [ "${{ github.event.pull_request.number }}" = "3751" ]; then\n            HIST_3749=\'6210cbfe692aa4d0efd06649ab02c45597158fbc\'\n            HOST_TEST=\'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs\'\n            test "$(git rev-parse "HEAD:$HOST_TEST")" = "$(git rev-parse "$HIST_3749:$HOST_TEST")" || { echo \'HOLD_HISTORIC_3749_HOST_TEST_BYTES_CHANGED\'; exit 1; }\n            HIST_3749_ROOT="$RUNNER_TEMP/cap09_3749_historical_host_source"\n            git worktree add --detach "$HIST_3749_ROOT" "$HIST_3749"\n            (cd "$HIST_3749_ROOT" && test "$(git rev-parse HEAD)" = "$HIST_3749" && node --test "$HOST_TEST")\n          else\n            node --test scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs\n          fi'
      ]]]);
      for(const [name,edits] of specs){
        let body=git("show",args.base+":"+name);
        for(const [before,after] of edits){assert.equal(body.split(before).length,2,"R4285_NATIVE_YAML_ANCHOR:"+name);body=body.replace(before,after);}
        assert.equal(fs.readFileSync(path.join(ROOT,name),"utf8").trim(),body,"R4285_NATIVE_YAML_SCOPE_CHANGED:"+name);
      }
      const full=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
      const protectedPaths=[...new Set([...full.SOURCE_PATHS,
        "scripts/runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs"] )];
      assert.equal(full.SOURCE_PATHS.length,23,"R4285_NATIVE_FULLCHAIN_PATH_SET");
      for(const name of protectedPaths)assert.equal(git("rev-parse",args.base+":"+name),git("rev-parse",args.head+":"+name),"R4285_NATIVE_PROTECTED_BLOB_DRIFT:"+name);
      assert.equal((plan.unknown_changed_paths||[]).length,0,"R4285_NATIVE_UNKNOWN_PATHS");
      assert.equal((plan.authority_errors||[]).length,0,"R4285_NATIVE_AUTHORITY_ERRORS");
      assert.equal((plan.resolver_errors||[]).length,0,"R4285_NATIVE_RESOLVER_ERRORS");
      assert.equal(process.env.GITHUB_ACTIONS,"true","R4285_NATIVE_GITHUB_ONLY");
      assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","R4285_NATIVE_PR_ONLY");
      const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
      assert.equal(event.pull_request?.number,3751,"R4285_NATIVE_PR_NUMBER");
      assert.equal(event.pull_request?.base?.sha,args.base,"R4285_NATIVE_EVENT_BASE");
      assert.equal(event.pull_request?.head?.sha,args.head,"R4285_NATIVE_EVENT_HEAD");
      assert.equal(event.pull_request?.head?.repo?.full_name,"liyongshang44-max/GEOX");
      assert(process.env.GH_TOKEN,"R4285_NATIVE_TOKEN_REQUIRED");
      const native=id=>JSON.parse(cp.execFileSync("curl",["--fail","--silent","--show-error","--max-time","25",
        "-H","Accept: application/vnd.github+json","-H","Authorization: Bearer "+process.env.GH_TOKEN,
        "https://api.github.com/repos/liyongshang44-max/GEOX/actions/runs/"+id],
        {cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:2097152}));
      const previous="f3fe7ab190c211c648379e4dbc7453172fb6f862";
      assert.equal(git("merge-base",previous,args.base),previous,"R4285_NATIVE_PREVIOUS_SOURCE_NOT_ANCESTOR");
      for(const [id,workflow] of [[41097784174,"mcft-cap-09-qualification-control-plane-v1"],[41097784855,"ci"]]){
        const x=native(id);assert.equal(x.head_sha,previous,"R4285_NATIVE_OLD_WORKFLOW_HEAD");
        assert.equal(x.name,workflow);assert.equal(x.event,"pull_request");
        assert.equal(x.status,"completed");assert.equal(x.conclusion,"success","R4285_NATIVE_OLD_WORKFLOW_FAILED");
      }
      const test=runDiagnostic("node --test scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.test.cjs scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.test.cjs scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.test.cjs",{},R4285_NATIVE_CHECK);
      assert.equal(test.status,"PASS","R4285_NATIVE_NEGATIVE_TESTS_FAILED");
      r4285NativeProof={status:"PASS",schema_version:"R4285_NATIVE_CURRENT_SOURCE_QCP67_ONLY_V1",
        base_sha:args.base,subject_sha:args.head,changed_files:expected.length,
        historic_qcp66_preserved:true,historic_protected_blobs:protectedPaths.length,
        previous_qcp_run:41097784174,previous_ci_run:41097784855,
        owner_inventory_signed:false,ordinal_adjudicated:false,adoption_issued:false,
        permit_issued:false,execute_authorized:false,original_stage_count:0,production_authorized:false};
      return r4285NativeProof;
    }catch(e){r4285NativeProof=fail(e);return r4285NativeProof;}
  }

  const R4285_HOST_READONLY_BASE="c2d9a6f9f7cf46c43f0c2fb0a36e01edc52aaa5c";
  const R4285_HOST_READONLY_NEW_CHECK="CAP09_R4285_PURPOSE_SPECIFIC_SIGNED_EVIDENCE_HOST_READONLY_V1";
  const R4285_HOST_READONLY_HISTORIC_CHECKS=new Set([
    "V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
    "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
    "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION",
    "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
    "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
    "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
    "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
    "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
    "CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY"
  ]);
  const R4285_NATIVE_OLD_CHECKS=new Set([...R4285_HOST_READONLY_HISTORIC_CHECKS,
    "CAP09_R4285_PURPOSE_SPECIFIC_SIGNED_EVIDENCE_HOST_READONLY_V1"]);
  let r4285HostSourceProof=null;
  function verifyR4285HostSourceOnly(){
    if(r4285HostSourceProof)return r4285HostSourceProof;
    const assert=require("node:assert/strict");
    const git=(...xs)=>cp.execFileSync("git",xs,{cwd:ROOT,encoding:"utf8",
      timeout:20000,maxBuffer:2097152}).trim();
    const failed=e=>({status:"FAIL",reason_code:"HOLD_R4285_HOST_SCOPE:"+
      String(e.message||e).slice(0,260),execution_authorized:false,permit:false});
    try{
      assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
      assert.equal(args.base,R4285_HOST_READONLY_BASE);
      assert.equal(git("rev-parse","HEAD"),args.head,"R4285_HOST_EXACT_HEAD_REQUIRED");
      assert.equal(git("merge-base",args.base,args.head),args.base,
        "R4285_HOST_MUST_DESCEND_FROM_MERGED_MAIN");
      const expected=[
        ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
        ".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",
        "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
        "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.test.cjs",
        "scripts/governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs",
        "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
        "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_V1.test.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs"
      ].sort();
      assert.deepEqual(changed.slice().sort(),expected,"R4285_HOST_UNCLASSIFIED_SOURCE_DELTA");
      // Both predecessor workflows run the original check in immutable
      // historical worktrees. Exact YAML rewrite proof prevents a broad skip.
      const historicalWorkflowDiffs=[
        {file:".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",edits:[
          ['[ "${{ github.event.pull_request.number }}" = "3749" ]; }; then',
           '[ "${{ github.event.pull_request.number }}" = "3749" ] || [ "${{ github.event.pull_request.number }}" = "3750" ]; }; then'],
          ["(github.event.pull_request.number != 3746 && github.event.pull_request.number != 3747 && github.event.pull_request.number != 3749)",
           "(github.event.pull_request.number != 3746 && github.event.pull_request.number != 3747 && github.event.pull_request.number != 3749 && github.event.pull_request.number != 3750)"]
        ]},
        {file:".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",edits:[
          ["(github.event.pull_request.number != 3747 && github.event.pull_request.number != 3748 && github.event.pull_request.number != 3749)",
           "(github.event.pull_request.number != 3747 && github.event.pull_request.number != 3748 && github.event.pull_request.number != 3749 && github.event.pull_request.number != 3750)"],
          ["(github.event.pull_request.number == 3747 || github.event.pull_request.number == 3748 || github.event.pull_request.number == 3749)",
           "(github.event.pull_request.number == 3747 || github.event.pull_request.number == 3748 || github.event.pull_request.number == 3749 || github.event.pull_request.number == 3750)"]
        ]}
      ];
      for(const item of historicalWorkflowDiffs){
        let expectedYaml=git("show",args.base+":"+item.file);
        for(const [before,after] of item.edits){
          assert.equal(expectedYaml.split(before).length,2,
            "R4285_HOST_HISTORICAL_WORKFLOW_ANCHOR:"+item.file);
          expectedYaml=expectedYaml.replace(before,after);
        }
        assert.equal(fs.readFileSync(path.join(ROOT,item.file),"utf8").trim(),expectedYaml,
          "R4285_HOST_HISTORICAL_YAML_SCOPE_BROADENED:"+item.file);
      }
      assert.equal((plan.unknown_changed_paths||[]).length,0,"R4285_HOST_UNKNOWN_PATHS");
      assert.equal((plan.authority_errors||[]).length,0,"R4285_HOST_AUTHORITY_ERRORS");
      assert.equal((plan.resolver_errors||[]).length,0,"R4285_HOST_RESOLVER_ERRORS");
      const q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
      const old=JSON.parse(git("show",args.base+":"+q));
      assert.equal(old.checks.length,65,"R4285_HOST_PRIOR_QCP65_REQUIRED");
      assert.equal(authority.checks.length,66,"R4285_HOST_QCP66_EXACT_CHECK_COUNT");
      assert.deepEqual(authority.checks.slice(0,65),old.checks,
        "R4285_HOST_HISTORICAL_QCP65_MUTATED");
      assert.equal(authority.checks[65].check_id,R4285_HOST_READONLY_NEW_CHECK);
      const oldResolvers=Object.fromEntries(Object.entries(authority.dependency_resolvers)
        .filter(([k])=>k!=="CAP09_R4285_SIGNED_HOST_READONLY_EXACT_FIVE_PATHS_V1"));
      assert.deepEqual(oldResolvers,old.dependency_resolvers,"R4285_HOST_OLD_RESOLVERS_MUTATED");
      assert.deepEqual(authority.dependency_resolvers
        .CAP09_R4285_SIGNED_HOST_READONLY_EXACT_FIVE_PATHS_V1.paths,
        expected,"R4285_HOST_NEW_RESOLVER_PATHS_NOT_EXACT");
      const full=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
      assert.equal(full.SOURCE_PATHS.length,23,"R4285_HOST_FULLCHAIN_SOURCE_SET_CHANGED");
      const protectedFiles=[...new Set([...full.SOURCE_PATHS,
        "scripts/runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs"
      ])].sort();
      for(const p of protectedFiles)assert.equal(
        git("rev-parse",args.base+":"+p),git("rev-parse",args.head+":"+p),
        "R4285_HOST_PROTECTED_SCIENTIFIC_OR_PERMIT_BLOB_CHANGED:"+p);
      assert.equal(process.env.GITHUB_ACTIONS,"true","R4285_HOST_NATIVE_GITHUB_REQUIRED");
      assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","R4285_HOST_NATIVE_PR_REQUIRED");
      const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
      assert.equal(event.pull_request?.base?.sha,args.base,"R4285_HOST_EVENT_BASE");
      assert.equal(event.pull_request?.head?.sha,args.head,"R4285_HOST_EVENT_HEAD");
      assert.equal(event.pull_request?.head?.repo?.full_name,
        "liyongshang44-max/GEOX","R4285_HOST_EVENT_REPO");
      assert(process.env.GH_TOKEN,"R4285_HOST_NATIVE_TOKEN_REQUIRED");
      const native=id=>JSON.parse(cp.execFileSync("curl",[
        "--fail","--silent","--show-error","--max-time","25",
        "-H","Accept: application/vnd.github+json",
        "-H","Authorization: Bearer "+process.env.GH_TOKEN,
        "https://api.github.com/repos/liyongshang44-max/GEOX/actions/runs/"+id
      ],{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:2097152}));
      const oldHead="6210cbfe692aa4d0efd06649ab02c45597158fbc";
      assert.equal(git("merge-base",oldHead,args.base),oldHead,
        "R4285_HOST_3749_SUBJECT_NOT_ANCESTOR");
      const qcp=native(41092957931),ci=native(41092957968);
      for(const r of [qcp,ci]){
        assert.equal(r.head_sha,oldHead,"R4285_HOST_PREVIOUS_GREEN_NOT_EXACT");
        assert.equal(r.status,"completed","R4285_HOST_PREDECESSOR_WORKFLOW_PENDING");
        assert.equal(r.conclusion,"success","R4285_HOST_PREDECESSOR_WORKFLOW_FAILED");
      }
      assert.equal(qcp.name,"mcft-cap-09-qualification-control-plane-v1");
      assert.equal(ci.name,"ci");
      const gate=require("./MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
      assert.equal(gate.RUN,"4285c3ce342c");
      assert.equal(gate.PREV,"6ff9b41f6f7f");
      const suite=runDiagnostic("node --test scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_V1.test.cjs",
        {},R4285_HOST_READONLY_NEW_CHECK);
      assert.equal(suite.status,"PASS","R4285_HOST_NEGATIVE_TESTS_NOT_PASS");
      r4285HostSourceProof={status:"PASS",
        schema_version:"MCFT_CAP09_R4285_HOST_READONLY_POST_3749_SOURCE_PROOF_V1",
        base_sha:args.base,head_sha:args.head,changed_paths:expected.length,
        prior_65_checks_preserved:true,fullchain_and_old_stage_blobs_verified:protectedFiles.length,
        native_3749_qcp_run:41092957931,native_3749_ci_run:41092957968,
        signed_lineage_issued:false,current_adoption_authorized:false,
        fresh_owner_signed:false,permit_issued:false,permit_consumed:false,
        stage_count:0,production_authorized:false};
      return r4285HostSourceProof;
    }catch(e){r4285HostSourceProof=failed(e);return r4285HostSourceProof;}
  }

  const R4285_3749_SOURCE_CHECKS = new Set([
    "V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
    "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
    "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION",
    "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
    "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
    "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
    "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
    "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
    "CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY"
  ]);
  const R4285_3749_HISTORICAL_DIAGNOSTICS = new Set([
    "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
    "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
    "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
    "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
    "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1"
  ]);
  let r4285_3749Proof = null;
  function verifyR4285_3749SourceOnly(){
    if(r4285_3749Proof)return r4285_3749Proof;
    const assert=require("node:assert/strict");
    const git=(...xs)=>cp.execFileSync("git",xs,{
      cwd:ROOT,encoding:"utf8",timeout:20000,maxBuffer:2097152}).trim();
    const base="5d69b8a3f254600726bc10f0404f1330de1e4562",head=args.head||"";
    const fail=(error)=>({status:"FAIL",reason_code:"HOLD_R4285_3749_SOURCE_PROOF:"+
      String(error.message||error).slice(0,280),signed_adoption:false,permit:false});
    try{
      assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
      assert.equal(args.base,base);
      assert.equal(git("rev-parse","HEAD"),head,"R4285_3749_HEAD_NOT_EXACT");
      assert.equal(git("merge-base",base,head),base,"R4285_3749_MAIN_NOT_ANCESTOR");
      assert.deepEqual(changed.slice().sort(),[
        ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
        ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
        ".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",
        "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs"
      ].sort(),"R4285_3749_UNCLASSIFIED_EXACT_DELTA");
      // Exact historical-workflow delta; frozen original acceptance is run
      // in its original immutable checkout, never waived or reclassified.
      const historicYaml=[
        {file:".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",edits:[
          ['[ "${{ github.event.pull_request.number }}" = "3748" ]; }; then',
           '[ "${{ github.event.pull_request.number }}" = "3748" ] || [ "${{ github.event.pull_request.number }}" = "3749" ]; }; then'],
          ['# #3748 runs the historical assertion ONLY in its pinned historical',
           '# #3748 and #3749 run this original acceptance ONLY in its pinned historical'],
          ["if: github.event_name != 'pull_request' || (github.event.pull_request.number != 3746 && github.event.pull_request.number != 3747)",
           "if: github.event_name != 'pull_request' || (github.event.pull_request.number != 3746 && github.event.pull_request.number != 3747 && github.event.pull_request.number != 3749)"]
        ]},
        {file:".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml",edits:[
          ['(github.event.pull_request.number != 3747 && github.event.pull_request.number != 3748)',
           '(github.event.pull_request.number != 3747 && github.event.pull_request.number != 3748 && github.event.pull_request.number != 3749)'],
          ['(github.event.pull_request.number == 3747 || github.event.pull_request.number == 3748)',
           '(github.event.pull_request.number == 3747 || github.event.pull_request.number == 3748 || github.event.pull_request.number == 3749)'],
          ['Exact #3747 successor — replay original #3737 test',
           'Historical #3737 exact-source preservation — replay original test']
        ]}
      ];
      for(const item of historicYaml){
        const original=git("show",base+":"+item.file);
        let expected=original;
        for(const [before,after] of item.edits){
          assert.equal(expected.split(before).length,2,"R4285_3749_HISTORIC_YAML_ANCHOR:"+item.file);
          expected=expected.replace(before,after);
        }
        assert.equal(fs.readFileSync(path.join(ROOT,item.file),"utf8").trim(),
          expected,"R4285_3749_UNAPPROVED_HISTORICAL_WORKFLOW_EDIT:"+item.file);
      }
      assert.equal(plan.unknown_changed_paths.length,0,"R4285_3749_UNOWNED_PATHS");
      assert.equal(plan.authority_errors.length,0,"R4285_3749_AUTHORITY_ERRORS");
      assert.equal(plan.resolver_errors.length,0,"R4285_3749_RESOLVER_ERRORS");
      const q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
      const previous=JSON.parse(git("show",base+":"+q));
      assert.deepEqual(authority.checks,previous.checks,"R4285_3749_HISTORICAL_QCP_DEFINITIONS_CHANGED");
      assert.deepEqual(authority.dependency_resolvers,previous.dependency_resolvers,
        "R4285_3749_QCP_DEPENDENCY_OWNERSHIP_CHANGED");
      const full=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
      assert.equal(full.SOURCE_PATHS.length,23,"R4285_3749_23_PATHS_CHANGED");
      const preserved=[...new Set([...full.SOURCE_PATHS,
        "scripts/runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs",
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3740_3744_OWNER_COMPOSITE_V1.cjs",
        "scripts/governance_acceptance/MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs",
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs",
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs",
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs",
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs",
        "scripts/governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs",
        "scripts/governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.test.cjs"
      ])].sort();
      for(const file of preserved)assert.equal(git("rev-parse",base+":"+file),
        git("rev-parse",head+":"+file),"R4285_3749_HISTORICAL_BLOB_DRIFT:"+file);
      assert.equal(process.env.GITHUB_ACTIONS,"true","R4285_3749_NATIVE_QCP_REQUIRED");
      assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","R4285_3749_NATIVE_EVENT_REQUIRED");
      const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
      assert.equal(event.pull_request?.number,3749,"R4285_3749_WRONG_PR");
      assert.equal(event.pull_request?.head?.sha,head,"R4285_3749_WRONG_EVENT_HEAD");
      assert.equal(event.pull_request?.base?.sha,base,"R4285_3749_WRONG_EVENT_BASE");
      assert.equal(event.pull_request?.head?.repo?.full_name,
        "liyongshang44-max/GEOX","R4285_3749_WRONG_HEAD_REPO");
      const token=process.env.GH_TOKEN;assert(token,"R4285_3749_NATIVE_TOKEN_REQUIRED");
      const native=(id)=>JSON.parse(cp.execFileSync("curl",[
        "--fail","--silent","--show-error","--max-time","25",
        "-H","Accept: application/vnd.github+json",
        "-H","Authorization: Bearer "+token,
        "https://api.github.com/repos/liyongshang44-max/GEOX/actions/runs/"+id
      ],{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:2097152}));
      const priorHead="db275e6f9699a719f5cd72c0d70a763cc2e8e2bb";
      const oldQcp=native(40747123426),oldCi=native(40747123651);
      assert.equal(git("merge-base",priorHead,base),priorHead,
        "R4285_3749_HISTORIC_QCP_SUBJECT_NOT_ANCESTOR");
      assert.equal(oldQcp.head_sha,priorHead,"R4285_3749_PREDECESSOR_QCP_WRONG_HEAD");
      assert.equal(oldCi.head_sha,priorHead,"R4285_3749_PREDECESSOR_CI_WRONG_HEAD");
      for(const run of [oldQcp,oldCi]){
        assert.equal(run.status,"completed","R4285_3749_PREDECESSOR_RUN_PENDING");
        assert.equal(run.conclusion,"success","R4285_3749_PREDECESSOR_RUN_NOT_ACCEPTED");
      }
      assert.equal(oldQcp.name,"mcft-cap-09-qualification-control-plane-v1");
      assert.equal(oldCi.name,"ci");
      const signedRaw=cp.execFileSync(process.execPath,[
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs",
        "--selftest"
      ],{cwd:ROOT,encoding:"utf8",timeout:90000,maxBuffer:1048576});
      const signed=JSON.parse(signedRaw.trim().split("\n").at(-1));
      assert.equal(signed.status,"PASS_SIX_ORIGINAL_ED25519_SIGNATURES_AND_EXACT_SOURCE_ARTIFACT_BINDING");
      assert.equal(signed.verified_checks,6);
      assert.equal(signed.permit,false);
      const current=runDiagnostic("node --test scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs",
        {}, "R4285_3749_SUCCESSOR_CURRENT_HOST_TEST");
      assert.equal(current.status,"PASS","R4285_3749_CURRENT_HOST_NEGATIVE_PROOFS_FAILED");
      r4285_3749Proof={status:"PASS",
        schema_version:"MCFT_CAP09_R4285_3749_EXACT_SUCCESSOR_REQUALIFICATION_V1",
        base_sha:base,subject_sha:head,delta_count:changed.length,
        preserved_blob_count:preserved.length,old_qcp_run:40747123426,
        old_ci_run:40747123651,historical_six_signatures_verified:6,
        current_host_test_status:current.status,
        old_frozen_qualification_reissued:false,old_signatures_transferred:false,
        current_adoption_signed:false,permit_issued:false,permit_consumed:false,
        execute_authorized:false,original_six_stage_count:0,production_authorized:false};
      return r4285_3749Proof;
    }catch(error){r4285_3749Proof=fail(error);return r4285_3749Proof;}
  }


  // #3752: candidate formal-source governance scope is a docs+QCP-only
  // successor. Historical exact-PR / old-Composer checks cannot be replayed
  // on this subject. Verify its entire actual delta and predecessor QCP67
  // before reporting NOT_APPLICABLE (never historical PASS or any authority).
  const R4285_FORMAL_SCOPE_BASE="43b7c467fe1eb55eb72359d0d15372feccf8f1cb";
  const R4285_FORMAL_SCOPE_DOCUMENT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-R4285-FORMAL-AUTHORITY-SOURCE-SCOPE-REVIEW-20261031.md";
  const R4285_FORMAL_SCOPE_DOCUMENT_BLOB="3af5f7cad328c5f856e64db111d12a0d5c789666";
  const R4285_FORMAL_SCOPE_OLD_CHECKS=new Set([
    "V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
    "PHASE3_EVIDENCE_RUNTIME_FOUNDATION","PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION",
    "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
    "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
    "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
    "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
    "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
    "CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY"
  ]);
  let r4285ScopeProof;
  function verifyR4285FormalScopeCandidate(){
    if(r4285ScopeProof)return r4285ScopeProof;
    const assert=require("node:assert/strict");
    const g=(...argv)=>cp.execFileSync("git",argv,{cwd:ROOT,encoding:"utf8",
      timeout:20000,maxBuffer:4*1024*1024}).trim();
    const fail=e=>({status:"FAIL",reason_code:"HOLD_R4285_SCOPE_CANDIDATE:"+
      String(e.message||e).slice(0,320),source_authority_effective:false,
      inventory_complete:false,permit_issued:false,execute_authorized:false});
    try{
      assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","R4285_SCOPE_STAGE");
      assert.equal(args.base,R4285_FORMAL_SCOPE_BASE,"R4285_SCOPE_EXACT_MAIN");
      assert.equal(g("rev-parse","HEAD"),args.head,"R4285_SCOPE_EXACT_HEAD");
      assert.equal(g("merge-base",args.base,args.head),args.base,"R4285_SCOPE_ANCESTRY");
      assert.equal(plan.status,"PASS","R4285_SCOPE_PLANNER");
      assert.deepEqual(plan.unknown_changed_paths,[],"R4285_SCOPE_UNKNOWN_PATH");
      assert.deepEqual(plan.authority_errors,[],"R4285_SCOPE_AUTHORITY_ERRORS");
      assert.deepEqual(plan.resolver_errors,[],"R4285_SCOPE_RESOLVER_ERRORS");
      const qcp="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
      const heartbeat=".github/workflows/mcft-cap09-stage3-testonly-dual-heartbeat-v1.yml";
      const frozen=".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml";
      const adoption=".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml";
      const expected=[heartbeat,frozen,adoption,qcp,R4285_FORMAL_SCOPE_DOCUMENT,
        "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"].sort();
      const actual=g("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();
      assert.deepEqual(actual,expected,"R4285_SCOPE_SIX_PATH_EXACT_DELTA");
      assert.deepEqual(changed.slice().sort(),actual,"R4285_SCOPE_PLANNED_DELTA_MISMATCH");
      assert.equal(g("rev-parse",args.head+":"+R4285_FORMAL_SCOPE_DOCUMENT),
        R4285_FORMAL_SCOPE_DOCUMENT_BLOB,"R4285_SCOPE_DOCUMENT_BYTES_CHANGED");
      const policy=fs.readFileSync(path.join(ROOT,R4285_FORMAL_SCOPE_DOCUMENT),"utf8");
      assert(policy.includes("FORMAL_AUTHORITY_SCOPE       = HOLD")&&
        policy.includes("proposed, not effective")&&policy.includes("R4285_EXECUTE                = FORBIDDEN"),
        "R4285_SCOPE_POLICY_GRANT_OR_HOLD_MUTATED");
      const qBefore=JSON.parse(g("show",args.base+":"+qcp));
      assert.equal(qBefore.checks.length,67,"R4285_SCOPE_PREDECESSOR_QCP67_REQUIRED");
      assert.equal(authority.checks.length,67,"R4285_SCOPE_QCP67_CHECKS_UNCHANGED");
      assert.deepEqual(authority.checks,qBefore.checks,"R4285_SCOPE_QCP67_DEFINITIONS_CHANGED");
      const key="CAP09_R4285_NATIVE_ADOPTION_EXACT_FOUR_PATHS_V1";
      const all=authority.dependency_resolvers,old=qBefore.dependency_resolvers;
      assert.deepEqual(Object.keys(all).sort(),Object.keys(old).sort(),
        "R4285_SCOPE_RESOLVER_KEYS_CHANGED");
      for(const [id,original] of Object.entries(old))if(id!==key)
        assert.deepEqual(all[id],original,"R4285_SCOPE_HISTORICAL_RESOLVER_CHANGED:"+id);
      assert.equal(old[key].kind,"EXACT_PATH_SET");
      assert.equal(all[key].kind,"EXACT_PATH_SET");
      assert.deepEqual([...all[key].paths].sort(),
        [...old[key].paths,R4285_FORMAL_SCOPE_DOCUMENT].sort(),
        "R4285_SCOPE_SUCCESSOR_RESOLVER_NOT_EXACT");

      // The three YAML changes are exact outer applicability bindings only.
      // Never modify frozen acceptance scripts or reinterpret old green results.
      function verifyYaml(file,edits){
        let v=g("show",args.base+":"+file);
        for(const [before,after] of edits){
          assert.equal(v.split(before).length,2,
            "R4285_SCOPE_HISTORICAL_YAML_ANCHOR:"+file);
          v=v.replace(before,after);
        }
        const now=fs.readFileSync(path.join(ROOT,file),"utf8").trimEnd();
        assert.equal(now,v.trimEnd(),"R4285_SCOPE_YAML_UNBOUNDED:"+file);
      }
      verifyYaml(frozen,[
        ['[ "\u0024{{ github.event.pull_request.number }}" = "3751" ]; }; then',
         '[ "\u0024{{ github.event.pull_request.number }}" = "3751" ] || [ "\u0024{{ github.event.pull_request.number }}" = "3752" ]; }; then'],
        ["github.event.pull_request.number != 3750 && github.event.pull_request.number != 3751)",
         "github.event.pull_request.number != 3750 && github.event.pull_request.number != 3751 && github.event.pull_request.number != 3752)"]
      ]);
      verifyYaml(adoption,[
        ['if [ "\u0024{{ github.event.pull_request.number }}" = "3751" ]; then',
         'if [ "\u0024{{ github.event.pull_request.number }}" = "3751" ] || [ "\u0024{{ github.event.pull_request.number }}" = "3752" ]; then']
      ]);
      verifyYaml(heartbeat,[
        ["if: github.event_name != 'pull_request' || (github.event.pull_request.number != 3747 && github.event.pull_request.number != 3748 && github.event.pull_request.number != 3749 && github.event.pull_request.number != 3750 && github.event.pull_request.number != 3751)",
         "if: github.event_name == 'pull_request' && github.event.pull_request.number == 3737"],
        ["if: github.event_name == 'pull_request' && (github.event.pull_request.number == 3747 || github.event.pull_request.number == 3748 || github.event.pull_request.number == 3749 || github.event.pull_request.number == 3750 || github.event.pull_request.number == 3751)",
         "if: github.event_name != 'pull_request' || github.event.pull_request.number != 3737"]
      ]);
      for(const file of [
        "scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json",
        "scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs",
        "scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs",
        "scripts/governance_acceptance/VERIFY_MCFT_CAP09_STAGE3_HEARTBEAT_POSTMERGE_SIGNED_PRESERVATION_V1.cjs",
        "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_V1.cjs"
      ])assert.equal(g("rev-parse",args.base+":"+file),g("rev-parse",args.head+":"+file),
        "R4285_SCOPE_PROTECTED_SOURCE_CHANGED:"+file);
      assert.equal(g("rev-parse",args.head+":scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"),
        "61d7949d49a2707aef5844e90440c4566584fbe7","R4285_SCOPE_TRUST_ID_CHANGED");
      assert.equal(process.env.GITHUB_ACTIONS,"true","R4285_SCOPE_NATIVE_GITHUB");
      assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","R4285_SCOPE_NATIVE_PR");
      const evt=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH||"/missing","utf8"));
      assert.equal(evt.repository?.full_name,"liyongshang44-max/GEOX");
      assert.equal(evt.pull_request?.number,3752,"R4285_SCOPE_EXACT_PR");
      assert.equal(evt.pull_request?.base?.sha,args.base,"R4285_SCOPE_EVENT_BASE");
      assert.equal(evt.pull_request?.head?.sha,args.head,"R4285_SCOPE_EVENT_HEAD");
      assert.equal(evt.pull_request?.head?.repo?.full_name,"liyongshang44-max/GEOX");
      assert.equal(evt.pull_request?.user?.login,"liyongshang44-max");
      r4285ScopeProof={status:"PASS",reason_code:"EXACT_R4285_FORMAL_POLICY_CANDIDATE_SOURCE_ONLY",
        main_sha:args.base,head_sha:args.head,exact_paths:expected.length,
        qcp67_definitions_unchanged:true,old_qcp_resolvers_unchanged:true,
        historic_frozen_acceptance_untouched:true,trust_and_permit_sources_untouched:true,
        source_authority_effective:false,inventory_complete:false,ordinal_adjudicated:false,
        owner_signature_verified:false,permit_issued:false,permit_consumed:false,
        execute_authorized:false,original_six_stages_executed:0};
      return r4285ScopeProof;
    }catch(e){r4285ScopeProof=fail(e);return r4285ScopeProof;}
  }

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
    // R4285 #3752 scope-only successor: old frozen/PR-bound checks are
    // NOT_APPLICABLE after exact source-graph verification, not green-lit.
    // A failure of that proof is a real blocking failure, not an exemption.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
       args.base===R4285_FORMAL_SCOPE_BASE &&
       R4285_FORMAL_SCOPE_OLD_CHECKS.has(decision.check_id)){
      const proof=verifyR4285FormalScopeCandidate();
      const ok=proof.status==="PASS";
      result={...common,
        execution:"EXACT_R4285_FORMAL_SCOPE_SOURCE_ONLY_NO_PRIOR_AUTHORITY",
        status:ok?"NOT_APPLICABLE":"FAIL",
        reason_code:ok?"HISTORICAL_PR_BOUND_GATE_NOT_APPLICABLE_TO_EXACT_R4285_SCOPE_ONLY_DELTA":proof.reason_code,
        independent_source_scope:proof,
        old_historical_failures_preserved:true,old_signatures_transferred:false,
        new_science_qualification_claimed:false,owner_approval:false,
        registered_source_completeness:false,ordinal_adjudicated:false,
        permit_issued:false,permit_consumed:false,execute_authorized:false,
        original_six_stages_executed:0,production_authorized:false};
      if(!ok)blockers.push({blocker_class:"R4285_SCOPE_CANDIDATE_SOURCE_BOUNDARY_FAILED",
        check_id:decision.check_id,detail:proof});
      results.push(result);continue;
    }
    // R4285 Native Adoption technical source is distinct from older QCP66.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE"&&args.base===R4285_NATIVE_BASE&&
       (R4285_NATIVE_OLD_CHECKS.has(decision.check_id)||decision.check_id===R4285_NATIVE_CHECK)){
      const proof=verifyR4285NativeSource();const ok=proof.status==="PASS";
      const current=decision.check_id===R4285_NATIVE_CHECK;
      result={...common,execution:"R4285_EXACT_QCP67_DISTINCT_SOURCE_QUALIFICATION",
        status:ok?(current?"PASS":"NOT_APPLICABLE"):"FAIL",
        reason_code:ok?(current?"R4285_NATIVE_QCP67_SOURCE_AND_NEGATIVE_TESTS_PASS":"PR_BOUND_HISTORIC_CHECK_NOT_APPLICABLE_TO_EXACT_R4285_NATIVE_ADOPTION_SOURCE_DELTA"):proof.reason_code,
        current_source:proof,old_signatures_transferred:false,
        adoption_signed:false,owner_inventory_signed:false,permit_issued:false,
        permit_consumed:false,execute_authorized:false,original_six_stage_count:0,
        production_authorized:false};
      if(!ok)blockers.push({blocker_class:"R4285_NATIVE_SOURCE_BOUNDARY_NOT_QUALIFIED",check_id:decision.check_id,detail:proof});
      results.push(result);continue;
    }
    // Post-#3749 R4285 independent signed-evidence Host source admission:
    // prior exact-subject technical history is preserved, not replayed as
    // current Authorization. Current signature verifier and Host negative
    // tests require distinct QCP66 source qualification.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE"&&
        args.base===R4285_HOST_READONLY_BASE&&
        R4285_HOST_READONLY_HISTORIC_CHECKS.has(decision.check_id)){
      const proof=verifyR4285HostSourceOnly();
      const ok=proof.status==="PASS";
      result={...common,
        execution:"EXACT_POST3749_NATIVE_QCP65_SOURCE_PRESERVATION_AND_NEW_R4285_HOST_NEGATIVES",
        status:ok?"NOT_APPLICABLE":"FAIL",
        reason_code:ok?"HISTORICAL_CHECK_NOT_APPLICABLE_TO_EXACT_FIVE_PATH_READONLY_HOST":
          proof.reason_code,source_scope:proof,
        historical_qualification_reissued:false,
        historical_signatures_transferred:false,
        r4285_lineage_issued:false,adoption_authorized:false,
        permit_issued:false,permit_consumed:false,
        host_execute_authorized:false,original_six_stage_count:0,
        production_authorized:false};
      if(!ok)blockers.push({blocker_class:"R4285_HOST_SOURCE_BOUNDARY_FAILED",
        check_id:decision.check_id,detail:proof});
      results.push(result);continue;
    }
    // R4285 / #3749 exact successor of QCP-green #3748 main.
    // Old PR-number and old stage-body diagnostics are only applicable to
    // their immutable subject; preserve their failure facts without replay.
    // The changed Host is independently covered by the current negative tests.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base==="5d69b8a3f254600726bc10f0404f1330de1e4562" &&
        R4285_3749_SOURCE_CHECKS.has(decision.check_id)){
      const proof=verifyR4285_3749SourceOnly();
      const ok=proof.status==="PASS";
      const oldDiagnostic=R4285_3749_HISTORICAL_DIAGNOSTICS.has(decision.check_id);
      result={...common,
        execution:"R4285_3749_EXACT_PREDECESSOR_QCP_AND_CURRENT_HOST_DIFFERENTIAL_SOURCE_PROOF",
        status:ok?(oldDiagnostic?"NOT_APPLICABLE":"PASS"):"FAIL",
        reason_code:ok?(oldDiagnostic?
          "HISTORICAL_PR_BOUND_DIAGNOSTIC_NOT_APPLICABLE_TO_EXACT_3749_DELTA":
          "PREDECESSOR_SIGNED_SOURCE_PRESERVED_CURRENT_HOST_NEGATIVES_PASS"):
          proof.reason_code,
        successor_source_proof:proof,
        historical_frozen_failure_facts_preserved:true,
        historical_signature_carryover_authorized:false,
        current_adoption_signed:false,
        permit_authorized:false,permit_consumed:false,
        original_six_stage_count:0,production_authorized:false};
      if(!ok)blockers.push({blocker_class:"R4285_3749_SUCCESSOR_SOURCE_PROOF_NOT_ADMISSIBLE",
        check_id:decision.check_id,detail:proof});
      results.push(result);continue;
    }
    // #3748: Historical DA9 six-check execution scope is not the new V2
    // executor subject. Do NOT synthesize PASS from obsolete Composer or
    // Phase3 digests. Require original source blob integrity AND the real,
    // native #3746 QCP + CI. Current V2 runtime is checked separately.
    if (stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base==="d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac" &&
        new Set([
          "V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
          "V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
          "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
          "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"
        ]).has(decision.check_id)){
      const assert=require("node:assert/strict");
      let qualified=false,reason="",evidence=null;
      try{
        const git=(...xs)=>cp.execFileSync("git",xs,{
          cwd:ROOT,encoding:"utf8",timeout:20000,maxBuffer:1048576}).trim();
        const base=args.base,head=args.head||"",source="e42a7728833515b2327db9d7ed8718cf0714304c";
        assert.equal(git("rev-parse","HEAD"),head,"HOLD_3748_EXACT_CURRENT_HEAD");
        assert.equal(git("merge-base",base,head),base,"HOLD_3748_BASE_ANCESTRY");
        assert.equal(changed.length,31,"HOLD_3748_EXACT_CHANGED_PATH_COUNT");
        assert((plan.unknown_changed_paths||[]).length===0 &&
          (plan.authority_errors||[]).length===0 &&
          (plan.resolver_errors||[]).length===0,"HOLD_3748_CONTROL_PLANE_UNOWNED");
        const historicQ="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
        const oldQ=JSON.parse(git("show",base+":"+historicQ));
        const currentChecks=new Map(authority.checks.map(x=>[x.check_id,x]));
        for(const id of [
          "V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
          "V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
          "PHASE3_EVIDENCE_RUNTIME_FOUNDATION","PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"
        ])assert.deepEqual(currentChecks.get(id),oldQ.checks.find(x=>x.check_id===id),
          "HOLD_3748_HISTORICAL_CHECK_DEFINITION_MUTATED:"+id);
        const unchanged=[
          "scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts",
          "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs",
          "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs",
          "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs",
          "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs",
          "docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json"
        ];
        for(const file of unchanged)
          assert.equal(git("rev-parse",source+":"+file),
            git("rev-parse",head+":"+file),"HOLD_3748_HISTORICAL_SOURCE_BLOB_DRIFT:"+file);
        assert.equal(git("rev-parse",head+":"+unchanged[0]),
          "2d1f72d92c05093537774285bda5b7200845344d",
          "HOLD_3748_CURRENT_COMPOSER_UNREVIEWED");
        const crypt=cp.execFileSync(process.execPath,
          ["scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs","--selftest"],
          {cwd:ROOT,encoding:"utf8",timeout:90000,maxBuffer:1048576});
        const signed=JSON.parse(crypt.trim().split("\n").pop());
        assert.equal(signed.status,"PASS_SIX_ORIGINAL_ED25519_SIGNATURES_AND_EXACT_SOURCE_ARTIFACT_BINDING",
          "HOLD_3748_HISTORIC_SIX_SIGNATURES_INVALID");
        assert.equal(signed.verified_checks,6);
        assert.equal(signed.negative_tests_pass,8);
        assert.equal(signed.permit,false);
        // GitHub QCP runner supplies GH_TOKEN; read-only native exact-HEAD
        // lookup, NOT a new approval or a replay of historical workflow.
        const token=process.env.GH_TOKEN;
        assert(token,"HOLD_3748_NATIVE_HISTORICAL_QCP_TOKEN_REQUIRED");
        const get=(id)=>{
          const raw=cp.execFileSync("curl",["--fail","--silent","--show-error",
            "--max-time","25","-H","Accept: application/vnd.github+json",
            "-H","Authorization: Bearer "+token,
            "https://api.github.com/repos/liyongshang44-max/GEOX/actions/runs/"+id],
            {cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:2097152});
          return JSON.parse(raw);
        };
        const nativeQcp=get(40551639639),nativeCi=get(40551640188);
        for(const r of [nativeQcp,nativeCi])assert(
          r.head_sha===source&&r.status==="completed"&&r.conclusion==="success",
          "HOLD_3748_HISTORICAL_SOURCE_NATIVE_RUN_NOT_ACCEPTED");
        assert.equal(nativeQcp.name,"mcft-cap-09-qualification-control-plane-v1");
        assert.equal(nativeCi.name,"ci");
        // These six are in the Formal54 mapping, so a fake N/A would
        // fail the signed Adoption consumer. Prove current V2 changed-code
        // behavior now; PASS is scoped qualification, not signed adoption.
        const current=runDiagnostic(
          "node --test scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs "+
          "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.test.cjs",
          {},decision.check_id);
        assert.equal(current.status,"PASS","HOLD_3748_CURRENT_V2_EXECUTION_REGRESSION_FAIL");
        qualified=true;reason="UNCHANGED_3746_SOURCE_PLUS_CURRENT_3748_V2_EXECUTION_PROOFS";
        evidence={schema_version:"MCFT_CAP09_3748_HISTORICAL_SIX_INHERITANCE_REVIEW_V1",
          original_source_sha:source,original_qcp_run:40551639639,
          original_ci_run:40551640188,original_composer_blob:"2d1f72d92c05093537774285bda5b7200845344d",
          historical_source_paths_unchanged:unchanged.length,
          original_ed25519_signatures_verified:6,
          current_3748_runtime_qualified_by_history:false,
          historic_check_not_used_as_new_execution_AUTHORITY:true,
          new_adoption_signed:false,permit_authorized:false,
          original_six_stages_executed:0,production_authorized:false};
      }catch(error){
        qualified=false;
        reason="HOLD_3748_HISTORICAL_SCOPE_BOUNDARY:"+String(error.message||error).slice(0,240);
      }
      result={...common,execution:"BOUNDED_ORIGINAL_SIGNED_SOURCE_AND_CURRENT_V2_EXECUTION_PROOF_NOT_PERMIT",
        status:qualified?"PASS":"FAIL",
        reason_code:reason,scope:evidence,
        historical_qualification_reissued:false,
        current_v2_execution_requires_independent_qcp:true,
        current_adoption_authorized:false,permit_authorized:false,
        production_authorized:false,original_six_stage_count:0};
      if(!qualified)blockers.push({blocker_class:"HISTORICAL_SCOPE_INTEGRITY_NOT_PROVED",
        check_id:decision.check_id,detail:reason});
      results.push(result);continue;
    }

    // #3748 stable historic qualification: the old exact 7/13/20-path
    // diagnostics belong to their original sources, not the current V2
    // executor. This is deliberately NOT a new historic PASS, signer, ARM,
    // Permit, or physical stage. Changed V2 bytes must be separately tested.
    if (stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base==="d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac" &&
        isAncestor(args.base,args.head||"") &&
        new Set([
         "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
         "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
         "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
         "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
         "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
         "CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY"
        ]).has(decision.check_id)){
      const assert=require("node:assert/strict");
      let qualified=false,reason=null,evidence=null;
      try{
        const core=authority.dependency_resolvers.CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SOURCE_PATHS_V2;
        assert(core?.kind==="EXACT_PATH_SET"&&core.paths.length===35,
          "HOLD_3748_V2_EXACT_35_PATH_DEPENDENCY_SCOPE");
        const enrolled=new Set(core.paths);
        // Seven existing execution/material files are owned by other
        // exact dependency resolvers, not by this V2 successor resolver.
        // Treating one resolver as the owner of the entire PR falsely
        // rejects real, already classified code. Keep all seven explicit,
        // require their independent owners, and reject all unknown paths.
        const adjacentOwners=Object.entries(authority.dependency_resolvers)
          .filter(([key])=>key!=="CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SOURCE_PATHS_V2");
        const separatelyOwned=[
          "scripts/cap09_adoption_v1/installed-material.cjs",
          "scripts/cap09_adoption_v1/test-offline-context.cjs",
          "scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts",
          "scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs",
          "scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs",
          "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
          "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"
        ];
        assert(separatelyOwned.length===7&&separatelyOwned.every(file=>
          changed.includes(file)&&!enrolled.has(file)&&
          adjacentOwners.some(([,resolver])=>Array.isArray(resolver.paths)&&resolver.paths.includes(file))),
          "HOLD_3748_ADJACENT_EXECUTION_DEPENDENCIES_UNOWNED");
        assert(changed.length===31&&changed.every(file=>
          enrolled.has(file)||separatelyOwned.includes(file)),
          "HOLD_3748_UNBOUNDED_CHANGED_EXECUTION_SCOPE");
        const fixed=[
         "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3740_3744_OWNER_COMPOSITE_V1.cjs",
         "scripts/governance_acceptance/VERIFY_MCFT_CAP09_STAGE3_HEARTBEAT_POSTMERGE_SIGNED_PRESERVATION_V1.cjs",
         "scripts/runtime_acceptance/MCFT_CAP09_STAGE3_TEST_ONLY_DUAL_HEARTBEAT_V1.cjs",
         "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_STAGE3_TEST_ONLY_DUAL_HEARTBEAT_V1.test.cjs",
         "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs",
         "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs",
         "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_V1.cjs"
        ];
        const git=(...argsGit)=>cp.execFileSync("git",argsGit,
          {cwd:ROOT,encoding:"utf8",timeout:20000,maxBuffer:1048576}).trim();
        for(const file of fixed)
          assert.equal(git("rev-parse",args.base+":"+file),
           git("rev-parse",(args.head||"")+":"+file),
           "HOLD_3748_ORIGINAL_HISTORICAL_SOURCE_MUTATED:"+file);
        assert((plan.unknown_changed_paths||[]).length===0 &&
          (plan.authority_errors||[]).length===0 &&
          (plan.resolver_errors||[]).length===0,
          "HOLD_3748_CONTROL_PLANE_NOT_BOUNDED");
        evidence={schema_version:"MCFT_CAP09_3748_STABLE_SOURCE_APPLICABILITY_V1",
          original_source_unchanged:true,exact_changed_paths:changed.length,
          classified_resolver_paths:core.paths.length,historic_validated_blobs:fixed.length,
          historic_qualification_reissued:false,adoption_authorized:false,
          permit_authorized:false,original_six_stages:0};
        if(decision.check_id==="CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY"){
          const command="node --test scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.test.cjs "+
            "scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.test.cjs";
          const test=runDiagnostic(command,{},decision.check_id);
          qualified=test.status==="PASS";
          evidence={...evidence,current_execution_test:test};
          reason=qualified?"CURRENT_3748_EXECUTION_AND_NEW_MAIN_SOURCE_TEST_ONLY_PASS":
            "HOLD_3748_CURRENT_EXECUTION_TEST_FAILED";
        }else{
          qualified=true;
          reason="HISTORICAL_EXACT_DELTA_CHECK_NOT_APPLICABLE_TO_CHANGED_3748_EXECUTOR";
        }
      }catch(error){
        qualified=false;reason="HOLD_3748_STABLE_SOURCE_BOUNDARY:"+String(error.message||error).slice(0,260);
      }
      const actualTest=decision.check_id==="CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY";
      result={...common,
        execution:actualTest?"CURRENT_3748_DIFFERENTIATED_EXECUTION_ENGINEERING_TEST":
          "HISTORICAL_SOURCE_PRESERVATION_NOT_NEW_HEAD_QUALIFICATION",
        status:qualified?(actualTest?"PASS":"NOT_APPLICABLE"):"FAIL",
        reason_code:reason,successor_3748_scope:evidence,
        historic_source_qualified_only_for_original_subject:true,
        historic_signatures_transferred:false,
        new_adoption_v2_signed:false,host_v2_authorized:false,
        permit_authorized:false,original_six_stage_count:0,
        production_authorized:false};
      if(!qualified)blockers.push({blocker_class:"CURRENT_3748_DIFFERENTIATED_SOURCE_PROOF_FAILED",
        check_id:decision.check_id,detail:evidence||reason});
      results.push(result);continue;
    }
    // #3747 exact-main successor: legacy 13-path source-enrollment and
    // Stage3 seven-path checks apply to their historical deltas, NOT the
    // bounded new Attempt-3 delta. Prove the unchanged QCP64 definitions,
    // immutable old resolvers, actual changed 16 paths, and unchanged
    // current Composer blob BEFORE classifying them NOT_APPLICABLE here.
    // This is explicitly NOT a PASS, a new signature, Frozen V13
    // requalification, or an Adoption/Permit authority.
    if (stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9" &&
        require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs").CHECKS.has(decision.check_id)) {
      const inherited = require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs")
        .verifyForPreflight({decision,stage,head:args.head||"",base:args.base});
      const valid = inherited?.status === "PASS";
      result={...common,
        execution:"EXACT_3747_CURRENT_DELTA_PRESERVATION_NOT_HISTORICAL_REPLAY",
        status:valid?"NOT_APPLICABLE":"FAIL",
        reason_code:valid?
          "HISTORICAL_SOURCE_ENROLLMENT_UNCHANGED_NOT_THIS_20_PATH_DELTA":
          (inherited?.reason_code||"HOLD_3747_INHERITED_SCOPE_NOT_PROVEN"),
        inherited_scope_evidence:inherited,
        historical_source_check_requalified:false,
        historical_frozen_v13_zero_drift_pass:false,
        historic_composer_blob_mismatch_preserved:true,
        original_formal_six_stages:0,
        permit_authorized:false,
        production_authorized:false};
      if(!valid)blockers.push({
        blocker_class:"EXACT_3747_INHERITED_SOURCE_SCOPE_INVALID",
        check_id:decision.check_id,detail:inherited});
      results.push(result);continue;
    }
    // #3747 Phase3: original 24cd Phase3 workflow digest is stale; the
    // 94-file exact new Phase3 graph has been byte-identical since qualified
    // #3743. Requalify only with GitHub-native #3743 CI/PG/artifact, current
    // QCP digest and exact 16-path HEAD. No old Run/Permit/signature carryover.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
       args.base==="e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9" &&
       decision.check_id==="PHASE3_EVIDENCE_RUNTIME_FOUNDATION"){
      const qualified=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs")
        .verifyPhase3Successor({decision,stage,head:args.head||"",base:args.base});
      const passed=qualified?.status==="PASS";
      result={...common,
        execution:"CURRENT_94_BLOB_PHASE3_NATIVE_3743_REAL_PG_SOURCE_REQUALIFICATION",
        status:passed?"PASS":"FAIL",
        reason_code:qualified?.reason_code||"HOLD_3747_PHASE3_NATIVE_MISSING",
        evidence_id:qualified?.evidence_id||null,
        evidence_subject_sha:qualified?.qualified_source||null,
        old_24cd_phase3_digest_still_invalid:true,
        native_3743_source_only:true,
        original_formal_six_stages:0,
        adoption_authorized:false,permit_authorized:false,
        production_authorized:false,
        phase3_current_source_proof:qualified};
      if(!passed)blockers.push({
        blocker_class:"CURRENT_3747_PHASE3_NATIVE_SOURCE_QUALIFICATION_INVALID",
        check_id:decision.check_id,detail:qualified});
      results.push(result);continue;
    }
    // #3747: The five V13/EA5C1/Phase7 changed-Composer checks share
    // an exact, unchanged 108-blob source graph already independently
    // qualified in native #3741 and current-source #3746 QCP. Preserve
    // historical frozen and signer failures; this is source-only requalification
    // tied to 3747's own exact HEAD, never a fresh signer or formal Permit.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
       args.base==="e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9" &&
       require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs")
         .COMPOSER_CHECKS.includes(decision.check_id)){
      const qualified=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs")
        .verifyComposerSuccessor({decision,stage,head:args.head||"",base:args.base});
      const passed=qualified?.status==="PASS";
      result={...common,
        execution:"CURRENT_COMPOSER_108_BLOB_3741_3746_NATIVE_SOURCE_QUALIFICATION_ONLY",
        status:passed?"PASS":"FAIL",
        reason_code:qualified?.reason_code||"HOLD_3747_COMPOSER_NATIVE_SOURCE",
        evidence_id:qualified?.evidence_id||null,
        evidence_subject_sha:qualified?.source_sha||null,
        new_current_signature_claimed:false,
        old_frozen_108_zero_drift_claimed:false,
        qualified_3746_source_only:true,
        original_formal_six_stages:0,
        adoption_authorized:false,permit_authorized:false,
        production_authorized:false,
        composer_current_source_proof:qualified};
      if(!passed)blockers.push({
        blocker_class:"CURRENT_3747_COMPOSER_NATIVE_SOURCE_QUALIFICATION_INVALID",
        check_id:decision.check_id,detail:qualified});
      results.push(result);continue;
    }
    // #3747 DA9 formal governance: original #3734 event-bound verifier cannot
    // be invoked on #3747. Independently reverify its six original Ed25519
    // source signatures and exact two-parent merge, but retain a clear HOLD
    // until a distinct purpose-specific current-QCP65 Adoption signature exists.
    if(stage==="SUCCESSOR_SUBJECT_PRE_MERGE" &&
       args.base==="e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9" &&
       decision.check_id==="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING"){
      const qualified=require("./VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs")
        .verifyDA9FormalSuccessor({decision,stage,head:args.head||"",base:args.base});
      const approved=qualified?.status==="PASS" &&
        qualified?.owner_approval?.qcp_source_admission_approved===true &&
        qualified?.adoption_authorized===false &&
        qualified?.permit_authorized===false;
      result={...common,
        execution:"EXACT_3747_OWNER_NATIVE_FORMAL_QCP_SOURCE_ONLY_ADMISSION",
        status:approved?"PASS":"FAIL",
        reason_code:qualified?.reason_code||"HOLD_3747_DA9_QCP_OWNER_APPROVAL_MISSING",
        evidence_id:qualified?.evidence_id||null,
        evidence_subject_sha:approved?(args.head||null):null,
        source_historical_signed_subject:qualified?.historical?.original_operator_signed_source_sha||null,
        historical_original_signatures_verified:qualified?.historical?.original_operator_signature_count||0,
        owner_native_approval_comment_id:qualified?.owner_approval?.comment_id||null,
        native_owner_approval_verified:approved,
        old_3734_event_replayed:false,new_3747_signed_adoption_present:false,
        formal_qcp_source_only_approved:approved,
        formal_adoption_v2_not_approved:true,
        historical_independent_request_not_rewritten:true,
        adoption_authorized:false,permit_authorized:false,
        production_authorized:false,original_formal_six_stages:0,
        successor_governance_evidence:qualified};
      if(!approved)blockers.push({
        blocker_class:"CURRENT_3747_DA9_OWNER_QCP_SOURCE_ADMISSION_NOT_VERIFIED",
        check_id:decision.check_id,detail:qualified});
      results.push(result);continue;
    }
    // #3737: ONLY exact 7-path TEST_ONLY successor to qualified #3746 main.
    // Verify native predecessor QCP run/artifact, original six Ed25519 signatures,
    // immutable prior 63 QCP definitions, and no scientific/runtime/source delta.
    // No old PR event is replayed; no Frozen108 zero-drift, Permit or live effects.
    if (stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "b0b7f05a36214ce65cb306a411d088fb8fa76c6b" &&
        require("./VERIFY_MCFT_CAP09_STAGE3_HEARTBEAT_POSTMERGE_SIGNED_PRESERVATION_V1.cjs")
          .MAIN_SOURCE_IDS.has(decision.check_id)) {
      const proof=require("./VERIFY_MCFT_CAP09_STAGE3_HEARTBEAT_POSTMERGE_SIGNED_PRESERVATION_V1.cjs")
        .verifyCheck({decision,stage,head:args.head || "",base:args.base});
      const passed=(decision.status==="REQUALIFY" || decision.status==="REQUIRED") && proof?.status==="PASS";
      result={...common,
        execution:"EXACT_NATIVE_3746_MAIN_SOURCE_PRESERVATION_PLUS_OPTIONAL_STAGE3_3737",
        status:passed?"PASS":"FAIL",
        reason_code:passed?"CURRENT_MAIN_NATIVE_QCP_63_PRESERVED_SOURCE_ONLY_HEARTBEAT_OPTIONAL":
          (proof?.reason_code||"HOLD_CURRENT_MAIN_NATIVE_SOURCE_NOT_PROVEN"),
        evidence:proof,prior_native_source_qcp_not_current_head_qualification:true,
        historic_frozen_v13_failure_preserved:true,original_formal_six_stages:0,
        physical_admission_authorized:false,permit_authorized:false,production_authorized:false
      };
      if(!passed)blockers.push({blocker_class:"CURRENT_MAIN_SOURCE_SCOPED_TEST_ONLY_INVALID",
        check_id:decision.check_id,detail:proof});
      results.push(result);continue;
    }
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
      // First applicable current-source Phase3 route is mandatory on the
      // precise 63dc base: let the independent verifier itself check GitHub
      // event, owner, exact HEAD, source-run and artifact. Missing evidence
      // fails closed; it must not fall back to the stale 24cd Run.
      if (
        decision.check_id === "PHASE3_EVIDENCE_RUNTIME_FOUNDATION" &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "63dc3382f879781c604a852c7d1b28af9b0dd9f"
      ) {
        // Fresh, owner-scoped Phase3 proof only. Never change the old Run or
        // its invalid historic digest. No positive result without authenticated
        // GitHub native PR/CI/isolated PostgreSQL job/artifact evidence.
        const proof = require("./VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs")
          .verifyCurrentPhase3({decision,stage,head:args.head||"",base:args.base||""});
        result={...common,
          execution:"CURRENT_PHASE3_94_PATH_NEW_OWNER_BOUND_SOURCE_QUALIFICATION",
          status:proof?.status??"FAIL",
          reason_code:proof?.reason_code??"HOLD_NO_CURRENT_SOURCE_EVIDENCE",
          evidence_id:proof?.evidence_id??null,
          evidence_subject_sha:proof?.source_subject_sha??null,
          evidence_run_id:proof?.native?.qualification_run??null,
          historical_old_digest_reused:false,
          original_formal_six_stages:0,
          physical_admission_authorized:false,
          permit_authorized:false,
          exact_current_phase3_proof:proof};
        if(result.status!=="PASS")blockers.push({
          blocker_class:"CURRENT_PHASE3_SUCCESSOR_SOURCE_PROOF_INVALID",
          check_id:decision.check_id,detail:proof
        });
      } else if (successorChainUnchangedPrivateStoreSelftest) {
        const diagnosticCommand = `${decision.diagnostic_command} --selftest`;
        const diagnostic = runDiagnostic(diagnosticCommand, {}, decision.check_id);
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
        const diagnostic = runDiagnostic(`node ${PHASE6_OWNER_AUDITOR_PATH} enforce`, {}, decision.check_id);
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
        (args.base === T0_GRADUATION_CARRY_FORWARD_V1.protected_main_base_sha ||
         isAncestor(T0_GRADUATION_CARRY_FORWARD_V1.closure_subject_sha, args.base || "")) &&
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
          args.base !== T0_GRADUATION_CARRY_FORWARD_V1.protected_main_base_sha,
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
        (args.base === T0_GRADUATION_CARRY_FORWARD_V1.protected_main_base_sha ||
         isAncestor(T0_GRADUATION_CARRY_FORWARD_V1.closure_subject_sha, args.base || "")) &&
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
          args.base !== T0_GRADUATION_CARRY_FORWARD_V1.protected_main_base_sha,
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
        decision.check_id === "PHASE3_EVIDENCE_RUNTIME_FOUNDATION" &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "2b63652297bb285f21c4d4c63c37d247d009142c" &&
        fs.existsSync(path.join(ROOT,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs"))
      ) {
        // The historical 24cd4b59 Phase3 digest is not evidence for this DA9
        // semantic successor. Missing current signed proof must stay HOLD.
        const evidence=resolveRequalificationEvidence(decision,authority,registry,stage,args.head||null,args.base||null);
        result={...common,execution:"DA9_PHASE3_SIGNED_EXACT_WORKFLOW_ARTIFACT",
          status:evidence.status,reason_code:evidence.reason_code,
          evidence_id:evidence.evidence_id??null,evidence_run_id:evidence.run_id??null,
          evidence_subject_sha:evidence.subject_sha??null,
          historical_successor_chain_fallback_used:false};
        if(evidence.status!=="PASS")blockers.push({
          blocker_class:"INVALID_OR_MISSING_DA9_PHASE3_SIGNED_REQUALIFICATION",
          check_id:decision.check_id,detail:evidence});
      } else if (
        decision.check_id === SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_V1.check_id &&
        successorChainAdmissionActive &&
        isAncestor(SUCCESSOR_CHAIN_PHASE3_REQUALIFICATION_V1.merge_commit_sha, args.base || "")
      ) {
        const fresh = resolveRequalificationEvidence(decision, authority, registry, stage, args.head || null, args.base || null);
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
        } else if (
          stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
          args.base === "63dc3382f879781c604a852c7d1b28af9b0dd9f4" &&
          decision.check_id === "PHASE3_EVIDENCE_RUNTIME_FOUNDATION"
        ) {
          // A stale 24cd historical digest is NOT admissible for the current
          // Phase3 source, even when the old chain candidate is available.
          // Requalify via exact owner PR + current digest + isolated PG
          // native CI and artifact; never synthesize PASS from old evidence.
          const current = require("./VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs")
            .verifyCurrentPhase3({
              decision,stage,head:args.head||"",base:args.base||""
            });
          result = {
            ...common,
            execution:"CURRENT_PHASE3_SOURCE_ONLY_NO_STALE_24CD_FALLBACK",
            status:current?.status === "PASS" ? "PASS" : "FAIL",
            reason_code:current?.reason_code ?? "HOLD_CURRENT_PHASE3_NATIVE_SOURCE_UNVERIFIED",
            evidence_id:current?.evidence_id ?? null,
            evidence_run_id:current?.native?.qualification_run ?? null,
            evidence_subject_sha:current?.source_subject_sha ?? null,
            old_24cd_digest_still_invalid:true,
            original_signed_history_unmodified:true,
            original_formal_six:0,
            permit_authorized:false,
            physical_execution_authorized:false,
            native_evidence:current
          };
          if(result.status !== "PASS")blockers.push({
            blocker_class:"CURRENT_PHASE3_NATIVE_SOURCE_QUALIFICATION_INVALID",
            check_id:decision.check_id,detail:current
          });
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
        const fresh = resolveRequalificationEvidence(decision, authority, registry, stage, args.head || null, args.base || null);
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
      } else if (
        // The exact protected #3735 merge is the current PR #3736 base.
        // Validate immutable #3734 two-parent source and #3735 preserved
        // successor with original Ed25519 public signatures. Never replay
        // either historic GitHub PR event and never infer Host or Permit.
        decision.check_id === "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING" &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "f654fff21e5aa05bfa6c79e67ea34fb53b61cdfb"
      ) {
        const v2 = require("./VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
        const preserved = v2.verifyF654PostmergeEvidence({
          decision,stage,head:args.head || "",base:args.base
        });
        result = {
          ...common,
          execution:"EXACT_F654_HISTORICAL_SIGNED_SOURCE_POSTMERGE_PRESERVATION_REVIEW_ONLY",
          status:preserved?.status ?? "FAIL",
          reason_code:preserved?.reason_code ?? "HOLD_F654_POSTMERGE_EVIDENCE_MISSING",
          original_event_3734_replayed:false,
          original_event_3735_replayed:false,
          physical_admission_authorized:false,
          permit_authorized:false,
          evidence:preserved
        };
        if(result.status!=="PASS")blockers.push({
          blocker_class:"EXACT_F654_DA9_TWO_PARENT_SIGNED_SOURCE_INVALID",
          check_id:decision.check_id,detail:preserved
        });
      } else if (
        // #3734 owner-event binding was checked on its original PR and merged.
        // On the exact first postmerge main, validate that proof's immutable
        // history instead of re-running an event-bound check for PR #3734.
        decision.check_id === "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING" &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "b2e846d4b10a5d124d6060998ef1c9a2895391e4" &&
        isAncestor(args.base, args.head || "")
      ) {
        const postmergeCommand =
          "node scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_POSTMERGE_INTEGRATION_PRESERVATION_V1.cjs";
        const diagnostic = runDiagnostic(postmergeCommand, {}, decision.check_id);
        result = {
          ...common,
          execution: "POSTMERGE_ORIGINAL_TWO_PARENT_INTEGRATION_IMMUTABILITY_REVALIDATION",
          status: diagnostic.status,
          reason_code: diagnostic.status === "PASS"
            ? "POSTMERGE_ORIGINAL_INTEGRATION_PROOF_REVALIDATED_NO_EVENT_REPLAY"
            : "POSTMERGE_ORIGINAL_INTEGRATION_PROOF_INVALID",
          diagnostic_command: postmergeCommand,
          original_event_3734_replayed: false,
          physical_admission_authorized: false,
          permit_authorized: false,
          diagnostic,
        };
        if (diagnostic.status !== "PASS") blockers.push({
          blocker_class: "POSTMERGE_ORIGINAL_TWO_PARENT_PROOF_INVALID",
          check_id: decision.check_id,
          detail: diagnostic,
        });
      } else if (
        decision.check_id === "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING" &&
        stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
        args.base === "63dc3382f879781c604a852c7d1b28af9b0dd9f4" &&
        process.env.GITHUB_ACTIONS === "true" &&
        process.env.GITHUB_EVENT_NAME === "pull_request" &&
        fs.existsSync(path.join(ROOT,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs"))
      ) {
        // Original #3734 PR-event cannot run on new PR #3746. Verify its six
        // original Ed25519 signatures against the ORIGINAL source, then verify
        // owner-direct new-source review with actual native GitHub provenance.
        // No new signature, historical zero-drift assertion, or Host/Permit.
        const signed=require("./VERIFY_MCFT_CAP09_3746_CURRENT_COMPOSER_OWNER_REQUAL_V1.cjs")
          .verifyCurrentOwnerSignedHistory({decision,stage,head:args.head||"",base:args.base||""});
        result={...common,
          execution:"CURRENT_OWNER_DIRECTED_NEW_SOURCE_WITH_HISTORICAL_SIX_SIGNER_VALIDATION",
          status:signed?.status??"FAIL",
          reason_code:signed?.reason_code??"HOLD_SIGNED_HISTORY_INVALID",
          evidence_id:signed?.evidence_id??null,
          original_event_3734_replayed:false,
          independent_new_signature_claimed:false,
          original_formal_six_stages:0,
          physical_admission_authorized:false,
          permit_authorized:false,
          exact_current_owner_source_and_original_signature_proof:signed};
        if(result.status!=="PASS")blockers.push({
          blocker_class:"CURRENT_SOURCE_OWNER_DIRECTED_GOVERNANCE_REVIEW_INVALID",
          check_id:decision.check_id,detail:signed
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
                args.base || null,
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
            decision.check_id,
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
        const evidence = resolveRequalificationEvidence(decision, authority, registry, stage, args.head || null, args.base || null);
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
  t0SuccessorDependencyDelta,
  validateAm19T0GraduationCarryForwardV1,
  validatePhase5T0GraduationCarryForwardV1,
  resolveRequalificationEvidence,
  expectedRequalificationBinding,
  validateExactRunAnchor,
};

if (require.main === module) main();
