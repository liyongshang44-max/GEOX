import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/reports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";
import { PageHeader, SectionCard } from "../shared/ui";

export default function AdminOperationDebugPage(): React.ReactElement {
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
  if (error || !report) return <ErrorState title="调试信息加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / Admin"
        title={`Operation Debug · ${vm.header.internalId}`}
        description="仅后台只读"
        actions={<Link className="btn" to={`/operations/${encodeURIComponent(operationId)}/report`}>查看客户页</Link>}
      />

      <SectionCard title="标识信息">
        <div className="kvGrid2">
          <div><strong>operation_id：</strong>{vm.debug.operationId}</div>
          <div><strong>operation_plan_id：</strong>{vm.debug.operationPlanId}</div>
          <div><strong>act_task_id：</strong>{vm.debug.actTaskId}</div>
          <div><strong>receipt_id：</strong>{vm.debug.receiptId}</div>
          <div><strong>recommendation_id：</strong>{vm.debug.recommendationId}</div>
        </div>
      </SectionCard>

      <SectionCard title="workflow">
        <div className="kvGrid2">
          <div><strong>owner_actor_id：</strong>{vm.debug.workflowOwnerId}</div>
          <div><strong>owner_name：</strong>{vm.debug.workflowOwnerName}</div>
          <div><strong>updated_at：</strong>{vm.debug.workflowUpdatedAt}</div>
          <div><strong>last_note：</strong>{vm.debug.workflowLastNote}</div>
        </div>
      </SectionCard>

      <SectionCard title="SLA">
        <div className="kvGrid2">
          <div><strong>response_time_ms：</strong>{vm.debug.sla.responseTimeMs}</div>
          <div><strong>dispatch_latency：</strong>{vm.debug.sla.dispatchLatency}</div>
          <div><strong>execution_duration：</strong>{vm.debug.sla.executionDuration}</div>
          <div><strong>acceptance_latency：</strong>{vm.debug.sla.acceptanceLatency}</div>
          <div><strong>invalid_reasons：</strong>{vm.debug.sla.invalidReasons}</div>
        </div>
      </SectionCard>

      <SectionCard title="trace / raw status">
        <div className="kvGrid2">
          <div><strong>execution.final_status：</strong>{String((report as any)?.execution?.final_status ?? "--")}</div>
          <div><strong>acceptance.status：</strong>{String((report as any)?.acceptance?.status ?? "--")}</div>
          <div><strong>approval.status：</strong>{String((report as any)?.approval?.status ?? "--")}</div>
          <div><strong>risk.level：</strong>{String((report as any)?.risk?.level ?? "--")}</div>
        </div>
      </SectionCard>
    </div>
  );
}
