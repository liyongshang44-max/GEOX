import { setTimeout as sleep } from "node:timers/promises";
import { Pool } from "pg";
import { fetchPendingJobs, markJobFailed, runQueuedEvidenceExportJob } from "../routes/delivery_evidence_export_v1";
import { fetchPendingEvidenceReportJobs, markEvidenceReportJobFailed, runQueuedEvidenceReportJob } from "../routes/evidence_report_v1";

const DEFAULT_INTERVAL_MS = 5000;

function parseIntervalMs(): number {
  const raw = process.env.GEOX_JOBS_INTERVAL_MS ?? `${DEFAULT_INTERVAL_MS}`;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_INTERVAL_MS;
  return parsed;
}

function createPool(): Pool {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL for jobs runtime");
  }
  return new Pool({ connectionString: databaseUrl });
}

async function runOnce(pool: Pool): Promise<void> {
  const tickTs = Date.now();
  console.log(`JOBS_TRACE tick_ts=${tickTs}`);

  const jobs = fetchPendingJobs();
  for (const job of jobs) {
    try {
      console.log(`RUN_JOB job_id=${job.job_id}`);
      await runQueuedEvidenceExportJob(pool, job);
    } catch (error: any) {
      markJobFailed(job, error);
      console.error(`RUN_JOB_FAILED job_id=${job.job_id} error=${String(error?.message ?? error)}`);
    }
  }

  const reportJobs = await fetchPendingEvidenceReportJobs(pool);
  for (const job of reportJobs) {
    try {
      console.log(`RUN_EVIDENCE_REPORT_JOB job_id=${job.job_id}`);
      await runQueuedEvidenceReportJob(pool, job);
    } catch (error: any) {
      await markEvidenceReportJobFailed(pool, job, error);
      console.error(`RUN_EVIDENCE_REPORT_JOB_FAILED job_id=${job.job_id} error=${String(error?.message ?? error)}`);
    }
  }
}

export async function runJobsRuntime(): Promise<void> {
  const intervalMs = parseIntervalMs();
  const pool = createPool();
  console.log(`INFO: jobs runtime started interval_ms=${intervalMs}`);

  while (true) {
    try {
      await runOnce(pool);
    } catch (error: any) {
      console.error(`ERROR: jobs runtime tick failed: ${error?.stack ?? error?.message ?? String(error)}`);
    }
    await sleep(intervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runJobsRuntime().catch((error) => {
    console.error(`FATAL: jobs runtime crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exit(1);
  });
}
