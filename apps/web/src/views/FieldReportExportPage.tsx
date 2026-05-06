import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import "../styles/customerReport.css";
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
  const reportTitle = String(report.field_name ?? "").trim() ? `${String(report.field_name).trim()} 地块报告` : "地块报告";

  return (
    <div className="customerShell">
      <div className="customerExportPage printPage">
        <header className="customerReportHeader">
          <div className="customerHeroTop">
            <div>
              <div className="customerEyebrow">GEOX / 地块报告</div>
              <h1 className="customerTitle">{reportTitle}</h1>
              <p className="customerSubtitle">{vm.header.subtitle}</p>
            </div>
            <button type="button" className="customerButton noPrint" onClick={() => window.print()}>打印导出</button>
          </div>
        </header>

        <section className="customerCard">
          <h2 className="customerCardTitle">摘要</h2>
          <div className="customerGrid2 customerSpacingTopSm">
            <div><strong>当前风险：</strong>{vm.overview.riskText}</div>
            <div><strong>未关闭告警数：</strong>{vm.overview.openAlertsText}</div>
            <div><strong>待验收作业数：</strong>{vm.overview.pendingAcceptanceText}</div>
            <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
            <div><strong>最近作业时间：</strong>{vm.overview.latestOperationText}</div>
            <div><strong>预计总成本：</strong>{vm.overview.estimatedCostText}</div>
            <div><strong>实际总成本：</strong>{vm.overview.actualCostText}</div>
          </div>
        </section>

        <section className="customerCard">
          <h2 className="customerCardTitle">状态解释</h2>
          <p className="customerSpacingTopSm">{vm.explain.human}</p>
          <ul className="customerList customerSpacingTopSm">
            {(vm.explain.topReasonsText ?? []).map((item, idx) => (<li key={`${item}-${idx}`} className="customerListItem">{item}</li>))}
          </ul>
        </section>

        <section className="customerCard">
          <h2 className="customerCardTitle">近期作业</h2>
          <div className="customerList customerSpacingTopSm">
            {(vm.recentOperationsTop5 ?? []).map((item) => (
              <article key={item.id} className="customerListItem">
                <div><strong>{item.title}</strong></div>
                <div className="customerMetricLabel">状态：{item.statusText}</div>
                <div className="customerMetricLabel">验收：{item.acceptanceText}</div>
                <div className="customerMetricLabel">生成时间：{item.generatedAtText}</div>
              </article>
            ))}
            {!(vm.recentOperationsTop5 ?? []).length ? <div className="customerMetricLabel">暂无作业报告</div> : null}
          </div>
        </section>

        <section className="customerCard">
          <h2 className="customerCardTitle">下一步建议</h2>
          {vm.nextAction ? (
            <div className="customerGrid2 customerSpacingTopSm">
              <div><strong>建议标题：</strong>{vm.nextAction.title}</div>
              <div><strong>建议说明：</strong>{vm.nextAction.explainText}</div>
              <div><strong>建议目标：</strong>{vm.nextAction.objectiveText}</div>
              <div><strong>优先级：</strong>{vm.nextAction.priorityText}</div>
            </div>
          ) : (
            <div className="customerMetricLabel customerSpacingTopSm">暂无下一步建议</div>
          )}
        </section>

        <section className="customerCard"><h2 className="customerCardTitle">本次价值</h2><p className="customerSpacingTopSm">通过聚焦关键风险，减少重复巡检与处置延迟。</p></section>
        <section className="customerCard"><h2 className="customerCardTitle">证据可信度</h2><p className="customerSpacingTopSm">基于地块状态、异常记录与作业进展综合评估。</p></section>
        <section className="customerCard"><h2 className="customerCardTitle">系统记忆</h2><p className="customerSpacingTopSm">系统已关联该地块历史变化，用于跟踪趋势。</p></section>
        <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">地块整体可控，建议按优先级继续闭环处置。</p></section>
      </div>
    </div>
  );
}
