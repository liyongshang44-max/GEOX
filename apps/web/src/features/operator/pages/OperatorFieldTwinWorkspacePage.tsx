// apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx
// Purpose: render the first view-only field-centered Operator Twin workspace.
// Boundary: this page separates Fact, Estimate, Forecast, Scenario, and Recommendation; it does not execute actions.

import React from "react";
import { Link, useParams } from "react-router-dom";

const STATE_LAYERS = [
  {
    layer: "Fact",
    title: "事实",
    body: "土壤水分观测窗口、天气预报版本和作业记录来自正式后端事实链。",
  },
  {
    layer: "Estimate",
    title: "估计",
    body: "当前 C8 水分状态可由 water_state_estimate_v1 表示为中度缺水。",
  },
  {
    layer: "Forecast",
    title: "预测",
    body: "短期预测窗口可展示能力边界；7d/30d 仍需后续 forecast_run_v1 固化。",
  },
  {
    layer: "Scenario",
    title: "情景",
    body: "后续情景比较必须包含 no_action、10mm、20mm、22mm、delay_3d 等方案。",
  },
  {
    layer: "Recommendation",
    title: "建议候选",
    body: "建议候选只能进入 recommendation / approval 链路，不能直接成为 AO-ACT task。",
  },
];

export default function OperatorFieldTwinWorkspacePage(): React.ReactElement {
  const params = useParams();
  const fieldId = String(params.fieldId ?? "").trim() || "unknown-field";

  return (
    <section className="customerReportPage" data-surface="operator-twin" data-page="operator-field-twin-workspace">
      <div className="customerReportHero">
        <div>
          <p className="customerEyebrow">Field Twin Workspace</p>
          <h2>地块 Twin 工作区</h2>
          <p>
            当前地块：<strong>{fieldId}</strong>。本页按事实、估计、预测、情景和建议候选分层展示，
            避免把预测或情景误认为已批准作业。
          </p>
        </div>
        <div className="customerReportHeroActions">
          <Link className="customerSecondaryButton" to="/operator/twin">返回 Twin 总览</Link>
        </div>
      </div>

      <div className="customerSectionGrid">
        {STATE_LAYERS.map((item) => (
          <article className="customerCard" key={item.layer} data-layer={item.layer}>
            <p className="customerEyebrow">{item.layer}</p>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}

        <article className="customerCard">
          <h3>只读动作边界</h3>
          <p>
            H18-B 仅建立 Operator Twin 壳。提交情景、生成 recommendation、审批和执行均未开放。
          </p>
          <ul className="customerList">
            <li>不能直接创建 AO-ACT task</li>
            <li>不能 dispatch</li>
            <li>不能绕过 approval</li>
            <li>不能把 scenario 当作 task</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
