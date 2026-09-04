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

function runDiagnostic(command) {
  const result = cp.spawnSync(command, { cwd: ROOT, encoding: "utf8", shell: true, env: { ...process.env, MCFT_CAP09_ALL_BLOCKERS_CHILD: "1" } });
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

function validateRuntimeCutoverPhase5Requalification(decision, head, base) {
  const anchor = RUNTIME_CUTOVER_PHASE5_REQUALIFICATION_V1;
  const fetchResult = fetchGithubRunSnapshot(anchor.run_id);
  if (fetchResult.status !== "PASS") return { ...fetchResult, evidence_id: anchor.evidence_id };
  const run = fetchResult.run;
  const liveBase = Array.isArray(run.pull_requests)
    ? run.pull_requests.map((pr) => pr?.base?.sha).find((value) => typeof value === "string") || null
    : null;
  const checks = {
    check_id_match: decision.check_id === anchor.check_id,
    dependency_digest_match: decision.dependency_digest === anchor.dependency_digest,
    requested_base_match: base === anchor.base_sha,
    subject_is_ancestor_of_head: isAncestor(anchor.subject_sha, head),
    run_id_match: run.id === anchor.run_id,
    run_success: run.status === "completed" && run.conclusion === anchor.run_conclusion,
    run_head_match: run.head_sha === anchor.subject_sha,
    run_base_match: liveBase === anchor.base_sha,
    run_event_match: run.event === anchor.event,
    run_workflow_name_match: run.name === anchor.workflow_name,
    run_workflow_path_match: run.path === anchor.workflow_path,
  };
  const valid = Object.values(checks).every(Boolean);
  return {
    status: valid ? "PASS" : "FAIL",
    reason_code: valid
      ? "RUNTIME_CUTOVER_PHASE5_EXACT_RUN_AND_DEPENDENCY_DIGEST_VALID"
      : "RUNTIME_CUTOVER_PHASE5_EXACT_RUN_OR_DEPENDENCY_DIGEST_INVALID",
    evidence_id: anchor.evidence_id,
    run_id: anchor.run_id,
    subject_sha: anchor.subject_sha,
    dependency_digest: anchor.dependency_digest,
    checks,
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
    const adoptionDurableRequalification =
      stage === "SUCCESSOR_SUBJECT_PRE_MERGE" &&
      (
        (/^[0-9a-f]{40}$/.test(protectedMainAdoptionBase) && args.base === protectedMainAdoptionBase) ||
        (/^[0-9a-f]{40}$/.test(postAdoptionEffectivenessBase) && args.base === postAdoptionEffectivenessBase) ||
        (/^[0-9a-f]{40}$/.test(postEffectivenessRuntimeCutoverBase) && args.base === postEffectivenessRuntimeCutoverBase)
      ) &&
      PROTECTED_MAIN_ADOPTION_DURABLE_REQUALIFICATION_CHECKS.has(decision.check_id);
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
    } else if (decision.status === "REQUALIFY" || decision.status === "REQUIRED") {
      if (phase6Active && decision.check_id === "EA5E2_RUNTIME_DEPENDENCY_GRAPH") {
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
        const diagnostic = runDiagnostic(decision.diagnostic_command);
        result = { ...common, execution: "DIAGNOSTIC_COMMAND", status: diagnostic.status, reason_code: diagnostic.status === "PASS" ? "DIAGNOSTIC_PASS" : "DIAGNOSTIC_FAIL", diagnostic_command: decision.diagnostic_command, diagnostic };
        if (diagnostic.status !== "PASS") blockers.push({ blocker_class: "DIAGNOSTIC_FAILURE", check_id: decision.check_id, detail: diagnostic });
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
};

if (require.main === module) main();