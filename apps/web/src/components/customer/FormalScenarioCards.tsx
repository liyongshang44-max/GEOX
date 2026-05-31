import React from "react";
import { buildFormalScenarioVm, type FormalScenarioVm } from "../../lib/formalScenarioViewModel";
import { customerClosureStepLabel, customerProductText, customerReviewStateText } from "../../lib/customerProductLanguage";

function toneClass(tone: "success" | "warning" | "danger" | "neutral"): string {
  return tone === "danger" ? "riskBadgedanger" : tone === "warning" ? "riskBadgewarning" : tone === "success" ? "riskBadgeneutral" : "riskBadgeneutral";
}

function closureToneClass(status: "PASS" | "NEEDS_REVIEW" | "BLOCKED"): string {
  return status === "PASS" ? "riskBadgeneutral" : status === "NEEDS_REVIEW" ? "riskBadgewarning" : "riskBadgedanger";
}

function listText(value: unknown): string {
  return Array.isArray(value) ? value.map((x) => String(x ?? "").trim()).filter(Boolean).join("、") : String(value ?? "").trim();
}

function anomalyTypeText(data: any): string {
  const raw = listText(data?.device_anomaly?.anomaly_types) || listText(data?.fail_safe?.trigger) || listText(data?.execution?.invalid_reason);
  return customerProductText(raw || "设备异常", "设备异常");
}

function impactText(data: any): string {
  const scope = data?.device_anomaly?.impact_scope ?? {};
  const fieldId = scope.field_id ?? data?.identifiers?.field_id ?? "待确认";
  const deviceId = scope.device_id ?? data?.as_executed?.device_id ?? "待确认";
  const taskId = scope.act_task_id ?? data?.identifiers?.act_task_id ?? "待确认";
  return `影响范围：地块 ${fieldId}，设备 ${deviceId}，任务 ${taskId}`;
}

function missingEvidenceText(vm: FormalScenarioVm): string {
  const missing = vm.customerBlockingReasons.map((item) => customerProductText(item, "")).filter(Boolean).join("、");
  return missing ? `缺少证据：${missing}` : "缺少证据：设备回执、派发确认或验收材料待补充";
}

function reviewText(vm: FormalScenarioVm): string {
  return customerReviewStateText(vm.needsReview ? "true" : "false");
}

export function FormalScenarioBadge({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  const pestDiseaseSummary = (vm as any).pestDiseaseSummaryText as string | undefined;
  const summary = customerProductText(pestDiseaseSummary ?? vm.fertilizationSummaryText ?? vm.chainText, "正式链路状态待确认");
  return <span className={`riskBadge ${toneClass(vm.tone)}`}>{vm.scenarioLabel} · {summary} · {reviewText(vm)}</span>;
}

export function FormalChainSummaryCard({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  const pestDiseaseSummary = (vm as any).pestDiseaseSummaryText as string | undefined;
  return <article className="customerCard"><h3 className="customerCardTitle">正式链路摘要</h3><div>正式链路：{customerProductText(vm.chainText)}</div><div className="customerSpacingTopXs">正式证据：{customerProductText(vm.evidenceText)}</div><div className="customerSpacingTopXs">原因摘要：{customerProductText(vm.customerReasonSummary)}</div><div className="customerSpacingTopXs">复核状态：{reviewText(vm)}</div>{vm.fertilizationSummaryText ? <div className="customerSpacingTopXs">施氮摘要：{customerProductText(vm.fertilizationSummaryText)}</div> : null}{pestDiseaseSummary ? <div className="customerSpacingTopXs">巡检摘要：{customerProductText(pestDiseaseSummary)}</div> : null}</article>;
}

export function ScenarioAcceptanceSummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  const pdiText = vm.scenarioKey === "FORMAL_PEST_DISEASE_INSPECTION" ? <div className="customerSpacingTopXs">巡检证据链：{customerProductText(vm.chainText)}</div> : null;
  return <article className="customerCard"><h3 className="customerCardTitle">验收与闭环</h3><div>验收状态：{customerProductText(vm.acceptanceText)}</div><div className="customerSpacingTopXs">验收说明：{customerProductText(vm.customerReasonSummary)}</div><div className="customerSpacingTopXs">建议、处方、审批、执行、验收闭环：{customerProductText(vm.chainText)}</div>{pdiText}<div className="customerSpacingTopXs">正式闭环明细：</div><div className="customerSpacingTopXs customerGridTwo">{vm.closureSteps.map((step) => <div key={step.key} className="customerMiniCard"><div>{customerClosureStepLabel(step.label)}</div><span className={`riskBadge ${closureToneClass(step.status)}`}>{customerProductText(step.text)}</span></div>)}</div><div className="customerSpacingTopXs">{customerProductText(vm.zoneSummaryText ?? "暂无分区验收摘要")}</div></article>;
}

export function ScenarioValueMemorySummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  const isAnomaly = vm.scenarioKey === "DEVICE_ANOMALY";
  return <article className="customerCard"><h3 className="customerCardTitle">价值与学习门禁</h3><div>{isAnomaly ? "设备异常未完成正式验收前，不展示价值结论。" : customerProductText(vm.roiTrustText)}</div><div className="customerSpacingTopXs">{isAnomaly ? "设备异常未完成正式验收前，不生成对客田块记忆。" : customerProductText(vm.memoryTrustText)}</div></article>;
}

export function ZoneRollupSummary({ data }: { data: any }): React.ReactElement {
  const pdi = data?.pest_disease_inspection ?? null;
  if (pdi) {
    return <article className="customerCard"><h3 className="customerCardTitle">巡检证据汇总</h3><div>图片/媒体：{Number(pdi.media_count ?? 0)} 条</div><div className="customerSpacingTopXs">定位证据：{pdi.geo_evidence_present ? "已提供" : "缺少定位"}</div><div className="customerSpacingTopXs">人工复核：{pdi.reviewed_by_human ? "已完成" : "尚未完成"}</div><div className="customerSpacingTopXs">严重度：{String(pdi.severity ?? "待确认")}，置信度：{String(pdi.confidence ?? "待确认")}</div></article>;
  }
  const fertilizationZones = Array.isArray(data?.fertilization?.zone_rates) ? data.fertilization.zone_rates : [];
  if (fertilizationZones.length) {
    const pass = fertilizationZones.filter((z: any) => String(z?.result ?? "").toUpperCase() === "PASS").length;
    const fail = fertilizationZones.filter((z: any) => String(z?.result ?? "").toUpperCase() === "FAIL").length;
    const review = fertilizationZones.filter((z: any) => String(z?.result ?? "").toUpperCase() === "NEEDS_REVIEW").length;
    return <article className="customerCard"><h3 className="customerCardTitle">施氮分区汇总</h3><div>通过 {pass} / 失败 {fail} / 待复核 {review}</div>{fail > 0 ? <div className="customerSpacingTopXs">施氮作业部分分区偏差过大，需复核。</div> : null}<div className="customerSpacingTopXs">汇总策略：单个必需分区失败时，整体不得判定通过。</div></article>;
  }
  const zones = Array.isArray(data?.zone_matrix) ? data.zone_matrix : [];
  const pass = zones.filter((z: any) => z?.zone_acceptance_result === "PASS").length;
  const fail = zones.filter((z: any) => z?.zone_acceptance_result === "FAIL").length;
  const partial = zones.filter((z: any) => z?.zone_acceptance_result === "PARTIAL").length;
  const rawPolicy = String(zones[0]?.operation_rollup_policy ?? "").toUpperCase();
  const policy = rawPolicy === "ALL_PASS_REQUIRED" ? "全区通过才算通过" : rawPolicy === "MAJORITY_PASS" ? "多数分区通过即通过" : rawPolicy === "FAIL_IF_ANY_FAIL" ? "任一区失败则整体失败" : "按分区独立判定";
  return <article className="customerCard"><h3 className="customerCardTitle">分区汇总</h3><div>通过 {pass} / 失败 {fail} / 部分通过 {partial}</div>{fail > 0 ? <div className="customerSpacingTopXs">存在单区失败，必须复核失败分区。</div> : null}<div className="customerSpacingTopXs">汇总策略：{policy}</div></article>;
}

export function FailSafeCustomerNotice({ data }: { data: any }): React.ReactElement | null {
  const vm = buildFormalScenarioVm(data);
  if (vm.scenarioKey !== "DEVICE_ANOMALY" && !vm.failSafeText && !vm.manualTakeoverText) return null;
  return <article className="customerCard"><h3 className="customerCardTitle">设备异常与接管</h3><div>{customerProductText(vm.deviceStatusText ?? "设备状态：未知")}</div><div className="customerSpacingTopXs">异常类型：{anomalyTypeText(data)}</div><div className="customerSpacingTopXs">{impactText(data)}</div><div className="customerSpacingTopXs">系统阻断：{customerProductText(vm.customerReasonSummary || "设备异常或证据不足，需复核。")}</div><div className="customerSpacingTopXs">{missingEvidenceText(vm)}</div><div className="customerSpacingTopXs">是否需要人工接管：{data?.device_anomaly?.manual_takeover_required || data?.device_anomaly?.manual_takeover_status || vm.manualTakeoverText ? "需要" : "待确认"}</div><div className="customerSpacingTopXs">{data?.device_anomaly?.fail_safe_status ? `安全停机状态：${data.device_anomaly.fail_safe_status}` : (customerProductText(vm.failSafeText ?? "安全停机未触发"))}</div><div className="customerSpacingTopXs">{data?.device_anomaly?.manual_takeover_status ? `人工接管状态：${data.device_anomaly.manual_takeover_status}` : (customerProductText(vm.manualTakeoverText ?? "人工接管未触发"))}</div><div className="customerSpacingTopXs">客户下一步：{customerProductText(data?.device_anomaly?.customer_next_action ?? "完成人工接管、现场复核并补充证据。")}</div>{vm.executionGuardText ? <div className="customerSpacingTopXs">{customerProductText(vm.executionGuardText)}</div> : null}<div className="customerSpacingTopXs">当前异常场景不展示“执行成功”，需复核后才能更新状态。</div></article>;
}
