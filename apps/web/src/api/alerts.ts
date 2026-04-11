import { apiRequest, withQuery } from "./client";

export const ALERT_SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type AlertSeverity = (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY];

export const ALERT_STATUS = {
  OPEN: "OPEN",
  ACKED: "ACKED",
  CLOSED: "CLOSED",
} as const;

export type AlertStatus = (typeof ALERT_STATUS)[keyof typeof ALERT_STATUS];

export type AlertObjectType = "OPERATION" | "DEVICE" | "FIELD" | "SYSTEM";

export type AlertSourceRefV1 = {
  type: string;
  id: string;
  uri?: string;
  ts_ms?: number;
};

// Mirror backend AlertV1 contract (including category/status/severity/reasons/source_refs fields).
export type AlertV1 = {
  type: "alert_v1";
  version: "v1";
  alert_id: string;
  category: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  recommended_action: string;
  reasons: string[];
  source_refs: AlertSourceRefV1[];
  triggered_at: string;
  object_type: AlertObjectType;
  object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type FetchAlertsParams = {
  field_ids?: string[];
  severity?: AlertSeverity;
  status?: AlertStatus;
  category?: string;
};

export type AlertSummaryV1 = {
  ok: boolean;
  total: number;
  by_severity: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  by_status: {
    OPEN: number;
    ACKED: number;
    CLOSED: number;
  };
  by_category: Record<string, number>;
};

export async function fetchAlerts(params: FetchAlertsParams = {}): Promise<AlertV1[]> {
  const payload = await apiRequest<{ ok: boolean; items?: AlertV1[] }>(
    withQuery("/api/v1/alerts", params),
  );
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function fetchAlertSummary(params: FetchAlertsParams = {}): Promise<AlertSummaryV1> {
  return apiRequest<AlertSummaryV1>(withQuery("/api/v1/alerts/summary", params));
}

export async function ackAlert(alertId: string): Promise<{ ok: boolean; alert_id: string; status: AlertStatus; acted_at?: number }> {
  return apiRequest(`/api/v1/alerts/${encodeURIComponent(alertId)}/ack`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function resolveAlert(alertId: string): Promise<{ ok: boolean; alert_id: string; status: AlertStatus; acted_at?: number }> {
  return apiRequest(`/api/v1/alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
