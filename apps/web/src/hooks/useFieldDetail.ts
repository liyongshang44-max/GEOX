import React from "react";
import { fetchFieldControlPlane, fetchFieldCurrentProgram, fetchFieldDetail, fetchFieldGeometry, fetchFieldProgramsBySeason, type FieldControlPlaneItem } from "../api/fields";
import { fetchOperationStates } from "../api/operations";
import { fetchAgronomyRecommendations } from "../api/programs";
import { buildFieldDetailViewModel } from "../viewmodels/fieldDetailViewModel";
import type { FieldLang } from "../lib/fieldViewModel";

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

export function useFieldDetail(params: {
  fieldId: string;
  lang: FieldLang;
  labels: any;
  playbackTs: number;
}): {
  busy: boolean;
  status: string;
  error: string | null;
  technical: string | null;
  model: ReturnType<typeof buildFieldDetailViewModel> | null;
  refresh: () => Promise<void>;
} {
  const { fieldId, lang, labels, playbackTs } = params;
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [state, setState] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [technical, setTechnical] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!fieldId) return;
    setBusy(true);
    setError(null);
    setTechnical(null);
    setStatus(lang === "zh" ? "正在加载田块视图…" : "Loading...");

    let detail: any = null;
    let controlPlaneHit = false;
    const cp = await fetchFieldControlPlane(fieldId);
    if (cp?.field || cp?.overview || cp?.summary) {
      detail = mapControlPlaneToLegacyDetail(fieldId, cp);
      controlPlaneHit = true;
    }
    if (!detail) {
      detail = await fetchFieldDetail(fieldId);
    }

    const [opsRes, recsRes, currentRes, geometryRes, bySeasonRes] = await Promise.allSettled([
      fetchOperationStates({ field_id: fieldId, limit: 20 }),
      fetchAgronomyRecommendations({ limit: 30 }),
      fetchFieldCurrentProgram(fieldId),
      fetchFieldGeometry(fieldId),
      fetchFieldProgramsBySeason(fieldId),
    ]);

    if (!detail) {
      detail = {
        field: { field_id: fieldId, name: fieldId, area_ha: null, status: "UNKNOWN" },
        latest_season: null,
        summary: { device_count: 0 },
        geometry: null,
      };
    }

    const geometry = geometryRes.status === "fulfilled" ? (geometryRes.value?.geometry ?? geometryRes.value) : null;
    const activeOperations = opsRes.status === "fulfilled" ? (opsRes.value.items ?? []).filter((x) => !["SUCCESS", "FAILED"].includes(String(x.final_status))) : [];
    const recommendations = recsRes.status === "fulfilled" ? (recsRes.value.items ?? []).filter((x) => String(x.field_id ?? "") === fieldId).slice(0, 8) : [];
    const currentProgram = currentRes.status === "fulfilled" ? (currentRes.value ?? null) : null;
    const programsBySeason = bySeasonRes.status === "fulfilled" && Array.isArray(bySeasonRes.value) ? bySeasonRes.value : [];
    const latestEvidence = (detail as any)?.latestEvidence || (detail as any)?.latest_evidence || (detail as any)?.recent_receipts?.[0]?.receipt?.payload || null;

    setState({
      field: detail?.field ?? null,
      geometry: geometry ?? detail?.geometry ?? null,
      currentProgram,
      controlPlane: cp ?? null,
      operations: activeOperations,
      recommendations,
      latestEvidence,
      error: null,
      detail: { ...detail, geometry: geometry ?? detail?.geometry ?? null, latestEvidence },
      activeOperations,
      recentRecommendations: recommendations,
      programsBySeason,
    });

    setError(null);
    setTechnical(null);
    setStatus(controlPlaneHit ? "已通过聚合接口加载" : (lang === "zh" ? "已加载（缺失接口已自动降级）" : "Loaded with fallbacks"));

    setBusy(false);
  }, [fieldId, lang]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const model = React.useMemo(() => {
    if (!state) return null;
    return buildFieldDetailViewModel({
      detail: state.detail,
      labels,
      lang,
      activeOperations: state.activeOperations,
      recentRecommendations: state.recentRecommendations,
      currentProgram: state.currentProgram,
      programsBySeason: state.programsBySeason,
      playbackTs,
    });
  }, [state, labels, lang, playbackTs]);

  return { busy, status, error, technical, model, refresh };
}
