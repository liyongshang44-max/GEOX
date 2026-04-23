import React from "react";
import { useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/reports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";
import { PageHeader, SectionCard } from "../shared/ui";

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
    <div className="demoDashboardPage reportPrintPage">
      <PageHeader
        eyebrow="GEOX / 作业闭环"
        title={vm.header.title}
        description={vm.header.subtitle}
        actions={[{ label: "打印导出", onClick: () => window.print() }]}
      />

      <SectionCard title="为什么做">
        <div className="kvGrid2">
          <div><strong>当前风险：</strong>{vm.why.riskLabel}</div>
          <div><strong>主要原因：</strong>{vm.why.reasonText}</div>
        </div>
        <div style={{ marginTop: 8 }}>{vm.why.summary}</div>
      </SectionCard>

      <SectionCard title="谁批准">
        <div className="kvGrid2">
          <div><strong>审批状态：</strong>{vm.approval.statusText}</div>
          <div><strong>审批人：</strong>{vm.approval.actorText}</div>
          <div><strong>审批时间：</strong>{vm.approval.timeText}</div>
          <div><strong>审批备注：</strong>{vm.approval.noteText}</div>
        </div>
      </SectionCard>

      <SectionCard title="怎么执行">
        <div className="kvGrid2">
          <div><strong>执行负责人：</strong>{vm.execution.ownerText}</div>
          <div><strong>执行状态：</strong>{vm.execution.statusText}</div>
          <div><strong>开始时间：</strong>{vm.execution.startedAtText}</div>
          <div><strong>结束时间：</strong>{vm.execution.finishedAtText}</div>
          <div><strong>执行异常：</strong>{vm.execution.invalidExecutionText}</div>
        </div>
      </SectionCard>

      <SectionCard title="有什么证据">
        <div className="kvGrid2">
          <div><strong>附加工件：</strong>{vm.evidence.artifactsText}</div>
          <div><strong>执行记录：</strong>{vm.evidence.logsText}</div>
          <div><strong>现场媒体：</strong>{vm.evidence.mediaText}</div>
          <div><strong>指标记录：</strong>{vm.evidence.metricsText}</div>
        </div>
      </SectionCard>

      <SectionCard title="验收结果">
        <div className="kvGrid2">
          <div><strong>验收状态：</strong>{vm.acceptance.statusText}</div>
          <div><strong>验收结论：</strong>{vm.acceptance.verdictText}</div>
          <div><strong>缺失证据：</strong>{vm.acceptance.missingEvidenceText}</div>
          <div><strong>验收时间：</strong>{vm.acceptance.generatedAtText}</div>
        </div>
      </SectionCard>

      <SectionCard title="最终结论">
        <div><strong>{vm.conclusion.finalStatusText}</strong></div>
        <div className="muted" style={{ marginTop: 8 }}>{vm.conclusion.resultText}</div>
      </SectionCard>
    </div>
  );
}
