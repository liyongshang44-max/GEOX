// apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx
// Purpose: render canonical Field Runtime tabs with status labels and canonical route links.
// Boundary: tabs navigate only within /operator/fields/* and do not hide not_enabled surfaces.

import React from "react";
import { NavLink } from "react-router-dom";
import { buildCanonicalFieldRuntimePath, type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";

type FieldRuntimeTabsProps = {
  viewModel: FieldRuntimeViewModel;
};

export default function FieldRuntimeTabs({ viewModel }: FieldRuntimeTabsProps): React.ReactElement {
  return (
    <nav className="operatorFieldRuntime__tabs" aria-label="Field Runtime tabs">
      {viewModel.tabs.map((tab) => {
        const activeClass = viewModel.activeTab === tab.key ? " operatorFieldRuntime__tab--active" : "";
        return (
          <NavLink
            key={tab.key}
            to={buildCanonicalFieldRuntimePath(viewModel.fieldId, tab)}
            className={() => "operatorFieldRuntime__tab" + activeClass}
            data-field-runtime-tab={tab.key}
            data-field-runtime-tab-status={tab.status}
          >
            <span>{tab.label}</span>
            <small className="operatorFieldRuntime__tabStatus">{tab.status}</small>
          </NavLink>
        );
      })}
    </nav>
  );
}
