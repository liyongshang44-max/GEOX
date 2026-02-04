#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

function fail(msg, err) {
  const detail = err && err.message ? ` :: ${err.message}` : "";
  process.stderr.write(`[FAIL] ${msg}${detail}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--actTaskId") { out.actTaskId = argv[++i]; continue; }
    if (a === "--out") { out.outPath = argv[++i]; continue; }
    if (a === "--help" || a === "-h") { out.help = true; continue; }
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
  try { return JSON.parse(s); } catch { return null; }
}

function normalizeOccurredAt(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toFactSection(row) {
  const rec = typeof row.record_json === "string" ? safeJsonParse(row.record_json) : row.record_json;
  return {
    fact_id: row.fact_id,
    occurred_at: normalizeOccurredAt(row.occurred_at),
    source: row.source,
    record_json: rec
  };
}

function lexAsc(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.actTaskId || !args.outPath) {
    process.stdout.write("Usage: node scripts/audit/ao_act_evidence_pack_v0.cjs --actTaskId <id> --out <path>\n");
    process.exit(args.help ? 0 : 2);
  }

  const actTaskId = String(args.actTaskId);
  const outPath = String(args.outPath);

  const client = new Client({ connectionString: getPgConnectionString() });

  try {
    await client.connect();

    const taskSql = `
      SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
      FROM facts
      WHERE (record_json::jsonb)->>'type' = 'ao_act_task_v0'
        AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1
    `;
    const taskRes = await client.query(taskSql, [actTaskId]);
    if (taskRes.rowCount === 0) fail("TASK_NOT_FOUND");

    const act_task = toFactSection(taskRes.rows[0]);

    const receiptSql = `
      SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
      FROM facts
      WHERE (record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
        AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      ORDER BY fact_id ASC
    `;
    const receiptRes = await client.query(receiptSql, [actTaskId]);
    const receipts = receiptRes.rows.map(toFactSection);

    const refs = [];
    for (const r of receipts) {
      const rr = r.record_json;
      const logs = rr && rr.payload && Array.isArray(rr.payload.logs_refs) ? rr.payload.logs_refs : [];
      for (const it of logs) {
        if (!it) continue;
        const kind = typeof it.kind === "string" && it.kind.length > 0 ? it.kind : "executor_log";
        const ref = typeof it.ref === "string" ? it.ref : "";
        if (ref.length === 0) continue;
        refs.push({ kind, ref });
      }
    }
    refs.sort((x, y) => {
      const kc = lexAsc(String(x.kind), String(y.kind));
      if (kc !== 0) return kc;
      return lexAsc(String(x.ref), String(y.ref));
    });

    const pack = {
      type: "ao_act_receipt_evidence_pack_v0",
      ordering_rule: "fact_id_lex_asc",
      act_task_id: actTaskId,
      act_task,
      receipts,
      refs
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), "utf8");
    process.exit(0);
  } catch (err) {
    fail("EVIDENCE_PACK_FAILED", err);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();
