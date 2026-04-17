// Route classification: legacy compatibility
// ⚠️ DEPRECATED: legacy monitoring route
// replaced by operation_state_v1 / dashboard_v1 / program_v1
// DO NOT use in new flows
// apps/server/src/routes/series.ts

import type { FastifyInstance } from "fastify"; // Fastify 实例类型：用于注册路由。
import type { Pool } from "pg"; // Postgres 连接池类型：用于查询 facts。
import type { SeriesResponseV1 } from "@geox/contracts"; // 只复用总响应类型，避免引用 contracts 中不存在的细项导出。
import { isMarkerKind } from "@geox/contracts"; // marker kind allowlist 校验（合同层）。

type FactsSource = "device" | "gateway" | "system" | "human"; // facts.source 的允许枚举。
type QcQuality = "unknown" | "ok" | "suspect" | "bad"; // qc.quality 的允许枚举。

type SeriesGapLocalV1 = { // 本地定义 gap 结构，避免依赖 contracts 中未导出的细项类型。
  startTs: number; // gap 起点（ms）。
  endTs: number; // gap 终点（ms）。
}; // 结束本地 gap 类型。

type SeriesSampleLocalV1 = { // 本地定义 sample 结构。
  ts: number; // 样本时间戳（ms）。
  sensorId: string; // 传感器 id。
  metric: string; // 指标名。
  value: number; // 数值。
  quality: QcQuality; // 质量标签。
  source: FactsSource; // 数据来源。
}; // 结束本地 sample 类型。

type OverlaySegmentLocalV1 = { // 本地定义 overlay 结构。
  startTs: number; // overlay 起点（ms）。
  endTs: number; // overlay 终点（ms）。
  sensorId: string; // 传感器 id。
  metric: string | null; // 指标名；device fault 之类可为空。
  kind: string; // overlay kind。
  confidence: string | null; // 置信度；可为空。
  note: string | null; // 备注。
  source: FactsSource; // 来源。
}; // 结束本地 overlay 类型。

function parseIntParam(v: unknown, name: string): number { // 解析 query 参数为整数。
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; // 支持 string/number 两种输入。
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`); // 非有效整数直接报错。
  return n; // 返回解析后的整数。
} // 结束整数解析。

function splitCsv(v: string): string[] { // 将 csv 字符串切分为非空数组。
  return v.split(",").map((s) => s.trim()).filter(Boolean); // trim + 过滤空项。
} // 结束 csv 切分。

function uniq<T>(xs: T[]): T[] { // 数组去重。
  return Array.from(new Set(xs)); // 使用 Set 去重后转回数组。
} // 结束去重。

function occurredAtToMs(occurredAt: unknown): number { // 将 occurred_at（Date/string）转换为 epoch ms。
  if (occurredAt instanceof Date) return occurredAt.getTime(); // Date 直接转毫秒。
  const s = String(occurredAt ?? ""); // 兜底转字符串。
  const t = Date.parse(s); // ISO 字符串转毫秒。
  return Number.isFinite(t) ? t : 0; // 失败则返回 0。
} // 结束时间转换。

function computeGapsGlobal(tsList: number[], startTs: number, endTs: number): SeriesGapLocalV1[] { // 计算全局 gaps。
  const gaps: SeriesGapLocalV1[] = []; // gap 输出数组。
  if (!tsList.length) return [{ startTs, endTs }]; // 无样本则整个查询区间都是 gap。

  const sorted = tsList.slice().sort((a, b) => a - b); // 按时间升序排序。
  if (sorted[0] > startTs) gaps.push({ startTs, endTs: sorted[0] }); // 处理起始缺口。

  for (let i = 1; i < sorted.length; i++) { // 遍历相邻采样点。
    const prev = sorted[i - 1]; // 前一个采样点。
    const cur = sorted[i]; // 当前采样点。
    if (cur - prev > 30 * 60 * 1000) gaps.push({ startTs: prev, endTs: cur }); // 超过 30 分钟判定为 gap。
  } // 结束相邻点遍历。

  const last = sorted[sorted.length - 1]; // 最后一个采样点。
  if (last < endTs) gaps.push({ startTs: last, endTs }); // 处理尾部缺口。

  return gaps; // 返回 gaps。
} // 结束 gap 计算。

function parseRecordJson(x: unknown): any | null { // 解析 facts.record_json（可能是对象，也可能是字符串）。
  if (x == null) return null; // null/undefined 直接返回 null。
  if (typeof x === "object") return x; // 已经是对象则直接返回。
  if (typeof x !== "string") return null; // 非字符串无法 JSON.parse。
  try { // 尝试解析 JSON。
    return JSON.parse(x); // 返回解析结果。
  } catch { // 解析失败。
    return null; // 返回 null。
  }
} // 结束 JSON 解析。

export function buildSeriesRoutes(pool: Pool) { // 构造 /api/series 路由插件。
  return async function seriesRoutes(app: FastifyInstance) { // Fastify plugin 入口。
    // @deprecated - use /api/v1/*
    app.get("/api/series", async (req, reply) => {
      reply.header("X-Deprecated", "true"); // GET /api/series：从 facts 聚合出前端需要的时序数据。
      if ((req.query as any)?.__internal__ !== "true") {
        return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
      }
      const q = req.query as Record<string, unknown>; // 读取 query 参数。

      let startTs: number; // 查询开始时间。
      let endTs: number; // 查询结束时间。
      let metrics: string[]; // 查询指标集合。
      let maxPoints: number; // 最大点数限制。

      try { // 参数解析与校验。
        startTs = parseIntParam(q.startTs, "startTs"); // 解析 startTs。
        endTs = parseIntParam(q.endTs, "endTs"); // 解析 endTs。

        const metricsCsv = // 兼容 metrics=csv 或 metric=single。
          typeof q.metrics === "string"
            ? q.metrics
            : typeof (q as any).metric === "string"
              ? String((q as any).metric)
              : ""; // 没传则为空字符串。

        metrics = uniq(splitCsv(metricsCsv)); // 解析并去重 metrics。
        maxPoints = q.maxPoints === undefined ? 2000 : parseIntParam(q.maxPoints, "maxPoints"); // 默认 2000 点。
      } catch (e: any) { // 参数错误。
        return reply.code(400).send({ error: String(e?.message ?? e) }); // 返回 400。
      } // 结束参数校验。

      if (metrics.length === 0) return reply.code(400).send({ error: "metrics required" }); // metrics 必填。
      if (endTs <= startTs) return reply.code(400).send({ error: "invalid range" }); // 时间区间必须有效。

      const groupId = typeof q.groupId === "string" ? q.groupId.trim() : null; // groupId 过滤。
      const sensorId = typeof q.sensorId === "string" ? q.sensorId.trim() : null; // sensorId 过滤。
      const spatialUnitId = typeof (q as any).spatialUnitId === "string" ? String((q as any).spatialUnitId).trim() : null; // spatialUnitId 过滤。

      if (!groupId && !sensorId && !spatialUnitId) { // 至少要有一个空间过滤条件。
        return reply.code(400).send({ error: "groupId or sensorId or spatialUnitId required" }); // 返回 400。
      } // 结束过滤条件校验。

      const whereParts: string[] = []; // raw_sample_v1 查询 where 子句集合。
      const params: any[] = []; // raw_sample_v1 查询参数。
      let p = 1; // SQL 参数序号。

      whereParts.push(`(record_json::jsonb ->> 'type') = 'raw_sample_v1'`); // 仅查 raw_sample_v1。
      whereParts.push(`occurred_at >= to_timestamp($${p++} / 1000.0)`); params.push(startTs); // 起始时间过滤。
      whereParts.push(`occurred_at <= to_timestamp($${p++} / 1000.0)`); params.push(endTs); // 结束时间过滤。
      whereParts.push(`(record_json::jsonb -> 'payload' ->> 'metric') = ANY($${p++}::text[])`); params.push(metrics); // metric 过滤。

      if (groupId) { whereParts.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${p++}`); params.push(groupId); } // groupId 过滤。
      if (sensorId) { whereParts.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${p++}`); params.push(sensorId); } // sensorId 过滤。
      if (spatialUnitId) { whereParts.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${p++}`); params.push(spatialUnitId); } // spatialUnitId 过滤。

      const rawSql = ` // raw_sample_v1 查询 SQL。
        SELECT fact_id, occurred_at, source as facts_source, record_json
        FROM facts
        WHERE ${whereParts.join(" AND ")}
        ORDER BY occurred_at ASC
        LIMIT $${p++}
      `; // 结束 SQL。
      params.push(Math.max(1, Math.min(20000, maxPoints * 50))); // 限制扫描上限。

      const rawRes = await pool.query(rawSql, params); // 执行 raw_sample 查询。
      const samples: SeriesSampleLocalV1[] = []; // samples 输出数组。
      const tsList: number[] = []; // 用于 gap 计算的时间戳列表。

      for (const r of rawRes.rows as any[]) { // 遍历 raw_sample 行。
        const rec = parseRecordJson(r.record_json); // 解析 record_json。
        if (!rec) continue; // 坏数据直接跳过。

        const entity = rec.entity ?? {}; // entity 包。
        const payload = rec.payload ?? {}; // payload 包。
        const qc = rec.qc ?? {}; // qc 包。

        const ts = occurredAtToMs(r.occurred_at); // occurred_at 转毫秒。
        const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim(); // 兼容 sensor_id / sensorId。
        if (!sid) continue; // sensorId 缺失则跳过。

        const metric = String(payload.metric ?? "").trim(); // 指标名。
        if (!metric) continue; // metric 缺失则跳过。

        const v = Number(payload.value); // 数值。
        if (!Number.isFinite(v)) continue; // 非数值则跳过。

        const qualityRaw = String(qc.quality ?? "unknown").trim(); // 原始质量值。
        const quality: QcQuality = qualityRaw === "ok" || qualityRaw === "suspect" || qualityRaw === "bad" ? qualityRaw : "unknown"; // 归一化 quality。

        const sourceRaw = String(rec.source ?? r.facts_source ?? "device").trim(); // 原始 source。
        const source: FactsSource = sourceRaw === "gateway" || sourceRaw === "system" || sourceRaw === "human" ? sourceRaw : "device"; // 归一化 source。

        samples.push({ // 追加 sample。
          ts, // 样本时间戳。
          sensorId: sid, // 传感器 id。
          metric, // 指标名。
          value: v, // 数值。
          quality, // 质量。
          source, // 来源。
        }); // 结束追加。

        tsList.push(ts); // 记录时间戳供 gap 计算。
      } // 结束 raw_sample 遍历。

      let sampled = samples; // 默认不降采样。
      if (samples.length > maxPoints) { // 点数超限时降采样。
        const stride = Math.ceil(samples.length / maxPoints); // 计算步长。
        sampled = samples.filter((_, i) => i % stride === 0); // 固定步长抽样。
      } // 结束降采样。

      const gaps = computeGapsGlobal(tsList, startTs, endTs); // 计算 gaps。

      const ovWhere: string[] = []; // marker 查询 where 子句集合。
      const ovParams: any[] = []; // marker 查询参数。
      let op = 1; // marker SQL 参数序号。

      ovWhere.push(`(record_json::jsonb ->> 'type') = 'marker_v1'`); // 仅查 marker_v1。
      ovWhere.push(`occurred_at >= to_timestamp($${op++} / 1000.0)`); ovParams.push(startTs); // 起始时间过滤。
      ovWhere.push(`occurred_at <= to_timestamp($${op++} / 1000.0)`); ovParams.push(endTs); // 结束时间过滤。
      if (groupId) { ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'group_id') = $${op++}`); ovParams.push(groupId); } // groupId 过滤。
      if (sensorId) { ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'sensor_id') = $${op++}`); ovParams.push(sensorId); } // sensorId 过滤。
      if (spatialUnitId) { ovWhere.push(`(record_json::jsonb -> 'entity' ->> 'spatial_unit_id') = $${op++}`); ovParams.push(spatialUnitId); } // spatialUnitId 过滤。

      const markerSql = ` // marker_v1 查询 SQL。
        SELECT fact_id, occurred_at, record_json
        FROM facts
        WHERE ${ovWhere.join(" AND ")}
        ORDER BY occurred_at ASC
        LIMIT 5000
      `; // 结束 SQL。

      const markerRes = await pool.query(markerSql, ovParams); // 执行 marker 查询。
      const overlays: OverlaySegmentLocalV1[] = []; // overlays 输出数组。

      for (const r of markerRes.rows as any[]) { // 遍历 marker 行。
        const rec = parseRecordJson(r.record_json); // 解析 record_json。
        if (!rec) continue; // 坏数据跳过。

        const entity = rec.entity ?? {}; // entity 包。
        const payload = rec.payload ?? {}; // payload 包。

        const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim(); // 兼容 sensor_id / sensorId。
        if (!sid) continue; // sensorId 缺失则跳过。

        const kind = String(payload.type ?? payload.kind ?? "").trim(); // 兼容 type / kind 字段。
        const derivedOverlayKinds = new Set<string>(["step_candidate", "drift_candidate"]); // 派生 overlay allowlist。
        const kindAllowed = isMarkerKind(kind) || derivedOverlayKinds.has(kind); // 允许合同 kind + 派生 kind。
        if (!kindAllowed) continue; // 非 allowlist kind 直接跳过。

        const t = occurredAtToMs(r.occurred_at); // occurred_at 转毫秒。
        let oStartTs = t; // 默认 startTs = occurred_at。
        let oEndTs = t; // 默认 endTs = occurred_at。

        const pStart = payload?.startTs ?? payload?.start_ts ?? null; // startTs 兼容读取。
        const pEnd = payload?.endTs ?? payload?.end_ts ?? null; // endTs 兼容读取。

        if (typeof pStart === "number" && Number.isFinite(pStart)) oStartTs = pStart; // payload.startTs 优先。
        if (typeof pEnd === "number" && Number.isFinite(pEnd)) oEndTs = pEnd; // payload.endTs 优先。

        if (oEndTs < oStartTs) { // 若区间颠倒则交换。
          const tmp = oStartTs; // 临时变量。
          oStartTs = oEndTs; // 交换。
          oEndTs = tmp; // 交换。
        } // 结束交换。

        const payloadMetric = payload.metric != null && String(payload.metric).trim() ? String(payload.metric).trim() : null; // metric 可空。
        const payloadConfidence = payload.confidence != null && String(payload.confidence).trim() ? String(payload.confidence).trim() : null; // confidence 可空。

        const sourceRaw = String(rec.source ?? "system").trim(); // 原始 source。
        const source: FactsSource = sourceRaw === "device" || sourceRaw === "gateway" || sourceRaw === "human" ? sourceRaw : "system"; // 归一化 source。

        overlays.push({ // 追加 overlay。
          startTs: oStartTs, // 起点。
          endTs: oEndTs, // 终点。
          sensorId: sid, // 传感器 id。
          metric: payloadMetric, // 指标。
          kind, // kind。
          confidence: payloadConfidence, // 置信度。
          note: payload.note ? String(payload.note).slice(0, 120) : null, // 备注。
          source, // 来源。
        }); // 结束追加。
      } // 结束 marker 遍历。

      const resp: SeriesResponseV1 = { // 组装响应对象。
        range: { startTs, endTs, maxPoints } as any, // 查询区间。
        samples: sampled as any, // 采样点集合。
        gaps: gaps as any, // gaps 集合。
        overlays: overlays as any, // overlays 集合。
      }; // 结束响应对象。

      return reply.send(resp); // 返回响应。
    }); // 结束 GET /api/series。
  }; // 结束 plugin。
} // 结束 buildSeriesRoutes。
