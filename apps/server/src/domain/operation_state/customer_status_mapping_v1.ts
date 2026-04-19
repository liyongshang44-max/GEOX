export type CustomerViewStatus = "PENDING_APPROVAL" | "IN_PROGRESS" | "PENDING_RECEIPT" | "PENDING_ACCEPTANCE" | "COMPLETED" | "INVALID_EXECUTION";

export function operationStatusLabelV1(s: string | null): string {
  const code = String(s ?? "").trim().toUpperCase();
  if (!code) return "待推进";
  if (code === "PENDING_ACCEPTANCE") return "待验收";
  if (code === "INVALID_EXECUTION") return "执行无效";
  if (["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED"].includes(code)) return "执行成功";
  if (["FAILED", "ERROR", "NOT_EXECUTED", "REJECTED"].includes(code)) return "执行失败";
  if (["RUNNING", "DISPATCHED", "ACKED", "APPROVED", "READY", "IN_PROGRESS"].includes(code)) return "执行中";
  if (["PENDING", "CREATED", "PROPOSED", "PENDING_APPROVAL"].includes(code)) return "待审批";
  return code;
}

export function resolveCustomerViewStatusV1(input: {
  final_status: string | null;
  has_approval: boolean;
  has_task: boolean;
  has_receipt: boolean;
  has_acceptance: boolean;
  invalid_execution: boolean;
}): CustomerViewStatus {
  if (input.invalid_execution) return "INVALID_EXECUTION";
  const finalStatus = String(input.final_status ?? "").trim().toUpperCase();
  if (!input.has_approval && !input.has_task) return "PENDING_APPROVAL";
  if (["SUCCEEDED", "SUCCESS", "DONE", "EXECUTED"].includes(finalStatus) || input.has_acceptance) return "COMPLETED";
  if (finalStatus === "PENDING_ACCEPTANCE") return "PENDING_ACCEPTANCE";
  if (input.has_receipt) return "PENDING_ACCEPTANCE";
  if (input.has_task && !input.has_receipt) return "PENDING_RECEIPT";
  return "IN_PROGRESS";
}

export function customerViewByStatusV1(status: CustomerViewStatus): { summary: string; today_action: string; risk_level: "low" | "medium" | "high" } {
  switch (status) {
    case "PENDING_APPROVAL":
      return {
        summary: "当前建议待审批，尚未进入执行阶段",
        today_action: "下一步：等待审批",
        risk_level: "medium",
      };
    case "IN_PROGRESS":
      return {
        summary: "作业执行中，系统正在持续采集进度",
        today_action: "保持设备在线并关注执行状态",
        risk_level: "medium",
      };
    case "PENDING_RECEIPT":
      return {
        summary: "作业已下发，等待回执数据",
        today_action: "督促执行端回传回执与证据",
        risk_level: "medium",
      };
    case "PENDING_ACCEPTANCE":
      return {
        summary: "已收到执行数据，待验收确认",
        today_action: "下一步：进入验收",
        risk_level: "low",
      };
    case "COMPLETED":
      return {
        summary: "作业已完成并形成闭环",
        today_action: "继续观察效果并归档证据",
        risk_level: "low",
      };
    case "INVALID_EXECUTION":
    default:
      return {
        summary: "本次作业未被系统认定为有效执行",
        today_action: "需重新执行或补充证据",
        risk_level: "high",
      };
  }
}
