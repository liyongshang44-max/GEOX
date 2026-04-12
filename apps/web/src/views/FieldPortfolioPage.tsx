import React from "react";
import { Link } from "react-router-dom";
import {
  fetchFieldPortfolio,
  fetchFieldPortfolioSummary,
  type FieldPortfolioItemV1,
  type FieldPortfolioSummaryV1,
  type FetchFieldPortfolioParams,
} from "../api/fieldPortfolio";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";
type SortMode = "risk" | "open_alerts" | "pending_acceptance" | "last_operation_at" | "cost" | "updated_at" | "field_name";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatMoney(value: number): string {
  return `¥${new Intl.NumberFormat("zh-CN").format(value)}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function riskLabel(risk: string): string {
  const normalized = String(risk ?? "").toUpperCase();
  if (normalized === "CRITICAL") return "严重";
  if (normalized === "HIGH") return "高";
  if (normalized === "MEDIUM") return "中";
  if (normalized === "LOW") return "低";
  return "-";
}

function toBackendParams(params: {
  query: string;
  risk: "" | RiskLevel;
  hasOpenAlerts: "" | "yes" | "no";
  hasPendingAcceptance: "" | "yes" | "no";
  tags: string;
  sort: SortMode;
  page: number;
  pageSize: number;
}): FetchFieldPortfolioParams {
  const next: FetchFieldPortfolioParams = {
    sort_by: params.sort,
    sort_order: "desc",
    page: params.page,
    page_size: params.pageSize,
  };

  if (params.query.trim()) next.query = params.query.trim();
  if (params.risk) next.risk_levels = [params.risk];
  if (params.hasOpenAlerts) next.has_open_alerts = params.hasOpenAlerts === "yes";
  if (params.hasPendingAcceptance) next.has_pending_acceptance = params.hasPendingAcceptance === "yes";

  const normalizedTags = params.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (normalizedTags.length) next.tags = normalizedTags;

  return next;
}

export default function FieldPortfolioPage(): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [risk, setRisk] = React.useState<"" | RiskLevel>("");
  const [hasOpenAlerts, setHasOpenAlerts] = React.useState<"" | "yes" | "no">("");
  const [hasPendingAcceptance, setHasPendingAcceptance] = React.useState<"" | "yes" | "no">("");
  const [tags, setTags] = React.useState("");
  const [sort, setSort] = React.useState<SortMode>("risk");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);

  const [items, setItems] = React.useState<FieldPortfolioItemV1[]>([]);
  const [summary, setSummary] = React.useState<FieldPortfolioSummaryV1 | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setPage(1);
  }, [query, risk, hasOpenAlerts, hasPendingAcceptance, tags, sort, pageSize]);

  const backendParams = React.useMemo(
    () => toBackendParams({ query, risk, hasOpenAlerts, hasPendingAcceptance, tags, sort, page, pageSize }),
    [hasOpenAlerts, hasPendingAcceptance, page, pageSize, query, risk, sort, tags],
  );

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void Promise.all([
      fetchFieldPortfolio(backendParams),
      fetchFieldPortfolioSummary(backendParams),
    ])
      .then(([nextItems, nextSummary]) => {
        if (!active) return;
        setItems(nextItems);
        setSummary(nextSummary);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setSummary(null);
        setError("暂未获取到地块经营数据，请稍后重试。");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [backendParams]);

  const total = summary?.total_fields ?? 0;
  const riskCount = (summary?.by_risk.high ?? 0) + (summary?.by_risk.critical ?? 0);
  const severeRiskCount = summary?.by_risk.critical ?? 0;
  const openAlerts = summary?.total_open_alerts ?? 0;
  const pendingAcceptance = summary?.total_pending_acceptance ?? 0;
  const cycleCost = summary?.total_estimated_cost ?? 0;

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Fields · Portfolio</div>
          <h2 className="heroTitle">地块经营总览</h2>
          <p className="heroText">按经营优先级快速定位高风险地块、未关闭告警与待验收事项。</p>
        </div>
      </section>

      <section className="summaryGrid sectionBlock">
        <div className="metricCard card"><div className="metricLabel">总地块</div><div className="metricValue">{total}</div></div>
        <div className="metricCard card"><div className="metricLabel">风险地块</div><div className="metricValue">{riskCount}</div></div>
        <div className="metricCard card"><div className="metricLabel">严重地块</div><div className="metricValue">{severeRiskCount}</div></div>
        <div className="metricCard card"><div className="metricLabel">未关闭告警</div><div className="metricValue">{openAlerts}</div></div>
        <div className="metricCard card"><div className="metricLabel">待验收</div><div className="metricValue">{pendingAcceptance}</div></div>
        <div className="metricCard card"><div className="metricLabel">周期成本</div><div className="metricValue">{formatMoney(cycleCost)}</div></div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">筛选栏</div><div className="sectionDesc">筛选条件变更后实时请求后端数据。</div></div></div>
        <div className="toolbarFilters">
          <input className="input" placeholder="query（名称/ID/标签）" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" value={risk} onChange={(e) => setRisk(e.target.value as "" | RiskLevel)}>
            <option value="">risk：全部</option>
            <option value="CRITICAL">严重风险</option>
            <option value="HIGH">高风险</option>
            <option value="MEDIUM">中风险</option>
            <option value="LOW">低风险</option>
          </select>
          <select className="input" value={hasOpenAlerts} onChange={(e) => setHasOpenAlerts(e.target.value as "" | "yes" | "no") }>
            <option value="">has_open_alerts：全部</option>
            <option value="yes">有未关闭告警</option>
            <option value="no">无未关闭告警</option>
          </select>
          <select className="input" value={hasPendingAcceptance} onChange={(e) => setHasPendingAcceptance(e.target.value as "" | "yes" | "no") }>
            <option value="">has_pending_acceptance：全部</option>
            <option value="yes">有待验收</option>
            <option value="no">无待验收</option>
          </select>
          <input className="input" placeholder="tags（逗号分隔，如 重点巡检,玉米）" value={tags} onChange={(e) => setTags(e.target.value)} />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="risk">sort：风险</option>
            <option value="open_alerts">sort：未关闭告警（高→低）</option>
            <option value="pending_acceptance">sort：待验收（高→低）</option>
            <option value="last_operation_at">sort：最近作业（新→旧）</option>
            <option value="updated_at">sort：更新时间（新→旧）</option>
            <option value="cost">sort：周期成本（高→低）</option>
            <option value="field_name">sort：地块名称（A→Z）</option>
          </select>
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">地块列表</div>
            <div className="sectionDesc">列表数据与汇总指标均来自后端接口。</div>
          </div>
          <div className="inlineActions">
            <button className="btn" type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={loading || page <= 1}>上一页</button>
            <span className="metaText">第 {page} 页</span>
            <button className="btn" type="button" onClick={() => setPage((prev) => prev + 1)} disabled={loading || items.length < pageSize}>下一页</button>
            <select className="input" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} disabled={loading}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / 页</option>)}
            </select>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>地块</th>
              <th>风险</th>
              <th>告警摘要</th>
              <th>验收摘要</th>
              <th>作业摘要</th>
              <th>成本摘要</th>
              <th>设备遥测</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>正在加载...</td></tr>
            ) : null}
            {!loading && items.map((item) => {
              const tagsText = item.tags.join(" / ");
              const alertSummary = `OPEN ${item.alert_summary.open_total}`;
              const acceptanceSummary = `待验收 ${item.acceptance_summary.pending_count} · 无效 ${item.acceptance_summary.invalid_count}`;
              const operationSummary = `${formatTime(item.operation_summary.last_operation_at)} · ${item.operation_summary.last_action_type ?? "-"} · ${item.operation_summary.last_final_status ?? "-"}`;
              const costSummary = `预计 ${formatMoney(item.cost_summary.estimated_total)} · 实际 ${formatMoney(item.cost_summary.actual_total)}`;
              const telemetrySummary = `${formatTime(item.telemetry_summary.latest_ts)} · ${item.telemetry_summary.device_offline ? "设备离线" : "设备在线"}`;

              return (
                <tr key={item.field_id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{item.field_name || item.field_id}</div>
                    <div className="metaText">{item.field_id}{tagsText ? ` · ${tagsText}` : ""}</div>
                  </td>
                  <td>{riskLabel(item.risk_level)}{item.risk_reasons.length ? `（${item.risk_reasons.join("、")}）` : ""}</td>
                  <td>{alertSummary}</td>
                  <td>{acceptanceSummary}</td>
                  <td>{operationSummary}</td>
                  <td>{costSummary}</td>
                  <td>{telemetrySummary}</td>
                  <td>{formatTime(item.updated_at)}</td>
                </tr>
              );
            })}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={8}>没有符合筛选条件的地块。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {error ? <div className="metaText" style={{ marginTop: 8 }}>{error}</div> : null}
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">快速入口</div><div className="sectionDesc">一键进入常用页面。</div></div></div>
        <div className="inlineActions" style={{ flexWrap: "wrap" }}>
          <Link className="btn" to="/fields/field_north_01/report">地块报告</Link>
          <Link className="btn" to="/alerts">告警页</Link>
          <Link className="btn" to="/operations">最近作业</Link>
        </div>
      </section>
    </div>
  );
}
