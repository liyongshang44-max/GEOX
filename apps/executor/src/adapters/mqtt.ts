import { createHash } from "node:crypto";
import mqtt from "mqtt";
import type { Adapter, AoActTask } from "./index";
import type { ExecutorApi } from "../lib/executor_api";

function normalizeAction(value: string): string {
  return String(value ?? "").trim().toUpperCase();
}

function resolveTopic(task: AoActTask): string {
  const explicitTopic = String(task.meta?.topic ?? task.downlink_topic ?? "").trim();
  if (explicitTopic) return explicitTopic;
  const deviceId = String(task.device_id ?? task.meta?.device_id ?? "").trim();
  return deviceId ? `/device/${deviceId}/cmd` : "";
}

function resolvePayload(task: AoActTask): Record<string, unknown> {
  const commandId = String(task.command_id ?? task.act_task_id ?? "").trim() || String(task.act_task_id ?? "").trim();
  const type = String(task.meta?.command_type ?? "").trim() || "irrigation.start";
  const params = (task.meta?.params ?? {}) as Record<string, unknown>;
  return {
    command_id: commandId,
    type,
    params
  };
}

function connectMqtt(url: string): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, { connectTimeout: 5000, reconnectPeriod: 0 });

    const onError = (err: Error) => {
      client.removeListener("connect", onConnect);
      client.end(true);
      reject(err);
    };

    const onConnect = () => {
      client.removeListener("error", onError);
      resolve(client);
    };

    client.once("error", onError);
    client.once("connect", onConnect);
  });
}

function publishMqtt(client: mqtt.MqttClient, topic: string, payloadJson: string, qos: number, retain: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payloadJson, { qos: qos as 0 | 1 | 2, retain }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function createMqttAdapter(api: ExecutorApi): Adapter {
  return {
    type: "mqtt",
    adapter_type: "mqtt",
    supports(actionType: string): boolean {
      const normalized = normalizeAction(actionType);
      return normalized === "IRRIGATE" || normalized === "IRRIGATION.START";
    },
    validate(task: AoActTask) {
      if (!String(task.outbox_fact_id ?? "").trim()) return { ok: false as const, reason: "MISSING_OUTBOX_FACT_ID" };
      if (!String(task.device_id ?? task.meta?.device_id ?? "").trim()) return { ok: false as const, reason: "MISSING_DEVICE_ID" };
      if (!resolveTopic(task)) return { ok: false as const, reason: "MISSING_TOPIC" };
      return { ok: true as const };
    },
    async execute(task: AoActTask) {
      const mqttUrl = String(process.env.GEOX_MQTT_URL ?? "mqtt://127.0.0.1:1883").trim();
      const qos = Math.max(0, Math.min(2, Number(task.qos ?? process.env.GEOX_MQTT_QOS ?? 1) || 1));
      const retain = String(task.retain ?? process.env.GEOX_MQTT_RETAIN ?? "false").trim().toLowerCase() === "true";
      const deviceId = String(task.device_id ?? task.meta?.device_id ?? "").trim();
      const topic = resolveTopic(task);
      const payload = resolvePayload(task);
      const payloadJson = JSON.stringify(payload);

      let client: mqtt.MqttClient | null = null;
      try {
        client = await connectMqtt(mqttUrl);
        await publishMqtt(client, topic, payloadJson, qos, retain);
      } catch (error: any) {
        return { status: "FAILED", meta: { reason: "PUBLISH_FAILED", message: String(error?.message ?? error) } };
      } finally {
        client?.end(true);
      }

      const out = await api.publishDownlink({
        ...task,
        command_id: String((payload.command_id as string) ?? task.command_id ?? task.act_task_id),
        device_id: deviceId,
        downlink_topic: topic,
        qos,
        retain,
        meta: {
          ...(task.meta ?? {}),
          published_payload: payload
        }
      });

      if (!out?.ok) {
        return { status: "FAILED", meta: { reason: "PUBLISHED_FACT_WRITE_FAILED", response: out ?? null } };
      }

      return {
        status: "SUCCEEDED",
        meta: {
          publish_status: "PUBLISHED",
          topic,
          command_payload_sha256: createHash("sha256").update(payloadJson).digest("hex"),
          published_fact_id: out.published_fact_id ?? null
        }
      };
    }
  };
}
