import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio } from "../api";
import EmptyState from "../components/common/EmptyState";
import { RelativeTime } from "../components/RelativeTime";

function toText(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim() || fallback;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function planName(item: any): string {
  return toText(item?.name || item?.title || item?.program_name || item?.program_id, "经营方案");
}

function fieldLabel(item: any): string {
  return toText(item?.field_name || item?.field_id, "未绑定田块");
}

function stageLabel(item: any): string {
  const status = String(item?.status || "").toUpperCase();
  if (status.includes("FAILED") || status.includes("ERROR")) return "偏差风险";
  if (status.includes("PENDING") || status.includes("APPROVAL")) return "待推进";
  return "推进中";
}

function objectiveLabel(item: any): string {
  const crop = toText(item?.crop_name || item?.crop_code, "作物目标");
  const quality = toText(item?.goal_profile?.quality_priority, "稳定品质");
  return `${crop} · 目标：${quality}`;
}

function impactLabel(item: any): string {
  return toText(item?.latest_effect_summary || item?.next_action_hint?.expected_effect || item?.next_action_hint?.human_summary, "最近影响待生成");
}

export default function ProgramListPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  return (
    <div className="demoDashboardPage programClosurePage">
      <section className="card demoHero dashboardHeroV2">
        <div className="eyebrow">GEOX / 经营方案页</div>
        <h1 className="demoHeroTitle">经营方案列表</h1>
        <p className="demoHeroSubTitle">这个页面只讲经营目标、阶段偏差与最近影响，不重复实时监控内容。</p>
        <div className="operationsSummaryActions">
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新方案</button>
          <Link className="btn primary" to="/programs/create">初始化经营方案</Link>
          <Link className="btn" to="/dashboard">返回总览</Link>
        </div>
      </section>

      <section className="programListCards">
        {items.map((p) => {
          const id = String(p?.program_id || p?.id || "");
          return (
            <article key={id || JSON.stringify(p)} className="card programBusinessCard">
              <div className="operationsSummaryTop">
                <div>
                  <div className="operationsSummaryTitle">{planName(p)}</div>
                  <div className="operationsSummaryLead">{objectiveLabel(p)}</div>
                </div>
                <span className="traceChip">{stageLabel(p)}</span>
              </div>

              <div className="operationsSummaryGrid" style={{ marginTop: 8 }}>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">关联田块</span><strong>{fieldLabel(p)}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">阶段偏差</span><strong>{stageLabel(p) === "偏差风险" ? "存在偏差，需处理" : "暂无明显偏差"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近影响</span><strong>{impactLabel(p)}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近更新</span><strong><RelativeTime value={p?.updated_at || p?.updated_ts_ms} /></strong></div>
              </div>

              <div className="operationsSummaryActions">
                <Link className="btn" to={`/programs/${encodeURIComponent(id)}`}>查看经营方案页</Link>
                <Link className="btn" to="/programs/create">新建方案</Link>
              </div>
            </article>
          );
        })}
      </section>

      {!loading && !items.length ? (
        <EmptyState
          title="还没有 Program"
          description="先初始化经营方案，创建后可直接返回列表并进入详情页查看目标与偏差。"
          actionText="初始化经营方案"
          onAction={() => { window.location.assign("/programs/create"); }}
          secondaryActionText="返回总览"
          onSecondaryAction={() => { window.location.assign("/dashboard"); }}
        />
      ) : null}
    </div>
  );
}
