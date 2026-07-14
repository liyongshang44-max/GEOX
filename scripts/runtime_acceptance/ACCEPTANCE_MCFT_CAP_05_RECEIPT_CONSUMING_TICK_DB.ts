// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts
// Purpose: prove the production S7 PostgreSQL source reads canonical H objects through projection-to-fact readback, selects the eligible current-window event, and excludes pending/late feedback without writing support or canonical state.
// Boundary: destructive isolated-database acceptance only; no production database, State tick commit, Forecast, Scenario, route, scheduler, approval, dispatch, Recommendation, AO-ACT, calibration or activation authority.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresActionFeedbackTickSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { selectCap05ActionFeedbackForTickV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";

if (process.env.MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s7|receipt|tick|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const pool = new Pool({ connectionString: databaseUrl });
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function run(executable: string, args: string[], env: NodeJS.ProcessEnv): string {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return String(result.stdout ?? "");
}

function receiptFixtureV1(): Cap05ExecutionReceiptEvidenceV1 {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, "execution_receipts.jsonl"), "utf8").trim()) as Cap05ExecutionReceiptEvidenceV1;
}

async function countsV1(): Promise<{ facts: number; projections: number }> {
  const facts = await pool.query("SELECT count(*)::int AS count FROM facts");
  const projections = await pool.query("SELECT count(*)::int AS count FROM twin_action_feedback_projection_v1");
  return { facts: facts.rows[0].count, projections: projections.rows[0].count };
}

async function main(): Promise<void> {
  const predecessor = run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
    "-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts",
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: "1",
  });
  assert.ok(predecessor.includes("15 PASS / 0 FAIL"), "S6_CANONICAL_H_PREDECESSOR_REQUIRED");
  ok("S6 predecessor creates the standard, pending-validation and late canonical H objects");

  const receipt = receiptFixtureV1();
  const scope = {
    tenant_id: receipt.tenant_id,
    project_id: receipt.project_id,
    group_id: receipt.group_id,
    field_id: receipt.field_id,
    season_id: receipt.season_id,
    zone_id: receipt.zone_id,
  };
  const before = await countsV1();
  const source = new PostgresActionFeedbackTickSourceV1(pool);
  const candidates = await source.loadActionFeedbackCandidates({ scope, logical_time: "2026-06-04T02:00:00.000Z" });
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((feedback) => feedback.object_type === "twin_action_feedback_v1"));
  ok("PostgreSQL source reconstructs three exact canonical H objects through projection-to-fact readback");

  const selection = selectCap05ActionFeedbackForTickV1({
    scope,
    logical_time: "2026-06-04T02:00:00.000Z",
    feedback_objects: candidates,
  });
  assert.ok(selection.candidate);
  assert.equal(selection.candidate.executed_amount_mm, "13.600000");
  assert.equal(selection.candidate.coverage_fraction, "0.910000");
  assert.equal(selection.trace.selected_action_feedback_refs.length, 1);
  ok("02:00 selector chooses the eligible current-window H and preserves raw amount and coverage");

  const dispositions = new Set(selection.trace.entries.map((entry) => entry.disposition));
  assert.ok(dispositions.has("SELECTED"));
  assert.ok(dispositions.has("EXCLUDED_INELIGIBLE"));
  assert.ok(dispositions.has("EXCLUDED_LATE"));
  ok("pending-validation and late H remain canonical and traceable but are excluded from State input");

  const after = await countsV1();
  assert.deepEqual(after, before);
  ok("PostgreSQL Action Feedback source and selector perform zero canonical or projection writes");

  const wrongScope = await source.loadActionFeedbackCandidates({
    scope: { ...scope, zone_id: `${scope.zone_id}_wrong` },
    logical_time: "2026-06-04T02:00:00.000Z",
  });
  assert.equal(wrongScope.length, 0);
  ok("PostgreSQL source enforces exact Reality scope");

  assert.equal(pass, 5);
  console.log(`MCFT-CAP-05 receipt-consuming tick PostgreSQL source: ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());
