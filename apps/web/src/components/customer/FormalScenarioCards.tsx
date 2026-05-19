import React from "react";
import { buildFormalScenarioVm } from "../../lib/formalScenarioViewModel";

function toneClass(tone: "success" | "warning" | "danger" | "neutral"): string {
  return tone === "danger" ? "riskBadgedanger" : tone === "warning" ? "riskBadgewarning" : tone === "success" ? "riskBadgeneutral" : "riskBadgeneutral";
}

export function FormalScenarioBadge({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  const pestDiseaseSummary = (vm as any).pestDiseaseSummaryText as string | undefined;
  return <span className={`riskBadge ${toneClass(vm.tone)}`}>{vm.scenarioLabel} · {pestDiseaseSummary ?? vm.fertilizationSummaryText ?? vm.chainText}</span>;
}

export function FormalChainSummaryCard({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  const pestDiseaseSummary = (vm as any).pestDiseaseSummaryText as string | undefined;
  return <article className="customerCard"><h3 className="customerCardTitle">正式链路摘要</h3><div>正式链路：{vm.chainText}</div><div className="customerSpacingTopXs">正式证据：{vm.evidenceText}</div><div className="customerSpacingTopXs">原因摘要：{vm.customerReasonSummary}</div>{vm.fertilizationSummaryText ? <div className="customerSpacingTopXs">施氮摘要：{vm.fertilizationSummaryText}</div> : null}{pestDiseaseSummary ? <div className="customerSpacingTopXs">巡检摘要：{pestDiseaseSummary}</div> : null}</article>;
}

export function ScenarioAcceptanceSummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <article className="customerCard"><h3 className="customerCardTitle">验收与闭环</h3><div>验收状态：{vm.acceptanceText}</div><div className="customerSpacingTopXs">验收说明：{vm.customerReasonSummary}</div><div className="customerSpacingTopXs">建议/处方/审批/执行/验收闭环：{vm.chainText}</div><div className="customerSpacingTopXs">{vm.zoneSummaryText ?? "暂无分区验收摘要"}</div></article>;
}

export function ScenarioValueMemorySummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <article className="customerCard"><h3 className="customerCardTitle">价值与学习门禁</h3><div>{vm.roiTrustText}</div><div className="customerSpacingTopXs">{vm.memoryTrustText}</div></article>;
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
  return <article className="customerCard"><h3 className="customerCardTitle">设备异常与接管</h3><div>{vm.deviceStatusText ?? "设备状态：未知"}</div><div className="customerSpacingTopXs">{vm.failSafeText ?? "Fail-safe 未触发"}</div><div className="customerSpacingTopXs">{vm.manualTakeoverText ?? "人工接管未触发"}</div>{vm.executionGuardText ? <div className="customerSpacingTopXs">{vm.executionGuardText}</div> : null}</article>;
}
