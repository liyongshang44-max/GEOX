import crypto from "node:crypto"; // Stable message ids for simulated device receipts.
import mqtt from "mqtt"; // MQTT client for downlink subscribe + uplink publish.

type Args = {
  mqttUrl: string; // MQTT broker URL.
  tenant_id: string; // Tenant id used in default topic derivation.
  device_id: string; // Simulated device id.
  downlinkTopic: string; // Explicit or derived downlink topic.
  receiptTopic: string; // Explicit or derived receipt topic.
  timeoutMs: number; // Max wait for one downlink before failing.
  targetActTaskId?: string; // Optional specific act_task_id to filter downlink messages.
};

function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => {
    const idx = argv.indexOf(`--${k}`); // Find named argument.
    if (idx === -1) return undefined; // Missing argument.
    const v = argv[idx + 1]; // Read next token.
    if (!v || v.startsWith("--")) return undefined; // Missing value.
    return v; // Return raw flag value.
  };
  const mqttUrl = get("mqttUrl") ?? process.env.GEOX_MQTT_URL ?? "mqtt://127.0.0.1:1883"; // Resolve broker URL.
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA"; // Resolve tenant id.
  const device_id = get("device_id") ?? process.env.GEOX_DEVICE_ID ?? "dev_001"; // Resolve device id.
  const downlinkTopic = get("downlinkTopic") ?? process.env.GEOX_DOWNLINK_TOPIC ?? `/device/${device_id}/cmd`; // Resolve downlink topic.
  const receiptTopic = get("receiptTopic") ?? process.env.GEOX_RECEIPT_TOPIC ?? `/device/${device_id}/ack`; // Resolve receipt topic.
  const timeoutMs = Math.max(1000, Number.parseInt(get("timeoutMs") ?? process.env.GEOX_TIMEOUT_MS ?? "15000", 10) || 15000); // Clamp wait timeout.
  const targetActTaskId = get("targetActTaskId") ?? process.env.GEOX_TARGET_ACT_TASK_ID; // Optional specific act_task_id.
  return { mqttUrl, tenant_id, device_id, downlinkTopic, receiptTopic, timeoutMs, targetActTaskId }; // Return normalized args.
}

function connectMqtt(url: string): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, { connectTimeout: 5000, reconnectPeriod: 0 }); // Connect once only.
    const onError = (err: Error) => {
      client.removeListener("connect", onConnect); // Cleanup when error wins.
      client.end(true); // Close socket on failed connect.
      reject(err); // Surface broker connection failure.
    };
    const onConnect = () => {
      client.removeListener("error", onError); // Cleanup error listener after connect.
      resolve(client); // Return connected client.
    };
    client.once("error", onError); // Fail on first connection error.
    client.once("connect", onConnect); // Resolve on successful connect.
  });
}

function subscribeOnce(client: mqtt.MqttClient, topic: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) return reject(err); // Surface subscribe error.
      resolve(); // Subscription ready.
    });
  });
}

function publishOnce(client: mqtt.MqttClient, topic: string, payloadJson: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payloadJson, { qos: 1, retain: false }, (err) => {
      if (err) return reject(err); // Surface publish error.
      resolve(); // Broker accepted the publish call.
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2)); // Parse runtime args.
  console.log(`INFO: device sim mqttUrl=${args.mqttUrl}`); // Trace broker URL.
  console.log(`INFO: device sim downlinkTopic=${args.downlinkTopic}`); // Trace subscribed topic.
  console.log(`INFO: device sim receiptTopic=${args.receiptTopic}`); // Trace published receipt topic.

  const client = await connectMqtt(args.mqttUrl); // Connect to MQTT broker.
  try {
    await subscribeOnce(client, args.downlinkTopic); // Subscribe before waiting for first command.
    const timeout = setTimeout(() => {
      console.error(`FAIL: timeout waiting for downlink topic=${args.downlinkTopic}`); // Stable timeout marker for acceptance.
      client.end(true); // Close client before hard-failing.
      process.exit(1); // Exit non-zero for acceptance.
    }, args.timeoutMs);
    await new Promise<void>((resolve, reject) => {
      client.once("message", async (_topic, payloadBuffer) => {
        try {
          clearTimeout(timeout); // Stop timeout after first message.
          const text = payloadBuffer.toString("utf8"); // Convert MQTT payload to text.
          const payload = JSON.parse(text); // Parse command payload JSON.
          const act_task_id = String(payload?.command_id ?? ""); // Use command_id as act_task_id.

          console.log(`INFO: device sim received raw=${text}`);
          console.log(`INFO: device sim received act_task_id=${act_task_id}`);

          if (!act_task_id) throw new Error("downlink missing command_id"); // Require stable task linkage.

          const expectedActTaskId = args.targetActTaskId?.trim();
          if (expectedActTaskId && act_task_id !== expectedActTaskId) {
            console.log(`INFO: device sim ignore act_task_id=${act_task_id} expected=${expectedActTaskId}`);
            return;
          }

          // If act_task_id matches, clear the timeout
          clearTimeout(timeout);

          const receipt = {
            tenant_id: String(payload?.tenant_id ?? args.tenant_id),
            project_id: String(payload?.project_id ?? process.env.GEOX_PROJECT_ID ?? "projectA"),
            group_id: String(payload?.group_id ?? process.env.GEOX_GROUP_ID ?? "groupA"),
            task_id: act_task_id,
            act_task_id,
            command_id: act_task_id,
            device_id: args.device_id,
            receipt_message_id: `rcpt_${crypto.randomUUID().replace(/-/g, "")}`,
            status: "executed",
            start_ts: Date.now() - 25,
            end_ts: Date.now(),
            observed_parameters: payload?.params ?? {},
            raw_payload: payload
          };

          await publishOnce(client, args.receiptTopic, JSON.stringify(receipt)); // Publish one receipt uplink message.
          console.log(`PASS: device sim published receipt act_task_id=${act_task_id}`); // PASS marker for acceptance.
          resolve(); // Finish after first round trip.
        } catch (err: any) {
          reject(err); // Surface parse/publish failure.
        }
      });
    });
  } finally {
    client.end(true); // Always close MQTT client on exit.
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`); // Stable error output.
  process.exit(1); // Non-zero exit on failure.
});
