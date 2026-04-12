/* eslint no-restricted-imports: ["error", { "patterns": ["../viewmodels/customerDashboardViewModel", "../viewmodels/*customer*Dashboard*", "../lib/*aggregate*"] }] */
/**
 * Dashboard 页面约束：
 * - 禁止引入基于 reports 的业务聚合 util。
 * - total_cost / risk level / trend / summary 必须直接使用后端聚合字段。
 * - 仅允许列表排序、UI 过滤、展示格式化。
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
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

function riskRank(value: unknown): number {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "CRITICAL") return 3;
  if (normalized === "HIGH") return 2;
  if (normalized === "MEDIUM") return 1;
  return 0;
}

export default function CustomerDashboardPage(): React.ReactElement {
  const location = useLocation();
  const [summary, setSummary] = React.useState<FieldPortfolioSummaryV1 | null>(null);
  const [portfolioItems, setPortfolioItems] = React.useState<FieldPortfolioItemV1[]>([]);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fieldIds = params.getAll("field_id").map((x) => String(x ?? "").trim()).filter(Boolean);
    const timeRangeRaw = String(params.get("time_range") ?? "").trim();
    const timeRange = timeRangeRaw === "7d" || timeRangeRaw === "30d" || timeRangeRaw === "season" ? timeRangeRaw : undefined;

    void Promise.all([
      fetchFieldPortfolioSummary({ fieldIds, timeRange }),
      fetchFieldPortfolio({ fieldIds, timeRange, sort_by: "business_priority", sort_order: "desc", page: 1, page_size: 5 }),
    ])
      .then(([nextSummaryData, nextItems]) => {
        setSummary(nextSummaryData);
        setPortfolioItems(nextItems);
        setError("");
      })
      .catch(() => {
        setSummary(null);
        setPortfolioItems([]);
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
          共 {numberFmt.format(summary?.total_fields ?? 0)} 个地块，离线 {numberFmt.format(summary?.offline_fields ?? 0)} 个，待验收 {numberFmt.format(summary?.total_pending_acceptance ?? 0)} 个
        </div>
        <div className="muted">口径统一来自 field_portfolio_v1 summary 聚合字段。</div>
      </SectionCard>

      <SectionCard title="风险分布与告警">
        <div>
          低风险 {numberFmt.format(summary?.by_risk.low ?? 0)} · 中风险 {numberFmt.format(summary?.by_risk.medium ?? 0)} · 高风险 {numberFmt.format(summary?.by_risk.high ?? 0)} · 严重风险 {numberFmt.format(summary?.by_risk.critical ?? 0)}
        </div>
        <div className="muted">
          告警总量 {numberFmt.format(summary?.total_open_alerts ?? 0)} · 异常执行 {numberFmt.format(summary?.total_invalid_execution ?? 0)}
        </div>
      </SectionCard>

      <SectionCard title="成本概览">
        <div>
          预计总成本 {currencyFmt.format(summary?.total_estimated_cost ?? 0)} · 实际总成本 {currencyFmt.format(summary?.total_actual_cost ?? 0)}
        </div>
        <div className="muted">成本统计与地块范围按同一 summary 过滤条件计算。</div>
      </SectionCard>


      {Number(summary?.total_fields ?? 0) > 1 ? (
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

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
