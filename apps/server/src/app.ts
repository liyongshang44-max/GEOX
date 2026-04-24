import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import Fastify, { type FastifyInstance } from "fastify";
import { createRequire } from "node:module";
import { Pool } from "pg";

import { loadEnv, resolveDatabaseUrl } from "./config/index.js";
import { registerV1Routes } from "./routes/registerV1Routes.js";
import { registerLegacyRoutes } from "./routes/registerLegacyRoutes.js";
import { registerAdminModule } from "./modules/admin/registerAdminModule.js";
import { registerOpenApiModule } from "./modules/openapi/registerOpenApiModule.js";
import { registerStaticModule } from "./modules/static/registerStaticModule.js";

import { registerSimConfigRoutes } from "./routes/sim_config.js";
import { registerDeviceSimulatorV1Routes } from "./routes/device_simulator_v1.js";
import { registerDeliveryEvidenceExportV1Routes } from "./routes/delivery_evidence_export_v1.js";
import { registerTelemetryV1Routes } from "./routes/telemetry_v1.js";
import { registerHumanExecutorV1Routes, startAssignmentExpiryWorker } from "./routes/human_executors_v1.js";
import { registerFieldsV1Routes } from "./routes/fields_v1.js";
import { registerFieldTagsV1Routes } from "./routes/field_tags_v1.js";
import { registerDeviceStatusV1Routes } from "./routes/device_status_v1.js";
import { registerDeviceHeartbeatV1Routes } from "./routes/device_heartbeat_v1.js";
import { registerAlertsV1Routes, startOfflineAlertWorker, startAlertNotificationWorker } from "./routes/alerts_v1.js";
import { registerAlertWorkflowV1Routes } from "./routes/alert_workflow_v1.js";
import { registerEvidenceExportJobsV1Routes } from "./routes/evidence_export_jobs_v1.js";
import { registerRawRoutes } from "./routes/raw.js";
import { registerAgronomyV0Routes } from "./routes/agronomy_v0.js";
import { registerAgronomyInterpretationV1Routes } from "./routes/agronomy_interpretation_v1.js";
import { registerControlPlaneV1Routes } from "./routes/controlplane_v1.js";
import { registerAuditExportV1Routes } from "./routes/audit_export_v1.js";
import { registerAuthV1Routes } from "./routes/auth_v1.js";
import { registerDashboardV1Routes } from "./routes/dashboard_v1.js";
import { registerHumanOpsV1Routes, startHumanOpsKpiRefreshWorker } from "./routes/human_ops_v1.js";
import { registerSlaV1Routes } from "./routes/sla_v1.js";
import { registerBillingV1Routes } from "./routes/billing_v1.js";
import { registerAgronomyMediaV1Routes } from "./routes/agronomy_media_v1.js";
import { registerAgronomyInferenceV1Routes } from "./routes/agronomy_inference_v1.js";
import { registerDecisionEngineV1Routes } from "./routes/decision_engine_v1.js";
import { registerOperationStateV1Routes } from "./routes/operation_state_v1.js";
import { registerFieldTimelineV1Routes } from "./routes/field_timeline_v1.js";
import { registerFieldProgramStateV1Routes } from "./routes/field_program_state_v1.js";
import { registerFieldPortfolioV1Routes } from "./routes/field_portfolio_v1.js";
import { registerProgramsV1Routes } from "./routes/programs_v1.js";
import { registerAcceptanceV1Routes } from "./routes/acceptance_v1.js";
import { registerEvidenceBundleV1Routes } from "./routes/evidence_bundle_v1.js";
import { registerSchedulingConflictV1Routes } from "./routes/scheduling_conflicts_v1.js";
import { registerEvidenceReportV1Routes } from "./routes/evidence_report_v1.js";
import { registerSkillRulesV1Routes } from "./routes/skills_rules_v1.js";
import { registerSkillsV1Routes } from "./routes/skills_v1.js";
import { registerSkillRunsV1Routes } from "./routes/skill_runs_v1.js";
import { registerReportsV1Routes } from "./routes/reports_v1.js";
import { registerReportsDashboardV1Routes } from "./routes/reports_dashboard_v1.js";
import { enforceRouteRoleAuth } from "./auth/route_role_authz.js";

loadEnv();
const require = createRequire(import.meta.url);

const GEOX_SYSTEM_PROFILE = process.env.GEOX_SYSTEM_PROFILE ?? "dev";
const GEOX_DISABLE_APPLE_II = (process.env.GEOX_DISABLE_APPLE_II ?? "") === "1";
if (GEOX_SYSTEM_PROFILE === "commercial_v0" && GEOX_DISABLE_APPLE_II) {
  // eslint-disable-next-line no-console
  console.error("[FATAL] Apple II is required in commercial_v0 profile; refusing to start with GEOX_DISABLE_APPLE_II=1");
  process.exit(12);
}

const REPO_ROOT = path.resolve(process.cwd());
const MEDIA_DIR = path.join(REPO_ROOT, "media");
const ACCEPTANCE_DIR = path.join(REPO_ROOT, "acceptance");
fs.mkdirSync(path.join(MEDIA_DIR, "canopy"), { recursive: true });
fs.mkdirSync(ACCEPTANCE_DIR, { recursive: true });

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)");
}
const pool = new Pool({ connectionString: DATABASE_URL });

const TENANT_HEADERS = ["x-tenant-id", "x-project-id", "x-group-id"] as const;
const API_CONTRACT_HEADERS = ["x-api-contract-version", "x-api-contract-required"] as const;

export function createApp(): { app: FastifyInstance; pool: Pool } {
  const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

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

  if (!GEOX_DISABLE_APPLE_II) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppleIReader } = require("../../judge/src/applei_reader");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JudgeRuntime } = require("../../judge/src/runtime");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerJudgeRoutes } = require("./routes/judge");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerJudgeConfigRoutes } = require("./routes/judge_config");

    const judgeReader = new AppleIReader(resolveDatabaseUrl());
    const judgeRuntime = new JudgeRuntime(judgeReader);
    registerJudgeRoutes(app, judgeRuntime);
    registerJudgeConfigRoutes(app);
  } else {
    // eslint-disable-next-line no-console
    console.warn("[WARN] Apple II disabled (GEOX_DISABLE_APPLE_II=1). Judge routes/runtime not initialized.");
  }

  registerSimConfigRoutes(app);
  registerDeviceSimulatorV1Routes(app, pool);
  registerRawRoutes(app, pool);
  registerTelemetryV1Routes(app, pool);
  registerHumanExecutorV1Routes(app, pool);
  registerFieldsV1Routes(app, pool);
  registerFieldTagsV1Routes(app, pool);
  registerDeviceHeartbeatV1Routes(app, pool);
  registerDeviceStatusV1Routes(app, pool);
  registerSchedulingConflictV1Routes(app, pool);
  registerAlertsV1Routes(app, pool);
  registerAlertWorkflowV1Routes(app, pool);
  registerEvidenceExportJobsV1Routes(app, pool);

  registerV1Routes(app, pool);
  registerLegacyRoutes(app, pool, { mediaDir: MEDIA_DIR });

  registerDeliveryEvidenceExportV1Routes(app, pool);
  registerControlPlaneV1Routes(app, pool);
  registerDecisionEngineV1Routes(app, pool);
  registerOperationStateV1Routes(app, pool);
  registerFieldTimelineV1Routes(app, pool);
  registerFieldProgramStateV1Routes(app, pool);
  registerFieldPortfolioV1Routes(app, pool);
  registerProgramsV1Routes(app, pool);
  registerAcceptanceV1Routes(app, pool);
  registerEvidenceBundleV1Routes(app, pool);
  registerEvidenceReportV1Routes(app, pool);
  registerSkillRulesV1Routes(app, pool);
  registerSkillsV1Routes(app, pool);
  registerSkillRunsV1Routes(app, pool);
  registerReportsV1Routes(app, pool);
  registerReportsDashboardV1Routes(app, pool);
  registerAuditExportV1Routes(app, pool);
  registerAuthV1Routes(app);
  registerDashboardV1Routes(app, pool);
  registerHumanOpsV1Routes(app, pool);
  registerSlaV1Routes(app, pool);
  registerBillingV1Routes(app, pool);
  registerOpenApiModule(app);
  registerAgronomyV0Routes(app, pool);
  registerAgronomyInterpretationV1Routes(app);
  registerAgronomyMediaV1Routes(app, pool, MEDIA_DIR);
  registerAgronomyInferenceV1Routes(app, pool);

  registerStaticModule(app, {
    mediaDir: MEDIA_DIR,
    acceptanceDir: ACCEPTANCE_DIR,
    tenantHeaders: TENANT_HEADERS,
    apiContractHeaders: API_CONTRACT_HEADERS,
  });

  registerAdminModule(app, pool);

  return { app, pool };
}

async function runSqlMigrations(pool: Pool): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.resolve(__dirname, "..", "db", "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const fullPath = path.join(migrationsDir, name);
    const sql = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "").trim();
    if (!sql) continue;
    await pool.query(sql);
  }
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
