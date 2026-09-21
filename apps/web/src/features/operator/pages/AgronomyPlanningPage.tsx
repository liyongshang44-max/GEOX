import React from "react";
import { Link } from "react-router-dom";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import "../../../styles/fouiFieldOperations.css";

const COPY = {
  eyebrow: { zh: "农艺 / 规划", en: "Agronomy / Planning" },
  title: { zh: "把田间状态转成可审查的农艺计划。", en: "Turn field state into reviewable agronomic plans." },
  lead: {
    zh: "规划与农艺建议是独立工作域。现有规划能力继续可用；ADR-backed Product Projection 尚未施工的部分保持明确未开放。",
    en: "Planning and agronomic guidance are a separate work area. Existing planning capabilities remain available; ADR-backed Product Projection capabilities that are not built remain explicitly unavailable.",
  },
} as const satisfies Record<string, LocalizedCopy>;

export default function AgronomyPlanningPage(): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);

  return (
    <div className="fouiPage fouiAgronomy" data-foui-surface="agronomy">
      <section className="fouiHero">
        <div><span className="fouiEyebrow">{t(COPY.eyebrow)}</span><h2>{t(COPY.title)}</h2><p>{t(COPY.lead)}</p></div>
        <span className="fouiStatePill">{locale === "zh-CN" ? "只读 · 能力边界明确" : "Read-only · capability boundary"}</span>
      </section>

      <section className="fouiAgronomyGrid">
        <article className="fouiPanel fouiFeaturePanel">
          <span className="fouiStatePill">{locale === "zh-CN" ? "现有能力" : "Existing surface"}</span>
          <h3>{locale === "zh-CN" ? "季节与种植规划" : "Season & crop planning"}</h3>
          <p>{locale === "zh-CN" ? "继续使用现有经营方案与计划能力。这里不会把现有计划对象重新声明为 ADR authority。" : "Continue using existing program and planning capabilities. This surface does not relabel existing plan objects as ADR authority."}</p>
          <Link className="fouiPrimaryLink" to="/programs">{locale === "zh-CN" ? "打开现有规划" : "Open existing planning"}</Link>
        </article>

        <article className="fouiPanel fouiFeaturePanel">
          <span className="fouiStatePill">{locale === "zh-CN" ? "现有能力" : "Existing surface"}</span>
          <h3>{locale === "zh-CN" ? "建议审查" : "Recommendation review"}</h3>
          <p>{locale === "zh-CN" ? "现有建议页面继续保留，用于审查建议与证据引用；推荐不等于批准，也不等于执行。" : "The existing recommendation surface remains available for reviewing recommendations and evidence refs. Recommendation is not approval and not execution."}</p>
          <Link className="fouiPrimaryLink" to="/agronomy/recommendations">{locale === "zh-CN" ? "查看现有建议" : "Review existing recommendations"}</Link>
        </article>

        <article className="fouiPanel fouiFeaturePanel fouiFeaturePanel--muted">
          <span className="fouiStatePill fouiStatePill--limited">{locale === "zh-CN" ? "暂未开放" : "Not yet available"}</span>
          <h3>{locale === "zh-CN" ? "ADR 决策产品投影" : "ADR decision product projection"}</h3>
          <p>{locale === "zh-CN" ? "正式 ADR DecisionResult、适用性、运行绑定与 decision-time basis 需要 GovernedActionCaseProjection runtime。当前 UI 不从 forecast、scenario 或 recommendation 推断它们。" : "Formal ADR DecisionResult, applicability, runtime binding, and decision-time basis require the GovernedActionCaseProjection runtime. The UI does not infer them from forecast, scenario, or recommendation."}</p>
        </article>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader"><div><span className="fouiEyebrow">BOUNDARY</span><h3>{locale === "zh-CN" ? "农艺判断与运营授权永久分离" : "Agronomic judgment stays separate from operating authority"}</h3></div></header>
        <div className="fouiBoundaryFlow">
          <div><span>01</span><strong>Field State</strong><small>MCFT</small></div>
          <i>→</i>
          <div><span>02</span><strong>Agronomic Judgment</strong><small>ADR when authoritative</small></div>
          <i>→</i>
          <div><span>03</span><strong>Human Approval</strong><small>B-Line</small></div>
          <i>→</i>
          <div><span>04</span><strong>Execution</strong><small>B-Line</small></div>
        </div>
      </section>
    </div>
  );
}
