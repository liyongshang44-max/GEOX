import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/reports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { PageHeader, SectionCard } from "../shared/ui";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";

export default function FieldReportExportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fieldId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="地块报告加载失败" message={error || "暂无地块报告"} onRetry={() => window.location.reload()} />;

  const vm = buildFieldReportVm(report);

  return (
    <div className="demoDashboardPage reportPrintPage">
      <PageHeader
        eyebrow="GEOX / 地块报告"
        title={vm.header.title}
        description={vm.header.subtitle}
        actions={[{ label: "打印导出", onClick: () => window.print() }]}
      />

      <SectionCard title="地块总览">
        <div className="kvGrid2">
          <div><strong>当前风险：</strong>{vm.overview.riskText}</div>
          <div><strong>未关闭告警数：</strong>{vm.overview.openAlertsText}</div>
          <div><strong>待验收作业数：</strong>{vm.overview.pendingAcceptanceText}</div>
          <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
          <div><strong>最近作业时间：</strong>{vm.overview.latestOperationText}</div>
          <div><strong>预计总成本：</strong>{vm.overview.estimatedCostText}</div>
          <div><strong>实际总成本：</strong>{vm.overview.actualCostText}</div>
        </div>
      </SectionCard>

      <SectionCard title="状态解释">
        <div>{vm.explain.human}</div>
        <ul style={{ marginTop: 8 }}>
          {vm.explain.topReasonsText.map((item, idx) => (<li key={`${item}-${idx}`}>{item}</li>))}
        </ul>
      </SectionCard>

      <SectionCard title="近期作业">
        <div className="list">
          {vm.recentOperations.map((item) => (
            <article key={item.id} className="item">
              <div>{item.title}</div>
              <div className="muted">状态：{item.statusText}</div>
              <div className="muted">验收：{item.acceptanceText}</div>
              <div className="muted">生成时间：{item.generatedAtText}</div>
            </article>
          ))}
          {!vm.recentOperations.length ? <div className="muted">暂无作业报告</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="感知/设备概况">
        <div className="kvGrid2">
          <div><strong>设备总数：</strong>{vm.deviceSummary.totalText}</div>
          <div><strong>在线：</strong>{vm.deviceSummary.onlineText}</div>
          <div><strong>离线：</strong>{vm.deviceSummary.offlineText}</div>
          <div><strong>最近遥测时间：</strong>{vm.deviceSummary.lastTelemetryText}</div>
        </div>
      </SectionCard>

      <SectionCard title="下一步建议">
        {vm.nextAction ? (
          <div className="kvGrid2">
            <div><strong>建议标题：</strong>{vm.nextAction.title}</div>
            <div><strong>建议说明：</strong>{vm.nextAction.explainText}</div>
            <div><strong>建议目标：</strong>{vm.nextAction.objectiveText}</div>
            <div><strong>优先级：</strong>{vm.nextAction.priorityText}</div>
          </div>
        ) : (
          <div className="muted">暂无下一步建议</div>
        )}
      </SectionCard>
    </div>
  );
}
