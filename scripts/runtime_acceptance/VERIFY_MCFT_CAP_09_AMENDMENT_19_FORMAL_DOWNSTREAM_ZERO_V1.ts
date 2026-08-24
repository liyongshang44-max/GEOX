import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const FORMAL_DATABASE = "geox_mcft_cap09_s6_formal_t4r1_24h_v4";
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_FORMAL_DOWNSTREAM_ZERO_RESULT_V1.json");

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_FORMAL_DOWNSTREAM_ZERO_ENV_REQUIRED:${name}`);
  return value;
}

function assertSubject(value: string): string {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("AM19_FORMAL_DOWNSTREAM_ZERO_SUBJECT_INVALID");
  return value;
}

function assertFormalUrl(value: string): void {
  const u = new URL(value);
  if (!["postgres:", "postgresql:"].includes(u.protocol) || ["localhost", "127.0.0.1", "::1"].includes(u.hostname)) {
    throw new Error("AM19_FORMAL_DOWNSTREAM_ZERO_REMOTE_POSTGRES_REQUIRED");
  }
  if (decodeURIComponent(u.pathname.replace(/^\//, "")) !== FORMAL_DATABASE) {
    throw new Error("AM19_FORMAL_DOWNSTREAM_ZERO_EXACT_T4_DATABASE_REQUIRED");
  }
}

function write(value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

function selftest(): void {
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_amendment19_formal_downstream_zero_selftest_v1",
    status: "PASS",
    formal_database_name: FORMAL_DATABASE,
    predicates: ["decision_records", "approved_plans", "action_feedback_rows", "downstream_named_facts"],
    read_only: true,
    formal_effect: false,
  }));
}

async function run(): Promise<void> {
  const subject = assertSubject(requiredEnv("MCFT_CAP09_SUBJECT_SHA"));
  const databaseUrl = requiredEnv("DATABASE_URL");
  assertFormalUrl(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-am19-t4r1-formal-downstream-zero" });
  try {
    const identity = String((await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "");
    if (identity !== FORMAL_DATABASE) throw new Error("AM19_FORMAL_DOWNSTREAM_ZERO_SESSION_DATABASE_MISMATCH");
    const row = (await pool.query(`SELECT
      (SELECT count(*)::int FROM twin_decision_record_projection_v1) AS decision_records,
      (SELECT count(*)::int FROM twin_approved_plan_binding_projection_v1) AS approved_plans,
      ((SELECT count(*)::int FROM twin_action_feedback_projection_v1)
       +(SELECT count(*)::int FROM twin_action_feedback_evidence_index_v1)
       +(SELECT count(*)::int FROM twin_action_feedback_cycle_projection_v1)) AS action_feedback_rows,
      (SELECT count(*)::int FROM facts WHERE lower(record_json->>'type') ~ '(decision|recommend|approval|action|dispatch|model_activation)') AS downstream_named_facts`)).rows[0] ?? {};
    const counts = {
      decision_records: Number(row.decision_records ?? -1),
      approved_plans: Number(row.approved_plans ?? -1),
      action_feedback_rows: Number(row.action_feedback_rows ?? -1),
      downstream_named_facts: Number(row.downstream_named_facts ?? -1),
    };
    if (Object.values(counts).some((value) => value !== 0)) {
      throw new Error(`AM19_FORMAL_DOWNSTREAM_SIDE_EFFECT_DETECTED:${JSON.stringify(counts)}`);
    }
    write({
      schema_version: "geox_mcft_cap09_amendment19_formal_downstream_zero_result_v1",
      status: "PASS",
      subject_sha: subject,
      formal_database_name: FORMAL_DATABASE,
      ...counts,
      database_write_count: 0,
      scheduler_write_count: 0,
      runtime_write_count: 0,
      downstream_zero_pass: true,
      mcft_cap09_completed: false,
    });
  } finally {
    await pool.end();
  }
}

const mode = process.argv[2];
if (mode === "selftest") selftest();
else if (mode === "run") run().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
else throw new Error("AM19_FORMAL_DOWNSTREAM_ZERO_MODE_REQUIRED:selftest|run");
