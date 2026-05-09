import type { SessionMe } from "../api/session";

export type OperatorPermissionKey = "approve" | "dispatch" | "acceptance" | "ack" | "close_alert" | "export_evidence" | "revoke_device_credential";

const MAP: Record<OperatorPermissionKey, string[]> = {
  approve: ["approval.decide"],
  dispatch: ["ao_act.task.write", "action.task.dispatch"],
  acceptance: ["acceptance.evaluate"],
  ack: ["action.receipt.submit", "ao_act.receipt.write"],
  close_alert: ["alerts.write"],
  export_evidence: ["evidence_export.read", "evidence_export.write"],
  revoke_device_credential: ["devices.credentials.revoke"],
};

export function hasOperatorPermission(session: SessionMe | null, key: OperatorPermissionKey): boolean {
  if (!session) return false;
  const scopes = new Set((session.scopes ?? []).map((x) => String(x || "").trim()).filter(Boolean));
  return MAP[key].some((scope) => scopes.has(scope));
}

export function permissionReason(session: SessionMe | null, key: OperatorPermissionKey): string {
  if (!session) return "未登录或会话失效，请重新登录后重试。";
  if (hasOperatorPermission(session, key)) return "";
  return `缺少权限范围：${MAP[key].join(" / ")}`;
}
