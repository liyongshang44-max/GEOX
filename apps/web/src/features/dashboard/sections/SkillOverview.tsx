import React from "react";
import { Link } from "react-router-dom";
import { listSkillRegistry, type SkillRegistryItem } from "../../../api/skills";
import { SectionCard, StatusPill } from "../../../shared/ui";

export default function SkillOverview(): React.ReactElement {
  const [items, setItems] = React.useState<SkillRegistryItem[]>([]);

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

  const activeCount = items.filter((item) => String(item.status).toUpperCase() === "ACTIVE").length;
  const latestVersionCount = items.filter((item) => item.current_version && item.latest_version && item.current_version === item.latest_version).length;

  return (
    <SectionCard title="SkillOverview" subtitle="技能资产总体状态：状态、版本同步、最近运行健康度。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        <div className="decisionItemStatic"><div className="decisionItemTitle">已注册技能</div><div className="decisionItemMeta">{items.length} 项</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">激活中</div><div className="decisionItemMeta">{activeCount} 项</div></div>
        <div className="decisionItemStatic"><div className="decisionItemTitle">版本已对齐最新</div><div className="decisionItemMeta">{latestVersionCount} 项</div></div>
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
