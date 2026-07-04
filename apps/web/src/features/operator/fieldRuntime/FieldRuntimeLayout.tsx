// apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx
// Purpose: render the H60-C Field Runtime product shell, boundary banner, tabs, and static tab body.
// Boundary: this layout owns presentation only; concrete tab content migrates in H60-D through H60-K.

import React from "react";
import FieldRuntimeBoundaryBanner from "./FieldRuntimeBoundaryBanner";
import FieldRuntimeTabs from "./FieldRuntimeTabs";
import FieldRuntimeTabStub from "./FieldRuntimeTabStub";
import {
  FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY,
  FIELD_RUNTIME_LEGACY_ROUTE_FAMILY,
} from "./runtimeNonclaims";
import { type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";
import "../../../styles/operatorFieldRuntime.css";

type FieldRuntimeLayoutProps = {
  viewModel: FieldRuntimeViewModel;
};

export default function FieldRuntimeLayout({ viewModel }: FieldRuntimeLayoutProps): React.ReactElement {
  return (
    <main className="operatorFieldRuntime" data-h60c="field-runtime-layout-tabs" data-field-runtime-route={viewModel.routeKey}>
      <header className="operatorFieldRuntime__header" aria-label="Field Runtime header">
        <div>
          <p className="operatorFieldRuntime__eyebrow">H60-C Field Runtime Layout + Tabs</p>
          <h1 className="operatorFieldRuntime__title">Field Runtime</h1>
          <p className="operatorFieldRuntime__subtitle">地块运行视图</p>
        </div>
        <dl className="operatorFieldRuntime__meta" aria-label="Field Runtime route identity">
          <div>
            <dt>Field ID</dt>
            <dd>{viewModel.fieldId}</dd>
          </div>
          <div>
            <dt>Current route</dt>
            <dd>{viewModel.currentRoute}</dd>
          </div>
          <div>
            <dt>Runtime Mode</dt>
            <dd>{viewModel.runtimeMode}</dd>
          </div>
          <div>
            <dt>Read-only boundary</dt>
            <dd>{viewModel.readOnly ? "true" : "false"}</dd>
          </div>
        </dl>
      </header>

      <FieldRuntimeBoundaryBanner />

      <section className="operatorFieldRuntime__routeNotice" aria-label="Field Runtime route ownership">
        <span>{FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY}</span>
        <span>{FIELD_RUNTIME_LEGACY_ROUTE_FAMILY}</span>
      </section>

      <FieldRuntimeTabs viewModel={viewModel} />

      <section className="operatorFieldRuntime__tabPanel" aria-label="Field Runtime tab panel">
        <FieldRuntimeTabStub viewModel={viewModel} />
      </section>
    </main>
  );
}
