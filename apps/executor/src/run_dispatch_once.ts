// GEOX/apps/executor/src/run_dispatch_once.ts
import crypto from "node:crypto";
import { createAdapterRegistry, findAdapter, type AoActTask } from "./adapters";
import { claimDispatchTasks } from "./lib/claim";

type Args = {
  baseUrl: string;
  token: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  executor_id: string;
  limit: number;
  lease_seconds: number;
};

function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => {
    const idx = argv.indexOf(`--${k}`);
    if (idx === -1) return undefined;
    const v = argv[idx + 1];
    if (!v || v.startsWith("--")) return undefined;
    return v;
  };
  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3000";
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA";
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA";
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA";
  const executor_id = get("executor_id") ?? process.env.GEOX_EXECUTOR_ID ?? `dispatch_exec_${crypto.randomUUID().replace(/-/g, "")}`;
  const limit = Math.max(1, Number.parseInt(get("limit") ?? process.env.GEOX_EXECUTOR_LIMIT ?? "1", 10) || 1);
  const lease_seconds = Math.max(5, Math.min(300, Number.parseInt(get("lease_seconds") ?? process.env.GEOX_DISPATCH_LEASE_SECONDS ?? "30", 10) || 30));
  if (!token) throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)");
  return { baseUrl, token, tenant_id, project_id, group_id, executor_id, limit, lease_seconds };
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

async function hasReceiptByCommandId(args: Args, taskId: string, commandId: string): Promise<boolean> {
  const url = `${args.baseUrl}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(args.tenant_id)}&project_id=${encodeURIComponent(args.project_id)}&group_id=${encodeURIComponent(args.group_id)}&act_task_id=${encodeURIComponent(taskId)}&limit=10`;
  const out = await httpJson(url, args.token, { method: "GET" });
  const items = Array.isArray(out?.items) ? out.items : [];
  return items.some((item: any) => {
    const payload = item?.receipt?.payload ?? {};
    const hit = String(payload?.command_id ?? payload?.meta?.command_id ?? payload?.act_task_id ?? "").trim();
    return hit !== "" && hit === commandId;
  });
}

async function writeDispatchState(args: Args, task: AoActTask, state: "DISPATCHED" | "ACKED" | "SUCCEEDED" | "FAILED"): Promise<void> {
  const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/dispatches/state`, args.token, {
    method: "POST",
    body: JSON.stringify({
      tenant_id: task.tenant_id,
      project_id: task.project_id,
      group_id: task.group_id,
      act_task_id: task.act_task_id,
      command_id: task.command_id,
      state
    })
  });
  if (!out?.ok) throw new Error(`dispatch state write failed state=${state} task=${task.act_task_id}`);
}

function toAoActTask(item: any, args: Args): AoActTask {
  const taskPayload = item?.task?.payload ?? {};
  const act_task_id = String(item?.act_task_id ?? taskPayload?.act_task_id ?? "").trim();
  const command_id = String(item?.command_id ?? taskPayload?.command_id ?? act_task_id).trim();
  const action_type = String(taskPayload?.action_type ?? "").trim();
  const operation_plan_id = String(taskPayload?.operation_plan_id ?? "").trim();
  if (!act_task_id || !command_id || !action_type) throw new Error(`invalid claim item task payload: ${JSON.stringify(item)}`);
  if (!operation_plan_id) throw new Error(`missing operation_plan_id for act_task_id=${act_task_id}`);
  return {
    tenant_id: String(taskPayload?.tenant_id ?? args.tenant_id),
    project_id: String(taskPayload?.project_id ?? args.project_id),
    group_id: String(taskPayload?.group_id ?? args.group_id),
    act_task_id,
    command_id,
    action_type,
    operation_plan_id,
    parameters: (taskPayload?.parameters && typeof taskPayload.parameters === "object") ? taskPayload.parameters : {}
  };
}

function isDuplicateReceiptError(msg: string): boolean {
  const normalized = msg.toUpperCase();
  return normalized.includes("DUPLICATE_RECEIPT") || normalized.includes("RECEIPT_EXISTS");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const registry = createAdapterRegistry({ baseUrl: args.baseUrl, token: args.token });
  const localExecutedCommandIds = new Set<string>();

  console.log(`INFO: run_dispatch_once baseUrl=${args.baseUrl}`);
  console.log(`INFO: executor_id=${args.executor_id}`);

  const claimed = await claimDispatchTasks({
    baseUrl: args.baseUrl,
    token: args.token,
    tenant_id: args.tenant_id,
    project_id: args.project_id,
    group_id: args.group_id,
    executor_id: args.executor_id,
    limit: args.limit,
    lease_seconds: args.lease_seconds
  });
  console.log(`INFO: claimed queue size=${claimed.length}`);
  if (claimed.length < 1) {
    console.log("INFO: no claimed dispatch items found (no-op)");
    return;
  }

  for (const item of claimed.slice(0, args.limit)) {
    const task = toAoActTask(item, args);
    if (localExecutedCommandIds.has(task.command_id)) {
      console.log(`INFO: skip act_task_id=${task.act_task_id} command_id=${task.command_id} reason=duplicate_command_in_run`);
      continue;
    }
    if (await hasReceiptByCommandId(args, task.act_task_id, task.command_id)) {
      console.log(`INFO: skip act_task_id=${task.act_task_id} command_id=${task.command_id} reason=receipt_exists`);
      continue;
    }

    const adapter = findAdapter(registry, task.action_type);
    console.log(`INFO: dispatching act_task_id=${task.act_task_id} command_id=${task.command_id} action_type=${task.action_type} adapter_type=${adapter.adapter_type}`);
    await writeDispatchState(args, task, "DISPATCHED");
    try {
      const result = await adapter.dispatch(task);
      if (!result.success) {
        if (isDuplicateReceiptError(String(result.error ?? ""))) {
          console.log(`INFO: duplicate receipt ignored act_task_id=${task.act_task_id} command_id=${task.command_id}`);
          localExecutedCommandIds.add(task.command_id);
          await writeDispatchState(args, task, "SUCCEEDED");
          continue;
        }
        await writeDispatchState(args, task, "FAILED");
        throw new Error(`adapter dispatch failed adapter_type=${adapter.adapter_type} act_task_id=${task.act_task_id} command_id=${task.command_id}: ${result.error ?? "unknown_error"}`);
      }
      localExecutedCommandIds.add(task.command_id);
      await writeDispatchState(args, task, "ACKED");
      await writeDispatchState(args, task, "SUCCEEDED");
      const receiptFactId = result.receipt_payload && typeof result.receipt_payload === "object"
        ? String((result.receipt_payload as any).receipt_fact_id ?? "")
        : "";
      console.log(`INFO: adapter dispatch success adapter_type=${result.adapter_type} act_task_id=${task.act_task_id} command_id=${task.command_id} receipt_fact_id=${receiptFactId}`);
      console.log(`PASS: dispatch adapter completed act_task_id=${task.act_task_id} command_id=${task.command_id}`);
    } catch (error) {
      throw error;
    }
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`);
  process.exit(1);
});
