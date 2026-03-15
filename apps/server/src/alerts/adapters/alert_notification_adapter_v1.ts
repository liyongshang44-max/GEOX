export interface AlertNotificationPayload {
  tenant_id: string;
  rule_id: string;
  event_id: string;
  message: string;
}

export interface AlertNotificationAdapter {
  channel: string;
  send(payload: AlertNotificationPayload, config: any): Promise<{ ok: boolean; error?: string }>;
}
