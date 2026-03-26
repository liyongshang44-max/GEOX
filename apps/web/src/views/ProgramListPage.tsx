import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio } from "../api";
import { StatusTag } from "../components/StatusTag";
import { RelativeTime } from "../components/RelativeTime";

function boolText(v: boolean): string { return v ? "是" : "否"; }

export default function ProgramListPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [fieldFilter, setFieldFilter] = React.useState("ALL");
  const [executableFilter, setExecutableFilter] = React.useState("ALL");
  const [riskFilter, setRiskFilter] = React.useState("ALL");
  const [approvalFilter, setApprovalFilter] = React.useState("ALL");
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

  const fieldOptions = React.useMemo(() => Array.from(new Set(items.map((x) => String(x?.field_id || "-")).filter(Boolean))), [items]);

  const filtered = React.useMemo(() => {
    const list = items.filter((x) => {
      const status = String(x?.status || "UNKNOWN").toUpperCase();
      const risk = String(x?.current_risk_summary?.level || "LOW").toUpperCase();
      const mode = String(x?.next_action_hint?.mode || x?.next_action_hint?.decision_mode || "AUTO").toUpperCase();
      const executable = !(mode.includes("BLOCKED") || mode.includes("APPROVAL"));
      const hasApproval = mode.includes("APPROVAL");
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (fieldFilter !== "ALL" && String(x?.field_id || "-") !== fieldFilter) return false;
      if (executableFilter !== "ALL" && boolText(executable) !== executableFilter) return false;
      if (riskFilter !== "ALL" && risk !== riskFilter) return false;
      if (approvalFilter !== "ALL" && boolText(hasApproval) !== approvalFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      const ta = Date.parse(String(a?.updated_at || "")) || 0;
      const tb = Date.parse(String(b?.updated_at || "")) || 0;
      if (sortBy === "updated_asc") return ta - tb;
      return tb - ta;
    });
    return list;
  }, [items, statusFilter, fieldFilter, executableFilter, riskFilter, approvalFilter, sortBy]);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">经营 Program</div>
            <div className="muted">结果数：{loading ? "-" : filtered.length}</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
        <div className="toolbarFilters">
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">状态（全部）</option><option value="ACTIVE">运行中</option><option value="BLOCKED">阻塞</option></select>
          <select className="select" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}><option value="ALL">田块（全部）</option>{fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          <select className="select" value={executableFilter} onChange={(e) => setExecutableFilter(e.target.value)}><option value="ALL">可执行（全部）</option><option value="是">可执行</option><option value="否">不可执行</option></select>
          <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option value="ALL">风险（全部）</option><option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option></select>
          <select className="select" value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)}><option value="ALL">待审批（全部）</option><option value="是">是</option><option value="否">否</option></select>
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="updated_desc">最近更新时间（新→旧）</option><option value="updated_asc">最近更新时间（旧→新）</option></select>
        </div>
      </section>

      <section className="list modernList">
        {filtered.map((p) => {
          const mode = String(p?.next_action_hint?.mode || p?.next_action_hint?.decision_mode || "AUTO");
          const executable = !(mode.toUpperCase().includes("BLOCKED") || mode.toUpperCase().includes("APPROVAL"));
          return (
            <article key={String(p?.program_id)} className="infoCard">
              <div className="jobTitleRow"><div className="title">{String(p?.program_id || "-")}</div><StatusTag status={String(p?.status || "UNKNOWN")} /></div>
              <div className="meta wrapMeta">
                <span>田块：{String(p?.field_id || "-")}</span>
                <span>季节：{String(p?.season_id || "-")}</span>
                <span>作物：{String(p?.crop_code || "-")}</span>
                <span>可执行：{boolText(executable)}</span>
                <span>风险：{String(p?.current_risk_summary?.level || "LOW")}</span>
                <span>更新时间：<RelativeTime value={String(p?.updated_at || "")} /></span>
              </div>
              <div style={{ marginTop: 8 }}>下一步建议：{String(p?.next_action_hint?.kind || "等待下一轮评估")}</div>
              <div style={{ marginTop: 10 }}><Link className="btn" to={`/programs/${encodeURIComponent(String(p?.program_id || ""))}`}>查看详情</Link></div>
            </article>
          );
        })}
        {!loading && !filtered.length ? <div className="emptyState">暂无可展示 Program。请调整筛选条件或稍后刷新。</div> : null}
      </section>
    </div>
  );
}
