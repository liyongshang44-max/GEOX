// GEOX/apps/web/src/views/AdminAcceptancePage.tsx
import React from "react";
import { postAdminAcceptanceCaf0091h } from "../lib/api";

export default function AdminAcceptancePage(): React.ReactElement {
  const [projectId, setProjectId] = React.useState("P_DEFAULT");
  const [groupId, setGroupId] = React.useState("G_CAF");
  const [sensorId, setSensorId] = React.useState("CAF009");
  const [running, setRunning] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [out, setOut] = React.useState<any | null>(null);

  async function run(): Promise<void> {
    setRunning(true);
    setErr(null);
    setOut(null);
    try {
      const r = await postAdminAcceptanceCaf0091h({ projectId, groupId, sensorId });
      setOut(r);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setRunning(false);
    }
  }

  const readmeUrl = out?.outputDir ? `/${String(out.outputDir).replace(/^\/+/, "")}/README.txt` : null;

  return (
    <div className="page">
      <h2>Admin · Acceptance (CAF009 / 1h)</h2>

      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label>
            projectId&nbsp;
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          </label>
          <label>
            groupId&nbsp;
            <input value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          </label>
          <label>
            sensorId&nbsp;
            <input value={sensorId} onChange={(e) => setSensorId(e.target.value)} />
          </label>

          <button className="btn" onClick={() => void run()} disabled={running}>
            {running ? "Running..." : "Run Acceptance"}
          </button>
        </div>
      </div>

      {err ? <div className="card" style={{ border: "1px solid #c33" }}><pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre></div> : null}

      {out ? (
        <div className="card">
          <div style={{ marginBottom: 8 }}>
            <b>Result:</b> {out.result}
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>OutputDir:</b> {out.outputDir}
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>points_present:</b> {out.points_present} &nbsp;
            <b>min_points_required:</b> {out.min_points_required} &nbsp;
            <b>expected_interval_ms:</b> {out.expected_interval_ms}
          </div>

          {readmeUrl ? (
            <div style={{ marginBottom: 8 }}>
              <a className="btn ghost" href={readmeUrl} target="_blank" rel="noreferrer">
                Open README.txt
              </a>
            </div>
          ) : null}

          <details>
            <summary>Raw response</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(out, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
