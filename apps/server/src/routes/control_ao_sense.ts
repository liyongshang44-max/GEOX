import { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { randomUUID } from "crypto";

/**
 * Apple III v0 · AO-SENSE → Task → Receipt (+ Sprint 3 readonly projections)
 *
 * Responsibilities:
 * - Persist Judge AO-SENSE into append-only facts (ledger).
 * - Persist execution receipts into append-only facts.
 * - Provide read-only projection endpoints (query facts) for operational visibility.
 *
 * Non-goals:
 * - No agronomy, no value judgement, no control optimization.
 * - No mutable task state tables; no updates/deletes.
 *
 * Storage constraints (from DB schema):
 * - facts: (fact_id text PK, occurred_at timestamptz, source text, record_json text)
 * - Therefore we MUST insert fact_id/occurred_at/source/record_json explicitly.
 */
export function registerControlAoSenseRoutes(app: FastifyInstance, pool: Pool) {
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

  function isIntMs(v: any): v is number {
    return typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v && v > 0;
  }

  function parseLimit(v: any, def: number, max: number): number {
    const n = Number(v);
    if (!Number.isFinite(n) || Math.floor(n) !== n) return def;
    if (n <= 0) return def;
    return Math.min(n, max);
  }

  function badRequest(reply: any, error: string) {
    return reply.status(400).send({ ok: false, error });
  }

  function safeJsonParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  // Shared SQL (append-only insert; conflict ignored).
  const insertFactSql = `
    INSERT INTO facts (fact_id, occurred_at, source, record_json)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (fact_id) DO NOTHING
    RETURNING fact_id
  `;

  /**
   * POST /api/control/ao_sense/task
   * Creates an AO_SENSE_TASK_v1 ledger fact.
   */
  app.post("/api/control/ao_sense/task", async (req, reply) => {
    const body: any = req.body;

    const allowedKeys = [
      "subjectRef",
      "window",
      "sense_kind",
      "sense_focus",
      "priority",
      "supporting_problem_state_id",
      "supporting_determinism_hash",
      "supporting_effective_config_hash",
      // Compatibility inputs (accepted, but never stored):
      "kind",
      "focus"
    ];

    const extraErr = checkNoExtraKeys(body, allowedKeys);
    if (extraErr) return badRequest(reply, extraErr);

    if (body.subjectRef === undefined) return badRequest(reply, "MISSING_FIELD:subjectRef");
    if (body.window === undefined) return badRequest(reply, "MISSING_FIELD:window");
    if (body.priority === undefined) return badRequest(reply, "MISSING_FIELD:priority");
    if (body.supporting_problem_state_id === undefined) return badRequest(reply, "MISSING_FIELD:supporting_problem_state_id");
    if (body.supporting_determinism_hash === undefined) return badRequest(reply, "MISSING_FIELD:supporting_determinism_hash");
    if (body.supporting_effective_config_hash === undefined) return badRequest(reply, "MISSING_FIELD:supporting_effective_config_hash");

    const sense_kind = body.sense_kind ?? body.kind;
    const sense_focus = body.sense_focus ?? body.focus;

    if (!isNonEmptyString(sense_kind)) return badRequest(reply, "MISSING_OR_INVALID:sense_kind");
    if (!isNonEmptyString(sense_focus)) return badRequest(reply, "MISSING_OR_INVALID:sense_focus");
    if (!isNonEmptyString(body.priority)) return badRequest(reply, "MISSING_OR_INVALID:priority");
    if (!isNonEmptyString(body.supporting_problem_state_id)) return badRequest(reply, "MISSING_OR_INVALID:supporting_problem_state_id");
    if (!isNonEmptyString(body.supporting_determinism_hash)) return badRequest(reply, "MISSING_OR_INVALID:supporting_determinism_hash");
    if (!isNonEmptyString(body.supporting_effective_config_hash)) return badRequest(reply, "MISSING_OR_INVALID:supporting_effective_config_hash");

    const sr = body.subjectRef;
    const srExtra = checkNoExtraKeys(sr, ["projectId", "groupId"]);
    if (srExtra) return badRequest(reply, `subjectRef.${srExtra}`);
    if (!isNonEmptyString(sr.projectId)) return badRequest(reply, "MISSING_OR_INVALID:subjectRef.projectId");
    if (!isNonEmptyString(sr.groupId)) return badRequest(reply, "MISSING_OR_INVALID:subjectRef.groupId");

    const win = body.window;
    const winExtra = checkNoExtraKeys(win, ["startTs", "endTs"]);
    if (winExtra) return badRequest(reply, `window.${winExtra}`);
    if (!isIntMs(win.startTs)) return badRequest(reply, "MISSING_OR_INVALID:window.startTs");
    if (!isIntMs(win.endTs)) return badRequest(reply, "MISSING_OR_INVALID:window.endTs");
    if (win.endTs < win.startTs) return badRequest(reply, "INVALID_WINDOW:endTs_lt_startTs");

    const task_id = randomUUID(); // Unique task id.
    const created_at_ts = Date.now(); // Creation time ms.

    const record_json = {
      type: "ao_sense_task_v1",
      schema_version: "1",
      task_id,
      created_at_ts,
      subjectRef: { projectId: sr.projectId, groupId: sr.groupId },
      window: { startTs: win.startTs, endTs: win.endTs },
      sense_kind,
      sense_focus,
      priority: body.priority,
      supporting_problem_state_id: body.supporting_problem_state_id,
      supporting_determinism_hash: body.supporting_determinism_hash,
      supporting_effective_config_hash: body.supporting_effective_config_hash
    };

    const fact_id = `ct_${task_id}`; // Stable mapping to task_id.
    const occurred_at = new Date(created_at_ts).toISOString(); // ISO string for timestamptz.
    const source = "control"; // Frozen: Apple III is control/orchestration layer.

    const res = await pool.query(insertFactSql, [fact_id, occurred_at, source, JSON.stringify(record_json)]);

    if (!res.rows || res.rows.length < 1) {
      return reply.status(500).send({ ok: false, error: "FACT_INSERT_CONFLICT_OR_FAILED", fact_id });
    }

    return reply.send({ ok: true, task_id, fact_id });
  });

  /**
   * POST /api/control/ao_sense/receipt
   * Creates an AO_SENSE_RECEIPT_v1 ledger fact.
   */
  app.post("/api/control/ao_sense/receipt", async (req, reply) => {
    const body: any = req.body;

    const allowedKeys = ["task_id", "executed_at_ts", "result", "evidence_refs"];
    const extraErr = checkNoExtraKeys(body, allowedKeys);
    if (extraErr) return badRequest(reply, extraErr);

    if (!isNonEmptyString(body.task_id)) return badRequest(reply, "MISSING_OR_INVALID:task_id");
    if (!isIntMs(body.executed_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:executed_at_ts");

    const allowedResults = new Set(["success", "fail", "partial"]);
    if (!isNonEmptyString(body.result) || !allowedResults.has(body.result)) {
      return badRequest(reply, "MISSING_OR_INVALID:result");
    }

    if (!Array.isArray(body.evidence_refs) || body.evidence_refs.length < 1) {
      return badRequest(reply, "EVIDENCE_REFS_EMPTY");
    }

    const allowedKinds = new Set(["raw_sample_v1", "marker_v1", "import_run_v1", "fact_id"]);
    for (let i = 0; i < body.evidence_refs.length; i++) {
      const er = body.evidence_refs[i];
      const erExtra = checkNoExtraKeys(er, ["kind", "ref_id"]);
      if (erExtra) return badRequest(reply, `evidence_refs[${i}].${erExtra}`);
      if (!isNonEmptyString(er.kind) || !allowedKinds.has(er.kind)) return badRequest(reply, `evidence_refs[${i}].MISSING_OR_INVALID:kind`);
      if (!isNonEmptyString(er.ref_id)) return badRequest(reply, `evidence_refs[${i}].MISSING_OR_INVALID:ref_id`);
    }

    const receipt_id = randomUUID(); // Unique receipt id.
    const created_at_ts = Date.now(); // Creation time ms.

    const record_json = {
      type: "ao_sense_receipt_v1",
      schema_version: "1",
      receipt_id,
      created_at_ts,
      task_id: body.task_id,
      executed_at_ts: body.executed_at_ts,
      result: body.result,
      evidence_refs: body.evidence_refs
    };

    const fact_id = `cr_${receipt_id}`; // Stable mapping to receipt_id.
    const occurred_at = new Date(created_at_ts).toISOString();
    const source = "control";

    const res = await pool.query(insertFactSql, [fact_id, occurred_at, source, JSON.stringify(record_json)]);
    if (!res.rows || res.rows.length < 1) {
      return reply.status(500).send({ ok: false, error: "FACT_INSERT_CONFLICT_OR_FAILED", fact_id });
    }

    return reply.send({ ok: true, receipt_id, fact_id });
  });

  /**
   * GET /api/control/ao_sense/tasks
   * Read-only projection of AO_SENSE_TASK_v1 from facts.
   *
   * Query params (all optional):
   * - projectId: string
   * - groupId: string
   * - limit: integer (default 20, max 200)
   */
  app.get("/api/control/ao_sense/tasks", async (req, reply) => {
    const q: any = (req as any).query ?? {};
    const limit = parseLimit(q.limit, 20, 200);
    const projectId = isNonEmptyString(q.projectId) ? q.projectId : null;
    const groupId = isNonEmptyString(q.groupId) ? q.groupId : null;

    const where: string[] = [];
    const args: any[] = [];
    let i = 1;

    // Filter by type.
    where.push(`(record_json::jsonb->>'type') = 'ao_sense_task_v1'`);

    if (projectId) {
      where.push(`(record_json::jsonb->'subjectRef'->>'projectId') = $${i}`);
      args.push(projectId);
      i++;
    }

    if (groupId) {
      where.push(`(record_json::jsonb->'subjectRef'->>'groupId') = $${i}`);
      args.push(groupId);
      i++;
    }

    args.push(limit);

    const sql = `
      SELECT fact_id, occurred_at, source, record_json
      FROM facts
      WHERE ${where.join(" AND ")}
      ORDER BY occurred_at DESC
      LIMIT $${i}
    `;

    const res = await pool.query(sql, args);

    const items = (res.rows ?? []).map((r: any) => ({
      fact_id: r.fact_id,
      occurred_at: r.occurred_at,
      source: r.source,
      record_json: safeJsonParse(r.record_json)
    }));

    return reply.send({ ok: true, items });
  });

  /**
   * GET /api/control/ao_sense/receipts
   * Read-only projection of AO_SENSE_RECEIPT_v1 from facts.
   *
   * Query params (all optional):
   * - task_id: string
   * - limit: integer (default 20, max 200)
   */
  app.get("/api/control/ao_sense/receipts", async (req, reply) => {
    const q: any = (req as any).query ?? {};
    const limit = parseLimit(q.limit, 20, 200);
    const task_id = isNonEmptyString(q.task_id) ? q.task_id : null;

    const where: string[] = [];
    const args: any[] = [];
    let i = 1;

    where.push(`(record_json::jsonb->>'type') = 'ao_sense_receipt_v1'`);

    if (task_id) {
      where.push(`(record_json::jsonb->>'task_id') = $${i}`);
      args.push(task_id);
      i++;
    }

    args.push(limit);

    const sql = `
      SELECT fact_id, occurred_at, source, record_json
      FROM facts
      WHERE ${where.join(" AND ")}
      ORDER BY occurred_at DESC
      LIMIT $${i}
    `;

    const res = await pool.query(sql, args);

    const items = (res.rows ?? []).map((r: any) => ({
      fact_id: r.fact_id,
      occurred_at: r.occurred_at,
      source: r.source,
      record_json: safeJsonParse(r.record_json)
    }));

    return reply.send({ ok: true, items });
  });
}