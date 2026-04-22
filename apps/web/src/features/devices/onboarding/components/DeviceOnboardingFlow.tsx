import React from "react";
import { SectionCard } from "../../../../shared/ui";
import { ONBOARDING_STEPS } from "../mockFlow";

type Props = {
  sourceType: "simulator" | "physical";
};

export default function DeviceOnboardingFlow({ sourceType }: Props): React.ReactElement {
  return (
    <SectionCard title="折叠帮助区 / 步骤说明区">
      <details open>
        <summary>接入帮助（skill-first）</summary>
        <div className="metaText" style={{ marginTop: 8 }}>
          本页主交互聚焦“载体为 skill 提供输入”，此区域仅用于补充排错建议与步骤说明。
        </div>
        <div className="metaText" style={{ marginTop: 6 }}>
          当前 source_type：<code>{sourceType}</code>
        </div>
      </details>

      <details style={{ marginTop: 12 }}>
        <summary>步骤说明（不作为主交互骨架）</summary>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {ONBOARDING_STEPS.map((step) => (
            <div key={step.key} className="decisionItemStatic">
              <div className="decisionItemTitle">{step.title}</div>
              <div className="decisionItemMeta">{step.description}</div>
              <div className="decisionItemMeta">排查建议：{step.troubleshooting}</div>
            </div>
          ))}
        </div>
      </details>
    </SectionCard>
  );
}
