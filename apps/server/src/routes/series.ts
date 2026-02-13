// apps/server/src/routes/series.ts
import type { FastifyInstance } from "fastify"; // Fastify 类型：用于注册路由。 
import type { Pool } from "pg"; // Postgres 连接池类型：用于查询 facts。 
import type { SeriesGapV1, SeriesResponseV1, SeriesSampleV1, OverlaySegment } from "@geox/contracts"; // /api/series 合约类型。 
import { isMarkerKind } from "@geox/contracts"; // marker kind allowlist 校验（合约层）。 

type FactsSource = "device" | "gateway" | "system" | "human"; // facts.source 的允许枚举。 
type QcQuality = "unknown" | "ok" | "suspect" | "bad"; // qc.quality 的允许枚举。 

function parseIntParam(v: unknown, name: string): number { // 解析 query 参数为整数。 
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; // 支持 string/number 两种输入。 
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`); // 非有限整数直接报错。 
  return n; // 返回解析后的整数。 
}

function splitCsv(v: string): string[] { // 将 csv 字符串切分为非空数组。 
  return v.split(",").map((s) => s.trim()).filter(Boolean); // trim + 过滤空项。 
}

function uniq<T>(xs: T[]): T[] { // 数组去重（保持集合语义）。 
  return Array.from(new Set(xs)); // Set 去重后再转回数组。 
}

// Postgres timestamptz -> ms epoch
function occurredAtToMs(occurredAt: unknown): number { // 将 occurred_at（timestamptz）转换为 epoch ms。 
  // pg 可能给 string，也可能给 Date（取决于 driver 配置）
  if (occurredAt instanceof Date) return occurredAt.getTime(); // Date 直接 getTime。 
  const s = String(occurredAt ?? ""); // 兜底转 string。 
  const t = Date.parse(s); // ISO string -> ms。 
  return Number.isFinite(t) ? t : 0; // 失败则返回 0（由上游过滤）。 
}

// gaps：保持 30min heuristic（与 server.ts 内联实现一致）。
function computeGapsGlobal(tsList: number[], startTs: number, endTs: number): SeriesGapV1[] { // 计算 gaps（缺测区间）。 
  const gaps: SeriesGapV1[] = []; // gaps 输出数组。 
  if (!tsList.length) return [{ startTs, endTs }]; // 无样本则全区间为 gap。 

  const sorted = tsList.slice().sort((a, b) => a - b); // 按时间升序排序。 
  if (sorted[0] > startTs) gaps.push({ startTs, endTs: sorted[0] }); // 起始缺口。 

  for (let i = 1; i < sorted.length; i++) { // 遍历相邻点计算间隔。 
    const prev = sorted[i - 1]; // 前一时刻。 
    const cur = sorted[i]; // 当前时刻。 
    if (cur - prev > 30 * 60 * 1000) gaps.push({ startTs: prev, endTs: cur }); // 超过 30min 视为 gap。 
  }

  const last = sorted[sorted.length - 1]; // 最后一个点。 
  if (last < endTs) gaps.push({ startTs: last, endTs }); // 末尾缺口。 

  return gaps; // 返回 gaps。 
}

function parseRecordJson(x: any): any | null { // 解析 facts.record_json（可能是对象也可能是字符串）。 
  if (x == null) return null; // null/undefined 直接返回 null。 
  if (typeof x === "object") return x; // 已是对象则直接返回。 
  if (typeof x !== "string") return null; // 非字符串无法 JSON.parse。 
  try {
    return JSON.parse(x); // 尝试解析 JSON 字符串。 
  } catch {
    return null; // 解析失败返回 null。 
  }
}

// 关键：我们需要拿到 pool（在 server.ts 创建 Pool 后传进来）
export function buildSeriesRoutes(pool: Pool) { // 生成 Fastify plugin：把 /api/series 路由挂到 app。 
  return async function seriesRoutes(app: FastifyInstance) { // Fastify plugin 入口函数。 
    // GET /api/series?groupId=...&sensorId=...&metrics=a,b&metric=a&startTs=..&endTs=..&maxPoints=..
    app.get("/api/series", async (req, reply) => { // /api/series：从 facts 聚合成前端可用序列。 
      const q = req.query as Record<string, unknown>;

      let startTs: number;
      let endTs: number;
      let metrics: string[];
      let maxPoints: number;

      try {
        startTs = parseIntParam(q.startTs, "startTs");
        endTs = parseIntParam(q.endTs, "endTs");

        // 兼容 metrics=csv 或 metric=single
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

      // ---------- raw_sample_v1 ----------
      const whereParts: string[] = [];
      const params: any[] = [];
      let p = 1;

      whereParts.push(`(record_json::jsonb ->> 'type') = 'raw_sample_v1'`);
      whereParts.push(`occurred_at >= to_timestamp($${p++} / 1000.0)`); params.push(startTs);
      whereParts.push(`occurred_at <= to_timestamp($${p++} / 1000.0)`); params.push(endTs);

      // 这里必须 cast：ANY($x::text[]) 否则 pg 有时会把参数当 unknown
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
      params.push(Math.max(1, Math.min(20000, maxPoints * 50)));

      const rawRes = await pool.query(rawSql, params); // 查询 raw_sample_v1 facts。

      const samples: SeriesSampleV1[] = []; // samples 输出数组。 
      const tsList: number[] = []; // gaps 计算用的时间戳列表。 

      for (const r of rawRes.rows as any[]) {
        const rec = parseRecordJson(r.record_json);
        if (!rec) continue;

        const entity = rec.entity ?? {};
        const payload = rec.payload ?? {};
        const qc = rec.qc ?? {};

        const ts = occurredAtToMs(r.occurred_at);
        const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim();
        const gid = entity.group_id ? String(entity.group_id).trim() : undefined;

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
          // 这里优先 record_json.source，其次 facts.source
          source: (String(rec.source ?? r.facts_source ?? "device") as any) ?? "device",
        } as any);

        tsList.push(ts);
      }

      // downsample
      let sampled = samples;
      if (samples.length > maxPoints) {
        const stride = Math.ceil(samples.length / maxPoints);
        sampled = samples.filter((_, i) => i % stride === 0);
      }

      const gaps = computeGapsGlobal(tsList, startTs, endTs);

      // ---------- marker_v1 overlays ----------
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
      const markerRes = await pool.query(markerSql, ovParams); // 查询 marker_v1 facts。

      const overlays: OverlaySegment[] = []; // overlays 输出数组。 
      for (const r of markerRes.rows as any[]) {
        const rec = parseRecordJson(r.record_json);
        if (!rec) continue;

        const entity = rec.entity ?? {};
        const payload = rec.payload ?? {};

        const sid = String(entity.sensor_id ?? entity.sensorId ?? "").trim(); // sensorId 兼容读取（与 server.ts 内联一致）。 
        if (!sid) continue;

        const kind = String(payload.type ?? payload.kind ?? "").trim(); // kind/type 兼容读取。 

        const DERIVED_OVERLAY_KINDS = new Set<string>(["step_candidate", "drift_candidate"]); // derived overlay allowlist（与 server.ts 内联一致）。 
        const kindAllowed = isMarkerKind(kind) || DERIVED_OVERLAY_KINDS.has(kind); // 同时允许合约 kind + derived kind。 
        if (!kindAllowed) continue; // 非 allowlist 的 kind 直接过滤。 

        const t = occurredAtToMs(r.occurred_at); // occurred_at -> ms。 

        let oStartTs = t; // overlay startTs 默认等于 occurred_at。 
        let oEndTs = t; // overlay endTs 默认等于 occurred_at。 

        const pStart = payload?.startTs ?? payload?.start_ts ?? null; // payload startTs 兼容读取。 
        const pEnd = payload?.endTs ?? payload?.end_ts ?? null; // payload endTs 兼容读取。 

        if (typeof pStart === "number" && Number.isFinite(pStart)) oStartTs = pStart; // payload.startTs 优先。 
        if (typeof pEnd === "number" && Number.isFinite(pEnd)) oEndTs = pEnd; // payload.endTs 优先。 

        if (oEndTs < oStartTs) { // 若输入颠倒则 swap，避免负区间。 
          const tmp = oStartTs; // swap 临时变量。 
          oStartTs = oEndTs; // swap。 
          oEndTs = tmp; // swap。 
        }

        const payloadMetric = payload.metric != null && String(payload.metric).trim() ? String(payload.metric).trim() : null; // metric（device_fault 可为 null）。 
        const payloadConfidence =
          payload.confidence != null && String(payload.confidence).trim() ? String(payload.confidence).trim() : null; // confidence（device_fault 可为 null）。 

        overlays.push({
          startTs: oStartTs,
          endTs: oEndTs,
          sensorId: sid,
          metric: payloadMetric,
          kind: kind as any,
          confidence: payloadConfidence as any,
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
  };
}