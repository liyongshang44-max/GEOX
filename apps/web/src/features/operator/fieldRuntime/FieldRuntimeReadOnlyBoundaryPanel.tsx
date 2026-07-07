// apps/web/src/features/operator/fieldRuntime/FieldRuntimeReadOnlyBoundaryPanel.tsx
// Purpose: render the bilingual no-write boundary for canonical Field Runtime Overview and State.
// Boundary: this panel is only boundary copy and performs no action.

import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { operatorSafeDisplay } from "../../../lib/productCopy/operatorLocale";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeReadOnlyBoundaryPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

const COPY = {
  eyebrow: { zh: "边界", en: "Boundary" },
  title: { zh: "只读边界", en: "Read-only Boundary" },
  meta: { zh: "无写入产品边界", en: "No-write Product Boundary" },
  facts: { zh: "不写入事实", en: "No Facts Write" },
  recommendation: { zh: "不创建建议", en: "No Recommendation Creation" },
  authorization: { zh: "不修改授权状态", en: "No Authorization-state Change" },
  dispatch: { zh: "不派发", en: "No Dispatch" },
  workOrder: { zh: "不创建工单", en: "No Work Order Creation" },
  roi: { zh: "不写入 ROI", en: "No ROI Write" },
  fieldMemory: { zh: "不写入 Field Memory", en: "No Field Memory Write" },
  workspaceRules: { zh: "工作区边界规则", en: "Workspace Boundary Rules" },
  workspaceRule: { zh: "只读工作区边界规则", en: "Read-only Workspace Boundary Rule" },
} as const satisfies Record<string, LocalizedCopy>;

const STATIC_RULE_KEYS = ["facts", "recommendation", "authorization", "dispatch", "workOrder", "roi", "fieldMemory"] as const;

export default function FieldRuntimeReadOnlyBoundaryPanel({ loadState }: FieldRuntimeReadOnlyBoundaryPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  const workspaceRules = loadState?.status === "ready" ? loadState.overview.boundaryRules : [];

  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__boundaryPanel" data-h60d-panel="read-only-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">{t(COPY.eyebrow)}</p>
          <h2 className="operatorFieldRuntime__panelTitle">{t(COPY.title)}</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{t(COPY.meta)}</span>
      </div>
      <ul className="operatorFieldRuntime__boundaryList">
        {STATIC_RULE_KEYS.map((key) => <li key={key}>{t(COPY[key])}</li>)}
      </ul>
      {workspaceRules.length > 0 ? (
        <div>
          <p className="operatorFieldRuntime__panelMeta">{t(COPY.workspaceRules)}</p>
          <ul className="operatorFieldRuntime__boundaryList">
            {workspaceRules.map((rule, index) => <li key={`${index}:${rule}`}>{operatorSafeDisplay(rule, locale, COPY.workspaceRule)}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
