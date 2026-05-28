const crypto = require("node:crypto");
const os = require("node:os");
const { runDispatchOnce } = require("./run_dispatch_once.js");
const {
  createHeartbeatPool,
  recordWorkerRuntimeError,
  recordWorkerRuntimeHeartbeat,
  recordWorkerRuntimeStarted,
  resolveWorkerId,
  truncateWorkerError,
} = require("./lib/worker_runtime_heartbeat.js");

const DEFAULT_POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 2000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
const MIN_HEARTBEAT_INTERVAL_MS = 5000;

type ExecutorRuntimeContext = {
  baseUrl: string;
  token: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  executor_id: string;
};

type ExecutorWorkerHeartbeatContext = {
  worker_id: string;
  runtime_instance_id: string;
  poll_interval_ms: number;
  heartbeat_interval_ms: number;
};

function parsePollIntervalMs(argv: string[]): number {
  const idx = argv.indexOf("--poll_interval_ms");
  const fromArg = idx >= 0 ? argv[idx + 1] : undefined;
  const raw = fromArg ?? process.env.POLL_INTERVAL_MS ?? `${DEFAULT_POLL_INTERVAL_MS}`;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.max(MIN_POLL_INTERVAL_MS, parsed);
}

function parseHeartbeatIntervalMs(argv: string[]): number {
  const idx = argv.indexOf("--heartbeat_interval_ms");
  const fromArg = idx >= 0 ? argv[idx + 1] : undefined;
  const raw = fromArg ?? process.env.HEARTBEAT_INTERVAL_MS ?? `${DEFAULT_HEARTBEAT_INTERVAL_MS}`;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HEARTBEAT_INTERVAL_MS;
  return Math.max(MIN_HEARTBEAT_INTERVAL_MS, parsed);
}

function stripPollArg(argv: string[]): string[] {
  const next: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--poll_interval_ms" || item === "--heartbeat_interval_ms") {
      i += 1;
      continue;
    }
    next.push(item);
  }
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseExecutorContext(cliArgs: string[]): ExecutorRuntimeContext {
  const get = (k: string): string | undefined => {
    const idx = cliArgs.indexOf(`--${k}`);
    if (idx === -1) return undefined;
    const v = cliArgs[idx + 1];
    if (!v || v.startsWith("--")) return undefined;
    return v;
  };
  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA";
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA";
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA";
  const executor_id = get("executor_id") ?? process.env.GEOX_EXECUTOR_ID ?? "dispatch_executor";
  return { baseUrl, token, tenant_id, project_id, group_id, executor_id };
}

function buildExecutorHeartbeatMetadata(ctx: ExecutorWorkerHeartbeatContext) {
  return {
    poll_interval_ms: ctx.poll_interval_ms,
    interval_ms: ctx.heartbeat_interval_ms,
    runtime_env: process.env.GEOX_RUNTIME_ENV ?? null,
    system_profile: process.env.GEOX_SYSTEM_PROFILE ?? null,
    container_hint: process.env.HOSTNAME ?? os.hostname(),
    build_mode: "node-dist",
  };
}

async function safeRecordExecutorHeartbeat(pool: any, ctx: ExecutorWorkerHeartbeatContext, status: "STARTED" | "RUNNING" | "OK" | "ERROR", lastTickStatus: "IDLE" | "NO_TASK" | "CLAIMED_TASK" | "OK" | "ERROR", error?: unknown): Promise<void> {
  try {
    if (status === "STARTED") {
      await recordWorkerRuntimeStarted(pool, {
        worker_type: "executor",
        worker_id: ctx.worker_id,
        runtime_instance_id: ctx.runtime_instance_id,
        status,
        last_tick_status: lastTickStatus,
        last_error: error ? truncateWorkerError(error) : null,
        metadata_json: buildExecutorHeartbeatMetadata(ctx),
      });
      return;
    }
    if (status === "ERROR") {
      await recordWorkerRuntimeError(pool, {
        worker_type: "executor",
        worker_id: ctx.worker_id,
        runtime_instance_id: ctx.runtime_instance_id,
        last_tick_status: "ERROR",
        metadata_json: buildExecutorHeartbeatMetadata(ctx),
        error,
      });
      return;
    }
    await recordWorkerRuntimeHeartbeat(pool, {
      worker_type: "executor",
      worker_id: ctx.worker_id,
      runtime_instance_id: ctx.runtime_instance_id,
      status,
      last_tick_status: lastTickStatus,
      last_error: null,
      metadata_json: buildExecutorHeartbeatMetadata(ctx),
    });
  } catch (heartbeatError: any) {
    console.error(`WORKER_HEARTBEAT_WRITE_FAILED worker_type=executor worker_id=${ctx.worker_id} error=${String(heartbeatError?.message ?? heartbeatError)}`);
  }
}

async function heartbeatOnce(ctx: ExecutorRuntimeContext): Promise<void> {
  if (!ctx.token) return;
  const url = `${ctx.baseUrl}/api/v1/devices/${encodeURIComponent(ctx.executor_id)}/heartbeat`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.token}`
      },
      body: JSON.stringify({
        tenant_id: ctx.tenant_id,
        project_id: ctx.project_id,
        group_id: ctx.group_id,
        status: "ONLINE",
        meta: { source: "executor_runtime_loop" }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`WARN: executor heartbeat failed status=${res.status} body=${text}`);
      return;
    }

    console.log(`HEARTBEAT_TRACE executor_id=${ctx.executor_id} tenant_id=${ctx.tenant_id}`);
  } catch (error: any) {
    console.log(`WARN: executor heartbeat error message=${error?.message ?? String(error)}`);
  }
}

async function runRuntimeLoop(cliArgs?: string[]): Promise<void> {
  const argv = cliArgs ?? process.argv.slice(2);
  const pollIntervalMs = parsePollIntervalMs(argv);
  const heartbeatIntervalMs = parseHeartbeatIntervalMs(argv);
  const forwardArgs = stripPollArg(argv);
  const heartbeatCtx = parseExecutorContext(argv);
  const workerHeartbeatPool = createHeartbeatPool();
  const workerHeartbeatCtx: ExecutorWorkerHeartbeatContext = {
    worker_id: resolveWorkerId("geox-v1-executor"),
    runtime_instance_id: crypto.randomUUID(),
    poll_interval_ms: pollIntervalMs,
    heartbeat_interval_ms: heartbeatIntervalMs,
  };

  console.log(`INFO: executor runtime loop started poll_interval_ms=${pollIntervalMs} heartbeat_interval_ms=${heartbeatIntervalMs}`);
  await safeRecordExecutorHeartbeat(workerHeartbeatPool, workerHeartbeatCtx, "STARTED", "IDLE");

  let lastHeartbeatAtMs = 0;
  while (true) {
    const nowMs = Date.now();
    if (nowMs - lastHeartbeatAtMs >= heartbeatIntervalMs) {
      await heartbeatOnce(heartbeatCtx);
      lastHeartbeatAtMs = Date.now();
    }

    try {
      await safeRecordExecutorHeartbeat(workerHeartbeatPool, workerHeartbeatCtx, "RUNNING", "IDLE");
      await runDispatchOnce(forwardArgs);
      await safeRecordExecutorHeartbeat(workerHeartbeatPool, workerHeartbeatCtx, "OK", "OK");
    } catch (error: any) {
      await safeRecordExecutorHeartbeat(workerHeartbeatPool, workerHeartbeatCtx, "ERROR", "ERROR", error);
      console.error(`ERROR: runtime loop iteration failed: ${error?.stack ?? error?.message ?? String(error)}`);
    }

    await sleep(pollIntervalMs);
  }
}

if (require.main === module) {
  runRuntimeLoop().catch((error: any) => {
    console.error(`FATAL: runtime loop crashed unexpectedly: ${error?.stack ?? error?.message ?? String(error)}`);
    process.exit(1);
  });
}

module.exports = { runRuntimeLoop };
