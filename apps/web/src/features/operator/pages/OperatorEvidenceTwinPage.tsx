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

function payloadRaw(node: EvidenceTwinNodeV1 | null | undefined, key: string): unknown {
  return node?.expand_payload?.[key];
}

function payloadText(node: EvidenceTwinNodeV1 | null | undefined, key: string): string {
  const value = payloadRaw(node, key);
  if (value === null || value === undefined || value === "") return "未提供";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function payloadNumber(node: EvidenceTwinNodeV1 | null | undefined, key: string): number | null {
  const parsed = Number(payloadRaw(node, key));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberText(value: number | null, suffix = ""): string {
  if (!Number.isFinite(Number(value))) return "未提供";
  const fixed = Number(value).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return fixed + suffix;
}

function firstAvailableNode(nodes: EvidenceTwinNodeV1[], keys: string[]): EvidenceTwinNodeV1 | null {
  const available = nodes.find((node) => node.status === "AVAILABLE" && keys.some((key) => payloadRaw(node, key) !== undefined && payloadRaw(node, key) !== null));
  return available ?? nodes.find((node) => node.status === "AVAILABLE") ?? nodes[0] ?? null;
}

function availabilityText(node: EvidenceTwinNodeV1 | null): string {
  return node ? statusText(node.status) : "缺失（MISSING）";
}

function miniCardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255, 255, 255, 0.72)",
    minWidth: 0,
  };
}

function metricValueStyle(): React.CSSProperties {
  return {
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 700,
    margin: "6px 0 4px",
  };
}

function miniGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 12,
  };
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
  const soilNode = firstAvailableNode(twin.water_stress_loop.inputs.soil_moisture, ["soil_moisture_percent", "value_num"]);
  const windowNode = firstAvailableNode(twin.water_stress_loop.inputs.soil_moisture, ["coverage_ratio", "quality_status"]);
  const weatherNode = firstAvailableNode(twin.water_stress_loop.inputs.weather_forecast, ["rainfall_forecast_mm_72h", "et0_mm_72h", "temperature_max_c_72h"]);
  const soilMoisture = payloadNumber(soilNode, "soil_moisture_percent") ?? payloadNumber(soilNode, "value_num");
  const coverageRatio = payloadNumber(windowNode, "coverage_ratio");
  const qualityStatus = payloadText(windowNode, "quality_status");
  const rainfall = payloadNumber(weatherNode, "rainfall_forecast_mm_72h");
  const et0 = payloadNumber(weatherNode, "et0_mm_72h");
  const tempMax = payloadNumber(weatherNode, "temperature_max_c_72h");

  return (
    <article className="operatorPanel" data-card="h53-sensing-readback" data-read-source={source}>
      <p className="operatorEyebrow">H53.1a sensing readback display</p>
      <h3>感知数据已回读，状态仍待推导</h3>
      <p>本区只把 RawSignal / Observation 层整理成人能读懂的感知卡片；WaterStressState、Scenario、AO-ACT、Acceptance 不在本阶段生成。</p>
      <div style={miniGridStyle()} data-section="h53-sensing-cards">
        <section style={miniCardStyle()} data-card="h53-sensing-soil-moisture">
          <p className="operatorEyebrow">Soil Moisture</p>
          <div style={metricValueStyle()}>{numberText(soilMoisture, " %")}</div>
          <ul className="operatorList">
            <li>状态：{availabilityText(soilNode)}</li>
            <li>metric：{payloadText(soilNode, "metric")}</li>
            <li>来源：telemetry_index_v1 / device_observation_index_v1</li>
            <li>引用：{soilNode ? refCountText(soilNode) : "0 条引用"}</li>
          </ul>
        </section>
        <section style={miniCardStyle()} data-card="h53-sensing-window">
          <p className="operatorEyebrow">Sensing Window</p>
          <div style={metricValueStyle()}>{numberText(coverageRatio)}</div>
          <ul className="operatorList">
            <li>coverage_ratio：{numberText(coverageRatio)}</li>
            <li>quality_status：{qualityStatus}</li>
            <li>actual_points：{payloadText(windowNode, "actual_points")}</li>
            <li>expected_points：{payloadText(windowNode, "expected_points")}</li>
            <li>max_gap_ms：{payloadText(windowNode, "max_gap_ms")}</li>
          </ul>
        </section>
        <section style={miniCardStyle()} data-card="h53-weather-forecast">
          <p className="operatorEyebrow">Weather Forecast Input</p>
          <div style={metricValueStyle()}>{numberText(rainfall, " mm")}</div>
          <ul className="operatorList">
            <li>rainfall_forecast_mm_72h：{numberText(rainfall, " mm")}</li>
            <li>et0_mm_72h：{numberText(et0, " mm")}</li>
            <li>temperature_max_c_72h：{numberText(tempMax, " ℃")}</li>
            <li>状态：{availabilityText(weatherNode)}</li>
          </ul>
        </section>
      </div>
    </article>
  );
}

function PendingStageCard({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  const loop = twin.water_stress_loop;
  const stages: Array<{ id: string; title: string; summary: string; nodes: Array<{ label: string; node: EvidenceTwinNodeV1 | null; code: string }> }> = [
    {
      id: "system-derivation",
      title: "等待系统推导",
      summary: "这些节点应该由 WaterStressState / Forecast / Scenario / Recommendation engine 生成，不能由 sensing-only seed 填充。",
      nodes: [
        { label: "WaterStressState / 水分压力状态", node: loop.water_stress_state, code: "water_stress_state" },
        { label: "Forecast / 水分预测", node: loop.forecast, code: "forecast" },
        { label: "Scenario / 情景", node: loop.scenario, code: "scenario" },
        { label: "Recommendation / 建议候选", node: loop.recommendation, code: "recommendation" },
      ],
    },
    {
      id: "operator-control-flow",
      title: "等待人审与控制流程",
      summary: "这些节点依赖已有控制链路：RecommendationCandidate → Human Approval → OperationPlan → AO-ACT → Receipt / AsExecuted → Evidence。",
      nodes: [
        { label: "Approval / 审批", node: loop.approval, code: "approval" },
        { label: "Operation / 作业计划", node: loop.operation, code: "operation" },
        { label: "AO-ACT", node: loop.ao_act, code: "ao_act" },
        { label: "AsExecuted", node: loop.as_executed, code: "as_executed" },
        { label: "Evidence", node: loop.evidence, code: "evidence" },
      ],
    },
    {
      id: "closure-memory",
      title: "等待验收与闭环沉淀",
      summary: "这些节点只能在 receipt、execution evidence、acceptance gate 之后生成；ROI / Field Memory 不属于 H53.1a 写入范围。",
      nodes: [
        { label: "Acceptance / 验收", node: loop.acceptance, code: "acceptance" },
        { label: "Verification / 灌后验证", node: loop.verification, code: "verification" },
        { label: "ROI", node: null, code: "roi" },
        { label: "Field Memory", node: null, code: "field_memory" },
      ],
    },
  ];

  return (
    <article className="operatorPanel" data-card="h53-pending-stage-groups">
      <p className="operatorEyebrow">H53.1a pending stage groups</p>
      <h3>后续节点按生成阶段分组</h3>
      <p>当前页面不是“数据没有填满”，而是 sensing input 已就绪，后续节点等待对应系统推导或显式流程触发。</p>
      <div style={miniGridStyle()}>
        {stages.map((stage) => (
          <section key={stage.id} style={miniCardStyle()} data-stage={stage.id}>
            <p className="operatorEyebrow">{stage.title}</p>
            <p>{stage.summary}</p>
            <ul className="operatorList">
              {stage.nodes.map((item) => (
                <li key={item.code} data-pending-node={item.code}>
                  {item.label}：{item.node ? statusText(item.node.status) : "待后续闭环生成（NOT_CREATED_IN_H53_1A）"}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function WaterStressStepTable({ steps }: { steps: WaterStressLoopStepV1[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="h52-water-stress-loop" data-loop="water_stress_loop_v1">
      <p className="operatorEyebrow">水分压力闭环 · 猎鹰 1 号</p>
      <h3>水分压力闭环原始节点表</h3>
      <p>本表保留工程级节点明细，不触发审批、派单、AO-ACT task 创建或任何写入。</p>
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
          <p>本页是只读证据孪生页面，用于展示一块地从原始信号到状态、建议候选、执行证据和灌后验证的证据链。H53.1a 将感知数据整理为可读卡片，并把后续节点按生成阶段分组。</p>
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
        <PendingStageCard twin={twin} />
        <WaterStressStepTable steps={twin.water_stress_loop.steps} />
        <ScenarioReadOnlyPanel twin={twin} />
        <VerificationReadOnlyPanel twin={twin} />
        <GapPanel gaps={twin.gaps} />
        <BoundaryPanel rules={twin.boundary_rules} />
      </div>
    </section>
  );
}
