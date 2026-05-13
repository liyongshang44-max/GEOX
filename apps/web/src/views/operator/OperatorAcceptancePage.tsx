import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorAcceptance, submitOperatorAcceptanceAction, type OperatorAcceptanceActionKind } from "../../api/operatorAcceptance";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import PermissionGate from "../../components/operator/PermissionGate";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorAcceptance.css";
import { replaceOperatorTerms } from "../../lib/operatorStatusLabels";
import { hasOperatorPermission, permissionReason } from "../../lib/permissions";
import { buildOperatorAcceptanceVm, type OperatorAcceptanceGroupVm, type OperatorAcceptanceRowVm, type OperatorAcceptanceVm } from "../../viewmodels/operatorAcceptanceVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

function safeMessage(value: unknown, fallback = "操作失败，请稍后重试。") {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(text)) return fallback;
  return replaceOperatorTerms(text);
}

function DisabledAcceptanceButtons({ pending }: { pending: boolean }): React.ReactElement {
  return (
    <>
      <button type="button" disabled>{pending ? "处理中..." : "执行验收"}</button>
      <button type="button" disabled>{pending ? "处理中..." : "发起复核"}</button>
    </>
  );
}

function AcceptanceRow({
  row,
  writeReady,
  actionState,
  onAction,
  sessionAllowed,
  sessionLoading,
  sessionDeniedReason,
}: {
  row: OperatorAcceptanceRowVm;
  writeReady: boolean;
  actionState: { pending: boolean; lastError: string | null };
  onAction: (row: OperatorAcceptanceRowVm, action: OperatorAcceptanceActionKind) => void;
  sessionAllowed: boolean;
  sessionLoading: boolean;
  sessionDeniedReason: string;
}): React.ReactElement {
  const evaluateDisabled = !writeReady || !row.evaluateButtonState.canAction || actionState.pending;
  const reviewDisabled = !writeReady || !row.reviewButtonState.canAction || actionState.pending;
  const notice = sessionDeniedReason || row.evaluateButtonState.disabledReason || row.reviewButtonState.disabledReason || row.disabledReason;

  return (
    <article className="operatorAcceptanceRow">
      <header className="operatorAcceptanceRowHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.objectText}</p>
        </div>
        <span className={`operatorAcceptanceStatus ${row.statusTone}`}>{row.acceptanceStatusText}</span>
      </header>

      <div className="operatorAcceptanceMeta">
        <div><span>状态</span><strong>{row.acceptanceStatusText}</strong></div>
        <div><span>验收结论</span><strong>{row.verdictText}</strong></div>
        <div><span>原因</span><strong>{row.reasonText}</strong></div>
        <div><span>下一步</span><strong>{row.nextActionText}</strong></div>
        <div><span>证据状态</span><strong>{row.evidenceText}</strong></div>
        <div><span>生成时间</span><strong>{row.generatedAtText}</strong></div>
        <div><span>更新时间</span><strong>{row.updatedAtText}</strong></div>
      </div>

      <details className="operationTechDetailsMuted">
        <summary className="operationTechDetailsSummary">技术引用</summary>
        <div className="operatorAcceptanceMeta customerSpacingTopSm">
          <div><span>作业 ID</span><strong>{row.technicalRefs.operationIdText}</strong></div>
          <div><span>验收记录 ID</span><strong>{row.technicalRefs.acceptanceIdText}</strong></div>
          <div><span>作业状态</span><strong>{row.technicalRefs.operationStateText}</strong></div>
          <div><span>数据来源</span><strong>{row.technicalRefs.sourceText}</strong></div>
          <div><span>失败原因</span><strong>{row.failureReasonText}</strong></div>
          <div><span>复核原因</span><strong>{row.reviewReasonText}</strong></div>
        </div>
      </details>

      <div className="operatorAcceptanceNotice">验收状态来自验收记录与作业状态；前端不自行推断最终状态。证据不足不能包装成验收通过，验收失败需要复核或返工。</div>
      {actionState.lastError ? <div className="operatorAcceptanceDisabledReason">{actionState.lastError}</div> : null}

      <div className="operatorAcceptanceActions">
        <Link to={row.operationHref}>查看作业</Link>
        <PermissionGate
          permissionKey="acceptance"
          allowed={sessionAllowed}
          loading={sessionLoading}
          disabledReason={sessionDeniedReason}
          fallback={() => <DisabledAcceptanceButtons pending={actionState.pending} />}
        >
          {() => (
            <>
              <button type="button" disabled={evaluateDisabled} onClick={() => onAction(row, "evaluate")}>{actionState.pending ? "处理中..." : "执行验收"}</button>
              <button type="button" disabled={reviewDisabled} onClick={() => onAction(row, "request-review")}>{actionState.pending ? "处理中..." : "发起复核"}</button>
            </>
          )}
        </PermissionGate>
      </div>
      {notice ? <div className="operatorAcceptanceDisabledReason">{replaceOperatorTerms(notice)}</div> : null}
    </article>
  );
}

function AcceptanceGroup({
  group,
  writeReady,
  getActionState,
  onAction,
  sessionAllowed,
  sessionLoading,
  sessionDeniedReason,
}: {
  group: OperatorAcceptanceGroupVm;
  writeReady: boolean;
  getActionState: (operationId: string) => { pending: boolean; lastError: string | null };
  onAction: (row: OperatorAcceptanceRowVm, action: OperatorAcceptanceActionKind) => void;
  sessionAllowed: boolean;
  sessionLoading: boolean;
  sessionDeniedReason: string;
}): React.ReactElement {
  return (
    <section className="operatorAcceptanceGroup">
      <header className="operatorAcceptanceGroupHead">
        <div>
          <h2>{group.title}</h2>
          <p>{group.description}</p>
        </div>
        <span>{group.count}</span>
      </header>
      {group.rows.length ? (
        <div className="operatorAcceptanceList">
          {group.rows.map((row) => (
            <AcceptanceRow
              key={`${group.key}-${row.operationId}`}
              row={row}
              writeReady={writeReady}
              actionState={getActionState(row.operationId)}
              onAction={onAction}
              sessionAllowed={sessionAllowed}
              sessionLoading={sessionLoading}
              sessionDeniedReason={sessionDeniedReason}
            />
          ))}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类验收事项。</div>}
    </section>
  );
}

export default function OperatorAcceptancePage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.acceptance;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorAcceptanceVm | null>(null);
  const [actionStateByOperation, setActionStateByOperation] = React.useState<Record<string, { pending: boolean; lastError: string | null }>>({});
  const [session, setSession] = React.useState<SessionMe | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);

  const loadAcceptance = React.useCallback(() => {
    setLoading(true);
    return fetchOperatorAcceptance()
      .then((response) => {
        setVm(buildOperatorAcceptanceVm(response));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    let alive = true;
    setSessionLoading(true);
    void fetchSessionMe()
      .then((resp) => { if (alive) setSession(resp); })
      .catch(() => { if (alive) setSession(null); })
      .finally(() => { if (alive) setSessionLoading(false); });
    return () => { alive = false; };
  }, []);
  const sessionAllowed = hasOperatorPermission(session, "acceptance");
  const sessionDeniedReason = sessionAllowed ? "" : (sessionLoading ? "会话权限加载中..." : permissionReason(session, "acceptance"));

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorAcceptance()
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorAcceptanceVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const getActionState = React.useCallback((operationId: string) => {
    return actionStateByOperation[operationId] ?? { pending: false, lastError: null };
  }, [actionStateByOperation]);

  const onAction = React.useCallback((row: OperatorAcceptanceRowVm, action: OperatorAcceptanceActionKind) => {
    const allowed = action === "evaluate" ? row.evaluateButtonState.canAction : row.reviewButtonState.canAction;
    if (!sessionAllowed || !allowed) return;
    setActionStateByOperation((prev) => ({
      ...prev,
      [row.operationId]: { pending: true, lastError: null },
    }));

    void submitOperatorAcceptanceAction(row.operationId, action)
      .then((result) => {
        if (!result.ok) {
          const errorText = safeMessage(result.permission?.reason || result.message || result.error_code);
          setActionStateByOperation((prev) => ({
            ...prev,
            [row.operationId]: { pending: false, lastError: errorText },
          }));
          return;
        }
        setActionStateByOperation((prev) => ({
          ...prev,
          [row.operationId]: { pending: false, lastError: null },
        }));
        return loadAcceptance();
      })
      .catch((error: unknown) => {
        setActionStateByOperation((prev) => ({
          ...prev,
          [row.operationId]: { pending: false, lastError: safeMessage(error instanceof Error ? error.message : error) },
        }));
      });
  }, [loadAcceptance, sessionAllowed]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">验收中心加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorAcceptancePage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>验收事项总数</span><strong>{vm.totalCount}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.writeReady ? <div className="operatorScopeWarning">验收写操作未 ready：后端权限、审计和错误码未完成前，当前页面只读。</div> : null}

          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有验收数据时不伪造验收结论。" /> : null}

          <section className="operatorAcceptanceGrid" aria-label="验收状态分组">
            {vm.groups.map((group) => (
              <AcceptanceGroup
                key={group.key}
                group={group}
                writeReady={vm.writeReady}
                getActionState={getActionState}
                onAction={onAction}
                sessionAllowed={sessionAllowed}
                sessionLoading={sessionLoading}
                sessionDeniedReason={sessionDeniedReason}
              />
            ))}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
