import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { SeriesResponseV1 } from "@geox/contracts";

type FactsSource = "device" | "gateway" | "system" | "human";
type QcQuality = "unknown" | "ok" | "suspect" | "bad";
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
]);

function isMarkerKind(kind: unknown): boolean {
  return typeof kind === "string" && MARKER_KIND_ALLOWLIST.has(kind.trim());
}

type SeriesGapV1 = { startTs: number; endTs: number; reason?: "unknown" | "no_data" | "device_offline" };
type SeriesSampleV1 = { ts: number; sensorId: string; metric: string; value: number; quality: "unknown" | "ok" | "suspect" | "bad"; source: "device" | "gateway" | "system" | "human" | "import" | "sim" };
type OverlaySegment = { startTs: number; endTs: number; sensorId: string; metric: string | null; kind: string; confidence: OverlayConfidence | null; note: string | null; source: "device" | "gateway" | "system" | "human" };
type SensorGroupV1 = { groupId: string; subjectRef: { projectId: string }; displayName: string; sensors: string[]; createdAt: number };
type CanopyFrameV1 = { ts: number; project_id: string; plot_id: string | null; block_id: string | null; camera_id: string; storage_key: string; mime: string; note: string | null; source: "device" | "gateway" | "system" | "human" | "import" | "sim"; url: string };

function nowMs(): number { return Date.now(); }
function toIso(ts: number): string { return new Date(ts).toISOString(); }
function parseIntParam(v: unknown, name: string): number { const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`); return n; }
function parseStringParam(v: unknown, name: string): string { if (typeof v !== "string" || v.trim().length === 0) throw new Error(`invalid ${name}`); return v.trim(); }
function splitCsv(v: string): string[] { return v.split(",").map((s) => s.trim()).filter(Boolean); }
function uniq<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }
function multipartField(fields: any, key: string): string | undefined { const v = fields?.[key]; if (!v) return undefined; const pick = (x: any): string | undefined => { if (typeof x === "string") return x.trim() || undefined; if (x && typeof x === "object" && typeof x.value === "string") return x.value.trim() || undefined; return undefined; }; if (Array.isArray(v)) { for (const it of v) { const got = pick(it); if (got) return got; } return undefined; } return pick(v); }
function computeGapsGlobal(tsList: number[], startTs: number, endTs: number): SeriesGapV1[] { const gaps: SeriesGapV1[] = []; if (!tsList.length) { gaps.push({ startTs, endTs }); return gaps; } const sorted = tsList.slice().sort((a, b) => a - b); if (sorted[0] > startTs) gaps.push({ startTs, endTs: sorted[0] }); for (let i = 1; i < sorted.length; i++) { const prev = sorted[i - 1]; const cur = sorted[i]; const delta = cur - prev; if (delta > 30 * 60 * 1000) gaps.push({ startTs: prev, endTs: cur }); } const last = sorted[sorted.length - 1]; if (last < endTs) gaps.push({ startTs: last, endTs }); return gaps; }
function safeJsonParse<T>(s: unknown): T | null { if (typeof s !== "string") return null; try { return JSON.parse(s) as T; } catch { return null; } }
function parseRecordJson(x: any): any | null { if (x == null) return null; if (typeof x === "object") return x; if (typeof x !== "string") return null; return safeJsonParse<any>(x); }
function occurredAtToMs(occurred_at: unknown): number { if (occurred_at instanceof Date) return occurred_at.getTime(); const ms = Date.parse(String(occurred_at ?? "")); return Number.isFinite(ms) ? ms : 0; }

export function registerLegacyMonitoringModule(app: FastifyInstance, pool: Pool, mediaDir: string): void {
// ⚠️ LEGACY MONITORING ROUTES BELOW: sensor_group/raw_sample/marker/series compatibility only.
// New pages must use operation_state_v1 / dashboard_v1 / program_v1 and must NOT consume these endpoints.
app.get("/api/groups", async (req, reply) => {
  const q = req.query as Record<string, unknown>; // query
  const projectId = typeof q.projectId === "string" ? q.projectId.trim() : null; // projectId
  const sensorId = typeof q.sensorId === "string" ? q.sensorId.trim() : null; // sensorId

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
  `; // 动态 SQL（按 projectId / sensorId 可选过滤）

  const params: any[] = []; // SQL 参数
  if (projectId) params.push(projectId); // 参数 1：projectId
  if (sensorId) params.push(sensorId); // 参数 2：sensorId（若有）

  const { rows } = await pool.query(sql, params); // 执行查询

  const groups = (rows as any[])
    .filter((r) => typeof r.group_id === "string" && r.group_id.trim()) // 过滤非法 group
    .map((r) => {
      const sensors = (Array.isArray(r.sensors) ? r.sensors : [])
        .filter((s: any) => typeof s === "string" && s.trim())
        .map((s: string) => s.trim())
        .sort(); // 整理 sensors 列表

      const createdAt = r.created_at ? Date.parse(String(r.created_at)) : Date.now(); // createdAt

      const out: SensorGroupV1 = {
        groupId: String(r.group_id), // groupId
        subjectRef: { projectId: String(r.project_id ?? "P_DEFAULT") }, // subjectRef
        displayName: String(r.group_id), // displayName
        sensors, // sensors
        createdAt, // createdAt
      } as any;

      return out; // 输出
    });

  return reply.send({ groups }); // 返回 groups
});

// ---------------- Admin: configuration domain (groups + membership) ----------------

async function fetchGroupConfig(params: { projectId?: string | null; groupId?: string | null }) {
  const projectId = params.projectId ?? null; // projectId
  const groupId = params.groupId ?? null; // groupId

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
  `; // 查询 group 配置

  const args: any[] = []; // 参数
  if (projectId) args.push(projectId); // projectId 参数
  if (groupId) args.push(groupId); // groupId 参数

  const { rows } = await pool.query(sql, args); // 查询

  return (rows as any[]).map((r) => ({
    groupId: String(r.group_id), // groupId
    projectId: String(r.project_id), // projectId
    plotId: r.plot_id == null ? null : String(r.plot_id), // plotId
    blockId: r.block_id == null ? null : String(r.block_id), // blockId
    createdAt: occurredAtToMs(r.created_at), // createdAt
    sensors: (Array.isArray(r.sensors) ? r.sensors : [])
      .filter((s: any) => typeof s === "string" && s.trim())
      .map((s: string) => s.trim())
      .sort(), // sensors
  }));
}

app.get("/api/admin/groups", async (req, reply) => {
  const q = req.query as Record<string, unknown>; // query
  const projectId = typeof q.projectId === "string" ? q.projectId.trim() : null; // projectId
  const groups = await fetchGroupConfig({ projectId }); // 查 groups
  return reply.send({ groups }); // 返回
});

app.post("/api/admin/groups", async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, unknown>; // body
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : ""; // groupId
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "P_DEFAULT"; // projectId
  const plotId = typeof body.plotId === "string" ? body.plotId.trim() : null; // plotId
  const blockId = typeof body.blockId === "string" ? body.blockId.trim() : null; // blockId
  if (!groupId) return reply.code(400).send({ error: "groupId required" }); // groupId 必填

  await pool.query(
    `INSERT INTO sensor_groups (group_id, project_id, plot_id, block_id, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (group_id) DO NOTHING`,
    [groupId, projectId, plotId, blockId]
  ); // upsert group

  const [g] = await fetchGroupConfig({ groupId, projectId: null }); // 查回写入结果
  return reply.send({ ok: true, group: g ?? null }); // 返回
});

app.post("/api/admin/groups/:groupId/members", async (req, reply) => {
  const p = req.params as Record<string, unknown>; // params
  const groupId = typeof p.groupId === "string" ? p.groupId.trim() : ""; // groupId
  const body = (req.body ?? {}) as Record<string, unknown>; // body
  const sensorId = typeof body.sensorId === "string" ? body.sensorId.trim() : ""; // sensorId
  if (!groupId) return reply.code(400).send({ error: "groupId required" }); // groupId 必填
  if (!sensorId) return reply.code(400).send({ error: "sensorId required" }); // sensorId 必填

  const g0 = await pool.query(`SELECT 1 FROM sensor_groups WHERE group_id = $1`, [groupId]); // 检查 group 是否存在
  if (g0.rowCount === 0) return reply.code(404).send({ error: `group not found: ${groupId}` }); // 不存在则 404

  await pool.query(
    `INSERT INTO sensor_group_members (group_id, sensor_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [groupId, sensorId]
  ); // upsert member

  const [g] = await fetchGroupConfig({ groupId, projectId: null }); // 查回最新 group
  return reply.send({ ok: true, group: g ?? null }); // 返回
});

app.delete("/api/admin/groups/:groupId/members/:sensorId", async (req, reply) => {
  const p = req.params as Record<string, unknown>; // params
  const groupId = typeof p.groupId === "string" ? p.groupId.trim() : ""; // groupId
  const sensorId = typeof p.sensorId === "string" ? p.sensorId.trim() : ""; // sensorId
  if (!groupId) return reply.code(400).send({ error: "groupId required" }); // groupId 必填
  if (!sensorId) return reply.code(400).send({ error: "sensorId required" }); // sensorId 必填

  await pool.query(`DELETE FROM sensor_group_members WHERE group_id = $1 AND sensor_id = $2`, [groupId, sensorId]); // 删除 member

  const [g] = await fetchGroupConfig({ groupId, projectId: null }); // 查回最新 group
  return reply.send({ ok: true, group: g ?? null }); // 返回
});

app.delete("/api/admin/groups/:groupId", async (req, reply) => {
  const p = req.params as Record<string, unknown>; // params
  const groupId = typeof p.groupId === "string" ? p.groupId.trim() : ""; // groupId
  if (!groupId) return reply.code(400).send({ error: "groupId required" }); // groupId 必填

  await pool.query(`DELETE FROM sensor_group_members WHERE group_id = $1`, [groupId]); // 先删 members
  await pool.query(`DELETE FROM sensor_groups WHERE group_id = $1`, [groupId]); // 再删 group

  return reply.send({ ok: true, deleted: { groupId } }); // 返回
});

// ---------------- Derive overlays (Web2 acceptance P0-2.6 / P0-2.7) ----------------
app.post("/api/derive/overlays", async (req, reply) => {
  try {
    const body = (req.body ?? {}) as any; // body

    const groupId = typeof body.groupId === "string" ? body.groupId.trim() : ""; // groupId
    if (!groupId) return reply.code(400).send({ error: "groupId required" }); // groupId 必填

    const startTs = parseIntParam(body.startTs, "startTs"); // startTs
    const endTs = parseIntParam(body.endTs, "endTs"); // endTs
    if (endTs <= startTs) return reply.code(400).send({ error: "invalid range" }); // 时间范围必须正

    const metricsIn: string[] = Array.isArray(body.metrics) ? body.metrics : []; // 输入 metrics
    const metrics = uniq(
      metricsIn
        .filter((m: any) => typeof m === "string" && m.trim())
        .map((m: string) => m.trim())
    ); // 去空/去重后的 metrics
    if (!metrics.length) return reply.code(400).send({ error: "metrics required" }); // metrics 必填

    const algoVersion = typeof body.algoVersion === "string" && body.algoVersion.trim() ? body.algoVersion.trim() : "v0"; // algoVersion
    const params = (body.params ?? {}) as any; // algo params

    const stepThreshold = Number(params.stepThreshold ?? 5); // step 阈值
    const driftThreshold = Number(params.driftThreshold ?? 10); // drift 阈值
    const driftN = Number(params.driftN ?? 3); // drift N 点

    const runId = randomUUID(); // derive run id
    const emittedAtIso = new Date().toISOString(); // emitted_at

    const sql = `
      SELECT occurred_at, record_json
      FROM facts
      WHERE (record_json::jsonb ->> 'type') = 'raw_sample_v1'
        AND (record_json::jsonb -> 'entity' ->> 'group_id') = $1
        AND occurred_at >= to_timestamp($2 / 1000.0)
        AND occurred_at <= to_timestamp($3 / 1000.0)
        AND (record_json::jsonb -> 'payload' ->> 'metric') = ANY($4::text[])
      ORDER BY occurred_at ASC
      LIMIT 50000
    `; // 拉取窗口内 raw_sample_v1
    const res = await pool.query(sql, [groupId, startTs, endTs, metrics]); // 执行查询

    type Point = { ts: number; v: number }; // 点结构
    const buckets = new Map<string, { sensorId: string; metric: string; pts: Point[] }>(); // 按 (sensor,metric) 分桶

    for (const row of res.rows as any[]) {
      const rec = parseRecordJson(row.record_json); // 解析 record_json
      if (!rec) continue; // 解析失败跳过

      const entity = rec?.entity ?? {}; // entity
      const payload = rec?.payload ?? {}; // payload

      const sensorId = String(entity.sensor_id ?? entity.sensorId ?? "").trim(); // sensorId
      const metric = String(payload.metric ?? "").trim(); // metric
      const ts = occurredAtToMs(row.occurred_at); // ts（ms）
      const v = Number(payload.value); // value

      if (!sensorId || !metric) continue; // 必须有 sensorId+metric
      if (!Number.isFinite(ts) || ts <= 0) continue; // ts 必须有效
      if (!Number.isFinite(v)) continue; // value 必须是数

      const k = `${sensorId}::${metric}`; // 桶 key
      const got = buckets.get(k) ?? { sensorId, metric, pts: [] }; // 取桶
      got.pts.push({ ts, v }); // 推入点
      buckets.set(k, got); // 回写桶
    }

    let inserted = 0; // 插入计数

    async function insertDerivedMarker(args: {
      kind: "step_candidate" | "drift_candidate"; // kind
      sensorId: string; // sensorId
      metric: string; // metric
      startTs: number; // startTs
      endTs: number; // endTs
      confidence: "low" | "med" | "high"; // confidence
      note: string | null; // note
    }) {
      const factId = randomUUID(); // factId
      const occurredAtIsoLocal = toIso(args.endTs); // occurred_at 取 endTs（区间则落在末端）

      const record: any = {
        type: "marker_v1", // fact type
        schema_version: "1.0.0", // schema
        occurred_at: occurredAtIsoLocal, // occurred_at
        source: "system", // ✅ derived 必须是 system
        entity: {
          spatial_unit_id: "SU:plot:UNKNOWN", // spatial unit（v0 占位）
          sensor_id: args.sensorId, // sensor id
          group_id: groupId, // group id
        },
        payload: {
          type: args.kind, // kind
          metric: args.metric, // ✅ derived metric 必须非空
          confidence: args.confidence, // ✅ low/med/high
          startTs: args.startTs, // startTs
          endTs: args.endTs, // endTs
          note: args.note, // note
          algo_version: algoVersion, // algo version
          derive_run_id: runId, // derive run id
          emitted_at: emittedAtIso, // emitted at
          params: {
            stepThreshold, // 参数回写（可审计）
            driftThreshold, // 参数回写（可审计）
            driftN, // 参数回写（可审计）
          },
        },
        qc: { quality: "unknown", exclusion_reason: null }, // qc
        integrity: { content_hash: "sha256:__PLACEHOLDER__", prev_fact_id: null }, // integrity 占位
        refs: { media_key: null, evidence_refs: [] }, // refs
      };

      await pool.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2, $3, $4::text)`,
        [factId, occurredAtIsoLocal, "system", JSON.stringify(record)]
      ); // 插入事实

      inserted += 1; // 计数 +1
    }

    for (const b of buckets.values()) {
      b.pts.sort((a, c) => a.ts - c.ts); // 按时间排序

      for (let i = 1; i < b.pts.length; i++) {
        const prev = b.pts[i - 1]; // 前一点
        const cur = b.pts[i]; // 当前点
        const dv = cur.v - prev.v; // 差值
        if (Math.abs(dv) >= stepThreshold) {
          await insertDerivedMarker({
            kind: "step_candidate", // step 候选
            sensorId: b.sensorId, // sensor
            metric: b.metric, // metric
            startTs: cur.ts, // 点 overlay：start=end
            endTs: cur.ts, // 点 overlay：start=end
            confidence: Math.abs(dv) >= stepThreshold * 2 ? "high" : "med", // 置信度
            note: `step detected (Δ=${dv.toFixed(2)})`, // note
          });
          break; // 每桶只写一个 step（控制 inserted）
        }
      }

      if (b.pts.length >= Math.max(2, driftN)) {
        const tail = b.pts.slice(-driftN); // 取最后 N 点
        const dv = tail[tail.length - 1].v - tail[0].v; // N 点首尾差
        if (Math.abs(dv) >= driftThreshold) {
          await insertDerivedMarker({
            kind: "drift_candidate", // drift 候选
            sensorId: b.sensorId, // sensor
            metric: b.metric, // metric
            startTs: tail[0].ts, // 区间 start
            endTs: tail[tail.length - 1].ts, // 区间 end
            confidence: Math.abs(dv) >= driftThreshold * 2 ? "high" : "low", // 置信度
            note: `drift detected over N=${tail.length} (Δ=${dv.toFixed(2)})`, // note
          });
        }
      }
    }

    if (inserted < 1) {
      const anyBucket = buckets.values().next().value as any; // 取任意桶
      if (!anyBucket || !anyBucket.pts?.length) {
        return reply.code(400).send({ error: "no raw samples found for derive window" }); // 没数据则 400
      }
      const last = anyBucket.pts[anyBucket.pts.length - 1]; // 最后一个点
      await insertDerivedMarker({
        kind: "step_candidate", // 用 step 候选兜底
        sensorId: anyBucket.sensorId, // sensor
        metric: anyBucket.metric, // metric
        startTs: last.ts, // 点 overlay
        endTs: last.ts, // 点 overlay
        confidence: "low", // 低置信兜底
        note: "derive fallback (no strong signal)", // note
      });
    }

    return reply.send({ runId, inserted }); // 返回 derive 结果
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) }); // 统一 400 返回错误
  }
});

// ⚠️ DEPRECATED: legacy only, do not use in new flows
// ---------------- Series API ----------------

// ⚠️ LEGACY: /api/series is frozen for backward compatibility only.
app.get("/api/series", async (req, reply) => {
  if ((req.query as any)?.__internal__ !== "true") {
    return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
  }
  reply.header("Deprecation", "true");
  reply.header("Sunset", "legacy");
  const q = req.query as Record<string, unknown>; // query

  let startTs: number; // startTs
  let endTs: number; // endTs
  let metrics: string[]; // metrics
  let maxPoints: number; // maxPoints

  try {
    startTs = parseIntParam(q.startTs, "startTs"); // 解析 startTs
    endTs = parseIntParam(q.endTs, "endTs"); // 解析 endTs

    const metricsCsv =
      typeof q.metrics === "string" ? q.metrics : typeof (q as any).metric === "string" ? String((q as any).metric) : ""; // 兼容 metrics/metric

    metrics = uniq(splitCsv(metricsCsv)); // metrics 去重
    maxPoints = q.maxPoints === undefined ? 2000 : parseIntParam(q.maxPoints, "maxPoints"); // maxPoints 默认 2000
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) }); // 参数错误返回 400
  }

  if (metrics.length === 0) return reply.code(400).send({ error: "metrics required" }); // metrics 必填
  if (endTs <= startTs) return reply.code(400).send({ error: "invalid range" }); // range 必须正

  const groupId = typeof q.groupId === "string" ? q.groupId.trim() : null; // groupId
  const sensorId = typeof q.sensorId === "string" ? q.sensorId.trim() : null; // sensorId
  const spatialUnitId = typeof (q as any).spatialUnitId === "string" ? String((q as any).spatialUnitId).trim() : null; // spatialUnitId

  if (!groupId && !sensorId && !spatialUnitId) {
    return reply.code(400).send({ error: "groupId or sensorId or spatialUnitId required" }); // 至少提供一个定位维度
  }

  const whereParts: string[] = []; // raw where 子句片段
  const params: any[] = []; // raw 参数
  let p = 1; // raw 参数序号

  whereParts.push(`(record_json::jsonb ->> 'type') = 'raw_sample_v1'`); // 只取 raw_sample_v1
  whereParts.push(`occurred_at >= to_timestamp($${p++} / 1000.0)`); // startTs 条件
  params.push(startTs); // startTs 参数
  whereParts.push(`occurred_at <= to_timestamp($${p++} / 1000.0)`); // endTs 条件
  params.push(endTs); // endTs 参数

  whereParts.push(`(record_json::jsonb -> 'payload' ->> 'metric') = ANY($${p++}::text[])`); // metric in (...)
  params.push(metrics); // metrics 参数

  if (groupId) {
    whereParts.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${p++}`); // groupId 条件
    params.push(groupId); // groupId 参数
  }
  if (sensorId) {
    whereParts.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${p++}`); // sensorId 条件
    params.push(sensorId); // sensorId 参数
  }
  if (spatialUnitId) {
    whereParts.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${p++}`); // spatialUnitId 条件
    params.push(spatialUnitId); // spatialUnitId 参数
  }

  const rawSql = `
    SELECT fact_id, occurred_at, source as facts_source, record_json
    FROM facts
    WHERE ${whereParts.join(" AND ")}
    ORDER BY occurred_at ASC
    LIMIT $${p++}
  `; // raw 查询 SQL
  params.push(Math.max(1, Math.min(20000, maxPoints * 50))); // 限制上限避免爆内存

  const rawRes = await pool.query(rawSql, params); // 查询 raw facts

  const samples: SeriesSampleV1[] = []; // samples 输出
  const tsList: number[] = []; // 用于 gaps 的全局 tsList

  for (const r of rawRes.rows as any[]) {
    const rec = parseRecordJson(r.record_json); // 解析 record_json
    if (!rec) continue; // 失败跳过

    const entity = rec?.entity ?? {}; // entity
    const payload = rec?.payload ?? {}; // payload
    const qc = rec?.qc ?? {}; // qc

    const ts = occurredAtToMs(r.occurred_at); // ts（ms）
    const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim(); // sensorId（sid）
    if (!sid) continue; // 必须有 sensorId

    const metric = String(payload.metric ?? "").trim(); // metric
    if (!metric) continue; // 必须有 metric

    const v = Number(payload.value); // value
    if (!Number.isFinite(v)) continue; // value 必须有效

    const quality = (String(qc.quality ?? "unknown") as QcQuality) || "unknown"; // qc.quality

    samples.push({
      ts, // ts
      sensorId: sid, // sensorId
      metric, // metric
      value: v, // value
      quality, // quality
      source: (String(rec.source ?? r.facts_source ?? "device") as any) ?? "device", // source（优先 record.source）
    } as any);

    tsList.push(ts); // 记录 ts 用于 gaps
  }

  let sampled = samples; // 默认不采样
  if (samples.length > maxPoints) {
    const stride = Math.ceil(samples.length / maxPoints); // 计算步长
    sampled = samples.filter((_, i) => i % stride === 0); // 抽样
  }

  const gaps = computeGapsGlobal(tsList, startTs, endTs); // 计算 gaps

  const ovWhere: string[] = []; // overlays where
  const ovParams: any[] = []; // overlays params
  let op = 1; // overlays param index

  ovWhere.push(`(record_json::jsonb ->> 'type') = 'marker_v1'`); // 只取 marker_v1
  ovWhere.push(`occurred_at >= to_timestamp($${op++} / 1000.0)`); // startTs 条件
  ovParams.push(startTs); // startTs 参数
  ovWhere.push(`occurred_at <= to_timestamp($${op++} / 1000.0)`); // endTs 条件
  ovParams.push(endTs); // endTs 参数

  if (groupId) {
    ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${op++}`); // groupId 条件
    ovParams.push(groupId); // groupId 参数
  }
  if (sensorId) {
    ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${op++}`); // sensorId 条件
    ovParams.push(sensorId); // sensorId 参数
  }
  if (spatialUnitId) {
    ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${op++}`); // spatialUnitId 条件
    ovParams.push(spatialUnitId); // spatialUnitId 参数
  }

  const markerSql = `
    SELECT fact_id, occurred_at, record_json
    FROM facts
    WHERE ${ovWhere.join(" AND ")}
    ORDER BY occurred_at ASC
    LIMIT 5000
  `; // marker 查询 SQL
  const markerRes = await pool.query(markerSql, ovParams); // 查询 marker facts

  const overlays: OverlaySegment[] = []; // overlays 输出
  for (const r of markerRes.rows as any[]) {
    const rec = parseRecordJson(r.record_json); // 解析 record_json
    if (!rec) continue; // 失败跳过

    const entity = rec?.entity ?? {}; // entity
    const payload = rec?.payload ?? {}; // payload

    // ✅ 彻底修复：不再引用未定义变量 sid，显式从 entity 取 sensorId
    const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim(); // overlay 的 sensorId
    if (!sid) continue; // 没 sensorId 直接跳过（避免 500）

    const kind = String(payload.type ?? payload.kind ?? "").trim(); // kind 兼容读取

    const DERIVED_OVERLAY_KINDS = new Set<string>(["step_candidate", "drift_candidate"]); // derived 的 allowlist
    const kindAllowed = isMarkerKind(kind) || DERIVED_OVERLAY_KINDS.has(kind); // 允许条件

    if (!kindAllowed) continue; // 非 allowlist 直接过滤

    const t = occurredAtToMs(r.occurred_at); // marker occurred_at -> ms

    let oStartTs = t; // overlay start
    let oEndTs = t; // overlay end

    const pStart = payload?.startTs ?? payload?.start_ts ?? null; // payload start
    const pEnd = payload?.endTs ?? payload?.end_ts ?? null; // payload end

    if (typeof pStart === "number" && Number.isFinite(pStart)) oStartTs = pStart; // payload startTs 优先
    if (typeof pEnd === "number" && Number.isFinite(pEnd)) oEndTs = pEnd; // payload endTs 优先

    if (oEndTs < oStartTs) {
      const tmp = oStartTs; // swap 临时
      oStartTs = oEndTs; // swap
      oEndTs = tmp; // swap
    }

    const payloadMetric = payload.metric != null && String(payload.metric).trim() ? String(payload.metric).trim() : null; // metric（derived 必须有）
const rawConfidence =
  payload.confidence != null && String(payload.confidence).trim()
    ? String(payload.confidence).trim().toLowerCase()
    : null;

const payloadConfidence: OverlayConfidence | null =
  rawConfidence === "low" || rawConfidence === "med" || rawConfidence === "high"
    ? rawConfidence
    : null;

    overlays.push({
      startTs: oStartTs, // startTs
      endTs: oEndTs, // endTs
      sensorId: sid, // ✅ sensorId
      metric: payloadMetric, // metric（device_fault 可为 null）
      kind: kind as any, // kind
      confidence: payloadConfidence,
      note: payload.note ? String(payload.note).slice(0, 120) : null, // note（截断）
      source: (String(rec.source ?? "system") as any) ?? "system", // source（derived 必须是 system）
    });
  }

  const resp: SeriesResponseV1 = {
  range: { startTs, endTs, maxPoints },
  samples: sampled,
  gaps: gaps.map((g) => ({
    startTs: g.startTs,
    endTs: g.endTs,
    reason: g.reason ?? "unknown",
  })),
  overlays,
};

  return reply.send(resp); // 返回 series
});

// POST /api/marker
// ⚠️ DEPRECATED: legacy only, do not use in new flows
// ⚠️ LEGACY: /api/marker is frozen for backward compatibility only.
app.post("/api/marker", async (req, reply) => {
  if ((req.query as any)?.__internal__ !== "true") {
    return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
  }
  reply.header("Deprecation", "true");
  reply.header("Sunset", "legacy");
  const body = req.body as any; // body
  try {
    const entity = (body?.entity ?? {}) as any; // entity（兼容客户端）
    const subjectRef = (body?.subjectRef ?? body?.subject_ref ?? {}) as any; // subjectRef（兼容客户端）

    const sensorId = parseStringParam(
      body?.sensorId ?? body?.sensor_id ?? entity?.sensor_id ?? entity?.sensorId,
      "sensorId"
    ); // sensorId 兼容读取

    const type = parseStringParam(body?.type ?? body?.kind, "type"); // type/kind 兼容读取

    const source = parseStringParam(body?.source, "source") as FactsSource; // source

    const note = typeof body?.note === "string" ? body.note.slice(0, 120) : null; // note 可选（截断）

    const groupIdRaw =
      body?.groupId ??
      body?.group_id ??
      entity?.group_id ??
      entity?.groupId ??
      subjectRef?.groupId ??
      subjectRef?.group_id; // groupId 多处兼容读取

    let groupId = typeof groupIdRaw === "string" && groupIdRaw.trim().length > 0 ? groupIdRaw.trim() : null; // groupId

    const spatialUnitIdRaw =
      body?.spatialUnitId ??
      body?.spatial_unit_id ??
      entity?.spatial_unit_id ??
      entity?.spatialUnitId; // spatialUnitId 兼容读取

    const spatialUnitId =
      typeof spatialUnitIdRaw === "string" && spatialUnitIdRaw.trim().length > 0 ? spatialUnitIdRaw.trim() : null; // spatialUnitId

    const tsNum =
      typeof body?.ts === "number" ? body.ts : typeof body?.ts === "string" ? Date.parse(body.ts) : NaN; // ts 支持 ms 数字或 ISO 字符串

    if (!Number.isFinite(tsNum) || tsNum <= 0) throw new Error("invalid ts"); // ts 必须有效
    if (!isMarkerKind(type)) throw new Error("invalid type"); // type 必须在合约 allowlist
    if (!["device", "gateway", "system", "human"].includes(source)) throw new Error("invalid source"); // source 必须合法

    if (!groupId) {
      const r = await pool.query(
        `SELECT group_id
         FROM sensor_group_members
         WHERE sensor_id = $1
         ORDER BY group_id ASC
         LIMIT 2`,
        [sensorId]
      ); // 尝试从 membership 表推断 groupId（唯一才用）

      const gids = (r.rows ?? [])
        .map((x: any) => String(x.group_id ?? "").trim())
        .filter(Boolean); // 清洗结果

      if (gids.length === 1) groupId = gids[0]; // 唯一则确定
    }

    if (!groupId) {
      const r2 = await pool.query(
        `SELECT record_json::jsonb #>> '{entity,group_id}' AS group_id
         FROM facts
         WHERE (record_json::jsonb ->> 'type') = 'raw_sample_v1'
           AND (record_json::jsonb -> 'entity' ->> 'sensor_id') = $1
         ORDER BY occurred_at DESC
         LIMIT 1`,
        [sensorId]
      ); // fallback：从最新 raw_sample_v1 取 group_id

      const g2 = String(r2.rows?.[0]?.group_id ?? "").trim(); // group_id
      if (g2) groupId = g2; // 命中则使用
    }

    let markerTs = tsNum; // 默认用客户端 ts
    try {
      const where: string[] = []; // where 条件
      const args: any[] = []; // 参数
      let p = 1; // 参数序号

      where.push(`(record_json::jsonb ->> 'type') = 'raw_sample_v1'`); // 只查 raw_sample_v1
      where.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${p++}`); // sensorId 条件
      args.push(sensorId); // 参数

      if (groupId) {
        where.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${p++}`); // groupId 条件
        args.push(groupId); // 参数
      }

      const r = await pool.query(
        `SELECT max(occurred_at) AS max_occurred_at
         FROM facts
         WHERE ${where.join(" AND ")}`,
        args
      ); // 拉取 raw_sample_v1 最大 occurred_at

      const maxOcc = r.rows?.[0]?.max_occurred_at ?? null; // 最大 occurred_at
      const maxMs = occurredAtToMs(maxOcc); // 转 ms
      if (Number.isFinite(maxMs) && maxMs > 0) markerTs = maxMs; // 用 maxOcc 覆盖 markerTs（确保落入 series window）
    } catch {
      markerTs = tsNum; // 失败则保持客户端 ts
    }

    const factId = randomUUID(); // fact_id
    const occurredAtIso = toIso(markerTs); // occurred_at iso

    const record = {
      type: "marker_v1", // fact type
      schema_version: "1.0.0", // schema
      occurred_at: occurredAtIso, // occurred_at
      source, // source
      entity: {
        spatial_unit_id: spatialUnitId ?? "SU:plot:UNKNOWN", // spatialUnitId
        sensor_id: sensorId, // sensorId
        group_id: groupId ?? undefined, // groupId（可选）
      },
      payload: {
        type, // marker kind
        note, // note（可选）
      },
      qc: { quality: "unknown", exclusion_reason: null }, // qc
      integrity: { content_hash: "sha256:__PLACEHOLDER__", prev_fact_id: null }, // integrity
      refs: { media_key: null, evidence_refs: [] }, // refs
    };

    await pool.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2, $3, $4::text)`,
      [factId, occurredAtIso, source, JSON.stringify(record)]
    ); // 插入事实

    return reply.send({ ok: true, fact_id: factId }); // 返回
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) }); // 错误返回
  }
});

// ---------------- Canopy helpers (shared by /frame + /upload) ----------------

async function handleCanopyFrameUpload(req: any, reply: any, opts: { responseShape: "acceptance" | "legacy" }) {
  const fields = new Map<string, string>(); // 表单字段
  let fileBuf: Buffer | null = null; // 文件内容
  let fileMime = "application/octet-stream"; // mime
  let fileName = "upload"; // 文件名

  const parts = req.parts(); // 读取 multipart parts
  for await (const part of parts) {
    if (part.type === "file") {
      fileMime = part.mimetype ?? fileMime; // mime
      fileName = part.filename ?? fileName; // filename
      fileBuf = await part.toBuffer(); // 读取文件 buffer
    } else if (part.type === "field") {
      const v = typeof part.value === "string" ? part.value : String(part.value ?? ""); // 字段值
      fields.set(part.fieldname, v); // 存入 map
    }
  }

  if (!fileBuf) return reply.code(400).send({ error: "missing file" }); // 必须上传文件

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = fields.get(k); // 取字段
      if (typeof v === "string" && v.trim()) return v.trim(); // 返回第一个非空字段
    }
    return null; // 都没有则 null
  };

  const projectId = get("projectId", "project_id") ?? "P_DEFAULT"; // projectId（验收必传）
  const cameraId = get("cameraId", "camera_id") ?? "cam_01"; // cameraId（验收用 CAM_1）
  const groupId = get("groupId", "group_id"); // groupId（可选）
  const spatialUnitId = get("spatialUnitId", "spatial_unit_id") ?? "SU:plot:UNKNOWN"; // spatialUnitId
  const source = (get("source") ?? "device") as FactsSource; // source

  const tsRaw = get("ts"); // ts（验收传的是 ms）
  const ts = tsRaw ? Number(tsRaw) : nowMs(); // 优先按 number(ms) 解析
  const occurredAtIso = new Date(Number.isFinite(ts) ? ts : nowMs()).toISOString(); // occurred_at

  const ext = fileMime === "image/png" ? "png" : "jpg"; // 简单决定扩展名
  const key = `canopy/${randomUUID()}.${ext}`; // storage_key
  const outPath = path.join(mediaDir, key); // 输出文件路径
  fs.mkdirSync(path.dirname(outPath), { recursive: true }); // 确保目录存在
  fs.writeFileSync(outPath, fileBuf); // 写入文件

  const factId = randomUUID(); // fact_id（同时充当 frameId）

  const record = {
    type: "canopy_frame_v1", // fact type
    schema_version: "1.0.0", // schema
    occurred_at: occurredAtIso, // occurred_at
    source, // source
    entity: {
      spatial_unit_id: spatialUnitId, // spatialUnitId
      project_id: projectId, // ✅ projectId（验收 list 会按 projectId 查）
      camera_id: cameraId, // cameraId
      group_id: groupId ?? undefined, // groupId（可选）
    },
    payload: {
      storage_key: key, // storage_key
      mime: fileMime, // mime
      filename: fileName, // filename
    },
    qc: { quality: "unknown", exclusion_reason: null }, // qc
    integrity: { content_hash: "sha256:__PLACEHOLDER__", prev_fact_id: null }, // integrity
    refs: { media_key: key, evidence_refs: [] }, // refs（media_key 指向文件）
  };

  await pool.query(`INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2, $3, $4::text)`, [
    factId, // fact_id
    occurredAtIso, // occurred_at
    source, // source
    JSON.stringify(record), // record_json
  ]); // 写入 facts

  const url = `/media/${key}`; // 静态访问 URL

  if (opts.responseShape === "acceptance") {
    // ✅ 验收脚本要求字段：ok/frameId/url
    return reply.send({ ok: true, frameId: factId, url }); // 返回
  }

  // legacy 兼容：保持你之前 /upload 的返回字段
  return reply.send({ ok: true, fact_id: factId, storage_key: key, url }); // 返回
}

async function handleCanopyFramesList(req: any, reply: any) {
  const q = req.query as Record<string, unknown>; // query
  let startTs = 0; // startTs
  let endTs = nowMs(); // endTs

  try {
    if (q.startTs !== undefined) startTs = parseIntParam(q.startTs, "startTs"); // 解析 startTs
    if (q.endTs !== undefined) endTs = parseIntParam(q.endTs, "endTs"); // 解析 endTs
  } catch (e: any) {
    return reply.code(400).send({ error: String(e?.message ?? e) }); // 参数错误
  }

  const projectId = typeof q.projectId === "string" ? q.projectId.trim() : null; // ✅ 验收会传 projectId
  const groupId = typeof q.groupId === "string" ? q.groupId.trim() : null; // groupId
  const cameraId = typeof q.cameraId === "string" ? q.cameraId.trim() : null; // cameraId
  const spatialUnitId = typeof (q as any).spatialUnitId === "string" ? String((q as any).spatialUnitId).trim() : null; // spatialUnitId

  const where: string[] = []; // where
  const params: any[] = []; // params
  let p = 1; // param idx

  where.push(`(record_json::jsonb ->> 'type') = 'canopy_frame_v1'`); // 只取 canopy_frame_v1
  where.push(`occurred_at >= to_timestamp($${p++} / 1000.0)`); // startTs 条件
  params.push(startTs); // startTs
  where.push(`occurred_at <= to_timestamp($${p++} / 1000.0)`); // endTs 条件
  params.push(endTs); // endTs

  if (projectId) {
    where.push(`(record_json::jsonb -> 'entity' ->> 'project_id') = $${p++}`); // projectId 条件
    params.push(projectId); // projectId 参数
  }
  if (groupId) {
    where.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${p++}`); // groupId 条件
    params.push(groupId); // groupId 参数
  }
  if (cameraId) {
    where.push(`(record_json::jsonb -> 'entity' ->> 'camera_id') = $${p++}`); // cameraId 条件
    params.push(cameraId); // cameraId 参数
  }
  if (spatialUnitId) {
    where.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${p++}`); // spatialUnitId 条件
    params.push(spatialUnitId); // spatialUnitId 参数
  }

  const sql = `
    SELECT fact_id, occurred_at, record_json
    FROM facts
    WHERE ${where.join(" AND ")}
    ORDER BY occurred_at ASC
    LIMIT 5000
  `; // 查询 SQL

  const res = await pool.query(sql, params); // 执行查询

  const frames: CanopyFrameV1[] = (res.rows as any[]).map((r) => {
    const rec = parseRecordJson(r.record_json) ?? {}; // record_json
    const entity = rec?.entity ?? {}; // entity
    const payload = rec?.payload ?? {}; // payload
    const key = String(payload.storage_key ?? rec?.refs?.media_key ?? "").trim(); // storage_key
    const ts = occurredAtToMs(r.occurred_at); // ts

    return {
      ts, // ts
      project_id: String(entity.project_id ?? "P_DEFAULT"), // project_id
      plot_id: entity.plot_id ? String(entity.plot_id) : null, // plot_id（可选）
      block_id: entity.block_id ? String(entity.block_id) : null, // block_id（可选）
      camera_id: String(entity.camera_id ?? "cam_01"), // camera_id
      storage_key: key, // storage_key
      mime: String(payload.mime ?? "image/jpeg"), // mime
      note: null, // note（v0 不用）
      source: (String(rec.source ?? "device") as any) ?? "device", // source
      url: `/media/${key}`, // url
    } as any;
  });

  return reply.send({ frames }); // ✅ 验收要求返回 {frames}
}

// ✅ 验收脚本用：POST /api/canopy/frame
app.post("/api/canopy/frame", async (req, reply) => {
  return handleCanopyFrameUpload(req as any, reply as any, { responseShape: "acceptance" }); // 走验收返回格式
});

// ✅ 验收脚本用：GET /api/canopy/frames
app.get("/api/canopy/frames", async (req, reply) => {
  return handleCanopyFramesList(req as any, reply as any); // 返回 frames
});

// legacy：POST /api/canopy/upload（你手动 curl 用过）
app.post("/api/canopy/upload", async (req, reply) => {
  return handleCanopyFrameUpload(req as any, reply as any, { responseShape: "legacy" }); // 走旧返回格式
});

// legacy：GET /api/canopy/list（你之前用过）
app.get("/api/canopy/list", async (req, reply) => {
  return handleCanopyFramesList(req as any, reply as any); // 复用 list
});

app.get("/api/overlays/explain", async (req, reply) => {
  const q = req.query as Record<string, unknown>; // query
  const id = typeof q.id === "string" ? q.id.trim() : null; // id
  if (!id) return reply.code(400).send({ error: "missing id" }); // id 必填

  const { rows } = await pool.query(
    `SELECT fact_id, occurred_at, record_json
     FROM facts
     WHERE fact_id = $1
     LIMIT 1`,
    [id]
  ); // 查询指定 fact

  if (!rows.length) return reply.code(404).send({ error: "overlay not found" }); // 不存在则 404

  const r = rows[0] as any; // row
  const rec = parseRecordJson(r.record_json); // 解析 record_json
  if (!rec) return reply.code(500).send({ error: "bad record_json" }); // record_json 异常

  if (String(rec?.type ?? rec?.["type"]) !== "marker_v1") {
    return reply.code(400).send({ error: "unsupported overlay type" }); // 只支持 marker_v1
  }

  const entity = rec?.entity ?? {}; // entity
  const payload = rec?.payload ?? {}; // payload
  const sensor_id = String(entity.sensor_id ?? "").trim(); // sensor_id
  const metric = payload.metric ? String(payload.metric) : ""; // metric
  const start_ts = occurredAtToMs(r.occurred_at); // start_ts
  const end_ts = start_ts; // end_ts（v0 点 overlay）

  const w0 = start_ts - 30 * 60 * 1000; // evidence window start
  const w1 = start_ts + 30 * 60 * 1000; // evidence window end

  const ev = await pool.query(
    `SELECT record_json, occurred_at
     FROM facts
     WHERE (record_json::jsonb ->> 'type') = 'raw_sample_v1'
       AND (record_json::jsonb -> 'entity' ->> 'sensor_id') = $1
       AND occurred_at >= to_timestamp($2 / 1000.0)
       AND occurred_at <= to_timestamp($3 / 1000.0)`,
    [sensor_id, w0, w1]
  ); // 查询证据窗口 raw samples

  let sample_count = 0; // 样本数
  let suspect_count = 0; // suspect 数
  let bad_count = 0; // bad 数

  const tsList: number[] = []; // ts list 用于 gaps
  for (const rr of ev.rows as any[]) {
    const rc = parseRecordJson(rr.record_json); // 解析
    if (!rc) continue; // 跳过

    const qc = rc?.qc ?? {}; // qc
    const occ = occurredAtToMs(rr.occurred_at ?? rc?.occurred_at); // occurred_at
    if (Number.isFinite(occ) && occ > 0) tsList.push(occ); // 记录 ts

    sample_count++; // +1
    const qv = String(qc.quality ?? "unknown"); // quality
    if (qv === "suspect") suspect_count++; // suspect +1
    if (qv === "bad") bad_count++; // bad +1
  }

  const gap_count = computeGapsGlobal(tsList, w0, w1).length; // gaps 数

  const overlay = {
    id: r.fact_id, // overlay id
    sensor_id, // sensor_id
    metric: metric || null, // metric
    start_ts, // start_ts
    end_ts, // end_ts
    kind: payload.type ?? null, // kind
    severity: null, // severity（v0 不用）
    params: {}, // params（v0 不用）
    algo_version: "p4", // algo version
    created_at: r.occurred_at, // created_at
  };

  const payloadOut = {
    overlay, // overlay
    rule_id: "marker.human_or_device", // rule_id
    rule_version: "p4", // rule_version
    emitted_at: String(r.occurred_at), // emitted_at
    evidence: {
      sensor_id, // sensor_id
      group_id: entity.group_id ?? undefined, // group_id
      metric: metric || "unknown", // metric
      start_ts: w0, // evidence start
      end_ts: w1, // evidence end
      sample_count, // sample_count
      suspect_count, // suspect_count
      bad_count, // bad_count
      gap_count, // gap_count
    },
    notes: [
      "Explain payload is descriptive only (no causality, no action guidance).",
      "This overlay is a marker fact. It is replayable and auditable.",
    ], // notes
  };

  return reply.send(payloadOut); // 返回 explain 结果
});

}
