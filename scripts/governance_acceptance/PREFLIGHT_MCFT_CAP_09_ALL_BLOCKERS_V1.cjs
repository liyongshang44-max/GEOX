#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  planApplicability,
  evidenceIsStructurallyValid,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_OUT = "acceptance-output/MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json";

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

  for (const error of plan.authority_errors || []) {
    blockers.push({ blocker_class: "AUTHORITY_DEFINITION_FAILURE", check_id: null, detail: error });
  }
  for (const unknownPath of plan.unknown_changed_paths) {
    blockers.push({ blocker_class: "UNKNOWN_CHANGED_PATH", check_id: null, detail: unknownPath });
  }
  for (const error of plan.resolver_errors) {
    blockers.push({ blocker_class: "DEPENDENCY_RESOLVER_FAILURE", check_id: null, detail: error });
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
      if (decision.diagnostic_command) {
        const diagnostic = runDiagnostic(decision.diagnostic_command);
        result = { ...common, execution: "DIAGNOSTIC_COMMAND", status: diagnostic.status, reason_code: diagnostic.status === "PASS" ? "DIAGNOSTIC_PASS" : "DIAGNOSTIC_FAIL", diagnostic_command: decision.diagnostic_command, diagnostic };
        if (diagnostic.status !== "PASS") blockers.push({ blocker_class: "DIAGNOSTIC_FAILURE", check_id: decision.check_id, detail: diagnostic });
      } else {
        result = { ...common, execution: "NO_DIAGNOSTIC_AVAILABLE", status: "FAIL", reason_code: "REQUIRED_OR_REQUALIFY_WITHOUT_DIAGNOSTIC" };
        blockers.push({ blocker_class: "UNRESOLVED_REQUIRED_CHECK", check_id: decision.check_id, detail: decision.reason_code });
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

if (require.main === module) main();
