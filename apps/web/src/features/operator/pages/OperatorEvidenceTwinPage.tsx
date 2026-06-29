// apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx
// Purpose: render the H52/H53 Operator Evidence Twin read-only page for Water Stress sensing readback and downstream gap visibility.
// Boundary: this page fetches only the read model; it does not submit recommendations, approve, dispatch, or create AO-ACT tasks.
// H53.1a guardrail: this component reorganizes sensing and pending-stage presentation only; it does not change backend contracts or create write actions.

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

type DisplayMetric = {
  label: string;
  value: string;
  unit?: string;
  source: string;
  status: string;
};

type PhaseRow = {
  phase: string;
  intent: string;
  nodes: EvidenceTwinNodeV1[];
  expected_output: string;
};

function statusText(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  const labels: Record<string, string> = {
    AVAILABLE: "可用",
    LIMITED: "受限",
    MISSING: "缺失",
    BLOCKING: "阻塞",
    DERIVED_PENDING: "待系统生成",
    NOT_APPLICABLE: "不适用",
    UNKNOWN: "未知",
    NOT_VERIFIABLE: "不可验证",
    INFO: "信息",
    WARNING: "提示",
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

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "未提供";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "未提供";
  if (typeof value === "object") return JSON.stringify(value);
  const raw = String(value).trim();
  return raw || "未提供";
}

function payloadValue(node: EvidenceTwinNodeV1 | null | undefined, key: string): string {
  if (!node?.expand_payload) return "未提供";
  return textValue(node.expand_payload[key]);
}

function payloadNumber(node: EvidenceTwinNodeV1 | null | undefined, keys: string[]): number | null {
  if (!node?.expand_payload) return null;
  for (const key of keys) {
    const parsed = asNumber(node.expand_payload[key]);
    if (parsed !== null) return parsed;
  }
  return null;
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

function latestAvailableNode(nodes: EvidenceTwinNodeV1[], keys: string[]): EvidenceTwinNodeV1 | null {
  return nodes.find((node) => node.status === "AVAILABLE" && keys.some((key) => node.expand_payload?.[key] !== undefined && node.expand_payload?.[key] !== null)) ?? null;
}

function phaseStatus(nodes: EvidenceTwinNodeV1[]): string {
  if (nodes.some((node) => node.status === "AVAILABLE")) return "AVAILABLE";
  if (nodes.some((node) => node.status === "DERIVED_PENDING")) return "DERIVED_PENDING";
  if (nodes.some((node) => node.status === "MISSING")) return "MISSING";
  return nodes[0]?.status ?? "UNKNOWN";
}

function writePolicyText(node: EvidenceTwinNodeV1): string {
  return node.write_policy.write_ready ? "允许写入" : "只读 / allowed_actions=[]";
}

function compactNodeList(nodes: EvidenceTwinNodeV1[]): string {
  return nodes.map((node) => node.label + "：" + statusText(node.status)).join("；");
}

function metricCard(metric: DisplayMetric): React.ReactElement {
  return (
    <div className="operatorPanel" data-sensing-metric={metric.label}>
      <p className="operatorEyebrow">{metric.source}</p>
      <h3>{metric.value}{metric.unit ? " " + metric.unit : ""}</h3>
      <p>{metric.label}</p>
      <p>状态：{statusText(metric.status)}</p>
    </div>
  );
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

function H531aStatusSummaryCard({ twin, source }: { twin: OperatorEvidenceTwinV1; source: string }): React.ReactElement {
  const loop = twin.water_stress_loop;
  const sensingAvailable =
    loop.inputs.soil_moisture.some((node) => node.status === "AVAILABLE")
    || loop.inputs.weather_forecast.some((node) => node.status === "AVAILABLE");
  const derivedPending = [loop.water_stress_state, loop.forecast, loop.scenario, loop.recommendation].every((node) => node.status === "DERIVED_PENDING");
  const controlPending = [loop.approval, loop.operation, loop.ao_act, loop.as_executed, loop.evidence, loop.acceptance, loop.verification].every((node) => node.status === "DERIVED_PENDING");

  return (
    <article className="operatorPanel" data-card="h53-1a-status-summary" data-read-source={source}>
      <p className="operatorEyebrow">H53.1a operator display summary</p>
      <h3>感知已回读，状态待系统生成</h3>
      <p>本页已经读到 RawSignal / Observation / sensing window / weather forecast。后续 State、Scenario、Recommendation、Approval、AO-ACT、Acceptance 不在 H53.1a 页面触发。</p>
      <ul className="operatorList">
        <li>读模型来源：{source}</li>
        <li>感知输入：{sensingAvailable ? "已回读" : "未回读"}</li>
        <li>系统推导层：{derivedPending ? "待系统生成" : "部分已生成"}</li>
        <li>流程控制层：{controlPending ? "未进入控制链" : "部分已进入控制链"}</li>
      </ul>
    </article>
  );
}

function SensingReadbackCard({ twin, source }: { twin: OperatorEvidenceTwinV1; source: string }): React.ReactElement {
  const loop = twin.water_stress_loop;
  const soilValueNode = latestAvailableNode(loop.inputs.soil_moisture, ["soil_moisture_percent", "value_num"]);
  const windowNode = latestAvailableNode(loop.inputs.soil_moisture, ["coverage_ratio", "quality_status", "expected_points", "actual_points"]);
  const weatherNode = latestAvailableNode(loop.inputs.weather_forecast, ["rainfall_forecast_mm_72h", "et0_mm_72h", "temperature_max_c_72h"]);
  const soilMoisturePercent = payloadNumber(soilValueNode, ["soil_moisture_percent", "value_num"]);
  const coverageRatio = payloadNumber(windowNode, ["coverage_ratio"]);
  const rainfall = payloadNumber(weatherNode, ["rainfall_forecast_mm_72h"]);
  const et0 = payloadNumber(weatherNode, ["et0_mm_72h"]);

  const metrics: DisplayMetric[] = [
    {
      label: "soil_moisture_percent",
      value: soilMoisturePercent === null ? "未提供" : String(soilMoisturePercent),
      unit: "%",
      source: soilValueNode?.schema_ref ?? "telemetry_index_v1 / device_observation_index_v1",
      status: soilValueNode?.status ?? "MISSING",
    },
    {
      label: "coverage_ratio",
      value: coverageRatio === null ? "未提供" : String(coverageRatio),
      source: windowNode?.schema_ref ?? "soil_moisture_sensing_window_index_v1",
      status: windowNode?.status ?? "MISSING",
    },
    {
      label: "rainfall_forecast_mm_72h",
      value: rainfall === null ? "未提供" : String(rainfall),
      unit: "mm",
      source: weatherNode?.schema_ref ?? "weather_forecast_index_v1",
      status: weatherNode?.status ?? "MISSING",
    },
    {
      label: "et0_mm_72h",
      value: et0 === null ? "未提供" : String(et0),
      unit: "mm",
      source: weatherNode?.schema_ref ?? "weather_forecast_index_v1",
      status: weatherNode?.status ?? "MISSING",
    },
  ];

  return (
    <article className="operatorPanel" data-card="h53-sensing-readback" data-card-version="h53-1a" data-read-source={source}>
      <p className="operatorEyebrow">H53.1a sensing readback</p>
      <h3>感知数据回读</h3>
      <p>这里把 sensing-only 数据拆成操作员可读卡片；不把 State、Scenario、AO-ACT、Acceptance 提前伪装成结果。</p>
      <div className="operatorPanelGrid" data-card="h53-1a-sensing-metric-cards">
        {metrics.map((metric) => (
          <React.Fragment key={metric.label}>{metricCard(metric)}</React.Fragment>
        ))}
      </div>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h53-1a-sensing-detail">
          <thead>
            <tr><th>输入层</th><th>节点</th><th>状态</th><th>关键字段</th><th>引用</th></tr>
          </thead>
          <tbody>
            <tr data-sensing-row="soil_moisture_percent">
              <td>Soil Moisture</td>
              <td>{soilValueNode?.label ?? "未回读"}</td>
              <td>{statusText(soilValueNode?.status)}</td>
              <td>soil_moisture_percent={metrics[0].value}%；metric={payloadValue(soilValueNode, "metric")}</td>
              <td>{soilValueNode ? refCountText(soilValueNode) : "0 条引用"}</td>
            </tr>
            <tr data-sensing-row="sensing_window">
              <td>Sensing Window</td>
              <td>{windowNode?.label ?? "未回读"}</td>
              <td>{statusText(windowNode?.status)}</td>
              <td>coverage_ratio={metrics[1].value}；quality_status={payloadValue(windowNode, "quality_status")}；actual_points={payloadValue(windowNode, "actual_points")}；expected_points={payloadValue(windowNode, "expected_points")}</td>
              <td>{windowNode ? refCountText(windowNode) : "0 条引用"}</td>
            </tr>
            <tr data-sensing-row="weather_forecast">
              <td>Weather Forecast</td>
              <td>{weatherNode?.label ?? "未回读"}</td>
              <td>{statusText(weatherNode?.status)}</td>
              <td>rainfall_forecast_mm_72h={metrics[2].value} mm；et0_mm_72h={metrics[3].value} mm；temperature_max_c_72h={payloadValue(weatherNode, "temperature_max_c_72h")}</td>
              <td>{weatherNode ? refCountText(weatherNode) : "0 条引用"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PhaseGroupedPendingCard({ twin }: { twin: OperatorEvidenceTwinV1 }): React.ReactElement {
  const loop = twin.water_stress_loop;
  const phases: PhaseRow[] = [
    {
      phase: "已完成输入层",
      intent: "系统已经可读回感知输入。",
      nodes: [...loop.inputs.soil_moisture, ...loop.inputs.weather_forecast],
      expected_output: "RawSignal / Observation / Sensing Window / Weather Forecast Input",
    },
    {
      phase: "等待系统推导",
      intent: "由后续 derivation engine 生成，不由 seed 或页面写入。",
      nodes: [loop.water_stress_state, loop.forecast, loop.scenario, loop.recommendation],
      expected_output: "WaterStressState / Forecast / Scenario / RecommendationCandidate",
    },
    {
      phase: "等待人工与控制链",
      intent: "仓库已有控制链能力，但 H53.1a 页面不触发审批、作业计划或 AO-ACT。",
      nodes: [loop.approval, loop.operation, loop.ao_act],
      expected_output: "Human Approval / OperationPlan / AO-ACT Task",
    },
    {
      phase: "等待执行与验收闭环",
      intent: "必须依赖执行回执、实执记录、证据和验收。",
      nodes: [loop.as_executed, loop.evidence, loop.acceptance, loop.verification],
      expected_output: "AsExecuted / Evidence / Acceptance / WaterResponseVerification",
    },
    {
      phase: "等待经营沉淀",
      intent: "只在正式验收和闭环证据成立后进入。",
      nodes: [],
      expected_output: "ROI / Field Memory",
    },
  ];

  return (
    <article className="operatorPanel" data-card="h53-1a-pending-phases">
      <p className="operatorEyebrow">Pending nodes grouped by stage</p>
      <h3>后续输出阶段</h3>
      <p>这些节点最终应由系统或控制流程输出，但当前页面只展示状态，不触发写动作。</p>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="h53-1a-pending-phases">
          <thead>
            <tr><th>阶段</th><th>当前状态</th><th>应该输出什么</th><th>为什么还没有生成</th></tr>
          </thead>
          <tbody>
            {phases.map((phase) => (
              <tr key={phase.phase} data-phase={phase.phase}>
                <td>{phase.phase}</td>
                <td>{phase.nodes.length ? statusText(phaseStatus(phase.nodes)) : "待正式验收后生成"}</td>
                <td>{phase.expected_output}</td>
                <td>{phase.intent}{phase.nodes.length ? "；" + compactNodeList(phase.nodes) : "。"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                <td>{writePolicyText(step)}</td>
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
            <tr><th>Code</th><th>Node</th><th>Kind</th><th>Status</th><th>Refs</th><th>Blocking</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} data-verification-node={row.code}>
                <td>{row.code}</td>
                <td>{row.node.label}</td>
                <td>{row.node.kind}</td>
                <td>{statusText(row.node.status)}</td>
                <td>{nodeRefsText(row.node)}</td>
                <td>{blockingReasonsText(row.node)}</td>
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
          <p>本页是只读证据孪生页面。H53.1a 只整理 sensing 回读展示，并把后续系统推导、人工审批、执行验收分阶段显示为待生成。</p>
        </div>
        <div className="operatorWorkbenchHeroActions" data-write-ready={String(envelope.writeReady)} data-dispatch-ready={String(envelope.dispatchReady)} data-approval-ready={String(envelope.approvalReady)} data-task-creation-ready={String(envelope.taskCreationReady)}>
          <span className="operatorActionLink">只读</span>
          <span className="operatorActionLink">不审批</span>
          <span className="operatorActionLink">不派单</span>
          <span className="operatorActionLink">不创建 AO-ACT task</span>
        </div>
      </div>

      <div className="operatorPanelGrid">
        <H531aStatusSummaryCard twin={twin} source={readSource} />
        <FieldHeaderCard twin={twin} />
        <CurrentStateCard twin={twin} />
        <SensingReadbackCard twin={twin} source={readSource} />
        <PhaseGroupedPendingCard twin={twin} />
        <LineageCard twin={twin} />
        <WaterStressStepTable steps={twin.water_stress_loop.steps} />
        <ScenarioReadOnlyPanel twin={twin} />
        <VerificationReadOnlyPanel twin={twin} />
        <GapPanel gaps={twin.gaps} />
        <BoundaryPanel rules={twin.boundary_rules} />
      </div>
    </section>
  );
}
