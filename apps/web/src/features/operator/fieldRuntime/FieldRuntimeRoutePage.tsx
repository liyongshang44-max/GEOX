// apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx
// Purpose: adapt canonical Field Runtime routes into the shared layout and load H60-D overview/state read-only workspace data when scoped to a field.
// Boundary: this page loads only the existing read-only Operator Field Twin workspace read model.

import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { type OperatorTwinRequestScope } from "../../../api/operatorTwin";
import FieldRuntimeLayout from "./FieldRuntimeLayout";
import { buildFieldRuntimeViewModel, type FieldRuntimeRouteKey } from "./fieldRuntimeViewModel";
import { loadFieldRuntimeWorkspaceOverview, type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeRoutePageProps = {
  tab: FieldRuntimeRouteKey;
};

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function shouldLoadWorkspace(tab: FieldRuntimeRouteKey, fieldId: string): boolean {
  return (tab === "overview" || tab === "state") && fieldId !== "not-selected";
}

export default function FieldRuntimeRoutePage({ tab }: FieldRuntimeRoutePageProps): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scopeKey = searchParams.toString();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [scopeKey, searchParams]);
  const fieldId = params.fieldId || "not-selected";
  const viewModel = buildFieldRuntimeViewModel(tab, fieldId);
  const [workspaceLoadState, setWorkspaceLoadState] = React.useState<FieldRuntimeWorkspaceLoadState>({ status: "idle", message: "Workspace read model is not loaded for this route." });

  React.useEffect(() => {
    let alive = true;

    if (!shouldLoadWorkspace(tab, fieldId)) {
      setWorkspaceLoadState({ status: "idle", message: "Select a field before loading Field Runtime Overview or State." });
      return () => { alive = false; };
    }

    setWorkspaceLoadState({ status: "loading" });
    void loadFieldRuntimeWorkspaceOverview(fieldId, scope).then((result) => {
      if (!alive) return;
      setWorkspaceLoadState(result);
    });

    return () => { alive = false; };
  }, [fieldId, scope, tab]);

  return <FieldRuntimeLayout viewModel={viewModel} workspaceLoadState={workspaceLoadState} />;
}
