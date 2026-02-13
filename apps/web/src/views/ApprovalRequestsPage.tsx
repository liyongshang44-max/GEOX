// GEOX/apps/web/src/views/ApprovalRequestsPage.tsx

import React from "react";

type ApiItem = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: any;
};

export default function ApprovalRequestsPage(): React.ReactElement {
  const [token, setToken] = React.useState<string>(() => {
    try {
      return localStorage.getItem("geox_ao_act_token") || "dev_ao_act_admin_v0";
    } catch {
      return "dev_ao_act_admin_v0";
    }
  });

  const [tenantId, setTenantId] = React.useState<string>("tenantA");
  const [projectId, setProjectId] = React.useState<string>("projectA");
  const [groupId, setGroupId] = React.useState<string>("groupA");

  const [issuer, setIssuer] = React.useState<string>("human");
  const [actionType, setActionType] = React.useState<string>("IRRIGATE");
  const [target, setTarget] = React.useState<string>("plotA");
  const [startTs, setStartTs] = React.useState<string>(() => String(Date.now() - 60_000));
  const [endTs, setEndTs] = React.useState<string>(() => String(Date.now() + 60_000));

  const [items, setItems] = React.useState<ApiItem[]>([]);
  const [status, setStatus] = React.useState<string>("");

  function authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  async function refresh(): Promise<void> {
    setStatus("Loading...");
    try {
      const u = `/api/control/approval_request/v1/requests?tenant_id=${encodeURIComponent(tenantId)}&project_id=${encodeURIComponent(
        projectId
      )}&group_id=${encodeURIComponent(groupId)}&limit=50`;
      const resp = await fetch(u, { headers: { ...authHeader() } });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP_${resp.status}`);
      setItems(j.items || []);
      setStatus("OK");
    } catch (e: any) {
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }

  async function createRequest(): Promise<void> {
    setStatus("Creating...");
    try {
      try {
        localStorage.setItem("geox_ao_act_token", token);
      } catch {
        // ignore
      }

      const body = {
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
        meta: { note: "created from ApprovalRequestsPage" }
      };

      const resp = await fetch(`/api/control/approval_request/v1/request`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify(body)
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP_${resp.status}`);
      setStatus(`Created request_id=${j.request_id}`);
      await refresh();
    } catch (e: any) {
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }

  async function approve(requestId: string): Promise<void> {
    setStatus(`Approving ${requestId}...`);
    try {
      const resp = await fetch(`/api/control/approval_request/v1/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify({ request_id: requestId })
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP_${resp.status}`);
      setStatus(`Approved: act_task_id=${j.act_task_id}`);
      await refresh();
    } catch (e: any) {
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <h2>Approval Requests (v1)</h2>
      <p className="muted">
        Sprint 25: human-in-the-loop approval runtime v1. Requires AO-ACT token (scopes: ao_act.index.read, ao_act.task.write).
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
          <button className="btn" onClick={() => void createRequest()}>
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
                    <button className="btn" onClick={() => void approve(rid)} disabled={!rid || st !== "PENDING"}>
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
