import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { fetchPendingJobs, markJobFailed, runQueuedEvidenceExportJob } from "../routes/delivery_evidence_export_v1.js";
import { fetchPendingEvidenceReportJobs, markEvidenceReportJobFailed, runQueuedEvidenceReportJob } from "../routes/evidence_report_v1.js";
import {
  recordWorkerRuntimeErrorV1,
  recordWorkerRuntimeHeartbeatV1,
  recordWorkerRuntimeStartedV1,
  resolveWorkerIdV1,
  truncateWorkerErrorV1,
} from "../runtime/worker_runtime_heartbeat_v1.js";
import { runAgronomyAgentOnce } from "./agronomy_agent.js";

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

type JobsRuntimeHeartbeatContext = {
  worker_id: string;
  runtime_instance_id: string;
  interval_ms: number;
};

function buildJobsHeartbeatMetadata(ctx: JobsRuntimeHeartbeatContext) {
  return {
    interval_ms: ctx.interval_ms,
    runtime_env: process.env.GEOX_RUNTIME_ENV ?? null,
    system_profile: process.env.GEOX_SYSTEM_PROFILE ?? null,
    container_hint: process.env.HOSTNAME ?? os.hostname(),
    build_mode: "node-dist",
  };
}

async function safeRecordJobsHeartbeat(pool: Pool, ctx: JobsRuntimeHeartbeatContext, status: "STARTED" | "RUNNING" | "OK" | "ERROR", lastTickStatus: "IDLE" | "AGENT_SCANNED" | "OK" | "ERROR", error?: unknown): Promise<void> {
  try {
    if (status === "STARTED") {
      await recordWorkerRuntimeStartedV1(pool, {
        worker_type: "jobs",
        worker_id: ctx.worker_id,
        runtime_instance_id: ctx.runtime_instance_id,
        status,
        last_tick_status: lastTickStatus,
        last_error: error ? truncateWorkerErrorV1(error) : null,
        metadata_json: buildJobsHeartbeatMetadata(ctx),
      });
      return;
    }
    if (status === "ERROR") {
      await recordWorkerRuntimeErrorV1(pool, {
        worker_type: "jobs",
        worker_id: ctx.worker_id,
        runtime_instance_id: ctx.runtime_instance_id,
        last_tick_status: "ERROR",
        metadata_json: buildJobsHeartbeatMetadata(ctx),
        error,
      });
      return;
    }
    await recordWorkerRuntimeHeartbeatV1(pool, {
      worker_type: "jobs",
      worker_id: ctx.worker_id,
      runtime_instance_id: ctx.runtime_instance_id,
      status,
      last_tick_status: lastTickStatus,
      last_error: null,
      metadata_json: buildJobsHeartbeatMetadata(ctx),
    });
  } catch (heartbeatError: any) {
    console.error(`WORKER_HEARTBEAT_WRITE_FAILED worker_type=jobs worker_id=${ctx.worker_id} error=${String(heartbeatError?.message ?? heartbeatError)}`);
  }
}

async function runOnce(pool: Pool): Promise<"OK" | "AGENT_SCANNED"> {
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

  let agentScanned = false;
  if (process.env.AGRONOMY_AGENT_ENABLED === "1") {
    const result = await runAgronomyAgentOnce(pool);
    agentScanned = true;
    console.log(
      `INFO: agronomy-agent result scanned=${result.scanned} created=${result.created} skipped=${result.skipped} ` +
      `skipped:no_program=${result.skipped_by_reason.no_program} skipped:no_crop_code=${result.skipped_by_reason.no_crop_code} ` +
      `skipped:no_telemetry=${result.skipped_by_reason.no_telemetry} skipped:duplicate=${result.skipped_by_reason.duplicate}`
    );
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
  return agentScanned ? "AGENT_SCANNED" : "OK";
}

export async function runJobsRuntime(): Promise<void> {
  const intervalMs = parseIntervalMs();
  const pool = createPool();
  const heartbeatCtx: JobsRuntimeHeartbeatContext = {
    worker_id: resolveWorkerIdV1("geox-v1-jobs"),
    runtime_instance_id: crypto.randomUUID(),
    interval_ms: intervalMs,
  };
  console.log(`INFO: jobs runtime started interval_ms=${intervalMs}`);
  console.log(`INFO: agronomy agent enabled=${process.env.AGRONOMY_AGENT_ENABLED === "1" ? "1" : "0"}`);
  await safeRecordJobsHeartbeat(pool, heartbeatCtx, "STARTED", "IDLE");

  while (true) {
    try {
      await safeRecordJobsHeartbeat(pool, heartbeatCtx, "RUNNING", "IDLE");
      const tickStatus = await runOnce(pool);
      await safeRecordJobsHeartbeat(pool, heartbeatCtx, "OK", tickStatus);
    } catch (error: any) {
      await safeRecordJobsHeartbeat(pool, heartbeatCtx, "ERROR", "ERROR", error);
      console.error(`ERROR: jobs runtime tick failed: ${error?.stack ?? error?.message ?? String(error)}`);
    }
    await sleep(intervalMs);
  }
}

function isMainModule(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  return import.meta.url === pathToFileURL(path.resolve(argv1)).href;
}

if (isMainModule()) {
  runJobsRuntime().catch((error) => {
    console.error(`FATAL: jobs runtime crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exit(1);
  });
}
