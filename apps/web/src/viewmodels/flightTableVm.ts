import type {
  FlightTableCredentialRefV1,
  FlightTableLaneV1,
  FlightTableManifestV1,
  FlightTableRunStatusV1,
  FlightTableRunV1,
  FlightTableStepStatusV1,
} from "../api/flightTable";

export function flightTableStatusLabel(status: FlightTableRunStatusV1 | string | undefined): string {
  switch (status) {
    case "DRAFT": return "草稿";
    case "READY": return "已就绪";
    case "RUNNING": return "运行中";
    case "PASS": return "通过";
    case "FAIL": return "失败";
    case "CLEANED": return "已清理";
    default: return "未知";
  }
}

export function flightTableStepStatusLabel(status: FlightTableStepStatusV1 | string | undefined): string {
  switch (status) {
    case "PENDING": return "待执行";
    case "RUNNING": return "运行中";
    case "PASS": return "通过";
    case "FAIL": return "失败";
    case "SKIPPED": return "跳过";
    default: return "未知";
  }
}

export function flightTableLaneLabel(lane: FlightTableLaneV1 | string | undefined): string {
  switch (lane) {
    case "success": return "成功航线";
    case "evidence_insufficient": return "证据不足航线";
    case "weather_interference": return "天气干扰航线";
    case "skill_failure": return "技能失败航线";
    case "all": return "全航线";
    default: return "未选择";
  }
}

export function flightTablePermissionLabel(error?: string | null): string {
  if (!error) return "需要 security.admin 权限";
  if (error.includes("FLIGHT_TABLE_DISABLED")) return "飞行台 API 未启用";
  if (error.includes("AUTH_SCOPE_DENIED") || error.includes("AUTH_ROLE_SCOPE_DENIED")) return "当前会话缺少 security.admin 权限";
  if (error.includes("AUTH_MISSING") || error.includes("AUTH_INVALID")) return "登录状态无效或缺少 Bearer token";
  return "飞行台权限或服务状态异常";
}

export function normalizeFlightTableStepStatus(status: string | undefined): FlightTableStepStatusV1 {
  if (status === "RUNNING" || status === "PASS" || status === "FAIL" || status === "SKIPPED") return status;
  return "PENDING";
}

export function maskFlightTableCredential(input: Partial<FlightTableCredentialRefV1>): FlightTableCredentialRefV1 | null {
  const credential_id = typeof input.credential_id === "string" ? input.credential_id.trim() : "";
  if (!credential_id) return null;
  return {
    credential_id,
    status: typeof input.status === "string" && input.status.trim() ? input.status.trim() : "UNKNOWN",
    issued_at: typeof input.issued_at === "string" && input.issued_at.trim() ? input.issued_at.trim() : undefined,
    masked_secret: "****",
  };
}

export function flightTableUiReplayUrls(run: FlightTableRunV1 | null): Array<{ label: string; url: string; enabled: boolean }> {
  const fieldId = run?.manifest.field_id ?? "";
  const operationId = run?.manifest.operation_plan_ids?.[0] ?? "";
  return [
    { label: "客户看板", url: "/customer/dashboard", enabled: true },
    { label: "地块病历", url: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "", enabled: Boolean(fieldId) },
    { label: "作业报告", url: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "", enabled: Boolean(operationId) },
    { label: "运营调度", url: operationId ? `/operator/dispatch?operation_id=${encodeURIComponent(operationId)}` : "/operator/dispatch", enabled: true },
    { label: "运营证据", url: operationId ? `/operator/evidence?operation_id=${encodeURIComponent(operationId)}` : "/operator/evidence", enabled: true },
  ];
}

export function summarizeFlightTableManifest(manifest: FlightTableManifestV1 | null): Array<{ label: string; value: string }> {
  if (!manifest) return [];
  return [
    { label: "田块对象", value: manifest.field_id ? "已记录" : "未创建" },
    { label: "田块空间", value: manifest.geometry_id ? "已记录" : "未上传" },
    { label: "设备接入", value: `${manifest.device_ids.length} 台设备 / ${manifest.credential_ids.length} 个凭证` },
    { label: "技能绑定", value: `${manifest.skill_binding_ids.length} 条绑定` },
  ];
}

export function defaultFlightTableRunId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ft_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
