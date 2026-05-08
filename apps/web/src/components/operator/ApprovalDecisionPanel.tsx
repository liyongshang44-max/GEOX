import React from "react";
import type { OperatorApprovalRowVm } from "../../viewmodels/operatorApprovalsVm";

type ApprovalDecisionPanelProps = {
  item: OperatorApprovalRowVm;
  writeReady: boolean;
};

export default function ApprovalDecisionPanel({ item, writeReady }: ApprovalDecisionPanelProps): React.ReactElement {
  const disabledReason = item.selfApprovalRisk
    ? "存在自审批风险，审批动作已阻断。"
    : (!item.canApprove ? item.permissionReason : (!writeReady ? "审批写操作未 ready，当前只读。" : ""));
  const disabled = Boolean(disabledReason);

  return (
    <div className="operatorApprovalDecisionPanel" aria-label="审批决策区">
      {disabledReason ? <div className="operatorApprovalDecisionNotice">{disabledReason}</div> : null}
      <div className="operatorApprovalDecisionActions">
        <button type="button" disabled={disabled}>通过</button>
        <button type="button" disabled={disabled}>拒绝</button>
        <button type="button" disabled={disabled}>退回补充</button>
      </div>
      <small>审批动作不会使用浏览器 confirm；后端权限、审计和错误码未 ready 前保持只读。</small>
    </div>
  );
}
