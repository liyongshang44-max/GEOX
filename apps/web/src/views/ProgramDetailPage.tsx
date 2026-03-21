import React from "react";
import { useParams } from "react-router-dom";
import { fetchProgramCost, fetchProgramDetail, fetchProgramEfficiency, fetchProgramSla, fetchProgramTrajectories, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [token] = React.useState(() => readStoredAoActToken());
  const [locale] = React.useState<Locale>(() => resolveLocale());
  const tt = React.useCallback((key: string) => t(locale, key), [locale]);
  const [item, setItem] = React.useState<any>(null);
  const [trajectories, setTrajectories] = React.useState<any[]>([]);
  const [cost, setCost] = React.useState<any>(null);
  const [sla, setSla] = React.useState<any>(null);
  const [efficiency, setEfficiency] = React.useState<any>(null);

  React.useEffect(() => {
    const id = decodeURIComponent(programId);
    if (!id) return;
    Promise.all([
      fetchProgramDetail(token, id).catch(() => null),
      fetchProgramTrajectories(token, id).catch(() => []),
      fetchProgramCost(token, id).catch(() => null),
      fetchProgramSla(token, id).catch(() => null),
      fetchProgramEfficiency(token, id).catch(() => null),
    ]).then(([detail, traj, costData, slaData, efficiencyData]) => {
      setItem(detail);
      setTrajectories(traj);
      setCost(costData);
      setSla(slaData);
      setEfficiency(efficiencyData);
    }).catch(() => {
      setItem(null);
      setTrajectories([]);
      setCost(null);
      setSla(null);
      setEfficiency(null);
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

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>成本（Cost）</h3>
        <div>total: {cost?.total_cost != null ? Number(cost.total_cost).toFixed(2) : "-"} {String(cost?.currency ?? "")}</div>
        <div>records: {String(cost?.record_count ?? "-")}</div>
        <div>water_l: {String(cost?.resource_usage_totals?.water_l ?? "-")}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>SLA</h3>
        <div>compliance: {sla?.compliance_rate != null ? `${(Number(sla.compliance_rate) * 100).toFixed(1)}%` : "-"}</div>
        <div>met/breach: {String(sla?.met_checks ?? "-")} / {String(sla?.breach_checks ?? "-")}</div>
        <div>latest: {String(sla?.latest_status ?? "-")} {sla?.latest_sla_name ? `(${String(sla.latest_sla_name)})` : ""}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>效率（Efficiency）</h3>
        <div>data status: {String(efficiency?.data_status ?? "-")}</div>
        <div>efficiency index: {efficiency?.efficiency_index != null ? Number(efficiency.efficiency_index).toFixed(3) : "-"}</div>
        <div>cost efficiency: {efficiency?.cost_efficiency_score != null ? Number(efficiency.cost_efficiency_score).toFixed(3) : "-"}</div>
        <div>sla compliance rate: {efficiency?.sla_compliance_rate != null ? Number(efficiency.sla_compliance_rate).toFixed(3) : "-"}</div>
      </section>
    </div>
  );
}
