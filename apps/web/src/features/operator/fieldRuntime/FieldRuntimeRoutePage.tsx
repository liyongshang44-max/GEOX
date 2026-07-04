// apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx
// Purpose: adapt canonical Field Runtime routes into the shared layout.
// Boundary: existing tabs load read-only models; Audit and Health are local metadata.

import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { type OperatorTwinRequestScope } from "../../../api/operatorTwin";
import FieldRuntimeLayout from "./FieldRuntimeLayout";
import { buildFieldRuntimeAudit } from "./fieldRuntimeAuditAdapter";
import { loadFieldRuntimeCalibration } from "./fieldRuntimeCalibrationAdapter";
import { loadFieldRuntimeEvidence } from "./fieldRuntimeEvidenceAdapter";
import { loadFieldRuntimeForecast } from "./fieldRuntimeForecastAdapter";
import { buildFieldRuntimeHealth } from "./fieldRuntimeHealthAdapter";
import { loadFieldRuntimeResidual } from "./fieldRuntimeResidualAdapter";
import { loadFieldRuntimeScenario } from "./fieldRuntimeScenarioAdapter";
import { loadFieldRuntimeWorkspaceOverview } from "./fieldRuntimeWorkspaceAdapter";
import { buildFieldRuntimeViewModel, type FieldRuntimeRouteKey } from "./fieldRuntimeViewModel";

type FieldRuntimeRoutePageProps = {
  tab: FieldRuntimeRouteKey;
};

type AnyLoadState = {
  status: string;
  message?: string;
  [key: string]: unknown;
};

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function useReadModelLoadState(
  enabled: boolean,
  idleMessage: string,
  loader: () => Promise<AnyLoadState>,
): AnyLoadState {
  const [state, setState] = React.useState<AnyLoadState>({
    status: "idle",
    message: idleMessage,
  });

  React.useEffect(() => {
    let alive = true;

    if (!enabled) {
      setState({
        status: "idle",
        message: idleMessage,
      });

      return () => {
        alive = false;
      };
    }

    setState({ status: "loading" });

    void loader().then((result) => {
      if (alive) {
        setState(result);
      }
    });

    return () => {
      alive = false;
    };
  }, [enabled, idleMessage, loader]);

  return state;
}

export default function FieldRuntimeRoutePage({ tab }: FieldRuntimeRoutePageProps): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scopeKey = searchParams.toString();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [scopeKey, searchParams]);
  const fieldId = params.fieldId || "not-selected";
  const scoped = fieldId !== "not-selected";
  const viewModel = buildFieldRuntimeViewModel(tab, fieldId);
  const decisionCycleId = searchParams.get("decision_cycle_id") || "";

  const auditLoadState = React.useMemo(
    () => buildFieldRuntimeAudit(fieldId, decisionCycleId),
    [fieldId, decisionCycleId],
  );

  const healthLoadState = React.useMemo(
    () => buildFieldRuntimeHealth(fieldId),
    [fieldId],
  );

  const workspaceLoader = React.useCallback(
    () => loadFieldRuntimeWorkspaceOverview(fieldId, scope) as Promise<AnyLoadState>,
    [fieldId, scope],
  );

  const evidenceLoader = React.useCallback(
    () => loadFieldRuntimeEvidence(fieldId, scope) as Promise<AnyLoadState>,
    [fieldId, scope],
  );

  const forecastLoader = React.useCallback(
    () => loadFieldRuntimeForecast(fieldId, scope) as Promise<AnyLoadState>,
    [fieldId, scope],
  );

  const scenarioLoader = React.useCallback(
    () => loadFieldRuntimeScenario(fieldId, scope) as Promise<AnyLoadState>,
    [fieldId, scope],
  );

  const residualLoader = React.useCallback(
    () => loadFieldRuntimeResidual(fieldId, scope) as Promise<AnyLoadState>,
    [fieldId, scope],
  );

  const calibrationLoader = React.useCallback(
    () => loadFieldRuntimeCalibration(fieldId, scope) as Promise<AnyLoadState>,
    [fieldId, scope],
  );

  return (
    <FieldRuntimeLayout
      viewModel={viewModel}
      workspaceLoadState={useReadModelLoadState(
        (tab === "overview" || tab === "state") && scoped,
        "Workspace read model is not loaded for this route.",
        workspaceLoader,
      ) as never}
      evidenceLoadState={useReadModelLoadState(
        tab === "evidence" && scoped,
        "Evidence read model is not loaded for this route.",
        evidenceLoader,
      ) as never}
      forecastLoadState={useReadModelLoadState(
        tab === "forecast" && scoped,
        "Forecast read model is not loaded for this route.",
        forecastLoader,
      ) as never}
      scenarioLoadState={useReadModelLoadState(
        tab === "scenario" && scoped,
        "Scenario read model is not loaded for this route.",
        scenarioLoader,
      ) as never}
      residualLoadState={useReadModelLoadState(
        tab === "residual" && scoped,
        "Residual read model is not loaded for this route.",
        residualLoader,
      ) as never}
      calibrationLoadState={useReadModelLoadState(
        tab === "calibration" && scoped,
        "Calibration read model is not loaded for this route.",
        calibrationLoader,
      ) as never}
      auditLoadState={auditLoadState}
      healthLoadState={healthLoadState}
    />
  );
}
