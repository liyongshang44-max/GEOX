#!/usr/bin/env node
"use strict";

const fs = require("node:fs"); // File system for writing the integrity report JSON.
const path = require("node:path"); // Path utilities for resolving output paths.
const { Client } = require("pg"); // Postgres client for querying facts.

function fail(msg, err) {
  const detail = err && err.message ? ` :: ${err.message}` : "";
  process.stderr.write(`[FAIL] ${msg}${detail}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--actTaskId") {
      out.actTaskId = argv[++i];
      continue;
    }
    if (a === "--out") {
      out.outPath = argv[++i];
      continue;
    }
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
  }
  return out;
}

function getPgConnectionString() {
  const cs = process.env.DATABASE_URL;
  if (cs && String(cs).trim().length > 0) return String(cs);

  const host = process.env.PGHOST || "127.0.0.1";
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER || "landos";
  const password = process.env.PGPASSWORD || "landos_pwd";
  const database = process.env.PGDATABASE || "landos";

  return `postgres://${encodeURIComponent(String(user))}:${encodeURIComponent(String(password))}@${String(host)}:${String(port)}/${encodeURIComponent(String(database))}`;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function asRecordJson(row) {
  return typeof row.record_json === "string" ? safeJsonParse(row.record_json) : row.record_json;
}

function uniq(xs) {
  const s = new Set();
  for (const x of xs) s.add(x);
  return Array.from(s);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.actTaskId || !args.outPath) {
    process.stdout.write(
      "Usage: node scripts/audit/ao_act_integrity_check_v0.cjs --actTaskId <id> --out <path>\n"
    );
    process.exit(args.help ? 0 : 2);
  }

  const actTaskId = String(args.actTaskId);
  const outPath = String(args.outPath);

  const client = new Client({ connectionString: getPgConnectionString() });

  const errors = [];

  try {
    await client.connect();

    // Load task (latest).
    const taskSql = `
      SELECT fact_id, occurred_at, source, record_json
      FROM facts
      WHERE (record_json::jsonb)->>'type' = 'ao_act_task_v0'
        AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1
    `;
    const taskRes = await client.query(taskSql, [actTaskId]);
    if (taskRes.rowCount === 0) {
      errors.push({ code: "TASK_NOT_FOUND", message: `No ao_act_task_v0 for act_task_id=${actTaskId}` });
    }

    const taskRec = taskRes.rowCount ? asRecordJson(taskRes.rows[0]) : null;
    const schemaKeys =
      taskRec && taskRec.payload && taskRec.payload.parameter_schema && Array.isArray(taskRec.payload.parameter_schema.keys)
        ? taskRec.payload.parameter_schema.keys
        : [];
    const allowedKeys = new Set(schemaKeys.map((k) => String(k.name)));

    // Load receipts.
    const receiptSql = `
      SELECT fact_id, occurred_at, source, record_json
      FROM facts
      WHERE (record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
        AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      ORDER BY fact_id ASC
    `;
    const receiptRes = await client.query(receiptSql, [actTaskId]);
    const receipts = receiptRes.rows.map((r) => ({
      fact_id: r.fact_id,
      occurred_at: r.occurred_at,
      source: r.source,
      record_json: asRecordJson(r)
    }));

    // Minimal integrity checks (audit-only, frozen to acceptance needs).
    for (const r of receipts) {
      const rec = r.record_json;
      if (!rec || rec.type !== "ao_act_receipt_v0") {
        errors.push({ code: "RECEIPT_RECORD_INVALID", message: `receipt fact_id=${r.fact_id} missing/invalid record_json` });
        continue;
      }
      if (!rec.payload || String(rec.payload.act_task_id) !== actTaskId) {
        errors.push({ code: "RECEIPT_ACT_TASK_ID_MISMATCH", message: `receipt fact_id=${r.fact_id} act_task_id mismatch` });
      }

      // observed_parameters keys must be subset of task.parameter_schema.keys
      const op = rec.payload && rec.payload.observed_parameters && typeof rec.payload.observed_parameters === "object" ? rec.payload.observed_parameters : null;
      if (!op) {
        errors.push({ code: "RECEIPT_OBSERVED_PARAMETERS_MISSING", message: `receipt fact_id=${r.fact_id} observed_parameters missing` });
      } else if (allowedKeys.size > 0) {
        for (const k of Object.keys(op)) {
          if (!allowedKeys.has(String(k))) {
            errors.push({ code: "RECEIPT_OBSERVED_KEY_UNKNOWN", message: `receipt fact_id=${r.fact_id} unknown observed key: ${k}` });
          }
        }
      }

      // executor_id shape sanity (object with kind/id/namespace).
      const ex = rec.payload ? rec.payload.executor_id : null;
      if (!ex || typeof ex !== "object" || !ex.kind || !ex.id || !ex.namespace) {
        errors.push({ code: "RECEIPT_EXECUTOR_ID_INVALID", message: `receipt fact_id=${r.fact_id} executor_id invalid` });
      }
    }

    // Receipt count sanity.
    if (receipts.length < 1) {
      errors.push({ code: "RECEIPTS_EMPTY", message: `No ao_act_receipt_v0 for act_task_id=${actTaskId}` });
    }

    const report = {
      type: "ao_act_integrity_report_v0",
      act_task_id: actTaskId,
      ok: errors.length === 0,
      errors,
      receipts_checked: receipts.length,
      unique_receipt_sources: uniq(receipts.map((r) => String(r.source || ""))).filter((s) => s.length > 0)
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    process.exit(0);
  } catch (err) {
    fail("INTEGRITY_CHECK_FAILED", err);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

main();
