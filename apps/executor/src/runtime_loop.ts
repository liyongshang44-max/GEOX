const { runDispatchOnce } = require("./run_dispatch_once.ts");

const DEFAULT_POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 2000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
const MIN_HEARTBEAT_INTERVAL_MS = 5000;

function parsePollIntervalMs(argv) {
  const idx = argv.indexOf("--poll_interval_ms");
  const fromArg = idx >= 0 ? argv[idx + 1] : undefined;
  const raw = fromArg ?? process.env.POLL_INTERVAL_MS ?? `${DEFAULT_POLL_INTERVAL_MS}`;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.max(MIN_POLL_INTERVAL_MS, parsed);
}

function parseHeartbeatIntervalMs(argv) {
  const idx = argv.indexOf("--heartbeat_interval_ms");
  const fromArg = idx >= 0 ? argv[idx + 1] : undefined;
  const raw = fromArg ?? process.env.HEARTBEAT_INTERVAL_MS ?? `${DEFAULT_HEARTBEAT_INTERVAL_MS}`;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HEARTBEAT_INTERVAL_MS;
  return Math.max(MIN_HEARTBEAT_INTERVAL_MS, parsed);
}

function stripPollArg(argv) {
  const next = [];
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseExecutorContext(cliArgs) {
  const get = (k) => {
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

async function heartbeatOnce(ctx) {
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
  } catch (error) {
    console.log(`WARN: executor heartbeat error message=${error?.message ?? String(error)}`);
  }
}

async function runRuntimeLoop(cliArgs) {
  const argv = cliArgs ?? process.argv.slice(2);
  const pollIntervalMs = parsePollIntervalMs(argv);
  const heartbeatIntervalMs = parseHeartbeatIntervalMs(argv);
  const forwardArgs = stripPollArg(argv);
  const heartbeatCtx = parseExecutorContext(argv);

  console.log(`INFO: executor runtime loop started poll_interval_ms=${pollIntervalMs} heartbeat_interval_ms=${heartbeatIntervalMs}`);

  let lastHeartbeatAtMs = 0;
  while (true) {
    const nowMs = Date.now();
    if (nowMs - lastHeartbeatAtMs >= heartbeatIntervalMs) {
      await heartbeatOnce(heartbeatCtx);
      lastHeartbeatAtMs = Date.now();
    }

    try {
      await runDispatchOnce(forwardArgs);
    } catch (error) {
      console.error(`ERROR: runtime loop iteration failed: ${error?.stack ?? error?.message ?? String(error)}`);
    }

    await sleep(pollIntervalMs);
  }
}

if (require.main === module) {
  runRuntimeLoop().catch((error) => {
    console.error(`FATAL: runtime loop crashed unexpectedly: ${error?.stack ?? error?.message ?? String(error)}`);
    process.exit(1);
  });
}

module.exports = { runRuntimeLoop };