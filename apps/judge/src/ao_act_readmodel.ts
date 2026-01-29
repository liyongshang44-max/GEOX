import type { AppleIReader } from "./applei_reader"; // Import Judge's Postgres ledger reader

// Sprint 12 (AO-ACT ReadModel v0): read-only mirror for explain/debug only. // Must not affect judgment output

export type AoActReadModelQueryV0 = {
  startTsMs: number; // Query window start (ms since epoch)
  endTsMs: number; // Query window end (ms since epoch)
};

export type AoActLatestReceiptIndexRowV0 = {
  act_task_id: string; // AO-ACT task id (execution-scoped; never a Judge identity)
  action_type: string | null; // Action type string (kept as-is; no semantics in Judge)
  task_fact_id: string; // Facts ledger id for the task
  task_occurred_at: string; // Task occurred_at ISO timestamp
  task_source: string | null; // facts.source for the task (audit only)
  receipt_fact_id: string | null; // Facts ledger id for the latest receipt (if any)
  receipt_occurred_at: string | null; // Receipt occurred_at ISO timestamp
  receipt_source: string | null; // facts.source for the receipt (audit only)
  status: string | null; // Receipt status string as stored (executed/not_executed)
};

export function shouldExplainAoActReadModelV0(): boolean {
  return process.env.JUDGE_EXPLAIN_AO_ACT_READMODEL === "1"; // Opt-in via env var (never via API)
}

export async function queryAoActLatestReceiptIndexV0(
  reader: AppleIReader,
  q: AoActReadModelQueryV0
): Promise<AoActLatestReceiptIndexRowV0[]> {
  // Delegate to the reader so SQL stays out of the pipeline. // Keeps pipeline logic pure
  const rows = await reader.queryAoActIndexV0({ startTsMs: q.startTsMs, endTsMs: q.endTsMs }); // Read-only ledger query
  return rows as AoActLatestReceiptIndexRowV0[]; // Narrow to the exported row type
}

export function summarizeAoActIndexForLogV0(rows: AoActLatestReceiptIndexRowV0[]): string {
  // Keep logs small + stable to avoid accidental coupling. // Debug is not API
  const head = rows.slice(0, 3).map((r) => ({
    act_task_id: r.act_task_id, // Stable identifier
    action_type: r.action_type, // Action type string
    status: r.status, // Latest receipt status
    task_fact_id: r.task_fact_id, // Task fact id
    receipt_fact_id: r.receipt_fact_id, // Receipt fact id
  }));
  return JSON.stringify({ count: rows.length, head }); // Stable JSON for log line
}
