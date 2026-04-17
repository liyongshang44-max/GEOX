import type { AlertNotificationPayload } from "./adapters/alert_notification_adapter_v1.js";
import { webhookAdapterV1 } from "./adapters/webhook_adapter_v1.js";
import { emailAdapterV1 } from "./adapters/email_adapter_v1.js";
import { dingtalkAdapterV1 } from "./adapters/dingtalk_adapter_v1.js";

const registry: Record<string, any> = {
  webhook: webhookAdapterV1,
  email: emailAdapterV1,
  dingtalk: dingtalkAdapterV1,
};

function normalizeChannelConfig(ch: any): { type: string; config: any } {
  const type = String(ch?.type || ch || "").trim().toLowerCase();

  if (ch && typeof ch === "object" && !Array.isArray(ch)) {
    return { type, config: ch };
  }

  if (type === "webhook") {
    return {
      type,
      config: {
        type,
        url: process.env.ALERT_WEBHOOK_URL || "",
      },
    };
  }

  if (type === "email") {
    return {
      type,
      config: {
        type,
        to: process.env.ALERT_EMAIL_TO || "",
      },
    };
  }

  if (type === "dingtalk") {
    return {
      type,
      config: {
        type,
        webhook: process.env.ALERT_DINGTALK_WEBHOOK_URL || "",
      },
    };
  }

  return { type, config: ch };
}

export async function dispatchAlertNotifications(payload: AlertNotificationPayload, channels: any[]) {
  const results: any[] = [];

  for (const ch of channels || []) {
    const { type, config } = normalizeChannelConfig(ch);
    const adapter = registry[type];

    if (!adapter) {
      results.push({ channel: type, ok: false, error: "unknown_channel" });
      continue;
    }

    const r = await adapter.send(payload, config);
    results.push({ channel: type, ...r });
  }

  return results;
}