import React from "react";
import { apiRequest } from "../api/client";
import { fetchFieldControlPlane, fetchFieldCurrentProgram, fetchFieldDetail, fetchFieldGeometry, type FieldControlPlaneItem } from "../api/fields";
import { fetchOperationStates } from "../api/operations";
import { fetchAgronomyRecommendations } from "../api/programs";
import { buildFieldViewModel, type FieldViewModel } from "../viewmodels/fieldViewModel";
import { mapReceiptToVm, type ReceiptEvidenceVm } from "../viewmodels/evidence";
import type { FieldLang } from "../lib/fieldViewModel";
import { resolveOperationPlanId, toOperationDetailPath } from "../lib/operationLink";

const unsupportedFieldControlPlaneIds = new Set<string>();
const unsupportedFieldCurrentProgramIds = new Set<string>();

function is404Error(error: any): boolean {
  return error?.status === 404 || error?.response?.status === 404;
}

function mapControlPlaneToLegacyDetail(fieldId: string, cp: FieldControlPlaneItem): any {
  const operations = Array.isArray(cp.operations) ? cp.operations : [];
  const alerts = Array.isArray(cp.alerts) ? cp.alerts : [];
  return {
    field: {
      field_id: cp.field?.field_id || fieldId,
      name: cp.field?.field_name || cp.overview?.field_name || fieldId,
      area_ha: cp.field?.area_ha ?? cp.overview?.area_ha ?? null,
      status: cp.field?.status?.code || cp.overview?.status?.code || "UNKNOWN",
    },
    latest_season: {
      season_id: cp.current_context?.season_id || cp.overview?.current_season || null,
      name: cp.current_context?.season_id || cp.overview?.current_season || null,
      crop: cp.current_context?.crop_code || null,
    },
    summary: {
      device_count: cp.summary?.device_count ?? cp.overview?.device_count ?? 0,
    },
    geometry: cp.map?.geojson ?? null,
    recent_alerts: alerts.map((item) => ({
      event_id: item.alert_id,
      metric: item.title,
      status: String(item.status || "OPEN").toUpperCase(),
      raised_at: item.ts_label,
      raised_ts_ms: Date.now(),
      object_id: fieldId,
    })),
    map_layers: {
      job_history: operations.map((op) => ({
        id: op.operation_plan_id,
        act_task_id: op.act_task_id,
        task_type: op.title,
        ts_ms: op.updated_ts_ms,
        timing_source: String(op.status?.code || "ACKED").toUpperCase().includes("ACK") ? "receipt" : "schedule",
      })),
      markers: [],
      trajectories: cp.map?.operation_tracks || [],
      alert_heat_geojson: cp.map?.geojson || { type: "FeatureCollection", features: [] },
    },
    recent_receipts: [],
  };
}

type FieldOverviewBuildResult = { detail: any; controlPlaneHit: boolean };
type FieldDetailState = {
  detail: any;
  activeOperations: any[];
  allOperations: any[];
  recentRecommendations: any[];
  currentProgram: any;
  latestEvidenceVm?: ReceiptEvidenceVm;
} | null;

function normalizeMarkers(items: any[] | null | undefined): any[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item: any) => {
      const payload = item?.payload ?? item ?? {};
      const coordinates = payload?.point?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

      const lon = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

      return {
        device_id: String(payload?.device_id ?? item?.device_id ?? ""),
        lon,
        lat,
        ts_ms: Number(payload?.ts ?? item?.ts_ms ?? 0) || null,
        source: "device_position_v1",
      };
    })
    .filter(Boolean);
}

function normalizeTrajectories(items: any[] | null | undefined): any[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item: any, idx: number) => {
      const payload = item?.payload ?? item ?? {};
      const coordinates = payload?.line?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

      const points = coordinates
        .map((pair: any) => {
          if (!Array.isArray(pair) || pair.length < 2) return null;
          const lon = Number(pair[0]);
          const lat = Number(pair[1]);
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
          return { lon, lat, ts_ms: null };
        })
        .filter(Boolean);

      if (points.length < 2) return null;

      const deviceId = String(payload?.device_id ?? item?.device_id ?? `track_${idx + 1}`);

      return {
        device_id: deviceId,
        points,
        geojson: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: points.map((p: any) => [p.lon, p.lat]),
          },
          properties: { device_id: deviceId },
        },
      };
    })
    .filter(Boolean);
}

function buildFieldOverviewVm(args: {
  fieldId: string;
  controlPlane: any;
  legacyDetail: any;
  geometry: any;
  livePositions?: any[];
  liveTrajectories?: any[];
}): FieldOverviewBuildResult {
  const { fieldId, controlPlane, legacyDetail, geometry, livePositions, liveTrajectories } = args;

  const controlPlaneHit = Boolean(controlPlane?.field || controlPlane?.overview || controlPlane?.summary);

  const base =
    legacyDetail ||
    (controlPlaneHit ? mapControlPlaneToLegacyDetail(fieldId, controlPlane) : null) || {
      field: { field_id: fieldId, name: fieldId, area_ha: null, status: "UNKNOWN" },
      latest_season: null,
      summary: { device_count: 0 },
      geometry: null,
      map_layers: {},
      recent_receipts: [],
    };

  const existingLayers = base?.map_layers ?? {};
  const normalizedMarkers = normalizeMarkers(livePositions);
  const normalizedTrajectories = normalizeTrajectories(liveTrajectories);
  const preferLiveMap = normalizedTrajectories.length > 0 || normalizedMarkers.length > 0;

  return {
    controlPlaneHit,
    detail: {
      ...base,
      geometry: geometry ?? base?.geometry ?? null,
      map_layers: {
        ...existingLayers,
        markers: preferLiveMap
          ? normalizedMarkers
          : Array.isArray(existingLayers.markers)
            ? existingLayers.markers
            : [],
        trajectories: preferLiveMap
          ? normalizedTrajectories
          : Array.isArray(existingLayers.trajectories)
            ? existingLayers.trajectories
            : [],
      },
    },
  };
}

function buildLatestEvidenceVm(args: { detail: any; allOperations: any[]; controlPlane: any }): ReceiptEvidenceVm | undefined {
  const { detail, allOperations, controlPlane } = args;
  const latestOperationPlanId = resolveOperationPlanId(allOperations?.[0]);
  const raw =
    detail?.latestEvidence ??
    detail?.latest_evidence ??
    (Array.isArray(detail?.recent_receipts) ? detail.recent_receipts[0]?.receipt?.payload : null) ??
    controlPlane?.evidence?.recent_items?.[0] ??
    null;

  if (raw) {
    return mapReceiptToVm({
      ...raw,
      href: toOperationDetailPath({
        ...raw,
        operation_plan_id: raw?.operation_plan_id ?? latestOperationPlanId,
      }),
    });
  }

  const latestFinishedOp = (allOperations ?? []).find((x: any) =>
    ["SUCCESS", "SUCCEEDED", "FAILED"].includes(String(x?.final_status ?? "").toUpperCase())
  );

  if (!latestFinishedOp) return undefined;

  return mapReceiptToVm({
    status: latestFinishedOp.final_status,
    execution_finished_at: latestFinishedOp.last_event_ts
      ? new Date(Number(latestFinishedOp.last_event_ts)).toISOString()
      : null,
    executor_label: latestFinishedOp.device_id,
    device_id: latestFinishedOp.device_id,
  });
}

export function useFieldDetail(params: {
  fieldId: string;
  lang: FieldLang;
}): {
  busy: boolean;
  status: string;
  error: string | null;
  technical: string | null;
  model: FieldViewModel | null;
  refresh: () => Promise<void>;
} {
  const { fieldId, lang } = params;
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [state, setState] = React.useState<FieldDetailState>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [technical, setTechnical] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setTechnical(null);

    if (!fieldId) {
      setState(null);
      setBusy(false);
      return;
    }

    setStatus(lang === "zh" ? "正在加载田块视图…" : "Loading...");

    try {
      if (!fieldId) {
        setState(null);
        setStatus("");
        return;
      }

      let cp: any = null;
      if (!unsupportedFieldControlPlaneIds.has(fieldId)) {
        try {
          cp = await fetchFieldControlPlane(fieldId);
        } catch (e: any) {
          if (is404Error(e)) unsupportedFieldControlPlaneIds.add(fieldId);
        }
      }

      let detail: any = null;
      try {
        detail = await fetchFieldDetail(fieldId);
      } catch {}

      const [opsRes, recsRes, currentRes, geometryRes, positionsRes, trajectoriesRes] = await Promise.allSettled([
        Promise.resolve().then(() => fetchOperationStates({ field_id: fieldId, limit: 20 })),
        Promise.resolve().then(() => fetchAgronomyRecommendations({ limit: 30 })),
        Promise.resolve().then(async () => {
          if (unsupportedFieldCurrentProgramIds.has(fieldId)) return null;
          try {
            return await fetchFieldCurrentProgram(fieldId);
          } catch (e: any) {
            if (is404Error(e)) {
              unsupportedFieldCurrentProgramIds.add(fieldId);
              return null;
            }
            throw e;
          }
        }),
        Promise.resolve().then(() => fetchFieldGeometry(fieldId)),
        Promise.resolve().then(() =>
          apiRequest<{ ok?: boolean; items?: any[] }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/device-positions`)
        ),
        Promise.resolve().then(() =>
          apiRequest<{ ok?: boolean; items?: any[] }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/trajectories`)
        ),
      ]);

      const geometry = geometryRes.status === "fulfilled" ? geometryRes.value?.geometry ?? geometryRes.value : null;
      const allOperations = opsRes.status === "fulfilled" ? opsRes.value.items ?? [] : [];
      const activeOperations = allOperations.filter(
        (x) => !["SUCCESS", "FAILED", "SUCCEEDED"].includes(String(x.final_status).toUpperCase())
      );
      const recommendations =
        recsRes.status === "fulfilled"
          ? (recsRes.value.items ?? []).filter((x) => String(x.field_id ?? "") === fieldId).slice(0, 8)
          : [];
      const currentProgram = currentRes.status === "fulfilled" ? currentRes.value ?? null : null;
      const livePositions = positionsRes.status === "fulfilled" ? positionsRes.value?.items ?? [] : [];
      const liveTrajectories = trajectoriesRes.status === "fulfilled" ? trajectoriesRes.value?.items ?? [] : [];

      const overview = buildFieldOverviewVm({
        fieldId,
        controlPlane: cp,
        legacyDetail: detail,
        geometry,
        livePositions,
        liveTrajectories,
      });

      const latestEvidenceVm = buildLatestEvidenceVm({
        detail: overview.detail,
        allOperations,
        controlPlane: cp,
      });

      setState({
        detail: overview.detail,
        currentProgram,
        activeOperations,
        allOperations,
        recentRecommendations: recommendations,
        latestEvidenceVm,
      });

      setStatus(overview.controlPlaneHit ? "已加载田块控制台" : lang === "zh" ? "已加载田块控制台" : "Field console loaded");
    } catch (e: any) {
      setState(null);
      setError(lang === "zh" ? "田块详情加载失败" : "Failed to load field detail");
      setTechnical(e?.message ? String(e.message) : String(e ?? "unknown"));
      setStatus(lang === "zh" ? "加载失败" : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [fieldId, lang]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const model = React.useMemo(() => {
    if (!state) return null;
    const vm = buildFieldViewModel({
      fieldId,
      lang,
      detail: state.detail,
      activeOperations: state.activeOperations,
      recentRecommendations: state.recentRecommendations,
      currentProgram: state.currentProgram,
      allOperations: state.allOperations ?? [],
    });
    return { ...vm, latestEvidence: state.latestEvidenceVm ?? vm.latestEvidence };
  }, [state, fieldId, lang]);

  return { busy, status, error, technical, model, refresh };
}
