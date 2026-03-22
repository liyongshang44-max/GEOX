import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_INTERVAL_MS = 5000;

function parseIntervalMs(): number {
  const raw = process.env.GEOX_JOBS_INTERVAL_MS ?? `${DEFAULT_INTERVAL_MS}`;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_INTERVAL_MS;
  return parsed;
}

async function runOnce(): Promise<void> {
  // Commercial v1 baseline keeps all runtime jobs in a dedicated process.
  // Add concrete scheduled jobs here (export compaction / timeout sweeps / notification dispatch, etc.)
  console.log(`JOBS_TRACE tick_ts=${Date.now()}`);
}

export async function runJobsRuntime(): Promise<void> {
  const intervalMs = parseIntervalMs();
  console.log(`INFO: jobs runtime started interval_ms=${intervalMs}`);

  while (true) {
    try {
      await runOnce();
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
