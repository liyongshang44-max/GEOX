import React from "react";
import { Link, useParams } from "react-router-dom";
import { DetailAside, PageHeader, SectionCard, StatusPill } from "../shared/ui";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import OperationAcceptanceCard from "../components/operations/OperationAcceptanceCard";
import OperationStoryTimeline from "../components/operations/OperationStoryTimeline";
import { useOperationDetail } from "../hooks/useOperationDetail";
import { buildOperationDetailViewModel } from "../viewmodels/operationDetailViewModel";
import { executeOperationAction } from "../api/operations";
import { mapOperationActionLabel, mapOperationStatusLabel, mapDeviceDisplayName, mapFieldDisplayName, toBusinessExecutionNarrative } from "../lib/operationLabels";
import { toBusinessTimelineLabel } from "../viewmodels/timelineLabels";

const COPY = {
  backToList: "返回作业列表",
};

const TIMELINE_ORDER = [
  { key: "RECOMMENDATION", label: "建议产生" },
  { key: "APPROVAL_REQUEST", label: "审批请求" },
  { key: "APPROVAL_RESULT", label: "审批结果" },
  { key: "DISPATCH", label: "作业下发" },
  { key: "ACK", label: "ACK" },
  { key: "EXECUTING", label: "执行中" },
  { key: "RECEIPT", label: "回执" },
  { key: "ACCEPTANCE", label: "验收" },
] as const;

function CollapsibleModule({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <details className="operationFoldModule" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="operationFoldBody">{children}</div>
    </details>
  );
}

function formatMaybeNumber(value: unknown): string {
  const n = Number(value ?? NaN);
  if (!Number.isFinite(n)) return "--";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const { loading, error, detail, reload } = useOperationDetail(operationPlanId);
  const model = React.useMemo(() => {
    try {
      return buildOperationDetailViewModel({ detail });
    } catch {
      return buildOperationDetailViewModel({});
    }
  }, [detail]);

  if (loading) return <SectionSkeleton kind="detail" />;
  const errorText = String(error ?? "").toLowerCase();
  const permissionDenied = errorText.includes("403") || errorText.includes("forbidden") || errorText.includes("permission");
  if (permissionDenied) {
    return <ErrorState title="你没有权限查看此内容" message="当前账号无法访问该对象或执行该动作，请联系管理员开通权限。" onRetry={() => window.history.back()} secondaryText="返回作业列表" onSecondary={() => window.location.assign("/operations")} />;
  }
  if (error || !detail) {
    return <ErrorState title="页面加载失败" message={error || "未找到对应作业"} onRetry={() => void reload()} secondaryText="返回作业列表" onSecondary={() => window.location.assign("/operations")} />;
  }

  const topStatusLabel = mapOperationStatusLabel(model.finalStatus);
  const actionLabel = mapOperationActionLabel(model.actionLabel);
  const fieldSource = (detail as any)?.field_id || (detail as any)?.field_name || model.fieldLabel;
  const deviceSource = (detail as any)?.task?.device_id || (detail as any)?.device_id || model.execution.deviceId || model.deviceLabel;
  const fieldLabel = mapFieldDisplayName(fieldSource, model.fieldLabel);
  const deviceLabel = mapDeviceDisplayName(deviceSource, model.deviceLabel);

  const executionPlan = (detail as any)?.execution_plan ?? null;
  const executionReady = Boolean((detail as any)?.execution_ready);
  const executionTrace = (detail as any)?.execution_trace ?? {};
  const executionContext = (detail as any)?.execution_context ?? {};
  const valueAttribution = (detail as any)?.value_attribution_v1 ?? null;
  const traceGap = (detail as any)?.trace_gap ?? { missing_receipt: false, missing_evidence: false };
  const acceptanceVerdict = String((detail as any)?.operation?.acceptance?.verdict ?? "PENDING").toUpperCase();
  const notExecutedYet = !executionTrace?.task_id && !model.receiptEvidence;

  const [executing, setExecuting] = React.useState(false);
  const [runFeedback, setRunFeedback] = React.useState<string>("");
  const runFromDetail = async (): Promise<void> => {
    if (!executionReady || !executionPlan) return;
    setExecuting(true);
    setRunFeedback("");
    try {
      const res = await executeOperationAction({
        tenant_id: String(executionContext?.tenant_id ?? ""),
        project_id: String(executionContext?.project_id ?? ""),
        group_id: String(executionContext?.group_id ?? ""),
        operation_id: String(model.operationPlanId || operationPlanId),
        execution_plan: executionPlan,
      });
      setRunFeedback(res?.ok ? `已触发执行任务 ${res.act_task_id ?? "-"}` : `执行失败：${res?.error ?? "UNKNOWN_ERROR"}`);
      await reload();
    } finally {
      setExecuting(false);
    }
  };

  const mappedTimeline = (model.timeline ?? []).map((item) => ({
    ...item,
    label: item.label || toBusinessTimelineLabel(item.kind),
    normKind: String(item.kind ?? "").toUpperCase(),
  }));
  const timelineItems = TIMELINE_ORDER.map((step, idx) => {
    const matched = mappedTimeline.find((item) => {
      if (step.key === "RECOMMENDATION") return item.normKind.includes("RECOMMENDATION");
      if (step.key === "APPROVAL_REQUEST") return item.normKind.includes("APPROVAL_REQUEST");
      if (step.key === "APPROVAL_RESULT") return item.normKind.includes("APPROVAL") && !item.normKind.includes("REQUEST");
      if (step.key === "DISPATCH") return item.normKind.includes("PLAN") || item.normKind.includes("DISPATCH");
      if (step.key === "ACK") return item.normKind.includes("ACK");
      if (step.key === "EXECUTING") return item.normKind.includes("TASK");
      if (step.key === "RECEIPT") return item.normKind.includes("RECEIPT");
      if (step.key === "ACCEPTANCE") return item.normKind.includes("ACCEPT");
      return false;
    });
    return {
      id: matched?.id || `fixed-${step.key}`,
      kind: step.key,
      label: step.label,
      status: matched ? matched.status : "PENDING",
      occurredAtLabel: matched?.occurredAtLabel || "未发生",
      actorLabel: matched?.actorLabel || "未发生",
      summary: matched?.summary || "未发生",
      storySummary: matched?.storySummary || "未发生",
    };
  }).map((item, idx) => ({ ...item, id: `${item.id}-${idx}` }));

  const isInvalidExecution = String(model.execution.finalStatus ?? model.finalStatus ?? "").toUpperCase() === "INVALID_EXECUTION";
  const isEvidenceMissing = Boolean(traceGap?.missing_evidence) || !model.receiptEvidence;
  const isPendingAcceptance = acceptanceVerdict === "PENDING";

  return (
    <div className="demoDashboardPage operationPageClosure">
      <PageHeader
        eyebrow="GEOX / 作业页收口"
        title={`${actionLabel} · ${fieldLabel}`}
        description={toBusinessExecutionNarrative(model.finalStatus)}
        actions={[
          { label: topStatusLabel },
          { label: COPY.backToList, to: "/operations" },
          { label: "刷新", onClick: () => void reload() },
        ]}
      />

      <SectionCard title="作业关键信息">
        <div className="operationsSummaryGrid detailSummaryGridV3">
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">田块</span><strong>{fieldLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备</span><strong>{deviceLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{model.execution.progressLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">更新时间</span><strong>{model.latestUpdatedAtLabel}</strong></div>
        </div>
      </SectionCard>

      <section className="operationDetailTwoColumn">
        <div className="operationTimelineColumn">
          <SectionCard title="执行时间线">
            <div className="operationTimelineWrap" style={{ marginTop: 10 }}>
              <OperationStoryTimeline items={timelineItems} />
            </div>
          </SectionCard>

          {(isInvalidExecution || isEvidenceMissing || isPendingAcceptance) ? (
            <section className="card operationAlertCard">
              <div className="sectionTitle">重点状态提醒</div>
              <div className="operationStatusPills">
                {isInvalidExecution ? <StatusPill tone="danger">执行无效</StatusPill> : null}
                {isEvidenceMissing ? <StatusPill tone="warning">证据缺失</StatusPill> : null}
                {isPendingAcceptance ? <StatusPill tone="info">待验收</StatusPill> : null}
              </div>
              {isInvalidExecution ? (
                <div className="operationWarningBlock danger">
                  <div>⚠️ 当前执行结果被判定为无效，请补充正式证据或重新执行。</div>
                  <div className="operationWarningActions">
                    <button className="btn danger" type="button" disabled={!executionReady || executing} onClick={() => { void runFromDetail(); }}>
                      {executing ? "执行中..." : "立即重试执行"}
                    </button>
                    <button className="btn" type="button" onClick={() => void reload()}>刷新状态</button>
                  </div>
                </div>
              ) : null}
              {isEvidenceMissing ? (
                <div className="operationWarningBlock warning">
                  <div>⚠️ 证据链不完整，暂不能完成闭环验收。</div>
                  <div className="operationWarningActions">
                    <Link className="btn warning" to={`/evidence?operation_plan_id=${encodeURIComponent(String(model.operationPlanId || operationPlanId))}`}>去补证据</Link>
                    <button className="btn" type="button" onClick={() => void reload()}>刷新状态</button>
                  </div>
                </div>
              ) : null}
              {isPendingAcceptance ? (
                <div className="operationWarningBlock pending">
                  <div>⚠️ 已进入验收前状态，请尽快完成验收结论。</div>
                  <div className="operationWarningActions">
                    <Link className="btn pending" to="/operations?status=done_unaccepted">去验收</Link>
                    <Link className="btn" to={`/evidence?operation_plan_id=${encodeURIComponent(String(model.operationPlanId || operationPlanId))}`}>查看证据</Link>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="card" style={{ marginTop: 12 }}>
            <div className="sectionTitle">执行过程</div>
            {notExecutedYet ? (
              <div className="decisionItemStatic" style={{ marginTop: 10 }}>
                尚未执行。下一步：先确认设备在线与审批状态，然后点击“一键执行”发起任务。
              </div>
            ) : null}
            <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
              <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行模式</span><strong>{model.execution.executionModeLabel}</strong></div>
              <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行器</span><strong>{model.execution.executorLabel}</strong></div>
              <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">Task ID</span><strong>{executionTrace?.task_id || "--"}</strong></div>
              <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行就绪</span><strong>{executionReady ? "是" : "否"}</strong></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn" type="button" disabled={!executionReady || executing} onClick={() => { void runFromDetail(); }}>
                {executing ? "执行中..." : "一键执行"}
              </button>
              {runFeedback ? <span className="muted" style={{ marginLeft: 10 }}>{runFeedback}</span> : null}
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <div className="sectionTitle">闭环信息（可折叠）</div>
            <CollapsibleModule title="建议依据" defaultOpen>
              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">触发规则</span><strong>{model.recommendationBasis.ruleId || "--"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">作物阶段</span><strong>{model.recommendationBasis.cropStage || "--"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">原因代码</span><strong>{model.recommendationBasis.reasonCodesLabel || "--"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">建议摘要</span><strong>{model.recommendation.summary}</strong></div>
              </div>
            </CollapsibleModule>
            <CollapsibleModule title="审批内容">
              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">审批编号</span><strong>{model.approval.requestId}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">审批结论</span><strong>{model.approval.decisionLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">审批人</span><strong>{model.approval.actorLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">审批时间</span><strong>{model.approval.decidedAtLabel}</strong></div>
              </div>
            </CollapsibleModule>
            <CollapsibleModule title="调度参数">
              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行模式</span><strong>{model.execution.executionModeLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行主体</span><strong>{model.execution.executorLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备 ID</span><strong>{model.execution.deviceId || "--"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">下发时间</span><strong>{model.execution.dispatchedAtLabel}</strong></div>
              </div>
            </CollapsibleModule>
            <CollapsibleModule title="执行回执">
              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">ACK 状态</span><strong>{model.execution.ackStatusLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">ACK 时间</span><strong>{model.execution.ackedAtLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行进度</span><strong>{model.execution.progressLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最终状态</span><strong>{model.execution.finalStatusLabel}</strong></div>
              </div>
            </CollapsibleModule>
            <CollapsibleModule title="验收结果">
              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">验收状态</span><strong>{model.acceptance.statusLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">缺失项</span><strong>{model.acceptance.missingEvidenceLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">验收摘要</span><strong>{model.acceptance.summary}</strong></div>
              </div>
            </CollapsibleModule>
            <CollapsibleModule title="证据下载">
              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">包状态</span><strong>{model.evidenceExport.bundleStatusLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近导出</span><strong>{model.evidenceExport.latestExportedAtLabel}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">正式证据</span><strong>{model.evidenceExport.formalEvidenceCount}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">调试证据</span><strong>{model.evidenceExport.debugEvidenceCount}</strong></div>
              </div>
            </CollapsibleModule>
          </section>
        </div>

        <DetailAside title="Detail Aside">
          <div className="sectionTitle">Detail Aside</div>
          <div className="operationAsideBody">
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{topStatusLabel}</strong></div>
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">验收</span><strong>{model.acceptance.statusLabel}</strong></div>
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">证据完整性</span><strong>{isEvidenceMissing ? "缺失" : "完整"}</strong></div>
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">证据包状态</span><strong>{model.evidenceExport.bundleStatusLabel}</strong></div>
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">证据缺失项</span><strong>{model.acceptance.missingEvidenceLabel}</strong></div>
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">验收摘要</span><strong>{model.acceptance.summary}</strong></div>
            <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">下一步</span><strong>{model.nextStepHint || "按时间线逐项推进"}</strong></div>
          </div>
          <div className="operationAsideActions">
            <button className="btn" type="button" disabled={!executionReady || executing} onClick={() => { void runFromDetail(); }}>
              {executing ? "执行中..." : "一键执行"}
            </button>
            <button className="btn" type="button" onClick={() => void reload()}>刷新状态</button>
            <Link className="btn" to={`/evidence?operation_plan_id=${encodeURIComponent(String(model.operationPlanId || operationPlanId))}`}>证据中心</Link>
          </div>
        </DetailAside>
      </section>

      <section className="card operationEvidenceMain" style={{ marginTop: 12 }}>
        <div className="sectionTitle">证据与验收（整合）</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">验收状态</span><strong>{model.acceptance.statusLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">证据包状态</span><strong>{model.evidenceExport.bundleStatusLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">正式证据</span><strong>{model.evidenceExport.formalEvidenceCount}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">调试证据</span><strong>{model.evidenceExport.debugEvidenceCount}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">缺失项</span><strong>{model.acceptance.missingEvidenceLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">验收摘要</span><strong>{model.acceptance.summary}</strong></div>
        </div>
        {model.receiptEvidence ? (
          <div className="demoContentGrid" style={{ marginTop: 10 }}>
            <ReceiptEvidenceCard data={model.receiptEvidence} actionLabel={actionLabel} executorTypeLabel={model.execution.executorTypeLabel} finalStatus={model.finalStatus} />
            <OperationAcceptanceCard model={model} />
          </div>
        ) : (
          <>
            <div className="detailSectionLead" style={{ marginTop: 8 }}>当前缺少完整证据，请先补齐回执后再验收。</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => void reload()}>刷新状态</button>
              <Link className="btn" to={`/evidence?operation_plan_id=${encodeURIComponent(String(model.operationPlanId || operationPlanId))}`}>去证据中心</Link>
            </div>
          </>
        )}
        {acceptanceVerdict === "PENDING" ? (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="detailSectionLead">验收尚未完成，请继续跟进证据完整性与约束结果。</div>
            <Link className="btn pending" to="/operations?status=done_unaccepted">快速进入验收</Link>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">价值影响</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">预期影响</span><strong>{model.businessEffect.expectedImpact}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">实际影响</span><strong>{model.actualOutcomeLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">不执行风险</span><strong>{model.businessEffect.riskIfNotExecute}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">归因结论</span><strong>{String(valueAttribution?.outcome?.effect_verdict ?? "--")}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">证据缺口</span><strong>{traceGap?.missing_evidence ? "存在" : "无"}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">审计附录</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">建议编号</span><strong>{model.technicalRefs.recommendationId}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">审批编号</span><strong>{model.technicalRefs.approvalRequestId}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">作业计划编号</span><strong>{model.technicalRefs.operationPlanId}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行任务编号</span><strong>{model.technicalRefs.actTaskId}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">效果前值</span><strong>{formatMaybeNumber((detail as any)?.agronomy?.before_metrics?.soil_moisture)}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">效果后值</span><strong>{formatMaybeNumber((detail as any)?.agronomy?.after_metrics?.soil_moisture)}</strong></div>
        </div>
      </section>
    </div>
  );
}
