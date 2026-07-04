// apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabStub.tsx
// Purpose: render static Field Runtime tab stub content and boundary copy before concrete tab migrations.
// Boundary: this component describes planned review surfaces only.

import React from "react";
import { type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";

type FieldRuntimeTabStubProps = {
  viewModel: FieldRuntimeViewModel;
};

export default function FieldRuntimeTabStub({ viewModel }: FieldRuntimeTabStubProps): React.ReactElement {
  const activeTab = viewModel.tabs.find((tab) => tab.key === viewModel.activeTab);
  const status = activeTab?.status || "limited";
  const title = activeTab ? activeTab.label : viewModel.routeCopy.title;
  const phase = activeTab?.phase || viewModel.routeCopy.phase;
  const lines = activeTab?.boundaryCopy || viewModel.routeCopy.lines;

  return (
    <article className="operatorFieldRuntime__stub" aria-label="Field Runtime tab stub">
      <div className="operatorFieldRuntime__stubHeader">
        <p className="operatorFieldRuntime__eyebrow">{phase}</p>
        <h2>{title}</h2>
        <span className="operatorFieldRuntime__tabStatus">{status}</span>
      </div>

      <p className="operatorFieldRuntime__stubLead">
        This Field Runtime shell provides layout, tabs, boundary copy, and static routing. Concrete tab content remains route-scoped and read-only.
      </p>

      <ul className="operatorFieldRuntime__boundaryList">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}
