import React from "react";
import { Link } from "react-router-dom";
import { listSkillRegistry, listSkillRuns, resolveSkillClassification, type SkillRegistryItem, type SkillRunSummary } from "../../../api/skills";
import { SectionCard, StatusPill } from "../../../shared/ui";
import { buildSkillOverviewMetrics } from "./SkillOverview.metrics";

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

  const metrics = React.useMemo(() => buildSkillOverviewMetrics(items, runs), [items, runs]);

  return (
    <SectionCard title="SkillOverview" subtitle="技能资产总体状态（标准枚举）：ACTIVE/DISABLED、版本同步、最近运行健康度。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {metrics.map((metric) => {
          const passed = metric.value >= metric.threshold;
          return (
            <div key={metric.key} className="decisionItemStatic">
              <div className="decisionItemTitle">{metric.label}</div>
              <div className="decisionItemMeta">{metric.value} {metric.unit}</div>
              <div className="decisionItemMeta" style={{ marginTop: 4 }}>
                阈值 {`>=${metric.threshold}`} · {passed ? "满足" : "未满足"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.slice(0, 5).map((item) => (
          <StatusPill key={item.skill_id} tone={String(item.status).toUpperCase() === "ACTIVE" ? "success" : "warning"}>
            {item.skill_name || item.skill_id} · {resolveSkillClassification(item)} · {item.current_version || "-"}
          </StatusPill>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><Link className="btn" to="/skills/registry">进入技能注册中心</Link></div>
    </SectionCard>
  );
}
