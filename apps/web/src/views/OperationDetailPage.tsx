import React from "react";
import { Link, useParams } from "react-router-dom";
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

  const timelineItems = (model.timeline ?? []).map((item) => ({
    ...item,
    label: item.label || toBusinessTimelineLabel(item.kind),
  }));

  return (
    <div className="demoDashboardPage operationPageClosure">
      <section className="card detailHeroCard detailHeroCardV3">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 作业页收口</div>
            <h1 className="demoHeroTitle" style={{ marginTop: 6 }}>{actionLabel} · {fieldLabel}</h1>
            <p className="demoHeroSubTitle">{toBusinessExecutionNarrative(model.finalStatus)}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="traceChip traceChipLive">{topStatusLabel}</span>
            <Link className="btn" to="/operations">{COPY.backToList}</Link>
            {notExecutedYet ? <Link className="btn" to="/agronomy/recommendations">返回待处理建议</Link> : null}
            {notExecutedYet ? <Link className="btn" to={`/fields/${encodeURIComponent(String((detail as any)?.field_id ?? model.fieldLabel ?? ""))}`}>查看田块</Link> : null}
            <button className="btn" type="button" onClick={() => void reload()}>刷新</button>
          </div>
        </div>
        <div className="operationsSummaryGrid detailSummaryGridV3">
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">田块</span><strong>{fieldLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备</span><strong>{deviceLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{model.execution.progressLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">更新时间</span><strong>{model.latestUpdatedAtLabel}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">决策依据</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">触发规则</span><strong>{model.recommendationBasis.ruleId || "--"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">作物阶段</span><strong>{model.recommendationBasis.cropStage || "--"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">原因代码</span><strong>{model.recommendationBasis.reasonCodesLabel || "--"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">建议摘要</span><strong>{model.recommendation.summary}</strong></div>
        </div>
      </section>

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
        <div className="operationTimelineWrap" style={{ marginTop: 10 }}>
          <OperationStoryTimeline items={timelineItems} />
        </div>
      </section>

      <section className="card operationEvidenceMain" style={{ marginTop: 12 }}>
        <div className="sectionTitle">证据与验收</div>
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
              <Link className="btn" to="/devices">查看设备</Link>
              <Link className="btn" to={`/evidence?operation_plan_id=${encodeURIComponent(String(model.operationPlanId || operationPlanId))}`}>查看回执</Link>
            </div>
          </>
        )}
        {acceptanceVerdict === "PENDING" ? <div className="detailSectionLead" style={{ marginTop: 8 }}>验收尚未完成，请继续跟进证据完整性与约束结果。</div> : null}
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
