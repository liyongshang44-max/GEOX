// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1.cjs
// Purpose: guard the paid-pilot Commercial Evidence Demo release boundary after the customer narrative was expanded
// from chronology-only proof to an evidence-faithful "answer -> production eligibility" workflow.

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

// Chinese customer-facing page and revised positioning.
for (const token of [
  'lang="zh-CN"',
  "不是“能不能给答案”，而是“这个答案现在能不能进入真实生产”",
  "Commercial Evidence Demo · Draft",
  "同一个答案，可能有完全不同的资格",
  "一次完整的 GEOX 决策过程",
  "客户真正买的是什么",
  "GEOX 和现有系统是什么关系",
  "当前 GEOX 已经能演示和证明什么",
  "建议从影子模式开始",
  "GEOX 不负责让每一个模型答案都进入生产",
  "技术细节｜默认折叠",
]) requireToken("html", html, token);

// Five release-gate surfaces still exist, but the fifth now also names the commercial control-loop acceptance.
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

// Machine-readable Decision Assurance claim manifest and exact evidence classes remain authoritative for its core claims.
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

// Page renders that manifest dynamically instead of inventing a second machine claim table.
for (const token of [
  "renderEvidenceReleaseManifest(packet)",
  "packet.evidence_release_manifest",
  "releaseManifestRows",
  "releaseExactSha",
  "REAL_MACHINE_EXECUTION",
  "PERSISTED_ENGINEERING_QUALIFICATION",
  "FORMAL_PRODUCTION_EVIDENCE",
]) requireToken("app", app, token);

// Due-diligence document remains the evidence-class reference.
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

// The revised page must explicitly distinguish two implemented capability surfaces from unified production qualification.
for (const token of [
  "Decision Assurance Runtime + Commercial Control Loop",
  "两条能力线均已存在，但本 Demo 不声明已经完成统一 production qualification",
  "审批通过本身不会自动触发设备动作",
  "执行完成 ≠ 农业效果已经被证明",
]) requireToken("html", html, token);

// Never convert current Commercial evidence into final Formal/production claims.
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

// Explicit non-claim language must remain present.
for (const token of [
  "连续在线数字孪生运行已完成最终正式验收",
  "已经自动控制所有农业设备",
  "无人值守现场执行",
  "生产资格化的作物推荐",
  "已证明的客户 ROI",
  "AI 绕过人工审批直接进行生产作业",
]) requireToken("html", html, token);

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1",
  customer_facing_language: "zh-CN",
  commercial_gate: "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF",
  narrative_version: "ANSWER_TO_PRODUCTION_ELIGIBILITY_V2",
  release_manifest_machine_readable: true,
  release_gate_surface_count: 5,
  decision_assurance_and_control_loop_separated: true,
  unified_production_qualification_not_claimed: true,
  autonomous_irrigation_not_claimed: true,
  customer_roi_not_claimed: true,
  off_main_boundary_preserved_in_release_manifest: true,
}, null, 2));
