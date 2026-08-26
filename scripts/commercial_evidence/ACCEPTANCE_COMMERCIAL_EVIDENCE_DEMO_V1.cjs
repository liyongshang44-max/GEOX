// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
// Purpose: prove the off-main Commercial Evidence Demo is evidence-faithful to current GEOX software boundaries:
// Decision Assurance qualification, human approval, operation-plan/task separation, receipt/as-executed/acceptance,
// and explicit non-claims for unified production qualification, autonomous actuation, and customer ROI.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const files = {
  packet: path.join(ROOT, "tools/commercial-evidence-demo/packet.ts"),
  server: path.join(ROOT, "tools/commercial-evidence-demo/server.ts"),
  html: path.join(ROOT, "tools/commercial-evidence-demo/index.html"),
  app: path.join(ROOT, "tools/commercial-evidence-demo/app.js"),
  style: path.join(ROOT, "tools/commercial-evidence-demo/styles.css"),
  selftest: path.join(ROOT, "tools/commercial-evidence-demo/selftest.ts"),
  smoke: path.join(ROOT, "scripts/commercial_evidence/SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1.mjs"),
  docs: path.join(ROOT, "docs/commercial/COMMERCIAL-EVIDENCE-DEMO-V1.md"),
  approvalActions: path.join(ROOT, "apps/server/src/routes/v1/operator_approval_actions.ts"),
  approvalRoute: path.join(ROOT, "apps/server/src/routes/control_approval_request_v1.ts"),
  taskBoundary: path.join(ROOT, "scripts/governance_acceptance/ACCEPTANCE_TASK_FROM_READY_OPERATION_PLAN_BOUNDARY_V1.cjs"),
  planAcceptance: path.join(ROOT, "scripts/runtime_acceptance/ACCEPTANCE_OPERATION_PLAN_FROM_APPROVED_DECISION_RUNTIME_V1.cjs"),
  irrigationLoop: path.join(ROOT, "scripts/agronomy_acceptance/ACCEPTANCE_IRRIGATION_CLOSED_LOOP_V1.cjs"),
  acceptanceSemantics: path.join(ROOT, "docs/ACCEPTANCE_RESULT_VERDICT_SEMANTICS.md"),
};

function text(file) { return fs.readFileSync(file, "utf8"); }
function requireToken(name, content, token) {
  if (!content.includes(token)) throw new Error(`COMMERCIAL_EVIDENCE_DEMO_TOKEN_MISSING:${name}:${token}`);
}
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`COMMERCIAL_EVIDENCE_DEMO_FILE_MISSING:${name}:${file}`);
}

const packet = text(files.packet);
const server = text(files.server);
const html = text(files.html);
const app = text(files.app);
const style = text(files.style);
const docs = text(files.docs);
const approvalActions = text(files.approvalActions);
const approvalRoute = text(files.approvalRoute);
const taskBoundary = text(files.taskBoundary);
const planAcceptance = text(files.planAcceptance);
const irrigationLoop = text(files.irrigationLoop);
const acceptanceSemantics = text(files.acceptanceSemantics);

for (const token of [
  "selectExternalFormalCurrentIntervalForcingV1", "healthy_exact_provider_pair", "provider_late", "source_conflict",
  "missing_evidence", "DEGRADE_AND_CONTINUE", "FAIL_CLOSED", "NO_FORMAL_O00_O23_CLAIM",
]) requireToken("packet", packet, token);

for (const token of [
  "standalone read-only Commercial Evidence Demo microsite", "/api/runtime-value-trace", "/api/twin-trace",
  "/api/mcft-runtime-evidence", "COMMERCIAL_EVIDENCE_MCFT_READ_URL", "geox_mcft_cap09_s6_accel24t_am19_v3",
  "MCFT_DATABASE_NOT_ALLOWLISTED", "BEGIN READ ONLY", "SET LOCAL statement_timeout", "ROLLBACK",
  "database_write_count: 0", "canonical_runtime_write_count: 0", "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED",
]) requireToken("server", server, token);

for (const token of [
  "不是“能不能给答案”，而是“这个答案现在能不能进入真实生产”",
  "今晚原计划灌溉 20 mm", "明天可能下雨 25 mm", "IRRIGATE / DELAY / ABSTAIN", "ASSUMPTION",
  "18:43", "19:17", "ELIGIBLE · 可以使用", "INELIGIBLE · 不得回填",
  "没有满足本次审批条件的合法替代证据", "批准 · 拒绝 · 退回补充", "APPROVE / REJECT / RETURN",
  "Approval → Operation Plan → 授权后创建 Action Task", "审批通过本身不会自动触发设备动作",
  "执行完成 ≠ 农业效果已经被证明", "组合客户流程演示", "不代表这两条能力线已经完成统一",
  "影子模式", "Demo Input",
]) requireToken("html", html, token);

for (const token of [
  "NORMAL", "PROVIDER LATE", "SOURCE CONFLICT", "MISSING EVIDENCE",
  'data-case-id="healthy_exact_provider_pair"', 'data-case-id="provider_late"',
  'data-case-id="source_conflict"', 'data-case-id="missing_evidence"',
]) requireToken("html", html, token);
for (const token of ["/api/demo?case=", "canonical selector 已重新执行", "machine_proof", "使用上一步的合规假设值", "降级继续"]) requireToken("app", app, token);

// Product-side control-loop boundaries: verify current repo code, not marketing prose.
for (const token of ["APPROVAL_APPROVE", "APPROVAL_REJECT", "APPROVAL_RETURN", "SELF_APPROVAL_BLOCKED", "operator_action_audit_v1"]) requireToken("approvalActions", approvalActions, token);
for (const token of ["operation_plan_v1", "buildOperationPlanFromApprovalDecisionV1"]) requireToken("approvalRoute", approvalRoute, token);
for (const token of ["/api/v1/actions/task/from-operation-plan", "operation_plan_transition_v1", "ao_act_receipt_v1", "acceptance_result_v1", "route does not write"]) requireToken("taskBoundary", taskBoundary, token);
for (const token of ["operation plan act_task_id = null", "operation_plan_transition_v1", "no ${type} fact is created"]) requireToken("planAcceptance", planAcceptance, token);
for (const token of ["/api/v1/actions/task", "/api/v1/actions/receipt", "/api/v1/as-executed/from-receipt", "/api/v1/acceptance/evaluate", "no_direct_recommendation_to_task"]) requireToken("irrigationLoop", irrigationLoop, token);
for (const token of ["PASS", "FAIL", "PARTIAL", "不等于 operation `final_status`"]) requireToken("acceptanceSemantics", acceptanceSemantics, token);

for (const token of [
  'id="subjectSha"', 'id="selectorId"', 'id="runtimeCaseButtons"', 'id="interactiveMachineProof"',
  'id="runtimeComparison"', 'id="traceFlow"', 'id="mcftRuntimeStatus"', 'id="mcftRuntimeObjects"',
  'id="behaviorMatrix"', 'id="releaseGateSummary"', 'id="releaseManifestRows"', 'id="architectureFlow"',
  'id="failureCards"', 'id="decisionCycleId"', 'id="runtimeTraceObjects"', 'id="persistedTraceObjects"',
  'id="nonclaims"', 'id="fatalError"',
]) requireToken("html", html, token);

for (const token of [
  "CUSTOMER_RATE_CARD", "CUSTOMER DATA REQUIRED", "MEASURED", "AGRONOMIC_MODEL", "EXTERNAL_BENCHMARK",
  "NOT_PROVEN_CUSTOMER_ROI", "本 Demo 不把仓库工程 cost constants 当作客户 ROI authority",
  "连续在线数字孪生运行已完成最终正式验收", "生产资格化的作物推荐", "已证明的客户 ROI",
  "AI 绕过人工审批直接进行生产作业",
]) requireToken("html", html, token);

for (const token of ["技术细节｜默认折叠", "Decision Assurance Runtime + Commercial Control Loop", "Runtime qualification boundary", "精确文件路径不在此虚构"]) requireToken("html", html, token);
for (let section = 1; section <= 6; section += 1) requireToken("html", html, `data-section="${section}"`);
requireToken("style", style, ".topbar { position: relative;");
requireToken("style", style, ".executive-trace-grid { grid-template-columns: repeat(3");
for (const token of ["NOT PRODUCTION AUTHORITY", "PERSISTED ENGINEERING QUALIFICATION", "COMMERCIAL_EVIDENCE_MCFT_READ_URL", "Machine-verifiable proof", "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF", "NOT_PROVEN_CUSTOMER_ROI"]) requireToken("docs", docs, token);

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const selectorRun = spawnSync(pnpm, ["exec", "tsx", "tools/commercial-evidence-demo/selftest.ts"], { cwd: ROOT, encoding: "utf8", env: process.env });
if (selectorRun.status !== 0) {
  process.stderr.write(selectorRun.stdout || "");
  process.stderr.write(selectorRun.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_DEMO_CANONICAL_SELFTEST_FAILED:${selectorRun.status}`);
}
let selftest;
try { selftest = JSON.parse(selectorRun.stdout.trim()); } catch { throw new Error("COMMERCIAL_EVIDENCE_DEMO_SELFTEST_NON_JSON_OUTPUT"); }
if (selftest.ok !== true || selftest.canonical_runtime_code_executed !== true) throw new Error("COMMERCIAL_EVIDENCE_DEMO_SELFTEST_NOT_PASS");
if (selftest.provider_late_behavior !== "DEGRADE_AND_CONTINUE") throw new Error("COMMERCIAL_EVIDENCE_DEMO_PROVIDER_LATE_BEHAVIOR_DRIFT");
if (selftest.source_conflict_behavior !== "FAIL_CLOSED") throw new Error("COMMERCIAL_EVIDENCE_DEMO_SOURCE_CONFLICT_BEHAVIOR_DRIFT");
if (selftest.missing_evidence_behavior !== "FAIL_CLOSED") throw new Error("COMMERCIAL_EVIDENCE_DEMO_MISSING_EVIDENCE_BEHAVIOR_DRIFT");
if (selftest.provider_request_count !== 0 || selftest.database_write_count !== 0 || selftest.canonical_runtime_write_count !== 0) throw new Error("COMMERCIAL_EVIDENCE_DEMO_SIDE_EFFECT_BOUNDARY_DRIFT");

const traceRun = spawnSync(process.execPath, ["scripts/governance_acceptance/TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs"], { cwd: ROOT, encoding: "utf8", env: process.env });
if (traceRun.status !== 0) {
  process.stderr.write(traceRun.stdout || "");
  process.stderr.write(traceRun.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_FAILED:${traceRun.status}`);
}
let runtimeTrace;
try { runtimeTrace = JSON.parse(traceRun.stdout.trim()); } catch { throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_NON_JSON_OUTPUT"); }
if (runtimeTrace.ok !== true || runtimeTrace.runtime_builders_invoked !== true || runtimeTrace.complete_tk_chain_built !== true || runtimeTrace.determinism_stable !== true || runtimeTrace.forbidden_auto_writes_absent !== true) throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_NOT_PASS");
const derived = runtimeTrace?.twin_trace?.system_derived ?? {};
const requiredTraceObjects = ["field_state_snapshot_v1", "forecast_run_v1", "scenario_set_v1", "calibration_replay_v1", "forecast_error_v1", "field_learning_candidate_v1", "decision_cycle_v1"];
if (!requiredTraceObjects.every((objectType) => derived[objectType] && derived[objectType].determinism_hash)) throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_OBJECT_CHAIN_INCOMPLETE");

const smokeEnv = { ...process.env, COMMERCIAL_EVIDENCE_MCFT_READ_URL: "" };
const smokeRun = spawnSync(process.execPath, ["scripts/commercial_evidence/SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1.mjs"], { cwd: ROOT, encoding: "utf8", env: smokeEnv, timeout: 30_000 });
if (smokeRun.status !== 0) {
  process.stderr.write(smokeRun.stdout || "");
  process.stderr.write(smokeRun.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_DEMO_HTTP_SMOKE_FAILED:${smokeRun.status}:${smokeRun.signal ?? "NO_SIGNAL"}`);
}
let smoke;
try { smoke = JSON.parse(smokeRun.stdout.trim()); } catch { throw new Error("COMMERCIAL_EVIDENCE_DEMO_HTTP_SMOKE_NON_JSON_OUTPUT"); }
if (smoke.ok !== true || smoke.standalone_server_started !== true || smoke.healthz_passed !== true || smoke.canonical_demo_endpoint_passed !== true || smoke.runtime_value_trace_endpoint_passed !== true || smoke.mcft_neon_endpoint_passed !== true || smoke.mcft_neon_unconfigured_fails_safe !== true || smoke.mcft_neon_read_only !== true || smoke.mcft_neon_write_count !== 0 || smoke.six_section_page_served !== true || smoke.write_method_rejected !== true) throw new Error("COMMERCIAL_EVIDENCE_DEMO_HTTP_SMOKE_NOT_PASS");

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1",
  commercial_gate: "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF",
  paid_pilot_scope: "DECISION_ASSURANCE_PAID_PILOT",
  narrative_version: "ANSWER_TO_PRODUCTION_ELIGIBILITY_V2",
  decision_assurance_machine_proof: true,
  provider_late_behavior: selftest.provider_late_behavior,
  source_conflict_behavior: selftest.source_conflict_behavior,
  missing_evidence_behavior: selftest.missing_evidence_behavior,
  human_approval_repo_path_verified: true,
  approval_plan_task_separation_verified: true,
  receipt_as_executed_acceptance_paths_verified: true,
  execution_not_equated_with_agronomic_effect: true,
  combined_workflow_marked_not_unified_production_qualification: true,
  customer_economics_provenance_guard_present: true,
  customer_roi_claim_absent: true,
  runtime_value_trace_builder_chain_passed: true,
  runtime_value_trace_object_count: requiredTraceObjects.length,
  standalone_http_smoke_passed: true,
  provider_request_count: 0,
  database_write_count: 0,
  canonical_runtime_write_count: 0,
  formal_effect: false,
}, null, 2));
