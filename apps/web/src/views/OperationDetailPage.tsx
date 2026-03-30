
import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import OperationAcceptanceCard from "../components/operations/OperationAcceptanceCard";
import OperationExecutionCard from "../components/operations/OperationExecutionCard";
import OperationImpactCard from "../components/operations/OperationImpactCard";
import OperationRiskCard from "../components/operations/OperationRiskCard";
import { useOperationDetail } from "../hooks/useOperationDetail";
import { buildOperationDetailViewModel } from "../viewmodels/operationDetailViewModel";
import { mapOperationActionLabel, mapOperationStatusLabel, mapDeviceDisplayName, mapFieldDisplayName } from "../lib/operationLabels";

const COPY = {
  detailUnavailable: "作业详情暂不可用",
  operationNotFound: "未找到对应作业",
  backToList: "返回作业列表",
  executionEvidence: "做了什么（证据）",
};

function buildResultSummary(model: ReturnType<typeof buildOperationDetailViewModel>): string {
  const finalStatus = mapOperationStatusLabel(model.finalStatus || model.statusLabel);
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

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const { loading, error, detail, reload } = useOperationDetail(operationPlanId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) {
    return <ErrorState title={COPY.detailUnavailable} message={error || COPY.operationNotFound} onRetry={() => void reload()} />;
  }

  const model = buildOperationDetailViewModel(detail);
  const topStatusLabel = mapOperationStatusLabel(model.finalStatus || model.statusLabel);
  const actionLabel = mapOperationActionLabel(model.actionLabel);
  const fieldLabel = mapFieldDisplayName(model.fieldLabel, model.fieldLabel);
  const deviceLabel = mapDeviceDisplayName(model.execution.deviceId || model.deviceLabel, model.deviceLabel);
  const resultSummary = buildResultSummary(model);

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

      <section className="demoContentGrid">
        <OperationExecutionCard model={model} />
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
          />
        </section>
        <OperationImpactCard model={model} />
      </section>

      <section className="demoContentGrid">
        <OperationAcceptanceCard model={model} />
      </section>

      <section className="demoContentGrid">
        <OperationRiskCard detail={detail} />
      </section>
    </div>
  );
}
