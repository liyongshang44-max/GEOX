import React from "react";
import { buildFormalScenarioVm } from "../../lib/formalScenarioViewModel";

function toneClass(tone: "success" | "warning" | "danger" | "neutral"): string {
  return tone === "danger" ? "riskBadgedanger" : tone === "warning" ? "riskBadgewarning" : tone === "success" ? "riskBadgeneutral" : "riskBadgeneutral";
}

export function FormalScenarioBadge({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <span className={`riskBadge ${toneClass(vm.tone)}`}>{vm.scenarioLabel} · {vm.chainText}</span>;
}

export function FormalChainSummaryCard({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <article className="customerCard"><h3 className="customerCardTitle">正式链路摘要</h3><div>{vm.chainText}</div><div className="customerSpacingTopXs">正式证据：{vm.evidenceText}</div></article>;
}

export function ScenarioAcceptanceSummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <article className="customerCard"><h3 className="customerCardTitle">验收与闭环</h3><div>{vm.acceptanceText}</div><div className="customerSpacingTopXs">建议/处方/审批/执行/验收闭环：{vm.chainText}</div><div className="customerSpacingTopXs">{vm.zoneSummaryText ?? "暂无分区验收摘要"}</div></article>;
}

export function ScenarioValueMemorySummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <article className="customerCard"><h3 className="customerCardTitle">价值与学习门禁</h3><div>{vm.roiTrustText}</div><div className="customerSpacingTopXs">{vm.memoryTrustText}</div></article>;
}

export function ZoneRollupSummary({ data }: { data: any }): React.ReactElement {
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
