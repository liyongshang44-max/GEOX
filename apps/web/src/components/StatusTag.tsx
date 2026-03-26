import React from "react";

type Tone = "success" | "neutral" | "warning" | "danger";

function toneForStatus(status: string): Tone {
  const raw = String(status || "").toUpperCase();
  if (["DONE", "SUCCEEDED", "SUCCESS", "ACTIVE", "PASS", "APPROVED", "COMPLETED", "ONLINE", "ACKED"].some((x) => raw.includes(x))) return "success";
  if (["FAILED", "ERROR", "BLOCK", "REJECT", "RISK", "OFFLINE"].some((x) => raw.includes(x))) return "danger";
  if (["PENDING", "READY", "RUNNING", "DISPATCH", "WAIT", "REVIEW"].some((x) => raw.includes(x))) return "warning";
  return "neutral";
}

function zhLabel(status: string): string {
  const raw = String(status || "").toUpperCase();
  if (raw === "READY") return "待执行";
  if (raw === "DISPATCHED") return "已下发";
  if (raw === "ACKED") return "已回执";
  if (raw === "SUCCEEDED") return "已完成";
  if (raw === "FAILED") return "执行失败";
  if (raw === "APPROVAL_REQUIRED") return "待审批";
  if (raw === "BLOCKED") return "已阻塞";
  if (raw === "DONE") return "已完成";
  if (raw === "RUNNING") return "处理中";
  return status || "未知状态";
}

export function StatusTag({ status, showCode = true }: { status: string; showCode?: boolean }): React.ReactElement {
  const tone = toneForStatus(status);
  return <span className={`statusTag tone-${tone}`}>{zhLabel(status)}{showCode ? ` · ${String(status || "-").toUpperCase()}` : ""}</span>;
}
