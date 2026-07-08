// apps/web/src/features/operator/fieldRuntime/FieldRuntimeOverviewPanel.tsx
// Purpose: render bilingual Field Runtime Overview content from the existing read-only workspace.
// Boundary: this panel displays mapped read-model fields only and creates no recommendations or actions.

import React from "react";
import { ProductErrorState, ProductLoadingState, ProductStateBlock } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { OPERATOR_COMMON_COPY, operatorSafeDisplay } from "../../../lib/productCopy/operatorLocale";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeOverviewPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

const COPY = {
  title: { zh: "地块运行总览", en: "Field Runtime Overview" },
  eyebrow: { zh: "总览", en: "Overview" },
  idleTitle: { zh: "需要地块上下文", en: "Field Context Required" },
  idleDescription: { zh: "请先选择地块，再加载只读地块运行总览。", en: "Select a field before loading the read-only Field Runtime overview." },
  idleAria: { zh: "地块运行总览等待地块上下文", en: "Field Runtime overview idle state" },
  loading: { zh: "正在加载地块运行总览", en: "Loading Field Runtime Overview" },
  loadingDescription: { zh: "正在读取工作区派生的操作员地块孪生总览内容。", en: "Reading workspace-derived Operator Field Twin overview content." },
  loadingAria: { zh: "地块运行总览加载状态", en: "Field Runtime overview loading state" },
  errorTitle: { zh: "总览回查暂不可用", en: "Overview Readback Unavailable" },
  errorMessage: { zh: "当前无法安全展示工作区派生总览，请稍后重新打开地块运行页面。", en: "The workspace-derived overview cannot be displayed safely right now. Try reading the field runtime page again." },
  errorAria: { zh: "地块运行总览安全错误状态", en: "Field Runtime overview safe error state" },
  source: { zh: "来源", en: "Source" },
  lead: { zh: "总览内容来自现有只读操作员地块孪生工作区。", en: "Overview content is derived from the existing read-only Operator Field Twin workspace." },
  nonclaim: { zh: "不写入事实，不创建建议，不派发，也不创建 AO-ACT 任务。", en: "No facts are written. No recommendation is created. No dispatch or AO-ACT task is created." },
  metric: { zh: "总览指标", en: "Overview Metric" },
  detail: { zh: "总览详情暂不可用", en: "Overview detail unavailable" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeOverviewPanel({ loadState }: FieldRuntimeOverviewPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);

  if (!loadState || loadState.status === "idle") {
    return (
      <article className="operatorFieldRuntime__panel">
        <h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2>
        <ProductStateBlock
          kind="permissionLimited"
          surface="operator"
          title={t(COPY.idleTitle)}
          description={t(COPY.idleDescription)}
          ariaLabel={t(COPY.idleAria)}
        />
      </article>
    );
  }

  if (loadState.status === "loading") {
    return (
      <article className="operatorFieldRuntime__panel">
        <h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2>
        <ProductLoadingState
          surface="operator"
          label={t(COPY.loading)}
          description={t(COPY.loadingDescription)}
          ariaLabel={t(COPY.loadingAria)}
        />
      </article>
    );
  }

  if (loadState.status === "error") {
    return (
      <article className="operatorFieldRuntime__panel">
        <h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2>
        <ProductErrorState
          surface="operator"
          title={t(COPY.errorTitle)}
          message={t(COPY.errorMessage)}
          ariaLabel={t(COPY.errorAria)}
        />
      </article>
    );
  }

  const overview = loadState.overview;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="overview">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">{t(COPY.eyebrow)}</p>
          <h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{t(COPY.source)}: {overview.source}</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">{t(COPY.lead)}</p>
      <p className="operatorFieldRuntime__stubLead">{t(COPY.nonclaim)}</p>
      <div className="operatorFieldRuntime__summaryGrid">
        {overview.summaryCards.map((card) => (
          <section className="operatorFieldRuntime__metricCard" key={card.label}>
            <p className="operatorFieldRuntime__panelMeta">{operatorSafeDisplay(card.label, locale, COPY.metric)}</p>
            <strong>{card.value}</strong>
            {card.detail ? <span>{operatorSafeDisplay(card.detail, locale, COPY.detail)}</span> : null}
          </section>
        ))}
      </div>
    </article>
  );
}
