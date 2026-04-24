// ⚠️ DEPRECATED: replaced by operation_state_v1 / program_v1
// DO NOT use in new flows
// GEOX/apps/server/src/server.ts

import { fileURLToPath } from "node:url"; // 把 ESM 的 import.meta.url 转成文件路径
import path from "node:path"; // 路径拼接/解析
import fs from "node:fs"; // 文件系统
import { randomUUID } from "node:crypto"; // 生成 UUID（导入任务等）
import { spawn } from "node:child_process"; // 启动子进程（跑 loadfact.ts）
import { pipeline } from "node:stream/promises"; // 流式写文件（multipart 上传）

import Fastify, { type FastifyInstance } from "fastify"; // Fastify 主框架
import { createRequire } from "node:module"; // ESM 中创建 require
import { Pool } from "pg"; // Postgres 连接池

import { loadEnv, resolveDatabaseUrl } from "./config/index.js";
import { registerV1Routes } from "./routes/registerV1Routes.js";
import { registerLegacyRoutes } from "./routes/registerLegacyRoutes.js";
import { registerAdminModule } from "./modules/admin/registerAdminModule.js";
import { registerAdminImportModule } from "./modules/admin/registerAdminImportModule.js";
import { registerOpenApiModule } from "./modules/openapi/registerOpenApiModule.js";
import { registerStaticModule } from "./modules/static/registerStaticModule.js";

import type {
  SeriesResponseV1, // /api/series 响应协议
} from "@geox/contracts";


import { registerSimConfigRoutes } from "./routes/sim_config.js"; // sim config 路由
import { registerDeviceSimulatorV1Routes } from "./routes/device_simulator_v1.js"; // Device simulator routes: /api/v1/devices/:id/simulator/* + deprecated simulator-runner compatibility.
import { registerDeliveryEvidenceExportV1Routes } from "./routes/delivery_evidence_export_v1.js"; // Sprint 26: Evidence export API v1 (async jobs).
import { registerTelemetryV1Routes } from "./routes/telemetry_v1.js"; // Sprint A1: Telemetry query routes (read-only).
import { registerHumanExecutorV1Routes, startAssignmentExpiryWorker } from "./routes/human_executors_v1.js"; // Human executor/service team/work-assignment domain routes.
import { registerFieldsV1Routes } from "./routes/fields_v1.js"; // Sprint C1: Field/GIS + Device Binding routes.
import { registerFieldTagsV1Routes } from "./routes/field_tags_v1.js"; // Field tags v1 routes (field scoped labels).
import { registerDeviceStatusV1Routes } from "./routes/device_status_v1.js"; // Sprint C1: Device heartbeat/status read routes.
import { registerDeviceHeartbeatV1Routes } from "./routes/device_heartbeat_v1.js"; // Sprint C2: Device heartbeat ingest routes.
import { registerAlertsV1Routes, startOfflineAlertWorker, startAlertNotificationWorker } from "./routes/alerts_v1.js"; // Sprint C1: Alerts API + offline worker.
import { registerAlertWorkflowV1Routes } from "./routes/alert_workflow_v1.js"; // Alert workflow schema initialization + write-layer helper registration.
import { registerEvidenceExportJobsV1Routes } from "./routes/evidence_export_jobs_v1.js"; // Sprint C1: Persisted evidence export jobs.
import { registerRawRoutes } from "./routes/raw.js"; // raw 写入路由
import { registerAgronomyV0Routes } from "./routes/agronomy_v0.js"; // 农艺 v0 路由
import { registerAgronomyInterpretationV1Routes } from "./routes/agronomy_interpretation_v1.js"; // 农艺解释 v1 路由
import { registerControlPlaneV1Routes } from "./routes/controlplane_v1.js"; // Control-2: stable Commercial REST v1 wrappers + dispatch outbox.
import { registerAuditExportV1Routes } from "./routes/audit_export_v1.js"; // Sprint W1: unified audit/export overview.
import { registerAuthV1Routes } from "./routes/auth_v1.js"; // Sprint R1: auth/session info route.
import { registerDashboardV1Routes } from "./routes/dashboard_v1.js"; // Sprint P2: commercial dashboard overview route.
import { registerHumanOpsV1Routes, startHumanOpsKpiRefreshWorker } from "./routes/human_ops_v1.js"; // Human ops analytics routes + low-peak refresh worker.
import { registerSlaV1Routes } from "./routes/sla_v1.js"; // SLA summary routes.
import { registerBillingV1Routes } from "./routes/billing_v1.js"; // Billing v1 routes.
import { registerAgronomyMediaV1Routes } from "./routes/agronomy_media_v1.js"; // Agronomy media ingest + normalized observation routes.
import { registerAgronomyInferenceV1Routes } from "./routes/agronomy_inference_v1.js"; // Agronomy inference + aggregated inputs routes.
import { registerDecisionEngineV1Routes } from "./routes/decision_engine_v1.js"; // Decision engine recommendations + simulator routes.
import { registerOperationStateV1Routes } from "./routes/operation_state_v1.js"; // Sprint B: unified operation state routes.
import { registerFieldTimelineV1Routes } from "./routes/field_timeline_v1.js"; // Sprint C: field timeline/replay route.
import { registerFieldProgramStateV1Routes } from "./routes/field_program_state_v1.js"; // Program-centric state projection API.
import { registerFieldPortfolioV1Routes } from "./routes/field_portfolio_v1.js"; // Field portfolio projection APIs.
import { registerProgramsV1Routes } from "./routes/programs_v1.js"; // Program management + field/season scoped program routes.
import { registerAcceptanceV1Routes } from "./routes/acceptance_v1.js"; // Stage C2: acceptance evaluation API routes.
import { registerEvidenceBundleV1Routes } from "./routes/evidence_bundle_v1.js"; // Stage 3: operation evidence bundle API.
import { registerSchedulingConflictV1Routes } from "./routes/scheduling_conflicts_v1.js"; // Scheduling conflict detector API routes.
import { registerEvidenceReportV1Routes } from "./routes/evidence_report_v1.js"; // Stage 5: Commercial evidence report jobs.
import { registerSkillRulesV1Routes } from "./routes/skills_rules_v1.js"; // Stage 6: runtime skill rules switch/list APIs.
import { registerSkillsV1Routes } from "./routes/skills_v1.js"; // Stage 10: skill registry/bindings/runs APIs.
import { registerSkillRunsV1Routes } from "./routes/skill_runs_v1.js"; // Stage 10+: taskbook-normalized skill run read API.
import { registerReportsV1Routes } from "./routes/reports_v1.js"; // Operation report projection APIs (operation/field).
import { registerReportsDashboardV1Routes } from "./routes/reports_dashboard_v1.js"; // Customer dashboard aggregate reports route.
import { enforceRouteRoleAuth } from "./auth/route_role_authz.js";
type FactsSource = "device" | "gateway" | "system" | "human"; // facts.source 合法枚举
type QcQuality = "unknown" | "ok" | "suspect" | "bad"; // qc.quality 合法枚举
type OverlayConfidence = "low" | "med" | "high";

const MARKER_KIND_ALLOWLIST = new Set<string>([
  "MAINTENANCE",
  "CALIBRATION",
  "POST_RAIN",
  "INTERVENTION",
  "manual_marker",
  "human_observation",
  "device_fault",
  "threshold_breach",
  "offline_window",
  "EXCLUSION_WINDOW_ACTIVE",
]); // 本地 marker kind allowlist，避免依赖 @geox/contracts 的运行时导出。

function isMarkerKind(kind: unknown): boolean { // 本地 marker kind 校验函数。
  return typeof kind === "string" && MARKER_KIND_ALLOWLIST.has(kind.trim()); // 仅允许 allowlist 内的 kind。
}

type SeriesGapV1 = {
  startTs: number; // gap 开始时间戳（ms）。
  endTs: number; // gap 结束时间戳（ms）。
  reason?: "unknown" | "no_data" | "device_offline"; // 可选 gap 原因。
};

type SeriesSampleV1 = {
  ts: number; // 采样时间戳（ms）。
  sensorId: string; // 传感器 ID。
  metric: string; // 指标名。
  value: number; // 数值。
  quality: "unknown" | "ok" | "suspect" | "bad"; // 质量标签。
  source: "device" | "gateway" | "system" | "human" | "import" | "sim"; // 数据来源。
};

type OverlaySegment = {
  startTs: number;
  endTs: number;
  sensorId: string;
  metric: string | null;
  kind: string;
  confidence: OverlayConfidence | null;
  note: string | null;
  source: "device" | "gateway" | "system" | "human";
};

type SensorGroupV1 = {
  groupId: string; // 组 ID。
  subjectRef: {
    projectId: string; // 项目 ID。
  };
  displayName: string; // 展示名。
  sensors: string[]; // 传感器列表。
  createdAt: number; // 创建时间戳（ms）。
};

type CanopyFrameV1 = {
  ts: number; // 帧时间戳（ms）。
  project_id: string; // 项目 ID。
  plot_id: string | null; // plot ID，可为空。
  block_id: string | null; // block ID，可为空。
  camera_id: string; // 相机 ID。
  storage_key: string; // 存储 key。
  mime: string; // MIME 类型。
  note: string | null; // 备注，可为空。
  source: "device" | "gateway" | "system" | "human" | "import" | "sim"; // 来源。
  url: string; // 访问 URL。
};
loadEnv();
const require = createRequire(import.meta.url); // 让 ESM 文件里可以安全使用 require

function nowMs(): number {
  return Date.now(); // 当前毫秒时间戳
}
function toIso(ts: number): string {
  return new Date(ts).toISOString(); // 毫秒转 ISO 字符串
}
function parseIntParam(v: unknown, name: string): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; // 将 query/body 的值转为 number
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`); // 必须是整数
  return n; // 返回整数
}
function parseStringParam(v: unknown, name: string): string {
  if (typeof v !== "string" || v.trim().length === 0) throw new Error(`invalid ${name}`); // 必须是非空字符串
  return v.trim(); // 返回 trim 后字符串
}
function splitCsv(v: string): string[] {
  return v
    .split(",") // 按逗号切分
    .map((s) => s.trim()) // trim 每段
    .filter(Boolean); // 去掉空项
}
function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs)); // 去重（保持插入顺序）
}

function multipartField(fields: any, key: string): string | undefined {
  const v = fields?.[key]; // 取字段
  if (!v) return undefined; // 不存在则返回 undefined

  const pick = (x: any): string | undefined => {
    if (typeof x === "string") return x.trim() || undefined; // 直接字符串
    if (x && typeof x === "object" && typeof x.value === "string") return x.value.trim() || undefined; // fastify multipart 可能是 { value }
    return undefined; // 兜底
  };

  if (Array.isArray(v)) {
    for (const it of v) {
      const got = pick(it); // 逐个尝试
      if (got) return got; // 找到就返回
    }
    return undefined; // 数组没找到
  }
  return pick(v); // 非数组直接 pick
}

const GEOX_SYSTEM_PROFILE = process.env.GEOX_SYSTEM_PROFILE ?? "dev"; // 系统运行 profile（商用冻结期会注入 commercial_v0）
const GEOX_DISABLE_APPLE_II = (process.env.GEOX_DISABLE_APPLE_II ?? "") === "1"; // 测试/负验收用：显式禁用 Apple II（仅非商用允许）
if (GEOX_SYSTEM_PROFILE === "commercial_v0" && GEOX_DISABLE_APPLE_II) { // 商用态下，拿掉 Apple II 必须导致系统不可用（fail-fast）
  // eslint-disable-next-line no-console
  console.error("[FATAL] Apple II is required in commercial_v0 profile; refusing to start with GEOX_DISABLE_APPLE_II=1"); // 明确错误原因（便于审计/验收）
  process.exit(12); // 非 0 退出码：系统级失败（商用冻结负验收）
}

const REPO_ROOT = path.resolve(process.cwd()); // 运行时 repo 根（容器内 /app）
const MEDIA_DIR = path.join(REPO_ROOT, "media"); // media 根目录
const CANOPY_DIR = path.join(MEDIA_DIR, "canopy"); // canopy 静态文件目录
fs.mkdirSync(CANOPY_DIR, { recursive: true }); // 确保 canopy 目录存在（否则写文件失败）

// ✅ 关键修复：fastify-static root 必须存在，否则启动会警告甚至影响某些行为
const ACCEPTANCE_DIR = path.join(REPO_ROOT, "acceptance"); // acceptance 输出目录
fs.mkdirSync(ACCEPTANCE_DIR, { recursive: true }); // 确保 acceptance 目录存在

const DATABASE_URL = process.env.DATABASE_URL ?? ""; // 确保类型为 string
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)"); // 必须有 DB
}
const pool = new Pool({ connectionString: DATABASE_URL }); // 创建 pg 连接池

async function runSqlMigrations(pool: Pool): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.resolve(__dirname, "..", "db", "migrations");
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const fullPath = path.join(migrationsDir, name);
    const sql = fs.readFileSync(fullPath, 'utf8').replace(/^﻿/, '').trim();
    if (!sql) continue;
    await pool.query(sql);
  }
}


const TENANT_HEADERS = [
  "x-tenant-id",
  "x-project-id",
  "x-group-id",
] as const; // 浏览器侧租户三元组请求头（必须允许跨域）。
const API_CONTRACT_HEADERS = [
  "x-api-contract-version",
  "x-api-contract-required",
] as const; // 合约协商请求头（version 必需；required 用于强约束协商）。

export function createApp(): { app: FastifyInstance; pool: Pool } {
const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 }); // 初始化服务（限制 body）

app.addHook("preHandler", async (req, reply) => {
  const pathname = String((req.raw.url ?? "").split("?")[0] ?? "");
  const resource = pathname.startsWith("/api/v1/reports/")
    ? "reports"
    : pathname.startsWith("/api/v1/operations/") || pathname === "/api/v1/operations"
      ? "operations"
      : pathname.startsWith("/api/v1/dashboard/")
        ? "dashboard"
        : null;
  if (!resource) return;
  const auth = enforceRouteRoleAuth(req, reply, resource, { asNotFound: resource !== "dashboard" });
  if (!auth) return reply;
  (req as any).auth = auth;
});

if (!GEOX_DISABLE_APPLE_II) { // 允许在非商用 profile 下显式启用 Apple II（默认）
  // Lazy-require: 避免在 Apple II 禁用时触发 better-sqlite3 native bindings 加载（Windows/Node ABI 兼容风险）。
  // 注意：tsx 在 dev 下以 CJS 形态运行时，require 可用；这里不使用 top-level await/import()。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppleIReader } = require("../../judge/src/applei_reader"); // Judge reader (Apple I facts)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JudgeRuntime } = require("../../judge/src/runtime"); // Judge runtime (may initialize sqlite store)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerJudgeRoutes } = require("./routes/judge"); // Judge routes
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerJudgeConfigRoutes } = require("./routes/judge_config"); // Judge config routes

  const judgeDbUrl = resolveDatabaseUrl(); // Judge 使用的 DB URL（同库）
  const judgeReader = new AppleIReader(judgeDbUrl); // Judge Reader
  const judgeRuntime = new JudgeRuntime(judgeReader); // Judge Runtime（会触发 SQLite store 初始化）

  registerJudgeRoutes(app, judgeRuntime); // 注册 judge 路由
  registerJudgeConfigRoutes(app); // 注册 judge config 路由
} else {
  // eslint-disable-next-line no-console
  console.warn("[WARN] Apple II disabled (GEOX_DISABLE_APPLE_II=1). Judge routes/runtime not initialized."); // 明确：不会触发 SQLite bindings
}
registerSimConfigRoutes(app); // 注册 sim config 路由
registerDeviceSimulatorV1Routes(app, pool); // Device simulator v1: canonical device-scoped endpoints + deprecated simulator-runner compatibility endpoints.
// ⚠️ LEGACY ROUTES: kept only for compatibility; DO NOT wire any new page/flow to these endpoints.
registerRawRoutes(app, pool); // legacy monitoring route registration only.
registerTelemetryV1Routes(app, pool); // legacy telemetry route registration only.
registerHumanExecutorV1Routes(app, pool); // Human executor: register human/domain routes without altering device executor paths.
registerFieldsV1Routes(app, pool); // Sprint C1: 注册 Field/GIS + Device Binding（地块化基座）。
registerFieldTagsV1Routes(app, pool); // Field tags v1: 地块标签管理（含 field scope 校验）。
registerDeviceHeartbeatV1Routes(app, pool); // Sprint C2: Register Device Heartbeat ingest (POST /api/v1/devices/:device_id/heartbeat).
registerDeviceStatusV1Routes(app, pool); // Sprint C1: 注册 Device Status（心跳/在线状态）。
registerSchedulingConflictV1Routes(app, pool); // Sprint F2: 注册 scheduling conflicts APIs（device/field/program intent conflicts）。
registerAlertsV1Routes(app, pool); // Sprint C1: 注册 Alerts（告警规则 + 事件）。
registerAlertWorkflowV1Routes(app, pool); // Alert workflow v1: initialize workflow projection schema and indexes.
registerEvidenceExportJobsV1Routes(app, pool); // Sprint C1: 注册 Evidence Export Jobs（持久化作业）。

registerV1Routes(app, pool); // AO-ACT 主实现层：先注册 /api/v1/actions/*
registerLegacyRoutes(app, pool, { mediaDir: MEDIA_DIR }); // AO-ACT + approvals + legacy monitoring compatibility routes only.
registerDeliveryEvidenceExportV1Routes(app, pool); // Sprint 26: 注册 Evidence Export API v1（异步作业）路由。
registerControlPlaneV1Routes(app, pool); // Control-2: 注册 Commercial REST v1（审批/任务/dispatch outbox/receipt 查询）路由。
registerDecisionEngineV1Routes(app, pool); // Decision engine: recommendation generation, approval mapping, and irrigation simulator.
registerOperationStateV1Routes(app, pool); // Sprint B: unified operations state projection API.
registerFieldTimelineV1Routes(app, pool); // Sprint C: field timeline/replay API.
registerFieldProgramStateV1Routes(app, pool); // Program-centric: field program state projection API.
registerFieldPortfolioV1Routes(app, pool); // Field portfolio projection APIs.
// Governance boundary: program 仅承载策略/编排，不替代 operation detail；execution 新读取优先接入 operation_state read model。
registerProgramsV1Routes(app, pool); // Program management + field/season scoped program APIs.
registerAcceptanceV1Routes(app, pool); // Stage C2: acceptance result evaluation/write API.
registerEvidenceBundleV1Routes(app, pool); // Stage 3: aggregate operation evidence bundle for frontend consumption.
registerEvidenceReportV1Routes(app, pool); // Stage 5: async commercial evidence report generation.
registerSkillRulesV1Routes(app, pool); // Stage 7: DB-driven runtime agronomy skill switch/list APIs.
registerSkillsV1Routes(app, pool); // Stage 10: skill registry read/bindings/runs/status APIs via facts.
registerSkillRunsV1Routes(app, pool); // Stage 10+: normalized skill run listing API (/api/v1/skill-runs).
registerReportsV1Routes(app, pool); // Reports v1: operation + field scoped report projection endpoints.
registerReportsDashboardV1Routes(app, pool); // Reports dashboard v1: customer dashboard aggregate endpoint.
registerAuditExportV1Routes(app, pool); // Sprint W1: 注册审计与导出总表路由。
registerAuthV1Routes(app); // Sprint R1: 注册 auth/me 路由。
registerDashboardV1Routes(app, pool); // Sprint P2: 注册商业总览聚合路由。
registerHumanOpsV1Routes(app, pool); // Human ops analytics endpoints (KPI/ranking/exceptions).
registerSlaV1Routes(app, pool); // SLA: 注册服务质量汇总路由。
registerBillingV1Routes(app, pool); // Billing: 注册作业结算路由。
registerOpenApiModule(app); // Sprint Docs1: 注册 OpenAPI JSON 导出路由。
registerAgronomyV0Routes(app, pool); // ⚠️ LEGACY ROUTE: compatibility only, DO NOT connect from new pages.
registerAgronomyInterpretationV1Routes(app); // 注册 agronomy interpretation v1 路由

registerAgronomyMediaV1Routes(app, pool, MEDIA_DIR); // Stage-1: agronomy media ingest + normalized observations.
registerAgronomyInferenceV1Routes(app, pool); // Stage-1b: inference and aggregated agronomy inputs.

registerStaticModule(app, { mediaDir: MEDIA_DIR, acceptanceDir: ACCEPTANCE_DIR, tenantHeaders: TENANT_HEADERS, apiContractHeaders: API_CONTRACT_HEADERS });

// ---------- helpers: gaps ----------
function computeGapsGlobal(tsList: number[], startTs: number, endTs: number): SeriesGapV1[] {
  const gaps: SeriesGapV1[] = []; // gaps 输出数组
  if (!tsList.length) {
    gaps.push({ startTs, endTs }); // 没有任何采样点：整段都是 gap
    return gaps; // 直接返回
  }
  const sorted = tsList.slice().sort((a, b) => a - b); // 排序时间戳
  if (sorted[0] > startTs) gaps.push({ startTs, endTs: sorted[0] }); // 起点到第一点之间是 gap

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]; // 前一点
    const cur = sorted[i]; // 当前点
    const delta = cur - prev; // 间隔
    if (delta > 30 * 60 * 1000) gaps.push({ startTs: prev, endTs: cur }); // 超过 30min 判定 gap
  }

  const last = sorted[sorted.length - 1]; // 最后一点
  if (last < endTs) gaps.push({ startTs: last, endTs }); // 最后一点到结束之间是 gap

  return gaps; // 返回 gap 列表
}

// ---------- helpers: facts parsing ----------
function safeJsonParse<T>(s: unknown): T | null {
  if (typeof s !== "string") return null; // 不是字符串就不能 parse
  try {
    return JSON.parse(s) as T; // JSON.parse 成功返回对象
  } catch {
    return null; // 失败返回 null
  }
}

function parseRecordJson(x: any): any | null {
  if (x == null) return null; // null/undefined 直接 null
  if (typeof x === "object") return x; // pg 可能直接返回对象
  if (typeof x !== "string") return null; // 其他类型拒绝
  return safeJsonParse<any>(x); // 字符串则 parse
}

function occurredAtToMs(occurred_at: unknown): number {
  if (occurred_at instanceof Date) return occurred_at.getTime(); // Date -> ms
  const ms = Date.parse(String(occurred_at ?? "")); // 其他 -> 解析成 ms
  return Number.isFinite(ms) ? ms : 0; // 不可解析则返回 0
}

// ---------- routes ----------
registerAdminModule(app, pool);

registerAdminImportModule(app, pool);

  return { app, pool };
}

export async function runStartupMigrations(pool: Pool): Promise<void> {
  await runSqlMigrations(pool);
}

export function startBackgroundWorkers(pool: Pool): void {
  startOfflineAlertWorker(pool);
  startAlertNotificationWorker(pool);
  startAssignmentExpiryWorker(pool);
  startHumanOpsKpiRefreshWorker(pool);
}
