import React from "react";
import { Link } from "react-router-dom";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
type SortMode = "business_priority" | "updated_desc" | "cost_desc";

type PortfolioItem = {
  field_id: string;
  name: string;
  risk: RiskLevel;
  open_alerts: number;
  pending_acceptance: number;
  last_operation: string;
  updated_at: string;
  cycle_cost: number;
  tags: string[];
};

const SAMPLE_ITEMS: PortfolioItem[] = [
  {
    field_id: "field_north_01",
    name: "北区一号地块",
    risk: "HIGH",
    open_alerts: 4,
    pending_acceptance: 2,
    last_operation: "灌溉 · 2026-04-10 18:30",
    updated_at: "2026-04-11T05:20:00Z",
    cycle_cost: 6200,
    tags: ["玉米", "高盐碱", "重点巡检"],
  },
  {
    field_id: "field_west_03",
    name: "西区三号地块",
    risk: "MEDIUM",
    open_alerts: 2,
    pending_acceptance: 1,
    last_operation: "施肥 · 2026-04-10 09:50",
    updated_at: "2026-04-10T10:20:00Z",
    cycle_cost: 4100,
    tags: ["小麦", "节水"],
  },
  {
    field_id: "field_east_02",
    name: "东区二号地块",
    risk: "LOW",
    open_alerts: 0,
    pending_acceptance: 0,
    last_operation: "采样 · 2026-04-09 16:10",
    updated_at: "2026-04-09T16:10:00Z",
    cycle_cost: 2800,
    tags: ["水稻", "稳态"],
  },
  {
    field_id: "field_south_07",
    name: "南区七号地块",
    risk: "HIGH",
    open_alerts: 3,
    pending_acceptance: 0,
    last_operation: "病虫害处置 · 2026-04-11 07:15",
    updated_at: "2026-04-11T07:15:00Z",
    cycle_cost: 5300,
    tags: ["番茄", "病虫害", "重点巡检"],
  },
  {
    field_id: "field_central_05",
    name: "中区五号地块",
    risk: "MEDIUM",
    open_alerts: 1,
    pending_acceptance: 3,
    last_operation: "追肥 · 2026-04-10 22:00",
    updated_at: "2026-04-11T01:00:00Z",
    cycle_cost: 3900,
    tags: ["大豆", "待验收"],
  },
];

const riskWeight: Record<RiskLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function formatMoney(value: number): string {
  return `¥${new Intl.NumberFormat("zh-CN").format(value)}`;
}

function formatTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function riskLabel(risk: RiskLevel): string {
  if (risk === "HIGH") return "高";
  if (risk === "MEDIUM") return "中";
  return "低";
}

function sortByBusinessPriority(a: PortfolioItem, b: PortfolioItem): number {
  if (riskWeight[b.risk] !== riskWeight[a.risk]) return riskWeight[b.risk] - riskWeight[a.risk];
  if (b.open_alerts !== a.open_alerts) return b.open_alerts - a.open_alerts;
  if (b.pending_acceptance !== a.pending_acceptance) return b.pending_acceptance - a.pending_acceptance;
  return Date.parse(b.updated_at) - Date.parse(a.updated_at);
}

export default function FieldPortfolioPage(): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [risk, setRisk] = React.useState<"" | RiskLevel>("");
  const [hasOpenAlerts, setHasOpenAlerts] = React.useState<"" | "yes" | "no">("");
  const [hasPendingAcceptance, setHasPendingAcceptance] = React.useState<"" | "yes" | "no">("");
  const [tags, setTags] = React.useState("");
  const [sort, setSort] = React.useState<SortMode>("business_priority");

  const normalizedTags = React.useMemo(
    () => tags.split(",").map((item) => item.trim()).filter(Boolean),
    [tags],
  );

  const filtered = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const next = SAMPLE_ITEMS.filter((item) => {
      const hitKeyword = !keyword
        || item.field_id.toLowerCase().includes(keyword)
        || item.name.toLowerCase().includes(keyword)
        || item.tags.some((tag) => tag.toLowerCase().includes(keyword));
      if (!hitKeyword) return false;

      if (risk && item.risk !== risk) return false;
      if (hasOpenAlerts === "yes" && item.open_alerts <= 0) return false;
      if (hasOpenAlerts === "no" && item.open_alerts > 0) return false;
      if (hasPendingAcceptance === "yes" && item.pending_acceptance <= 0) return false;
      if (hasPendingAcceptance === "no" && item.pending_acceptance > 0) return false;

      if (normalizedTags.length) {
        const tagSet = new Set(item.tags.map((tag) => tag.toLowerCase()));
        const everyTagMatched = normalizedTags.every((tag) => tagSet.has(tag.toLowerCase()));
        if (!everyTagMatched) return false;
      }

      return true;
    });

    if (sort === "updated_desc") {
      return [...next].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    }
    if (sort === "cost_desc") {
      return [...next].sort((a, b) => b.cycle_cost - a.cycle_cost);
    }
    return [...next].sort(sortByBusinessPriority);
  }, [hasOpenAlerts, hasPendingAcceptance, normalizedTags, query, risk, sort]);

  const summary = React.useMemo(() => {
    const severeRiskCount = filtered.filter((item) => item.risk === "HIGH").length;
    const riskCount = filtered.filter((item) => item.risk !== "LOW").length;
    const openAlerts = filtered.reduce((sum, item) => sum + item.open_alerts, 0);
    const pendingAcceptance = filtered.reduce((sum, item) => sum + item.pending_acceptance, 0);
    const cycleCost = filtered.reduce((sum, item) => sum + item.cycle_cost, 0);

    return {
      total: filtered.length,
      riskCount,
      severeRiskCount,
      openAlerts,
      pendingAcceptance,
      cycleCost,
    };
  }, [filtered]);

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
        <div className="metricCard card"><div className="metricLabel">总地块</div><div className="metricValue">{summary.total}</div></div>
        <div className="metricCard card"><div className="metricLabel">风险地块</div><div className="metricValue">{summary.riskCount}</div></div>
        <div className="metricCard card"><div className="metricLabel">严重地块</div><div className="metricValue">{summary.severeRiskCount}</div></div>
        <div className="metricCard card"><div className="metricLabel">未关闭告警</div><div className="metricValue">{summary.openAlerts}</div></div>
        <div className="metricCard card"><div className="metricLabel">待验收</div><div className="metricValue">{summary.pendingAcceptance}</div></div>
        <div className="metricCard card"><div className="metricLabel">周期成本</div><div className="metricValue">{formatMoney(summary.cycleCost)}</div></div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">筛选栏</div><div className="sectionDesc">支持 query/risk/has_open_alerts/has_pending_acceptance/tags/sort。</div></div></div>
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
        <div className="sectionHeader"><div><div className="sectionTitle">地块列表</div><div className="sectionDesc">可切换为表格视图，当前为表格模式。</div></div></div>
        <table className="table">
          <thead>
            <tr>
              <th>地块</th>
              <th>风险</th>
              <th>告警数</th>
              <th>待验收</th>
              <th>最近作业</th>
              <th>更新时间</th>
              <th>成本</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.field_id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div className="metaText">{item.field_id} · {item.tags.join(" / ")}</div>
                </td>
                <td>{riskLabel(item.risk)}</td>
                <td>{item.open_alerts}</td>
                <td>{item.pending_acceptance}</td>
                <td>{item.last_operation}</td>
                <td>{formatTime(item.updated_at)}</td>
                <td>{formatMoney(item.cycle_cost)}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={7}>没有符合筛选条件的地块。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
