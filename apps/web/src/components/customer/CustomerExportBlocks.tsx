import React from "react";
import type { FieldReportDetailV1, OperationReportV1 } from "../../api/reports";
import { formatCustomerNumber, isUnsafeCustomerText, mapCustomerEnum } from "../../lib/customerSafeText";
import { buildFormalScenarioVm } from "../../lib/formalScenarioViewModel";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText } from "../../lib/customerTrustGate";
import { buildEvidenceVm } from "../../lib/evidenceViewModel";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";

type Row = Array<string | number | undefined>;

type OperationSameSourceExportSummary = {
  evidencePackStatus: string;
  asExecutedSummary: string;
  asAppliedCoverageStatus: string;
  weatherInterferenceSummary: string;
  valueNature: string;
  fieldMemoryLearningSummary: string;
};

type FieldSameSourceExportSummary = {
  rangeStatus: string;
  recentOperationCoverageStatus: string;
  weatherSummary: string;
  valueSummary: string;
  fieldMemorySummary: string;
};

function PrintTable({ headers, rows, emptyText }: { headers: string[]; rows: Row[]; emptyText: string }): React.ReactElement {
  if (!rows.length) {
    return <p className="customerMetricLabel customerSpacingTopSm">{emptyText}</p>;
  }

  return (
    <table className="printTable customerSpacingTopSm">
      <thead>
        <tr>{headers.map((item) => <th key={item}>{item}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${index}-${row.join("-")}`}>
            {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell || "暂无记录"}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function safeExportText(value: unknown, fallback = "暂无记录"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "[object Object]") return fallback;
  const mapped = mapCustomerEnum(text, "generic");
  if (isUnsafeCustomerText(text)) return mapped && mapped !== text ? mapped : fallback;
  if (/s3:\/\//i.test(text) || /minio:\/\//i.test(text) || /https?:\/\//i.test(text)) return fallback;
  if (/(^|\s)\/[\w./-]+/.test(text) || /[A-Z]:\\[\w\\.-]+/i.test(text)) return fallback;
  if (/\b(secret|token|credential)\b/i.test(text) || /stack\s*trace/i.test(text) || /debug\s*json/i.test(text) || /\{\s*"/.test(text)) return fallback;

  return mapped
    .replace(/\bField Memory\b/g, "田块记忆")
    .replace(/\bROI\b/g, "价值记录")
    .replace(/\bgeometry\b/gi, "地块范围");
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isGeoJsonLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = String(value.type ?? "");
  if (type === "FeatureCollection") return Array.isArray(value.features) && value.features.length > 0;
  if (type === "Feature") return isGeoJsonLike(value.geometry);
  if (["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(type)) return Array.isArray(value.coordinates);
  return false;
}

function featureCount(value: unknown): number {
  if (!isObject(value)) return 0;
  const type = String(value.type ?? "");
  if (type === "FeatureCollection") return Array.isArray(value.features) ? value.features.filter(isGeoJsonLike).length : 0;
  return isGeoJsonLike(value) ? 1 : 0;
}

function sectionItemValue(vm: OperationReportPageVm, key: OperationReportPageVm["sections"][number]["key"], label: string, fallback = "暂无记录"): string {
  const section = vm.sections.find((item) => item.key === key);
  const row = section?.items.find((item) => item.label === label || item.label.includes(label));
  return safeExportText(row?.value, fallback);
}

function operationReportObject(report?: OperationReportV1 | null): Record<string, any> {
  return report && typeof report === "object" ? report as unknown as Record<string, any> : {};
}

function fieldReportObject(report?: FieldReportDetailV1 | null): Record<string, any> {
  return report && typeof report === "object" ? report as unknown as Record<string, any> : {};
}

function weatherSummaryFromReport(reportAny: Record<string, any>): string {
  const weather = reportAny.weather_interference
    ?? reportAny.weatherInterference
    ?? reportAny.weather_summary
    ?? reportAny.weatherSummary
    ?? reportAny.field_weather_summary
    ?? reportAny.fieldWeatherSummary
    ?? reportAny.operation_environment_context
    ?? reportAny.environment_context
    ?? reportAny.environment
    ?? reportAny.weather
    ?? null;
  if (!weather || typeof weather !== "object") return "天气摘要未接入报告同源数据。";

  const status = String(weather.status ?? weather.source_status ?? weather.weather_source_status ?? "").trim().toLowerCase();
  const explanation = safeExportText(weather.explanation ?? weather.summary ?? weather.summary_text ?? weather.interference_summary, "");
  if (explanation) return explanation;

  const rainfall = Number(weather.rainfall_mm ?? weather.rainfallMm ?? weather.total_rainfall_mm ?? weather.totalRainfallMm ?? weather.rain_mm);
  const futureRainfall = Number(weather.forecast_rainfall_mm ?? weather.forecastRainfallMm ?? weather.next_24h_rainfall_mm ?? weather.future_24h_rainfall_mm);
  if (Number.isFinite(rainfall) || Number.isFinite(futureRainfall)) {
    const rainText = Number.isFinite(rainfall) ? formatCustomerNumber(rainfall, { maximumFractionDigits: 2, unit: " mm" }) : "暂无记录";
    const forecastText = Number.isFinite(futureRainfall) ? formatCustomerNumber(futureRainfall, { maximumFractionDigits: 2, unit: " mm" }) : "暂无记录";
    return `24h 降雨：${rainText}；未来 24h 降雨预测：${forecastText}。天气仅用于辅助解释和学习排除。`;
  }

  const learningExcluded = Boolean(
    weather.learningWeatherInterferenceExcluded
    ?? weather.learning_weather_interference_excluded
    ?? weather.learning_excluded
    ?? weather.exclude_learning
    ?? weather.excluded_from_learning,
  );
  if (learningExcluded) return "因降雨干扰，本次结果未进入灌溉效果学习。";

  const rainfallMayExplain = Boolean(
    weather.rainfallMayExplainSoilMoistureChange
    ?? weather.rainfall_may_explain_soil_moisture_change
    ?? weather.rainfall_interference
    ?? weather.rainfall_detected,
  );
  if (rainfallMayExplain) return "检测到降雨事件，本次土壤湿度变化可能受天气影响；相关学习结论需排除或降低置信度。";

  if (["unavailable", "location_unavailable", "provider_error"].includes(status)) return "天气源未接入或当前位置不可用，当前不参与验收判断。";
  if (status === "ok") return "未发现明确天气干扰；天气仅用于辅助解释和学习排除，不直接替代验收结论。";
  return "暂无天气摘要。";
}

function buildOperationSameSourceExportSummary(vm: OperationReportPageVm, report?: OperationReportV1 | null): OperationSameSourceExportSummary {
  const reportAny = operationReportObject(report);
  const pack = reportAny.evidence_pack_summary ?? reportAny.evidencePackSummary ?? {};
  const asExecuted = reportAny.as_executed ?? reportAny.asExecuted ?? {};
  const asApplied = reportAny.as_applied ?? reportAny.asApplied ?? {};
  const memory = reportAny.field_memory ?? reportAny.fieldMemory ?? {};

  const evidenceStatus = safeExportText(
    pack.status ?? pack.export_status ?? sectionItemValue(vm, "EVIDENCE", "证据状态", ""),
    "证据包状态未返回",
  );

  const asExecutedSummary = safeExportText(
    asExecuted.summary ?? asExecuted.result_summary ?? asExecuted.deviation_summary ?? sectionItemValue(vm, "EXECUTION", "执行摘要", ""),
    "暂无实际执行摘要。",
  );

  const coverageStatus = safeExportText(
    asApplied.coverage_status ?? asApplied.coverageStatus ?? sectionItemValue(vm, "EXECUTION", "覆盖状态", ""),
    "暂无实际覆盖状态。",
  );

  const memoryLearning = safeExportText(
    memory.learning_summary
      ?? memory.learningSummary
      ?? memory.summary_text
      ?? memory.ingested
      ?? memory.recorded
      ?? memory.entered
      ?? sectionItemValue(vm, "MEMORY", "本次结果是否进入田块记忆", ""),
    "暂无田块记忆学习摘要。",
  );

  return {
    evidencePackStatus: evidenceStatus,
    asExecutedSummary,
    asAppliedCoverageStatus: coverageStatus,
    weatherInterferenceSummary: weatherSummaryFromReport(reportAny),
    valueNature: sectionItemValue(vm, "ROI", "实测/估算/假设", "暂无价值性质。"),
    fieldMemoryLearningSummary: memoryLearning,
  };
}

function buildFieldSameSourceExportSummary(vm: FieldReportPageVm, report?: FieldReportDetailV1 | null): FieldSameSourceExportSummary {
  const reportAny = fieldReportObject(report);
  const field = reportAny.field ?? {};
  const boundary = field.geometry ?? reportAny.geometry ?? reportAny.field_geometry ?? reportAny.fieldGeometry;
  const rangeStatus = isGeoJsonLike(boundary)
    ? `地块范围已接入（${featureCount(boundary)} 个空间对象）。`
    : "暂无地块范围，导出版不绘制或伪造地块范围。";

  const layerParts = [
    vm.mapLayers.plannedGeoJson ? "计划区域已接入" : "暂无计划区域",
    vm.mapLayers.coverageGeoJson ? "实际覆盖已接入" : "暂无实际覆盖",
    vm.mapLayers.trajectorySegments.length ? `${vm.mapLayers.trajectorySegments.length} 条执行轨迹` : "暂无执行轨迹",
    vm.mapLayers.acceptancePoints.length ? `${vm.mapLayers.acceptancePoints.length} 个验收点` : "暂无验收点",
    vm.mapLayers.deviceMarkers.length ? `${vm.mapLayers.deviceMarkers.length} 个设备点` : "暂无设备点",
  ];
  const recentOperationCoverageStatus = vm.mapLayers.hasAnyOperationLayer
    ? `${safeExportText(vm.mapLayers.summaryText, "已接入作业空间图层。")}；${layerParts.join("；")}。`
    : "暂无近期作业覆盖图层，导出版不伪造覆盖、轨迹或验收点。";

  return {
    rangeStatus,
    recentOperationCoverageStatus,
    weatherSummary: weatherSummaryFromReport(reportAny),
    valueSummary: safeExportText(vm.roiSummary.displayText, "暂无价值摘要。"),
    fieldMemorySummary: safeExportText(vm.fieldMemory.displayText, "暂无田块记忆摘要。"),
  };
}

function fieldObservabilityRows(report?: FieldReportDetailV1 | null): Row[] {
  const reportAny = fieldReportObject(report);
  const profile = reportAny.field_observability_profile ?? {};
  const confidence = Number(profile.confidence);
  return [
    ["观测状态", safeExportText(profile.status, "观测状态待确认")],
    ["缺失输入", Array.isArray(profile.missing_inputs) && profile.missing_inputs.length ? profile.missing_inputs.map((item: unknown) => safeExportText(item, "待补充输入")).join("、") : "无"],
    ["数据窗口", profile.data_window?.duration_hours ? `${profile.data_window.duration_hours} 小时` : "暂无数据窗口"],
    ["置信度", Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "暂无置信度"],
  ];
}

function fieldRecentOperationRows(vm: FieldReportPageVm): Row[] {
  return vm.recentOperations.slice(0, 5).map((item) => [
    safeExportText(item.title, "作业名称待补充"),
    safeExportText(item.statusText, "状态待确认"),
    safeExportText(item.acceptanceText, "验收待确认"),
    safeExportText(item.updatedAtText, "暂无更新时间"),
  ]);
}

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const dashboardKpis = vm.kpis.slice(0, 5);
  const nextActionTitles = vm.actionItems.map((item) => safeExportText(item.title, "待处理事项")).join(" · ") || "暂无待处理事项";
  const recentOperations = vm.recentOperations.slice(0, 5);
  const topRisks = vm.topRiskFields.slice(0, 5);
  const roi = vm.roiSummary;

  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">概览</h2>
        <div className="customerDashboardKpiRow customerSpacingTopSm">
          {dashboardKpis.map((item) => (
            <article key={item.key} className="customerMetricCard">
              <div className="customerMetricLabel">{safeExportText(item.label, "指标")}</div>
              <div className="customerMetricValue">{safeExportText(item.value, "0")}{item.unit ?? ""}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">高风险地块 Top 5</h2>
        <PrintTable
          headers={["地块", "风险", "原因"]}
          rows={topRisks.map((item) => [safeExportText(item.fieldName, "地块名称待补充"), safeExportText(item.riskLabel, "风险待确认"), item.reasons.map((reason) => safeExportText(reason, "暂无风险原因")).join("；") || "暂无风险原因"])}
          emptyText={vm.emptyStates.NO_RISK_FIELDS?.title ?? "暂无高风险地块"}
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">近期作业 Top 5</h2>
        <PrintTable
          headers={["作业", "地块", "更新时间", "验收"]}
          rows={recentOperations.map((item) => [safeExportText(item.operationName, "作业名称待补充"), safeExportText(item.fieldName, "地块名称待补充"), safeExportText(item.updatedAtText, "暂无更新时间"), safeExportText(item.acceptanceText, "等待验收")])}
          emptyText={vm.emptyStates.NO_RECENT_OPERATIONS?.title ?? "暂无近期作业"}
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">价值摘要</h2>
        {!roi.totalRoiItems ? (
          <p className="customerSpacingTopSm">{roi.emptyState?.title ?? vm.emptyStates.NO_ROI?.title ?? "暂无可量化价值记录"}</p>
        ) : (
          <div className="customerGrid2 customerSpacingTopSm">
            <div><strong>价值记录数量：</strong>{formatCustomerNumber(roi.totalRoiItems, { fallback: "0", maximumFractionDigits: 0 })}</div>
            <div><strong>节水记录：</strong>{formatCustomerNumber(roi.waterSavedItems, { fallback: "0", maximumFractionDigits: 0 })}</div>
            <div><strong>价值摘要：</strong>{safeExportText(roi.customerValueText, "暂无收益摘要")}</div>
            <div><strong>置信度：</strong>{safeExportText(roi.confidenceText, "暂无记录")}</div>
          </div>
        )}
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{nextActionTitles}</p></section>
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，仅供客户经营复盘与执行跟进使用。</p></footer>
    </div>
  );
}

export function FieldExportBlocks({ vm, report }: { vm: FieldReportPageVm; report?: FieldReportDetailV1 | null }): React.ReactElement {
  const sameSource = buildFieldSameSourceExportSummary(vm, report);
  const recentOperationRows = fieldRecentOperationRows(vm);
  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">1. 地块摘要</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>地块名称：</strong>{safeExportText(vm.header.title, "地块名称待补充")}</div>
          <div><strong>作业总数：</strong>{safeExportText(vm.overview.totalOperationsText, "0")}</div>
          <div><strong>当前风险：</strong>{safeExportText(vm.risk.levelLabel, "风险待确认")}</div>
          <div><strong>待验收：</strong>{safeExportText(vm.overview.pendingAcceptanceText, "0")}</div>
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">2. 地块范围与观测状态</h2>
        <PrintTable
          headers={["项目", "内容"]}
          rows={[
            ["地块范围状态", sameSource.rangeStatus],
            ["近期作业覆盖状态", sameSource.recentOperationCoverageStatus],
            ...fieldObservabilityRows(report),
            ["天气摘要", sameSource.weatherSummary],
          ]}
          emptyText="暂无地块范围与观测状态。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">3. 当前作物状态</h2>
        <PrintTable
          headers={["项目", "内容"]}
          rows={[
            ["作物状态", safeExportText(vm.cropContext.statusText, "未确认")],
            ["作物", safeExportText(vm.cropContext.cropText, "作物待确认")],
            ["阶段", safeExportText(vm.cropContext.stageText, "阶段待确认")],
            ["来源", safeExportText(vm.cropContext.sourceText, "来源待确认")],
            ["说明", safeExportText(vm.cropContext.explanationText, "暂无作物上下文说明")],
          ]}
          emptyText="暂无当前作物状态。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">4. 风险与诊断</h2>
        <p className="customerSpacingTopSm">{safeExportText(vm.explain.human, "暂无状态解释")} 当前风险：{safeExportText(vm.risk.levelLabel, "风险待确认")}。</p>
        <PrintTable headers={["诊断依据", "说明"]} rows={vm.diagnosis.evidenceLines.map((item, index) => [`依据 ${index + 1}`, safeExportText(item, "暂无诊断依据")])} emptyText="暂无诊断依据。" />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">5. 当前建议</h2>
        {vm.nextAction ? (
          <PrintTable
            headers={["项目", "内容"]}
            rows={[
              ["建议", safeExportText(vm.nextAction.title, "暂无建议")],
              ["目标", safeExportText(vm.nextAction.objectiveText, "暂无目标")],
              ["优先级", safeExportText(vm.nextAction.priorityText, "优先级待确认")],
              ["说明", safeExportText(vm.nextAction.explainText, "暂无说明")],
            ]}
            emptyText="暂无当前建议。"
          />
        ) : <p className="customerSpacingTopSm">{safeExportText(vm.cropContext.explanationText, "暂无新的处理建议")}</p>}
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">6. 最近作业</h2>
        <PrintTable
          headers={["作业", "状态", "验收", "更新时间"]}
          rows={recentOperationRows}
          emptyText="暂无最近作业。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">7. 证据与验收</h2>
        <PrintTable
          headers={["项目", "内容"]}
          rows={[
            ["待验收作业", safeExportText(vm.overview.pendingAcceptanceText, "0")],
            ["最近作业验收", safeExportText(vm.recentOperations[0]?.acceptanceText, "暂无验收记录")],
            ["最近作业证据", safeExportText(vm.recentOperations[0]?.evidenceText, "暂无证据摘要")],
          ]}
          emptyText="暂无证据与验收摘要。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">8. 价值与田块记忆</h2>
        <PrintTable
          headers={["项目", "内容"]}
          rows={[
            ["价值摘要", sameSource.valueSummary],
            ["田块记忆摘要", sameSource.fieldMemorySummary],
          ]}
          emptyText="暂无价值与田块记忆摘要。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">9. 最终结论</h2>
        <p className="customerSpacingTopSm">{safeExportText(vm.currentStatus.summary, "暂无最终结论")}</p>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">地块数据完整性摘要</h2>
        <PrintTable
          headers={["项目", "内容"]}
          rows={[
            ["地块范围状态", sameSource.rangeStatus],
            ["近期作业覆盖状态", sameSource.recentOperationCoverageStatus],
            ["价值摘要", sameSource.valueSummary],
            ["田块记忆摘要", sameSource.fieldMemorySummary],
          ]}
          emptyText="暂无地块数据完整性摘要。"
        />
      </section>
    </div>
  );
}

export function OperationExportBlocks({ vm, report }: { vm: OperationReportPageVm; report?: OperationReportV1 | null }): React.ReactElement {
  const sections = vm.sections;
  const sameSource = buildOperationSameSourceExportSummary(vm, report);
  const formalVm = buildFormalScenarioVm(report ?? {});
  const evidenceVm = buildEvidenceVm(report ?? {});
  const evidenceItems = vm.evidenceSummary.items
    .map((item) => [safeExportText(item.label), safeExportText(item.value)] as [string, string])
    .filter(([label, value]) => label !== "暂无记录" && value !== "暂无记录");
  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">作业报告头</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>作业：</strong>{safeExportText(vm.header.title, "作业名称待补充")}</div>
          <div><strong>状态：</strong>{safeExportText(vm.operation.finalStatusLabel, "待确认")}</div>
          <div><strong>正式场景：</strong>{safeExportText(formalVm.scenarioLabel, "待确认")}</div>
          <div><strong>正式链路：</strong>{safeExportText(customerGuardedStatusText(report ?? {}), "需复核")}</div>
          <div><strong>证据门禁：</strong>{safeExportText(customerGuardedEvidenceText(report ?? {}), "需复核")}</div>
          <div><strong>验收门禁：</strong>{safeExportText(customerGuardedAcceptanceText(report ?? {}), "需复核")}</div>
        </div>
      </section>
      <section className="operationClosedLoopGrid">
        {sections.map((item, index) => (
          <article key={item.key} className="customerCard operationClosedLoopCard">
            <div className="operationClosedLoopHead">
              <span className="operationStepNo">{index + 1}</span>
              <h2 className="customerCardTitle">{safeExportText(item.title, "作业环节")}</h2>
              <span className="operationStatusBadge">{safeExportText(item.statusText ?? item.status, "待确认")}</span>
            </div>
            <p className="customerSpacingTopSm">{safeExportText(item.summary, "暂无摘要")}</p>
            {item.emptyState ? <p className="customerMetricLabel">{safeExportText(item.emptyState.title)}：{safeExportText(item.emptyState.description)}</p> : null}
          </article>
        ))}
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">作业报告同源摘要</h2>
        <PrintTable
          headers={["项目", "导出内容"]}
          rows={[
            ["证据包状态", sameSource.evidencePackStatus],
            ["实际执行摘要", sameSource.asExecutedSummary],
            ["实际覆盖状态", sameSource.asAppliedCoverageStatus],
            ["天气干扰", sameSource.weatherInterferenceSummary],
            ["价值性质", sameSource.valueNature],
            ["田块记忆学习摘要", sameSource.fieldMemoryLearningSummary],
          ]}
          emptyText="暂无作业同源摘要。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">证据包摘要</h2>
        <p className="customerMetricLabel customerSpacingTopXs">统一证据信任级别：{evidenceVm.trustLevel}</p>
        <p className="customerSpacingTopSm">{safeExportText(vm.evidenceSummary.summary, "暂无有效证据。")}</p>
        <p className="customerMetricLabel customerSpacingTopXs">{safeExportText(vm.evidenceSummary.detail, "暂无补充说明")}</p>
        {evidenceVm.gaps.length ? <p className="customerMetricLabel customerSpacingTopXs">证据缺口：{safeExportText(evidenceVm.gaps.join("、"), "暂无")}</p> : null}
        {evidenceItems.length ? (
          <div className="customerGrid2 customerSpacingTopXs">
            {evidenceItems.map(([label, value]) => <div key={label}><strong>{label}：</strong>{value}</div>)}
          </div>
        ) : null}
      </section>
      {vm.technicalFoldout?.rows?.length ? (
        <details className="operationTechDetailsMuted">
          <summary className="operationTechDetailsSummary">技术附录（默认关闭）</summary>
          <p className="customerMetricLabel customerSpacingTopSm">默认客户版不突出内部技术字段，仅排障时查看。</p>
          <div className="operationTechDetailsGrid">
            {vm.technicalFoldout.rows.map((row) => <div key={row.label} className="customerMetricLabel"><strong>{safeExportText(row.label)}：</strong>{safeExportText(row.value)}</div>)}
          </div>
        </details>
      ) : null}
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，供作业执行留痕与验收复盘使用。</p></footer>
    </div>
  );
}
