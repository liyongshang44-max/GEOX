import React from "react";
import {
  cleanFlightTableRun,
  createFlightTableField,
  createFlightTableGeometry,
  createFlightTableRun,
  fetchFlightTableApiSnapshots,
  fetchFlightTableRuns,
  retryFlightTableStep,
  verifyFlightTableRun,
  type CreateFlightTableGeometryResponseV1,
  type FlightTableApiSnapshotV1,
  type FlightTableLaneV1,
  type FlightTableRunV1,
} from "../../api/flightTable";
import { ApiError } from "../../api/client";
import { readTenantContext } from "../../auth/authStorage";
import FlightTableShell from "../../components/dev/flight-table/FlightTableShell";
import type { FieldAssemblyDraftV1 } from "../../components/dev/flight-table/FieldAssemblyCard";
import type { FieldSpatialDraftV1 } from "../../components/dev/flight-table/FieldSpatialCard";
import { defaultFlightTableRunId, flightTablePermissionLabel } from "../../viewmodels/flightTableVm";
import "../../styles/flightTable.css";

function errorToText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.bodyText.includes("FLIGHT_TABLE_DISABLED")) return "飞行台 API 未启用";
    return flightTablePermissionLabel(error.bodyText);
  }
  return String((error as any)?.message ?? error ?? "飞行台请求失败");
}

function defaultScope(): { tenant_id: string; project_id: string; group_id: string } {
  return readTenantContext() ?? { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };
}

function stampNow(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function defaultFieldDraft(): FieldAssemblyDraftV1 {
  const scope = defaultScope();
  const stamp = stampNow();
  return {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: `ft_field_${stamp}`,
    field_name: `飞行台试验田 ${stamp.slice(-6)}`,
    crop: "corn",
    season_id: `ft_season_${stamp}`,
    crop_stage: "vegetative",
  };
}

function defaultSpatialDraft(fieldId?: string | null): FieldSpatialDraftV1 {
  return {
    field_id: fieldId ?? "",
    geometryText: "",
    weatherLat: "31.234567",
    weatherLng: "121.567890",
  };
}

export default function FlightTablePage(): React.ReactElement {
  const [run, setRun] = React.useState<FlightTableRunV1 | null>(null);
  const [snapshots, setSnapshots] = React.useState<FlightTableApiSnapshotV1[]>([]);
  const [runIdDraft, setRunIdDraft] = React.useState(defaultFlightTableRunId);
  const [laneDraft, setLaneDraft] = React.useState<FlightTableLaneV1>("success");
  const [fieldDraft, setFieldDraft] = React.useState<FieldAssemblyDraftV1>(defaultFieldDraft);
  const [spatialDraft, setSpatialDraft] = React.useState<FieldSpatialDraftV1>(() => defaultSpatialDraft());
  const [fieldLoading, setFieldLoading] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [spatialLoading, setSpatialLoading] = React.useState(false);
  const [spatialError, setSpatialError] = React.useState<string | null>(null);
  const [geometryResult, setGeometryResult] = React.useState<CreateFlightTableGeometryResponseV1 | null>(null);
  const [customerVisible, setCustomerVisible] = React.useState(false);
  const [reportVisible, setReportVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshSnapshots = React.useCallback(async (nextRun: FlightTableRunV1 | null) => {
    if (!nextRun) {
      setSnapshots([]);
      return;
    }
    try {
      setSnapshots(await fetchFlightTableApiSnapshots(nextRun.run_id));
    } catch {
      setSnapshots([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFlightTableRuns()
      .then((runs) => {
        if (cancelled) return;
        const first = runs[0] ?? null;
        setRun(first);
        if (first) {
          setRunIdDraft(first.run_id);
          setLaneDraft(first.lane);
          setCustomerVisible(Boolean(first.manifest.field_id));
          setReportVisible(Boolean(first.manifest.field_id));
          const scope = { tenant_id: first.tenant_id, project_id: first.project_id, group_id: first.group_id };
          setFieldDraft((draft) => ({
            ...draft,
            ...scope,
            field_id: first.manifest.field_id ?? draft.field_id,
            season_id: first.manifest.season_id ?? draft.season_id,
            crop: first.manifest.crop ?? draft.crop,
            crop_stage: first.manifest.crop_stage ?? draft.crop_stage,
          }));
          setSpatialDraft((draft) => ({ ...draft, field_id: first.manifest.field_id ?? draft.field_id }));
          void refreshSnapshots(first);
        }
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorToText(err));
        setRun(null);
        setSnapshots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshSnapshots]);

  const applyRun = React.useCallback((next: FlightTableRunV1) => {
    setRun(next);
    setRunIdDraft(next.run_id);
    setLaneDraft(next.lane);
    setError(null);
    if (next.manifest.field_id) {
      setFieldDraft((draft) => ({
        ...draft,
        tenant_id: next.tenant_id,
        project_id: next.project_id,
        group_id: next.group_id,
        field_id: next.manifest.field_id ?? draft.field_id,
        season_id: next.manifest.season_id ?? draft.season_id,
        crop: next.manifest.crop ?? draft.crop,
        crop_stage: next.manifest.crop_stage ?? draft.crop_stage,
      }));
      setSpatialDraft((draft) => ({ ...draft, field_id: next.manifest.field_id ?? draft.field_id }));
    }
    void refreshSnapshots(next);
  }, [refreshSnapshots]);

  const handleCreateRun = React.useCallback(async () => {
    setLoading(true);
    try {
      const scope = defaultScope();
      const next = await createFlightTableRun({
        run_id: runIdDraft,
        lane: laneDraft,
        tenant_id: scope.tenant_id,
        project_id: scope.project_id,
        group_id: scope.group_id,
      });
      setFieldDraft((draft) => ({ ...draft, tenant_id: next.tenant_id, project_id: next.project_id, group_id: next.group_id }));
      applyRun(next);
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [applyRun, laneDraft, runIdDraft]);

  const handleCreateField = React.useCallback(async () => {
    if (!run) {
      setFieldError("请先创建 run");
      return;
    }
    setFieldLoading(true);
    setFieldError(null);
    try {
      const res = await createFlightTableField(run.run_id, {
        field_id: fieldDraft.field_id,
        field_name: fieldDraft.field_name,
        crop: fieldDraft.crop,
        crop_stage: fieldDraft.crop_stage,
        season_id: fieldDraft.season_id,
      });
      setCustomerVisible(res.customer_visible);
      setReportVisible(res.report_visible);
      setSpatialDraft((draft) => ({ ...draft, field_id: res.field_id }));
      applyRun(res.run);
    } catch (err) {
      setFieldError(errorToText(err));
    } finally {
      setFieldLoading(false);
    }
  }, [applyRun, fieldDraft, run]);

  const handleVerifyField = React.useCallback(async () => {
    await handleCreateField();
  }, [handleCreateField]);

  const handleSubmitGeometry = React.useCallback(async () => {
    if (!run) {
      setSpatialError("请先创建 run");
      return;
    }
    const fieldId = spatialDraft.field_id || run.manifest.field_id;
    if (!fieldId) {
      setSpatialError("请先创建田块对象");
      return;
    }
    setSpatialLoading(true);
    setSpatialError(null);
    try {
      const parsed = JSON.parse(spatialDraft.geometryText);
      const weatherLat = Number(spatialDraft.weatherLat);
      const weatherLng = Number(spatialDraft.weatherLng);
      const weather_location = Number.isFinite(weatherLat) && Number.isFinite(weatherLng)
        ? { lat: weatherLat, lng: weatherLng }
        : null;
      const res = await createFlightTableGeometry(run.run_id, {
        field_id: fieldId,
        geometry_format: "GEOJSON",
        geometry: parsed,
        weather_location,
      });
      setGeometryResult(res);
      applyRun(res.run);
    } catch (err) {
      setSpatialError(errorToText(err));
    } finally {
      setSpatialLoading(false);
    }
  }, [applyRun, run, spatialDraft]);

  const handleVerify = React.useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      applyRun(await verifyFlightTableRun(run.run_id));
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [applyRun, run]);

  const handleClean = React.useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      const next = await cleanFlightTableRun(run.run_id);
      setCustomerVisible(false);
      setReportVisible(false);
      setGeometryResult(null);
      setSpatialDraft(defaultSpatialDraft());
      applyRun(next);
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [applyRun, run]);

  const handleRetryStep = React.useCallback(async (stepKey: string) => {
    if (!run) return;
    setLoading(true);
    try {
      applyRun(await retryFlightTableStep(run.run_id, stepKey));
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [applyRun, run]);

  return (
    <FlightTableShell
      run={run}
      snapshots={snapshots}
      runIdDraft={runIdDraft}
      laneDraft={laneDraft}
      fieldDraft={fieldDraft}
      fieldLoading={fieldLoading}
      fieldError={fieldError}
      customerVisible={customerVisible}
      reportVisible={reportVisible}
      spatialDraft={spatialDraft}
      spatialLoading={spatialLoading}
      spatialError={spatialError}
      geometryResult={geometryResult}
      onRunIdDraftChange={setRunIdDraft}
      onLaneDraftChange={setLaneDraft}
      onFieldDraftChange={(patch) => setFieldDraft((draft) => ({ ...draft, ...patch }))}
      onSpatialDraftChange={(patch) => setSpatialDraft((draft) => ({ ...draft, ...patch }))}
      onCreateRun={handleCreateRun}
      onCreateField={handleCreateField}
      onVerifyField={handleVerifyField}
      onSubmitGeometry={handleSubmitGeometry}
      onVerify={handleVerify}
      onClean={handleClean}
      onRetryStep={handleRetryStep}
      loading={loading}
      error={error}
    />
  );
}
