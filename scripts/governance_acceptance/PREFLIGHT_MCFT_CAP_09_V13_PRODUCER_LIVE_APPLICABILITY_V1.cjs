#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  planApplicability,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
const {
  resolveRequalificationEvidence,
} = require("./PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const CHECK_ID = "V13_PRODUCER_DRIVEN_QUALIFICATION";
const DEFAULT_OUT = "acceptance-output/MCFT_CAP_09_V13_PRODUCER_LIVE_APPLICABILITY_V1_RESULT.json";

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
  if (!base || !head) throw new Error("V13_PRODUCER_LIVE_APPLICABILITY_BASE_AND_HEAD_REQUIRED");
  const text = cp.execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: ROOT, encoding: "utf8" });
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const authority = readJson(AUTHORITY_PATH);
  const registry = readJson(REGISTRY_PATH);
  const stage = args.stage || authority.default_stage;
  const changed = changedPaths(args.base, args.head);
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
  if (plan.status !== "PASS") throw new Error("V13_PRODUCER_LIVE_APPLICABILITY_PLAN_NOT_PASS");

  const decision = plan.decisions.find((row) => row.check_id === CHECK_ID);
  if (!decision) throw new Error("V13_PRODUCER_LIVE_APPLICABILITY_DECISION_MISSING");

  let liveRequired = false;
  let reasonCode = decision.reason_code;
  let evidence = null;

  if (decision.status === "REQUALIFY") {
    evidence = resolveRequalificationEvidence(decision, authority, registry, stage, args.head);
    if (evidence.status === "PASS") {
      liveRequired = false;
      reasonCode = evidence.reason_code;
    } else if (evidence.reason_code === "NO_VALID_REQUALIFICATION_EVIDENCE") {
      liveRequired = true;
      reasonCode = evidence.reason_code;
    } else {
      throw new Error(`V13_PRODUCER_LIVE_APPLICABILITY_EVIDENCE_INVALID:${evidence.reason_code}`);
    }
  } else if (decision.status === "REQUIRED") {
    liveRequired = true;
  } else if (decision.status === "NOT_APPLICABLE") {
    liveRequired = false;
  } else {
    throw new Error(`V13_PRODUCER_LIVE_APPLICABILITY_UNSAFE_DECISION:${decision.status}:${decision.reason_code}`);
  }

  const output = {
    preflight_id: "MCFT_CAP09_V13_PRODUCER_LIVE_APPLICABILITY_V1",
    status: "PASS",
    check_id: CHECK_ID,
    stage,
    generation: plan.generation,
    base_sha: args.base || null,
    head_sha: args.head || null,
    decision_status: decision.status,
    reason_code: reasonCode,
    dependency_digest: decision.dependency_digest,
    live_required: liveRequired,
    evidence_id: evidence?.evidence_id || null,
    evidence_run_id: evidence?.run_id || null,
    evidence_subject_sha: evidence?.subject_sha || null,
    non_effects: {
      production_runtime_mutation: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false
    }
  };
  const outPath = path.resolve(ROOT, args.out || DEFAULT_OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
