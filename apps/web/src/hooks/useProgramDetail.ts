import React from "react";
import {
  fetchOperationStates,
  fetchProgramControlPlane,
  fetchProgramDetail,
} from "../api";
import {
  buildProgramDetailViewModel,
  type ProgramConsoleViewModel,
} from "../viewmodels/programDetailViewModel";

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
      setError("缺少 Program ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [detailData, controlPlaneData, opStates] = await Promise.all([
        fetchProgramDetail(id).catch(() => null),
        fetchProgramControlPlane(id).catch(() => null),
        fetchOperationStates({ limit: 100 }).catch(() => ({ items: [] } as any)),
      ]);

      const programOps = (opStates?.items || []).filter((item: any) => String(item?.program_id || "") === id);
      setDetail(detailData);
      setControlPlane(controlPlaneData);
      setOps(programOps);

      if (!detailData && !controlPlaneData) {
        setError("当前暂无 Program 详情数据");
      }
    } catch {
      setDetail(null);
      setControlPlane(null);
      setOps([]);
      setError("Program 详情加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const viewModel = React.useMemo(() => {
    if (!detail && !controlPlane) return null;
    return buildProgramDetailViewModel({
      programId,
      detail,
      controlPlane,
      ops,
    });
  }, [programId, detail, controlPlane, ops]);

  return { loading, error, viewModel, reload: load };
}
