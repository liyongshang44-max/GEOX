// apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx
// Purpose: render canonical Field Runtime tabs with status labels and canonical route links.
// Boundary: list routes do not produce field-scoped links until a field context exists.

import React from "react";
import { NavLink } from "react-router-dom";
import { buildCanonicalFieldRuntimePath, type FieldRuntimeTabKey, type FieldRuntimeTabStatus, type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";
import { localizedText, useLocale, type LocaleCode } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";

type FieldRuntimeTabsProps = {
  viewModel: FieldRuntimeViewModel;
};

const fieldCopy = OPERATOR_FORMAL_SURFACE_COPY.fieldRuntime;

function tabLabel(key: FieldRuntimeTabKey, locale: LocaleCode): string {
  return localizedText(fieldCopy.tabs[key], locale);
}

function statusLabel(status: FieldRuntimeTabStatus, locale: LocaleCode): string {
  return localizedText(fieldCopy.status[status], locale);
}

export default function FieldRuntimeTabs({ viewModel }: FieldRuntimeTabsProps): React.ReactElement {
  const { locale } = useLocale();
  const isListRoute = viewModel.routeKey === "fields";

  return (
    <nav className="operatorFieldRuntime__tabs" aria-label={locale === "en-US" ? "Field Runtime tabs" : "地块运行标签"}>
      {viewModel.tabs.map((tab) => {
        const activeClass = viewModel.activeTab === tab.key ? " operatorFieldRuntime__tab--active" : "";
        const label = tabLabel(tab.key, locale);
        if (isListRoute) {
          return (
            <span
              key={tab.key}
              className="operatorFieldRuntime__tab operatorFieldRuntime__tab--disabled"
              aria-disabled="true"
              title={localizedText(fieldCopy.status.selectFieldFirst, locale)}
              data-field-runtime-tab={tab.key}
              data-field-runtime-tab-status={tab.status}
              data-field-runtime-tab-disabled="select-field-first"
            >
              <span>{label}</span>
              <small className="operatorFieldRuntime__tabStatus">{localizedText(fieldCopy.status.selectFieldFirst, locale)}</small>
            </span>
          );
        }

        return (
          <NavLink
            key={tab.key}
            to={buildCanonicalFieldRuntimePath(viewModel.fieldId, tab)}
            className={() => "operatorFieldRuntime__tab" + activeClass}
            data-field-runtime-tab={tab.key}
            data-field-runtime-tab-status={tab.status}
          >
            <span>{label}</span>
            <small className="operatorFieldRuntime__tabStatus">{statusLabel(tab.status, locale)}</small>
          </NavLink>
        );
      })}
    </nav>
  );
}
