// apps/server/src/routes/series.ts
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { SeriesGapV1, SeriesResponseV1, SeriesSampleV1, OverlaySegment } from "@geox/contracts";
import { isMarkerKind } from "@geox/contracts";

type FactsSource = "device" | "gateway" | "system" | "human";
type QcQuality = "unknown" | "ok" | "suspect" | "bad";

function parseIntParam(v: unknown, name: string): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`);
  return n;
}

function splitCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

// Postgres timestamptz -> ms epoch
function occurredAtToMs(occurredAt: unknown): number {
  // pg 可能给 string，也可能给 Date（取决于 driver 配置）
  if (occurredAt instanceof Date) return occurredAt.getTime();
  const s = String(occurredAt ?? "");
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

// gaps：保持你之前 30min heuristic
function computeGapsGlobal(tsList: number[], startTs: number, endTs: number): SeriesGapV1[] {
  const gaps: SeriesGapV1[] = [];
  if (!tsList.length) return [{ startTs, endTs }];

  const sorted = tsList.slice().sort((a, b) => a - b);
  if (sorted[0] > startTs) gaps.push({ startTs, endTs: sorted[0] });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur - prev > 30 * 60 * 1000) gaps.push({ startTs: prev, endTs: cur });
  }

  const last = sorted[sorted.length - 1];
  if (last < endTs) gaps.push({ startTs: last, endTs });

  return gaps;
}

function parseRecordJson(x: any): any | null {
  if (x == null) return null;
  if (typeof x === "object") return x;
  if (typeof x !== "string") return null;
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

// 关键：我们需要拿到 pool（在 server.ts 创建 Pool 后传进来）
export function buildSeriesRoutes(pool: Pool) {
  return async function seriesRoutes(app: FastifyInstance) {
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

      const rawRes = await pool.query(rawSql, params);

      const samples: SeriesSampleV1[] = [];
      const tsList: number[] = [];

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
      const markerRes = await pool.query(markerSql, ovParams);

      const overlays: OverlaySegment[] = [];
      for (const r of markerRes.rows as any[]) {
        const rec = parseRecordJson(r.record_json);
        if (!rec) continue;

        const entity = rec.entity ?? {};
        const payload = rec.payload ?? {};

        const sid = String(entity.sensor_id ?? "").trim();
        if (!sid) continue;

        const kind = String(payload.type ?? payload.kind ?? "").trim();
        if (!isMarkerKind(kind)) continue;

        const t = occurredAtToMs(r.occurred_at);
        overlays.push({
          startTs: t,
          endTs: t,
          sensorId: sid,
          metric: payload.metric ? String(payload.metric) : null,
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
  };
}