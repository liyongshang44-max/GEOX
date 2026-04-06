import React from "react";
import { Link } from "react-router-dom";
import { listSkillRegistry, type SkillRegistryItem } from "../../../api/skills";
import ErrorState from "../../../components/common/ErrorState";

function fmtTs(ts?: number | null): string {
  const n = Number(ts ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString("zh-CN", { hour12: false });
}

export default function SkillRegistryPage(): React.ReactElement {
  const [items, setItems] = React.useState<SkillRegistryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void listSkillRegistry({ limit: 100 }).then((res) => {
      if (!mounted) return;
      setItems(res);
      setError(null);
    }).catch((e: any) => {
      if (mounted) setError(e?.message ?? "读取失败");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Skills Registry</div>
          <h2 className="heroTitle">技能注册中心</h2>
          <p className="heroText">按标准枚举状态（DRAFT/ACTIVE/DISABLED/DEPRECATED）、版本、绑定范围追踪技能资产，并快速进入绑定和运行明细。</p>
        </div>
      </section>

      {error ? <ErrorState title="技能注册中心加载失败" message={error} onRetry={() => window.location.reload()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">技能列表</div>
            <div className="sectionDesc">展示标准状态枚举、当前版本、最新版本、绑定范围及最近运行概览。</div>
          </div>
        </div>
        {loading ? <div className="emptyState">加载中...</div> : null}
        {!loading && !items.length ? <div className="emptyState">暂无技能注册数据。</div> : null}
        <div className="list modernList">
          {items.map((item) => (
            <div key={item.skill_id} className="infoCard">
              <div className="jobTitleRow">
                <div>
                  <div className="title">{item.skill_name || item.skill_id}</div>
                  <div className="metaText">{item.skill_id}</div>
                </div>
                <div className={`pill tone-${String(item.status).toUpperCase() === "ACTIVE" ? "ok" : "warn"}`}>{item.status}</div>
              </div>
              <div className="meta wrapMeta">
                <span>当前版本：{item.current_version || "-"}</span>
                <span>最新版本：{item.latest_version || "-"}</span>
                <span>绑定范围：{item.binding_scope || "-"}</span>
                <span>最近运行：{item.last_run?.status || "-"}</span>
                <span>最近更新：{fmtTs(item.updated_ts_ms)}</span>
              </div>
              <div className="inlineActions">
                <Link className="btn" to={`/skills/bindings?skill_id=${encodeURIComponent(item.skill_id)}`}>查看绑定</Link>
                <Link className="btn" to={item.last_run?.run_id ? `/skills/runs/${encodeURIComponent(item.last_run.run_id)}` : "/skills/runs"}>最近运行</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
