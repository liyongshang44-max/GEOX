// GEOX/apps/executor/src/run_mqtt_downlink_once.ts
// Control-4 explicit MQTT adapter runtime: drain dispatch outbox once, publish one or more downlinks,
// audit the publish, then optionally append synthetic receipts.
// This runtime is intentionally NOT a scheduler and NOT an infinite polling loop.

import crypto from "node:crypto"; // Used for stable executor ids and payload hashes.
import mqtt from "mqtt"; // MQTT client for explicit downlink publish.

type Args = {
  baseUrl: string; // GEOX server base URL.
  token: string; // AO-ACT bearer token.
  tenant_id: string; // Hard-isolation tenant triple value.
  project_id: string; // Hard-isolation project triple value.
  group_id: string; // Hard-isolation group triple value.
  executor_id: string; // Logical executor identity written into downlink audit + receipt.
  limit: number; // Max queue items to process in this run.
  mqttUrl: string; // MQTT broker URL.
  qos: number; // Default MQTT QoS when queue item omits it.
  retain: boolean; // Default MQTT retain flag when queue item omits it.
  skipReceipt: boolean; // When true, publish + audit only; do not synthesize a receipt.
  act_task_id?: string; // Optional single-task filter used by Control-4 acceptance to avoid consuming stale queue items.
  leaseSeconds: number; // Lease duration for atomic queue claim.
};

function nowMs(): number {
  return Date.now(); // Millisecond helper.
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback; // Missing input => fallback.
  const normalized = String(value).trim().toLowerCase(); // Normalize once for stable parsing.
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true; // Truthy spellings.
  if (normalized === "false" || normalized === "0" || normalized === "no") return false; // Falsy spellings.
  return fallback; // Unknown spelling => fallback.
}

function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => {
    const idx = argv.indexOf(`--${k}`); // Locate --flag.
    if (idx === -1) return undefined; // Flag absent.
    const v = argv[idx + 1]; // Next token is the flag value.
    if (!v || v.startsWith("--")) return undefined; // Missing value.
    return v; // Return raw string value.
  }; // End flag reader.

  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://server:3000"; // Resolve base URL.
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? ""; // Resolve bearer token.
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA"; // Resolve tenant id.
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA"; // Resolve project id.
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA"; // Resolve group id.
  const executor_id =
    get("executor_id") ??
    process.env.GEOX_EXECUTOR_ID ??
    `mqtt_exec_${crypto.randomUUID().replace(/-/g, "")}`; // Resolve executor id.
  const limit = Math.max(1, Number.parseInt(get("limit") ?? process.env.GEOX_EXECUTOR_LIMIT ?? "1", 10) || 1); // Positive integer only.
  const mqttUrl = get("mqttUrl") ?? process.env.GEOX_MQTT_URL ?? "mqtt://127.0.0.1:1883"; // Resolve broker URL.
  const qos = Math.max(0, Math.min(2, Number.parseInt(get("qos") ?? process.env.GEOX_MQTT_QOS ?? "1", 10) || 1)); // Clamp MQTT QoS.
  const retain = parseBool(get("retain") ?? process.env.GEOX_MQTT_RETAIN, false); // Parse retain flag safely.
  const skipReceipt = parseBool(get("skipReceipt") ?? process.env.GEOX_SKIP_RECEIPT, false); // Parse publish-only mode safely.
  const act_task_id = (get("act_task_id") ?? process.env.GEOX_TARGET_ACT_TASK_ID ?? "").trim() || undefined; // Optional task filter for exact-target dispatch.
  const leaseSeconds = Math.max(5, Math.min(300, Number.parseInt(get("leaseSeconds") ?? process.env.GEOX_DISPATCH_LEASE_SECONDS ?? "30", 10) || 30)); // Clamp queue lease duration.

  if (!token) throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)"); // Auth is mandatory.

  return {
    baseUrl,
    token,
    tenant_id,
    project_id,
    group_id,
    executor_id,
    limit,
    mqttUrl,
    qos,
    retain,
    skipReceipt,
    act_task_id,
    leaseSeconds
  }; // Return normalized args.
}

async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  }; // Default auth headers.

  if (init?.body) headers["Content-Type"] = "application/json"; // Add JSON content-type for POST bodies.

  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } }); // Execute request.
  const text = await res.text(); // Read raw body for diagnostics.

  let obj: any = null; // Parsed payload placeholder.
  try {
    obj = text ? JSON.parse(text) : {}; // Parse JSON when possible.
  } catch {
    obj = { _non_json: text }; // Preserve raw non-JSON payload for debugging.
  }

  if (!res.ok) throw new Error(`http ${res.status}: ${text}`); // Fail fast with raw payload.
  return obj; // Return parsed response.
}

async function claimDispatchQueue(args: Args): Promise<any[]> {
  const body = {
    tenant_id: args.tenant_id,
    project_id: args.project_id,
    group_id: args.group_id,
    executor_id: args.executor_id,
    limit: args.limit,
    lease_seconds: args.leaseSeconds,
    adapter_hint: "mqtt_downlink_once_v1",
    ...(args.act_task_id ? { act_task_id: args.act_task_id } : {})
  }; // Claim body for atomic queue lease.
  const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/dispatches/claim`, args.token, {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (!out?.ok || !Array.isArray(out.items)) throw new Error(`unexpected claim response: ${JSON.stringify(out)}`);
  return out.items;
}

function resolveDeviceId(item: any): string {
  const fromOutbox = String(item?.outbox?.payload?.device_id ?? "").trim(); // Prefer explicit dispatch queue device id.
  if (fromOutbox) return fromOutbox; // Use queue device id when present.

  const fromTaskMeta = String(item?.task?.payload?.meta?.device_id ?? "").trim(); // Fallback to task meta device hint.
  if (fromTaskMeta) return fromTaskMeta; // Use task meta hint when queue was produced by an older server route.

  return ""; // Empty string keeps downstream validation explicit.
}

function resolveDownlinkTopic(item: any, deviceId: string): string {
  const fromOutbox = String(item?.outbox?.payload?.downlink_topic ?? "").trim(); // Prefer explicit queue topic.
  if (fromOutbox) return fromOutbox; // Use stored topic when present.

  const tenantId = String(item?.outbox?.payload?.tenant_id ?? item?.task?.payload?.tenant_id ?? "").trim(); // Read tenant id from queue/task record.
  if (tenantId && deviceId) return `downlink/${tenantId}/${deviceId}`; // Backward-compatible default topic derivation.

  return ""; // Empty string keeps downstream validation explicit.
}

function buildCommandPayload(item: any): any {
  const tenant_id = String(item?.outbox?.payload?.tenant_id ?? item?.task?.payload?.tenant_id ?? ""); // Read tenant id from queue item or task fallback.
  const project_id = String(item?.outbox?.payload?.project_id ?? item?.task?.payload?.project_id ?? ""); // Read project id from queue item or task fallback.
  const group_id = String(item?.outbox?.payload?.group_id ?? item?.task?.payload?.group_id ?? ""); // Read group id from queue item or task fallback.
  const act_task_id = String(item?.task?.payload?.act_task_id ?? item?.act_task_id ?? item?.outbox?.payload?.act_task_id ?? ""); // Read task id from joined task record or fallbacks.
  const action_type = String(item?.task?.payload?.action_type ?? ""); // Read AO-ACT action type.
  const params = item?.task?.payload?.parameters ?? {}; // Read AO-ACT parameters.
  const constraints = item?.task?.payload?.constraints ?? {}; // Read AO-ACT constraints.
  const device_id = resolveDeviceId(item); // Read device id with backward-compatible fallback.

  return {
    command_id: act_task_id, // Use task id as stable command id.
    tenant_id, // Carry tenant id for adapter-side auditability.
    project_id, // Carry project id for adapter-side auditability.
    group_id, // Carry group id for adapter-side auditability.
    device_id, // Carry intended device id.
    action_type, // Carry AO-ACT action type.
    params, // Carry AO-ACT parameters.
    constraints, // Carry AO-ACT constraints.
    issued_at_ts: nowMs() // Carry adapter issue timestamp.
  }; // Commercial v1 minimal downlink payload.
}

function connectMqtt(url: string): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, { connectTimeout: 5000, reconnectPeriod: 0 }); // Connect once; do not retry forever.

    const onError = (err: Error) => {
      client.removeListener("connect", onConnect); // Cleanup connect listener when error wins.
      client.end(true); // Close socket immediately on connect failure.
      reject(err); // Reject with broker connection error.
    }; // End error path.

    const onConnect = () => {
      client.removeListener("error", onError); // Cleanup error listener when connect succeeds.
      resolve(client); // Resolve connected client.
    }; // End connect path.

    client.once("error", onError); // Listen for first connection error.
    client.once("connect", onConnect); // Resolve on first successful connect.
  });
}

function publishOnce(
  client: mqtt.MqttClient,
  topic: string,
  payloadJson: string,
  qos: number,
  retain: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payloadJson, { qos: qos as 0 | 1 | 2, retain }, (err) => {
      if (err) return reject(err); // Reject when broker publish callback reports error.
      resolve(); // Resolve after broker accepted the publish call.
    }); // End publish callback.
  });
}

async function auditDownlinkPublished(
  args: Args,
  item: any,
  topic: string,
  payload: any,
  qos: number,
  retain: boolean
): Promise<any> {
  const actTaskId = String(item?.task?.payload?.act_task_id ?? item?.act_task_id ?? item?.outbox?.payload?.act_task_id ?? ""); // Normalize task id across queue shapes.
  const outboxFactId = String(item?.outbox_fact_id ?? ""); // Normalize outbox fact id.

  const body = {
    tenant_id: args.tenant_id, // Scope tenant id.
    project_id: args.project_id, // Scope project id.
    group_id: args.group_id, // Scope group id.
    act_task_id: actTaskId, // Link publish to task id.
    outbox_fact_id: outboxFactId, // Link publish to dispatch outbox item.
    device_id: resolveDeviceId(item), // Echo intended device id.
    topic, // Echo actual MQTT topic.
    qos, // Echo actual MQTT qos.
    retain, // Echo actual MQTT retain flag.
    adapter_runtime: "mqtt_downlink_once_v1", // Stable runtime marker.
    adapter_message_id: outboxFactId, // Reuse outbox fact id as stable adapter message id.
    lease_token: item?.lease_token ?? null, // Runtime lease token proving claim ownership.
    executor_id: args.executor_id, // Runtime executor identity for state transition ownership.
    queue_id: item?.queue_id ?? null, // Claimed queue id for diagnostics.
    command_payload_sha256: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"), // Stable payload digest.
    command_payload: payload // Include payload for audit hashing parity.
  }; // Stable audit payload for successful MQTT publish.

  return httpJson(`${args.baseUrl}/api/v1/ao-act/downlinks/published`, args.token, {
    method: "POST",
    body: JSON.stringify(body)
  }); // Append audit fact via v1 route.
}

async function writeReceipt(args: Args, item: any): Promise<any> {
  const end = nowMs(); // Execution end time.
  const start = end - 50; // Tiny synthetic start time.
  const actTaskId = String(item?.task?.payload?.act_task_id ?? item?.act_task_id ?? item?.outbox?.payload?.act_task_id ?? ""); // Normalize task id.
  const outboxFactId = String(item?.outbox_fact_id ?? ""); // Normalize outbox fact id.

  const body = {
    tenant_id: args.tenant_id, // Scope tenant id.
    project_id: args.project_id, // Scope project id.
    group_id: args.group_id, // Scope group id.
    task_id: actTaskId, // Required receipt task id.
    command_id: actTaskId, // Required receipt command id.
    act_task_id: actTaskId, // Link receipt to task id.
    executor_id: { kind: "script", id: args.executor_id, namespace: "executor_runtime_v1" }, // Synthetic executor identity.
    execution_time: { start_ts: start, end_ts: end }, // Minimal valid execution window.
    execution_coverage: { kind: "field", ref: "simulated" }, // Minimal valid coverage.
    resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 }, // Minimal valid resource usage.
    logs_refs: [{ kind: "stdout", ref: `executor://mqtt_downlink_once/${outboxFactId}` }], // Stable log reference.
    status: "executed", // Happy-path synthetic status.
    constraint_check: { violated: false, violations: [] }, // Minimal valid constraint result.
    observed_parameters: {}, // Minimal valid observed parameter set.
    meta: {
      idempotency_key: `mqtt_downlink_once_${outboxFactId}`, // Stable synthetic receipt idempotency key.
      runtime: "mqtt_downlink_once_v1", // Stable runtime marker.
      outbox_fact_id: outboxFactId // Echo outbox linkage for auditability.
    } // End receipt meta.
  }; // Minimal valid receipt payload after broker publish.

  return httpJson(`${args.baseUrl}/api/v1/ao-act/receipts`, args.token, {
    method: "POST",
    body: JSON.stringify(body)
  }); // Use stable v1 receipt path.
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2)); // Parse CLI flags/env.

  console.log(`INFO: run_mqtt_downlink_once baseUrl=${args.baseUrl}`); // Trace base URL.
  console.log(`INFO: mqttUrl=${args.mqttUrl}`); // Trace broker URL.
  console.log(`INFO: executor_id=${args.executor_id}`); // Trace executor identity.

  if (args.act_task_id) {
    console.log(`INFO: filter act_task_id=${args.act_task_id}`); // Trace exact task filter when provided.
  }
  const selected = await claimDispatchQueue(args); // Atomically claim bounded queue items.
  console.log(`INFO: dispatch queue size=${selected.length}`); // Claimed queue length.
  console.log(`INFO: selected queue size=${selected.length}`); // Effective selection size after atomic claim.
  if (selected.length < 1) {
    console.log("INFO: no dispatch items found (no-op)"); // Empty selection is not an error.
    return; // Exit successfully.
  }

  const client = await connectMqtt(args.mqttUrl); // Connect to broker once for this drain run.

  try {
    for (const item of selected) {
      const actTaskId = String(item?.task?.payload?.act_task_id ?? item?.act_task_id ?? item?.outbox?.payload?.act_task_id ?? ""); // Normalize task id.
      const outboxFactId = String(item?.outbox_fact_id ?? ""); // Normalize outbox fact id.
      const deviceId = resolveDeviceId(item); // Normalize device id with backward-compatible fallback.
      const topic = resolveDownlinkTopic(item, deviceId); // Normalize topic with backward-compatible fallback.
      const qos = Math.max(0, Math.min(2, Number.parseInt(String(item?.outbox?.payload?.qos ?? args.qos), 10) || args.qos)); // Read item qos or fallback.
      const retain = item?.outbox?.payload?.retain == null ? args.retain : Boolean(item.outbox.payload.retain); // Read item retain or fallback.

      if (!actTaskId || !outboxFactId) {
        throw new Error(`invalid queue item: ${JSON.stringify(item)}`); // Strong contract guard.
      }
      if (!deviceId) {
        throw new Error(`dispatch queue item missing device_id for act_task_id=${actTaskId}`); // MQTT adapter requires device id.
      }
      if (!topic) {
        throw new Error(`dispatch queue item missing downlink_topic for act_task_id=${actTaskId}`); // MQTT adapter requires topic.
      }

      const payload = buildCommandPayload(item); // Build downlink command payload.
      const payloadJson = JSON.stringify(payload); // Serialize command payload once for broker publish and hashing.

      console.log(`INFO: publishing act_task_id=${actTaskId} topic=${topic} device_id=${deviceId} outbox_fact_id=${outboxFactId}`); // Trace publish target with outbox id.

      await publishOnce(client, topic, payloadJson, qos, retain); // Publish one MQTT message.

      const audit = await auditDownlinkPublished(args, item, topic, payload, qos, retain); // Append audit fact for successful publish.
      console.log(`INFO: wrote downlink audit fact_id=${audit.published_fact_id} already_published=${Boolean(audit.already_published)}`); // Trace publish audit result.

      if (args.skipReceipt) {
        console.log(`INFO: skipReceipt=true; waiting for device-originated receipt for act_task_id=${actTaskId}`); // Control-4 mode leaves receipt to device/uplink runtime.
        console.log(`PASS: mqtt adapter completed act_task_id=${actTaskId}`); // PASS marker for publish-only mode.
        continue; // Do not synthesize any receipt in device-originated mode.
      }

      const receipt = await writeReceipt(args, item); // Append receipt after successful publish when synthetic mode is enabled.
      console.log(`INFO: synthetic receipt written ack_fact_id=${receipt.ack_fact_id ?? ""} fact_id=${receipt.fact_id} wrapper_fact_id=${receipt.wrapper_fact_id ?? ""}`); // Trace synthetic receipt linkage.
      console.log(`PASS: mqtt adapter completed act_task_id=${actTaskId}`); // PASS marker for acceptance scripts.
    }
  } finally {
    client.end(true); // Always close MQTT socket before process exit.
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`); // Stable error output for scripts.
  process.exit(1); // Non-zero exit for CI / acceptance.
});