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
      ...(args.act_task_id ? { act_task_id: args.act_task_id } : {})
    })
  });
  if (!out?.ok || !Array.isArray(out.items)) throw new Error(`unexpected claim response: ${JSON.stringify(out)}`);

  const byTask = new Map<string, any>();
  for (const item of out.items) {
    const taskId = String(item?.act_task_id ?? item?.task?.payload?.act_task_id ?? "").trim();
    if (!taskId) continue;
    if (!byTask.has(taskId)) byTask.set(taskId, item);
    if (byTask.size >= limit) break;
  }
  return [...byTask.values()];
}
