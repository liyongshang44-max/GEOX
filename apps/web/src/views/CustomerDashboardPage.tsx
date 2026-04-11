/* eslint no-restricted-imports: ["error", { "patterns": ["../viewmodels/customerDashboardViewModel", "../viewmodels/*customer*Dashboard*", "../lib/*aggregate*"] }] */
/**
 * Dashboard 页面约束：
 * - 禁止引入基于 reports 的业务聚合 util。
 * - total_cost / risk level / trend / summary 必须直接使用后端聚合字段。
 * - 仅允许列表排序、UI 过滤、展示格式化。
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchAlerts, fetchAlertSummary, type AlertV1 } from "../api/alerts";
import { fetchCustomerDashboardAggregate, mapReportCode, type CustomerDashboardAggregateV1 } from "../api/reports";
import { alertCategoryLabel, alertStatusLabel } from "../lib/alertLabels";
import { PageHeader, SectionCard } from "../shared/ui";

const numberFmt = new Intl.NumberFormat("zh-CN");
const currencyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "时间未知";
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return "时间未知";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function formatDuration(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "耗时未知";
  const minutes = Math.round(v / 60000);
  if (minutes < 1) return "不足 1 分钟";
  return `${numberFmt.format(minutes)} 分钟`;
}

export default function CustomerDashboardPage(): React.ReactElement {
  const location = useLocation();
  const [aggregate, setAggregate] = React.useState<CustomerDashboardAggregateV1 | null>(null);
  const [error, setError] = React.useState<string>("");
  const [openAlerts, setOpenAlerts] = React.useState<AlertV1[]>([]);
  const [alertSummary, setAlertSummary] = React.useState<{ total: number; by_status: Record<string, number> }>({ total: 0, by_status: {} });

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fieldIds = params.getAll("field_id").map((x) => String(x ?? "").trim()).filter(Boolean);
    const timeRangeRaw = String(params.get("time_range") ?? "").trim();
    const timeRange = timeRangeRaw === "7d" || timeRangeRaw === "30d" || timeRangeRaw === "season" ? timeRangeRaw : undefined;

    void Promise.all([
      fetchCustomerDashboardAggregate({ fieldIds, timeRange }),
      fetchAlertSummary(),
      fetchAlerts({ status: "OPEN" }),
    ])
      .then(([nextAggregate, nextSummary, nextOpenAlerts]) => {
        setAggregate(nextAggregate);
        setAlertSummary({ total: Number(nextSummary.total ?? 0), by_status: nextSummary.by_status ?? {} });
        setOpenAlerts(nextOpenAlerts.slice(0, 3));
        setError("");
      })
      .catch(() => {
        setAggregate(null);
        setOpenAlerts([]);
        setAlertSummary({ total: 0, by_status: {} });
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, [location.search]);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title="客户看板"
        description="围绕经营结果、风险、成本与行动建议展示"
        actions={<Link className="btn" to="/alerts">进入告警中心</Link>}
      />

      <SectionCard title="地块状态">
        <div>
          共 {numberFmt.format(aggregate?.fields.total ?? 0)} 个地块，健康 {numberFmt.format(aggregate?.fields.healthy ?? 0)} 个，风险 {numberFmt.format(aggregate?.fields.at_risk ?? 0)} 个
        </div>
        <div className="muted">统计口径以聚合接口返回为准。</div>
      </SectionCard>

      <SectionCard title="告警摘要（/api/v1/alerts/summary）">
        <div>总告警：{numberFmt.format(alertSummary.total)}</div>
        <div className="muted">未处理：{numberFmt.format(Number(alertSummary.by_status.OPEN ?? 0))} · 已确认：{numberFmt.format(Number(alertSummary.by_status.ACKED ?? 0))} · 已关闭：{numberFmt.format(Number(alertSummary.by_status.CLOSED ?? 0))}</div>
      </SectionCard>

      <SectionCard title="未处理告警 Top3（/api/v1/alerts?status=OPEN）">
        <div className="list" style={{ marginTop: 8 }}>
          {openAlerts.map((item) => (
            <div key={item.alert_id} className="item">
              {alertCategoryLabel(item.category)} · {alertStatusLabel(item.status)} · {formatDateTime(item.triggered_at)}
            </div>
          ))}
          {!openAlerts.length ? <div className="muted">暂无未处理告警</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="最近执行">
        <div>最近 {numberFmt.format(aggregate?.recent_operations.length ?? 0)} 条作业记录</div>
        <div className="list" style={{ marginTop: 8 }}>
          {(aggregate?.recent_operations || []).map((item, idx) => (
            <div key={`${item.operation_id}-${idx}`} className="item">
              计划 {item.operation_plan_id} · 作业 {item.operation_id} · 风险 {mapReportCode(item.risk_level).label} · {formatDateTime(item.executed_at)} · 预计成本 {currencyFmt.format(item.estimated_total_cost)} · {formatDuration(item.execution_duration_ms)}
            </div>
          ))}
          {!aggregate?.recent_operations?.length ? <div className="muted">暂无最近执行记录</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="本周期目标">
        <div>
          本周期累计执行 {numberFmt.format(aggregate?.period_summary.total_operations ?? 0)} 次，累计成本 {currencyFmt.format(aggregate?.period_summary.total_cost ?? 0)}，
          平均 SLA {formatDuration(aggregate?.period_summary.avg_sla_ms)}
        </div>
        <div className="muted">后端暂未返回目标文案时，先展示聚合摘要。</div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
