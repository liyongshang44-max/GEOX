import React from "react";
import { useSearchParams } from "react-router-dom";
import { listSkillBindingsViews, overrideSkillBinding, type SkillBindingViewItem, type SkillBindingViews } from "../../../api/skills";
import { ApiError } from "../../../api/client";
import ErrorState from "../../../components/common/ErrorState";

function fmtTs(ts?: number | null): string {
  const n = Number(ts ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString("zh-CN", { hour12: false });
}

type OverrideFormState = {
  scope_type: string;
  bind_target: string;
  skill_id: string;
  version: string;
  enabled: boolean;
  priority: number;
  config_patch: string;
};

const INITIAL_FORM_STATE: OverrideFormState = {
  scope_type: "TENANT",
  bind_target: "",
  skill_id: "",
  version: "",
  enabled: true,
  priority: 100,
  config_patch: "{}",
};

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
  const [formState, setFormState] = React.useState<OverrideFormState>({
    ...INITIAL_FORM_STATE,
    skill_id: skillId,
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      skill_id: skillId || prev.skill_id,
    }));
  }, [skillId]);

  const loadViews = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSkillBindingsViews({ skill_id: skillId || undefined, limit: 100 });
      setViews(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "读取失败");
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  React.useEffect(() => {
    void loadViews();
  }, [loadViews]);

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

  const onSubmitOverride = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    let parsedConfigPatch: Record<string, unknown>;
    try {
      const parsed = JSON.parse(formState.config_patch || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setSubmitError("config_patch 必须是 JSON 对象。");
        return;
      }
      parsedConfigPatch = parsed as Record<string, unknown>;
    } catch {
      setSubmitError("config_patch JSON 解析失败，请检查格式。");
      return;
    }

    setSubmitting(true);
    try {
      await overrideSkillBinding({
        skill_id: formState.skill_id.trim(),
        version: formState.version.trim(),
        category: "unknown",
        scope_type: formState.scope_type.trim(),
        bind_target: formState.bind_target.trim(),
        enabled: formState.enabled,
        priority: Number(formState.priority),
        config_patch: parsedConfigPatch,
      });
      await loadViews();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 400) {
        setSubmitError(`提交失败（400）：${e.bodyText || "请求参数有误"}`);
      } else {
        setSubmitError(e?.message ?? "提交失败，请稍后重试。");
      }
    } finally {
      setSubmitting(false);
    }
  }, [formState, loadViews]);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Skill Bindings</div>
          <h2 className="heroTitle">技能绑定视图</h2>
          <p className="heroText">查看技能版本与绑定范围映射（GLOBAL/TENANT/FIELD/DEVICE/PROGRAM），识别默认策略和优先级冲突。</p>
        </div>
      </section>

      {error ? <ErrorState title="技能绑定读取失败" message={error} onRetry={() => void loadViews()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">绑定三视图 {skillId ? `· ${skillId}` : ""}</div>
            <div className="sectionDesc">页面包含四个分区：effective / history / overrides / override form。</div>
          </div>
        </div>

        {loading ? <div className="emptyState">加载中...</div> : null}
        {!loading && !views.items_effective.length && !views.items_history.length && !views.overrides.length ? <div className="emptyState">暂无绑定数据。</div> : null}

        <div className="sectionHeader"><div><div className="sectionTitle">1. effective（items_effective）</div></div></div>
        {!loading && !views.items_effective.length ? <div className="emptyState">暂无当前生效数据。</div> : renderRows(views.items_effective)}

        <div className="sectionHeader"><div><div className="sectionTitle">2. history（items_history）</div></div></div>
        {!loading && !views.items_history.length ? <div className="emptyState">暂无历史数据。</div> : renderRows(views.items_history)}

        <div className="sectionHeader"><div><div className="sectionTitle">3. overrides（overrides）</div></div></div>
        {!loading && !views.overrides.length ? <div className="emptyState">暂无 override 数据。</div> : renderRows(views.overrides)}

        <div className="sectionHeader"><div><div className="sectionTitle">4. override form</div></div></div>
        <form className="infoCard" onSubmit={onSubmitOverride}>
          <div className="meta wrapMeta" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(200px, 1fr))", gap: 12 }}>
            <label>
              scope_type
              <input
                value={formState.scope_type}
                onChange={(e) => setFormState((prev) => ({ ...prev, scope_type: e.target.value }))}
              />
            </label>
            <label>
              bind_target
              <input
                value={formState.bind_target}
                onChange={(e) => setFormState((prev) => ({ ...prev, bind_target: e.target.value }))}
              />
            </label>
            <label>
              skill_id
              <input
                value={formState.skill_id}
                onChange={(e) => setFormState((prev) => ({ ...prev, skill_id: e.target.value }))}
              />
            </label>
            <label>
              version
              <input
                value={formState.version}
                onChange={(e) => setFormState((prev) => ({ ...prev, version: e.target.value }))}
              />
            </label>
            <label>
              enabled
              <select
                value={String(formState.enabled)}
                onChange={(e) => setFormState((prev) => ({ ...prev, enabled: e.target.value === "true" }))}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>
              priority
              <input
                type="number"
                value={formState.priority}
                onChange={(e) => setFormState((prev) => ({ ...prev, priority: Number(e.target.value || 0) }))}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              config_patch (JSON)
              <textarea
                rows={6}
                value={formState.config_patch}
                onChange={(e) => setFormState((prev) => ({ ...prev, config_patch: e.target.value }))}
              />
            </label>
          </div>

          {submitError ? <div className="emptyState" style={{ color: "#b42318" }}>{submitError}</div> : null}

          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={submitting}>{submitting ? "提交中..." : "提交 override"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
