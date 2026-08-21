// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1.cjs
// Purpose: guard the paid-pilot Commercial Evidence Demo release boundary.
// This check proves the claim-by-claim evidence manifest exists, is customer-facing Chinese, preserves evidence classes, and does not upgrade engineering evidence into Formal/production claims.

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

// Chinese customer-facing release page.
for (const token of [
  'lang="zh-CN"',
  "付费试点销售 · 条件通过",
  "商业证据发布门",
  "逐条声明证据映射",
  "本页“已证明”只在对应证据等级内成立",
  "正常",
  "数据晚到",
  "来源冲突",
  "证据缺失",
]) requireToken("html", html, token);

// Five release-gate surfaces.
for (const token of [
  "1. 可复现启动",
  "pnpm exec tsx tools/commercial-evidence-demo/server.ts",
  "2. 精确代码版本",
  "id=\"releaseExactSha\"",
  "3. 真实机器案例",
  "GET /api/demo",
  "4. 真实持久化运行证据",
  "GET /api/mcft-runtime-evidence",
  "5. 声明 → repo / API → 证据等级",
  "id=\"releaseManifestRows\"",
]) requireToken("html", html, token);

// Machine-readable claim manifest and exact evidence classes.
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

// Page must render the packet manifest, rather than maintaining a second hand-written claim table.
for (const token of [
  "renderEvidenceReleaseManifest(packet)",
  "packet.evidence_release_manifest",
  "releaseManifestRows",
  "releaseExactSha",
  "REAL_MACHINE_EXECUTION",
  "PERSISTED_ENGINEERING_QUALIFICATION",
  "FORMAL_PRODUCTION_EVIDENCE",
]) requireToken("app", app, token);

// Due-diligence release document must preserve the same boundary.
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
  "COMMERCIAL EVIDENCE DEMO v1 — RELEASED FOR PAID PILOT SALES",
]) requireToken("releaseManifest", releaseManifest, token);

// Never silently convert current Commercial evidence into final Formal/production claims.
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

// The explicit non-claim language must remain present.
for (const token of [
  "真实 24 小时 Stage 1B / Formal 完成",
  "最终生产 Formal O00–O23 资格仍由独立真实时间链治理",
  "自动灌溉控制",
  "无人值守现场执行",
  "已证明的客户 ROI",
]) requireToken("html", html, token);

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1",
  customer_facing_language: "zh-CN",
  commercial_gate: "PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF",
  release_manifest_machine_readable: true,
  release_gate_surface_count: 5,
  evidence_classes_guarded: [
    "REAL_MACHINE_EXECUTION",
    "PERSISTED_ENGINEERING_QUALIFICATION",
    "DEMO_SCENARIO_INPUT",
    "CUSTOMER_INPUT",
    "FORMAL_PRODUCTION_EVIDENCE",
  ],
  stage1b_formal_completion_not_claimed: true,
  autonomous_irrigation_not_claimed: true,
  customer_roi_not_claimed: true,
  off_main_boundary_preserved_in_release_manifest: true,
}, null, 2));
