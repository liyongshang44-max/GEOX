import React from "react";
import type { OperationReportV1 } from "../../api/customerReports";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";

type Row = Array<string | number | undefined>;

type OperationSameSourceExportSummary = {
  evidencePackStatus: string;
  evidencePackSha256: string;
  asExecutedSummary: string;
  asAppliedCoverageStatus: string;
  weatherInterferenceSummary: string;
  roiNature: string;
  fieldMemoryLearningSummary: string;
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
  if (/s3:\/\//i.test(text) || /minio:\/\//i.test(text) || /https?:\/\//i.test(text)) return fallback;
  if (/(^|\s)\/[\w./-]+/.test(text) || /[A-Z]:\\[\w\\.-]+/i.test(text)) return fallback;
  if (/\b(secret|token|credential)\b/i.test(text) || /stack\s*trace/i.test(text) || /debug\s*json/i.test(text) || /\{\s*"/.test(text)) return fallback;
  return text;
}

function safeSha256(value: unknown, fallback = "后端未返回 sha256"): string {
  const text = String(value ?? "").trim();
  return /^[a-fA-F0-9]{64}$/.test(text) ? text.toLowerCase() : fallback;
}

function sectionItemValue(vm: OperationReportPageVm, key: OperationReportPageVm["sections"][number]["key"], label: string, fallback = "暂无记录"): string {
  const section = vm.sections.find((item) => item.key === key);
  const row = section?.items.find((item) => item.label === label || item.label.includes(label));
  return safeExportText(row?.value, fallback);
}

function operationReportObject(report?: OperationReportV1 | null): Record<string, any> {
  return report && typeof report === "object" ? report as unknown as Record<string, any> : {};
}

function weatherSummaryFromReport(reportAny: Record<string, any>): string {
  const weather = reportAny.weather_interference
    ?? reportAny.weatherInterference
    ?? reportAny.operation_environment_context
    ?? reportAny.environment_context
    ?? reportAny.environment
    ?? reportAny.weather
    ?? null;
  if (!weather || typeof weather !== "object") return "天气干扰摘要未接入报告同源数据。";

  const status = String(weather.status ?? weather.source_status ?? weather.weather_source_status ?? "").trim().toLowerCase();
  const explanation = safeExportText(weather.explanation ?? weather.summary ?? weather.summary_text ?? weather.interference_summary, "");
  if (explanation) return explanation;

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
  return "暂无天气干扰摘要。";
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
    "暂无 Field Memory 学习摘要。",
  );

  return {
    evidencePackStatus: evidenceStatus,
    evidencePackSha256: safeSha256(pack.sha256 ?? pack.checksum_sha256 ?? pack.checksum),
    asExecutedSummary,
    asAppliedCoverageStatus: coverageStatus,
    weatherInterferenceSummary: weatherSummaryFromReport(reportAny),
    roiNature: sectionItemValue(vm, "ROI", "实测/估算/假设", "暂无 ROI 性质。"),
    fieldMemoryLearningSummary: memoryLearning,
  };
}

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const dashboardKpis = vm.kpis.slice(0, 5);
  const nextActionTitles = vm.actionItems.map((item) => item.title).join(" · ") || "暂无待处理事项";
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
              <div className="customerMetricLabel">{item.label}</div>
              <div className="customerMetricValue">{item.value}{item.unit ?? ""}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">高风险地块 Top 5</h2>
        <PrintTable
          headers={["地块", "风险", "原因"]}
          rows={topRisks.map((item) => [item.fieldName || "地块名称待补充", item.riskLabel, item.reasons.join("；") || "暂无风险原因"])}
          emptyText={vm.emptyStates.NO_RISK_FIELDS?.title ?? "暂无高风险地块"}
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">近期作业 Top 5</h2>
        <PrintTable
          headers={["作业", "地块", "更新时间", "验收"]}
          rows={recentOperations.map((item) => [item.operationName, item.fieldName, item.updatedAtText, item.acceptanceText])}
          emptyText={vm.emptyStates.NO_RECENT_OPERATIONS?.title ?? "暂无近期作业"}
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">价值摘要</h2>
        {!roi.totalRoiItems ? (
          <p className="customerSpacingTopSm">{roi.emptyState?.title ?? vm.emptyStates.NO_ROI?.title ?? "暂无可量化价值记录"}</p>
        ) : (
          <div className="customerGrid2 customerSpacingTopSm">
            <div><strong>价值记录数量：</strong>{roi.totalRoiItems}</div>
            <div><strong>节水记录：</strong>{roi.waterSavedItems}</div>
            <div><strong>价值摘要：</strong>{roi.customerValueText || "暂无收益摘要"}</div>
            <div><strong>置信度：</strong>{roi.confidenceText || "暂无记录"}</div>
          </div>
        )}
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{nextActionTitles}</p></section>
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，仅供客户经营复盘与执行跟进使用。</p></footer>
    </div>
  );
}

export function FieldExportBlocks({ vm }: { vm: FieldReportPageVm }): React.ReactElement {
  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">摘要</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>地块名称：</strong>{vm.header.title}</div>
          <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
          <div><strong>当前风险：</strong>{vm.risk.levelLabel}</div>
          <div><strong>待验收：</strong>{vm.overview.pendingAcceptanceText}</div>
        </div>
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">风险/诊断</h2><p className="customerSpacingTopSm">{vm.explain.human}当前风险：{vm.risk.levelLabel}。</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{vm.nextAction?.objectiveText ?? "暂无新的处理建议"}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">价值与记忆</h2><div className="customerGrid2 customerSpacingTopSm"><div>{vm.roiSummary.displayText}</div><div>{vm.fieldMemory.displayText}</div></div></section>
      <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">{vm.currentStatus.summary}</p></section>
    </div>
  );
}

export function OperationExportBlocks({ vm, report }: { vm: OperationReportPageVm; report?: OperationReportV1 | null }): React.ReactElement {
  const sections = vm.sections;
  const sameSource = buildOperationSameSourceExportSummary(vm, report);
  const evidenceItems = vm.evidenceSummary.items
    .map((item) => [safeExportText(item.label), safeExportText(item.value)] as [string, string])
    .filter(([label, value]) => label !== "暂无记录" && value !== "暂无记录");
  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">作业报告头</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>作业：</strong>{vm.header.title}</div>
          <div><strong>状态：</strong>{vm.operation.finalStatusLabel}</div>
        </div>
      </section>
      <section className="operationClosedLoopGrid">
        {sections.map((item, index) => (
          <article key={item.key} className="customerCard operationClosedLoopCard">
            <div className="operationClosedLoopHead">
              <span className="operationStepNo">{index + 1}</span>
              <h2 className="customerCardTitle">{item.title}</h2>
              <span className="operationStatusBadge">{item.statusText ?? item.status}</span>
            </div>
            <p className="customerSpacingTopSm">{safeExportText(item.summary, "暂无摘要")}</p>
            {item.emptyState ? <p className="customerMetricLabel">{safeExportText(item.emptyState.title)}：{safeExportText(item.emptyState.description)}</p> : null}
          </article>
        ))}
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">P2.2 同源增强摘要</h2>
        <PrintTable
          headers={["项目", "导出内容"]}
          rows={[
            ["证据包状态", sameSource.evidencePackStatus],
            ["sha256", sameSource.evidencePackSha256],
            ["实际执行摘要", sameSource.asExecutedSummary],
            ["实际覆盖状态", sameSource.asAppliedCoverageStatus],
            ["天气干扰", sameSource.weatherInterferenceSummary],
            ["ROI 性质", sameSource.roiNature],
            ["Field Memory 学习摘要", sameSource.fieldMemoryLearningSummary],
          ]}
          emptyText="暂无 P2.2 同源增强摘要。"
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">证据包摘要</h2>
        <p className="customerSpacingTopSm">{safeExportText(vm.evidenceSummary.summary, "暂无有效证据。")}</p>
        <p className="customerMetricLabel customerSpacingTopXs">{safeExportText(vm.evidenceSummary.detail, "暂无补充说明")}</p>
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
