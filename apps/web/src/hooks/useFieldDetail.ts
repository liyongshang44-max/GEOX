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
  const [state, setState] = React.useState<{
    detail: any;
    activeOperations: any[];
    recentRecommendations: any[];
    currentProgram: any;
    programsBySeason: Array<{ season_id: string; count: number; programs: any[] }>;
  } | null>(null);

  const refresh = React.useCallback(async () => {
    if (!fieldId) return;
    setBusy(true);
    setStatus(lang === "zh" ? "加载中..." : "Loading...");
    try {
      const [detail, ops, recs, currentProgram, geometryRes, bySeason] = await Promise.all([
        fetchFieldDetail(fieldId),
        fetchOperationStates({ field_id: fieldId, limit: 20 }),
        fetchAgronomyRecommendations({ limit: 30 }),
        fetchFieldCurrentProgram(fieldId).catch(() => null),
        fetchFieldGeometry(fieldId).catch(() => null),
        fetchFieldProgramsBySeason(fieldId).catch(() => []),
      ]);
      const stableGeometry = geometryRes?.geometry ?? detail?.geometry ?? null;
      setState({
        detail: { ...detail, geometry: stableGeometry },
        activeOperations: (ops.items ?? []).filter((x) => !["SUCCESS", "FAILED"].includes(String(x.final_status))),
        recentRecommendations: (recs.items ?? []).filter((x) => String(x.field_id ?? "") === fieldId).slice(0, 8),
        currentProgram,
        programsBySeason: Array.isArray(bySeason) ? bySeason : [],
      });
      setStatus(lang === "zh" ? "加载成功" : "Loaded");
    } catch (e: any) {
      setStatus(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [fieldId, lang]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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
