import type { SessionMe } from "../api/session";

export type OperatorPermissionKey = "approve" | "dispatch" | "acceptance" | "ack" | "close_alert" | "export_evidence" | "revoke_device_credential";

const MAP: Record<OperatorPermissionKey, { label: string; pick: (p: SessionMe["permissions"] | null | undefined) => boolean }> = {
  approve: { label: "operator_approve", pick: (p) => Boolean(p?.operator_approve) },
  dispatch: { label: "operator_dispatch", pick: (p) => Boolean(p?.operator_dispatch) },
  acceptance: { label: "operator_acceptance", pick: (p) => Boolean(p?.operator_acceptance) },
  ack: { label: "operator_alert_ack_close", pick: (p) => Boolean(p?.operator_alert_ack_close) },
  close_alert: { label: "operator_alert_ack_close", pick: (p) => Boolean(p?.operator_alert_ack_close) },
  export_evidence: { label: "operator_evidence_export", pick: (p) => Boolean(p?.operator_evidence_export) },
  revoke_device_credential: { label: "admin_device_revoke", pick: (p) => Boolean(p?.admin_device_revoke) },
};

export function hasOperatorPermission(session: SessionMe | null, key: OperatorPermissionKey): boolean {
  if (!session) return false;
  return MAP[key].pick(session.permissions);
}

export function permissionReason(session: SessionMe | null, key: OperatorPermissionKey): string {
  if (!session) return "未登录或会话失效，请重新登录后重试。";
  if (hasOperatorPermission(session, key)) return "";
  return `缺少会话权限：${MAP[key].label}`;
}
