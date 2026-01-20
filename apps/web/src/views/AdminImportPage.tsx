// GEOX/apps/web/src/views/AdminImportPage.tsx
import React from "react";
import { postAdminImportCafHourly, fetchAdminImportJob } from "../lib/api";

export default function AdminImportPage(): React.ReactElement {
  const [file, setFile] = React.useState<File | null>(null);
  const [projectId, setProjectId] = React.useState("P_DEFAULT");
  const [groupId, setGroupId] = React.useState("G_CAF");
  const [writeRawSamples, setWriteRawSamples] = React.useState("1");
  const [writeMarkers, setWriteMarkers] = React.useState("1");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<boolean>(false);

  async function start(): Promise<void> {
    if (!file) {
      setErr("Please choose a CAF Hourly .txt file first.");
      return;
    }
    setErr(null);
    setRunning(true);
    try {
      const r = await postAdminImportCafHourly({
        file,
        projectId,
        groupId,
        writeRawSamples,
        writeMarkers,
      });
      setJobId(r.jobId);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setRunning(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    async function poll(): Promise<void> {
      if (!jobId) return;
      try {
        const r = await fetchAdminImportJob(jobId);
        if (!alive) return;
        setJob(r.job);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
      }
    }
    void poll();
    const t = window.setInterval(() => void poll(), 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [jobId]);

  return (
    <div className="page">
      <h2>Admin · Import (CAF Hourly)</h2>
      <div className="card">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <b>File</b>
            <div>
              <input
                type="file"
                accept=".txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

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
              writeRawSamples&nbsp;
              <input value={writeRawSamples} onChange={(e) => setWriteRawSamples(e.target.value)} />
            </label>
            <label>
              writeMarkers&nbsp;
              <input value={writeMarkers} onChange={(e) => setWriteMarkers(e.target.value)} />
            </label>
          </div>

          <div>
            <button className="btn" onClick={() => void start()} disabled={running}>
              {running ? "Starting..." : "Start Import"}
            </button>
          </div>
        </div>
      </div>

      {err ? <div className="card" style={{ border: "1px solid #c33" }}><pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre></div> : null}

      {jobId ? (
        <div className="card">
          <div style={{ marginBottom: 8 }}>
            <b>jobId:</b> {jobId}
          </div>
          {job ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <b>state:</b> {job.state} &nbsp; <b>exitCode:</b> {String(job.exitCode)}
              </div>
              <details>
                <summary>stdout (tail)</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{job.stdoutTail || ""}</pre>
              </details>
              <details>
                <summary>stderr (tail)</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{job.stderrTail || ""}</pre>
              </details>
              <details>
                <summary>raw</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(job, null, 2)}</pre>
              </details>
            </>
          ) : (
            <div>Loading job status...</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
