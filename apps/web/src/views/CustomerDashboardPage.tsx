/* eslint no-restricted-imports: ["error", { "patterns": ["../viewmodels/customerDashboardViewModel", "../viewmodels/*customer*Dashboard*", "../lib/*aggregate*"] }] */
import React from "react";
import { Link } from "react-router-dom";
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

function riskRank(value: string): number {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "CRITICAL") return 3;
  if (normalized === "HIGH") return 2;
  if (normalized === "MEDIUM") return 1;
  return 0;
}

export default function CustomerDashboardPage(): React.ReactElement {
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
    void Promise.all([
      fetchFieldPortfolioSummary(),
      fetchFieldPortfolio({ sort_by: "risk", sort_order: "desc", page: 1, page_size: 5 }),
      fetchAlertSummary(),
    ])
      .then(([nextSummaryData, nextItems, nextAlertSummary]) => {
        setSummary(nextSummaryData);
        setPortfolioItems(nextItems);
        setAlertSummary(nextAlertSummary);
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
  }, []);

  const topRiskFields = React.useMemo(() => {
    return [...portfolioItems]
      .sort((a, b) => {
        const riskDiff = riskRank(b.risk_level) - riskRank(a.risk_level);
        if (riskDiff !== 0) return riskDiff;
        const updatedDiff = Date.parse(String(b.updated_at ?? "")) - Date.parse(String(a.updated_at ?? ""));
        if (Number.isFinite(updatedDiff) && updatedDiff !== 0) return updatedDiff;
        return String(a.field_id ?? "").localeCompare(String(b.field_id ?? ""));
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
          共 {numberFmt.format(summary?.total_fields ?? 0)} 个地块，风险 {numberFmt.format((summary?.by_risk.high ?? 0) + (summary?.by_risk.critical ?? 0))} 个，
          严重 {numberFmt.format(summary?.by_risk.critical ?? 0)} 个
        </div>
        <div className="muted">离线地块：{numberFmt.format(summary?.offline_fields ?? 0)}。</div>
      </SectionCard>

      <SectionCard title="经营汇总（/api/v1/fields/portfolio/summary）">
        <div>未关闭告警：{numberFmt.format(summary?.total_open_alerts ?? 0)}</div>
        <div>待验收：{numberFmt.format(summary?.total_pending_acceptance ?? 0)}</div>
        <div>预计成本：{currencyFmt.format(summary?.total_estimated_cost ?? 0)} · 实际成本：{currencyFmt.format(summary?.total_actual_cost ?? 0)}</div>
      </SectionCard>

      <SectionCard title="告警摘要（/api/v1/alerts/summary）">
        <div>总告警：{numberFmt.format(alertSummary.total)}</div>
        <div className="muted">未处理：{numberFmt.format(alertSummary.by_status.OPEN)} · 已确认：{numberFmt.format(alertSummary.by_status.ACKED)} · 已关闭：{numberFmt.format(alertSummary.by_status.CLOSED)}</div>
      </SectionCard>

      <SectionCard title="Top 风险地块">
        <div className="list">
          {topRiskFields.map((item) => (
            <div key={item.field_id} className="item">
              地块 {item.field_name || item.field_id} · 风险 {mapReportCode(item.risk_level).label} · 告警 {item.alert_summary.open_total} ·
              待验收 {item.acceptance_summary.pending_count} · 最近作业 {formatDateTime(item.operation_summary.last_operation_at)}
            </div>
          ))}
          {!topRiskFields.length ? (
            <div className="muted">暂无风险地块数据</div>
          ) : null}
        </div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
