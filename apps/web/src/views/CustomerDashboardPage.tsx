import React from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchCustomerDashboardAggregate, mapReportCode, type CustomerDashboardAggregateV1 } from "../api/reports";
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

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fieldIds = params.getAll("field_id").map((x) => String(x ?? "").trim()).filter(Boolean);
    const timeRangeRaw = String(params.get("time_range") ?? "").trim();
    const timeRange = timeRangeRaw === "7d" || timeRangeRaw === "30d" || timeRangeRaw === "season" ? timeRangeRaw : undefined;

    void fetchCustomerDashboardAggregate({ fieldIds, timeRange })
      .then((next) => {
        setAggregate(next);
        setError("");
      })
      .catch(() => {
        setAggregate(null);
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, [location.search]);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title="客户看板"
        description="围绕经营结果、风险、成本与行动建议展示"
        actions={<Link className="btn" to="/dashboard">切换平台控制台</Link>}
      />

      <SectionCard title="地块状态">
        <div>
          共 {numberFmt.format(aggregate?.fields.total ?? 0)} 个地块，健康 {numberFmt.format(aggregate?.fields.healthy ?? 0)} 个，风险 {numberFmt.format(aggregate?.fields.at_risk ?? 0)} 个
        </div>
        <div className="muted">统计口径以聚合接口返回为准。</div>
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

      <SectionCard title="风险告警">
        <div>当前风险等级：{mapReportCode(aggregate?.risk_summary.level ?? "").label}</div>
        <div className="list" style={{ marginTop: 8 }}>
          {(aggregate?.risk_summary.top_reasons || []).map((signal, idx) => (
            <div key={`${signal}-${idx}`} className="item">{signal}</div>
          ))}
          {!aggregate?.risk_summary.top_reasons?.length ? <div className="muted">暂无风险原因</div> : null}
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
