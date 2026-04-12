/* eslint no-restricted-imports: ["error", { "patterns": ["../viewmodels/customerDashboardViewModel", "../viewmodels/*customer*Dashboard*", "../lib/*aggregate*"] }] */
/**
 * Dashboard 页面约束：
 * - 禁止引入基于 reports 的业务聚合 util。
 * - total_cost / risk level / trend / summary 必须直接使用后端聚合字段。
 * - 仅允许列表排序、UI 过滤、展示格式化。
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchAlertSummary, type AlertSummaryV1 } from "../api/alerts";
import {
  type FieldPortfolioItemV1,
  type FieldPortfolioSummaryV1,
  fetchFieldPortfolio,
  fetchFieldPortfolioSummary,
} from "../api/fieldPortfolio";
import { mapReportCode } from "../api/reports";
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

function riskRank(value: unknown): number {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "HIGH") return 2;
  if (normalized === "MEDIUM") return 1;
  return 0;
}

export default function CustomerDashboardPage(): React.ReactElement {
  const location = useLocation();
  const [summary, setSummary] = React.useState<FieldPortfolioSummaryV1 | null>(null);
  const [portfolioItems, setPortfolioItems] = React.useState<FieldPortfolioItemV1[]>([]);
  const [error, setError] = React.useState<string>("");
  const [alertSummary, setAlertSummary] = React.useState<AlertSummaryV1>({
    ok: true,
    total: 0,
    by_status: { OPEN: 0, ACKED: 0, CLOSED: 0 },
    by_severity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    by_category: {},
  });

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fieldIds = params.getAll("field_id").map((x) => String(x ?? "").trim()).filter(Boolean);
    const timeRangeRaw = String(params.get("time_range") ?? "").trim();
    const timeRange = timeRangeRaw === "7d" || timeRangeRaw === "30d" || timeRangeRaw === "season" ? timeRangeRaw : undefined;

    void Promise.all([
      fetchFieldPortfolioSummary({ fieldIds, timeRange }),
      fetchFieldPortfolio({ fieldIds, timeRange, sort_by: "business_priority", sort_order: "desc", page: 1, page_size: 5 }),
      fetchAlertSummary(),
    ])
      .then(([nextSummaryData, nextItems, nextSummary]) => {
        setSummary(nextSummaryData);
        setPortfolioItems(nextItems);
        setAlertSummary(nextSummary);
        setError("");
      })
      .catch(() => {
        setSummary(null);
        setPortfolioItems([]);
        setAlertSummary({
          ok: false,
          total: 0,
          by_status: { OPEN: 0, ACKED: 0, CLOSED: 0 },
          by_severity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
          by_category: {},
        });
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, [location.search]);

  const topRiskFields = React.useMemo(() => {
    return [...portfolioItems]
      .sort((a, b) => {
        const left = a as Record<string, unknown>;
        const right = b as Record<string, unknown>;
        const riskDiff = riskRank(right.risk_level) - riskRank(left.risk_level);
        if (riskDiff !== 0) return riskDiff;
        const updatedDiff = Date.parse(String(right.updated_at ?? "")) - Date.parse(String(left.updated_at ?? ""));
        if (Number.isFinite(updatedDiff) && updatedDiff !== 0) return updatedDiff;
        return String(left.field_id ?? "").localeCompare(String(right.field_id ?? ""));
      })
      .slice(0, 5);
  }, [portfolioItems]);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title="客户看板"
        description="围绕经营结果、风险、成本与行动建议展示"
        actions={
          <>
            <Link className="btn" to="/fields/portfolio">查看全部地块</Link>
            <Link className="btn" to="/alerts">进入告警中心</Link>
          </>
        }
      />

      <SectionCard title="地块状态">
        <div>
          共 {numberFmt.format(summary?.fields.total ?? 0)} 个地块，健康 {numberFmt.format(summary?.fields.healthy ?? 0)} 个，风险 {numberFmt.format(summary?.fields.at_risk ?? 0)} 个
        </div>
        <div className="muted">统计口径以聚合接口返回为准。</div>
      </SectionCard>

      <SectionCard title="告警摘要（/api/v1/alerts/summary）">
        <div>总告警：{numberFmt.format(alertSummary.total)}</div>
        <div className="muted">未处理：{numberFmt.format(alertSummary.by_status.OPEN)} · 已确认：{numberFmt.format(alertSummary.by_status.ACKED)} · 已关闭：{numberFmt.format(alertSummary.by_status.CLOSED)}</div>
      </SectionCard>


      {Number(summary?.fields.total ?? 0) > 1 ? (
        <SectionCard title="Top 风险地块">
          <div className="list">
            {topRiskFields.map((item, idx) => {
              const anyItem = item as Record<string, unknown>;
              const fieldId = String(anyItem.field_id ?? anyItem.program_id ?? idx);
              const name = String(anyItem.name ?? "").trim();
              const riskLevel = String(anyItem.risk_level ?? "LOW").trim().toUpperCase();
              const alertSummaryText = String(anyItem.alert_summary ?? "").trim();
              const operationSummaryText = String(anyItem.operation_summary ?? "").trim();
              const costSummaryText = String(anyItem.cost_summary ?? "").trim();
              const updatedAt = String(anyItem.updated_at ?? "");
              return (
                <div key={fieldId} className="item">
                  地块 {name || fieldId} · 风险 {mapReportCode(riskLevel).label} · 告警 {alertSummaryText || "-"} · 作业 {operationSummaryText || "-"} · 成本 {costSummaryText || "-"} · 最近更新 {formatDateTime(updatedAt)}
                </div>
              );
            })}
            {!topRiskFields.length ? (
              <div className="muted">暂无风险地块数据</div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="最近执行">
        <div>最近 {numberFmt.format(summary?.recent_operations.length ?? 0)} 条作业记录</div>
        <div className="list" style={{ marginTop: 8 }}>
          {(summary?.recent_operations || []).map((item, idx) => (
            <div key={`${item.operation_id}-${idx}`} className="item">
              计划 {item.operation_plan_id} · 作业 {item.operation_id} · 风险 {mapReportCode(item.risk_level).label} · {formatDateTime(item.executed_at)} · 预计成本 {currencyFmt.format(item.estimated_total_cost)} · {formatDuration(item.execution_duration_ms)}
            </div>
          ))}
          {!summary?.recent_operations?.length ? <div className="muted">暂无最近执行记录</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="本周期目标">
        <div>
          本周期累计执行 {numberFmt.format(summary?.period_summary.total_operations ?? 0)} 次，累计成本 {currencyFmt.format(summary?.period_summary.total_cost ?? 0)}，
          平均 SLA {formatDuration(summary?.period_summary.avg_sla_ms)}
        </div>
        <div className="muted">后端暂未返回目标文案时，先展示聚合摘要。</div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
