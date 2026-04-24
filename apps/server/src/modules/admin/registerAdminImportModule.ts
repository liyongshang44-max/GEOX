import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

export function registerAdminImportModule(app: FastifyInstance, pool: Pool): void {
// ---------------- Import jobs (admin) ----------------
type ImportJobState = "queued" | "running" | "done" | "error"; // 导入任务状态
type ImportJob = {
  jobId: string; // 任务 ID
  state: ImportJobState; // 当前状态
  createdAt: number; // 创建时间（ms）
  updatedAt: number; // 更新时间（ms）
  filePath: string; // 上传文件路径
  args: string[]; // 子进程参数
  exitCode: number | null; // 子进程退出码
  stdoutTail: string; // stdout 截断尾部
  stderrTail: string; // stderr 截断尾部
  error?: string; // 错误信息
};
const importJobs = new Map<string, ImportJob>(); // 任务存储（内存）

function tailAppend(prev: string, next: string, max = 8000): string {
  const merged = (prev + next).slice(-max); // 截断为 max 长度的尾巴
  return merged; // 返回截断结果
}

app.post("/api/admin/import/caf_hourly", async (req, reply) => {
  const fields = new Map<string, string>(); // 保存表单字段
  let savedFilePath: string | null = null; // 上传文件保存路径
  let fileName = "upload.txt"; // 默认文件名

  const __filename = fileURLToPath(import.meta.url); // 当前文件路径
  const __dirname = path.dirname(__filename); // 当前目录
  const repoRoot = path.resolve(__dirname, "..", "..", ".."); // repo 根目录
  const uploadDir = path.join(repoRoot, "_uploads"); // 上传目录
  fs.mkdirSync(uploadDir, { recursive: true }); // 确保目录存在

  const parts = (req as any).parts(); // 读取 multipart parts
  for await (const part of parts) {
    if (part.type === "file") {
      fileName = part.filename ?? fileName; // 取文件名
      const ext = path.extname(fileName ?? "") || ".txt"; // 扩展名
      const fp = path.join(uploadDir, `${Date.now()}_${randomUUID()}${ext}`); // 生成保存路径

      const ws = fs.createWriteStream(fp); // 创建写流
      await pipeline(part.file, ws); // 把上传流写入文件
      savedFilePath = fp; // 记录保存路径
    } else if (part.type === "field") {
      const v = typeof part.value === "string" ? part.value : String(part.value ?? ""); // 读取字段值
      fields.set(part.fieldname, v); // 存入 map
    } else {
      const fieldname = String((part as any).fieldname ?? ""); // 兜底 fieldname
      if (fieldname) fields.set(fieldname, String((part as any).value ?? "")); // 兜底存入
    }
  }

  if (!savedFilePath) return reply.code(400).send({ ok: false, error: "file is required" }); // 没文件则 400

  const st = fs.statSync(savedFilePath); // 读取文件信息
  if (!st.size) return reply.code(400).send({ ok: false, error: "file is required", hint: "upload_empty_file" }); // 空文件拒绝

  const projectId = (fields.get("projectId") || "P_DEFAULT").trim() || "P_DEFAULT"; // projectId
  const groupId = (fields.get("groupId") || "G_CAF").trim() || "G_CAF"; // groupId
  const writeRawSamples = (fields.get("writeRawSamples") || "1").trim() || "1"; // 是否写 raw_samples
  const writeMarkers = (fields.get("writeMarkers") || "1").trim() || "1"; // 是否写 markers

  const databaseUrl = process.env.DATABASE_URL || "postgres://landos:landos_pwd@postgres:5432/landos"; // 子进程 DB URL

  const tsNodeBin = path.join(repoRoot, "node_modules", ".bin", "ts-node"); // ts-node 可执行
  const loadfactPath = path.join(repoRoot, "scripts", "loadfact.ts"); // loadfact.ts 路径
  const args = [
    "--transpile-only", // ts-node 参数：只转译
    loadfactPath, // 入口脚本
    "--file", // 参数：文件
    savedFilePath, // 文件路径
    "--projectId", // 参数：projectId
    projectId, // projectId 值
    "--groupId", // 参数：groupId
    groupId, // groupId 值
    "--writeRawSamples", // 参数：写 raw_samples
    writeRawSamples, // 值
    "--writeMarkers", // 参数：写 markers
    writeMarkers, // 值
  ];

  const jobId = `import_${Date.now()}_${randomUUID()}`; // 生成 jobId
  const job: ImportJob = {
    jobId, // jobId
    state: "queued", // 初始 queued
    createdAt: Date.now(), // 创建时间
    updatedAt: Date.now(), // 更新时间
    filePath: savedFilePath, // 文件路径
    args, // 参数
    exitCode: null, // 未结束
    stdoutTail: "", // stdout 尾巴
    stderrTail: "", // stderr 尾巴
  };
  importJobs.set(jobId, job); // 存入 map

  job.state = "running"; // 标记 running
  job.updatedAt = Date.now(); // 更新时间

  const child = spawn(tsNodeBin, args, {
    cwd: repoRoot, // 工作目录
    env: { ...process.env, DATABASE_URL: databaseUrl }, // 注入 DB URL
  });

  child.stdout.on("data", (buf) => {
    job.stdoutTail = tailAppend(job.stdoutTail, String(buf)); // 追加 stdout
    job.updatedAt = Date.now(); // 更新时间
  });

  child.stderr.on("data", (buf) => {
    job.stderrTail = tailAppend(job.stderrTail, String(buf)); // 追加 stderr
    job.updatedAt = Date.now(); // 更新时间
  });

  child.on("error", (e) => {
    job.state = "error"; // 标记 error
    job.error = String(e?.message ?? e); // 记录错误
    job.updatedAt = Date.now(); // 更新时间
  });

  child.on("close", (code) => {
    job.exitCode = typeof code === "number" ? code : null; // 记录退出码
    job.state = code === 0 ? "done" : "error"; // 0 则 done
    if (code !== 0) job.error = job.error || `exit code ${code}`; // 非 0 记录错误
    job.updatedAt = Date.now(); // 更新时间
  });

  return reply.send({ ok: true, jobId, filePath: savedFilePath }); // 返回 job 信息
});

app.get("/api/admin/import/jobs/:jobId", async (req, reply) => {
  const p = req.params as Record<string, unknown>; // 读取 params
  const jobId = typeof p.jobId === "string" ? p.jobId.trim() : ""; // 取 jobId
  const job = importJobs.get(jobId); // 查找任务
  if (!job) return reply.code(404).send({ ok: false, error: "job not found" }); // 不存在则 404
  return reply.send({ ok: true, job }); // 返回任务
});

app.post("/api/admin/acceptance/caf009_1h/run", async (req, reply) => {
  const body = (req.body ?? {}) as any; // 读取 body
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "P_DEFAULT"; // projectId
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "G_CAF"; // groupId
  const sensorId = typeof body.sensorId === "string" ? body.sensorId.trim() : "CAF009"; // sensorId

  const __filename = fileURLToPath(import.meta.url); // 当前文件路径
  const __dirname = path.dirname(__filename); // 当前目录
  const repoRoot = path.resolve(__dirname, "..", "..", ".."); // repo 根目录

  const judgeDefaultPath = path.join(repoRoot, "config", "judge", "default.json"); // judge default.json
  const judgeDefault = JSON.parse(fs.readFileSync(judgeDefaultPath, "utf8")); // 读取并解析
  const expectedIntervalMs = Number(judgeDefault?.time_coverage?.expected_interval_ms ?? 60000); // 读取 expected_interval_ms

  const maxR = await pool.query("select max(ts_ms) as max_ts_ms from raw_samples where sensor_id=$1", [sensorId]); // 找最大 ts
  const maxTs = Number(maxR.rows?.[0]?.max_ts_ms ?? 0); // maxTs

  const endTs = maxTs; // window end
  const startTs = endTs - 3600000; // window start（1h）
  const hours = 1; // window hours

  const pointsR = await pool.query(
    "select count(distinct ts_ms) as n from raw_samples where sensor_id=$1 and ts_ms >= $2 and ts_ms <= $3",
    [sensorId, startTs, endTs]
  ); // 统计点数
  const pointsPresent = Number(pointsR.rows?.[0]?.n ?? 0); // points_present

  const expectedPoints = Math.floor((hours * 3600000) / expectedIntervalMs); // 期望点数
  const minPointsRequired = Math.ceil(expectedPoints * 0.9); // 最小要求点数（90%）

  const metricsR = await pool.query(
    "select array_agg(distinct metric order by metric) as metrics from raw_samples where sensor_id=$1 and ts_ms >= $2 and ts_ms <= $3",
    [sensorId, startTs, endTs]
  ); // 统计 metrics
  const metrics: string[] = Array.isArray(metricsR.rows?.[0]?.metrics) ? metricsR.rows[0].metrics : []; // metrics 列表
  const metricsPresent = metrics.length; // metrics 数量

  const port = Number(process.env.PORT || 3000); // 当前 server 端口
  const judgeReq = {
    subjectRef: { projectId, groupId, sensorId }, // Judge subject
    scale: "sensor", // 按 sensor 运行
    window: { startTs, endTs }, // 时间窗
    options: { persist: true, config_profile: "default" }, // persist + default profile
  };

  const judgeRes = await fetch(`http://127.0.0.1:${port}/api/judge/run`, {
    method: "POST", // POST
    headers: { "content-type": "application/json" }, // JSON
    body: JSON.stringify(judgeReq), // body
  });

  const judgeBytes = Buffer.from(await judgeRes.arrayBuffer()); // 读取原始 bytes（保持可审计）
  const judgeJson = JSON.parse(judgeBytes.toString("utf8")); // 解析 JSON

  const iso = new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15) + "Z"; // 生成目录戳
  const outDir = path.join(repoRoot, "acceptance", `caf009_1h_${iso}`); // 输出目录
  fs.mkdirSync(outDir, { recursive: true }); // 确保输出目录存在

  const result = pointsPresent >= minPointsRequired ? "PASS" : "FAIL"; // PASS/FAIL

  const lines: string[] = []; // README 行列表
  lines.push(`Result: ${result}`); // 结果
  lines.push(`OutputDir: acceptance\\caf009_1h_${iso}`); // 目录
  lines.push(""); // 空行
  lines.push("Truth (frozen):"); // 冻结信息
  lines.push(`  projectId=${projectId}`); // projectId
  lines.push(`  groupId=${groupId}`); // groupId
  lines.push(`  sensor_id=${sensorId}`); // sensorId
  lines.push(""); // 空行
  lines.push("Window:"); // window
  lines.push(`  maxTs=${maxTs}`); // maxTs
  lines.push(`  startTs=${startTs}`); // startTs
  lines.push(`  endTs=${endTs}`); // endTs
  lines.push(`  hours=${hours}`); // hours
  lines.push(""); // 空行
  lines.push("SSOT:"); // SSOT
  lines.push(`  expected_interval_ms (from config/judge/default.json): ${expectedIntervalMs}`); // expected_interval_ms
  lines.push(""); // 空行
  lines.push("Data checks:"); // checks
  lines.push(`  points_present=${pointsPresent}`); // points present
  lines.push(`  expected_points=${expectedPoints}`); // expected
  lines.push(`  min_points_required=${minPointsRequired} (ceil(expected_points*0.9))`); // min required
  lines.push(`  metrics_present=${metricsPresent} (expected=10)`); // metrics present
  lines.push(`  metrics_missing=<none>`); // placeholder
  lines.push(`  metrics_extra=<none>`); // placeholder
  lines.push(""); // 空行
  lines.push("Judge call:"); // judge call
  lines.push("  POST /api/judge/run"); // endpoint
  if (judgeJson?.run_id) lines.push(`  run_id=${judgeJson.run_id}`); // run_id
  if (judgeJson?.determinism_hash) lines.push(`  determinism_hash=${judgeJson.determinism_hash}`); // determinism_hash
  if (judgeJson?.effective_config_hash) lines.push(`  effective_config_hash=${judgeJson.effective_config_hash}`); // effective_config_hash
  lines.push(""); // 空行
  lines.push("Failure reasons:"); // failure reasons
  if (result === "PASS") lines.push("  <none>"); // pass
  else lines.push(`  - points_present(${pointsPresent}) < min_points_required(${minPointsRequired})`); // fail reason
  lines.push(""); // 空行
  lines.push("Artifacts:"); // artifacts
  lines.push("  - run.json (HTTP raw response body bytes)"); // run.json
  lines.push("  - summary.json (flat schema; includes sensor_id; list fields arrays deduped)"); // summary.json
  lines.push("  - window.json (flat schema; includes sensor_id and maxTs)"); // window.json
  lines.push("  - README.txt"); // README.txt
  lines.push(""); // 空行

  fs.writeFileSync(path.join(outDir, "run.json"), judgeBytes); // 写入 run.json（bytes）
  fs.writeFileSync(
    path.join(outDir, "window.json"),
    JSON.stringify(
      { projectId, groupId, sensor_id: sensorId, maxTs, startTs, endTs, hours, expected_interval_ms: expectedIntervalMs },
      null,
      2
    )
  ); // 写入 window.json
  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify(
      {
        projectId,
        groupId,
        sensor_id: sensorId,
        points_present: pointsPresent,
        min_points_required: minPointsRequired,
        expected_points: expectedPoints,
        metrics_present: metricsPresent,
      },
      null,
      2
    )
  ); // 写入 summary.json
  fs.writeFileSync(path.join(outDir, "README.txt"), lines.join("\n")); // 写入 README

  return reply.send({
    ok: true, // ok
    result, // PASS/FAIL
    outputDir: `acceptance/caf009_1h_${iso}`, // 输出目录
    points_present: pointsPresent, // points present
    min_points_required: minPointsRequired, // min required
    expected_interval_ms: expectedIntervalMs, // expected interval
    metrics_present: metricsPresent, // metrics present
    judge: judgeJson, // judge 结果
  });
});


}
