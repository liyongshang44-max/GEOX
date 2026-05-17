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
  return <article className="customerCard"><h3 className="customerCardTitle">正式链路摘要</h3><div>{vm.chainText}</div><div className="customerSpacingTopXs">{vm.evidenceText}</div></article>;
}

export function ScenarioAcceptanceSummary({ data }: { data: any }): React.ReactElement {
  const vm = buildFormalScenarioVm(data);
  return <article className="customerCard"><h3 className="customerCardTitle">验收与闭环</h3><div>{vm.acceptanceText}</div><div className="customerSpacingTopXs">{vm.zoneSummaryText ?? "暂无分区验收摘要"}</div></article>;
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
  const policy = zones[0]?.operation_rollup_policy ? String(zones[0].operation_rollup_policy) : "待确认";
  return <article className="customerCard"><h3 className="customerCardTitle">分区汇总</h3><div>通过 {pass} / 失败 {fail} / 部分通过 {partial}</div><div className="customerSpacingTopXs">汇总策略：{policy}</div></article>;
}

export function FailSafeCustomerNotice({ data }: { data: any }): React.ReactElement | null {
  const vm = buildFormalScenarioVm(data);
  if (!vm.failSafeText && !vm.manualTakeoverText) return null;
  return <article className="customerCard"><h3 className="customerCardTitle">设备异常与接管</h3><div>{vm.failSafeText ?? "Fail-safe 未触发"}</div><div className="customerSpacingTopXs">{vm.manualTakeoverText ?? "人工接管未触发"}</div></article>;
}
