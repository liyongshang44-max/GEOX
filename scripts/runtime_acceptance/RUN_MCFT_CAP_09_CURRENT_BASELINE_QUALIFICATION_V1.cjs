#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const {ROOT, authorize, isolatedTargets} = require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
function main() {
  const args = process.argv.slice(2);
  assert(args.includes("--operator-authorized"), "CURRENT_QUALIFICATION_OPERATOR_AUTHORIZATION_REQUIRED");
  assert(args.includes("--execute") !== args.includes("--preflight-only"), "CURRENT_QUALIFICATION_SELECT_ONE_MODE");
  assert(args.every(x => ["--operator-authorized", "--execute", "--preflight-only", "--producer", "--timing", "--all"].includes(x)), "CURRENT_QUALIFICATION_UNKNOWN_ARGUMENT");
  const modes = args.filter(x => ["--producer", "--timing", "--all"].includes(x));
  assert.equal(modes.length, 1, "CURRENT_QUALIFICATION_SELECT_ONE_TASK");
  const a = authorize("ISOLATED_QUALIFICATION");
  const env = {...process.env, MCFT_SUBJECT_SHA: a.execution_subject_sha, MCFT_QUALIFICATION_FIRST_BASE: a.qualification_first_base};
  const targets = isolatedTargets(a, env);
  if (args.includes("--preflight-only")) { console.log(JSON.stringify({status: "PREFLIGHT_ONLY_NOT_QUALIFIED", subject_sha: a.execution_subject_sha, isolation_targets_valid: true, provider_requests: 0, production_writes: 0})); return; }
  assert(!fs.existsSync(targets.out), "CURRENT_QUALIFICATION_NEW_OUTPUT_REQUIRED");
  // Check scientific dependencies before any database connection or provider request.
  const check = cp.spawnSync(process.env.MCFT_PYTHON_EXECUTABLE || "python", ["apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py", "selftest"], {cwd: ROOT, stdio: "inherit"});
  assert.equal(check.status, 0, "CURRENT_QUALIFICATION_SCIENTIFIC_DEPENDENCIES_REQUIRED");
  fs.mkdirSync(targets.out, {recursive: true});
  fs.writeFileSync(path.join(targets.out, "started.json"), JSON.stringify({subject_sha: a.execution_subject_sha, authority: a, task: modes[0], started_at: new Date().toISOString(), production_writes_authorized: false}), {flag: "wx", mode: 0o600});
  function run(file, extra) {
    const r = cp.spawnSync(process.execPath, ["--import", "tsx", "scripts/runtime_acceptance/" + file], {cwd: ROOT, env: {...env, ...extra}, stdio: "inherit"});
    assert.equal(r.status, 0, "CURRENT_QUALIFICATION_TASK_FAILED:" + file);
  }
  if (modes[0] !== "--timing") run("RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts", {MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION: "1"});
  if (modes[0] !== "--producer") {
    const attempt = String(Date.now());
    for (let i = 0; i < 3; i++) {
      const began = Date.now();
      run("RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts", {
        MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE: "1", MCFT_TIMING_SAMPLE_ID: "sample" + (i + 1),
        MCFT_TIMING_RUN_ID: attempt, MCFT_TIMING_RUN_ATTEMPT: "1",
        MCFT_TIMING_BASE_TARGET: new Date(Date.parse(a.qualification_first_base) + i * 3600000).toISOString(),
        MCFT_TIMING_WAKE_DELAY_MS: "0", MCFT_TIMING_JOB_START_SETUP_MS: String(Date.now() - began)
      });
    }
    run("AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts", {MCFT_TIMING_SAMPLE_DIR: targets.out});
  }
  console.log(JSON.stringify({status: "ISOLATED_LOCAL_EXECUTION_COMPLETED_REQUIRES_EVIDENCE_ADJUDICATION", output: targets.out,
    qcp_blockers_closed: false, production_owner_activation: false, formal_v5_arm: false, a0_execution: false, o00_started: false}));
}
if (require.main === module) { try { main(); } catch (e) { console.error(JSON.stringify({status: "CURRENT_QUALIFICATION_BLOCKED", reason: e.message, qualification_pass: false})); process.exitCode = 1; } }
