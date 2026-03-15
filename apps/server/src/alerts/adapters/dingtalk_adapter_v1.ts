import type { AlertNotificationAdapter, AlertNotificationPayload } from "./alert_notification_adapter_v1";

export const dingtalkAdapterV1: AlertNotificationAdapter = {
  channel: "dingtalk",
  async send(payload: AlertNotificationPayload, config: any) {
    try {
      const webhook = String(config?.webhook || "");
      if (!webhook) return { ok: false, error: "missing_dingtalk_webhook" };
      const body = {
        msgtype: "text",
        text: {
          content: `[GEOX ALERT]
tenant=${payload.tenant_id}
rule=${payload.rule_id}
event=${payload.event_id}
${payload.message}`,
        },
      };
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) return { ok: false, error: `dingtalk_http_${r.status}` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "dingtalk_error" };
    }
  },
};
