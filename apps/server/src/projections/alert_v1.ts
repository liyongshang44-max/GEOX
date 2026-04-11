import crypto from "node:crypto";

export const AlertSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AlertStatus = {
  OPEN: "OPEN",
  ACKED: "ACKED",
  CLOSED: "CLOSED",
} as const;

export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export type AlertObjectType = "OPERATION" | "DEVICE" | "FIELD" | "SYSTEM";

export type AlertSourceRefV1 = {
  type: string;
  id: string;
  uri?: string;
  ts_ms?: number;
};

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

export function buildStableAlertId(input: {
  category: string;
  object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
}): string {
  const raw = [
    String(input.category ?? "").trim().toUpperCase(),
    String(input.object_id ?? "").trim(),
    String(input.tenant_id ?? "").trim(),
    String(input.project_id ?? "").trim(),
    String(input.group_id ?? "").trim(),
  ].join("|");
  const hash = crypto.createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
  return `alert_${hash}`;
}

export function createAlertV1(input: Omit<AlertV1, "type" | "version" | "status" | "reasons" | "alert_id" | "title" | "message" | "source_refs"> & {
  status?: AlertStatus;
  title?: string;
  message?: string;
  reasons?: string[] | null;
  source_refs?: AlertSourceRefV1[] | null;
  alert_id?: string;
}): AlertV1 {
  const normalizedReasons = Array.isArray(input.reasons)
    ? input.reasons.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
  const title = String(input.title ?? input.category ?? "ALERT").trim() || "ALERT";
  const message = String(input.message ?? input.recommended_action ?? title).trim() || title;

  return {
    type: "alert_v1",
    version: "v1",
    alert_id: input.alert_id
      ?? buildStableAlertId({
        category: input.category,
        object_id: input.object_id,
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
      }),
    category: input.category,
    severity: input.severity,
    status: input.status ?? AlertStatus.OPEN,
    title,
    message,
    recommended_action: input.recommended_action,
    reasons: normalizedReasons,
    source_refs: Array.isArray(input.source_refs)
      ? input.source_refs.filter((x) => x && typeof x.type === "string" && typeof x.id === "string")
      : [],
    triggered_at: input.triggered_at,
    object_type: input.object_type,
    object_id: input.object_id,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
  };
}
