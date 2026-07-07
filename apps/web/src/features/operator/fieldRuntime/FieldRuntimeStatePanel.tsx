// apps/web/src/features/operator/fieldRuntime/FieldRuntimeStatePanel.tsx
// Purpose: render bilingual State Summary and state vector details from the existing read-only workspace.
// Boundary: this panel does not compute new state estimates or convert confidence into recommendations.

import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { OPERATOR_COMMON_COPY, OPERATOR_SOURCE_COPY, operatorSafeDisplay } from "../../../lib/productCopy/operatorLocale";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeStatePanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
  mode: "summary" | "full";
};

const COPY = {
  title: { zh: "当前状态", en: "Current State" },
  waiting: { zh: "状态正在等待地块上下文。", en: "State is waiting for a field context." },
  loading: { zh: "正在加载工作区派生状态。", en: "Loading workspace-derived state." },
  failed: { zh: "状态加载失败", en: "State load failed" },
  source: { zh: "来源", en: "Source" },
  lead: { zh: "状态向量读取自工作区派生状态元数据，并非新计算的状态估计。", en: "The state vector is read from workspace-derived metadata and is not a newly computed state estimate." },
  evidenceRefs: { zh: "条证据引用", en: "evidence refs" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeStatePanel({ loadState, mode }: FieldRuntimeStatePanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  const stateLabel = localizedText(OPERATOR_SOURCE_COPY.state.label, locale);

  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2><p>{loadState?.message || t(COPY.waiting)}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2><p>{t(COPY.loading)}</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2><p>{t(COPY.failed)}: {operatorSafeDisplay(loadState.message, locale, OPERATOR_COMMON_COPY.safeUnavailable)}</p></article>;
  }

  const state = loadState.state;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="state" data-state-panel-mode={mode}>
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">{stateLabel}</p>
          <h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{t(COPY.source)}: {state.source}</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">{t(COPY.lead)}</p>
      <div className="operatorFieldRuntime__stateVector">
        {state.stateVectorItems.map((item) => (
          <section className="operatorFieldRuntime__metricCard" key={item.label}>
            <p className="operatorFieldRuntime__panelMeta">{operatorSafeDisplay(item.label, locale, OPERATOR_SOURCE_COPY.state.label)}</p>
            <strong>{item.value}</strong>
            {item.confidenceLabel ? <span>{operatorSafeDisplay(item.confidenceLabel, locale, OPERATOR_COMMON_COPY.unavailable)}</span> : null}
            {typeof item.evidenceRefCount === "number" ? <span>{item.evidenceRefCount} {t(COPY.evidenceRefs)}</span> : null}
          </section>
        ))}
      </div>
      {mode === "full" ? (
        <ul className="operatorFieldRuntime__boundaryList">
          {state.boundaryCopy.map((line) => <li key={line}>{operatorSafeDisplay(line, locale, OPERATOR_COMMON_COPY.readOnly)}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
