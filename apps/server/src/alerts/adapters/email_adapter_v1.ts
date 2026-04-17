import type { AlertNotificationAdapter, AlertNotificationPayload } from "./alert_notification_adapter_v1.js";

export const emailAdapterV1: AlertNotificationAdapter = {
  channel: "email",
  async send(payload: AlertNotificationPayload, config: any) {
    const to = String(config?.to || "");
    if (!to) return { ok: false, error: "missing_email_to" };
    console.log("[alert-email]", { to, ...payload });
    return { ok: true };
  },
};
