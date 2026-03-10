// GEOX/apps/executor/src/run_mqtt_downlink_once.ts
// Control-4 MQTT downlink adapter: drain one or more explicit dispatch queue items,
// publish one MQTT downlink per selected queue item, optionally synthesize a receipt,
// then exit. This version supports precise filtering by act_task_id / outbox_fact_id
// so acceptance scripts do not accidentally publish stale queue entries.

import crypto from "node:crypto"; // Stable ids for executor instance and synthetic receipts.
import mqtt from "mqtt"; // MQTT client for downlink publish.
import process from "node:process"; // Process env + exit handling.

type DispatchQueueItem = {
  outbox_fact_id: string; // Wrapper outbox fact id exposed by v1 queue API.
  outbox_occurred_at: string; // Queue insertion timestamp.
  outbox: {
    type: string; // Expected ao_act_dispatch_outbox_v1.
    payload: {
      tenant_id: string; // Tenant triple field.
      project_id: string; // Tenant triple field.
      group_id: string; // Tenant triple field.
      act_task_id: string; // AO-ACT task id to publish.
      task_fact_id: string; // Source task fact id.
      dispatch_fact_id: string; // Source dispatch fact id.
      device_id?: string | null; // Target device id.
      downlink_topic?: string | null; // Explicit downlink topic.
      qos?: number | null; // MQTT qos hint.
      retain?: boolean | null; // MQTT retain hint.
      adapter_hint?: string | null; // Adapter hint.
      created_at_ts?: number | null; // Audit create time.
    };
  };
  task_fact_id: string; // Joined task fact id from queue view.
  task_occurred_at: string; // Joined task timestamp.
  task: {
    type: string; // Expected ao_act_task_v0.
    payload: {
      tenant_id: string; // Tenant triple field.
      project_id: string; // Tenant triple field.
      group_id: string; // Tenant triple field.
      act_task_id: string; // AO-ACT task id.
      issuer: any; // Original issuer object.
      action_type: string; // AO-ACT action type.
      target: any; // AO-ACT target object.
      time_window: any; // AO-ACT time window.
      parameter_schema: any; // AO-ACT parameter schema.
      parameters: Record<string, any>; // AO-ACT parameters.
      constraints: any; // AO-ACT constraints.
      meta?: Record<string, any> | null; // Optional task meta.
      created_at_ts?: number | null; // Optional task create time.
    };
  };
  receipt_fact_id?: string | null; // Present only when queue already drained.
  receipt_occurred_at?: string | null; // Present only when queue already drained.
  receipt?: any; // Joined receipt snapshot.
};

type QueueResponse = {
  ok: boolean; // Standard v1 response flag.
  items: DispatchQueueItem[]; // Queue items.
};

type PublishedResponse = {
  ok: boolean; // Standard v1 response flag.
  published_fact_id: string; // Downlink audit fact id.
  already_published?: boolean; // Idempotent publish indicator.
};

type ReceiptResponse = {
  ok: boolean; // Standard v1 response flag.
  ack_fact_id?: string; // Optional uplink ack fact id.
  fact_id?: string; // AO-ACT receipt fact id.
  wrapper_fact_id?: string; // Wrapper receipt fact id.
};

type Args = {
  baseUrl: string; // GEOX server base URL.
  token: string; // AO-ACT bearer token.
  mqttUrl: string; // MQTT broker URL.
  tenant_id: string; // Tenant scope used for queue reads.
  project_id: string; // Project scope used for queue reads.
  group_id: string; // Group scope used for queue reads.
  executor_id: string; // Executor id used for synthetic receipts.
  limit: number; // Max queue rows to fetch from v1 API.
  skipReceipt: boolean; // When true, do not synthesize a receipt after publish.
  act_task_id?: string; // Optional exact task selector.
  outbox_fact_id?: string; // Optional exact outbox selector.
};

function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => {
    const idx = argv.indexOf(`--${k}`); // Find named flag.
    if (idx === -1) return undefined; // Missing flag.
    const v = argv[idx + 1]; // Read flag value.
    if (!v || v.startsWith("--")) return undefined; // Missing value.
    return v; // Return raw string.
  };

  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001"; // Resolve GEOX base URL.
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? ""; // Resolve bearer token.
  const mqttUrl = get("mqttUrl") ?? process.env.GEOX_MQTT_URL ?? "mqtt://127.0.0.1:1883"; // Resolve broker URL.
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA"; // Resolve tenant id.
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA"; // Resolve project id.
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA"; // Resolve group id.
  const executor_id = get("executor_id") ?? `mqtt_exec_${crypto.randomUUID().replace(/-/g, "")}`; // Create stable one-shot executor id.
  const limit = Math.max(1, Number.parseInt(get("limit") ?? "20", 10) || 20); // Clamp queue page size.
  const skipReceiptRaw = (get("skipReceipt") ?? "false").trim().toLowerCase(); // Read skipReceipt flag.
  const skipReceipt = skipReceiptRaw === "1" || skipReceiptRaw === "true" || skipReceiptRaw === "yes"; // Normalize boolean.
  const act_task_id = get("act_task_id")?.trim() || undefined; // Optional task filter.
  const outbox_fact_id = get("outbox_fact_id")?.trim() || undefined; // Optional outbox filter.

  if (!token) throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)"); // Auth is mandatory.

  return {
    baseUrl,
    token,
    mqttUrl,
    tenant_id,
    project_id,
    group_id,
    executor_id,
    limit,
    skipReceipt,
    act_task_id,
    outbox_fact_id
  }; // Return normalized args.
}

async function httpJson<T>(url: string, token: string, method: "GET" | "POST", body?: any): Promise<T> {
  const res = await fetch(url, {
    method, // Explicit HTTP method.
    headers: {
      Accept: "application/json", // Expect JSON.
      Authorization: `Bearer ${token}`, // AO-ACT bearer token.
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) // Only set JSON content-type when body exists.
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) // Serialize body only when present.
  }); // Execute HTTP request.
  const text = await res.text(); // Read raw body for diagnostics.
  let obj: any = null; // Parsed payload placeholder.
  try {
    obj = text ? JSON.parse(text) : {}; // Best-effort JSON parse.
  } catch {
    obj = { _non_json: text }; // Preserve raw non-JSON response.
  }
  if (!res.ok) {
    throw new Error(`http ${res.status}: ${text}`); // Surface full HTTP failure.
  }
  return obj as T; // Return typed object.
}

function buildDispatchesUrl(args: Args): string {
  const u = new URL(`${args.baseUrl}/api/v1/ao-act/dispatches`); // Start from v1 dispatch queue endpoint.
  u.searchParams.set("tenant_id", args.tenant_id); // Scope queue read to tenant.
  u.searchParams.set("project_id", args.project_id); // Scope queue read to project.
  u.searchParams.set("group_id", args.group_id); // Scope queue read to group.
  u.searchParams.set("limit", String(args.limit)); // Bound the queue page.
  return u.toString(); // Return final URL.
}

async function loadQueue(args: Args): Promise<DispatchQueueItem[]> {
  const res = await httpJson<QueueResponse>(buildDispatchesUrl(args), args.token, "GET"); // Read current v1 queue.
  if (!res.ok || !Array.isArray(res.items)) throw new Error("dispatch queue response invalid"); // Guard malformed API response.
  return res.items; // Return raw queue items.
}

function filterQueueItems(items: DispatchQueueItem[], args: Args): DispatchQueueItem[] {
  let out = items.slice(); // Work on a shallow copy.
  if (args.outbox_fact_id) {
    out = out.filter((item) => String(item.outbox_fact_id) === args.outbox_fact_id); // Prefer exact outbox match when provided.
  }
  if (args.act_task_id) {
    out = out.filter((item) => String(item.outbox?.payload?.act_task_id ?? item.task?.payload?.act_task_id ?? "") === args.act_task_id); // Narrow by exact task id when provided.
  }
  return out; // Return filtered queue candidates.
}

function buildDownlinkPayload(item: DispatchQueueItem): any {
  const task = item.task?.payload ?? {}; // Task payload snapshot.
  const outbox = item.outbox?.payload ?? {}; // Outbox payload snapshot.
  const tenant_id = String(outbox.tenant_id ?? task.tenant_id ?? ""); // Carry tenant id into downlink message.
  const project_id = String(outbox.project_id ?? task.project_id ?? ""); // Carry project id into downlink message.
  const group_id = String(outbox.group_id ?? task.group_id ?? ""); // Carry group id into downlink message.
  const act_task_id = String(outbox.act_task_id ?? task.act_task_id ?? ""); // Stable command id for device/runtime.
  const device_id = outbox.device_id ?? task.meta?.device_id ?? null; // Device id hint for adapters/devices.

  return {
    tenant_id, // Tenant triple.
    project_id, // Tenant triple.
    group_id, // Tenant triple.
    command_id: act_task_id, // Device runtime uses command_id as act_task_id.
    act_task_id, // Duplicate explicit field for easier debugging.
    outbox_fact_id: item.outbox_fact_id, // Link message to outbox fact.
    dispatch_fact_id: outbox.dispatch_fact_id ?? null, // Link message to dispatch fact.
    device_id, // Target device id.
    action_type: task.action_type ?? null, // AO-ACT action type.
    target: task.target ?? null, // AO-ACT target.
    params: task.parameters ?? {}, // Device-facing parameters.
    parameter_schema: task.parameter_schema ?? null, // Optional parameter schema for adapters.
    constraints: task.constraints ?? {}, // AO-ACT constraints.
    time_window: task.time_window ?? null, // AO-ACT time window.
    meta: task.meta ?? {}, // Preserve opaque task meta.
    published_at_ts: Date.now() // Local publish timestamp for audit/debug.
  }; // Stable MQTT downlink payload.
}

function connectMqtt(url: string): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, { connectTimeout: 5000, reconnectPeriod: 0 }); // Connect once only.
    const onError = (err: Error) => {
      client.removeListener("connect", onConnect); // Cleanup connect listener when error wins.
      client.end(true); // Close socket on failed connect.
      reject(err); // Surface connect failure.
    };
    const onConnect = () => {
      client.removeListener("error", onError); // Cleanup error listener once connected.
      resolve(client); // Return connected client.
    };
    client.once("error", onError); // Reject on first error.
    client.once("connect", onConnect); // Resolve on successful connect.
  });
}

function publishMqtt(client: mqtt.MqttClient, topic: string, payloadJson: string, qos: number, retain: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payloadJson, { qos, retain }, (err?: Error) => {
      if (err) return reject(err); // Surface broker publish failure.
      resolve(); // Publish call accepted by client/broker path.
    });
  });
}

async function writePublishedAudit(args: Args, item: DispatchQueueItem, topic: string, payload: any): Promise<PublishedResponse> {
  const outbox = item.outbox?.payload ?? {}; // Read outbox snapshot.
  const task = item.task?.payload ?? {}; // Read task snapshot.
  return httpJson<PublishedResponse>(`${args.baseUrl}/api/v1/ao-act/downlinks/published`, args.token, "POST", {
    tenant_id: String(outbox.tenant_id ?? task.tenant_id ?? args.tenant_id), // Tenant triple field.
    project_id: String(outbox.project_id ?? task.project_id ?? args.project_id), // Tenant triple field.
    group_id: String(outbox.group_id ?? task.group_id ?? args.group_id), // Tenant triple field.
    act_task_id: String(outbox.act_task_id ?? task.act_task_id ?? ""), // AO-ACT task id.
    outbox_fact_id: String(item.outbox_fact_id), // Outbox fact id.
    device_id: String(outbox.device_id ?? task.meta?.device_id ?? ""), // Device id.
    topic, // Published MQTT topic.
    qos: Number(outbox.qos ?? 1), // MQTT qos used.
    retain: Boolean(outbox.retain ?? false), // MQTT retain used.
    adapter_runtime: "mqtt_downlink_once_v1", // Stable adapter runtime name.
    adapter_message_id: `msg_${crypto.randomUUID().replace(/-/g, "")}`, // One-shot message id for audit.
    command_payload: payload // Let server hash actual published payload.
  }); // Append published audit fact.
}

async function writeSyntheticReceipt(args: Args, item: DispatchQueueItem, topic: string, payload: any): Promise<ReceiptResponse> {
  const outbox = item.outbox?.payload ?? {}; // Read outbox snapshot.
  const task = item.task?.payload ?? {}; // Read task snapshot.
  const act_task_id = String(outbox.act_task_id ?? task.act_task_id ?? ""); // Resolve act task id.
  const device_id = String(outbox.device_id ?? task.meta?.device_id ?? ""); // Resolve device id.

  return httpJson<ReceiptResponse>(`${args.baseUrl}/api/v1/ao-act/receipts/uplink`, args.token, "POST", {
    tenant_id: String(outbox.tenant_id ?? task.tenant_id ?? args.tenant_id), // Tenant triple field.
    project_id: String(outbox.project_id ?? task.project_id ?? args.project_id), // Tenant triple field.
    group_id: String(outbox.group_id ?? task.group_id ?? args.group_id), // Tenant triple field.
    act_task_id, // AO-ACT task id.
    command_id: act_task_id, // Preserve command id.
    device_id, // Device id.
    receipt_message_id: `rcpt_${crypto.randomUUID().replace(/-/g, "")}`, // Unique receipt message id.
    status: "executed", // Happy-path synthetic status.
    start_ts: Date.now() - 25, // Synthetic execution start.
    end_ts: Date.now(), // Synthetic execution end.
    observed_parameters: payload?.params ?? {}, // Echo parameters as observed values.
    raw_payload: payload, // Preserve raw command payload for audit hash.
    meta: {
      idempotency_key: `synthetic_${act_task_id}_${args.executor_id}`, // Deterministic retry-safe idempotency key.
      source: "mqtt_downlink_once_v1", // Mark synthetic source.
      uplink_topic: topic.replace(/^downlink\//, "receipt/") // Derive synthetic receipt topic hint.
    } // Synthetic meta.
  }); // Delegate through receipt uplink path for consistent validation/projection updates.
}

async function processOneItem(client: mqtt.MqttClient, args: Args, item: DispatchQueueItem): Promise<void> {
  const outbox = item.outbox?.payload ?? {}; // Read queue payload.
  const task = item.task?.payload ?? {}; // Read task payload.
  const act_task_id = String(outbox.act_task_id ?? task.act_task_id ?? ""); // Resolve task id.
  const topic = String(outbox.downlink_topic ?? `downlink/${args.tenant_id}/${String(outbox.device_id ?? task.meta?.device_id ?? "unknown")}`); // Resolve MQTT topic.
  const device_id = String(outbox.device_id ?? task.meta?.device_id ?? ""); // Resolve device id.
  const qos = Math.max(0, Math.min(2, Number(outbox.qos ?? 1) || 1)); // Clamp QoS to MQTT valid range.
  const retain = Boolean(outbox.retain ?? false); // Resolve retain flag.
  const payload = buildDownlinkPayload(item); // Build exact MQTT payload once.

  console.log(`INFO: publishing act_task_id=${act_task_id} topic=${topic} device_id=${device_id} outbox_fact_id=${item.outbox_fact_id}`); // Trace selected queue item.
  await publishMqtt(client, topic, JSON.stringify(payload), qos, retain); // Publish one MQTT downlink.
  const published = await writePublishedAudit(args, item, topic, payload); // Append audit fact after successful publish.
  console.log(`INFO: wrote downlink audit fact_id=${published.published_fact_id} already_published=${Boolean(published.already_published)}`); // Trace published audit result.

  if (args.skipReceipt) {
    console.log(`INFO: skipReceipt=true; waiting for device-originated receipt for act_task_id=${act_task_id}`); // Publish-only acceptance path.
    console.log(`PASS: mqtt adapter completed act_task_id=${act_task_id}`); // PASS marker for acceptance scripts.
    return; // Do not synthesize a receipt.
  }

  const receipt = await writeSyntheticReceipt(args, item, topic, payload); // Write synthetic receipt for non-Control-4 flows.
  console.log(`INFO: synthetic receipt written ack_fact_id=${receipt.ack_fact_id ?? ""} fact_id=${receipt.fact_id ?? ""}`); // Trace receipt result.
  console.log(`PASS: mqtt adapter completed act_task_id=${act_task_id}`); // PASS marker for acceptance scripts.
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2)); // Parse runtime args once.
  console.log(`INFO: run_mqtt_downlink_once baseUrl=${args.baseUrl}`); // Trace base URL.
  console.log(`INFO: mqttUrl=${args.mqttUrl}`); // Trace broker URL.
  console.log(`INFO: executor_id=${args.executor_id}`); // Trace executor instance id.
  if (args.act_task_id) console.log(`INFO: filter act_task_id=${args.act_task_id}`); // Trace explicit task filter.
  if (args.outbox_fact_id) console.log(`INFO: filter outbox_fact_id=${args.outbox_fact_id}`); // Trace explicit outbox filter.

  const rawItems = await loadQueue(args); // Read dispatch queue from v1 API.
  console.log(`INFO: dispatch queue size=${rawItems.length}`); // Trace raw queue size.
  const items = filterQueueItems(rawItems, args); // Apply exact selectors after queue read.
  console.log(`INFO: selected queue size=${items.length}`); // Trace filtered queue size.

  if (items.length === 0) {
    throw new Error("no matching dispatch queue item"); // Fail explicitly when target item not found.
  }

  const client = await connectMqtt(args.mqttUrl); // Connect once for all selected publishes.
  try {
    for (const item of items) {
      await processOneItem(client, args, item); // Publish each selected queue item in order.
    }
  } finally {
    client.end(true); // Always close MQTT client.
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`); // Stable failure line for scripts.
  process.exit(1); // Non-zero exit on any error.
});