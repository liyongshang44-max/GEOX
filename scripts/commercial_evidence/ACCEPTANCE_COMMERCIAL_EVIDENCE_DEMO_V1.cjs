// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
// Purpose: prove the off-main Commercial Evidence Demo is evidence-faithful to current GEOX software boundaries,
// keeps customer-visible fields in Chinese, and grounds the default irrigation cost example in a disclosed Michigan benchmark.

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
function rejectToken(name, content, token) {
  if (content.includes(token)) throw new Error(`COMMERCIAL_EVIDENCE_DEMO_FORBIDDEN_CUSTOMER_TOKEN:${name}:${token}`);
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
  "今晚原计划灌溉 20 毫米", "明天可能下雨 25 毫米",
  "18:43", "19:17", "可以参与判断", "不能事后回填",
  "没有满足本次审批条件的合法替代证据", "批准 · 拒绝 · 退回补充",
  "人工审批 → 作业计划 → 授权后创建执行任务", "审批通过本身不会自动触发设备动作",
  "执行完成 ≠ 农业效果已经被证明", "组合客户流程演示", "不代表这两条能力线已经完成统一",
  "影子模式", "演示输入",
]) requireToken("html", html, token);

for (const token of [
  'data-case-id="healthy_exact_provider_pair"', 'data-case-id="provider_late"',
  'data-case-id="source_conflict"', 'data-case-id="missing_evidence"',
]) requireToken("html", html, token);
for (const token of ["/api/demo?case=", "规范选择器已重新执行", "机器证明链", "使用上一步的合规假设值", "降级继续"]) requireToken("app", app, token);

// Customer-visible HTML must not regress to English field labels. Exact code paths and machine identifiers are allowed only in technical evidence blocks.
for (const token of [
  "Commercial Evidence Demo · Draft", "Decision Assurance", "Demo Input", "ASSUMPTION",
  "IRRIGATE / DELAY / ABSTAIN", "CASE A", "CASE B", "ELIGIBLE", "INELIGIBLE",
  "Temporal Decision Assurance", "Commercial Control Loop", "production qualification",
  "Approval → Operation Plan", "Action Task", "FMIS", "Pilot 边界", "Shadow Mode",
  "AI / Model", "Human Approval", "Existing System", "Receipt / Acceptance Evidence",
  "PROVEN NOW", "NOT YET A COMMERCIAL CLAIM", "CUSTOMER DATA REQUIRED", "EXTERNAL_BENCHMARK",
  "NOT_PROVEN_CUSTOMER_ROI", "Runtime qualification boundary", "Decision Assurance Runtime + Commercial Control Loop",
]) rejectToken("html", html, token);

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

// Michigan default scenario uses metric customer-facing units and prefilled values.
for (const token of [
  "密歇根默认基准", "密歇根州立大学推广署", "5.49 美元/英亩·英寸", "0.534 美元/毫米/公顷",
  "田块面积（公顷）", 'id="ecoAreaHa" type="number" min="0" step="0.1" value="48.6"',
  "计划灌溉深度（毫米）", 'id="ecoIrrigationMm" type="number" min="0" step="0.1" value="20"',
  "泵送能源成本（美元/毫米/公顷）", 'id="ecoPumpingRate" type="number" min="0" step="0.001" value="0.534"',
  "其他当次电力费用（美元）", 'id="ecoEnergy" type="number" min="0" step="1" value="0"',
  "当次增量人工成本（美元）", 'id="ecoLabor" type="number" min="0" step="1" value="0"',
  "当次增量维护与磨损（美元）", 'id="ecoEquipment" type="number" min="0" step="1" value="0"',
  "不代表客户实际成本为 0", "错误取消：潜在产量与品质暴露", "尚未证明客户投资回报",
]) requireToken("html", html, token);
for (const token of ["可量化直接暴露", "其中泵送能源成本", "0.534 美元/毫米/公顷", "不是投资回报"]) requireToken("app", app, token);

for (const token of ["技术细节｜默认折叠", "决策资格运行链 + 商业执行闭环", "运行时资格边界"]) requireToken("html", html, token);
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
  narrative_version: "CHINESE_CUSTOMER_SURFACE_V3",
  customer_visible_fields_chinese_guarded: true,
  michigan_metric_defaults_guarded: true,
  decision_assurance_machine_proof: true,
  provider_late_behavior: selftest.provider_late_behavior,
  source_conflict_behavior: selftest.source_conflict_behavior,
  missing_evidence_behavior: selftest.missing_evidence_behavior,
  human_approval_repo_path_verified: true,
  approval_plan_task_separation_verified: true,
  receipt_as_executed_acceptance_paths_verified: true,
  execution_not_equated_with_agronomic_effect: true,
  combined_workflow_marked_not_unified_production_qualification: true,
  customer_roi_claim_absent: true,
  runtime_value_trace_builder_chain_passed: true,
  runtime_value_trace_object_count: requiredTraceObjects.length,
  standalone_http_smoke_passed: true,
  provider_request_count: 0,
  database_write_count: 0,
  canonical_runtime_write_count: 0,
  formal_effect: false,
}, null, 2));