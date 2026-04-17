import type { AlertNotificationAdapter, AlertNotificationPayload } from "./alert_notification_adapter_v1.js";

export const webhookAdapterV1: AlertNotificationAdapter = {
  channel: "webhook",
  async send(payload: AlertNotificationPayload, config: any) {
    try {
      const url = String(config?.url || "");
      if (!url) return { ok: false, error: "missing_webhook_url" };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) return { ok: false, error: `webhook_http_${r.status}` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "webhook_error" };
    }
  },
};
