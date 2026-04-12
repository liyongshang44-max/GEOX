import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAlerts, type AlertV1 } from "../api/alerts";
import { fetchOperationReport, mapReportCode, type OperationReportV1 } from "../api/reports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { alertCategoryLabel, alertStatusLabel } from "../lib/alertLabels";
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
  const [alerts, setAlerts] = React.useState<AlertV1[]>([]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void Promise.all([fetchOperationReport(operationPlanId), fetchAlerts({ object_type: "OPERATION", object_id: operationPlanId, status: ["OPEN", "ACKED"] })])
      .then(([res, scopedAlerts]) => {
        if (!alive) return;
        setReport(res);
        setAlerts(scopedAlerts);
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
  }, [operationPlanId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const finalStatus = mapReportCode(report.execution.final_status);
  const acceptanceStatus = mapReportCode(report.acceptance.status);
  const riskLevel = mapReportCode(report.risk.level);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 作业报告"
        title={`作业报告 ${report.identifiers.operation_id || operationPlanId}`}
        description={`状态：${finalStatus.label}`}
        actions={<Link className="btn" to={`/operations/${encodeURIComponent(operationPlanId)}`}>返回作业详情</Link>}
      />

      <SectionCard title="未关闭关联告警">
        <div className="list">
          {alerts.map((alert) => (
            <article key={alert.alert_id} className="item">
              <div>{alertCategoryLabel(alert.category)} · {alertStatusLabel(alert.status)}</div>
              <div className="muted">告警ID：{alert.alert_id}</div>
            </article>
          ))}
          {!alerts.length ? <div className="muted">暂无未关闭关联告警</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="作业摘要">
        <div className="kvGrid2">
          <div><strong>作业ID：</strong>{kv(report.identifiers.operation_id)}</div>
          <div><strong>状态：</strong>{finalStatus.label}</div>
          <div><strong>生成时间：</strong>{kv(report.generated_at)}</div>
        </div>
      </SectionCard>

      <SectionCard title="当前处理负责人">
        <div className="kvGrid2">
          <div><strong>负责人ID：</strong>{kv(report.workflow.owner_actor_id)}</div>
          <div><strong>负责人：</strong>{kv(report.workflow.owner_name)}</div>
          <div><strong>最新备注：</strong>{kv(report.workflow.last_note)}</div>
          <div><strong>更新时间：</strong>{kv(report.workflow.updated_at)}</div>
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

      <SectionCard title="验收状态">
        <div className="kvGrid2">
          <div><strong>验收状态：</strong>{acceptanceStatus.label}</div>
          <div><strong>验收结论：</strong>{kv(report.acceptance.verdict)}</div>
          <div><strong>缺失证据：</strong>{report.acceptance.missing_evidence ? "是" : "否"}</div>
          <div><strong>验收时间：</strong>{kv(report.acceptance.generated_at)}</div>
        </div>
      </SectionCard>

      <SectionCard title="证据摘要">
        <div className="kvGrid2">
          <div><strong>工件数量：</strong>{report.evidence.artifacts_count}</div>
          <div><strong>日志数量：</strong>{report.evidence.logs_count}</div>
          <div><strong>媒体数量：</strong>{report.evidence.media_count}</div>
          <div><strong>指标数量：</strong>{report.evidence.metrics_count}</div>
        </div>
      </SectionCard>

      <SectionCard title="成本">
        <div className="kvGrid2">
          <div><strong>预计：</strong>{kv(report.cost.estimated_total)}</div>
          <div><strong>实际：</strong>{kv(report.cost.actual_total)}</div>
          <div><strong>预计水成本：</strong>{kv(report.cost.estimated_water_cost)}</div>
        </div>
      </SectionCard>

      <SectionCard title="风险">
        <div className="kvGrid2">
          <div><strong>等级：</strong>{riskLevel.label}</div>
          <div><strong>标记：</strong>{report.risk.reasons.map((x) => mapReportCode(x).label).join(" / ") || "--"}</div>
        </div>
      </SectionCard>

      <details>
        <summary>管理员折叠区（调试信息）</summary>
        <SectionCard title="标识信息">
          <div className="kvGrid2">
            <div><strong>operation_plan_id：</strong>{kv(report.identifiers.operation_plan_id)}</div>
            <div><strong>act_task_id：</strong>{kv(report.identifiers.act_task_id)}</div>
            <div><strong>receipt_id：</strong>{kv(report.identifiers.receipt_id)}</div>
            <div><strong>recommendation_id：</strong>{kv(report.identifiers.recommendation_id)}</div>
          </div>
        </SectionCard>
        <SectionCard title="SLA 调试">
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
      </details>
    </div>
  );
}
