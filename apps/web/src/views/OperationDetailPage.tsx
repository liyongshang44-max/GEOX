
import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import OperationAcceptanceCard from "../components/operations/OperationAcceptanceCard";
import OperationExecutionCard from "../components/operations/OperationExecutionCard";
import OperationImpactCard from "../components/operations/OperationImpactCard";
import OperationRiskCard from "../components/operations/OperationRiskCard";
import OperationStoryTimeline from "../components/operations/OperationStoryTimeline";
import OperationEvidenceDownloadCard from "../components/operations/OperationEvidenceDownloadCard";
import OperationDecisionCard from "../components/operations/OperationDecisionCard";
import OperationRecommendationBasisCard from "../components/operations/OperationRecommendationBasisCard";
import OperationEffectEvaluationCard from "../components/operations/OperationEffectEvaluationCard";
import { useOperationDetail } from "../hooks/useOperationDetail";
import { buildOperationDetailViewModel } from "../viewmodels/operationDetailViewModel";
import { fetchOperationBilling, type OperationBillingResponse } from "../api/operations";
import { mapOperationActionLabel, mapOperationStatusLabel, mapDeviceDisplayName, mapFieldDisplayName } from "../lib/operationLabels";

const COPY = {
  detailUnavailable: "作业详情暂不可用",
  operationNotFound: "未找到对应作业",
  backToList: "返回作业列表",
  executionEvidence: "做了什么（证据）",
};

function buildResultSummary(model: ReturnType<typeof buildOperationDetailViewModel>): string {
  const finalStatus = mapOperationStatusLabel(model.finalStatus);
  if (model.receiptEvidence?.constraintCheckLabel === "符合约束") {
    return `已回传执行结果，当前状态为${finalStatus}，约束校验通过。`;
  }
  if (model.receiptEvidence?.violationSummary && model.receiptEvidence.violationSummary !== "-") {
    return `已回传执行结果，当前状态为${finalStatus}，存在复核提示。`;
  }
  if (!model.receiptEvidence) {
    return `当前状态为${finalStatus}，等待设备回传执行证据。`;
  }
  return `已回传执行结果，当前状态为${finalStatus}。`;
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
  const [billing, setBilling] = React.useState<OperationBillingResponse | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const id = model.operationPlanId || operationPlanId;
    if (!id || id === "-") {
      if (mounted) setBilling(null);
      return () => {
        mounted = false;
      };
    }
    void fetchOperationBilling(id).then((res) => {
      if (mounted) setBilling(res);
    });
    return () => {
      mounted = false;
    };
  }, [model.operationPlanId, operationPlanId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) {
    return <ErrorState title={COPY.detailUnavailable} message={error || COPY.operationNotFound} onRetry={() => void reload()} />;
  }
  const topStatusLabel = mapOperationStatusLabel(model.finalStatus);
  const actionLabel = mapOperationActionLabel(model.actionLabel);
  const fieldSource = (detail as any)?.field_id || (detail as any)?.field_name || model.fieldLabel;
  const deviceSource = (detail as any)?.task?.device_id || (detail as any)?.device_id || model.execution.deviceId || model.deviceLabel;
  const fieldLabel = mapFieldDisplayName(fieldSource, model.fieldLabel);
  const deviceLabel = mapDeviceDisplayName(deviceSource, model.deviceLabel);
  const resultSummary = buildResultSummary(model);
  const decisionRule = model.recommendationBasis.ruleId || model.agronomyDecision.ruleId || "--";
  const decisionRuleVersion = String((detail as any)?.agronomy?.rule_version ?? "").trim();
  const decisionRuleSource = decisionRule !== "--" && decisionRuleVersion
    ? `${decisionRule}_${decisionRuleVersion}`
    : decisionRule;
  const decisionStage = String((detail as any)?.agronomy?.crop_stage ?? model.recommendationBasis.cropStage ?? "--");
  const decisionReason = (() => {
    const reasonCodes = (detail as any)?.agronomy?.reason_codes;
    if (Array.isArray(reasonCodes) && reasonCodes.length > 0) return String(reasonCodes[0]);
    if (Array.isArray(model.recommendation.reasonCodes) && model.recommendation.reasonCodes.length > 0) return String(model.recommendation.reasonCodes[0]);
    return model.recommendationBasis.reasonCodesLabel || "--";
  })();
  const effectBeforeRaw = (detail as any)?.agronomy?.before_metrics?.soil_moisture;
  const effectAfterRaw = (detail as any)?.agronomy?.after_metrics?.soil_moisture;
  const effectBefore = formatMaybeNumber(effectBeforeRaw);
  const effectAfter = formatMaybeNumber(effectAfterRaw);
  const effectDelta = (() => {
    const before = Number(effectBeforeRaw ?? NaN);
    const after = Number(effectAfterRaw ?? NaN);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return "--";
    const delta = after - before;
    return `${delta >= 0 ? "+" : ""}${formatMaybeNumber(delta)}`;
  })();
  const effectVerdict = String((detail as any)?.agronomy?.effect_verdict ?? "").trim().toUpperCase() || "--";

  const billingLabel = billing
    ? billing.billable
      ? `本次作业费用：¥${Number(billing.charge ?? 0).toFixed(2)}`
      : "本次作业费用：¥0（无效执行不计费）"
    : "本次作业费用：--";

  return (
    <div className="demoDashboardPage">
      <section className="card detailHeroCard detailHeroCardV3">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 作业复盘页</div>
            <h1 className="demoHeroTitle" style={{ marginTop: 6 }}>{actionLabel} · {fieldLabel}</h1>
            <p className="demoHeroSubTitle">{resultSummary}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="traceChip traceChipLive">{topStatusLabel}</span>
            <Link className="btn" to="/operations">{COPY.backToList}</Link>
            <button className="btn" type="button" onClick={() => void reload()}>刷新</button>
          </div>
        </div>

        <div className="operationsSummaryGrid detailSummaryGridV3">
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">田块</span><strong>{fieldLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备</span><strong>{deviceLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行状态</span><strong>{model.execution.progressLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最新更新时间</span><strong>{model.latestUpdatedAtLabel}</strong></div>
        </div>

      </section>

      <OperationRecommendationBasisCard basis={model.recommendationBasis} />

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">决策依据</div>
        <div className="detailSectionLead">
          系统依据：
          <br />
          - 作物阶段：{decisionStage}
          <br />
          - 规则：{decisionRuleSource}
        </div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">规则</span><strong>{decisionRuleSource}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">规则来源</span><strong>{decisionRuleSource}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">阶段</span><strong>{decisionStage}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">原因</span><strong>{decisionReason}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">效果评估</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行前</span><strong>{effectBefore}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行后</span><strong>{effectAfter}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">变化</span><strong>{effectDelta}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">结论</span><strong>{effectVerdict}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">作业结论（客户视角）</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">结论</span><strong>{model.customerView.summary}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">建议</span><strong>{model.customerView.todayAction}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">风险等级</span><strong>{model.customerView.riskLevelLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">费用</span><strong>{billingLabel}</strong></div>
        </div>
      </section>
      <section className="demoContentGrid">
        <OperationExecutionCard task={model.execution} acceptance={model.acceptance} invalidReason={model.invalidReason} />
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">为什么建议这次作业</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">当前作物</span><strong>{model.agronomyDecision.cropLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">当前阶段</span><strong>{model.agronomyDecision.cropStageLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">触发规则</span><strong>{model.agronomyDecision.ruleId}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">规则表现</span><strong>{model.recommendation.ruleConfidenceLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">历史有效率</span><strong>{model.recommendation.historyEffectivenessLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">原因代码</span><strong>{model.agronomyDecision.reasonCodesLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">建议动作</span><strong>{model.agronomyDecision.actionLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">不执行风险</span><strong>{model.agronomyDecision.riskIfNotExecute}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">预期效果</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">预期类型</span><strong>{model.expectedEffectCard.effectTypeLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">预期数值</span><strong>{model.expectedEffectCard.effectValueLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">业务解释</span><strong>{model.expectedEffectCard.businessSummary}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">规则与执行链</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">作物来源</span><strong>{model.ruleExecutionBridge.cropSummary}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">生长阶段</span><strong>{model.ruleExecutionBridge.stageSummary}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">触发规则</span><strong>{model.ruleExecutionBridge.ruleSummary}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">建议单号</span><strong>{model.ruleExecutionBridge.recommendationSummary}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行计划号</span><strong>{model.ruleExecutionBridge.operationPlanSummary}</strong></div>
        </div>
      </section>

      <OperationEffectEvaluationCard effect={model.effectAssessment} />

      <section className="demoContentGrid">
        <OperationDecisionCard recommendation={model.recommendation} approval={model.approval} businessEffect={model.businessEffect} />
      </section>

      <section className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">{COPY.executionEvidence}</div>
            <div className="detailSectionLead">以回执证据说明本次作业具体做了什么，并补充业务影响表达。</div>
          </div>
          <ReceiptEvidenceCard
            data={model.receiptEvidence}
            actionLabel={actionLabel}
            executorTypeLabel={model.execution.executorTypeLabel}
            finalStatus={model.finalStatus}
          />
        </section>
        <OperationImpactCard model={model} />
      </section>

      <section className="demoContentGrid">
        <OperationAcceptanceCard model={model} />
      </section>

      <section className="demoContentGrid">
        <OperationEvidenceDownloadCard evidenceBundle={model.evidenceExport} operationPlanId={model.operationPlanId} />
      </section>

      <section className="demoContentGrid">
        <OperationRiskCard detail={detail} />
      </section>

      <section className="demoContentGrid">
        <OperationStoryTimeline items={model.timeline} />
      </section>
    </div>
  );
}
