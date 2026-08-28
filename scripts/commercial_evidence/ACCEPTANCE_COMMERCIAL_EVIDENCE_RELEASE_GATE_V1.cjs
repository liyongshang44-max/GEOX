// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1.cjs
// Purpose: guard the paid-pilot Commercial Evidence Demo release boundary and the Chinese customer-facing surface.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const files = {
  packet: path.join(ROOT, "tools/commercial-evidence-demo/packet.ts"),
  html: path.join(ROOT, "tools/commercial-evidence-demo/index.html"),
  app: path.join(ROOT, "tools/commercial-evidence-demo/app.js"),
  releaseManifest: path.join(ROOT, "docs/commercial/COMMERCIAL-EVIDENCE-RELEASE-MANIFEST-V1.md"),
};

function read(file) { return fs.readFileSync(file, "utf8"); }
function requireToken(name, content, token) {
  if (!content.includes(token)) throw new Error(`COMMERCIAL_EVIDENCE_RELEASE_TOKEN_MISSING:${name}:${token}`);
}
function rejectToken(name, content, token) {
  if (content.includes(token)) throw new Error(`COMMERCIAL_EVIDENCE_RELEASE_FORBIDDEN_CLAIM:${name}:${token}`);
}
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`COMMERCIAL_EVIDENCE_RELEASE_FILE_MISSING:${name}:${file}`);
}

const packet = read(files.packet);
const html = read(files.html);
const app = read(files.app);
const releaseManifest = read(files.releaseManifest);

for (const token of [
  'lang="zh-CN"',
  "商业证据演示 · 草稿",
  "不是“能不能给答案”，而是“这个答案现在能不能进入真实生产”",
  "同一个答案，可能有完全不同的资格",
  "一次完整的 GEOX 决策过程",
  "客户真正买的是什么",
  "GEOX 和现有系统是什么关系",
  "当前 GEOX 已经能演示和证明什么",
  "建议从影子模式开始",
  "GEOX 不负责让每一个模型答案都进入生产",
  "技术细节｜默认折叠",
]) requireToken("html", html, token);

for (const token of [
  "1. 可复现启动",
  "pnpm exec tsx tools/commercial-evidence-demo/server.ts",
  "2. 精确代码版本",
  'id="releaseExactSha"',
  "3. 真实机器案例",
  "GET /api/demo",
  "4. 历史持久化工程资格",
  "GET /api/mcft-runtime-evidence",
  "5. 商业执行闭环工程验收",
  "ACCEPTANCE_IRRIGATION_CLOSED_LOOP_V1.cjs",
  'id="releaseManifestRows"',
]) requireToken("html", html, token);

for (const token of [
  "evidence_release_manifest",
  "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF",
  "REAL_MACHINE_EXECUTION",
  "PERSISTED_ENGINEERING_QUALIFICATION",
  "DEMO_SCENARIO_INPUT",
  "CUSTOMER_INPUT",
  "FORMAL_PRODUCTION_EVIDENCE",
  "stage1b_24h_formal",
  "NOT_CLAIMED",
  "runtime_context.subject_sha",
  "GET /api/demo?case=provider_late",
  "GET /api/demo?case=source_conflict",
  "GET /api/demo?case=missing_evidence",
]) requireToken("packet", packet, token);

for (const token of [
  "renderEvidenceReleaseManifest(packet)",
  "packet.evidence_release_manifest",
  "releaseManifestRows",
  "releaseExactSha",
  "真实机器执行",
  "持久化工程资格证据",
  "正式生产证据",
]) requireToken("app", app, token);

for (const token of [
  "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF",
  "Demo Claim → Repo / Runtime implementation → Machine evidence → Evidence class → Status",
  "REAL_MACHINE_EXECUTION",
  "PERSISTED_ENGINEERING_QUALIFICATION",
  "DEMO_SCENARIO_INPUT",
  "CUSTOMER_INPUT",
  "FORMAL_PRODUCTION_EVIDENCE",
  "真实 24h Stage 1B / Formal O00–O23",
  "NOT_CLAIMED",
  "off-main / read-only / standalone / non-authoritative",
]) requireToken("releaseManifest", releaseManifest, token);

for (const token of [
  "决策资格运行链 + 商业执行闭环",
  "两条能力线均已存在，但本演示不声明已经完成统一生产资格验收",
  "审批通过本身不会自动触发设备动作",
  "执行完成 ≠ 农业效果已经被证明",
]) requireToken("html", html, token);

// Exact machine identifiers may remain in technical <code> evidence, but customer field labels must stay Chinese.
for (const forbidden of [
  "Commercial Evidence Demo · Draft", "Decision Assurance", "Demo Input", "CASE A", "CASE B",
  "ELIGIBLE", "INELIGIBLE", "Temporal Decision Assurance", "Commercial Control Loop",
  "Approval → Operation Plan", "Action Task", "FMIS", "Shadow Mode", "AI / Model",
  "Human Approval", "Existing System", "NOT YET A COMMERCIAL CLAIM", "CUSTOMER DATA REQUIRED",
  "EXTERNAL_BENCHMARK", "NOT_PROVEN_CUSTOMER_ROI",
]) rejectToken("html", html, forbidden);

for (const forbidden of [
  "Stage 1B 已完成",
  "24h production-qualified",
  "Final Formal O00–O23 complete",
  "GEOX 已经安全自动控制灌溉",
  "GEOX 已经证明客户 ROI",
]) {
  rejectToken("html", html, forbidden);
  rejectToken("packet", packet, forbidden);
}

for (const token of [
  "连续在线数字孪生运行已完成最终正式验收",
  "已经自动控制所有农业设备",
  "无人值守现场执行",
  "生产资格化的作物推荐",
  "已证明的客户投资回报",
  "人工智能绕过人工审批直接进行生产作业",
]) requireToken("html", html, token);

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1",
  customer_facing_language: "zh-CN",
  commercial_gate: "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF",
  narrative_version: "CHINESE_CUSTOMER_SURFACE_V3",
  release_manifest_machine_readable: true,
  release_gate_surface_count: 5,
  customer_visible_field_labels_chinese: true,
  decision_assurance_and_control_loop_separated: true,
  unified_production_qualification_not_claimed: true,
  autonomous_irrigation_not_claimed: true,
  customer_roi_not_claimed: true,
  off_main_boundary_preserved_in_release_manifest: true,
}, null, 2));