// apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx
// Purpose: render the H52/H53 Operator Evidence Twin read-only page for the Water Stress Loop P0 and sensing readback.
// Boundary: this page fetches only the read model; it does not submit recommendations, approve, dispatch, or create AO-ACT tasks.
// H52.1-a guardrail: this component consumes route fieldId and read-only evidence twin data; it does not write facts, seed data, DB rows, or action records.

import React from "react";
import { useParams } from "react-router-dom";
import {
  buildOperatorEvidenceTwinEnvelope,
  type EvidenceTwinBoundaryRuleV1,
  type EvidenceTwinGapV1,
  type EvidenceTwinNodeV1,
  type OperatorEvidenceTwinEnvelopeV1,
  type OperatorEvidenceTwinV1,
  type WaterStressLoopStepV1,
  type WaterStressScenarioOptionV1,
} from "../evidenceTwin/evidenceTwinAdapter";

function statusText(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  const labels: Record<string, string> = {
    AVAILABLE: "可用",
    LIMITED: "受限",
    MISSING: "缺失",
    BLOCKING: "阻塞",
    DERIVED_PENDING: "待推导",
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

function payloadValue(node: EvidenceTwinNodeV1, key: string): string {
  const value = node.expand_payload?.[key];
  if (value === null || value === undefined) return "未提供";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fieldIdFromParams(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === ":fieldId" || raw === "fieldId" || raw.startsWith(":")) return "field_c8_demo";
  return raw;
}

function evidenceTwinApiBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.port === "5173" ? "http://127.0.0.1:3001" : "";
}

function evidenceTwinReadUrl(fieldId: string): string {
  const encodedFieldId = encodeURIComponent(fieldId);
  const query = new URLSearchParams({ loop: "water-stress", tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" });
  return evidenceTwinApiBase() + "/api/v1/operator/fields/" + encodedFieldId + "/evidence-twin?" + query.toString();
}

function refCountText(node: EvidenceTwinNodeV1): string {
  const count = node.evidence_refs.length + node.source_refs.length;
  return String(count) + " 条引用";
}

function refsText(option: WaterStressScenarioOptionV1): string {
  return option.evidence_refs.length > 0 ? option.evidence_refs.map((ref) => ref.label ?? ref.ref_id).join(" / ") : "未提供引用";
}

function nodeRefsText(node: EvidenceTwinNodeV1): string {
  const refs = [...node.source_refs, ...node.evidence_refs];
  return refs.length > 0 ? refs.map((ref) => ref.label ?? ref.ref_id).join(" / ") : "证据引用缺失";
}

function blockingReasonsText(node: EvidenceTwinNodeV1): string {
  return node.quality.blocking_reasons.length > 0 ? node.quality.blocking_reasons.join(" / ") : "无阻塞原因";
}

function expandPayloadText(node: EvidenceTwinNodeV1): string {
  if (!node.expand_payload) return "未提供 expand_payload";
  const keys = Object.keys(node.expand_payload);
  return keys.length > 0 ? keys.join(" / ") : "expand_payload 为空";
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

function SensingReadbackCard({ twin, source }: { twin: OperatorEvidenceTwinV1; source: string }): React.ReactElement {
  const soilNodes = twin.water_stress_loop.inputs.soil_moisture;
  const weatherNodes = twin.water_stress_loop.inputs.weather_forecast;
  return (
    <article className="operatorPanel" data-card="h53-sensing-readback" data-read-source={source}>
      <p className="operatorEyebrow">H53.1 Sensing readback</p>
      <h3>感知数据只读回读</h3>
      <p>本区只展示 RawSignal / Observation 层数据；State、Scenario、AO-ACT、Acceptance 仍必须由后续链路生成。</p>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h53-sensing-readback">
          <thead>
            <tr><th>来源</th><th>状态</th><th>metric</th><th>soil_moisture_percent</th><th>coverage_ratio</th><th>quality_status</th><th>rainfall_forecast_mm_72h</th><th>et0_mm_72h</th></tr>
          </thead>
          <tbody>
            {[...soilNodes, ...weatherNodes].map((node) => (
              <tr key={node.id} data-sensing-node={node.id}>
                <td>{node.label}</td>
                <td>{statusText(node.status)}</td>
                <td>{payloadValue(node, "metric")}</td>
                <td>{payloadValue(node, "soil_moisture_percent")}</td>
                <td>{payloadValue(node, "coverage_ratio")}</td>
                <td>{payloadValue(node, "quality_status")}</td>
                <td>{payloadValue(node, "rainfall_forecast_mm_72h")}</td>
                <td>{payloadValue(node, "et0_mm_72h")}</td>
              </tr>
            ))}
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

function ScenarioReadOnlyPanel({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  const scenario = twin.water_stress_loop.scenario;
  const scenarioBoundary = twin.boundary_rules.find((rule) => rule.rule_code === "SCENARIO_IS_NOT_TASK");

  return (
    <article className="operatorPanel" data-card="h52-scenario-read-only" data-scenario-read-only="true">
      <p className="operatorEyebrow">Scenario read-only section</p>
      <h3>灌溉情景只读</h3>
      <p>情景用于比较可能路径，不是任务，不在本页转化为审批、作业计划或 AO-ACT。</p>
      <ul className="operatorList">
        <li>Scenario status：{statusText(scenario.status)}</li>
        <li>No-action baseline：{scenario.no_action_baseline_present ? "存在" : "缺失"}</li>
        <li>Scenario set：{emptyText(scenario.scenario_set_id)}</li>
        <li>Unavailable reason：{emptyText(scenario.unavailable_reason)}</li>
        <li>Boundary：{scenarioBoundary ? scenarioBoundary.rule_code : "SCENARIO_IS_NOT_TASK"}</li>
        <li>Evidence refs：{String(scenario.evidence_refs.length)} 条</li>
      </ul>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h52-scenario-options">
          <thead>
            <tr><th>Option</th><th>Label</th><th>Irrigation mm</th><th>Scheduled day</th><th>Risk delta</th><th>Confidence</th><th>Evidence refs</th></tr>
          </thead>
          <tbody>
            {scenario.options.length > 0 ? scenario.options.map((option) => (
              <tr key={option.option_id || option.label} data-scenario-option={option.option_id || option.label}>
                <td>{emptyText(option.option_id)}</td>
                <td>{emptyText(option.label)}</td>
                <td>{emptyText(option.irrigation_amount_mm)}</td>
                <td>{emptyText(option.scheduled_day)}</td>
                <td>{emptyText(option.risk_delta)}</td>
                <td>{emptyText(option.confidence.label)}</td>
                <td>{refsText(option)}</td>
              </tr>
            )) : (
              <tr data-scenario-option="empty">
                <td colSpan={7}>SCENARIO_OPTIONS_MISSING：未提供情景选项，前端不补默认情景。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function VerificationReadOnlyPanel({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  const loop = twin.water_stress_loop;
  const verificationGap = twin.gaps.find((gapItem) => gapItem.gap_code === "WATER_RESPONSE_VERIFICATION_MISSING");
  const acceptanceGap = twin.gaps.find((gapItem) => gapItem.gap_code === "ACCEPTANCE_RESULT_MISSING" || gapItem.gap_code === "ACCEPTANCE_NOT_CREATED_IN_SENSING_ONLY");
  const rows: Array<{ code: string; node: EvidenceTwinNodeV1 }> = [
    { code: "AS_EXECUTED", node: loop.as_executed },
    { code: "EVIDENCE", node: loop.evidence },
    { code: "ACCEPTANCE", node: loop.acceptance },
    { code: "VERIFICATION", node: loop.verification },
  ];

  return (
    <article className="operatorPanel" data-card="h52-verification-read-only" data-verification-read-only="true">
      <p className="operatorEyebrow">Post-Irrigation Verification read-only section</p>
      <h3>灌后验证只读</h3>
      <p>本区只展示执行尾部、执行证据、验收结果和灌后水分响应验证，不提交回执、不写验收或验证事实。</p>
      <ul className="operatorList">
        <li>Verification status：{statusText(loop.verification.status)}</li>
        <li>Acceptance status：{statusText(loop.acceptance.status)}</li>
        <li>Execution evidence status：{statusText(loop.evidence.status)}</li>
        <li>Verification gap：{verificationGap ? verificationGap.gap_code : "WATER_RESPONSE_VERIFICATION_MISSING"}</li>
        <li>Acceptance gap：{acceptanceGap ? acceptanceGap.gap_code : loop.acceptance.status === "MISSING" ? "ACCEPTANCE_RESULT_MISSING" : "未阻塞"}</li>
      </ul>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h52-post-irrigation-verification-nodes">
          <thead>
            <tr><th>Code</th><th>Node</th><th>Kind</th><th>Status</th><th>Schema</th><th>Refs</th><th>Blocking</th><th>Payload</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} data-verification-node={row.code}>
                <td>{row.code}</td>
                <td>{row.node.label}</td>
                <td>{row.node.kind}</td>
                <td>{statusText(row.node.status)}</td>
                <td>{emptyText(row.node.schema_ref)}</td>
                <td>{nodeRefsText(row.node)}</td>
                <td>{blockingReasonsText(row.node)}</td>
                <td>{expandPayloadText(row.node)}</td>
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

function isEnvelope(value: unknown): value is OperatorEvidenceTwinEnvelopeV1 {
  const row = value as OperatorEvidenceTwinEnvelopeV1 | null;
  return Boolean(row && row.ok === true && row.operator_evidence_twin_v1);
}

export default function OperatorEvidenceTwinPage(): React.ReactElement {
  const params = useParams();
  const fieldId = fieldIdFromParams(params.fieldId);
  const fallbackEnvelope = React.useMemo(
    () => buildOperatorEvidenceTwinEnvelope({ fieldId, generatedAt: "2026-06-25T00:00:00.000Z" }),
    [fieldId],
  );
  const [remoteEnvelope, setRemoteEnvelope] = React.useState<OperatorEvidenceTwinEnvelopeV1 | null>(null);
  const [readSource, setReadSource] = React.useState("adapter_fallback");

  React.useEffect(() => {
    let cancelled = false;
    fetch(evidenceTwinReadUrl(fieldId), { headers: { Accept: "application/json" } })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled && isEnvelope(json)) {
          setRemoteEnvelope(json);
          setReadSource("operator_evidence_twin_api");
        }
      })
      .catch(() => {
        if (!cancelled) setReadSource("adapter_fallback");
      });
    return () => { cancelled = true; };
  }, [fieldId]);

  const envelope = remoteEnvelope ?? fallbackEnvelope;
  const twin = envelope.operator_evidence_twin_v1;

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-evidence-twin" data-page="h52-operator-evidence-twin" data-contract="operator_evidence_twin_v1" data-read-source={readSource}>
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">操作员证据孪生</p>
          <h2>地块证据孪生</h2>
          <p>本页是只读证据孪生页面，用于展示一块地从原始信号到状态、建议候选、执行证据和灌后验证的证据链。H53.1 只接入感知数据回读。</p>
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
        <SensingReadbackCard twin={twin} source={readSource} />
        <WaterStressStepTable steps={twin.water_stress_loop.steps} />
        <ScenarioReadOnlyPanel twin={twin} />
        <VerificationReadOnlyPanel twin={twin} />
        <GapPanel gaps={twin.gaps} />
        <BoundaryPanel rules={twin.boundary_rules} />
      </div>
    </section>
  );
}
