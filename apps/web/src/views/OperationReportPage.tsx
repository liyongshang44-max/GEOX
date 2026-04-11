import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, mapReportCode, type OperationReportV1 } from "../api/reports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { PageHeader, SectionCard } from "../shared/ui";

function kv(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

function slaQualityLabel(quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER"): string {
  if (quality === "VALID") return "有效";
  if (quality === "MISSING_DATA") return "缺失";
  return "异常";
}

export default function OperationReportPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchOperationReport(operationPlanId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(String(e?.message ?? "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [operationPlanId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const finalStatus = mapReportCode(report.execution.final_status);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 作业报告"
        title={`作业报告 ${report.identifiers.operation_plan_id || operationPlanId}`}
        description={`状态：${finalStatus.label}`}
        actions={<Link className="btn" to={`/operations/${encodeURIComponent(operationPlanId)}`}>返回作业详情</Link>}
      />

      <SectionCard title="作业摘要">
        <div className="kvGrid2">
          <div><strong>作业ID：</strong>{kv(report.identifiers.operation_id || report.identifiers.operation_plan_id)}</div>
          <div><strong>状态：</strong>{finalStatus.label}</div>
          <div><strong>任务ID：</strong>{kv(report.identifiers.act_task_id)}</div>
        </div>
      </SectionCard>

      <SectionCard title="执行结果">
        <div className="kvGrid2">
          <div><strong>最终状态：</strong>{finalStatus.label}</div>
          <div><strong>无效执行：</strong>{report.execution.invalid_execution ? "是" : "否"}</div>
          <div><strong>开始时间：</strong>{kv(report.execution.execution_started_at)}</div>
          <div><strong>结束时间：</strong>{kv(report.execution.execution_finished_at)}</div>
        </div>
      </SectionCard>

      <SectionCard title="验收">
        <div className="kvGrid2">
          <div><strong>验收状态：</strong>{mapReportCode(report.acceptance.status).label}</div>
          <div><strong>验收结论：</strong>{kv(report.acceptance.verdict)}</div>
          <div><strong>缺失证据：</strong>{report.acceptance.missing_evidence ? "是" : "否"}</div>
          <div><strong>验收时间：</strong>{kv(report.acceptance.generated_at)}</div>
        </div>
      </SectionCard>

      <SectionCard title="证据">
        <div className="kvGrid2">
          <div><strong>Artifacts：</strong>{report.evidence.artifacts_count}</div>
          <div><strong>Logs：</strong>{report.evidence.logs_count}</div>
          <div><strong>Media：</strong>{report.evidence.media_count}</div>
          <div><strong>Metrics：</strong>{report.evidence.metrics_count}</div>
        </div>
      </SectionCard>

      <SectionCard title="成本">
        <div className="kvGrid2">
          <div><strong>预计：</strong>{kv(report.cost.estimated_total)}</div>
          <div><strong>实际：</strong>{kv(report.cost.actual_total)}</div>
          <div><strong>预计水成本：</strong>{kv(report.cost.estimated_water_cost)}</div>
        </div>
      </SectionCard>

      <SectionCard title="SLA">
        <div className="kvGrid2">
          <div><strong>响应耗时（ms）：</strong>{kv(report.sla.response_time_ms)}</div>
          <div>
            <strong>派发耗时（ms）：</strong>
            {report.sla.dispatch_latency_quality === "VALID" ? kv(report.sla.dispatch_latency_ms) : slaQualityLabel(report.sla.dispatch_latency_quality)}
          </div>
          <div>
            <strong>执行耗时（ms）：</strong>
            {report.sla.execution_duration_quality === "VALID" ? kv(report.sla.execution_duration_ms) : slaQualityLabel(report.sla.execution_duration_quality)}
          </div>
          <div>
            <strong>验收耗时（ms）：</strong>
            {report.sla.acceptance_latency_quality === "VALID" ? kv(report.sla.acceptance_latency_ms) : slaQualityLabel(report.sla.acceptance_latency_quality)}
          </div>
          <div><strong>SLA 异常码：</strong>{report.sla.invalid_reasons.join(" / ") || "--"}</div>
        </div>
      </SectionCard>

      <SectionCard title="风险">
        <div className="kvGrid2">
          <div><strong>等级：</strong>{mapReportCode(report.risk.level).label}</div>
          <div><strong>标记：</strong>{report.risk.reasons.map((x) => mapReportCode(x).label).join(" / ") || "--"}</div>
        </div>
      </SectionCard>
    </div>
  );
}
