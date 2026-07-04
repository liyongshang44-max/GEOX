// apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx
// Purpose: adapt canonical Field Runtime routes into the shared H60-C layout.
// Boundary: this page constructs a static ViewModel and does not load API data.

import React from "react";
import { useParams } from "react-router-dom";
import FieldRuntimeLayout from "./FieldRuntimeLayout";
import { buildFieldRuntimeViewModel, type FieldRuntimeRouteKey } from "./fieldRuntimeViewModel";

type FieldRuntimeRoutePageProps = {
  tab: FieldRuntimeRouteKey;
};

export default function FieldRuntimeRoutePage({ tab }: FieldRuntimeRoutePageProps): React.ReactElement {
  const params = useParams();
  const viewModel = buildFieldRuntimeViewModel(tab, params.fieldId || "not-selected");

  return <FieldRuntimeLayout viewModel={viewModel} />;
}
