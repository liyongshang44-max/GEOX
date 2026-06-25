// apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx
// Purpose: render the H52 Operator Evidence Twin read-only page skeleton for the Water Stress Loop P0.
// Boundary: this page skeleton does not fetch APIs, does not submit recommendations, does not approve, does not dispatch, and does not create AO-ACT tasks.
// H52.1-a guardrail: this component consumes the route fieldId only; it does not expand scope into backend, seed, DB, or write actions.

import React from "react";
import { useParams } from "react-router-dom";
import {
  buildOperatorEvidenceTwinEnvelope,
  type EvidenceTwinBoundaryRuleV1,
  type EvidenceTwinGapV1,
  type EvidenceTwinNodeV1,
  type OperatorEvidenceTwinV1,
  type WaterStressLoopStepV1,
} from "../evidenceTwin/evidenceTwinAdapter";

function statusText(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  const labels: Record<string, string> = {
    AVAILABLE: "可用",
    LIMITED: "受限",
    MISSING: "缺失",
    BLOCKING: "阻塞",
    NOT_APPLICABLE: "不适用",
    UNKNOWN: "未知",
    NOT_VERIFIABLE: "不可验证",
    INFO: "信息",
    WARNING: "警告",
  };
  return labels[raw] ? labels[raw] + "（" + raw + "）" : raw || "未知";
}

function emptyText(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw || "未提供";
}

function fieldIdFromParams(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === ":fieldId" || raw === "fieldId" || raw.startsWith(":")) return "field_c8_demo";
  return raw;
}

function refCountText(node: EvidenceTwinNodeV1): string {
  const count = node.evidence_refs.length + node.source_refs.length;
  return String(count) + " 条引用";
}

function FieldHeaderCard({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="h52-field-header">
      <p className="operatorEyebrow">地块证据孪生</p>
      <h3>{twin.field.field_name}</h3>
      <ul className="operatorList">
        <li>地块 ID：{twin.field.field_id}</li>
        <li>作物：{emptyText(twin.field.crop_text)}</li>
        <li>正式入口：{twin.field.canonical_route}</li>
        <li>旧入口策略：URL-only，验收后再决定 redirect 或删除候选。</li>
      </ul>
    </article>
  );
}

function CurrentStateCard({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="h52-current-state">
      <p className="operatorEyebrow">当前状态</p>
      <h3>{twin.current_state.label}</h3>
      <p>{twin.current_state.summary_text}</p>
      <ul className="operatorList">
        <li>状态：{statusText(twin.current_state.status)}</li>
        <li>置信度：{emptyText(twin.current_state.confidence.label)}</li>
        <li>证据引用：{String(twin.current_state.evidence_refs.length)} 条</li>
      </ul>
    </article>
  );
}

function LineageCard({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  const rows = [
    { label: "RawSignal", nodes: twin.lineage.raw_signals },
    { label: "Observation", nodes: twin.lineage.observations },
    { label: "StateEstimate", nodes: twin.lineage.state_estimates },
    { label: "Evidence", nodes: twin.lineage.evidence },
    { label: "Verification", nodes: twin.lineage.verifications },
  ];

  return (
    <article className="operatorPanel" data-card="h52-lineage">
      <p className="operatorEyebrow">证据谱系</p>
      <h3>RawSignal → Observation → StateEstimate → Evidence → Verification</h3>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h52-lineage-layers">
          <thead>
            <tr><th>层</th><th>节点数</th><th>首个节点状态</th><th>引用</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const firstNode = row.nodes[0];
              return (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.nodes.length}</td>
                  <td>{statusText(firstNode?.status)}</td>
                  <td>{firstNode ? refCountText(firstNode) : "0 条引用"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function WaterStressStepTable({ steps }: { steps: WaterStressLoopStepV1[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="h52-water-stress-loop" data-loop="water_stress_loop_v1">
      <p className="operatorEyebrow">水分压力闭环 · 猎鹰 1 号</p>
      <h3>水分压力闭环</h3>
      <p>本表只展示闭环节点，不触发审批、派单、AO-ACT task 创建或任何写入。</p>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h52-water-stress-steps">
          <thead>
            <tr><th>顺序</th><th>节点</th><th>类型</th><th>状态</th><th>写入策略</th></tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.step_code} data-step={step.step_code}>
                <td>{step.order}</td>
                <td>{step.label}</td>
                <td>{step.kind}</td>
                <td>{statusText(step.status)}</td>
                <td>{step.write_policy.write_ready ? "允许写入" : "只读 / allowed_actions=[]"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function GapPanel({ gaps }: { gaps: EvidenceTwinGapV1[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="h52-gaps">
      <p className="operatorEyebrow">缺口显式</p>
      <h3>数据与闭环缺口</h3>
      <ul className="operatorList">
        {gaps.map((gap) => (
          <li key={gap.gap_code + gap.related_node_ids.join("|")}>{gap.label} · {statusText(gap.severity)} · {gap.gap_code}</li>
        ))}
      </ul>
    </article>
  );
}

function BoundaryPanel({ rules }: { rules: EvidenceTwinBoundaryRuleV1[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="h52-boundary-rules">
      <p className="operatorEyebrow">只读边界</p>
      <h3>本页不会执行的动作</h3>
      <ul className="operatorList">
        {rules.map((rule) => (
          <li key={rule.rule_code}>{rule.label} · {rule.rule_code}</li>
        ))}
      </ul>
    </article>
  );
}

export default function OperatorEvidenceTwinPage(): React.ReactElement {
  const params = useParams();
  const fieldId = fieldIdFromParams(params.fieldId);
  const envelope = React.useMemo(
    () => buildOperatorEvidenceTwinEnvelope({ fieldId, generatedAt: "2026-06-25T00:00:00.000Z" }),
    [fieldId],
  );
  const twin = envelope.operator_evidence_twin_v1;

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-evidence-twin" data-page="h52-operator-evidence-twin" data-contract="operator_evidence_twin_v1">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">操作员证据孪生</p>
          <h2>地块证据孪生</h2>
          <p>本页是 H52 只读页面骨架，用于展示一块地从原始信号到状态、建议候选、执行证据和灌后验证的证据链。</p>
        </div>
        <div className="operatorWorkbenchHeroActions" data-write-ready={String(envelope.writeReady)} data-dispatch-ready={String(envelope.dispatchReady)} data-approval-ready={String(envelope.approvalReady)} data-task-creation-ready={String(envelope.taskCreationReady)}>
          <span className="operatorActionLink">只读</span>
          <span className="operatorActionLink">不审批</span>
          <span className="operatorActionLink">不派单</span>
          <span className="operatorActionLink">不创建 AO-ACT task</span>
        </div>
      </div>

      <div className="operatorPanelGrid">
        <FieldHeaderCard twin={twin} />
        <CurrentStateCard twin={twin} />
        <LineageCard twin={twin} />
        <WaterStressStepTable steps={twin.water_stress_loop.steps} />
        <GapPanel gaps={twin.gaps} />
        <BoundaryPanel rules={twin.boundary_rules} />
      </div>
    </section>
  );
}
