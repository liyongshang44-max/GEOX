import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio } from "../api";
import EmptyState from "../components/common/EmptyState";
import { RelativeTime } from "../components/RelativeTime";

function toText(v: unknown, fallback = "-"): string {
  if (typeof v === "string") {
    const cleaned = v.trim();
    return cleaned || fallback;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function fieldLabel(item: any): string {
  const raw = String(item?.field_name || item?.field_label || item?.field_id || "");
  if (!raw) return "未分配田块";
  if (raw.startsWith("field_demo_")) return `示范田 ${raw.replace("field_demo_", "")}`;
  return raw;
}

function planName(item: any): string {
  const title = toText(item?.title || item?.display_name || item?.program_name, "");
  if (title) return title;
  const crop = toText(item?.crop_name || item?.crop_code, "作物");
  return `${crop}种植方案`;
}

function riskLabel(item: any): string {
  const risk = String(item?.current_risk_summary?.level || "LOW").toUpperCase();
  if (risk === "HIGH") return "高风险";
  if (risk === "MEDIUM") return "中风险";
  return "低风险";
}

function stageLabel(item: any): string {
  const status = String(item?.status || "").toUpperCase();
  const mode = String(item?.next_action_hint?.mode || item?.next_action_hint?.decision_mode || "").toUpperCase();
  if (status.includes("RUNNING") || status.includes("ACTIVE")) return "运行中";
  if (mode.includes("APPROVAL")) return "待审批";
  if (mode.includes("BLOCKED")) return "异常";
  return "运行中";
}

function adviceLabel(item: any): string {
  const hint = toText(item?.next_action_hint?.human_summary || item?.next_action_hint?.expected_effect, "");
  return hint || "等待下一轮评估";
}

export default function ProgramListPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [fieldFilter, setFieldFilter] = React.useState("ALL");
  const [riskFilter, setRiskFilter] = React.useState("ALL");
  const [sortBy, setSortBy] = React.useState("updated_desc");

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
    const list = items.filter((x) => {
      const stage = stageLabel(x);
      const field = fieldLabel(x);
      const risk = riskLabel(x);
      if (statusFilter !== "ALL" && stage !== statusFilter) return false;
      if (fieldFilter !== "ALL" && field !== fieldFilter) return false;
      if (riskFilter !== "ALL" && risk !== riskFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      const ta = Date.parse(String(a?.updated_at || "")) || 0;
      const tb = Date.parse(String(b?.updated_at || "")) || 0;
      if (sortBy === "updated_asc") return ta - tb;
      return tb - ta;
    });
    return list;
  }, [items, statusFilter, fieldFilter, riskFilter, sortBy]);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">经营方案列表</div>
            <div className="muted">结果数：{loading ? "-" : filtered.length}</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
        <div className="toolbarFilters">
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">阶段（全部）</option>
            <option value="运行中">运行中</option>
            <option value="待审批">待审批</option>
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
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="updated_desc">最近更新时间（新→旧）</option>
            <option value="updated_asc">最近更新时间（旧→新）</option>
          </select>
        </div>
      </section>

      <section className="list modernList">
        {filtered.map((p) => {
          const pid = String(p?.program_id || p?.id || "");
          return (
            <article key={pid || Math.random()} className="infoCard">
              <div className="jobTitleRow">
                <div className="title">方案名称：{planName(p)}</div>
              </div>
              <div className="meta wrapMeta">
                <span>所属田块：{fieldLabel(p)}</span>
                <span>当前阶段：{stageLabel(p)}</span>
                <span>风险等级：{riskLabel(p)}</span>
                <span>更新时间：<RelativeTime value={String(p?.updated_at || "")} /></span>
              </div>
              <div style={{ marginTop: 8 }}>下一步建议：{adviceLabel(p)}</div>
              <div style={{ marginTop: 10 }}>
                <Link className="btn" to={`/programs/${encodeURIComponent(pid)}`}>查看详情</Link>
              </div>
            </article>
          );
        })}
        {!loading && !filtered.length ? <EmptyState title="暂无可展示经营方案" description="请调整筛选条件或稍后刷新" /> : null}
      </section>
    </div>
  );
}
