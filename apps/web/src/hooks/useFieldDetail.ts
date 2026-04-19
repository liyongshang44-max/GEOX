import React from "react";
import { apiRequestOptional } from "../api/client";
import { fetchFieldCurrentProgram, fetchFieldDetail, fetchFieldGeometry } from "../api/fields";
import { fetchOperationStates } from "../api/operations";
import { fetchAgronomyRecommendations, fetchAgronomyRecommendationsControlPlane } from "../api/programs";
import { buildFieldViewModel, type FieldViewModel } from "../viewmodels/fieldViewModel";
import { mapReceiptToVm, type ReceiptEvidenceVm } from "../viewmodels/evidence";
import type { FieldLang } from "../lib/fieldViewModel";
import { resolveOperationPlanId, toOperationDetailPath } from "../lib/operationLink";
import { parseFieldReadModelV1, type ParsedFieldReadModelV1 } from "../lib/fieldReadModelV1";


type FieldOverviewBuildResult = { detail: any; controlPlaneHit: boolean };
type FieldDetailState = {
  detail: any;
  activeOperations: any[];
  allOperations: any[];
  recentRecommendations: any[];
  currentProgram: any;
  hasControlPlane: boolean;
  hasCurrentProgram: boolean;
  hasGeometry: boolean;
  fieldReadModelV1: ParsedFieldReadModelV1 | null;
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
  legacyDetail: any;
  geometry: any;
  livePositions?: any[];
  liveTrajectories?: any[];
}): FieldOverviewBuildResult {
  const { fieldId, legacyDetail, geometry, livePositions, liveTrajectories } = args;

  const controlPlaneHit = false;

  const base =
    legacyDetail ||
    {
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
  hasControlPlane: boolean;
  hasCurrentProgram: boolean;
  hasGeometry: boolean;
  fieldReadModelV1: ParsedFieldReadModelV1 | null;
  refresh: () => Promise<void>;
} {
  const { fieldId, lang } = params;
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [state, setState] = React.useState<FieldDetailState>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [technical, setTechnical] = React.useState<string | null>(null);
  const enableReadModelV1 = String((import.meta as any)?.env?.VITE_ENABLE_FIELD_READ_MODEL_V1 ?? "1") !== "0";

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

      const cpPromise = Promise.resolve(null);

      const detail = await fetchFieldDetail(fieldId);
      if (!detail) {
        setState(null);
        setStatus(lang === "zh" ? "暂无田块详情" : "No field detail");
        return;
      }

      const baseOverview = buildFieldOverviewVm({
        fieldId,
        legacyDetail: detail,
        geometry: null,
        livePositions: [],
        liveTrajectories: [],
      });

      setState({
        detail: baseOverview.detail,
        currentProgram: null,
        hasControlPlane: false,
        hasCurrentProgram: false,
        hasGeometry: Boolean(baseOverview.detail?.geometry),
        fieldReadModelV1: null,
        activeOperations: [],
        allOperations: [],
        recentRecommendations: [],
        latestEvidenceVm: buildLatestEvidenceVm({
          detail: baseOverview.detail,
          allOperations: [],
          controlPlane: null,
        }),
      });
      setStatus(lang === "zh" ? "基础详情已加载" : "Base field detail loaded");

      const [cpRes, opsRes, recsRes, recsCpRes, geometryRes, positionsRes, trajectoriesRes, currentProgramRes] = await Promise.allSettled([
        cpPromise,
        Promise.resolve().then(() => fetchOperationStates({ field_id: fieldId, limit: 20 })),
        Promise.resolve().then(() => fetchAgronomyRecommendations({ limit: 30 })),
        enableReadModelV1
          ? Promise.resolve().then(() => fetchAgronomyRecommendationsControlPlane({ field_id: fieldId, limit: 8 }))
          : Promise.resolve({ ok: true, summary: { total: 0, pending: 0, in_approval: 0, receipted: 0 }, items: [] as any[] }),
        Promise.resolve().then(() => fetchFieldGeometry(fieldId)),
        Promise.resolve().then(() =>
          apiRequestOptional<{ ok?: boolean; items?: any[] }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/device-positions`)
        ),
        Promise.resolve().then(() =>
          apiRequestOptional<{ ok?: boolean; items?: any[] }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/trajectories`)
        ),
        Promise.resolve().then(() => fetchFieldCurrentProgram(fieldId)),
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
      const recommendationsCp =
        recsCpRes.status === "fulfilled"
          ? (recsCpRes.value.items ?? []).filter((x) => String(x?.field_id ?? x?.field?.field_id ?? "") === fieldId).slice(0, 8)
          : [];
      const currentProgram = currentProgramRes.status === "fulfilled" ? currentProgramRes.value : null;
      const livePositions = positionsRes.status === "fulfilled" ? positionsRes.value?.items ?? [] : [];
      const liveTrajectories = trajectoriesRes.status === "fulfilled" ? trajectoriesRes.value?.items ?? [] : [];
      const cp = cpRes.status === "fulfilled" ? cpRes.value : null;
      // 仅作为技术附录数据保留，不参与客户主叙事定义。
      const technicalReadModelRec = enableReadModelV1 ? (recommendationsCp[0] ?? null) : null;
      const fieldReadModelV1 = technicalReadModelRec ? parseFieldReadModelV1(technicalReadModelRec) : null;

      const overview = buildFieldOverviewVm({
        fieldId,
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
        hasControlPlane: Boolean(cp),
        hasCurrentProgram: Boolean(currentProgram),
        hasGeometry: Boolean(geometry),
        fieldReadModelV1,
        activeOperations,
        allOperations,
        recentRecommendations: recommendations,
        latestEvidenceVm,
      });

      setStatus(overview.controlPlaneHit ? "已加载田块控制台" : lang === "zh" ? "田块详情已加载" : "Field detail loaded");
    } catch (e: any) {
      setState(null);
      setError(lang === "zh" ? "田块详情加载失败" : "Failed to load field detail");
      setTechnical(e?.message ? String(e.message) : String(e ?? "unknown"));
      setStatus(lang === "zh" ? "加载失败" : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [enableReadModelV1, fieldId, lang]);

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

  return {
    busy,
    status,
    error,
    technical,
    model,
    hasControlPlane: Boolean(state?.hasControlPlane),
    hasCurrentProgram: Boolean(state?.hasCurrentProgram),
    hasGeometry: Boolean(state?.hasGeometry),
    fieldReadModelV1: state?.fieldReadModelV1 ?? null,
    refresh,
  };
}
