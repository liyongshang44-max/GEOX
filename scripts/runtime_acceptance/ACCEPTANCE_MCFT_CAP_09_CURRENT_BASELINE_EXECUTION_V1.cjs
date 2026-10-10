#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), cp = require("node:child_process"), crypto = require("node:crypto");
const x = require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
const recovery = require("./RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V2.cjs");
let count = 0; function negative(f) { assert.throws(f); count++; }
for (const file of ["RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION", "RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE", "AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT"]) {
  const before=fs.readFileSync(path.join(__dirname,file+"_V1.ts"),"utf8"),after=fs.readFileSync(path.join(__dirname,file+"_V2.ts"),"utf8");
  for(const line of before.split("\n").filter(line=>line.trim().startsWith("assert.")))assert(after.includes(line),"HISTORICAL_ASSERTION_REMOVED:"+file+":"+line.trim());
  assert(after.includes("const currentTargets = currentExecution.qualificationTargets();")); count++;
  if(process.env.MCFT_CURRENT_ENTRY_COMPILE_TEST==="1") {
    const result=cp.spawnSync(process.execPath,["--import","tsx",path.join(__dirname,file+"_V2.ts")],{cwd:x.ROOT,encoding:"utf8",env:{...process.env,CI:"1"}});
    assert.equal(result.status,1);assert.match(result.stderr,/CURRENT_EXECUTION_NOT_ARMED/); count++;
  }
}
const context = {head: "a".repeat(40), main: "a".repeat(40), clean: true, base_ancestor: true, frozen_runtime_identical: true, ci: false, platform: "win32", now: "2026-10-10T02:00:00.000Z"};
const arm = {schema_version: "geox_mcft_cap09_current_baseline_execution_arm_v1", armed: true, mode: "ISOLATED_QUALIFICATION", adopted_base_sha: x.BASE, execution_subject_binding: "EXACT_ADOPTED_PROTECTED_MAIN", expires_at: "2026-10-10T03:00:00.000Z", qualification_first_base: "2026-10-10T09:00:00.000Z", isolated_run_id: "123456abcdef", qualification_execution_authorized: true, production_recovery_authorized: false, new_image_build_and_two_role_cutover_authorized: false, formal_v5_arm_authorized: false, a0_authorized: false, o00_authorized: false, historical_attempt_reset_authorized: false};
assert.equal(x.validateArm(arm, arm.mode, context).execution_subject_sha, context.head); count++;
for (const [k, v] of [["armed", false], ["mode", "CANONICAL_RECOVERY_REBOOTSTRAP"], ["adopted_base_sha", "0".repeat(40)], ["execution_subject_binding", "ANY_SHA"], ["expires_at", "2026-10-10T01:59:00.000Z"], ["qualification_first_base", "2026-10-10T08:00:00.000Z"], ["isolated_run_id", "production"], ["production_recovery_authorized", true], ["new_image_build_and_two_role_cutover_authorized", true], ...["formal_v5_arm_authorized", "a0_authorized", "o00_authorized", "historical_attempt_reset_authorized"].map(k => [k, true])]) {
  negative(() => x.validateArm({...arm, [k]: v}, arm.mode, context));
}
for (const [k, v] of [["main", "b".repeat(40)], ["clean", false], ["base_ancestor", false], ["frozen_runtime_identical", false], ["ci", true], ["platform", "linux"]]) negative(() => x.validateArm(arm, arm.mode, {...context, [k]: v}));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "geox-current-entry-tests-"));
const previousLogRoot = process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT;
try {
  const env = {DATABASE_URL: "postgres://login:test@127.0.0.1/mcft_cap09_requal_123456abcdef_positive", BLOCKED_DATABASE_URL: "postgres://login:test@127.0.0.1/mcft_cap09_requal_123456abcdef_negative", MCFT_CAP09_FORMAL_RAW_ENDPOINT: "http://127.0.0.1:9000", MCFT_CAP09_FORMAL_RAW_BUCKET: "mcft-cap09-requal-123456abcdef", MCFT_QUALIFICATION_FIRST_BASE: arm.qualification_first_base, MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR: path.join(temp, "qualification")};
  assert.equal(x.isolatedTargets(arm, env).positive, "mcft_cap09_requal_123456abcdef_positive"); count++;
  for (const [k, v] of [["DATABASE_URL", "postgres://login:test@production.example/geox_mcft_cap09_production_runtime_v1"], ["DATABASE_URL", env.DATABASE_URL + "?host=production.example"], ["BLOCKED_DATABASE_URL", env.DATABASE_URL], ["MCFT_CAP09_FORMAL_RAW_ENDPOINT", "https://production.example"], ["MCFT_CAP09_FORMAL_RAW_BUCKET", "geox-mcft-cap09-formal-raw-v1"], ["MCFT_QUALIFICATION_FIRST_BASE", "2026-09-02T18:00:00.000Z"], ["MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR", x.ROOT]]) negative(() => x.isolatedTargets(arm, {...env, [k]: v}));
  const failed = {status: "FAIL", phase: "GFS_PAIR_WAIT", owner_verified: true, operator_reconciliation_required: true, image_id: "sha256:b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456", formal_v5_arm: false, a0_execution: false, o00_started: false};
  const bytes = Buffer.from(JSON.stringify(failed)), digest = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  const a = {...arm, mode: "CANONICAL_RECOVERY_REBOOTSTRAP", qualification_execution_authorized: false, production_recovery_authorized: true, new_image_build_and_two_role_cutover_authorized: true, source_failed_receipt_sha256: digest, stage_ref: "docs/stage.json", execution_subject_sha: context.head};
  x.validateArm(a, a.mode, context); count++;
  const reconciled = recovery.reconcile(failed, a, bytes);
  assert.equal(reconciled.current_evidence_health_required_before_rebootstrap, false);
  assert.equal(reconciled.current_owner_health_and_renewal_required_after_rebootstrap, true); count++;
  negative(() => recovery.reconcile(failed, {...a, source_failed_receipt_sha256: "sha256:" + "0".repeat(64)}, bytes));
  for (const [k, v] of [["owner_verified", false], ["phase", "PRECHECK"], ["formal_v5_arm", true], ["image_id", "sha256:" + "0".repeat(64)]]) negative(() => recovery.reconcile({...failed, [k]: v}, a, bytes));
  const receipt = path.join(temp, "failed.json"); fs.writeFileSync(receipt, bytes);
  const logRoot = path.join(temp, "logs"); fs.mkdirSync(path.join(logRoot, "evidence"), {recursive: true});
  const log = path.join(logRoot, "evidence/runtime.log"), history = Array(3).fill(JSON.stringify({runtime_role: "EVIDENCE_RUNTIME", failure_token: "PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW"})).join("\n") + "\n";
  fs.writeFileSync(log, history); process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT = logRoot;
  let called = 0;
  const out = path.join(temp, "recovery");
  const r = recovery.execute(a, receipt, bytes, a.stage_ref, out, argv => {
    called++; assert(argv[0].endsWith("RUN_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs"));
    const child = path.join(out, "new-window"); fs.mkdirSync(child);
    fs.writeFileSync(path.join(child, "result.json"), JSON.stringify({status: "PASS", subject_sha: a.execution_subject_sha, stage_ref: a.stage_ref, production_owner_cutover_observed: true, evidence_acquisition_observed: true, formal_v5_arm: false, a0_execution: false, o00_started: false}));
    fs.appendFileSync(log, "new health record\n"); return 0;
  });
  assert.equal(called, 1); assert.equal(r.historical_attempt_reset, false);
  assert.equal(fs.readFileSync(path.join(out, "historical-evidence-runtime.log"), "utf8"), history);
  assert.deepEqual(fs.readFileSync(receipt), bytes); count++;
  negative(() => recovery.execute({...a, armed: false}, receipt, bytes, a.stage_ref, path.join(temp, "unauthorized"), () => { called++; }));
  assert.equal(called, 1); assert(!fs.existsSync(path.join(temp, "unauthorized")));
  negative(() => recovery.execute(a, receipt, bytes, a.stage_ref, out, () => { called++; }));
  assert.equal(called, 1);
  for (const [file, args] of [["RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V2.cjs", ["--operator-authorized", "--execute", "--failed=/does-not-exist"]], ["RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs", ["--operator-authorized", "--execute", "--all"]]]) {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, file), ...args], {encoding: "utf8", env: {...process.env, CI: "1"}});
    assert.equal(r.status, 1); assert.match(r.stderr, /CURRENT_EXECUTION_NOT_ARMED/); count++;
  }
} finally {
  if (previousLogRoot === undefined) delete process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT; else process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT = previousLogRoot;
  fs.rmSync(temp, {recursive: true, force: true});
}
console.log(JSON.stringify({status: "PASS", test_count: count, qualification: "ENGINEERING_ENTRY_BOUNDARY_ONLY", real_provider_requests: 0, production_writes: 0, live_owner_proven: false, producer_qualified: false, timing_qualified: false}));
