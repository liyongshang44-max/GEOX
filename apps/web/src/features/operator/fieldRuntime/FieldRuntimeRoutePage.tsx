// apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx
// Purpose: adapt canonical Field Runtime routes into the shared layout and load read-only workspace/evidence/forecast data when scoped to a field.
// Boundary: this page loads existing read-only Operator Field Twin read models only.

import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { type OperatorTwinRequestScope } from "../../../api/operatorTwin";
import FieldRuntimeLayout from "./FieldRuntimeLayout";
import { buildFieldRuntimeViewModel, type FieldRuntimeRouteKey } from "./fieldRuntimeViewModel";
import { loadFieldRuntimeEvidence, type FieldRuntimeEvidenceLoadState } from "./fieldRuntimeEvidenceAdapter";
import { loadFieldRuntimeForecast, type FieldRuntimeForecastLoadState } from "./fieldRuntimeForecastAdapter";
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

function shouldLoadEvidence(tab: FieldRuntimeRouteKey, fieldId: string): boolean {
  return tab === "evidence" && fieldId !== "not-selected";
}

function shouldLoadForecast(tab: FieldRuntimeRouteKey, fieldId: string): boolean {
  return tab === "forecast" && fieldId !== "not-selected";
}

export default function FieldRuntimeRoutePage({ tab }: FieldRuntimeRoutePageProps): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scopeKey = searchParams.toString();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [scopeKey, searchParams]);
  const fieldId = params.fieldId || "not-selected";
  const viewModel = buildFieldRuntimeViewModel(tab, fieldId);
  const [workspaceLoadState, setWorkspaceLoadState] = React.useState<FieldRuntimeWorkspaceLoadState>({ status: "idle", message: "Workspace read model is not loaded for this route." });
  const [evidenceLoadState, setEvidenceLoadState] = React.useState<FieldRuntimeEvidenceLoadState>({ status: "idle", message: "Evidence read model is not loaded for this route." });
  const [forecastLoadState, setForecastLoadState] = React.useState<FieldRuntimeForecastLoadState>({ status: "idle", message: "Forecast read model is not loaded for this route." });

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

  React.useEffect(() => {
    let alive = true;

    if (!shouldLoadEvidence(tab, fieldId)) {
      setEvidenceLoadState({ status: "idle", message: "Select a field before loading Field Runtime Evidence." });
      return () => { alive = false; };
    }

    setEvidenceLoadState({ status: "loading" });
    void loadFieldRuntimeEvidence(fieldId, scope).then((result) => {
      if (!alive) return;
      setEvidenceLoadState(result);
    });

    return () => { alive = false; };
  }, [fieldId, scope, tab]);

  React.useEffect(() => {
    let alive = true;

    if (!shouldLoadForecast(tab, fieldId)) {
      setForecastLoadState({ status: "idle", message: "Select a field before loading Field Runtime Forecast." });
      return () => { alive = false; };
    }

    setForecastLoadState({ status: "loading" });
    void loadFieldRuntimeForecast(fieldId, scope).then((result) => {
      if (!alive) return;
      setForecastLoadState(result);
    });

    return () => { alive = false; };
  }, [fieldId, scope, tab]);

  return <FieldRuntimeLayout viewModel={viewModel} workspaceLoadState={workspaceLoadState} evidenceLoadState={evidenceLoadState} forecastLoadState={forecastLoadState} />;
}
