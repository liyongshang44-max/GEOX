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
} from "../../../../api/flightTable";
import {
  runFlightTableDecision,
  type FlightTableDecisionRunResultV1,
} from "../../../../api/flightTableDecision";
import {
  runFlightTableEvidence,
  type FlightTableEvidenceLaneV1,
  type FlightTableEvidenceRunResultV1,
} from "../../../../api/flightTableEvidence";
import {
  runFlightTableOperation,
  type FlightTableOperationRunResultV1,
} from "../../../../api/flightTableOperation";
import {
  runFlightTableReportLearning,
  type FlightTableReportLearningRunResultV1,
} from "../../../../api/flightTableReportLearning";
import {
  fetchFlightTableTelemetryScenarios,
  publishFlightTableTelemetry,
  verifyFlightTableTelemetry,
  type FlightTableTelemetryResponseV1,
  type FlightTableTelemetryScenarioKeyV1,
} from "../../../../api/flightTableTelemetry";
import { ApiError } from "../../../../api/client";
import { readTenantContext } from "../../../../auth/authStorage";
import FlightTableShell from "../../../../components/dev/flight-table/FlightTableShell";
import type { FieldAssemblyDraftV1 } from "../../../../components/dev/flight-table/FieldAssemblyCard";
import type { FieldSpatialDraftV1 } from "../../../../components/dev/flight-table/FieldSpatialCard";
import type { DeviceOnboardingDraftV1 } from "../../../../components/dev/flight-table/DeviceOnboardingWizard";
import { defaultFlightTableRunId, flightTablePermissionLabel } from "../../../../viewmodels/flightTableVm";
import "../../../../styles/flightTable.css";
import "../../../../styles/flightTableSkills.css";
import "../../../../styles/flightTableTelemetry.css";
import "../../../../styles/flightTableDecision.css";

const DEFAULT_TELEMETRY_SCENARIOS: FlightTableTelemetryScenarioKeyV1[] = [
  "before_irrigation_low_moisture",
  "during_irrigation_flow",
  "after_irrigation_success",
];

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

function evidenceLaneFromRunLane(lane: FlightTableLaneV1): FlightTableEvidenceLaneV1 {
  if (lane === "evidence_insufficient" || lane === "weather_interference" || lane === "skill_failure") return lane;
  return "success";
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
  const [telemetryScenarios, setTelemetryScenarios] = React.useState<FlightTableTelemetryScenarioKeyV1[]>([]);
  const [selectedTelemetryScenarios, setSelectedTelemetryScenarios] = React.useState<FlightTableTelemetryScenarioKeyV1[]>(DEFAULT_TELEMETRY_SCENARIOS);
  const [telemetryResult, setTelemetryResult] = React.useState<FlightTableTelemetryResponseV1 | null>(null);
  const [telemetryLoading, setTelemetryLoading] = React.useState(false);
  const [telemetryError, setTelemetryError] = React.useState<string | null>(null);
  const [skillLoading, setSkillLoading] = React.useState(false);
  const [skillError, setSkillError] = React.useState<string | null>(null);
  const [decisionResult, setDecisionResult] = React.useState<FlightTableDecisionRunResultV1 | null>(null);
  const [decisionLoading, setDecisionLoading] = React.useState(false);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const [operationResult, setOperationResult] = React.useState<FlightTableOperationRunResultV1 | null>(null);
  const [operationLoading, setOperationLoading] = React.useState(false);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [evidenceResult, setEvidenceResult] = React.useState<FlightTableEvidenceRunResultV1 | null>(null);
  const [evidenceLoading, setEvidenceLoading] = React.useState(false);
  const [evidenceError, setEvidenceError] = React.useState<string | null>(null);
  const [reportLearningResult, setReportLearningResult] = React.useState<FlightTableReportLearningRunResultV1 | null>(null);
  const [reportLearningLoading, setReportLearningLoading] = React.useState(false);
  const [reportLearningError, setReportLearningError] = React.useState<string | null>(null);
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
    Promise.all([
      fetchFlightTableRuns(),
      fetchFlightTableDeviceTemplates().catch(() => []),
      fetchFlightTableTelemetryScenarios().catch(() => []),
    ])
      .then(([runs, templates, scenarios]) => {
        if (cancelled) return;
        setDeviceTemplates(templates);
        setTelemetryScenarios(scenarios.length ? scenarios : DEFAULT_TELEMETRY_SCENARIOS);
        setSelectedTelemetryScenarios((current) => current.length ? current : DEFAULT_TELEMETRY_SCENARIOS);
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

  const handleTelemetryScenarioToggle = React.useCallback((scenario: FlightTableTelemetryScenarioKeyV1) => {
    setSelectedTelemetryScenarios((current) => current.includes(scenario)
      ? current.filter((item) => item !== scenario)
      : [...current, scenario]);
  }, []);

  const handlePublishTelemetry = React.useCallback(async (deviceId?: string | null) => {
    if (!run) {
      setTelemetryError("请先创建 run");
      return;
    }
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    const resolvedDeviceId = deviceId || run.manifest.device_ids[0] || onboardedDevices[0]?.device_id;
    if (!fieldId) {
      setTelemetryError("请先创建田块对象");
      return;
    }
    if (!resolvedDeviceId) {
      setTelemetryError("请先接入设备");
      return;
    }
    setTelemetryLoading(true);
    setTelemetryError(null);
    try {
      const scenarios = selectedTelemetryScenarios.length ? selectedTelemetryScenarios : DEFAULT_TELEMETRY_SCENARIOS;
      const res = await publishFlightTableTelemetry(run.run_id, {
        scenarios,
        mode: deviceDraft.telemetry_mode === "realistic" ? "mqtt" : "fast",
        device_id: resolvedDeviceId,
        field_id: fieldId,
      });
      setTelemetryResult(res);
      applyRun(res.run);
    } catch (err) {
      setTelemetryError(errorToText(err));
    } finally {
      setTelemetryLoading(false);
    }
  }, [applyRun, deviceDraft.telemetry_mode, fieldDraft.field_id, onboardedDevices, run, selectedTelemetryScenarios]);

  const handleVerifyTelemetry = React.useCallback(async (deviceId?: string | null) => {
    if (!run) {
      setTelemetryError("请先创建 run");
      return;
    }
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    const resolvedDeviceId = deviceId || run.manifest.device_ids[0] || onboardedDevices[0]?.device_id;
    if (!fieldId || !resolvedDeviceId) {
      setTelemetryError("缺少 field_id 或 device_id");
      return;
    }
    setTelemetryLoading(true);
    setTelemetryError(null);
    try {
      const verify = await verifyFlightTableTelemetry(run.run_id, { device_id: resolvedDeviceId, field_id: fieldId });
      setTelemetryResult((current) => current ? { ...current, verify, freshness: verify.field_sensing_overview_v1.freshness ?? verify.field_sensing_summary_stage1_v1.freshness } : {
        ok: true,
        scenarios: selectedTelemetryScenarios,
        points: [],
        metric_count: verify.telemetry_index_v1.count,
        last_telemetry_time: verify.telemetry_index_v1.latest_ts_ms ? new Date(verify.telemetry_index_v1.latest_ts_ms).toISOString() : null,
        observation_status: verify.breakpoint ? "PARTIAL" : verify.device_observation_index_v1.visible ? "READY" : "MISSING",
        sensing_status: verify.field_sensing_overview_v1.visible || verify.field_sensing_summary_stage1_v1.visible ? "READY" : verify.derived_sensing_state_index_v1.visible ? "PARTIAL" : "MISSING",
        freshness: verify.field_sensing_overview_v1.freshness ?? verify.field_sensing_summary_stage1_v1.freshness,
        verify,
        run,
      });
      void refreshSnapshots(run);
    } catch (err) {
      setTelemetryError(errorToText(err));
    } finally {
      setTelemetryLoading(false);
    }
  }, [fieldDraft.field_id, onboardedDevices, refreshSnapshots, run, selectedTelemetryScenarios]);

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

  const handleRunDecision = React.useCallback(async () => {
    if (!run) {
      setDecisionError("请先创建 run");
      return;
    }
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    const seasonId = run.manifest.season_id ?? fieldDraft.season_id;
    const deviceId = run.manifest.device_ids[0] || onboardedDevices[0]?.device_id || deviceDraft.device_id;
    if (!fieldId || !seasonId) {
      setDecisionError("缺少 field_id 或 season_id");
      return;
    }
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      const res = await runFlightTableDecision(run.run_id, {
        field_id: fieldId,
        season_id: seasonId,
        device_id: deviceId || undefined,
        crop_code: run.manifest.crop ?? fieldDraft.crop ?? "corn",
        prescription_mode: "standard",
        approval_action: "approve",
      });
      setDecisionResult(res);
      applyRun(res.run);
    } catch (err) {
      setDecisionError(errorToText(err));
    } finally {
      setDecisionLoading(false);
    }
  }, [applyRun, deviceDraft.device_id, fieldDraft.crop, fieldDraft.field_id, fieldDraft.season_id, onboardedDevices, run]);

  const handleRunOperation = React.useCallback(async () => {
    if (!run) {
      setOperationError("请先创建 run");
      return;
    }
    const prescriptionId = run.manifest.prescription_ids.at(-1) ?? decisionResult?.prescription_id;
    const approvalRequestId = run.manifest.approval_request_ids.at(-1) ?? decisionResult?.approval_request_id;
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    const deviceId = run.manifest.device_ids[0] || onboardedDevices[0]?.device_id || deviceDraft.device_id;
    if (!prescriptionId || !approvalRequestId) {
      setOperationError("缺少 prescription_id 或 approval_request_id，请先运行 E 层");
      return;
    }
    setOperationLoading(true);
    setOperationError(null);
    try {
      const res = await runFlightTableOperation(run.run_id, {
        prescription_id: prescriptionId,
        approval_request_id: approvalRequestId,
        field_id: fieldId || undefined,
        device_id: deviceId || undefined,
      });
      setOperationResult(res);
      applyRun(res.run);
    } catch (err) {
      setOperationError(errorToText(err));
    } finally {
      setOperationLoading(false);
    }
  }, [applyRun, decisionResult, deviceDraft.device_id, fieldDraft.field_id, onboardedDevices, run]);

  const handleRunEvidence = React.useCallback(async () => {
    if (!run) {
      setEvidenceError("请先创建 run");
      return;
    }
    const operationId = run.manifest.operation_plan_ids.at(-1) ?? operationResult?.operation_id ?? operationResult?.operation_plan_id;
    const actTaskId = run.manifest.act_task_ids.at(-1) ?? operationResult?.act_task_id;
    const receiptId = run.manifest.receipt_ids.at(-1) ?? operationResult?.receipt_id;
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    if (!operationId || !actTaskId || !receiptId) {
      setEvidenceError("缺少 operation / act_task / receipt，请先运行 F 层");
      return;
    }
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const res = await runFlightTableEvidence(run.run_id, {
        lane: evidenceLaneFromRunLane(laneDraft),
        operation_id: operationId,
        operation_plan_id: operationId,
        act_task_id: actTaskId,
        receipt_id: receiptId,
        field_id: fieldId || undefined,
      });
      setEvidenceResult(res);
      applyRun(res.run);
    } catch (err) {
      setEvidenceError(errorToText(err));
    } finally {
      setEvidenceLoading(false);
    }
  }, [applyRun, fieldDraft.field_id, laneDraft, operationResult, run]);

  const handleRunReportLearning = React.useCallback(async () => {
    if (!run) {
      setReportLearningError("请先创建 run");
      return;
    }
    const operationId = run.manifest.operation_plan_ids.at(-1) ?? evidenceResult?.operation_id ?? operationResult?.operation_id ?? operationResult?.operation_plan_id;
    const fieldId = run.manifest.field_id ?? fieldDraft.field_id;
    if (!operationId || !fieldId) {
      setReportLearningError("缺少 operation_id 或 field_id，请先运行前置链路");
      return;
    }
    setReportLearningLoading(true);
    setReportLearningError(null);
    try {
      const res = await runFlightTableReportLearning(run.run_id, {
        operation_id: operationId,
        field_id: fieldId,
        acceptance_id: run.manifest.acceptance_ids.at(-1),
        evidence_id: run.manifest.evidence_ids.at(-1),
      });
      setReportLearningResult(res);
      applyRun(res.run);
    } catch (err) {
      setReportLearningError(errorToText(err));
    } finally {
      setReportLearningLoading(false);
    }
  }, [applyRun, evidenceResult, fieldDraft.field_id, operationResult, run]);

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
        telemetry_result: telemetryResult,
        decision_result: decisionResult,
        operation_result: operationResult,
        evidence_result: evidenceResult,
        report_learning_result: reportLearningResult,
        verify_report: verifyReport,
        api_snapshots: latestSnapshots,
      });
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [decisionResult, evidenceResult, operationResult, reportLearningResult, run, snapshots, telemetryResult]);

  const handleClean = React.useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      const next = await cleanFlightTableRun(run.run_id);
      setCustomerVisible(false);
      setReportVisible(false);
      setGeometryResult(null);
      setOnboardedDevices([]);
      setTelemetryResult(null);
      setDecisionResult(null);
      setOperationResult(null);
      setEvidenceResult(null);
      setReportLearningResult(null);
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
      telemetryScenarios={telemetryScenarios}
      selectedTelemetryScenarios={selectedTelemetryScenarios}
      telemetryResult={telemetryResult}
      telemetryLoading={telemetryLoading}
      telemetryError={telemetryError}
      skillResult={skillResult}
      skillLoading={skillLoading}
      skillError={skillError}
      decisionResult={decisionResult}
      decisionLoading={decisionLoading}
      decisionError={decisionError}
      operationResult={operationResult}
      operationLoading={operationLoading}
      operationError={operationError}
      evidenceResult={evidenceResult}
      evidenceLoading={evidenceLoading}
      evidenceError={evidenceError}
      reportLearningResult={reportLearningResult}
      reportLearningLoading={reportLearningLoading}
      reportLearningError={reportLearningError}
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
      onTelemetryScenarioToggle={handleTelemetryScenarioToggle}
      onPublishTelemetry={handlePublishTelemetry}
      onVerifyTelemetry={handleVerifyTelemetry}
      onBindSkills={handleBindSkills}
      onFailOneSkill={handleFailOneSkill}
      onRestoreSkills={handleRestoreSkills}
      onRunDecision={handleRunDecision}
      onRunOperation={handleRunOperation}
      onRunEvidence={handleRunEvidence}
      onRunReportLearning={handleRunReportLearning}
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
