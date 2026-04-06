import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listSkillBindings, type SkillBindingItem } from "../../../api/skills";
import ErrorState from "../../../components/common/ErrorState";

function fmtTs(ts?: number | null): string {
  const n = Number(ts ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString("zh-CN", { hour12: false });
}

export default function SkillBindingsPage(): React.ReactElement {
  const [search] = useSearchParams();
  const skillId = search.get("skill_id") ?? "";
  const [items, setItems] = React.useState<SkillBindingItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    void listSkillBindings({ skill_id: skillId || undefined, limit: 100 }).then((res) => {
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
  }, [skillId]);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Skill Bindings</div>
          <h2 className="heroTitle">技能绑定视图</h2>
          <p className="heroText">查看技能版本与绑定范围映射，识别默认策略和优先级冲突。</p>
        </div>
      </section>

      {error ? <ErrorState title="技能绑定读取失败" message={error} onRetry={() => window.location.reload()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">绑定清单 {skillId ? `· ${skillId}` : ""}</div>
            <div className="sectionDesc">展示状态、版本、作用域、目标对象、最近运行状态。</div>
          </div>
        </div>

        {loading ? <div className="emptyState">加载中...</div> : null}
        {!loading && !items.length ? <div className="emptyState">暂无绑定数据。</div> : null}

        <div className="list modernList">
          {items.map((item) => (
            <div key={item.binding_id} className="infoCard">
              <div className="jobTitleRow">
                <div>
                  <div className="title">{item.skill_id}</div>
                  <div className="metaText">{item.binding_id}</div>
                </div>
                <div className={`pill tone-${String(item.status).toUpperCase() === "ACTIVE" ? "ok" : "warn"}`}>{item.status}</div>
              </div>
              <div className="meta wrapMeta">
                <span>版本：{item.version}</span>
                <span>范围：{item.scope}</span>
                <span>目标：{item.target_id || item.crop_code || "-"}</span>
                <span>优先级：{item.priority ?? "-"}</span>
                <span>默认绑定：{item.is_default ? "是" : "否"}</span>
                <span>最近运行：{item.last_run?.status || "-"}</span>
                <span>更新时间：{fmtTs(item.updated_ts_ms)}</span>
              </div>
              <div className="inlineActions">
                <Link className="btn" to="/skills/registry">返回注册中心</Link>
                <Link className="btn" to={item.last_run?.run_id ? `/skills/runs/${encodeURIComponent(item.last_run.run_id)}` : "/skills/runs"}>查看运行</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
