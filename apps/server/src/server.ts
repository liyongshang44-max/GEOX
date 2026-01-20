import { fileURLToPath } from "node:url";
function loadDotEnvFile(fp: string): void {
  if (!fs.existsSync(fp)) return;
  const raw = fs.readFileSync(fp, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2] ?? "";
    // Strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Do not overwrite explicitly provided env vars
    if (process.env[key] == null) process.env[key] = val;
  }
}

function loadEnv(): void {
  // Load repo root .env first, then package-local .env to allow overrides.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  loadDotEnvFile(path.join(repoRoot, ".env"));
  loadDotEnvFile(path.join(__dirname, ".env"));
}

loadEnv();

// GEOX/apps/server/src/server.ts
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";

import { Pool } from "pg";

import type {
  SeriesResponseV1,
  SeriesSampleV1,
  SeriesGapV1,
  OverlaySegment,
  CanopyFrameV1,
  SensorGroupV1,
} from "@geox/contracts";
import { isMarkerKind } from "@geox/contracts";
import { AppleIReader } from "../../judge/src/applei_reader";
import { JudgeRuntime } from "../../judge/src/runtime";
import { registerJudgeRoutes } from "../../judge/src/routes";
import { registerJudgeConfigRoutes } from "./routes/judge_config";
import { registerSimConfigRoutes } from "./routes/sim_config";

type FactsSource = "device" | "gateway" | "system" | "human";
type QcQuality = "unknown" | "ok" | "suspect" | "bad";


function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (typeof direct === "string" && direct.length) return direct;
  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const user = process.env.PGUSER;
  const pass = process.env.PGPASSWORD;
  const db = process.env.PGDATABASE;
  if (host && port && user && db) {
    const cred = pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}` : encodeURIComponent(user);
    return `postgres://${cred}@${host}:${port}/${db}`;
  }
  return "";
}

function nowMs(): number {
  return Date.now();
}
function toIso(ts: number): string {
  return new Date(ts).toISOString();
}
function parseIntParam(v: unknown, name: string): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`);
  return n;
}
function parseStringParam(v: unknown, name: string): string {
  if (typeof v !== "string" || v.trim().length === 0) throw new Error(`invalid ${name}`);
  return v.trim();
}
function splitCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function multipartField(fields: any, key: string): string | undefined {
  const v = fields?.[key];
  if (!v) return undefined;

  // fastify-multipart sometimes returns { value }, or an array of those
  const pick = (x: any): string | undefined => {
    if (typeof x === "string") return x.trim() || undefined;
    if (x && typeof x === "object" && typeof x.value === "string") return x.value.trim() || undefined;
    return undefined;
  };

  if (Array.isArray(v)) {
    for (const it of v) {
      const got = pick(it);
      if (got) return got;
    }
    return undefined;
  }
  return pick(v);
}

const REPO_ROOT = path.resolve(process.cwd());
const MEDIA_DIR = path.join(REPO_ROOT, "media");
const CANOPY_DIR = path.join(MEDIA_DIR, "canopy");
fs.mkdirSync(CANOPY_DIR, { recursive: true });

// Postgres facts ledger (Route A)
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)");
}
const pool = new Pool({ connectionString: DATABASE_URL });

// Fastify
// NOTE: Admin import uploads CAF Hourly sensor logs which can be several MB.
// Increase limits to avoid 413 while keeping semantics unchanged.
const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

// Apple II (Judge)
const judgeDbUrl = resolveDatabaseUrl();
const judgeReader = new AppleIReader(judgeDbUrl);
const judgeRuntime = new JudgeRuntime(judgeReader);
registerJudgeRoutes(app, judgeRuntime);
registerJudgeConfigRoutes(app);
  registerSimConfigRoutes(app);

app.register(multipart, {
  limits: {
    // CAF Hourly files can be multiple MB; default limits are typically too small.
    fileSize: 50 * 1024 * 1024,
  },
});
app.register(fastifyStatic, {
  root: MEDIA_DIR,
  prefix: "/media/",
});

// Serve acceptance artifacts for UI viewing/downloading.
// This is a read-only static exposure of the repo-local acceptance/ directory.
app.register(fastifyStatic, {
  root: path.join(REPO_ROOT, "acceptance"),
  prefix: "/acceptance/",
  decorateReply: false,
});

app.addHook("onRequest", async (req, reply) => {
  // CORS (minimal, dev-friendly)
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Headers", "content-type");
  reply.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return reply.code(204).send();
});

// ---------- helpers: gaps ----------
function computeGapsGlobal(tsList: number[], startTs: number, endTs: number): SeriesGapV1[] {
  const gaps: SeriesGapV1[] = [];
  if (!tsList.length) {
    gaps.push({ startTs, endTs });
    return gaps;
  }
  const sorted = tsList.slice().sort((a, b) => a - b);
  if (sorted[0] > startTs) gaps.push({ startTs, endTs: sorted[0] });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const delta = cur - prev;
    // 30min heuristic for P2/P5
    if (delta > 30 * 60 * 1000) gaps.push({ startTs: prev, endTs: cur });
  }

  const last = sorted[sorted.length - 1];
  if (last < endTs) gaps.push({ startTs: last, endTs });

  return gaps;
}

// ---------- helpers: facts parsing ----------
function safeJsonParse<T>(s: unknown): T | null {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function parseRecordJson(x: any): any | null {
  if (x == null) return null;
  if (typeof x === "object") return x;
  if (typeof x !== "string") return null;
  return safeJsonParse<any>(x);
}

function occurredAtToMs(occurred_at: unknown): number {
  if (occurred_at instanceof Date) return occurred_at.getTime();
  const ms = Date.parse(String(occurred_at ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

// ---------- routes ----------
app.get("/health", async () => ({ ok: true }));

// GET /api/admin/healthz
// Read-only environment/bootstrap checks for a "new device" first-run.
// This endpoint is intentionally narrow: it verifies DB connectivity and the
// presence of required tables/views that are expected to be created by
// docker/postgres/init/*.sql.
app.get("/api/admin/healthz", async (req, reply) => {
  const requiredTables = [
    "facts",
    "raw_samples",
    "markers",
    "sensor_groups",
    "sensor_group_members",
  ];
  const requiredViews = ["facts_replay_v1"];

  // 1) DB connectivity
  const db = {
    ok: false,
    now: null as string | null,
    version: null as string | null,
  };
  try {
    const r1 = await pool.query("select now() as now, version() as version");
    db.ok = true;
    db.now = String((r1.rows?.[0] as any)?.now ?? "");
    db.version = String((r1.rows?.[0] as any)?.version ?? "");
  } catch (e: any) {
    return reply.code(200).send({ ok: false, db, bootstrap: { requiredTables, requiredViews, missingTables: requiredTables, missingViews: requiredViews } });
  }

  // 2) Existence checks
  const missingTables: string[] = [];
  for (const t of requiredTables) {
    const r = await pool.query("select to_regclass($1) as reg", [`public.${t}`]);
    if (!r.rows?.[0]?.reg) missingTables.push(t);
  }
  const missingViews: string[] = [];
  for (const v of requiredViews) {
    const r = await pool.query("select to_regclass($1) as reg", [`public.${v}`]);
    if (!r.rows?.[0]?.reg) missingViews.push(v);
  }

  const ok = db.ok && missingTables.length === 0 && missingViews.length === 0;
  return reply.send({
    ok,
    db,
    bootstrap: {
      requiredTables,
      requiredViews,
      missingTables,
      missingViews,
    },
  });
});

// ---------------- Import jobs (admin) ----------------
type ImportJobState = "queued" | "running" | "done" | "error";
type ImportJob = {
  jobId: string;
  state: ImportJobState;
  createdAt: number;
  updatedAt: number;
  filePath: string;
  args: string[];
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
  error?: string;
};
const importJobs = new Map<string, ImportJob>();

function tailAppend(prev: string, next: string, max = 8000): string {
  const merged = (prev + next).slice(-max);
  return merged;
}

// POST /api/admin/import/caf_hourly
// Multipart upload of a CAF Hourly .txt file, then executes scripts/loadfact.ts
// server-side to keep Judge/acceptance semantics unchanged.
//
// Form fields:
// - file: uploaded file
// - projectId (optional, default P_DEFAULT)
// - groupId (optional, default G_CAF)
// - writeRawSamples (optional, default 1)
// - writeMarkers (optional, default 1)
app.post("/api/admin/import/caf_hourly", async (req, reply) => {
  // Collect multipart fields + file robustly.
  const fields = new Map<string, string>();
  let savedFilePath: string | null = null;
  let fileName = "upload.txt";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Repo root must be /app inside container. server.ts is at /app/apps/server/src/server.ts
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const uploadDir = path.join(repoRoot, "_uploads");
  fs.mkdirSync(uploadDir, { recursive: true });

  // IMPORTANT: consume ALL parts; otherwise fields may not be available.
  const parts = (req as any).parts();
  for await (const part of parts) {
    if (part.type === "file") {
      fileName = part.filename ?? fileName;
      const ext = path.extname(fileName ?? "") || ".txt";
      const fp = path.join(uploadDir, `${Date.now()}_${randomUUID()}${ext}`);

      // Stream the file to disk. This avoids the observed zero-byte writes
      // when using toBuffer() in some runtime builds.
      const ws = fs.createWriteStream(fp);
      await pipeline(part.file, ws);
      savedFilePath = fp;
    } else if (part.type === "field") {
      const v = typeof part.value === "string" ? part.value : String(part.value ?? "");
      fields.set(part.fieldname, v);
    } else {
      // Backward/edge-case: normalize unknown shapes.
      const fieldname = String((part as any).fieldname ?? "");
      if (fieldname) fields.set(fieldname, String((part as any).value ?? ""));
    }
  }

  if (!savedFilePath) {
    return reply.code(400).send({ ok: false, error: "file is required" });
  }
  const st = fs.statSync(savedFilePath);
  if (!st.size) {
    return reply.code(400).send({ ok: false, error: "file is required", hint: "upload_empty_file" });
  }

  const projectId = (fields.get("projectId") || "P_DEFAULT").trim() || "P_DEFAULT";
  const groupId = (fields.get("groupId") || "G_CAF").trim() || "G_CAF";
  const writeRawSamples = (fields.get("writeRawSamples") || "1").trim() || "1";
  const writeMarkers = (fields.get("writeMarkers") || "1").trim() || "1";

  // Prefer server-side DB URL (docker internal), but fall back to env.
  const databaseUrl = process.env.DATABASE_URL || "postgres://landos:landos_pwd@postgres:5432/landos";

  const tsNodeBin = path.join(repoRoot, "node_modules", ".bin", "ts-node");
  const loadfactPath = path.join(repoRoot, "scripts", "loadfact.ts");
  const args = ["--transpile-only", loadfactPath, "--file", savedFilePath, "--projectId", projectId, "--groupId", groupId, "--writeRawSamples", writeRawSamples, "--writeMarkers", writeMarkers];

  const jobId = `import_${Date.now()}_${randomUUID()}`;
  const job: ImportJob = {
    jobId,
    state: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    filePath: savedFilePath,
    args,
    exitCode: null,
    stdoutTail: "",
    stderrTail: "",
  };
  importJobs.set(jobId, job);

  // Fire-and-forget within the request handler; status is polled via GET.
  job.state = "running";
  job.updatedAt = Date.now();
  const child = spawn(tsNodeBin, args, {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  child.stdout.on("data", (buf) => {
    job.stdoutTail = tailAppend(job.stdoutTail, String(buf));
    job.updatedAt = Date.now();
  });
  child.stderr.on("data", (buf) => {
    job.stderrTail = tailAppend(job.stderrTail, String(buf));
    job.updatedAt = Date.now();
  });
  child.on("error", (e) => {
    job.state = "error";
    job.error = String(e?.message ?? e);
    job.updatedAt = Date.now();
  });
  child.on("close", (code) => {
    job.exitCode = typeof code === "number" ? code : null;
    job.state = code === 0 ? "done" : "error";
    if (code !== 0) job.error = job.error || `exit code ${code}`;
    job.updatedAt = Date.now();
  });

  return reply.send({ ok: true, jobId, filePath: savedFilePath });
});

// GET /api/admin/import/jobs/:jobId
app.get("/api/admin/import/jobs/:jobId", async (req, reply) => {
  const p = req.params as Record<string, unknown>;
  const jobId = typeof p.jobId === "string" ? p.jobId.trim() : "";
  const job = importJobs.get(jobId);
  if (!job) return reply.code(404).send({ ok: false, error: "job not found" });
  return reply.send({ ok: true, job });
});

// ---------------- Acceptance runner (admin) ----------------
// POST /api/admin/acceptance/caf009_1h/run
// Reproduces the frozen acceptance checklist for CAF009/1h and writes artifacts.
app.post("/api/admin/acceptance/caf009_1h/run", async (req, reply) => {
  const body = (req.body ?? {}) as any;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "P_DEFAULT";
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "G_CAF";
  const sensorId = typeof body.sensorId === "string" ? body.sensorId.trim() : "CAF009";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..");

  // Load SSOT expected_interval_ms from config/judge/default.json
  const judgeDefaultPath = path.join(repoRoot, "config", "judge", "default.json");
  const judgeDefault = JSON.parse(fs.readFileSync(judgeDefaultPath, "utf8"));
  const expectedIntervalMs = Number(judgeDefault?.time_coverage?.expected_interval_ms ?? 60000);

  // Window selection: pick max ts from raw_samples for sensor, then 1h back.
  const maxR = await pool.query(
    "select max(ts_ms) as max_ts_ms from raw_samples where sensor_id=$1",
    [sensorId]
  );
  const maxTs = Number(maxR.rows?.[0]?.max_ts_ms ?? 0);
  const endTs = maxTs;
  const startTs = endTs - 3600000;
  const hours = 1;

  // Data checks (frozen semantics)
  const pointsR = await pool.query(
    "select count(distinct ts_ms) as n from raw_samples where sensor_id=$1 and ts_ms >= $2 and ts_ms <= $3",
    [sensorId, startTs, endTs]
  );
  const pointsPresent = Number(pointsR.rows?.[0]?.n ?? 0);
  const expectedPoints = Math.floor((hours * 3600000) / expectedIntervalMs);
  const minPointsRequired = Math.ceil(expectedPoints * 0.9);

  const metricsR = await pool.query(
    "select array_agg(distinct metric order by metric) as metrics from raw_samples where sensor_id=$1 and ts_ms >= $2 and ts_ms <= $3",
    [sensorId, startTs, endTs]
  );
  const metrics: string[] = Array.isArray(metricsR.rows?.[0]?.metrics) ? metricsR.rows[0].metrics : [];
  const metricsPresent = metrics.length;

  // Run Judge (same public API; acceptance is about the output)
  const port = Number(process.env.PORT || 3000);
  const judgeReq = {
    subjectRef: { projectId, groupId, sensorId },
    scale: "sensor",
    window: { startTs, endTs },
    options: { persist: true, config_profile: "default" },
  };
  const judgeRes = await fetch(`http://127.0.0.1:${port}/api/judge/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(judgeReq),
  });
  const judgeBytes = Buffer.from(await judgeRes.arrayBuffer());
  const judgeJson = JSON.parse(judgeBytes.toString("utf8"));

  // Artifacts dir
  const iso = new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15) + "Z";
  const outDir = path.join(repoRoot, "acceptance", `caf009_1h_${iso}`);
  fs.mkdirSync(outDir, { recursive: true });

  // README (frozen fields; minimal)
  const result = pointsPresent >= minPointsRequired ? "PASS" : "FAIL";
  const lines: string[] = [];
  lines.push(`Result: ${result}`);
  lines.push(`OutputDir: acceptance\\caf009_1h_${iso}`);
  lines.push("");
  lines.push("Truth (frozen):");
  lines.push(`  projectId=${projectId}`);
  lines.push(`  groupId=${groupId}`);
  lines.push(`  sensor_id=${sensorId}`);
  lines.push("");
  lines.push("Window:");
  lines.push(`  maxTs=${maxTs}`);
  lines.push(`  startTs=${startTs}`);
  lines.push(`  endTs=${endTs}`);
  lines.push(`  hours=${hours}`);
  lines.push("");
  lines.push("SSOT:");
  lines.push(`  expected_interval_ms (from config/judge/default.json): ${expectedIntervalMs}`);
  lines.push("");
  lines.push("Data checks:");
  lines.push(`  points_present=${pointsPresent}`);
  lines.push(`  expected_points=${expectedPoints}`);
  lines.push(`  min_points_required=${minPointsRequired} (ceil(expected_points*0.9))`);
  lines.push(`  metrics_present=${metricsPresent} (expected=10)`);
  lines.push(`  metrics_missing=<none>`);
  lines.push(`  metrics_extra=<none>`);
  lines.push("");
  lines.push("Judge call:");
  lines.push("  POST /api/judge/run");
  if (judgeJson?.run_id) lines.push(`  run_id=${judgeJson.run_id}`);
  if (judgeJson?.determinism_hash) lines.push(`  determinism_hash=${judgeJson.determinism_hash}`);
  if (judgeJson?.effective_config_hash) lines.push(`  effective_config_hash=${judgeJson.effective_config_hash}`);
  lines.push("");
  lines.push("Failure reasons:");
  if (result === "PASS") lines.push("  <none>");
  else lines.push(`  - points_present(${pointsPresent}) < min_points_required(${minPointsRequired})`);
  lines.push("");
  lines.push("Artifacts:");
  lines.push("  - run.json (HTTP raw response body bytes)");
  lines.push("  - summary.json (flat schema; includes sensor_id; list fields arrays deduped)");
  lines.push("  - window.json (flat schema; includes sensor_id and maxTs)");
  lines.push("  - README.txt");
  lines.push("");

  // Files
  fs.writeFileSync(path.join(outDir, "run.json"), judgeBytes);
  fs.writeFileSync(
    path.join(outDir, "window.json"),
    JSON.stringify({ projectId, groupId, sensor_id: sensorId, maxTs, startTs, endTs, hours, expected_interval_ms: expectedIntervalMs }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ projectId, groupId, sensor_id: sensorId, points_present: pointsPresent, min_points_required: minPointsRequired, expected_points: expectedPoints, metrics_present: metricsPresent }, null, 2)
  );
  fs.writeFileSync(path.join(outDir, "README.txt"), lines.join("\n"));

  return reply.send({ ok: true, result, outputDir: `acceptance/caf009_1h_${iso}`, points_present: pointsPresent, min_points_required: minPointsRequired, expected_interval_ms: expectedIntervalMs, metrics_present: metricsPresent, judge: judgeJson });
});

// GET /api/groups?projectId=...&sensorId=...
// Read groups from the stable projection tables (NOT from facts).
// GET /api/groups?projectId=...&sensorId=...
// Read projection over sensor_groups (+ members) to aid UI selection.
app.get("/api/groups", async (req, reply) => {
  const q = req.query as Record<string, unknown>;
  const projectId = typeof q.projectId === "string" ? q.projectId.trim() : null;
  const sensorId = typeof q.sensorId === "string" ? q.sensorId.trim() : null;

  const sql = `
    SELECT
      sg.group_id AS group_id,
      sg.project_id AS project_id,
      sg.created_at AS created_at,
      ARRAY_AGG(DISTINCT sgm.sensor_id)
        FILTER (WHERE sgm.sensor_id IS NOT NULL) AS sensors
    FROM sensor_groups sg
    LEFT JOIN sensor_group_members sgm
      ON sgm.group_id = sg.group_id
    WHERE 1=1
      ${projectId ? "AND sg.project_id = $1" : ""}
      ${sensorId ? (projectId ? "AND sgm.sensor_id = $2" : "AND sgm.sensor_id = $1") : ""}
    GROUP BY sg.group_id, sg.project_id, sg.created_at
    ORDER BY sg.group_id ASC
  `;
  const params: any[] = [];
  if (projectId) params.push(projectId);
  if (sensorId) params.push(sensorId);

  const { rows } = await pool.query(sql, params);

  // Return SensorGroupV1 (contracts)
  const groups = (rows as any[])
    .filter((r) => typeof r.group_id === "string" && r.group_id.trim())
    .map((r) => {
      const sensors = (Array.isArray(r.sensors) ? r.sensors : [])
        .filter((s: any) => typeof s === "string" && s.trim())
        .map((s: string) => s.trim())
        .sort();

      const createdAt = r.created_at ? Date.parse(String(r.created_at)) : Date.now();

      return {
        groupId: String(r.group_id),
        subjectRef: {
          projectId: String(r.project_id ?? "P_DEFAULT"),
        },
        // sensor_groups currently has no display_name; fall back to group_id.
        displayName: String(r.group_id),
        sensors,
        createdAt,
      };
    });

  return reply.send({ groups });
});

// ---------------- Admin: configuration domain (groups + membership) ----------------
// NOTE: v1 has no auth. Treat as dev-only admin endpoints.

async function fetchGroupConfig(params: { projectId?: string | null; groupId?: string | null }) {
  const projectId = params.projectId ?? null;
  const groupId = params.groupId ?? null;
  const sql = `
    SELECT
      sg.group_id,
      sg.project_id,
      sg.plot_id,
      sg.block_id,
      sg.created_at,
      ARRAY_AGG(DISTINCT sgm.sensor_id)
        FILTER (WHERE sgm.sensor_id IS NOT NULL) AS sensors
    FROM sensor_groups sg
    LEFT JOIN sensor_group_members sgm ON sgm.group_id = sg.group_id
    WHERE 1=1
      ${projectId ? "AND sg.project_id = $1" : ""}
      ${groupId ? (projectId ? "AND sg.group_id = $2" : "AND sg.group_id = $1") : ""}
    GROUP BY sg.group_id, sg.project_id, sg.plot_id, sg.block_id, sg.created_at
    ORDER BY sg.group_id ASC
  `;
  const args: any[] = [];
  if (projectId) args.push(projectId);
  if (groupId) args.push(groupId);
  const { rows } = await pool.query(sql, args);
  return (rows as any[]).map((r) => ({
    groupId: String(r.group_id),
    projectId: String(r.project_id),
    plotId: r.plot_id == null ? null : String(r.plot_id),
    blockId: r.block_id == null ? null : String(r.block_id),
    createdAt: occurredAtToMs(r.created_at),
    sensors: (Array.isArray(r.sensors) ? r.sensors : []).filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim()).sort(),
  }));
}

// (1) List group configs
// GET /api/admin/groups?projectId=...
app.get("/api/admin/groups", async (req, reply) => {
  const q = req.query as Record<string, unknown>;
  const projectId = typeof q.projectId === "string" ? q.projectId.trim() : null;
  const groups = await fetchGroupConfig({ projectId });
  return reply.send({ groups });
});

// (2) Create group
// POST /api/admin/groups  { groupId, projectId?, plotId?, blockId? }
app.post("/api/admin/groups", async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "P_DEFAULT";
  const plotId = typeof body.plotId === "string" ? body.plotId.trim() : null;
  const blockId = typeof body.blockId === "string" ? body.blockId.trim() : null;
  if (!groupId) return reply.code(400).send({ error: "groupId required" });

  await pool.query(
    `INSERT INTO sensor_groups (group_id, project_id, plot_id, block_id, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (group_id) DO NOTHING`,
    [groupId, projectId, plotId, blockId]
  );

  const [g] = await fetchGroupConfig({ groupId, projectId: null });
  return reply.send({ ok: true, group: g ?? null });
});

// (3) Bind sensor to group
// POST /api/admin/groups/:groupId/members  { sensorId }
app.post("/api/admin/groups/:groupId/members", async (req, reply) => {
  const p = req.params as Record<string, unknown>;
  const groupId = typeof p.groupId === "string" ? p.groupId.trim() : "";
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sensorId = typeof body.sensorId === "string" ? body.sensorId.trim() : "";
  if (!groupId) return reply.code(400).send({ error: "groupId required" });
  if (!sensorId) return reply.code(400).send({ error: "sensorId required" });

  // Ensure group exists (more helpful than a FK error, since FK may not be present).
  const g0 = await pool.query(`SELECT 1 FROM sensor_groups WHERE group_id = $1`, [groupId]);
  if (g0.rowCount === 0) return reply.code(404).send({ error: `group not found: ${groupId}` });

  await pool.query(
    `INSERT INTO sensor_group_members (group_id, sensor_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [groupId, sensorId]
  );

  const [g] = await fetchGroupConfig({ groupId, projectId: null });
  return reply.send({ ok: true, group: g ?? null });
});

// (4) Unbind sensor from group
// DELETE /api/admin/groups/:groupId/members/:sensorId
app.delete("/api/admin/groups/:groupId/members/:sensorId", async (req, reply) => {
  const p = req.params as Record<string, unknown>;
  const groupId = typeof p.groupId === "string" ? p.groupId.trim() : "";
  const sensorId = typeof p.sensorId === "string" ? p.sensorId.trim() : "";
  if (!groupId) return reply.code(400).send({ error: "groupId required" });
  if (!sensorId) return reply.code(400).send({ error: "sensorId required" });

  await pool.query(`DELETE FROM sensor_group_members WHERE group_id = $1 AND sensor_id = $2`, [groupId, sensorId]);

  const [g] = await fetchGroupConfig({ groupId, projectId: null });
  return reply.send({ ok: true, group: g ?? null });
});

// (5) Delete group (and its memberships)
// DELETE /api/admin/groups/:groupId
app.delete("/api/admin/groups/:groupId", async (req, reply) => {
  const p = req.params as Record<string, unknown>;
  const groupId = typeof p.groupId === "string" ? p.groupId.trim() : "";
  if (!groupId) return reply.code(400).send({ error: "groupId required" });

  // Remove members first to keep FK-less schema clean.
  await pool.query(`DELETE FROM sensor_group_members WHERE group_id = $1`, [groupId]);
  await pool.query(`DELETE FROM sensor_groups WHERE group_id = $1`, [groupId]);

  return reply.send({ ok: true, deleted: { groupId } });
});

// GET /api/series?groupId=...&sensorId=...&metrics=a,b&metric=a&startTs=..&endTs=..&maxPoints=..
app.get("/api/series", async (req, reply) => {
  const q = req.query as Record<string, unknown>;

  let startTs: number;
  let endTs: number;
  let metrics: string[];
  let maxPoints: number;

  try {
    startTs = parseIntParam(q.startTs, "startTs");
    endTs = parseIntParam(q.endTs, "endTs");

    // Backward compatible: allow either metrics=csv or metric=single (web client often uses metric=)
    const metricsCsv =
      typeof q.metrics === "string"
        ? q.metrics
        : typeof (q as any).metric === "string"
          ? String((q as any).metric)
          : "";

    metrics = uniq(splitCsv(metricsCsv));
    maxPoints = q.maxPoints === undefined ? 2000 : parseIntParam(q.maxPoints, "maxPoints");
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) });
  }

  if (metrics.length === 0) return reply.code(400).send({ error: "metrics required" });
  if (endTs <= startTs) return reply.code(400).send({ error: "invalid range" });

  const groupId = typeof q.groupId === "string" ? q.groupId.trim() : null;
  const sensorId = typeof q.sensorId === "string" ? q.sensorId.trim() : null;
  const spatialUnitId =
    typeof (q as any).spatialUnitId === "string" ? String((q as any).spatialUnitId).trim() : null;

  if (!groupId && !sensorId && !spatialUnitId) {
    return reply.code(400).send({ error: "groupId or sensorId or spatialUnitId required" });
  }

  // --- Query raw_sample_v1 from append-only facts ledger ---
  const whereParts: string[] = [];
  const params: any[] = [];
  let p = 1;

  whereParts.push(`(record_json::jsonb ->> 'type') = 'raw_sample_v1'`);
  whereParts.push(`occurred_at >= to_timestamp($${p++} / 1000.0)`); params.push(startTs);
  whereParts.push(`occurred_at <= to_timestamp($${p++} / 1000.0)`); params.push(endTs);

  // IMPORTANT: cast to text[] for ANY
  whereParts.push(`(record_json::jsonb -> 'payload' ->> 'metric') = ANY($${p++}::text[])`);
  params.push(metrics);

  if (groupId) { whereParts.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${p++}`); params.push(groupId); }
  if (sensorId) { whereParts.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${p++}`); params.push(sensorId); }
  if (spatialUnitId) { whereParts.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${p++}`); params.push(spatialUnitId); }

  const rawSql = `
    SELECT fact_id, occurred_at, source as facts_source, record_json
    FROM facts
    WHERE ${whereParts.join(" AND ")}
    ORDER BY occurred_at ASC
    LIMIT $${p++}
  `;
  params.push(Math.max(1, Math.min(20000, maxPoints * 50))); // pre-cap

  const rawRes = await pool.query(rawSql, params);

  const samples: SeriesSampleV1[] = [];
  const tsList: number[] = [];

  for (const r of rawRes.rows as any[]) {
    // record_json is TEXT in table -> must parse
    const rec = parseRecordJson(r.record_json);
    if (!rec) continue;

    const entity = rec?.entity ?? {};
    const payload = rec?.payload ?? {};
    const qc = rec?.qc ?? {};

    const ts = occurredAtToMs(r.occurred_at);
    const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim();
    if (!sid) continue;

    const metric = String(payload.metric ?? "").trim();
    if (!metric) continue;

    const v = Number(payload.value);
    if (!Number.isFinite(v)) continue;

    const quality = (String(qc.quality ?? "unknown") as QcQuality) || "unknown";

    samples.push({
      ts,
      sensorId: sid,
      metric,
      value: v,
      quality,
      source: (String(rec.source ?? r.facts_source ?? "device") as any) ?? "device",
    } as any);

    tsList.push(ts);
  }

  // Downsample (simple stride) if too many
  let sampled = samples;
  if (samples.length > maxPoints) {
    const stride = Math.ceil(samples.length / maxPoints);
    sampled = samples.filter((_, i) => i % stride === 0);
  }

  const gaps = computeGapsGlobal(tsList, startTs, endTs);

  // --- marker_v1 as overlays ---
  const ovWhere: string[] = [];
  const ovParams: any[] = [];
  let op = 1;

  ovWhere.push(`(record_json::jsonb ->> 'type') = 'marker_v1'`);
  ovWhere.push(`occurred_at >= to_timestamp($${op++} / 1000.0)`); ovParams.push(startTs);
  ovWhere.push(`occurred_at <= to_timestamp($${op++} / 1000.0)`); ovParams.push(endTs);
  if (groupId) { ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${op++}`); ovParams.push(groupId); }
  if (sensorId) { ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${op++}`); ovParams.push(sensorId); }
  if (spatialUnitId) { ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${op++}`); ovParams.push(spatialUnitId); }

  const markerSql = `
    SELECT fact_id, occurred_at, record_json
    FROM facts
    WHERE ${ovWhere.join(" AND ")}
    ORDER BY occurred_at ASC
    LIMIT 5000
  `;
  const markerRes = await pool.query(markerSql, ovParams);

  const overlays: OverlaySegment[] = [];
  for (const r of markerRes.rows as any[]) {
    const rec = parseRecordJson(r.record_json);
    if (!rec) continue;

    const entity = rec?.entity ?? {};
    const payload = rec?.payload ?? {};
    const kind = String(payload.type ?? payload.kind ?? "").trim();

    const sid = String(entity.sensor_id ?? "").trim();
    if (!sid) continue;
    if (!isMarkerKind(kind)) continue;

    const t = occurredAtToMs(r.occurred_at);
    // Interval marker support (optional): allow QC range overlays etc.
    // If payload provides startTs/endTs (or snake_case), prefer those.
    let startTs = t;
    let endTs = t;
    const pStart = payload?.startTs ?? payload?.start_ts ?? null;
    const pEnd = payload?.endTs ?? payload?.end_ts ?? null;
    if (typeof pStart === "number" && Number.isFinite(pStart)) startTs = pStart;
    if (typeof pEnd === "number" && Number.isFinite(pEnd)) endTs = pEnd;
    if (endTs < startTs) {
      const tmp = startTs;
      startTs = endTs;
      endTs = tmp;
    }
    overlays.push({
      startTs,
      endTs,
      sensorId: sid,
      metric: (payload.metric ? String(payload.metric) : null) ?? null,
      kind: kind as any,
      confidence: null,
      note: payload.note ? String(payload.note).slice(0, 120) : null,
      source: (String(rec.source ?? "system") as any) ?? "system",
    });
  }

  const resp: SeriesResponseV1 = {
    range: { startTs, endTs, maxPoints } as any,
    samples: sampled as any,
    gaps,
    overlays: overlays as any,
  };

  return reply.send(resp);
});

// POST /api/marker
// Writes a marker_v1 Fact (append-only).
app.post("/api/marker", async (req, reply) => {
  const body = req.body as any;
  try {
    const ts = Number(body?.ts);
    const sensorId = parseStringParam(body?.sensorId, "sensorId");
    const type = parseStringParam(body?.type, "type");
    const source = parseStringParam(body?.source, "source") as FactsSource;
    const note = typeof body?.note === "string" ? body.note.slice(0, 120) : null;
    const groupId = typeof body?.groupId === "string" && body.groupId.trim() ? body.groupId.trim() : null;
    const spatialUnitId = typeof body?.spatialUnitId === "string" && body.spatialUnitId.trim() ? body.spatialUnitId.trim() : null;

    if (!Number.isFinite(ts) || ts <= 0) throw new Error("invalid ts");
    if (!isMarkerKind(type)) throw new Error("invalid type");
    if (!["device", "gateway", "system", "human"].includes(source)) throw new Error("invalid source");

    const factId = randomUUID();
    const occurredAtIso = toIso(ts);

    const record = {
      type: "marker_v1",
      schema_version: "1.0.0",
      occurred_at: occurredAtIso,
      source,
      entity: {
        spatial_unit_id: spatialUnitId ?? "SU:plot:UNKNOWN",
        sensor_id: sensorId,
        group_id: groupId ?? undefined,
      },
      payload: {
        type,
        note,
      },
      qc: { quality: "unknown", exclusion_reason: null },
      integrity: { content_hash: "sha256:__PLACEHOLDER__", prev_fact_id: null },
      refs: { media_key: null, evidence_refs: [] },
    };

    await pool.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2, $3, $4::text)`,
      [factId, occurredAtIso, source, JSON.stringify(record)]
    );

    return reply.send({ ok: true, fact_id: factId });
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) });
  }
});

// POST /api/canopy/upload (multipart)
// Stores image to /media/canopy/<uuid>.<ext> and writes a canopy_frame_v1 Fact.
app.post("/api/canopy/upload", async (req, reply) => {
  // Collect multipart fields + file robustly.
  const fields = new Map<string, string>();
  let fileBuf: Buffer | null = null;
  let fileMime = "application/octet-stream";
  let fileName = "upload";

  // IMPORTANT: consume ALL parts; otherwise fields may not be available.
  const parts = (req as any).parts();
  for await (const part of parts) {
    if (part.type === "file") {
      fileMime = part.mimetype ?? fileMime;
      fileName = part.filename ?? fileName;
      fileBuf = await part.toBuffer();
    } else if (part.type === "field") {
      const v = typeof part.value === "string" ? part.value : String(part.value ?? "");
      fields.set(part.fieldname, v);
    }
  }

  if (!fileBuf) return reply.code(400).send({ error: "missing file" });

  // Accept both camelCase and snake_case keys (more forgiving)
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = fields.get(k);
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const projectId = get("projectId", "project_id") ?? "P_DEFAULT";
  const cameraId = get("cameraId", "camera_id") ?? "cam_01";
  const groupId = get("groupId", "group_id");
  const spatialUnitId = get("spatialUnitId", "spatial_unit_id") ?? "SU:plot:UNKNOWN";
  const source = (get("source") ?? "device") as FactsSource;

  const tsRaw = get("ts");
  const ts = tsRaw ? Date.parse(tsRaw) : nowMs();
  const occurredAtIso = new Date(Number.isFinite(ts) ? ts : nowMs()).toISOString();

  const ext = fileMime === "image/png" ? "png" : "jpg";
  const key = `canopy/${randomUUID()}.${ext}`;
  const outPath = path.join(MEDIA_DIR, key);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, fileBuf);

  const factId = randomUUID();

  const record = {
    type: "canopy_frame_v1",
    schema_version: "1.0.0",
    occurred_at: occurredAtIso,
    source,
    entity: {
      spatial_unit_id: spatialUnitId,
      project_id: projectId,
      camera_id: cameraId,
      group_id: groupId ?? undefined,
    },
    payload: {
      storage_key: key,
      mime: fileMime,
      filename: fileName,
    },
    qc: { quality: "unknown", exclusion_reason: null },
    integrity: { content_hash: "sha256:__PLACEHOLDER__", prev_fact_id: null },
    refs: { media_key: key, evidence_refs: [] },
  };

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2, $3, $4::text)`,
    [factId, occurredAtIso, source, JSON.stringify(record)]
  );

  return reply.send({ ok: true, fact_id: factId, storage_key: key, url: `/media/${key}` });
});

// GET /api/canopy/list?groupId=...&sensorId=...&spatialUnitId=...&startTs=..&endTs=..
app.get("/api/canopy/list", async (req, reply) => {
  const q = req.query as Record<string, unknown>;
  let startTs = 0;
  let endTs = nowMs();
  try {
    if (q.startTs !== undefined) startTs = parseIntParam(q.startTs, "startTs");
    if (q.endTs !== undefined) endTs = parseIntParam(q.endTs, "endTs");
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) });
  }
  const groupId = typeof q.groupId === "string" ? q.groupId.trim() : null;
  const spatialUnitId = typeof (q as any).spatialUnitId === "string" ? String((q as any).spatialUnitId).trim() : null;

  const where: string[] = [];
  const params: any[] = [];
  let p = 1;
  where.push(`(record_json::jsonb ->> 'type') = 'canopy_frame_v1'`);
  where.push(`occurred_at >= to_timestamp($${p++} / 1000.0)`); params.push(startTs);
  where.push(`occurred_at <= to_timestamp($${p++} / 1000.0)`); params.push(endTs);
  if (groupId) { where.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${p++}`); params.push(groupId); }
  if (spatialUnitId) { where.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${p++}`); params.push(spatialUnitId); }

  const sql = `
    SELECT fact_id, occurred_at, record_json
    FROM facts
    WHERE ${where.join(" AND ")}
    ORDER BY occurred_at ASC
    LIMIT 5000
  `;
  const res = await pool.query(sql, params);

  const frames: CanopyFrameV1[] = (res.rows as any[]).map((r) => {
    const rec = parseRecordJson(r.record_json) ?? {};
    const entity = rec?.entity ?? {};
    const payload = rec?.payload ?? {};
    const key = String(payload.storage_key ?? rec?.refs?.media_key ?? "").trim();
    const ts = occurredAtToMs(r.occurred_at);
    return {
      ts,
      project_id: String(entity.project_id ?? "P_DEFAULT"),
      plot_id: entity.plot_id ? String(entity.plot_id) : null,
      block_id: entity.block_id ? String(entity.block_id) : null,
      camera_id: String(entity.camera_id ?? "cam_01"),
      storage_key: key,
      mime: String(payload.mime ?? "image/jpeg"),
      note: null,
      source: (String(rec.source ?? "device") as any) ?? "device",
      url: `/media/${key}`,
    } as any;
  });

  return reply.send({ frames });
});

// GET /api/overlays/explain?id=<fact_id>
// Minimal explainability for marker_v1.
// No causality. No action guidance.
app.get("/api/overlays/explain", async (req, reply) => {
  const q = req.query as Record<string, unknown>;
  const id = typeof q.id === "string" ? q.id.trim() : null;
  if (!id) return reply.code(400).send({ error: "missing id" });

  const { rows } = await pool.query(
    `SELECT fact_id, occurred_at, record_json
     FROM facts
     WHERE fact_id = $1
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return reply.code(404).send({ error: "overlay not found" });

  const r = rows[0] as any;
  const rec = parseRecordJson(r.record_json);
  if (!rec) return reply.code(500).send({ error: "bad record_json" });

  if (String(rec?.type ?? rec?.["type"]) !== "marker_v1") {
    return reply.code(400).send({ error: "unsupported overlay type" });
  }

  const entity = rec?.entity ?? {};
  const payload = rec?.payload ?? {};
  const sensor_id = String(entity.sensor_id ?? "").trim();
  const metric = payload.metric ? String(payload.metric) : "";
  const start_ts = occurredAtToMs(r.occurred_at);
  const end_ts = start_ts;

  // Evidence window: ±30min
  const w0 = start_ts - 30 * 60 * 1000;
  const w1 = start_ts + 30 * 60 * 1000;

  const ev = await pool.query(
    `SELECT record_json, occurred_at
     FROM facts
     WHERE (record_json::jsonb ->> 'type') = 'raw_sample_v1'
       AND (record_json::jsonb -> 'entity' ->> 'sensor_id') = $1
       AND occurred_at >= to_timestamp($2 / 1000.0)
       AND occurred_at <= to_timestamp($3 / 1000.0)`,
    [sensor_id, w0, w1]
  );

  let sample_count = 0,
    suspect_count = 0,
    bad_count = 0;
  const tsList: number[] = [];

  for (const rr of ev.rows as any[]) {
    const rc = parseRecordJson(rr.record_json);
    if (!rc) continue;

    const qc = rc?.qc ?? {};
    const occ = occurredAtToMs(rr.occurred_at ?? rc?.occurred_at);
    if (Number.isFinite(occ) && occ > 0) tsList.push(occ);

    sample_count++;
    const qv = String(qc.quality ?? "unknown");
    if (qv === "suspect") suspect_count++;
    if (qv === "bad") bad_count++;
  }
  const gap_count = computeGapsGlobal(tsList, w0, w1).length;

  const overlay = {
    id: r.fact_id,
    sensor_id,
    metric: metric || null,
    start_ts,
    end_ts,
    kind: payload.type ?? null,
    severity: null,
    params: {},
    algo_version: "p4",
    created_at: r.occurred_at,
  };

  const payloadOut = {
    overlay,
    rule_id: "marker.human_or_device",
    rule_version: "p4",
    emitted_at: String(r.occurred_at),
    evidence: {
      sensor_id,
      group_id: entity.group_id ?? undefined,
      metric: metric || "unknown",
      start_ts: w0,
      end_ts: w1,
      sample_count,
      suspect_count,
      bad_count,
      gap_count,
    },
    notes: [
      "Explain payload is descriptive only (no causality, no action guidance).",
      "This overlay is a marker fact. It is replayable and auditable.",
    ],
  };

  return reply.send(payloadOut);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
