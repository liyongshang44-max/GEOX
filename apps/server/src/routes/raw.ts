import { FastifyInstance } from "fastify"; // Fastify app instance for route registration
import { Pool } from "pg"; // Postgres connection pool (Ledger write)
import { randomUUID } from "crypto"; // Generate fact_id when caller does not provide one

/**
 * /api/raw (append-only)
 *
 * Purpose (frozen from Sprint 0–2 intent): provide a controlled ingestion path that writes facts
 * into the Ledger (facts table) without mutating or deleting existing facts.
 *
 * Notes:
 * - This module MUST export registerRawRoutes; server.ts depends on it.
 * - This endpoint is intentionally generic: it stores a caller-provided record_json envelope.
 * - It does NOT perform semantic judgment; it only enforces a minimal envelope and append-only write.
 */
export function registerRawRoutes(app: FastifyInstance, pool: Pool) {
  // Minimal strictness: reject unknown top-level keys to avoid schema drift via ingestion.
  function checkNoExtraKeys(obj: any, allowed: string[]): string | null {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return "BODY_NOT_OBJECT";
    const keys = Object.keys(obj);
    const allowedSet = new Set(allowed);
    const extras = keys.filter((k) => !allowedSet.has(k));
    if (extras.length > 0) return `EXTRA_FIELDS:${extras.join(",")}`;
    return null;
  }

  function isNonEmptyString(v: any): v is string {
    return typeof v === "string" && v.trim().length > 0;
  }

  function badRequest(reply: any, error: string) {
    return reply.status(400).send({ ok: false, error });
  }

  const insertFactSql = `
    INSERT INTO facts (fact_id, occurred_at, source, record_json)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (fact_id) DO NOTHING
    RETURNING fact_id
  `;

  // POST /api/raw
  // Body: { fact_id?, occurred_at_iso?, source, record_json }
  app.post("/api/raw", async (req, reply) => {
    const body: any = req.body;

    const extraErr = checkNoExtraKeys(body, ["fact_id", "occurred_at_iso", "source", "record_json"]);
    if (extraErr) return badRequest(reply, extraErr);

    const fact_id: string = isNonEmptyString(body.fact_id) ? body.fact_id : randomUUID();

    const occurred_at_iso: string = isNonEmptyString(body.occurred_at_iso)
      ? body.occurred_at_iso
      : new Date().toISOString();

    const source: any = body.source;
    const allowedSources = new Set(["device", "gateway", "system", "human"]);
    if (!isNonEmptyString(source) || !allowedSources.has(source)) return badRequest(reply, "MISSING_OR_INVALID:source");

    const record_json: any = body.record_json;
    if (record_json === null || typeof record_json !== "object" || Array.isArray(record_json)) {
      return badRequest(reply, "MISSING_OR_INVALID:record_json");
    }

    // Ensure record_json can be stringified deterministically (JSON stringify may throw on cycles).
    let record_json_text = "";
    try {
      record_json_text = JSON.stringify(record_json);
    } catch {
      return badRequest(reply, "INVALID:record_json_not_serializable");
    }

    const res = await pool.query(insertFactSql, [fact_id, occurred_at_iso, source, record_json_text]);
    if (!res?.rows?.length) {
      // Conflict (fact_id exists) is treated as idempotent success.
      return reply.send({ ok: true, fact_id, inserted: false });
    }

    return reply.send({ ok: true, fact_id, inserted: true });
  });
}
