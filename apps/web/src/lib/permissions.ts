import type { SessionMe } from "../api/session";

export type OperatorPermissionKey = "approve" | "dispatch" | "acceptance" | "ack" | "close_alert" | "export_evidence" | "revoke_device_credential";

const MAP: Record<OperatorPermissionKey, { label: string; pick: (p: SessionMe["permissions"] | null | undefined) => boolean; scopes: string[] }> = {
  approve: { label: "operator_approve", pick: (p) => Boolean(p?.operator_approve), scopes: ["approval.decide"] },
  dispatch: { label: "operator_dispatch", pick: (p) => Boolean(p?.operator_dispatch), scopes: ["ao_act.task.write", "action.task.dispatch"] },
  acceptance: { label: "operator_acceptance", pick: (p) => Boolean(p?.operator_acceptance), scopes: ["acceptance.evaluate"] },
  ack: { label: "operator_alert_ack_close", pick: (p) => Boolean(p?.operator_alert_ack_close), scopes: ["action.receipt.submit", "ao_act.receipt.write"] },
  close_alert: { label: "operator_alert_ack_close", pick: (p) => Boolean(p?.operator_alert_ack_close), scopes: ["alerts.write"] },
  export_evidence: { label: "operator_evidence_export", pick: (p) => Boolean(p?.operator_evidence_export), scopes: ["evidence_export.read", "evidence_export.write"] },
  revoke_device_credential: { label: "admin_device_revoke", pick: (p) => Boolean(p?.admin_device_revoke), scopes: ["devices.credentials.revoke"] },
};

export function hasOperatorPermission(session: SessionMe | null, key: OperatorPermissionKey): boolean {
  if (!session) return false;
  if (session.permissions) return MAP[key].pick(session.permissions);
  const scopes = new Set((session.scopes ?? []).map((x) => String(x || "").trim()).filter(Boolean));
  return MAP[key].scopes.some((scope) => scopes.has(scope));
}

export function permissionReason(session: SessionMe | null, key: OperatorPermissionKey): string {
  if (!session) return "未登录或会话失效，请重新登录后重试。";
  if (hasOperatorPermission(session, key)) return "";
  return `缺少会话权限：${MAP[key].label}`;
}
