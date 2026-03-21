import React from "react";
import { useParams } from "react-router-dom";
import { fetchProgramDetail, fetchProgramTrajectories, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [token] = React.useState(() => readStoredAoActToken());
  const [locale] = React.useState<Locale>(() => resolveLocale());
  const tt = React.useCallback((key: string) => t(locale, key), [locale]);
  const [item, setItem] = React.useState<any>(null);
  const [trajectories, setTrajectories] = React.useState<any[]>([]);

  React.useEffect(() => {
    const id = decodeURIComponent(programId);
    if (!id) return;
    Promise.all([
      fetchProgramDetail(token, id).catch(() => null),
      fetchProgramTrajectories(token, id).catch(() => []),
    ]).then(([detail, traj]) => {
      setItem(detail);
      setTrajectories(traj);
    }).catch(() => {
      setItem(null);
      setTrajectories([]);
    });
  }, [programId, token]);

  const trajectoryReadyCount = trajectories.filter((x: any) => Number(x?.payload?.point_count ?? 0) > 0).length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>{tt("program.title")}</h2>
        <div className="muted">{String(item?.program_id ?? decodeURIComponent(programId))}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.basic")}</h3>
        <div>Field: {String(item?.field_id ?? "-")}</div>
        <div>Season: {String(item?.season_id ?? "-")}</div>
        <div>Crop: {String(item?.crop_code ?? "-")}</div>
        <div>Variety: {String(item?.variety_code ?? "-")}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.goals")}</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({
          goal_profile: item?.goal_profile ?? null,
          constraints: item?.constraints ?? null,
          budget: item?.budget ?? null,
          execution_policy: item?.execution_policy ?? null,
        }, null, 2)}</pre>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.timeline")}</h3>
        <ul>
          <li>recommendation: {String(item?.latest_recommendation?.recommendation_id ?? "-")}</li>
          <li>approval: {String(item?.pending_operation_plan?.approval_request_id ?? "-")}</li>
          <li>plan: {String(item?.pending_operation_plan?.operation_plan_id ?? "-")}</li>
          <li>task: {String(item?.pending_operation_plan?.act_task_id ?? "-")}</li>
          <li>acceptance: {String(item?.latest_acceptance_result?.verdict ?? "-")}</li>
          <li>export: {String(item?.latest_evidence?.artifact_uri ?? "-")}</li>
        </ul>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.status")}</h3>
        <div>risk: {String(item?.current_risk_summary?.level ?? "-")}</div>
        <div>next action: {String(item?.pending_operation_plan?.status ?? "-")}</div>
        <div>evidence completeness: {item?.latest_acceptance_result ? "has acceptance" : "pending"}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.spatialSummary")}</h3>
        <div>{tt("operation.gis.in_field_ratio")}: {item?.latest_acceptance_result?.metrics?.in_field_ratio != null ? Number(item.latest_acceptance_result.metrics.in_field_ratio).toFixed(3) : "-"}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.trajectorySummary")}</h3>
        <div>{tt("program.trajectoryTasks")}: {trajectories.length}</div>
        <div>{tt("program.trajectoryReady")}: {trajectoryReadyCount}</div>
        <div>{tt("program.trajectoryPending")}: {Math.max(0, trajectories.length - trajectoryReadyCount)}</div>
      </section>
    </div>
  );
}
