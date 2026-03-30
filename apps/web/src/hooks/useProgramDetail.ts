import React from "react";
import {
  fetchOperationStates,
  fetchProgramDetail,
} from "../api";
import {
  buildProgramDetailViewModel,
  type ProgramConsoleViewModel,
} from "../viewmodels/programDetailViewModel";

const unsupportedProgramDetailIds = new Set<string>();

export function useProgramDetail(programId: string): {
  loading: boolean;
  error: string | null;
  viewModel: ProgramConsoleViewModel | null;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [detail, setDetail] = React.useState<any>(null);
  const [controlPlane, setControlPlane] = React.useState<any>(null);
  const [ops, setOps] = React.useState<any[]>([]);

  const load = React.useCallback(async () => {
    const id = decodeURIComponent(programId || "").trim();
    if (!id) {
      setError("缺少经营方案 ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const detailData = unsupportedProgramDetailIds.has(id)
        ? null
        : await fetchProgramDetail(id).catch(() => {
          unsupportedProgramDetailIds.add(id);
          return null;
        });
      if (!detailData) {
        setDetail(null);
        setControlPlane(null);
        setOps([]);
        setError("经营方案详情加载失败，请稍后重试");
        return;
      }

      setDetail(detailData);
      setControlPlane(null);
      setOps([]);

      const [controlPlaneRes, opStatesRes] = await Promise.allSettled([
        Promise.resolve(null),
        fetchOperationStates({ limit: 100 }),
      ]);

      const controlPlaneData = controlPlaneRes.status === "fulfilled" ? controlPlaneRes.value : null;
      const opStates = opStatesRes.status === "fulfilled" ? opStatesRes.value : { items: [] as any[] };
      const programOps = (opStates?.items || []).filter((item: any) => String(item?.program_id || "") === id);

      setControlPlane(controlPlaneData ?? null);
      setOps(programOps);

      setError(null);
    } catch {
      setDetail(null);
      setControlPlane(null);
      setOps([]);
      setError("经营方案详情加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const viewModel = React.useMemo(() => {
    return buildProgramDetailViewModel({
      programId,
      detail: detail ?? {},
      controlPlane: controlPlane ?? {},
      ops,
    });
  }, [programId, detail, controlPlane, ops]);

  return { loading, error, viewModel, reload: load };
}
