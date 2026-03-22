export type ClaimArgs = {
  baseUrl: string;
  token: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  executor_id: string;
  limit: number;
  lease_seconds?: number;
  adapter_hint?: string;
  act_task_id?: string;
};

type DispatchQueueState = "CREATED" | "READY" | "DISPATCHED" | "ACKED" | "SUCCEEDED" | "FAILED";

type ClaimItem = {
  act_task_id?: string;
  command_id?: string;
  state?: DispatchQueueState | string;
  lease_until_ts?: number | null;
  task?: { payload?: { act_task_id?: string; command_id?: string } };
};

const HEARTBEAT_TASK_TTL_MS = 10 * 60 * 1000;
const localLeaseByTask = new Map<string, number>();
const terminalStateByTask = new Map<string, DispatchQueueState>();

function isTerminalState(state: string): boolean {
  return state === "SUCCEEDED" || state === "FAILED";
}

function parseClaimTaskId(item: ClaimItem): string {
  return String(item?.act_task_id ?? item?.task?.payload?.act_task_id ?? "").trim();
}

function parseClaimCommandId(item: ClaimItem, taskId: string): string {
  return String(item?.command_id ?? item?.task?.payload?.command_id ?? taskId).trim() || taskId;
}

function parseLeaseUntilTs(item: ClaimItem): number {
  const n = Number(item?.lease_until_ts ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sweepExpiredLocalLeases(nowMs: number): void {
  for (const [taskId, leaseUntil] of localLeaseByTask.entries()) {
    if (leaseUntil > nowMs) continue;
    localLeaseByTask.delete(taskId);
    console.log(`LEASE_RECOVER task_id=${taskId} expired_at=${leaseUntil}`);
  }

  for (const [taskId, state] of terminalStateByTask.entries()) {
    const leaseUntil = localLeaseByTask.get(taskId) ?? 0;
    if (leaseUntil > nowMs - HEARTBEAT_TASK_TTL_MS) continue;
    terminalStateByTask.delete(taskId);
    if (state) {
      console.log(`TERMINAL_CACHE_EVICT task_id=${taskId} state=${state}`);
    }
  }
}

async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _non_json: text }; }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return json;
}

export async function claimDispatchTasks(args: ClaimArgs): Promise<any[]> {
  const limit = Math.max(1, Number.parseInt(String(args.limit ?? 1), 10) || 1);
  const requestedTaskId = String(args.act_task_id ?? "").trim();
  const nowMs = Date.now();
  sweepExpiredLocalLeases(nowMs);

  const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/dispatches/claim`, args.token, {
    method: "POST",
    body: JSON.stringify({
      tenant_id: args.tenant_id,
      project_id: args.project_id,
      group_id: args.group_id,
      executor_id: args.executor_id,
      limit,
      lease_seconds: Math.max(5, Number.parseInt(String(args.lease_seconds ?? 30), 10) || 30),
      ...(args.adapter_hint ? { adapter_hint: args.adapter_hint } : {}),
      ...(requestedTaskId ? { act_task_id: requestedTaskId } : {})
    })
  });

  if (!out?.ok || !Array.isArray(out.items)) {
    throw new Error(`unexpected claim response: ${JSON.stringify(out)}`);
  }

  const byTask = new Map<string, any>();
  for (const item of out.items as ClaimItem[]) {
    const taskId = parseClaimTaskId(item);
    if (!taskId) continue;
    if (requestedTaskId && taskId !== requestedTaskId) continue;

    const commandId = parseClaimCommandId(item, taskId);
    const state = String(item?.state ?? "").trim().toUpperCase();
    const leaseUntilTs = parseLeaseUntilTs(item);

    console.log(`DISPATCH_TRACE phase=claim task_id=${taskId} command_id=${commandId} state=${state || "UNKNOWN"} lease_until_ts=${leaseUntilTs || 0}`);

    if (isTerminalState(state)) {
      terminalStateByTask.set(taskId, state as DispatchQueueState);
      console.log(`TERMINAL_DEDUPE_SKIP task_id=${taskId} command_id=${commandId} state=${state}`);
      continue;
    }

    if (terminalStateByTask.has(taskId)) {
      const terminal = terminalStateByTask.get(taskId);
      console.log(`TERMINAL_DEDUPE_SKIP task_id=${taskId} command_id=${commandId} terminal_state=${terminal}`);
      continue;
    }

    const localLeaseUntil = localLeaseByTask.get(taskId) ?? 0;
    if (localLeaseUntil > nowMs) {
      console.log(`LEASE_DEDUPE_SKIP task_id=${taskId} command_id=${commandId} local_lease_until_ts=${localLeaseUntil}`);
      continue;
    }

    localLeaseByTask.set(taskId, leaseUntilTs > nowMs ? leaseUntilTs : nowMs + Math.max(5000, (args.lease_seconds ?? 30) * 1000));

    if (!byTask.has(taskId)) byTask.set(taskId, item);
    if (byTask.size >= limit) break;
  }

  if (requestedTaskId && !byTask.has(requestedTaskId)) {
    throw new Error(`CLAIM_RETURNED_UNEXPECTED_TASK: expected=${requestedTaskId} got=${JSON.stringify(out.items)}`);
  }

  return [...byTask.values()];
}
