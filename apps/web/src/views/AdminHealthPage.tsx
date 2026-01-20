// GEOX/apps/web/src/views/AdminHealthPage.tsx
import React from "react";
import { fetchAdminHealthz } from "../lib/api";

export default function AdminHealthPage(): React.ReactElement {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<any | null>(null);

  async function run(): Promise<void> {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchAdminHealthz();
      setData(r);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void run();
  }, []);

  return (
    <div className="page">
      <h2>Admin · Healthz</h2>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => void run()} disabled={loading}>
          {loading ? "Checking..." : "Re-check"}
        </button>
      </div>

      {err ? <div className="card" style={{ border: "1px solid #c33" }}><pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre></div> : null}

      {data ? (
        <div className="card">
          <div style={{ marginBottom: 8 }}>
            <b>Status:</b> {data.ok ? "OK" : "NOT READY"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>DB:</b> {data.db?.ok ? "OK" : "FAIL"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>Missing Tables:</b> {Array.isArray(data.bootstrap?.missingTables) && data.bootstrap.missingTables.length ? data.bootstrap.missingTables.join(", ") : "<none>"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>Missing Views:</b> {Array.isArray(data.bootstrap?.missingViews) && data.bootstrap.missingViews.length ? data.bootstrap.missingViews.join(", ") : "<none>"}
          </div>
          <details>
            <summary>Raw</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
