import React from "react";
import { Link } from "react-router-dom";
import {
  fetchFieldPortfolio,
  fetchFieldPortfolioSummary,
  type FieldPortfolioItemV1,
  type FieldPortfolioSummaryV1,
  type FetchFieldPortfolioParams,
} from "../api/fieldPortfolio";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
type SortMode = "business_priority" | "updated_desc" | "cost_desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatMoney(value: number): string {
  return `¥${new Intl.NumberFormat("zh-CN").format(value)}`;
}

function formatTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function riskLabel(risk: string): string {
  const normalized = String(risk ?? "").toUpperCase();
  if (normalized === "HIGH") return "高";
  if (normalized === "MEDIUM") return "中";
  if (normalized === "LOW") return "低";
  return "-";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toText(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "-";
}

function toTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => String(tag ?? "").trim()).filter(Boolean);
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
  const [sort, setSort] = React.useState<SortMode>("business_priority");
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

  const total = toNumber(summary?.fields?.total);
  const riskCount = toNumber(summary?.fields?.at_risk);
  const severeRiskCount = toNumber(summary?.top_risk_fields?.filter((item) => String(item?.risk_level ?? "").toUpperCase() === "HIGH").length);
  const openAlerts = 0;
  const pendingAcceptance = 0;
  const cycleCost = toNumber(summary?.period_summary?.total_cost);

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
            <option value="HIGH">高风险</option>
            <option value="MEDIUM">中风险</option>
            <option value="LOW">低风险</option>
          </select>
          <select className="input" value={hasOpenAlerts} onChange={(e) => setHasOpenAlerts(e.target.value as "" | "yes" | "no")}>
            <option value="">has_open_alerts：全部</option>
            <option value="yes">有未关闭告警</option>
            <option value="no">无未关闭告警</option>
          </select>
          <select className="input" value={hasPendingAcceptance} onChange={(e) => setHasPendingAcceptance(e.target.value as "" | "yes" | "no")}>
            <option value="">has_pending_acceptance：全部</option>
            <option value="yes">有待验收</option>
            <option value="no">无待验收</option>
          </select>
          <input className="input" placeholder="tags（逗号分隔，如 重点巡检,玉米）" value={tags} onChange={(e) => setTags(e.target.value)} />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="business_priority">sort：经营优先（风险→告警→待验收→更新时间）</option>
            <option value="updated_desc">sort：更新时间（新→旧）</option>
            <option value="cost_desc">sort：周期成本（高→低）</option>
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
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>正在加载...</td></tr>
            ) : null}
            {!loading && items.map((item, idx) => {
              const anyItem = item as Record<string, unknown>;
              const riskLevel = toText(anyItem.risk_level);
              const alertSummary = toText(anyItem.alert_summary);
              const acceptanceSummary = toText(anyItem.acceptance_summary);
              const operationSummary = toText(anyItem.operation_summary);
              const costSummary = toText(anyItem.cost_summary);
              const tagsText = toTagList(anyItem.tags).join(" / ");
              const updatedAt = String(anyItem.updated_at ?? "");

              return (
                <tr key={String(anyItem.field_id ?? anyItem.program_id ?? idx)}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{toText(anyItem.name || anyItem.field_id)}</div>
                    <div className="metaText">{toText(anyItem.field_id)}{tagsText ? ` · ${tagsText}` : ""}</div>
                  </td>
                  <td>{riskLabel(riskLevel)}</td>
                  <td>{alertSummary}</td>
                  <td>{acceptanceSummary}</td>
                  <td>{operationSummary}</td>
                  <td>{costSummary}</td>
                  <td>{formatTime(updatedAt)}</td>
                </tr>
              );
            })}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={7}>没有符合筛选条件的地块。</td>
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
