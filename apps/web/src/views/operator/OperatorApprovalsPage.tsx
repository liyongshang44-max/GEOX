import React from "react";
import { fetchOperatorApprovals, submitOperatorApprovalAction, type OperatorApprovalActionKind } from "../../api/operatorApprovals";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import { hasOperatorPermission } from "../../lib/permissions";
import { buildOperatorApprovalsVm, type OperatorApprovalRowVm, type OperatorApprovalsVm } from "../../viewmodels/operatorApprovalsVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

type ApprovalSectionProps = {
  title: string;
  description: string;
  rows: OperatorApprovalRowVm[];
  writeReady: boolean;
  getActionState: (approvalRequestId: string) => { pending: boolean; lastError: string | null };
  onAction: (row: OperatorApprovalRowVm, action: OperatorApprovalActionKind) => void;
  sessionAllowed: boolean;
};

function safeMessage(value: unknown, fallback = "操作失败，请稍后重试。") {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(text)) return fallback;
  return text;
}

function ApprovalDecisionActions({
  row,
  writeReady,
  pending,
  lastError,
  onAction,
  sessionAllowed,
}: {
  row: OperatorApprovalRowVm;
  writeReady: boolean;
  pending: boolean;
  lastError: string | null;
  onAction: (action: OperatorApprovalActionKind) => void;
  sessionAllowed: boolean;
}): React.ReactElement {
  const sessionDeniedReason = sessionAllowed ? null : "会话权限不足：operator_approve";
  const disabledReason = row.selfApprovalRisk
    ? "存在自审批风险，审批动作已阻断。"
    : (!writeReady
      ? "审批写操作未 ready，当前只读。"
      : (sessionDeniedReason
        ? sessionDeniedReason
        : (!row.actionButtonState.canAction ? row.actionButtonState.disabledReason || row.permissionReason : null)));
  const disabled = Boolean(disabledReason) || pending;

  return (
    <div className="operatorApprovalDecisionPanel" aria-label="审批决策区">
      {disabledReason ? <div className="operatorApprovalDecisionNotice">{disabledReason}</div> : null}
      {lastError ? <div className="operatorApprovalDecisionNotice">{lastError}</div> : null}
      <div className="operatorApprovalDecisionActions">
        <button type="button" disabled={disabled} onClick={() => onAction("approve")}>{pending ? "处理中..." : "通过"}</button>
        <button type="button" disabled={disabled} onClick={() => onAction("reject")}>{pending ? "处理中..." : "拒绝"}</button>
        <button type="button" disabled={disabled} onClick={() => onAction("return")}>{pending ? "处理中..." : "退回补充"}</button>
      </div>
      <small>审批动作由后端 permission.allowed、审计记录和状态回写共同控制。</small>
    </div>
  );
}

function ApprovalCard({
  row,
  writeReady,
  actionState,
  onAction,
  sessionAllowed,
}: {
  row: OperatorApprovalRowVm;
  writeReady: boolean;
  actionState: { pending: boolean; lastError: string | null };
  onAction: (row: OperatorApprovalRowVm, action: OperatorApprovalActionKind) => void;
  sessionAllowed: boolean;
}): React.ReactElement {
  return (
    <article className="operatorApprovalCard">
      <header className="operatorApprovalCardHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.description}</p>
        </div>
        <span className={`operatorRiskBadge ${row.riskTone}`}>{row.riskText}</span>
      </header>

      <div className="operatorApprovalMetaGrid">
        <div><span>对象</span><strong>{row.objectText}</strong></div>
        <div><span>状态</span><strong>{row.statusText}</strong></div>
        <div><span>发起人</span><strong>{row.requestedByText}</strong></div>
        <div><span>审批人</span><strong>{row.approverText}</strong></div>
        <div><span>更新时间</span><strong>{row.updatedAtText}</strong></div>
        <div><span>来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorPrescriptionBox">
        <div>
          <span>处方查看</span>
          <strong>{row.prescriptionText}</strong>
          <small>建议关联：{row.recommendationText}</small>
        </div>
        <button type="button" disabled={!row.prescriptionHref}>查看处方</button>
      </div>

      <ApprovalDecisionActions
        row={row}
        writeReady={writeReady}
        pending={actionState.pending}
        lastError={actionState.lastError}
        onAction={(action) => onAction(row, action)}
        sessionAllowed={sessionAllowed}
      />
    </article>
  );
}

function ApprovalSection({ title, description, rows, writeReady, getActionState, onAction, sessionAllowed }: ApprovalSectionProps): React.ReactElement {
  return (
    <section className="operatorApprovalSection">
      <header className="operatorApprovalSectionHead">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{rows.length}</span>
      </header>
      {rows.length ? (
        <div className="operatorApprovalList">
          {rows.map((row) => (
            <ApprovalCard
              key={`${title}-${row.approvalRequestId}`}
              row={row}
              writeReady={writeReady}
              actionState={getActionState(row.approvalRequestId)}
              onAction={onAction}
              sessionAllowed={sessionAllowed}
            />
          ))}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类审批事项。</div>}
    </section>
  );
}

export default function OperatorApprovalsPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.approvals;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorApprovalsVm | null>(null);
  const [actionStateById, setActionStateById] = React.useState<Record<string, { pending: boolean; lastError: string | null }>>({});
  const [session, setSession] = React.useState<SessionMe | null>(null);

  const loadApprovals = React.useCallback(() => {
    setLoading(true);
    return fetchOperatorApprovals()
      .then((response) => {
        setVm(buildOperatorApprovalsVm(response));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    let alive = true;
    void fetchSessionMe().then((resp) => { if (alive) setSession(resp); }).catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);

  const sessionAllowed = hasOperatorPermission(session, "approve");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorApprovals()
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorApprovalsVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const getActionState = React.useCallback((approvalRequestId: string) => {
    return actionStateById[approvalRequestId] ?? { pending: false, lastError: null };
  }, [actionStateById]);

  const onAction = React.useCallback((row: OperatorApprovalRowVm, action: OperatorApprovalActionKind) => {
    if (!sessionAllowed || !row.actionButtonState.canAction || row.selfApprovalRisk) return;
    setActionStateById((prev) => ({
      ...prev,
      [row.approvalRequestId]: { pending: true, lastError: null },
    }));

    void submitOperatorApprovalAction(row.approvalRequestId, action)
      .then((result) => {
        if (!result.ok) {
          const errorText = safeMessage(result.permission?.reason || result.message || result.error_code);
          setActionStateById((prev) => ({
            ...prev,
            [row.approvalRequestId]: { pending: false, lastError: errorText },
          }));
          return;
        }
        setActionStateById((prev) => ({
          ...prev,
          [row.approvalRequestId]: { pending: false, lastError: null },
        }));
        return loadApprovals();
      })
      .catch((error: unknown) => {
        setActionStateById((prev) => ({
          ...prev,
          [row.approvalRequestId]: { pending: false, lastError: safeMessage(error instanceof Error ? error.message : error) },
        }));
      });
  }, [loadApprovals, sessionAllowed]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">审批中心加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorApprovalsPage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>审批事项总数</span><strong>{vm.totalCount}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.writeReady ? <div className="operatorScopeWarning">审批写操作未 ready：后端权限、审计和错误码未完成前，审批中心保持只读。</div> : null}

          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有审批数据时不伪造审批事项。" /> : null}

          <div className="operatorApprovalGrid">
            <ApprovalSection title="待审批列表" description="当前需要运营人员处理的审批请求。" rows={vm.pending} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} />
            <ApprovalSection title="高风险处方" description="高风险且关联正式处方的审批事项。" rows={vm.highRiskPrescriptions} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} />
            <ApprovalSection title="无权限审批" description="当前身份不可执行审批动作的事项。" rows={vm.noPermission} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} />
            <ApprovalSection title="自审批风险" description="发起人与审批人存在重合风险的事项。" rows={vm.selfApprovalRisk} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} />
            <ApprovalSection title="审批历史" description="已通过、已拒绝或已退回的审批记录。" rows={vm.history} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} />
          </div>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
