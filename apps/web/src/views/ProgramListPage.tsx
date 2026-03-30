
import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio } from "../api";
import EmptyState from "../components/common/EmptyState";
import { RelativeTime } from "../components/RelativeTime";

function toText(v: unknown, fallback = ""): string {
  if (typeof v === "string") {
    const cleaned = v.trim();
    return cleaned || fallback;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function planName(item: any): string {
  const title = toText(item?.title || item?.display_name || item?.program_name, "");
  if (title && !/^prg_/i.test(title) && title.toLowerCase() !== String(item?.program_id || "").toLowerCase()) return title;
  const crop = toText(item?.crop_name || item?.crop_code, "");
  return crop ? `${crop}经营方案` : "默认经营方案";
}

function fieldLabel(item: any): string {
  const raw = toText(item?.field_name || item?.field_label || item?.field_id, "");
  if (!raw) return "未命名田块";
  if (/^field_demo_/i.test(raw)) return `示范田 ${raw.replace(/^field_demo_/i, "")}`;
  if (/^field_/i.test(raw)) return "未命名田块";
  return raw;
}

function riskLabel(item: any): "高风险" | "中风险" | "低风险" {
  const risk = String(item?.current_risk_summary?.level || "LOW").toUpperCase();
  if (risk === "HIGH") return "高风险";
  if (risk === "MEDIUM") return "中风险";
  return "低风险";
}

function stageLabel(item: any): "运行中" | "待决策" | "异常" {
  const status = String(item?.status || "").toUpperCase();
  const mode = String(item?.next_action_hint?.mode || item?.next_action_hint?.decision_mode || "").toUpperCase();
  if (status.includes("FAILED") || status.includes("ERROR") || mode.includes("BLOCKED")) return "异常";
  if (mode.includes("APPROVAL") || status.includes("PENDING")) return "待决策";
  return "运行中";
}

function nextSuggestion(item: any): string {
  const hint = toText(item?.next_action_hint?.human_summary || item?.next_action_hint?.expected_effect, "");
  return hint || "等待下一轮系统评估";
}

function tone(stage: string): "danger" | "warning" | "success" {
  if (stage === "异常") return "danger";
  if (stage === "待决策") return "warning";
  return "success";
}

export default function ProgramListPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [fieldFilter, setFieldFilter] = React.useState("ALL");
  const [riskFilter, setRiskFilter] = React.useState("ALL");

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProgramPortfolio({ limit: 300 });
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  const fieldOptions = React.useMemo(
    () => Array.from(new Set(items.map((x) => fieldLabel(x)).filter(Boolean))),
    [items],
  );

  const filtered = React.useMemo(() => {
    return items.filter((x) => {
      const stage = stageLabel(x);
      const field = fieldLabel(x);
      const risk = riskLabel(x);
      if (statusFilter !== "ALL" && stage !== statusFilter) return false;
      if (fieldFilter !== "ALL" && field !== fieldFilter) return false;
      if (riskFilter !== "ALL" && risk !== riskFilter) return false;
      return true;
    });
  }, [items, statusFilter, fieldFilter, riskFilter]);

  const stats = React.useMemo(() => ({
    total: filtered.length,
    running: filtered.filter((x) => stageLabel(x) === "运行中").length,
    waiting: filtered.filter((x) => stageLabel(x) === "待决策").length,
    risk: filtered.filter((x) => riskLabel(x) === "高风险").length,
  }), [filtered]);

  const groups = React.useMemo(() => ({
    danger: filtered.filter((x) => stageLabel(x) === "异常" || riskLabel(x) === "高风险"),
    warning: filtered.filter((x) => stageLabel(x) === "待决策" && riskLabel(x) !== "高风险"),
    success: filtered.filter((x) => stageLabel(x) === "运行中" && riskLabel(x) !== "高风险"),
  }), [filtered]);

  return (
    <div className="demoDashboardPage">
      <section className="card demoHero dashboardHeroV2">
        <div className="eyebrow">GEOX / 经营方案页</div>
        <h1 className="demoHeroTitle">今天重点推进哪些方案</h1>
        <p className="demoHeroSubTitle">
          先看高风险和待决策方案，再看正在稳定运行的方案。这个页面不是方案档案，而是经营推进入口。
        </p>
        <div className="operationsSummaryActions">
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新方案</button>
          <Link className="btn" to="/agronomy">查看农业建议</Link>
        </div>
      </section>

      <section className="summaryGrid4 demoSummaryGrid">
        <article className="card demoMetricCard">
          <div className="demoMetricLabel">经营方案总数</div>
          <div className="demoMetricValue">{stats.total}</div>
          <div className="demoMetricHint">当前筛选结果中的经营方案数量。</div>
        </article>
        <article className="card demoMetricCard">
          <div className="demoMetricLabel">运行中</div>
          <div className="demoMetricValue">{stats.running}</div>
          <div className="demoMetricHint">已进入持续推进阶段的方案。</div>
        </article>
        <article className="card demoMetricCard">
          <div className="demoMetricLabel">待决策</div>
          <div className="demoMetricValue">{stats.waiting}</div>
          <div className="demoMetricHint">建议优先进入人工判断或审批链。</div>
        </article>
        <article className="card demoMetricCard">
          <div className="demoMetricLabel">高风险</div>
          <div className="demoMetricValue">{stats.risk}</div>
          <div className="demoMetricHint">需要今天优先盯住的方案。</div>
        </article>
      </section>

      <section className="card detailHeroCard">
        <div className="demoSectionHeader">
          <div className="sectionTitle">筛选条件</div>
          <div className="sectionDesc">按阶段、田块和风险锁定今天要推进的经营方案。</div>
        </div>
        <div className="toolbarFilters">
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">阶段（全部）</option>
            <option value="运行中">运行中</option>
            <option value="待决策">待决策</option>
            <option value="异常">异常</option>
          </select>
          <select className="select" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
            <option value="ALL">田块（全部）</option>
            {fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="ALL">风险等级（全部）</option>
            <option value="高风险">高风险</option>
            <option value="中风险">中风险</option>
            <option value="低风险">低风险</option>
          </select>
        </div>
      </section>

      <section className="dashboardDecisionBoard">
        {(["danger","warning","success"] as const).map((key) => {
          const title = key === "danger" ? "必须推进" : key === "warning" ? "建议推进" : "稳定运行";
          const subtitle = key === "danger" ? "高风险或异常方案，建议优先人工处理。" :
            key === "warning" ? "待决策方案，适合今天继续推进。" :
            "已稳定运行，可继续观察结果与证据。";
          const list = groups[key];
          return (
            <article key={key} className={`card decisionColumn ${key}`}>
              <div className="decisionHeader">
                <div>
                  <div className="sectionTitle">{title}</div>
                  <div className="sectionDesc">{subtitle}</div>
                </div>
                <div className="decisionCount">{list.length}</div>
              </div>
              <div className="decisionList">
                {list.slice(0, 6).map((p) => (
                  <Link key={String(p?.program_id || p?.id)} to={`/programs/${encodeURIComponent(String(p?.program_id || p?.id || ""))}`} className="decisionItemLink">
                    <div className="decisionItemTitle">{planName(p)}</div>
                    <div className="decisionItemMeta">
                      {fieldLabel(p)} · {riskLabel(p)} · {nextSuggestion(p)}
                    </div>
                    <div className="decisionItemMeta" style={{ marginTop: 8 }}>
                      最近更新：<RelativeTime value={p?.updated_at || p?.updated_ts_ms} />
                    </div>
                  </Link>
                ))}
                {!loading && !list.length ? <div className="decisionItemStatic">当前没有对应方案</div> : null}
              </div>
            </article>
          );
        })}
      </section>

      {!loading && !filtered.length ? <EmptyState title="暂无可展示经营方案" description="请调整筛选条件或稍后刷新。" /> : null}
    </div>
  );
}
