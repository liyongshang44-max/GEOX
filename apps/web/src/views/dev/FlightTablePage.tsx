import React from "react";
import {
  bindFlightTableSkills,
  cleanFlightTableRun,
  createFlightTableDevices,
  createFlightTableField,
  createFlightTableGeometry,
  createFlightTableRun,
  failOneFlightTableSkill,
  fetchFlightTableApiSnapshots,
  fetchFlightTableDeviceTemplates,
  fetchFlightTableRun,
  fetchFlightTableRuns,
  fetchFlightTableVerifyReport,
  restoreFlightTableSkills,
  retryFlightTableStep,
  startFlightTableRun,
  verifyFlightTableRun,
  type CreateFlightTableGeometryResponseV1,
  type FlightTableApiSnapshotV1,
  type FlightTableDeviceSummaryV1,
  type FlightTableDeviceTemplateV1,
  type FlightTableLaneV1,
  type FlightTableRunV1,
  type FlightTableSkillAssemblyResponseV1,
  type FlightTableSkillFailureTypeV1,
} from "../../api/flightTable";
import { ApiError } from "../../api/client";
import { readTenantContext } from "../../auth/authStorage";
import FlightTableShell from "../../components/dev/flight-table/FlightTableShell";
import type { FieldAssemblyDraftV1 } from "../../components/dev/flight-table/FieldAssemblyCard";
import type { FieldSpatialDraftV1 } from "../../components/dev/flight-table/FieldSpatialCard";
import type { DeviceOnboardingDraftV1 } from "../../components/dev/flight-table/DeviceOnboardingWizard";
import { defaultFlightTableRunId, flightTablePermissionLabel } from "../../viewmodels/flightTableVm";
import "../../styles/flightTable.css";
import "../../styles/flightTableSkills.css";

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

function defaultDeviceDraft(): DeviceOnboardingDraftV1 {
  return {
    template_code: "soil_probe",
    device_id: "",
    mode: "simulator",
    telemetry_mode: "fast",
  };
}

function optimisticRunningRun(run: FlightTableRunV1, lane: FlightTableLaneV1): FlightTableRunV1 {
  const now = new Date().toISOString();
  return {
    ...run,
    lane,
    status: "RUNNING",
    started_at: run.started_at ?? now,
    finished_at: undefined,
    updated_at: now,
    current_step: run.current_step ?? "A",
    steps: run.steps.map((step, index) => index === 0
      ? { ...step, status: "RUNNING", verify_result: "PENDING", started_at: step.started_at ?? now, updated_at: now }
      : step.status === "FAIL" ? step : { ...step, status: step.status === "PASS" ? "PASS" : "PENDING", verify_result: step.verify_result === "PASS" ? "PASS" : "PENDING", updated_at: now }),
  };
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FlightTablePage(): React.ReactElement {
  const [run, setRun] = React.useState<FlightTableRunV1 | null>(null);
  const [snapshots, setSnapshots] = React.useState<FlightTableApiSnapshotV1[]>([]);
  const [runIdDraft, setRunIdDraft] = React.useState(defaultFlightTableRunId);
  const [laneDraft, setLaneDraft] = React.useState<FlightTableLaneV1>("success");
  const [skillFailureType, setSkillFailureType] = React.useState<FlightTableSkillFailureTypeV1>("missing_sensing_skill");
  const [fieldDraft, setFieldDraft] = React.useState<FieldAssemblyDraftV1>(defaultFieldDraft);
  const [spatialDraft, setSpatialDraft] = React.useState<FieldSpatialDraftV1>(() => defaultSpatialDraft());
  const [deviceDraft, setDeviceDraft] = React.useState<DeviceOnboardingDraftV1>(defaultDeviceDraft);
  const [fieldLoading, setFieldLoading] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [spatialLoading, setSpatialLoading] = React.useState(false);
  const [spatialError, setSpatialError] = React.useState<string | null>(null);
  const [deviceLoading, setDeviceLoading] = React.useState(false);
  const [deviceError, setDeviceError] = React.useState<string | null>(null);
  const [skillLoading, setSkillLoading] = React.useState(false);
  const [skillError, setSkillError] = React.useState<string | null>(null);
  const [geometryResult, setGeometryResult] = React.useState<CreateFlightTableGeometryResponseV1 | null>(null);
  const [deviceTemplates, setDeviceTemplates] = React.useState<FlightTableDeviceTemplateV1[]>([]);
  const [onboardedDevices, setOnboardedDevices] = React.useState<FlightTableDeviceSummaryV1[]>([]);
  const [skillResult, setSkillResult] = React.useState<FlightTableSkillAssemblyResponseV1 | null>(null);
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
    Promise.all([fetchFlightTableRuns(), fetchFlightTableDeviceTemplates().catch(() => [])])
      .then(([runs, templates]) => {
        if (cancelled) return;
        setDeviceTemplates(templates);
        if (templates[0]) setDeviceDraft((draft) => ({ ...draft, template_code: draft.template_code || templates[0].template_code }));
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

  React.useEffect(() => {
    if (!run || run.status !== "RUNNING") return undefined;
    const timer = window.setInterval(() => {
      void fetchFlightTableRun(run.run_id)
        .then((next) => {
          if (next.updated_at !== run.updated_at || next.status !== run.status) applyRun(next);
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [applyRun, run]);

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

  const handleStartRun = React.useCallback(async () => {
    if (!run) return;
    setLoading(true);
    setError(null);
    setRun(optimisticRunningRun(run, laneDraft));
    try {
      const next = await startFlightTableRun(run.run_id, {
        lane: laneDraft,
        field_id: run.manifest.field_id ?? fieldDraft.field_id,
        device_set: run.manifest.device_ids.length ? run.manifest.device_ids.join(",") : undefined,
        skill_policy: laneDraft === "skill_failure" || laneDraft === "all" ? `failure:${skillFailureType}` : "require_all_bound",
        weather_policy: laneDraft === "weather_interference" || laneDraft === "all" ? "simulate_weather_interference" : "observe_only",
        evidence_policy: laneDraft === "evidence_insufficient" || laneDraft === "all" ? "insufficient" : "complete",
      });
      applyRun(next);
    } catch (err) {
      setError(errorToText(err));
      setRun(run);
    } finally {
      setLoading(false);
    }
  }, [applyRun, fieldDraft.field_id, laneDraft, run, skillFailureType]);

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

  const handleOnboardDevice = React.useCallback(async () => {
    if (!run) {
      setDeviceError("请先创建 run");
      return;
    }
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    if (!fieldId) {
      setDeviceError("请先创建田块对象");
      return;
    }
    setDeviceLoading(true);
    setDeviceError(null);
    try {
      const res = await createFlightTableDevices(run.run_id, {
        field_id: fieldId,
        template_code: deviceDraft.template_code,
        device_id: deviceDraft.device_id.trim() || undefined,
        mode: deviceDraft.mode,
        telemetry_mode: deviceDraft.telemetry_mode,
      });
      setOnboardedDevices((prev) => [...res.devices, ...prev.filter((d) => !res.devices.some((n) => n.device_id === d.device_id))]);
      setDeviceDraft((draft) => ({ ...draft, device_id: "" }));
      applyRun(res.run);
    } catch (err) {
      setDeviceError(errorToText(err));
    } finally {
      setDeviceLoading(false);
    }
  }, [applyRun, deviceDraft, fieldDraft.field_id, run]);

  const handleBindSkills = React.useCallback(async () => {
    if (!run) {
      setSkillError("请先创建 run");
      return;
    }
    setSkillLoading(true);
    setSkillError(null);
    try {
      const res = await bindFlightTableSkills(run.run_id);
      setSkillResult(res);
      applyRun(res.run);
    } catch (err) {
      setSkillError(errorToText(err));
    } finally {
      setSkillLoading(false);
    }
  }, [applyRun, run]);

  const handleFailOneSkill = React.useCallback(async () => {
    if (!run) {
      setSkillError("请先创建 run");
      return;
    }
    setSkillLoading(true);
    setSkillError(null);
    try {
      const res = await failOneFlightTableSkill(run.run_id, skillFailureType);
      setSkillResult(res);
      applyRun(res.run);
    } catch (err) {
      setSkillError(errorToText(err));
    } finally {
      setSkillLoading(false);
    }
  }, [applyRun, run, skillFailureType]);

  const handleRestoreSkills = React.useCallback(async () => {
    if (!run) {
      setSkillError("请先创建 run");
      return;
    }
    setSkillLoading(true);
    setSkillError(null);
    try {
      const res = await restoreFlightTableSkills(run.run_id);
      setSkillResult(res);
      applyRun(res.run);
    } catch (err) {
      setSkillError(errorToText(err));
    } finally {
      setSkillLoading(false);
    }
  }, [applyRun, run]);

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

  const handleRetryFailedStep = React.useCallback(async () => {
    if (!run) return;
    const failedStep = run.steps.find((step) => step.status === "FAIL");
    if (!failedStep) return;
    await handleRetryStep(failedStep.step_key);
  }, [handleRetryStep, run]);

  const handleExportAcceptancePackage = React.useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      const verifyReport = await fetchFlightTableVerifyReport(run.run_id).catch(() => null);
      const latestSnapshots = await fetchFlightTableApiSnapshots(run.run_id).catch(() => snapshots);
      downloadJson(`${run.run_id}_acceptance_package.json`, {
        exported_at: new Date().toISOString(),
        run,
        verify_report: verifyReport,
        api_snapshots: latestSnapshots,
      });
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [run, snapshots]);

  const handleClean = React.useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      const next = await cleanFlightTableRun(run.run_id);
      setCustomerVisible(false);
      setReportVisible(false);
      setGeometryResult(null);
      setOnboardedDevices([]);
      setSkillResult(null);
      setSpatialDraft(defaultSpatialDraft());
      applyRun(next);
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
      skillFailureType={skillFailureType}
      fieldDraft={fieldDraft}
      fieldLoading={fieldLoading}
      fieldError={fieldError}
      customerVisible={customerVisible}
      reportVisible={reportVisible}
      spatialDraft={spatialDraft}
      spatialLoading={spatialLoading}
      spatialError={spatialError}
      geometryResult={geometryResult}
      deviceDraft={deviceDraft}
      deviceLoading={deviceLoading}
      deviceError={deviceError}
      deviceTemplates={deviceTemplates}
      onboardedDevices={onboardedDevices}
      skillResult={skillResult}
      skillLoading={skillLoading}
      skillError={skillError}
      onRunIdDraftChange={setRunIdDraft}
      onLaneDraftChange={setLaneDraft}
      onSkillFailureTypeChange={setSkillFailureType}
      onFieldDraftChange={(patch) => setFieldDraft((draft) => ({ ...draft, ...patch }))}
      onSpatialDraftChange={(patch) => setSpatialDraft((draft) => ({ ...draft, ...patch }))}
      onDeviceDraftChange={(patch) => setDeviceDraft((draft) => ({ ...draft, ...patch }))}
      onCreateRun={handleCreateRun}
      onStartRun={handleStartRun}
      onCreateField={handleCreateField}
      onVerifyField={handleVerifyField}
      onSubmitGeometry={handleSubmitGeometry}
      onOnboardDevice={handleOnboardDevice}
      onRetryDevice={handleOnboardDevice}
      onBindSkills={handleBindSkills}
      onFailOneSkill={handleFailOneSkill}
      onRestoreSkills={handleRestoreSkills}
      onVerify={handleVerify}
      onRetryFailedStep={handleRetryFailedStep}
      onClean={handleClean}
      onExportAcceptancePackage={handleExportAcceptancePackage}
      onRetryStep={handleRetryStep}
      loading={loading}
      error={error}
    />
  );
}
