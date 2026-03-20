import crypto from "node:crypto";
import { createAdapterRegistry, findAdapterByType, type AoActTask } from "./adapters";
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
  act_task_id?: string;
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
  const executor_id =
    get("executor_id") ??
    process.env.GEOX_EXECUTOR_ID ??
    `dispatch_exec_${crypto.randomUUID().replace(/-/g, "")}`;
  const limit = Math.max(1, Number.parseInt(get("limit") ?? process.env.GEOX_EXECUTOR_LIMIT ?? "1", 10) || 1);
  const lease_seconds = Math.max(
    5,
    Math.min(300, Number.parseInt(get("lease_seconds") ?? process.env.GEOX_DISPATCH_LEASE_SECONDS ?? "30", 10) || 30)
  );
  const act_task_id = get("act_task_id") ?? process.env.GEOX_ACT_TASK_ID ?? undefined;

  if (!token) throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)");
  return { baseUrl, token, tenant_id, project_id, group_id, executor_id, limit, lease_seconds, act_task_id };
}

async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  };
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const text = await res.text();
  let obj: any = null;
  try {
    obj = text ? JSON.parse(text) : {};
  } catch {
    obj = { _non_json: text };
  }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return obj;
}

function toAoActTask(item: any, args: Args): AoActTask {
  const taskPayload = item?.task?.payload ?? {};
  const taskMeta = taskPayload?.meta && typeof taskPayload.meta === "object" ? taskPayload.meta : {};
  const itemMeta = item?.meta && typeof item.meta === "object" ? item.meta : {};
  const act_task_id = String(item?.act_task_id ?? taskPayload?.act_task_id ?? "").trim();
  const command_id = String(item?.command_id ?? taskPayload?.command_id ?? act_task_id).trim();
  const action_type = String(taskPayload?.action_type ?? "").trim();
  const operation_plan_id = String(
    taskPayload?.operation_plan_id ??
      taskMeta?.operation_plan_id ??
      item?.operation_plan_id ??
      itemMeta?.operation_plan_id ??
      ""
  ).trim();

  if (!act_task_id || !command_id || !action_type || !operation_plan_id) {
    throw new Error(`invalid claim item payload: ${JSON.stringify(item)}`);
  }

  return {
    tenant_id: String(taskPayload?.tenant_id ?? args.tenant_id),
    project_id: String(taskPayload?.project_id ?? args.project_id),
    group_id: String(taskPayload?.group_id ?? args.group_id),
    act_task_id,
    command_id,
    action_type,
    operation_plan_id,
    adapter_type: String(taskPayload?.adapter_type ?? "").trim() || null,
    adapter_hint: String(item?.adapter_hint ?? "").trim() || null,
    parameters: taskPayload?.parameters && typeof taskPayload.parameters === "object" ? taskPayload.parameters : {},
    meta: taskMeta,
    outbox_fact_id: typeof item?.outbox_fact_id === "string" ? item.outbox_fact_id : null,
    device_id: typeof item?.device_id === "string" ? item.device_id : null,
    downlink_topic: typeof item?.downlink_topic === "string" ? item.downlink_topic : null,
    qos: Number.isFinite(Number(item?.qos)) ? Number(item.qos) : 1,
    retain: typeof item?.retain === "boolean" ? item.retain : false
  };
}

type DispatchState = "DISPATCHED" | "ACKED" | "FAILED";

async function writeDispatchState(args: Args, task: AoActTask, state: DispatchState): Promise<void> {
  console.log(`INFO: writing dispatch state act_task_id=${task.act_task_id} state=${state}`);
  try {
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
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if ((state === "ACKED" || state === "FAILED") && msg.includes("http 409") && msg.includes("STATE_TRANSITION_DENIED")) {
      console.log(`WARN: dispatch state ${state.toLowerCase()} skipped act_task_id=${task.act_task_id} reason=already_terminal`);
      return;
    }
    throw error;
  }
}

async function getReceipts(args: Args, task: AoActTask): Promise<any[]> {
  const out = await httpJson(
    `${args.baseUrl}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(task.tenant_id)}&project_id=${encodeURIComponent(task.project_id)}&group_id=${encodeURIComponent(task.group_id)}&act_task_id=${encodeURIComponent(task.act_task_id)}&limit=50`,
    args.token,
    { method: "GET" }
  );
  return Array.isArray(out?.items) ? out.items : [];
}

function hasReceiptIdempotencyKey(items: any[], taskId: string, attemptNo: number, receiptCode: string): boolean {
  const expected = `${taskId}:${attemptNo}:${receiptCode}`;
  return items.some((item) => String(item?.receipt?.payload?.meta?.idempotency_key ?? "").trim() === expected);
}

async function appendReceiptV1(
  args: Args,
  task: AoActTask,
  attemptNo: number,
  receipt_status: "ACKED" | "RUNNING" | "SUCCEEDED" | "FAILED",
  adapter_type: string,
  receipt_code?: string,
  receipt_message?: string,
  raw_receipt_ref?: string
): Promise<void> {
  const receiptCode = String(receipt_code ?? receipt_status).trim() || receipt_status;
  const idempotencyKey = `${task.act_task_id}:${attemptNo}:${receiptCode}`;
  const existing = await getReceipts(args, task);
  if (hasReceiptIdempotencyKey(existing, task.act_task_id, attemptNo, receiptCode)) {
    console.log(`INFO: dedupe receipt hit idempotency_key=${idempotencyKey}`);
    return;
  }

  const now = Date.now();
  const mappedStatus = receipt_status === "FAILED" ? "not_executed" : "executed";
  const operationPlanId = String(task.operation_plan_id ?? (task.meta as any)?.operation_plan_id ?? "").trim();
  const commandId = String(task.command_id ?? task.act_task_id).trim();

  if (!operationPlanId) throw new Error("MISSING_OPERATION_PLAN_ID");
  if (!commandId) throw new Error("MISSING_COMMAND_ID");

  try {
    const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/receipts`, args.token, {
      method: "POST",
      body: JSON.stringify({
        tenant_id: task.tenant_id,
        project_id: task.project_id,
        group_id: task.group_id,
        task_id: task.act_task_id,
        act_task_id: task.act_task_id,
        command_id: commandId,
        operation_plan_id: operationPlanId,
        executor_id: {
          kind: "script",
          id: args.executor_id,
          namespace: "executor_runtime_v1"
        },
        execution_time: { start_ts: now - 100, end_ts: now },
        execution_coverage: {
          kind: "field",
          ref: String((task.meta as any)?.field_id ?? (task.meta as any)?.target_ref ?? "executor_dispatch")
        },
        resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 },
        logs_refs: [{ kind: "stdout", ref: raw_receipt_ref ?? `executor://run_dispatch_once/${task.act_task_id}` }],
        status: mappedStatus,
        constraint_check: { violated: false, violations: [] },
        observed_parameters: {},
        meta: {
          schema: "ao_act_receipt_v1",
          task_id: task.act_task_id,
          command_id: commandId,
          operation_plan_id: operationPlanId,
          device_id: task.device_id ?? "",
          adapter_type,
          attempt_no: attemptNo,
          receipt_status,
          receipt_code: receiptCode,
          receipt_message: receipt_message ?? null,
          raw_receipt_ref: raw_receipt_ref ?? null,
          received_ts: now,
          idempotency_key: idempotencyKey
        }
      })
    });
    if (!out?.ok) throw new Error(`append receipt failed: ${JSON.stringify(out)}`);
  } catch (error: any) {
    const msg = String(error?.message ?? error);

    if (msg.includes("TASK_ALREADY_HAS_RECEIPT")) {
      console.log(`WARN: receipt append skipped act_task_id=${task.act_task_id} reason=already_has_receipt`);
      return;
    }

    if (msg.includes("http 409") && msg.includes("DUPLICATE_RECEIPT")) {
      console.log(`WARN: receipt append dedupe act_task_id=${task.act_task_id} idempotency_key=${idempotencyKey}`);
      return;
    }

    throw error;
  }
}

export async function runDispatchOnce(cliArgs?: string[]): Promise<void> {
  const args = parseArgs(cliArgs ?? process.argv.slice(2));
  const registry = createAdapterRegistry({ baseUrl: args.baseUrl, token: args.token, executor_id: args.executor_id });

  const claimed = await claimDispatchTasks({
    baseUrl: args.baseUrl,
    token: args.token,
    tenant_id: args.tenant_id,
    project_id: args.project_id,
    group_id: args.group_id,
    executor_id: args.executor_id,
    limit: args.limit,
    lease_seconds: args.lease_seconds,
    ...(args.act_task_id ? { act_task_id: args.act_task_id } : {})
  });

  console.log(`INFO: claimed queue size=${claimed.length}`);
  if (claimed.length < 1) {
    console.log("INFO: no claimed dispatch items found (no-op)");
    return;
  }

  for (const item of claimed.slice(0, args.limit)) {
    const task = toAoActTask(item, args);
    const adapterType = String(task.adapter_type ?? task.adapter_hint ?? "").trim().toLowerCase();
    const adapter = findAdapterByType(registry, adapterType);

    if (typeof adapter.supports === "function" && !adapter.supports(task.action_type)) {
      throw new Error(`ADAPTER_UNSUPPORTED_ACTION:${adapterType}:${task.action_type}`);
    }
    if (typeof adapter.validate === "function") {
      const validation = adapter.validate(task);
      if (!validation.ok) throw new Error(`ADAPTER_VALIDATE_FAILED:${adapterType}:${validation.reason}`);
    }

    const attemptNo = Math.max(1, Number(item?.attempt_no ?? item?.attempt_count ?? 1));
    console.log(`INFO: claimed task act_task_id=${task.act_task_id} attempt_no=${attemptNo}`);

    try {
      await writeDispatchState(args, task, "DISPATCHED");
      const execTask: AoActTask = {
        ...task,
        runtime: {
          executor_id: args.executor_id,
          lease_token: String(item?.lease_token ?? "") || undefined,
          lease_until_ts: item?.lease_until_ts ? Number(item.lease_until_ts) : undefined,
          attempt_no: attemptNo
        }
      };
      const execution = await adapter.execute(execTask);
      const adapterTypeNormalized = String((adapter as any).type ?? (adapter as any).adapter_type ?? adapterType).trim() || adapterType;
      const execMeta = execution?.meta ?? {};
      const receiptStatus = String(execMeta?.receipt_status ?? (execution.status === "FAILED" ? "FAILED" : "ACKED")).toUpperCase();
      console.log(
        `INFO: adapter dispatch result act_task_id=${task.act_task_id} command_id=${task.command_id} receipt_status=${receiptStatus}`
      );

      if (execution.status === "FAILED" || receiptStatus === "FAILED") {
        await appendReceiptV1(
          args,
          task,
          attemptNo,
          "FAILED",
          adapterTypeNormalized,
          String(execMeta?.receipt_code ?? execMeta?.reason ?? "DISPATCH_FAILED"),
          typeof execMeta?.receipt_message === "string" ? execMeta.receipt_message : undefined
        );
        await writeDispatchState(args, task, "FAILED");
        console.log(`PASS: dispatch failed act_task_id=${task.act_task_id} attempt_no=${attemptNo}`);
        continue;
      }

      await writeDispatchState(args, task, "ACKED");
      console.log(`PASS: dispatch acked act_task_id=${task.act_task_id} attempt_no=${attemptNo}`);
    } catch (error: any) {
      await appendReceiptV1(args, task, attemptNo, "FAILED", adapterType, "DISPATCH_ERROR", String(error?.message ?? error));
      await writeDispatchState(args, task, "FAILED");
      throw error;
    }
  }
}

async function main(): Promise<void> {
  await runDispatchOnce(process.argv.slice(2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`FAIL: ${err?.message ?? String(err)}`);
    process.exit(1);
  });
}
