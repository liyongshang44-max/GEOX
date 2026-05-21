import React from "react";
import type { FieldReportDetailV1, OperationReportV1 } from "../../api/reports";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";
import { buildFormalScenarioVm } from "../../lib/formalScenarioViewModel";
import { buildEvidenceVm } from "../../lib/evidenceViewModel";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText } from "../../lib/customerTrustGate";

type Row = Array<string | number | undefined>;

function PrintTable({ headers, rows, emptyText }: { headers: string[]; rows: Row[]; emptyText: string }): React.ReactElement {
  if (!rows.length) return <p className="customerMetricLabel customerSpacingTopSm">{emptyText}</p>;
  return (
    <table className="printTable customerSpacingTopSm">
      <thead><tr>{headers.map((item) => <th key={item}>{item}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${index}-${row.join("-")}`}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell || "暂无记录"}</td>)}</tr>)}</tbody>
    </table>
  );
}

function safeExportText(value: unknown, fallback = "暂无记录"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "[object Object]" || text === "null" || text === "undefined") return fallback;
  if (/s3:\/\//i.test(text) || /minio:\/\//i.test(text) || /https?:\/\//i.test(text)) return fallback;
  if (/(secret|token|credential|stack\s*trace|debug\s*json)/i.test(text)) return fallback;
  return text;
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatTs(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "暂无时间";
  const n = Number(raw);
  const ms = Number.isFinite(n) ? n : Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return safeExportText(raw, "暂无时间");
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function mediaRefsText(value: unknown): string {
  const refs = Array.isArray(value) ? value : [];
  if (!refs.length) return "暂无图片/媒体引用";
  return refs.slice(0, 5).map((item: any) => {
    const kind = safeExportText(item?.kind, "证据引用");
    const ref = safeExportText(item?.ref_id ?? item?.ref ?? item?.id, "证据引用");
    return `${kind}:${ref}`;
  }).join("；");
}

function geoPointText(value: unknown): string {
  if (!isObject(value)) return "暂无定位";
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "暂无定位";
  return `${lat}, ${lng}`;
}

function deviceProfileText(value: unknown): string {
  if (!isObject(value)) return "暂无设备来源";
  return safeExportText(value.device_model ?? value.device_type ?? value.device_id, "暂无设备来源");
}

function pct(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}%` : "待补充";
}

function operationReportObject(report?: OperationReportV1 | null): Record<string, any> {
  return report && typeof report === "object" ? report as unknown as Record<string, any> : {};
}

function fieldReportObject(report?: FieldReportDetailV1 | null): Record<string, any> {
  return report && typeof report === "object" ? report as unknown as Record<string, any> : {};
}

function sectionItemValue(vm: OperationReportPageVm, key: OperationReportPageVm["sections"][number]["key"], label: string, fallback = "暂无记录"): string {
  const section = vm.sections.find((item) => item.key === key);
  const row = section?.items.find((item) => item.label === label || item.label.includes(label));
  return safeExportText(row?.value, fallback);
}

function weatherSummaryFromReport(reportAny: Record<string, any>): string {
  const weather = reportAny.weather_interference ?? reportAny.weather_summary ?? reportAny.environment_context ?? reportAny.weather ?? null;
  if (!isObject(weather)) return "天气摘要未接入报告同源数据。";
  return safeExportText(weather.explanation ?? weather.summary ?? weather.interference_summary, "暂无天气摘要。");
}

function buildOperationSameSourceExportRows(vm: OperationReportPageVm, report?: OperationReportV1 | null): Row[] {
  const reportAny = operationReportObject(report);
  const pack = reportAny.evidence_pack_summary ?? {};
  const asExecuted = reportAny.as_executed ?? {};
  const asApplied = reportAny.as_applied ?? {};
  const memory = reportAny.field_memory ?? {};
  return [
    ["证据包状态", safeExportText(pack.status ?? pack.export_status ?? sectionItemValue(vm, "EVIDENCE", "证据状态", ""), "证据包状态未返回")],
    ["实际执行摘要", safeExportText(asExecuted.summary ?? asExecuted.result_summary ?? asExecuted.deviation_summary ?? sectionItemValue(vm, "EXECUTION", "执行摘要", ""), "暂无实际执行摘要")],
    ["实际覆盖状态", safeExportText(asApplied.coverage_status ?? sectionItemValue(vm, "EXECUTION", "覆盖状态", ""), "暂无实际覆盖状态")],
    ["天气干扰", weatherSummaryFromReport(reportAny)],
    ["价值性质", sectionItemValue(vm, "ROI", "实测/估算/假设", "暂无价值性质")],
    ["田块记忆学习摘要", safeExportText(memory.learning_summary ?? memory.summary_text ?? sectionItemValue(vm, "MEMORY", "本次结果是否进入田块记忆", ""), "暂无田块记忆学习摘要")],
  ];
}

function pdiEvidenceBasisRows(report?: OperationReportV1 | null): Row[] {
  const pdi = operationReportObject(report).pest_disease_inspection ?? null;
  if (!isObject(pdi)) return [];
  const observation_evidence = isObject(pdi.observation_evidence) ? pdi.observation_evidence : {};
  const latest = isObject(observation_evidence.latest_observation) ? observation_evidence.latest_observation : {};
  return [
    ["inspection_id", safeExportText(pdi.inspection_id, "暂无巡检编号")],
    ["巡检验收", safeExportText(pdi.acceptance_status, "待复核")],
    ["客户可见", pdi.customer_visible_eligible === true ? "可展示" : "需补齐正式链路后展示"],
    ["图片/媒体证据", mediaRefsText(latest.media_refs)],
    ["采集时间", safeExportText(latest.captured_at_text, formatTs(latest.captured_at_ts))],
    ["采集位置", geoPointText(latest.geo_point)],
    ["采集设备", deviceProfileText(latest.device_profile)],
    ["现场备注", safeExportText(latest.scout_note, "暂无现场备注")],
    ["发生率", pct(latest.incidence_percent)],
    ["严重度", pct(latest.severity_percent)],
    ["影响面积", pct(latest.affected_area_percent)],
    ["证据质量", safeExportText(latest.evidence_quality, "待补充")],
    ["观察次数", `${Number(observation_evidence.total_observations ?? 0) || 0} 次`],
    ["阻塞原因", Array.isArray(pdi.blocking_reasons) && pdi.blocking_reasons.length ? pdi.blocking_reasons.map((x: unknown) => safeExportText(x, "")).filter(Boolean).join("、") : "无"],
  ];
}

function isPdiReport(report?: OperationReportV1 | null): boolean {
  const reportAny = operationReportObject(report);
  const scenario = String(reportAny.formal_scenario?.scenario_type ?? "").toUpperCase();
  return scenario === "FORMAL_PEST_DISEASE_INSPECTION" || Boolean(reportAny.pest_disease_inspection);
}

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const recentOperations = vm.recentOperations.slice(0, 5);
  const topRisks = vm.topRiskFields.slice(0, 5);
  return (
    <div className="customerCompactReport">
      <section className="customerCard"><h2 className="customerCardTitle">概览</h2><p className="customerSpacingTopSm">客户经营总览</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">高风险地块 Top 5</h2><PrintTable headers={["地块", "风险", "原因"]} rows={topRisks.map((item) => [safeExportText(item.fieldName, "地块名称待补充"), safeExportText(item.riskLabel, "风险待确认"), item.reasons.map((reason) => safeExportText(reason, "暂无风险原因")).join("；") || "暂无风险原因"])} emptyText="暂无高风险地块" /></section>
      <section className="customerCard"><h2 className="customerCardTitle">近期作业 Top 5</h2><PrintTable headers={["作业", "地块", "更新时间", "验收"]} rows={recentOperations.map((item) => [safeExportText(item.operationName, "作业名称待补充"), safeExportText(item.fieldName, "地块名称待补充"), safeExportText(item.updatedAtText, "暂无更新时间"), safeExportText(item.acceptanceText, "等待验收")])} emptyText="暂无近期作业" /></section>
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，仅供客户经营复盘与执行跟进使用。</p></footer>
    </div>
  );
}

export function FieldExportBlocks({ vm, report }: { vm: FieldReportPageVm; report?: FieldReportDetailV1 | null }): React.ReactElement {
  const reportAny = fieldReportObject(report);
  const recentOperationRows = vm.recentOperations.slice(0, 5).map((item) => [safeExportText(item.title, "作业名称待补充"), safeExportText(item.statusText, "状态待确认"), safeExportText(item.acceptanceText, "验收待确认"), safeExportText(item.updatedAtText, "暂无更新时间")]);
  return (
    <div className="customerCompactReport">
      <section className="customerCard"><h2 className="customerCardTitle">1. 地块摘要</h2><div className="customerGrid2 customerSpacingTopSm"><div><strong>地块名称：</strong>{safeExportText(vm.header.title, "地块名称待补充")}</div><div><strong>作业总数：</strong>{safeExportText(vm.overview.totalOperationsText, "0")}</div><div><strong>当前风险：</strong>{safeExportText(vm.risk.levelLabel, "风险待确认")}</div><div><strong>待验收：</strong>{safeExportText(vm.overview.pendingAcceptanceText, "0")}</div></div></section>
      <section className="customerCard"><h2 className="customerCardTitle">2. 风险与诊断</h2><p className="customerSpacingTopSm">{safeExportText(vm.explain.human, "暂无状态解释")} 当前风险：{safeExportText(vm.risk.levelLabel, "风险待确认")}。</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">3. 最近作业</h2><PrintTable headers={["作业", "状态", "验收", "更新时间"]} rows={recentOperationRows} emptyText="暂无最近作业" /></section>
      <section className="customerCard"><h2 className="customerCardTitle">4. 价值与田块记忆</h2><PrintTable headers={["项目", "内容"]} rows={[["价值摘要", safeExportText(vm.roiSummary.displayText, "暂无价值摘要")], ["田块记忆摘要", safeExportText(vm.fieldMemory.displayText, "暂无田块记忆摘要")], ["天气摘要", weatherSummaryFromReport(reportAny)]]} emptyText="暂无价值与田块记忆摘要" /></section>
    </div>
  );
}

export function OperationExportBlocks({ vm, report }: { vm: OperationReportPageVm; report?: OperationReportV1 | null }): React.ReactElement {
  const formalVm = buildFormalScenarioVm(report ?? {});
  const evidenceVm = buildEvidenceVm(report ?? {});
  const pdiRows = pdiEvidenceBasisRows(report);
  return (
    <div className="customerCompactReport">
      <section className="customerCard"><h2 className="customerCardTitle">作业报告头</h2><div className="customerGrid2 customerSpacingTopSm"><div><strong>作业：</strong>{safeExportText(vm.header.title, "作业名称待补充")}</div><div><strong>状态：</strong>{safeExportText(vm.operation.finalStatusLabel, "待确认")}</div><div><strong>正式场景：</strong>{safeExportText(formalVm.scenarioLabel, "待确认")}</div><div><strong>正式链路：</strong>{safeExportText(customerGuardedStatusText(report ?? {}), "需复核")}</div><div><strong>证据门禁：</strong>{safeExportText(customerGuardedEvidenceText(report ?? {}), "需复核")}</div><div><strong>验收门禁：</strong>{safeExportText(customerGuardedAcceptanceText(report ?? {}), "需复核")}</div></div></section>
      <section className="operationClosedLoopGrid">{vm.sections.map((item, index) => <article key={item.key} className="customerCard operationClosedLoopCard"><div className="operationClosedLoopHead"><span className="operationStepNo">{index + 1}</span><h2 className="customerCardTitle">{safeExportText(item.title, "作业环节")}</h2><span className="operationStatusBadge">{safeExportText(item.statusText ?? item.status, "待确认")}</span></div><p className="customerSpacingTopSm">{safeExportText(item.summary, "暂无摘要")}</p></article>)}</section>
      <section className="customerCard"><h2 className="customerCardTitle">作业报告同源摘要</h2><PrintTable headers={["项目", "导出内容"]} rows={buildOperationSameSourceExportRows(vm, report)} emptyText="暂无作业同源摘要" /></section>
      {isPdiReport(report) ? <section className="customerCard"><h2 className="customerCardTitle">病虫害巡检观察证据</h2><p className="customerMetricLabel customerSpacingTopXs">导出与页面同源读取 operation_report_v1.pest_disease_inspection.observation_evidence。</p><PrintTable headers={["项目", "内容"]} rows={pdiRows} emptyText="暂无巡检观察证据" /><p className="customerMetricLabel customerSpacingTopSm">边界说明：巡检证据通过 ≠ 已执行喷药；巡检证据通过 ≠ 防治闭环已结束；巡检证据通过 ≠ ROI / Field Memory。病虫害风险仍需后续处置闭环。</p></section> : null}
      <section className="customerCard"><h2 className="customerCardTitle">证据包摘要</h2><p className="customerMetricLabel customerSpacingTopXs">统一证据信任级别：{evidenceVm.trustLevel}</p><p className="customerSpacingTopSm">{safeExportText(vm.evidenceSummary.summary, "暂无有效证据")}</p><p className="customerMetricLabel customerSpacingTopXs">{safeExportText(vm.evidenceSummary.detail, "暂无补充说明")}</p></section>
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，供作业执行留痕与验收复盘使用。</p></footer>
    </div>
  );
}
