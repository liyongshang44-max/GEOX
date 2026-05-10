import React from "react";
import {
  cleanFlightTableRun,
  createFlightTableRun,
  fetchFlightTableApiSnapshots,
  fetchFlightTableRuns,
  retryFlightTableStep,
  verifyFlightTableRun,
  type FlightTableApiSnapshotV1,
  type FlightTableLaneV1,
  type FlightTableRunV1,
} from "../../api/flightTable";
import { ApiError } from "../../api/client";
import { readTenantContext } from "../../auth/authStorage";
import FlightTableShell from "../../components/dev/flight-table/FlightTableShell";
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

export default function FlightTablePage(): React.ReactElement {
  const [run, setRun] = React.useState<FlightTableRunV1 | null>(null);
  const [snapshots, setSnapshots] = React.useState<FlightTableApiSnapshotV1[]>([]);
  const [runIdDraft, setRunIdDraft] = React.useState(defaultFlightTableRunId);
  const [laneDraft, setLaneDraft] = React.useState<FlightTableLaneV1>("success");
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
      applyRun(next);
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setLoading(false);
    }
  }, [applyRun, laneDraft, runIdDraft]);

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
      applyRun(await cleanFlightTableRun(run.run_id));
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
      onRunIdDraftChange={setRunIdDraft}
      onLaneDraftChange={setLaneDraft}
      onCreateRun={handleCreateRun}
      onVerify={handleVerify}
      onClean={handleClean}
      onRetryStep={handleRetryStep}
      loading={loading}
      error={error}
    />
  );
}
