// apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx
// Purpose: adapt canonical Field Runtime routes into the shared bilingual layout.
// Boundary: existing tabs load read-only models; Audit and Health are local metadata.

import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { type OperatorTwinRequestScope } from "../../../api/operatorTwin";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
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

type FieldRuntimeRoutePageProps = { tab: FieldRuntimeRouteKey };
type AnyLoadState = { status: string; message?: string; [key: string]: unknown };

const IDLE_COPY = {
  workspace: { zh: "当前路由未加载运行工作区读模型。", en: "The runtime workspace read model is not loaded for this route." },
  evidence: { zh: "当前路由未加载证据读模型。", en: "The evidence read model is not loaded for this route." },
  forecast: { zh: "当前路由未加载预测读模型。", en: "The forecast read model is not loaded for this route." },
  scenario: { zh: "当前路由未加载情景读模型。", en: "The scenario read model is not loaded for this route." },
  residual: { zh: "当前路由未加载残差读模型。", en: "The residual read model is not loaded for this route." },
  calibration: { zh: "当前路由未加载校准读模型。", en: "The calibration read model is not loaded for this route." },
} as const satisfies Record<string, LocalizedCopy>;

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return { tenant_id: searchParams.get("tenant_id"), project_id: searchParams.get("project_id"), group_id: searchParams.get("group_id") };
}

function useReadModelLoadState(enabled: boolean, idleMessage: string, loader: () => Promise<AnyLoadState>): AnyLoadState {
  const [state, setState] = React.useState<AnyLoadState>({ status: "idle", message: idleMessage });
  React.useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ status: "idle", message: idleMessage });
      return () => { active = false; };
    }
    setState({ status: "loading" });
    void loader().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [enabled, idleMessage, loader]);
  return state;
}

export default function FieldRuntimeRoutePage({ tab }: FieldRuntimeRoutePageProps): React.ReactElement {
  const { locale } = useLocale();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scopeKey = searchParams.toString();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [scopeKey, searchParams]);
  const fieldId = params.fieldId || "not-selected";
  const scoped = fieldId !== "not-selected";
  const viewModel = buildFieldRuntimeViewModel(tab, fieldId);
  const decisionCycleId = searchParams.get("decision_cycle_id") || "";
  const auditLoadState = React.useMemo(() => buildFieldRuntimeAudit(fieldId, decisionCycleId), [fieldId, decisionCycleId]);
  const healthLoadState = React.useMemo(() => buildFieldRuntimeHealth(fieldId), [fieldId]);
  const workspaceLoader = React.useCallback(() => loadFieldRuntimeWorkspaceOverview(fieldId, scope) as Promise<AnyLoadState>, [fieldId, scope]);
  const evidenceLoader = React.useCallback(() => loadFieldRuntimeEvidence(fieldId, scope) as Promise<AnyLoadState>, [fieldId, scope]);
  const forecastLoader = React.useCallback(() => loadFieldRuntimeForecast(fieldId, scope) as Promise<AnyLoadState>, [fieldId, scope]);
  const scenarioLoader = React.useCallback(() => loadFieldRuntimeScenario(fieldId, scope) as Promise<AnyLoadState>, [fieldId, scope]);
  const residualLoader = React.useCallback(() => loadFieldRuntimeResidual(fieldId, scope) as Promise<AnyLoadState>, [fieldId, scope]);
  const calibrationLoader = React.useCallback(() => loadFieldRuntimeCalibration(fieldId, scope) as Promise<AnyLoadState>, [fieldId, scope]);
  const text = (copy: LocalizedCopy) => localizedText(copy, locale);

  return <FieldRuntimeLayout
    viewModel={viewModel}
    workspaceLoadState={useReadModelLoadState((tab === "overview" || tab === "state") && scoped, text(IDLE_COPY.workspace), workspaceLoader) as never}
    evidenceLoadState={useReadModelLoadState(tab === "evidence" && scoped, text(IDLE_COPY.evidence), evidenceLoader) as never}
    forecastLoadState={useReadModelLoadState(tab === "forecast" && scoped, text(IDLE_COPY.forecast), forecastLoader) as never}
    scenarioLoadState={useReadModelLoadState(tab === "scenario" && scoped, text(IDLE_COPY.scenario), scenarioLoader) as never}
    residualLoadState={useReadModelLoadState(tab === "residual" && scoped, text(IDLE_COPY.residual), residualLoader) as never}
    calibrationLoadState={useReadModelLoadState(tab === "calibration" && scoped, text(IDLE_COPY.calibration), calibrationLoader) as never}
    auditLoadState={auditLoadState}
    healthLoadState={healthLoadState}
  />;
}
