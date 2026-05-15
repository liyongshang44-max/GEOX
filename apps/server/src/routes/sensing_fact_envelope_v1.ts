import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  appendRawSampleV1,
  buildSeriesResponseV1,
  readRawSamplesV1,
  RawSampleFactEnvelopeErrorV1,
  type RawSampleFactEnvelopeTenantV1,
} from "../domain/sensing/raw_sample_fact_envelope_v1.js";

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function toTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function toPositiveInt(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseMetricList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.flatMap((x) => String(x ?? "").split(",")).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof v !== "string" || !v.trim()) return [];
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

function handleFactEnvelopeError(reply: FastifyReply, err: unknown): boolean {
  if (!(err instanceof RawSampleFactEnvelopeErrorV1)) return false;
  reply.status(err.statusCode).send({ ok: false, error: err.code });
  return true;
}

function tenantFromAuth(auth: any, override: any = {}): RawSampleFactEnvelopeTenantV1 {
  return {
    tenant_id: String(override.tenant_id ?? auth.tenant_id),
    project_id: String(override.project_id ?? auth.project_id),
    group_id: String(override.group_id ?? auth.group_id),
  };
}

function enforceTenantMatch(auth: any, tenant: RawSampleFactEnvelopeTenantV1, reply: FastifyReply): boolean {
  if (tenant.tenant_id !== auth.tenant_id || tenant.project_id !== auth.project_id || tenant.group_id !== auth.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function registerSensingFactEnvelopeV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/sensing/raw-samples", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "telemetry.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant = tenantFromAuth(auth, body);
    if (!enforceTenantMatch(auth, tenant, reply)) return;
    try {
      const item = await appendRawSampleV1(pool, body, tenant);
      return reply.send({ ok: true, item });
    } catch (err) {
      if (handleFactEnvelopeError(reply, err)) return;
      req.log.error({ err }, "raw_sample_v1 append failed");
      return reply.status(500).send({ ok: false, error: "RAW_SAMPLE_APPEND_FAILED" });
    }
  });

  app.get("/api/v1/sensing/raw-samples", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;
    const q: any = req.query ?? {};
    const tenant = tenantFromAuth(auth, q);
    if (!enforceTenantMatch(auth, tenant, reply)) return;
    const start_ts_ms = toPositiveInt(q.start_ts_ms ?? q.startTs ?? q.from_ts_ms);
    const end_ts_ms = toPositiveInt(q.end_ts_ms ?? q.endTs ?? q.to_ts_ms);
    if (start_ts_ms == null || end_ts_ms == null || end_ts_ms < start_ts_ms) return badRequest(reply, "INVALID_TIME_RANGE");
    try {
      const items = await readRawSamplesV1(pool, {
        ...tenant,
        sensor_id: toTrimmedString(q.sensor_id ?? q.sensorId),
        group_id: toTrimmedString(q.group_id ?? q.groupId) ?? tenant.group_id,
        field_id: toTrimmedString(q.field_id ?? q.fieldId),
        metrics: parseMetricList(q.metrics ?? q.metric),
        start_ts_ms,
        end_ts_ms,
        limit: toPositiveInt(q.limit) ?? 5000,
      });
      return reply.send({ ok: true, count: items.length, items });
    } catch (err) {
      if (handleFactEnvelopeError(reply, err)) return;
      req.log.error({ err }, "raw_sample_v1 read failed");
      return reply.status(500).send({ ok: false, error: "RAW_SAMPLE_READ_FAILED" });
    }
  });

  app.get("/api/v1/sensing/series", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;
    const q: any = req.query ?? {};
    const tenant = tenantFromAuth(auth, q);
    if (!enforceTenantMatch(auth, tenant, reply)) return;
    const start_ts_ms = toPositiveInt(q.start_ts_ms ?? q.startTs ?? q.from_ts_ms);
    const end_ts_ms = toPositiveInt(q.end_ts_ms ?? q.endTs ?? q.to_ts_ms);
    if (start_ts_ms == null || end_ts_ms == null || end_ts_ms < start_ts_ms) return badRequest(reply, "INVALID_TIME_RANGE");

    const sensor_id = toTrimmedString(q.sensor_id ?? q.sensorId);
    const query_group_id = toTrimmedString(q.group_id ?? q.groupId);
    const field_id = toTrimmedString(q.field_id ?? q.fieldId);
    if (!sensor_id && !query_group_id && !field_id) return badRequest(reply, "SCOPE_FILTER_REQUIRED");

    try {
      const item = await buildSeriesResponseV1(pool, {
        ...tenant,
        sensor_id,
        group_id: query_group_id ?? tenant.group_id,
        field_id,
        metrics: parseMetricList(q.metrics ?? q.metric),
        start_ts_ms,
        end_ts_ms,
        limit: toPositiveInt(q.limit) ?? 10000,
        max_gap_ms: toPositiveInt(q.max_gap_ms ?? q.maxGapMs) ?? undefined,
      });
      return reply.send({ ok: true, item });
    } catch (err) {
      if (handleFactEnvelopeError(reply, err)) return;
      req.log.error({ err }, "series response v1 failed");
      return reply.status(500).send({ ok: false, error: "SERIES_RESPONSE_FAILED" });
    }
  });
}
