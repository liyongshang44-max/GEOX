// GEOX/apps/web/src/views/ApprovalRequestsPage.tsx

import React from "react";
import { fetchAuthMe } from "../api";
import { approveApprovalRequest, createApprovalRequest, fetchApprovalRequests, type ApprovalRequestItem } from "../api/operations";
import { useSession } from "../auth/useSession";

export default function ApprovalRequestsPage(): React.ReactElement {
  const { token, setToken } = useSession();

  const [tenantId, setTenantId] = React.useState<string>("tenantA");
  const [projectId, setProjectId] = React.useState<string>("projectA");
  const [groupId, setGroupId] = React.useState<string>("groupA");

  const [issuer, setIssuer] = React.useState<string>("human");
  const [actionType, setActionType] = React.useState<string>("IRRIGATE");
  const [target, setTarget] = React.useState<string>("plotA");
  const [startTs, setStartTs] = React.useState<string>(() => String(Date.now() - 60_000));
  const [endTs, setEndTs] = React.useState<string>(() => String(Date.now() + 60_000));

  const [items, setItems] = React.useState<ApprovalRequestItem[]>([]);
  const [status, setStatus] = React.useState<string>("");
  const [role, setRole] = React.useState<string>("admin");

  const refresh = React.useCallback(async (): Promise<void> => {
    setStatus("Loading...");
    try {
      const result = await fetchApprovalRequests({
        tenant_id: tenantId,
        project_id: projectId,
        group_id: groupId,
        limit: 50,
      });
      setItems(result);
      setStatus("OK");
    } catch (e: any) {
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }, [tenantId, projectId, groupId]);

  async function createRequest(): Promise<void> {
    setStatus("Creating...");
    try {
      if (role === "operator") throw new Error("当前操作员角色不能发起或审批请求");

      const result = await createApprovalRequest({
        tenant_id: tenantId,
        project_id: projectId,
        group_id: groupId,
        issuer,
        action_type: actionType,
        target,
        time_window: { start_ts: Number(startTs), end_ts: Number(endTs) },
        parameter_schema: { keys: [] },
        parameters: {},
        constraints: {},
        meta: { note: "created from ApprovalRequestsPage" },
      });
      if (!result?.ok) throw new Error(result?.error || "REQUEST_FAILED");
      setStatus(`Created request_id=${result.request_id}`);
      await refresh();
    } catch (e: any) {
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }

  async function approve(requestId: string): Promise<void> {
    if (role === "operator") { setStatus("当前操作员角色不能审批"); return; }
    setStatus(`Approving ${requestId}...`);
    try {
      const result = await approveApprovalRequest(requestId);
      if (!result?.ok) throw new Error(result?.error || "APPROVE_FAILED");
      setStatus(`Approved: act_task_id=${result.act_task_id}`);
      await refresh();
    } catch (e: any) {
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }

  React.useEffect(() => {
    fetchAuthMe().then((me) => setRole(me.role)).catch(() => setRole("admin"));
    void refresh();
  }, [refresh]);

  return (
    <div className="page">
      <h2>Approval Requests (v1)</h2>
      <p className="muted">
        Sprint 25: human-in-the-loop approval runtime v1。当前角色：{role === "operator" ? "操作员" : "管理员"}。操作员不可审批。
      </p>

      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="field">
            Token
            <input value={token} onChange={(e) => setToken(e.target.value)} style={{ width: 260 }} />
          </label>
          <label className="field">
            tenant_id
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          </label>
          <label className="field">
            project_id
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          </label>
          <label className="field">
            group_id
            <input value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          </label>
          <button className="btn" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Create request</h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="field">
            issuer
            <input value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          </label>
          <label className="field">
            action_type
            <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
              <option value="PLOW">PLOW</option>
              <option value="HARROW">HARROW</option>
              <option value="SEED">SEED</option>
              <option value="SPRAY">SPRAY</option>
              <option value="IRRIGATE">IRRIGATE</option>
              <option value="TRANSPORT">TRANSPORT</option>
              <option value="HARVEST">HARVEST</option>
            </select>
          </label>
          <label className="field">
            target
            <input value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="field">
            start_ts
            <input value={startTs} onChange={(e) => setStartTs(e.target.value)} style={{ width: 180 }} />
          </label>
          <label className="field">
            end_ts
            <input value={endTs} onChange={(e) => setEndTs(e.target.value)} style={{ width: 180 }} />
          </label>
          <button className="btn" onClick={() => void createRequest()} disabled={role === "operator"}>
            Create
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="muted">
        {status}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Requests</h3>
        <table className="table">
          <thead>
            <tr>
              <th>occurred_at</th>
              <th>request_id</th>
              <th>status</th>
              <th>action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const payload = it.record_json?.payload ?? {};
              const rid = String(payload.request_id ?? "");
              const st = String(payload.status ?? "");
              return (
                <tr key={it.fact_id}>
                  <td>{it.occurred_at}</td>
                  <td>{rid}</td>
                  <td>{st}</td>
                  <td>
                    <button className="btn" onClick={() => void approve(rid)} disabled={role === "operator" || !rid || st !== "PENDING"}>
                      Approve + Issue AO-ACT
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
