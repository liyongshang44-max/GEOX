import React from "react";
import { useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";

export default function OperationReportExportPage(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchOperationReport(operationId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
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
  }, [operationId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet printPage">
      <header className="customerReportHeader">
        <div className="customerReportHeaderBar">
          <div>
            <div className="customerReportLogo">GEOX / 作业闭环</div>
            <h1 className="customerTitle">{vm.header.title}</h1>
            <p className="customerReportMeta">{vm.header.subtitle}</p>
          </div>
          <button type="button" className="customerButton noPrint" onClick={() => window.print()}>打印导出</button>
        </div>
      </header>

      <section className="customerCard">
        <h2 className="customerReportSectionTitle">为什么做</h2>
        <div className="customerGrid2">
          <div><strong>当前风险：</strong>{vm.why.riskLabel}</div>
          <div><strong>主要原因：</strong>{vm.why.reasonText}</div>
        </div>
        <div className="customerSpacingTopXs">{vm.why.summary}</div>
      </section>

      <section className="customerCard">
        <h2 className="customerReportSectionTitle">谁批准</h2>
        <div className="customerGrid2">
          <div><strong>审批状态：</strong>{vm.approval.statusText}</div>
          <div><strong>审批人：</strong>{vm.approval.actorText}</div>
          <div><strong>审批时间：</strong>{vm.approval.timeText}</div>
          <div><strong>审批备注：</strong>{vm.approval.noteText}</div>
        </div>
      </section>

      <section className="customerCard">
        <h2 className="customerReportSectionTitle">怎么执行</h2>
        <div className="customerGrid2">
          <div><strong>执行负责人：</strong>{vm.execution.ownerText}</div>
          <div><strong>执行状态：</strong>{vm.execution.statusText}</div>
          <div><strong>开始时间：</strong>{vm.execution.startedAtText}</div>
          <div><strong>结束时间：</strong>{vm.execution.finishedAtText}</div>
          <div><strong>执行异常：</strong>{vm.execution.invalidExecutionText}</div>
        </div>
      </section>

      <SectionCard title="有什么证据">
        <div className="kvGrid2">
          <div><strong>执行回执：</strong>{vm.evidence.executionReceipt}</div>
          <div><strong>实际执行记录：</strong>{vm.evidence.executionRecord}</div>
          <div><strong>灌后监测：</strong>{vm.evidence.postIrrigationMonitoring}</div>
          <div><strong>图片：</strong>{vm.evidence.onSitePhotos}</div>
          <div><strong>验收项：</strong>{vm.evidence.acceptanceItems}</div>
        </div>
      </section>

      <section className="customerCard">
        <h2 className="customerReportSectionTitle">验收结果</h2>
        <div className="customerGrid2">
          <div><strong>验收状态：</strong>{vm.acceptance.statusText}</div>
          <div><strong>验收结论：</strong>{vm.acceptance.verdictText}</div>
          <div><strong>缺失证据：</strong>{vm.acceptance.missingEvidenceText}</div>
          <div><strong>验收时间：</strong>{vm.acceptance.generatedAtText}</div>
        </div>
      </section>

      <section className="customerCard">
        <h2 className="customerReportSectionTitle">最终结论</h2>
        <div><strong>{vm.conclusion.finalStatusText}</strong></div>
        <div className="muted customerSpacingTopXs">{vm.conclusion.resultText}</div>
      </section>
        <footer className="customerFooterNote">报告由 GEOX 生成，用于客户经营复盘与沟通。</footer>
      </div>
    </div>
  );
}
