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
  if (title && !/^prg_/i.test(title) && title.toLowerCase() !== String(item?.program_id || "").toLowerCase()) {
    return title;
  }
  const crop = toText(item?.crop_name || item?.crop_code, "");
  return crop ? `${crop}种植方案` : "默认经营方案";
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

function stageLabel(item: any): "运行中" | "待执行" | "异常" {
  const status = String(item?.status || "").toUpperCase();
  const mode = String(item?.next_action_hint?.mode || item?.next_action_hint?.decision_mode || "").toUpperCase();
  if (status.includes("FAILED") || status.includes("ERROR") || mode.includes("BLOCKED")) return "异常";
  if (mode.includes("APPROVAL") || status.includes("PENDING")) return "待执行";
  return "运行中";
}

function nextSuggestion(item: any): string {
  const hint = toText(item?.next_action_hint?.human_summary || item?.next_action_hint?.expected_effect, "");
  return hint || "等待下一轮评估";
}

function badgeClass(stage: string): string {
  if (stage === "异常") return "bg-red-50 text-red-700";
  if (stage === "待执行") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
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
            <option value="待执行">待执行</option>
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

      <section className="list modernList">
        {filtered.map((p, idx) => {
          const pid = String(p?.program_id || p?.id || "");
          const stage = stageLabel(p);
          return (
            <article key={pid || idx} className="infoCard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong>方案概览</strong>
                <span className={`text-sm px-3 py-1 rounded ${badgeClass(stage)}`}>{stage}</span>
              </div>

              <div className="kv"><span className="k">方案名称</span><span className="v">{planName(p)}</span></div>
              <div className="kv"><span className="k">所属田块</span><span className="v">{fieldLabel(p)}</span></div>
              <div className="kv"><span className="k">当前阶段</span><span className="v">{stage}</span></div>
              <div className="kv"><span className="k">风险等级</span><span className="v">{riskLabel(p)}</span></div>
              <div className="kv"><span className="k">下一步建议</span><span className="v">{nextSuggestion(p)}</span></div>

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
