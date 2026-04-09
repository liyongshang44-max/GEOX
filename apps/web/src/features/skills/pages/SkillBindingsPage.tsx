import React from "react";
import { useSearchParams } from "react-router-dom";
import { listSkillBindingsViews, type SkillBindingViewItem, type SkillBindingViews } from "../../../api/skills";
import ErrorState from "../../../components/common/ErrorState";

function fmtTs(ts?: number | null): string {
  const n = Number(ts ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString("zh-CN", { hour12: false });
}

export default function SkillBindingsPage(): React.ReactElement {
  const [search] = useSearchParams();
  const skillId = search.get("skill_id") ?? "";
  const [views, setViews] = React.useState<SkillBindingViews>({
    items_effective: [],
    items_history: [],
    overrides: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    void listSkillBindingsViews({ skill_id: skillId || undefined, limit: 100 }).then((res) => {
      if (!mounted) return;
      setViews(res);
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

  const renderRows = React.useCallback((items: SkillBindingViewItem[]) => (
    <div className="list modernList">
      {items.map((item, idx) => (
        <div key={`${item.fact_id ?? "fact"}-${idx}`} className="infoCard">
          <div className="jobTitleRow">
            <div>
              <div className="title">{item.skill_id || "-"}</div>
              <div className="metaText">fact_id: {item.fact_id || "-"}</div>
            </div>
            <div className={`pill tone-${item.enabled ? "ok" : "warn"}`}>{item.enabled == null ? "-" : (item.enabled ? "ENABLED" : "DISABLED")}</div>
          </div>
          <div className="meta wrapMeta">
            <span>version：{item.version || "-"}</span>
            <span>classification：{item.classification || "-"}</span>
            <span>scope_type：{item.scope_type || "-"}</span>
            <span>bind_target：{item.bind_target || "-"}</span>
            <span>priority：{item.priority ?? "-"}</span>
            <span>config_patch：{item.config_patch == null ? "-" : JSON.stringify(item.config_patch)}</span>
            <span>occurred_at：{fmtTs(typeof item.occurred_at === "number" ? item.occurred_at : Number(item.occurred_at ?? 0))}</span>
            <span>effective：{item.effective == null ? "-" : (item.effective ? "true" : "false")}</span>
            <span>overridden_by：{item.overridden_by || "-"}</span>
          </div>
        </div>
      ))}
    </div>
  ), []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Skill Bindings</div>
          <h2 className="heroTitle">技能绑定视图</h2>
          <p className="heroText">查看技能版本与绑定范围映射（GLOBAL/TENANT/FIELD/DEVICE/PROGRAM），识别默认策略和优先级冲突。</p>
        </div>
      </section>

      {error ? <ErrorState title="技能绑定读取失败" message={error} onRetry={() => window.location.reload()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">绑定三视图 {skillId ? `· ${skillId}` : ""}</div>
            <div className="sectionDesc">只读展示当前生效列表、历史列表、override 覆盖链，不提供编辑/删除入口。</div>
          </div>
        </div>

        {loading ? <div className="emptyState">加载中...</div> : null}
        {!loading && !views.items_effective.length && !views.items_history.length && !views.overrides.length ? <div className="emptyState">暂无绑定数据。</div> : null}

        <div className="sectionHeader"><div><div className="sectionTitle">1. 当前生效列表（items_effective）</div></div></div>
        {!loading && !views.items_effective.length ? <div className="emptyState">暂无当前生效数据。</div> : renderRows(views.items_effective)}
        <div className="sectionHeader"><div><div className="sectionTitle">2. 历史列表（items_history）</div></div></div>
        {!loading && !views.items_history.length ? <div className="emptyState">暂无历史数据。</div> : renderRows(views.items_history)}
        <div className="sectionHeader"><div><div className="sectionTitle">3. override 列表 / 覆盖链（overrides）</div></div></div>
        {!loading && !views.overrides.length ? <div className="emptyState">暂无 override 数据。</div> : renderRows(views.overrides)}
      </section>
    </div>
  );
}
