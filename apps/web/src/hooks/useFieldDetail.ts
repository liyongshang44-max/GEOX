import React from "react";
import { fetchFieldCurrentProgram, fetchFieldDetail, fetchFieldGeometry, fetchFieldProgramsBySeason } from "../api/fields";
import { fetchOperationStates } from "../api/operations";
import { fetchAgronomyRecommendations } from "../api/programs";
import { buildFieldDetailViewModel } from "../viewmodels/fieldDetailViewModel";
import type { FieldLang } from "../lib/fieldViewModel";

export function useFieldDetail(params: {
  fieldId: string;
  lang: FieldLang;
  labels: any;
  playbackTs: number;
}): {
  busy: boolean;
  status: string;
  model: ReturnType<typeof buildFieldDetailViewModel> | null;
  refresh: () => Promise<void>;
} {
  const { fieldId, lang, labels, playbackTs } = params;
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [state, setState] = React.useState<any>(null);

  const refresh = React.useCallback(async () => {
    if (!fieldId) return;
    setBusy(true);
    setStatus(lang === "zh" ? "正在加载田块视图…" : "Loading...");

    const [detailRes, opsRes, recsRes, currentRes, geometryRes, bySeasonRes] = await Promise.allSettled([
      fetchFieldDetail(fieldId),
      fetchOperationStates({ field_id: fieldId, limit: 20 }),
      fetchAgronomyRecommendations({ limit: 30 }),
      fetchFieldCurrentProgram(fieldId),
      fetchFieldGeometry(fieldId),
      fetchFieldProgramsBySeason(fieldId),
    ]);

    const detail = detailRes.status === "fulfilled" ? detailRes.value : {
      field: { field_id: fieldId, name: fieldId, area_ha: null, status: "UNKNOWN" },
      latest_season: null,
      summary: { device_count: 0 },
      geometry: null,
    };
    const geometry = geometryRes.status === "fulfilled" ? geometryRes.value?.geometry : null;

    setState({
      detail: { ...detail, geometry: geometry ?? detail?.geometry ?? null },
      activeOperations: opsRes.status === "fulfilled" ? (opsRes.value.items ?? []).filter((x) => !["SUCCESS", "FAILED"].includes(String(x.final_status))) : [],
      recentRecommendations: recsRes.status === "fulfilled" ? (recsRes.value.items ?? []).filter((x) => String(x.field_id ?? "") === fieldId).slice(0, 8) : [],
      currentProgram: currentRes.status === "fulfilled" ? currentRes.value : null,
      programsBySeason: bySeasonRes.status === "fulfilled" && Array.isArray(bySeasonRes.value) ? bySeasonRes.value : [],
    });

    const detailFail = detailRes.status === "rejected";
    if (detailFail) {
      setStatus(lang === "zh" ? "田块详情暂不可读，已展示可用数据。" : "Partial data loaded.");
    } else {
      setStatus(lang === "zh" ? "加载成功" : "Loaded");
    }

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

  return { busy, status, model, refresh };
}
