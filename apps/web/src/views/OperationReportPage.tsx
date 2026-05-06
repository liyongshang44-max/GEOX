import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";

export default function OperationReportPage(): React.ReactElement {
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
  const steps = [
    { n: 1, title: "为什么做", body: <><div><strong>当前风险：</strong>{vm.why.riskLabel}</div><div><strong>主要原因：</strong>{vm.why.reasonText}</div><div className="customerSpacingTopXs">{vm.why.summary}</div></> },
    { n: 2, title: "谁批准", body: <div className="customerGrid2"><div><strong>审批状态：</strong>{vm.approval.statusText}</div><div><strong>审批人：</strong>{vm.approval.actorText}</div><div><strong>审批时间：</strong>{vm.approval.timeText}</div><div><strong>审批备注：</strong>{vm.approval.noteText}</div></div> },
    { n: 3, title: "怎么执行", body: <div className="customerGrid2"><div><strong>执行负责人：</strong>{vm.execution.ownerText}</div><div><strong>执行状态：</strong>{vm.execution.statusText}</div><div><strong>开始时间：</strong>{vm.execution.startedAtText}</div><div><strong>结束时间：</strong>{vm.execution.finishedAtText}</div><div><strong>执行异常：</strong>{vm.execution.invalidExecutionText}</div></div> },
    { n: 4, title: "有什么证据", body: <div className="customerGrid2"><div><strong>执行回执：</strong>{vm.evidence.executionReceipt}</div><div><strong>实际执行记录：</strong>{vm.evidence.executionRecord}</div><div><strong>灌后监测：</strong>{vm.evidence.postIrrigationMonitoring}</div><div><strong>现场图片：</strong>{vm.evidence.onSitePhotos}</div><div><strong>验收项：</strong>{vm.evidence.acceptanceItems}</div></div> },
    { n: 5, title: "验收结果", body: <div className="customerGrid2"><div><strong>验收状态：</strong>{vm.acceptance.statusText}</div><div><strong>验收结论：</strong>{vm.acceptance.verdictText}</div><div><strong>缺失证据：</strong>{vm.acceptance.missingEvidenceText}</div><div><strong>验收时间：</strong>{vm.acceptance.generatedAtText}</div></div> },
    { n: 6, title: "最终结论", body: <><div><strong>{vm.conclusion.finalStatusText}</strong></div><div className="muted customerSpacingTopXs">{vm.conclusion.resultText}</div></> },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerLabel">GEOX / 作业闭环</div>
            <h1 className="customerTitle">{vm.header.title}</h1>
            <p className="customerSub">{vm.header.subtitle}</p>
          </div>
          <div className="customerActions">
            <Link className="btn" to="/customer/dashboard">返回客户看板</Link>
            <Link className="btn" to={`/customer/operations/${encodeURIComponent(operationId)}/export`}>导出报告</Link>
          </div>
        </div>
      </header>

      <div className="customerTimeline">
        {steps.map((step) => (
          <section key={step.n} className="customerTimelineStep">
            <div className="customerTimelineDot">{step.n}</div>
            <div className="customerCard">
              <h3 className="customerCardTitle">{step.title}</h3>
              {step.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
