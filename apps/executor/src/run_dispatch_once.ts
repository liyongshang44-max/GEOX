// GEOX/apps/executor/src/run_dispatch_once.ts
import crypto from "node:crypto"; // Used to mint a stable executor id + idempotency keys.
import { createAdapterRegistry, findAdapter, type AoActTask } from "./adapters";

type Args = { baseUrl: string; token: string; tenant_id: string; project_id: string; group_id: string; executor_id: string; limit: number };
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

function toAoActTask(item: any, args: Args): AoActTask {
  const taskPayload = item?.task?.payload ?? {};
  const act_task_id = String(taskPayload?.act_task_id ?? item?.task_id ?? "").trim();
  const action_type = String(taskPayload?.action_type ?? "").trim();
  if (!act_task_id || !action_type) throw new Error(`invalid queue item task payload: ${JSON.stringify(item)}`);
  return {
    tenant_id: String(taskPayload?.tenant_id ?? args.tenant_id),
    project_id: String(taskPayload?.project_id ?? args.project_id),
    group_id: String(taskPayload?.group_id ?? args.group_id),
    act_task_id,
    action_type,
    parameters: (taskPayload?.parameters && typeof taskPayload.parameters === "object") ? taskPayload.parameters : {}
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const registry = createAdapterRegistry({ baseUrl: args.baseUrl, token: args.token });

  console.log(`INFO: run_dispatch_once baseUrl=${args.baseUrl}`);
  console.log(`INFO: executor_id=${args.executor_id}`);
  const queue = await getDispatchQueue(args);
  console.log(`INFO: dispatch queue size=${queue.length}`);
  if (queue.length < 1) { console.log("INFO: no dispatch items found (no-op)"); return; }

  for (const item of queue.slice(0, args.limit)) {
    const task = toAoActTask(item, args);
    const adapter = findAdapter(registry, task.action_type);
    if (!adapter) throw new Error(`no adapter for action_type=${task.action_type} act_task_id=${task.act_task_id}`);

    console.log(`INFO: dispatching act_task_id=${task.act_task_id} action_type=${task.action_type} adapter_type=${adapter.adapter_type}`);
    const result = await adapter.dispatch(task);
    if (!result.ok) throw new Error(`adapter dispatch failed adapter_type=${adapter.adapter_type} act_task_id=${task.act_task_id}: ${result.error ?? "unknown"}`);

    console.log(`INFO: adapter dispatch success adapter_type=${result.adapter_type} act_task_id=${task.act_task_id} receipt_fact_id=${result.receipt_fact_id ?? "n/a"}`);
    console.log(`PASS: dispatch adapter completed act_task_id=${task.act_task_id}`);
  }
}
main().catch((err) => { console.error(`FAIL: ${err?.message ?? String(err)}`); process.exit(1); });
