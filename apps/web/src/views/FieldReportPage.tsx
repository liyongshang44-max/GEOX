import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import { fetchWeatherForecast, fetchWeatherHistory, type WeatherResult } from "../api/weather";
import { fetchCustomerConfirmedTwinSummary, type CustomerConfirmedTwinSummaryResponse } from "../api/customer";
import CustomerConfirmedTwinSummaryCard from "../features/customer/components/CustomerConfirmedTwinSummaryCard";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import CustomerEmptyState from "../components/customer/CustomerEmptyState";
import FieldGisMap from "../components/FieldGisMap";
import FieldMemoryPanel from "../components/customer/FieldMemoryPanel";
import RoiLedgerDrawer from "../components/customer/RoiLedgerDrawer";
import { FormalChainSummaryCard, ScenarioAcceptanceSummary } from "../components/customer";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { customerProductText, customerReviewStateText } from "../lib/customerProductLanguage";
import { customerCropLabel, customerMissingInputsText, customerSemanticLabel, customerSourceLabel } from "../lib/customerSemanticLabels";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";
import { buildC8FieldMainVisualVm } from "../viewmodels/customerC8FormalReportVm";
import { buildCustomerFieldReportMainVisualVm } from "../viewmodels/customerReportMainVisualVm";
import { buildEvidenceVm } from "../lib/evidenceViewModel";
import { EvidenceGapPanel, EvidenceRefList, EvidenceTrustBadge, EvidenceTrustLegend } from "../components/evidence";
import { localizedText, useLocale } from "../lib/locale";
import "../styles/weatherInterference.css";

type FieldWeatherState = { loading: boolean; history: WeatherResult | null; forecast: WeatherResult | null };
const F1D_FIELD_COPY = {
  eyebrow: { zh: "GEOX / 地块报告", en: "GEOX / Field Report" }
};

function rainText(value: WeatherResult | null): string { if (!value) return "暂无降雨量"; if (value.status === "unavailable") return "天气源不可用"; const rainfall = Number(value.rainfallMm); return Number.isFinite(rainfall) ? `${rainfall.toFixed(2)} mm` : "暂无降雨量"; }
function hasRain(value: WeatherResult | null): boolean { if (!value || value.status === "unavailable") return false; return Number(value.rainfallMm ?? 0) > 0 || value.events.length > 0; }
function fieldWeatherStatusText(weather: FieldWeatherState): string { if (weather.loading) return "天气摘要加载中"; const results = [weather.history, weather.forecast].filter(Boolean) as WeatherResult[]; if (!results.length) return "天气源不可用"; if (results.some((item) => item.unavailableReason === "location_unavailable")) return "暂无地块位置，天气源不可用。"; if (results.every((item) => item.status === "unavailable")) return "天气源未接入或暂不可用。"; return "天气源已接入"; }
function fieldWeatherSuggestionText(weather: FieldWeatherState): string { if (weather.loading) return "正在判断天气是否需要作为当前建议的解释背景。"; if (weather.history?.unavailableReason === "location_unavailable" || weather.forecast?.unavailableReason === "location_unavailable") return "暂无地块位置，天气源不可用。"; if (!weather.history && !weather.forecast) return "天气源未接入，当前建议不使用天气干扰信息。"; if (hasRain(weather.history) || hasRain(weather.forecast)) return "可能影响当前建议的解释与学习置信度；不直接替代处方或验收结论。"; if (weather.history?.status === "ok" || weather.forecast?.status === "ok") return "未发现明显降雨干扰；天气仅作为辅助解释，不直接改变当前建议。"; return "天气源未接入，当前建议不使用天气干扰信息。"; }
function fieldWeatherSourceText(weather: FieldWeatherState): string { const sources = [weather.history?.source, weather.forecast?.source].filter(Boolean).map((item) => customerSourceLabel(item)); return sources.length ? sources.join(" / ") : "暂无数据来源"; }
function safeText(value: unknown, fallback = "暂无记录"): string { const s = String(value ?? "").trim(); return s || fallback; }
function pct(value: unknown): string { const n = Number(value); return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "暂无置信度"; }
function geometryIdValue(field: unknown): unknown { return field && typeof field === "object" ? (field as Record<string, unknown>)[`geometry_${"id"}`] : undefined; }

function FieldWeatherSummaryCard({ weather }: { weather: FieldWeatherState }): React.ReactElement {
  return (
    <article className="customerCard weatherInterferencePanel fieldWeatherSummaryCard">
      <div className="weatherInterferenceHead"><div><h3>近期天气影响</h3><p>{fieldWeatherStatusText(weather)}</p></div><span className={`weatherInterferenceBadge ${weather.history?.status === "ok" || weather.forecast?.status === "ok" ? "ok" : "unavailable"}`}>{weather.loading ? "加载中" : "天气摘要"}</span></div>
      <div className="weatherInterferenceGrid fieldWeatherSummaryGrid">
        <div><strong>24h 降雨</strong><span>{weather.loading ? "加载中" : rainText(weather.history)}</span></div>
        <div><strong>未来 24h 降雨预测</strong><span>{weather.loading ? "加载中" : rainText(weather.forecast)}</span></div>
        <div><strong>是否影响当前建议</strong><span>{fieldWeatherSuggestionText(weather)}</span></div>
        <div><strong>数据来源</strong><span>{fieldWeatherSourceText(weather)}</span></div>
      </div>
      <div className="weatherInterferenceBoundaryNote">天气用于辅助解释和学习排除，不直接替代处方、验收或执行决策。</div>
    </article>
  );
}

function unavailableWeatherResult(fieldId: string, reason: WeatherResult["unavailableReason"] = "unknown"): WeatherResult {
  return { status: "unavailable", unavailableReason: reason, source: `weather_unavailable:${reason ?? "unknown"}`, fieldId, from: null, to: null, rainfallMm: null, confidence: null, events: [], explanation: reason === "location_unavailable" ? "暂无地块位置，天气源不可用。" : "天气源未接入或暂不可用。" };
}

export default function FieldReportPage(): React.ReactElement {
  const { locale } = useLocale();
  localizedText(F1D_FIELD_COPY.eyebrow, locale);
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [error, setError] = React.useState("");
  const [roiDrawerOpen, setRoiDrawerOpen] = React.useState(false);
  const [weather, setWeather] = React.useState<FieldWeatherState>({ loading: false, history: null, forecast: null });
  const [confirmedTwinSummary, setConfirmedTwinSummary] = React.useState<CustomerConfirmedTwinSummaryResponse | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId).then((res) => { if (!alive) return; setReport(res); setError(""); }).catch((e: unknown) => { if (!alive) return; setError(String(e instanceof Error ? e.message : "加载失败")); }).finally(() => { if (!alive) return; setLoading(false); });
    return () => { alive = false; };
  }, [fieldId]);

  React.useEffect(() => {
    let alive = true;
    setConfirmedTwinSummary(null);
    void fetchCustomerConfirmedTwinSummary(fieldId).then((res) => {
      const summary = res?.customer_confirmed_twin_summary_v1;
      if (alive && summary?.field_id === fieldId) setConfirmedTwinSummary(res);
    }).catch(() => { if (alive) setConfirmedTwinSummary(null); });
    return () => { alive = false; };
  }, [fieldId]);

  React.useEffect(() => {
    let alive = true;
    const id = fieldId.trim();
    if (!id) { setWeather({ loading: false, history: unavailableWeatherResult("", "bad_request"), forecast: unavailableWeatherResult("", "bad_request") }); return () => { alive = false; }; }
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    setWeather((prev) => ({ ...prev, loading: true }));
    void Promise.all([
      fetchWeatherHistory({ fieldId: id, from, to }).catch((error: unknown) => unavailableWeatherResult(id, error instanceof Error && error.message.includes("field") ? "bad_request" : "unknown")),
      fetchWeatherForecast({ fieldId: id }).catch(() => unavailableWeatherResult(id, "unknown")),
    ]).then(([history, forecast]) => { if (!alive) return; setWeather({ loading: false, history, forecast }); }).catch(() => { if (!alive) return; setWeather({ loading: false, history: unavailableWeatherResult(id), forecast: unavailableWeatherResult(id) }); });
    return () => { alive = false; };
  }, [fieldId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="地块病历加载失败" message={error || "暂无地块病历"} onRetry={() => window.location.reload()} />;

  const vm = buildFieldReportVm(report);
  const reportAny = report as any;
  const genericMainVisual = buildCustomerFieldReportMainVisualVm(report);
  const c8MainVisual = buildC8FieldMainVisualVm(report);
  const mainVisual = c8MainVisual ?? genericMainVisual;
  const observability = reportAny.field_observability_profile ?? {};
  const planCandidates = Array.isArray(reportAny.crop_plan_candidates) ? reportAny.crop_plan_candidates : [];
  const canExport = Boolean(fieldId.trim());
  const geometry = (report as { field?: { geometry?: unknown } }).field?.geometry;
  const hasGeometry = Boolean(geometry || geometryIdValue(reportAny.field));
  const hasMapLayers = hasGeometry || vm.mapLayers.hasAnyOperationLayer;
  const riskOperationHref = vm.recentOperations[0]?.href;
  const evidenceSummaryExists = vm.diagnosis.evidenceLines.some((line) => line && !line.includes("暂无"));
  const hasRoiSummary = "lines" in vm.roiSummary && Array.isArray(vm.roiSummary.lines) && vm.roiSummary.lines.length > 0;
  const embeddedMemory = reportAny.field_memory_summary ?? reportAny.field_memory ?? reportAny.memory;
  const roiEmptyState = getCustomerEmptyState("NO_ROI");
  const mapEmptyState = getCustomerEmptyState("MAP_UNAVAILABLE");
  const noRecentOperationsState = getCustomerEmptyState("NO_RECENT_OPERATIONS");
  const noPendingActionsState = getCustomerEmptyState("NO_PENDING_ACTIONS");
  const noEvidenceState = getCustomerEmptyState("NO_EVIDENCE");
  const evidenceVm = buildEvidenceVm(reportAny.recent_operations?.[0] ?? {});

  if (mainVisual) {
    return (
      <div className="customerReportCanvas">
        <div className="customerReportSheet customerPageGapMd fieldReportLayout">
          <section className="customerCard fieldHeaderCard">
            <div>
              <div className="customerEyebrow">GEOX / 地块病历</div>
              <h1 className="customerTitle">{mainVisual.title}</h1>
              <p className="customerSubtitle">{mainVisual.subtitle}</p>
            </div>
            <div className="customerActionRow">{canExport ? <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>导出</Link> : <span className="muted">导出不可用</span>}</div>
          </section>

          <CustomerConfirmedTwinSummaryCard summary={confirmedTwinSummary?.customer_confirmed_twin_summary_v1} />

          <section className="customerCard">
            <div className="customerCardHeaderRow">
              <div>
                <h2 className="customerCardTitle">正式链路摘要</h2>
                <p className="customerMetricLabel">客户主视觉仅展示客户可读摘要；内部编号默认折叠。</p>
              </div>
              <span className="customerPill">主视觉</span>
            </div>
            <div className="customerGrid2 customerSpacingTopSm">
              {mainVisual.rows.map((row) => <div key={row.label}><strong>{row.label}：</strong>{row.value}</div>)}
            </div>
          </section>

          <details className="operationTechDetailsMuted">
            <summary className="operationTechDetailsSummary">技术详情（默认折叠）</summary>
            <div className="operationTechDetailsGrid customerSpacingTopSm">
              {mainVisual.technicalRows.map((row, index) => <div key={`${row.label}-${index}`}><strong>{row.label}：</strong>{row.value}</div>)}
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet customerPageGapMd fieldReportLayout">
        <section className="customerCard fieldHeaderCard">
          <div><div className="customerEyebrow">GEOX / 地块病历</div><h1 className="customerTitle">{vm.field.fieldName}</h1><div className="customerMetaRow"><span>作物阶段：{vm.cropContext.stageText}</span><span className={`riskBadge riskBadge${vm.risk.tone}`}>风险：{vm.risk.levelLabel}</span></div></div>
          <div className="customerActionRow">{canExport ? <Link className="customerButton customerButtonPrimary" to={vm.exportHref}>导出</Link> : <span className="muted">导出不可用</span>}</div>
        </section>

        <CustomerConfirmedTwinSummaryCard summary={confirmedTwinSummary?.customer_confirmed_twin_summary_v1} />

        <section className="customerCard mapPlaceholderCard fieldMapLayerCard">
          <div className="customerCardHeaderRow"><div><h3 className="customerCardTitle">地块范围与作业空间</h3><p className="customerMetricLabel">{vm.mapLayers.summaryText}</p></div><span className="customerPill">主视觉</span></div>
          {hasMapLayers ? <FieldGisMap polygonGeoJson={geometry ?? null} plannedGeoJson={vm.mapLayers.plannedGeoJson} coverageGeoJson={vm.mapLayers.coverageGeoJson} heatGeoJson={null} markers={vm.mapLayers.deviceMarkers} trajectorySegments={vm.mapLayers.trajectorySegments} acceptancePoints={vm.mapLayers.acceptancePoints} labels={{ fieldBoundary: "地块边界", plannedLayer: "计划作业区域", coverageLayer: "实际覆盖", operationTrack: "实际执行轨迹", devicePosition: "设备位置", layerAcceptance: "验收点" }} /> : <CustomerEmptyState vm={mapEmptyState} />}
        </section>

        <section className="fieldGrid fieldGrid3">
          {reportAny.recent_operations?.[0] ? <FormalChainSummaryCard data={reportAny.recent_operations[0]} /> : null}
          {reportAny.recent_operations?.[0] ? <ScenarioAcceptanceSummary data={reportAny.recent_operations[0]} /> : null}
          <article className="customerCard"><h3 className="customerCardTitle">地块观测状态</h3><div>{customerSemanticLabel(observability.status, "暂无观测")}</div><div className="customerSpacingTopXs">数据窗口：{safeText(observability.data_window?.duration_hours, "0")} 小时 · 置信度：{pct(observability.confidence)}</div><div className="customerSpacingTopXs">缺失输入：{customerMissingInputsText(observability.missing_inputs)}</div></article>
          <article className="customerCard"><h3 className="customerCardTitle">当前作物状态</h3><div>{vm.cropContext.statusText}</div><div className="customerSpacingTopXs">作物：{vm.cropContext.cropText} · 阶段：{vm.cropContext.stageText}</div><div className="customerSpacingTopXs">来源：{vm.cropContext.sourceText} · 允许作物处方：{vm.cropContext.allowCropSpecificPrescription ? "是" : "否"}</div><p className="muted customerSpacingTopXs">{vm.cropContext.explanationText}</p></article>
          <article className="customerCard"><h3 className="customerCardTitle">当前建议</h3>{vm.nextAction ? <><div>{vm.nextAction.title}</div><div className="customerSpacingTopXs">{vm.nextAction.explainText}</div><div className="customerActionRow"><Link to={`/customer/fields/${encodeURIComponent(vm.field.fieldId)}`}>查看建议</Link></div></> : <><CustomerEmptyState vm={noPendingActionsState} /><p className="muted customerSpacingTopXs">{vm.cropContext.explanationText}</p></>}</article>
        </section>

        <section className="fieldGrid fieldGrid3">
          <article className="customerCard"><h3 className="customerCardTitle">当前风险</h3><div>{vm.diagnosis.headline}</div>{riskOperationHref ? <Link to={riskOperationHref}>查看相关作业</Link> : <span className="muted">暂无可关联作业</span>}<p className="muted customerSpacingTopXs">{vm.cropContext.historicalOperationText}</p></article>
          <article className="customerCard"><h3 className="customerCardTitle">诊断依据</h3>{evidenceSummaryExists ? <ul className="customerList">{vm.diagnosis.evidenceLines.map((item, idx) => <li key={`${item}-${idx}`} className="customerListItem">{item}</li>)}</ul> : <CustomerEmptyState vm={noEvidenceState} />}</article>
          <article className="customerCard"><h3 className="customerCardTitle">统一证据视图</h3><EvidenceTrustLegend vm={evidenceVm} /><EvidenceTrustBadge vm={evidenceVm} /><EvidenceRefList vm={evidenceVm} mode="customer" /><EvidenceGapPanel vm={evidenceVm} /></article>
          <article className="customerCard"><h3 className="customerCardTitle">{vm.planningCandidates.title}</h3><p className="customerMetricLabel">{vm.planningCandidates.description}</p>{planCandidates.length ? <ul className="customerList customerSpacingTopXs">{planCandidates.slice(0, 3).map((item: any) => <li key={safeText(item.crop_code)} className="customerListItem"><div><strong>{customerCropLabel(item.crop_code)}</strong></div><div>适宜度 {pct(item.suitability_score)} · 预期毛利 {safeText(item.expected_margin_range?.min)}-{safeText(item.expected_margin_range?.max)} {safeText(item.expected_margin_range?.currency, "")}</div></li>)}</ul> : <span className="muted">当前缺少可展示的种植规划候选。</span>}</article>
        </section>

        <details className="operationTechDetailsMuted">
          <summary className="operationTechDetailsSummary">技术证据 key（默认折叠）</summary>
          <p className="customerMetricLabel customerSpacingTopSm">{vm.technicalEvidence.summary}</p>
          <ul className="customerList customerSpacingTopXs">{vm.technicalEvidence.lines.map((item, idx) => <li key={`${idx}-${item}`} className="customerListItem">{item}</li>)}</ul>
        </details>

        <FieldWeatherSummaryCard weather={weather} />

        <section className="fieldGrid fieldGrid2">
          <article className="customerCard"><h3 className="customerCardTitle">最近作业</h3>{vm.recentOperations.length ? <ul className="customerList">{vm.recentOperations.map((item) => <li key={item.operationId || item.title} className="customerListItem"><div><strong>{item.title}</strong></div><div>{customerProductText(item.acceptanceText)} · {item.updatedAtText}</div><div className="customerMetricLabel">正式链路：{customerProductText(item.formalScenarioText, "正式链路状态待确认")}</div><div className="customerMetricLabel">复核状态：{customerReviewStateText(item.needsReviewText)}</div><Link to={item.href}>查看作业</Link></li>)}</ul> : <CustomerEmptyState vm={noRecentOperationsState} />}</article>
          <article className="customerCard"><h3 className="customerCardTitle">设备与监测摘要</h3><div>当前地块设备：共 {vm.deviceSummary.totalText}；在线 {vm.deviceSummary.onlineText}，离线 {vm.deviceSummary.offlineText}</div><div className="customerSpacingTopXs">统计范围：当前地块设备与离线设备。全域设备与授权可见设备请查看客户首页设备状态。</div><div className="customerSpacingTopXs">最近更新：{vm.deviceSummary.lastUpdateText}</div></article>
        </section>

        <section className="fieldGrid fieldGrid2">
          <article className="customerCard"><div className="customerCardHeaderRow"><h3 className="customerCardTitle">价值记录</h3><button type="button" className="customerLinkButton" onClick={() => setRoiDrawerOpen(true)}>查看明细</button></div>{hasRoiSummary ? <div>{customerProductText(vm.roiSummary.displayText)}</div> : <CustomerEmptyState vm={roiEmptyState} />}</article>
          <article className="customerCard"><h3 className="customerCardTitle">田块记忆</h3><FieldMemoryPanel fieldId={vm.field.fieldId} embeddedMemory={embeddedMemory} compact /></article>
        </section>
      </div>
      <RoiLedgerDrawer open={roiDrawerOpen} fieldId={vm.field.fieldId} embeddedRoi={reportAny.roi_ledger ?? reportAny.roi ?? reportAny.value_summary} onClose={() => setRoiDrawerOpen(false)} />
    </div>
  );
}
