import React from "react";
import { Link } from "react-router-dom";
import { listSkillBindings, type SkillBindingItem } from "../../../api/skills";
import { SectionCard, StatusPill } from "../../../shared/ui";

export default function MissingSkillCoverage(): React.ReactElement {
  const [bindings, setBindings] = React.useState<SkillBindingItem[]>([]);

  React.useEffect(() => {
    let mounted = true;
    void listSkillBindings({ limit: 50 }).then((res) => {
      if (mounted) setBindings(res);
    }).catch(() => {
      if (mounted) setBindings([]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const missing = bindings.filter((item) => !item.version || String(item.status).toUpperCase() !== "ACTIVE");
  const grouped = missing.reduce<Record<string, number>>((acc, item) => {
    const key = item.scope || "UNKNOWN";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <SectionCard title="MissingSkillCoverage" subtitle="识别缺失或未激活绑定，优先补齐覆盖盲区。">
      {!missing.length ? <div className="muted">当前未发现明显覆盖缺口。</div> : null}
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(grouped).map(([scope, count]) => (
          <StatusPill key={scope} tone="warning">{scope}: {count}</StatusPill>
        ))}
      </div>
      <div className="decisionList" style={{ marginTop: 8 }}>
        {missing.slice(0, 6).map((item) => (
          <div key={item.binding_id} className="decisionItemStatic">
            <div className="decisionItemTitle">{item.skill_id}</div>
            <div className="decisionItemMeta">范围 {item.scope} · 版本 {item.version || "-"} · 状态 {item.status}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><Link className="btn" to="/skills/bindings">补齐技能覆盖</Link></div>
    </SectionCard>
  );
}
