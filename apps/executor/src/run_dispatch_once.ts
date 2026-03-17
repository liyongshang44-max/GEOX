// GEOX/apps/executor/src/run_dispatch_once.ts
import crypto from "node:crypto"; // Used to mint a stable executor id + idempotency keys.

type Args = { baseUrl: string; token: string; tenant_id: string; project_id: string; group_id: string; executor_id: string; limit: number };
function nowMs(): number { return Date.now(); }
function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => { const idx = argv.indexOf(`--${k}`); if (idx === -1) return undefined; const v = argv[idx + 1]; if (!v || v.startsWith("--")) return undefined; return v; };
  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3000";
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA";
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA";
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA";
  const executor_id = get("executor_id") ?? process.env.GEOX_EXECUTOR_ID ?? `dispatch_exec_${crypto.randomUUID().replace(/-/g, "")}`;
  const limit = Math.max(1, Number.parseInt(get("limit") ?? process.env.GEOX_EXECUTOR_LIMIT ?? "1", 10) || 1);
  if (!token) throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)");
  return { baseUrl, token, tenant_id, project_id, group_id, executor_id, limit };
}
async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const text = await res.text();
  let obj: any = null;
  try { obj = text ? JSON.parse(text) : {}; } catch { obj = { _non_json: text }; }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return obj;
}
async function getDispatchQueue(args: Args): Promise<any[]> {
  const url = `${args.baseUrl}/api/v1/ao-act/dispatches?tenant_id=${encodeURIComponent(args.tenant_id)}&project_id=${encodeURIComponent(args.project_id)}&group_id=${encodeURIComponent(args.group_id)}&limit=${args.limit}`;
  const out = await httpJson(url, args.token, { method: "GET" });
  if (!out?.ok || !Array.isArray(out.items)) throw new Error(`unexpected queue response: ${JSON.stringify(out)}`);
  return out.items;
}
async function writeReceipt(args: Args, actTaskId: string, outboxFactId: string): Promise<any> {
  const end = nowMs();
  const start = end - 50;
  const idempotencyKey = `dispatch_once_${outboxFactId}`;
  const body = {
    tenant_id: args.tenant_id, project_id: args.project_id, group_id: args.group_id, task_id: actTaskId, command_id: actTaskId, act_task_id: actTaskId,
    executor_id: { kind: "script", id: args.executor_id, namespace: "executor_runtime_v1" },
    execution_time: { start_ts: start, end_ts: end }, execution_coverage: { kind: "field", ref: "simulated" },
    resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 }, logs_refs: [{ kind: "stdout", ref: `executor://dispatch_once/${outboxFactId}` }],
    status: "executed", constraint_check: { violated: false, violations: [] }, observed_parameters: {}, meta: { idempotency_key: idempotencyKey, runtime: "dispatch_once_v1", outbox_fact_id: outboxFactId }
  };
  return httpJson(`${args.baseUrl}/api/v1/ao-act/receipts`, args.token, { method: "POST", body: JSON.stringify(body) });
}
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`INFO: run_dispatch_once baseUrl=${args.baseUrl}`);
  console.log(`INFO: executor_id=${args.executor_id}`);
  const queue = await getDispatchQueue(args);
  console.log(`INFO: dispatch queue size=${queue.length}`);
  if (queue.length < 1) { console.log("INFO: no dispatch items found (no-op)"); return; }
  for (const item of queue.slice(0, args.limit)) {
    const actTaskId = String(item?.task?.payload?.act_task_id ?? "");
    const outboxFactId = String(item?.outbox_fact_id ?? "");
    if (!actTaskId || !outboxFactId) throw new Error(`invalid queue item: ${JSON.stringify(item)}`);
    console.log(`INFO: executing dispatched act_task_id=${actTaskId} outbox_fact_id=${outboxFactId}`);
    const receipt = await writeReceipt(args, actTaskId, outboxFactId);
    console.log(`INFO: wrote receipt fact_id=${receipt.fact_id} wrapper_fact_id=${receipt.wrapper_fact_id}`);
    console.log(`PASS: dispatch adapter completed act_task_id=${actTaskId}`);
  }
}
main().catch((err) => { console.error(`FAIL: ${err?.message ?? String(err)}`); process.exit(1); });
