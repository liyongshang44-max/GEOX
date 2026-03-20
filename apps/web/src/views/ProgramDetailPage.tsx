import React from "react";
import { useParams } from "react-router-dom";
import { fetchProgramDetail, readStoredAoActToken } from "../lib/api";

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [token] = React.useState(() => readStoredAoActToken());
  const [item, setItem] = React.useState<any>(null);

  React.useEffect(() => {
    const id = decodeURIComponent(programId);
    if (!id) return;
    fetchProgramDetail(token, id).then(setItem).catch(() => setItem(null));
  }, [programId, token]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Program Detail</h2>
        <div className="muted">{String(item?.program_id ?? decodeURIComponent(programId))}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>基本信息</h3>
        <div>Field: {String(item?.field_id ?? "-")}</div>
        <div>Season: {String(item?.season_id ?? "-")}</div>
        <div>Crop: {String(item?.crop_code ?? "-")}</div>
        <div>Variety: {String(item?.variety_code ?? "-")}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>目标与约束</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({
          goal_profile: item?.goal_profile ?? null,
          constraints: item?.constraints ?? null,
          budget: item?.budget ?? null,
          execution_policy: item?.execution_policy ?? null,
        }, null, 2)}</pre>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>经营时间线</h3>
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
        <h3 style={{ marginTop: 0 }}>当前状态</h3>
        <div>risk: {String(item?.current_risk_summary?.level ?? "-")}</div>
        <div>next action: {String(item?.pending_operation_plan?.status ?? "-")}</div>
        <div>evidence completeness: {item?.latest_acceptance_result ? "has acceptance" : "pending"}</div>
      </section>
    </div>
  );
}
