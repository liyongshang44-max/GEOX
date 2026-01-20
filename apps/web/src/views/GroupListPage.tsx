// GEOX/apps/web/src/views/GroupListPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SensorGroupV1 } from "../lib/contracts";
import { ApiError, fetchGroups } from "../lib/api";

export default function GroupListPage(): React.ReactElement {
  const [projectId] = useState<string>("P_DEFAULT");
  const [groups, setGroups] = useState<SensorGroupV1[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(() => ({ projectId: projectId.trim() || undefined }), [projectId]);

  async function load(): Promise<void> {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetchGroups(query);
      setGroups(res.groups);
    } catch (e) {
      // Keep wording neutral; this page should not ask the user to think like an API client.
      setGroups([]);
      setErr(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Attempt default projectId first.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid">
      <div className="card section">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h2">Apple I · Monitor</div>
            <div className="muted">先选“地”（group），系统会给出默认的事实视图。</div>
          </div>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Reload"}
          </button>
        </div>

        <div style={{ marginTop: 12 }} className="row">
          <div className="pill">
            <span className="muted">当前项目</span>
            <span className="mono">{projectId}</span>
          </div>
          <div className="muted">选择一块地（group）开始查看事实。</div>
        </div>

        {err ? <div className="error" style={{ marginTop: 10 }}>{err}</div> : null}
      </div>

      <div className="card section">
        <div className="h2">Groups</div>
        <div className="list" style={{ marginTop: 10 }}>
          {groups.length === 0 ? (
            <div className="muted">No groups returned.</div>
          ) : (
groups.map((g) => (
  <Link key={g.groupId} to={`/group/${encodeURIComponent(g.groupId)}`}>
    <div className="item">
      <div>
        <div className="title mono">{g.groupId}</div>
        <div className="meta">
          <span>
            project: <span className="mono">{g.subjectRef.projectId}</span>
          </span>
          <span>
            sensors: <span className="mono">{g.sensors.length}</span>
          </span>
        </div>
      </div>
      <div className="btn">Open</div>
    </div>
  </Link>
))
          )}
        </div>
      </div>
    </div>
  );
}
