import React from "react";
import { Link } from "react-router-dom";
import { listSkillRuns, type SkillRunSummary } from "../../../api/skills";
import { SectionCard, StatusPill } from "../../../shared/ui";

export default function SkillAffectedOperations(): React.ReactElement {
  const [runs, setRuns] = React.useState<SkillRunSummary[]>([]);

  React.useEffect(() => {
    let mounted = true;
    void listSkillRuns({ limit: 30 }).then((res) => {
      if (mounted) setRuns(res);
    }).catch(() => {
      if (mounted) setRuns([]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const failedRuns = runs.filter((run) => String(run.status).toUpperCase() === "FAILED");

  return (
    <SectionCard title="SkillAffectedOperations" subtitle="近 30 次技能运行对作业链路的影响追踪。">
      {!runs.length ? <div className="muted">暂无技能运行数据。</div> : null}
      <div className="decisionList" style={{ marginTop: 8 }}>
        {runs.slice(0, 6).map((run) => (
          <div key={run.run_id} className="decisionItemStatic" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="decisionItemTitle">{run.skill_id}</div>
              <div className="decisionItemMeta">{run.run_id} · 版本 {run.version || "-"} · 范围 {run.scope || "-"}</div>
            </div>
            <StatusPill tone={String(run.status).toUpperCase() === "SUCCESS" ? "success" : String(run.status).toUpperCase() === "RUNNING" ? "warning" : "danger"}>{run.status}</StatusPill>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <span className="muted">失败运行：</span>
        <strong>{failedRuns.length}</strong>
      </div>
      <div style={{ marginTop: 10 }}><Link className="btn" to="/skills/runs">查看运行详情</Link></div>
    </SectionCard>
  );
}
