import React from "react";
import { Link } from "react-router-dom";
import { listSkillRegistry, listSkillRuns, type SkillRegistryItem, type SkillRunSummary } from "../../../api/skills";
import { SectionCard, StatusPill } from "../../../shared/ui";

export default function SkillOverview(): React.ReactElement {
  const [items, setItems] = React.useState<SkillRegistryItem[]>([]);
  const [runs, setRuns] = React.useState<SkillRunSummary[]>([]);

  React.useEffect(() => {
    let mounted = true;
    void listSkillRegistry({ limit: 20 }).then((res) => {
      if (mounted) setItems(res);
    }).catch(() => {
      if (mounted) setItems([]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void listSkillRuns({ limit: 120 }).then((res) => {
      if (mounted) setRuns(res);
    }).catch(() => {
      if (mounted) setRuns([]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeCount = items.filter((item) => String(item.status).toUpperCase() === "ACTIVE").length;
  const latestVersionCount = items.filter((item) => item.current_version && item.latest_version && item.current_version === item.latest_version).length;
  const successCount = runs.filter((run) => ["SUCCESS", "SUCCEEDED", "PASS"].includes(String(run.status).toUpperCase())).length;
  const failedCount = runs.filter((run) => ["FAILED", "ERROR", "TIMEOUT"].includes(String(run.status).toUpperCase())).length;
  const abnormalSkillCount = new Set(
    runs
      .filter((run) => ["FAILED", "ERROR", "TIMEOUT"].includes(String(run.status).toUpperCase()))
      .map((run) => String(run.skill_id ?? "").trim())
      .filter(Boolean),
  ).size;

  return (
    <SectionCard title="SkillOverview" subtitle="技能资产总体状态（标准枚举）：ACTIVE/DISABLED、版本同步、最近运行健康度。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        <div className="decisionItemStatic"><div className="decisionItemTitle">已注册技能</div><div className="decisionItemMeta">{items.length} 项</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">激活中</div><div className="decisionItemMeta">{activeCount} 项</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">版本已对齐最新</div><div className="decisionItemMeta">{latestVersionCount} 项</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">运行成功</div><div className="decisionItemMeta">{successCount} 次</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">运行失败</div><div className="decisionItemMeta">{failedCount} 次</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">异常 skill 数</div><div className="decisionItemMeta">{abnormalSkillCount} 项</div></div>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.slice(0, 5).map((item) => (
          <StatusPill key={item.skill_id} tone={String(item.status).toUpperCase() === "ACTIVE" ? "success" : "warning"}>
            {item.skill_name || item.skill_id} · {item.current_version || "-"}
          </StatusPill>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><Link className="btn" to="/skills/registry">进入技能注册中心</Link></div>
    </SectionCard>
  );
}
