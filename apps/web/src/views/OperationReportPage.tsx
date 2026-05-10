import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import { fetchOperationEnvironmentContext, type OperationEnvironmentContext } from "../api/weather";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import EvidencePackSummaryPanel from "../components/customer/EvidencePackSummaryPanel";
import FieldMemoryPanel from "../components/customer/FieldMemoryPanel";
import PrescriptionContractDrawer from "../components/customer/PrescriptionContractDrawer";
import RoiLedgerDrawer from "../components/customer/RoiLedgerDrawer";
import WeatherInterferencePanel from "../components/customer/WeatherInterferencePanel";
import FieldGisMap from "../components/FieldGisMap";
import { customerTimelineStatusLabel, labelCustomerTechnicalField } from "../lib/customerLabels";
import { safeEvidenceDownloadUrl } from "../lib/evidenceDownloadSafety";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";

const MAIN_VIEW_BLOCK_PATTERNS = [
  /skill\s*run/i,
  /skill_run/i,
  /skill_trace/i,
  /irrigation_soil_moisture_threshold/i,
  /\b[A-Z][A-Z0-9_]{3,}\b/,
];

const CUSTOMER_EVIDENCE_BLOCK_PATTERNS = [
  /s3:\/\//i,
  /minio:\/\//i,
  /https?:\/\//i,
  /(^|\s)\/[\w./-]+/,
  /[A-Z]:\\[\w\\.-]+/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bcredential\b/i,
  /stack\s*trace/i,
  // customer-boundary-allow: customer evidence sanitizer blocks unsafe structured metadata from report payload
  /debug\s*json/i,
  /\{\s*"/,
];

type EvidencePackSafeMetadata = {
  manifest: string | null;
  sha256: string | null;
  downloadUrl: string | null;
};

type OperationSpatialTrajectorySegment = {
  id: string;
  status: "READY" | "DISPATCHED" | "SUCCEEDED" | "FAILED";
  color: string;
  coordinates: Array<[number, number]>;
  label?: string;
};

type OperationSpatialExecutionVm = {
  plannedGeoJson: unknown | null;
  coverageGeoJson: unknown | null;
  trajectorySegments: OperationSpatialTrajectorySegment[];
  planStatusText: string;
  coverageStatusText: string;
  trajectoryStatusText: string;
  deviationText: string;
  deviationEvidenceText: string;
  hasDeviationEvidence: boolean;
  hasAnySpatialLayer: boolean;
};

function customerText(value: unknown, fallback = "暂无可展示信息"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "0/0" || /1970\s*[\/-]/.test(text)) return fallback;
  return text;
}

function shouldHideMainViewText(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return text.length > 0 && MAIN_VIEW_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
}

function safeMainViewText(value: unknown, fallback = "暂无摘要"): string {
  return shouldHideMainViewText(value) ? fallback : String(value ?? "").trim() || fallback;
}

function toSafeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "[object Object]") return null;
  if (CUSTOMER_EVIDENCE_BLOCK_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return text;
}

function safeManifest(value: unknown): string | null {
  const text = toSafeText(value);
  if (!text) return null;
  if (text.includes("/") || text.includes("\\")) return null;
  return text.length <= 120 ? text : null;
}

function safeSha256(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^[a-fA-F0-9]{64}$/.test(text) ? text.toLowerCase() : null;
}

function evidencePackSafeMetadata(report: OperationReportV1): EvidencePackSafeMetadata {
  const pack = (report as unknown as { evidence_pack_summary?: Record<string, unknown> }).evidence_pack_summary ?? {};
  return {
    manifest: safeManifest(pack.manifest),
    sha256: safeSha256(pack.sha256),
    downloadUrl: safeEvidenceDownloadUrl(pack.download_url),
  };
}

function EvidencePackMetadataBlock({ metadata }: { metadata: EvidencePackSafeMetadata }): React.ReactElement | null {
  if (!metadata.manifest && !metadata.sha256 && !metadata.downloadUrl) return null;
  return (
    <div className="customerGrid2 customerSpacingTopXs">
      {metadata.manifest ? <div><strong>证据清单：</strong>{metadata.manifest}</div> : null}
      {metadata.sha256 ? <div><strong>校验值：</strong>{metadata.sha256}</div> : null}
      {metadata.downloadUrl ? <div><strong>下载入口：</strong><a className="customerLinkButton" href={metadata.downloadUrl}>下载证据包</a></div> : null}
    </div>
  );
}

function shortOperationLabel(value: string): string {
  const text = value.trim();
  if (/处方/.test(text)) return "处方";
  if (/as-executed|执行/i.test(text)) return "执行";
  if (/field\s*memory|田块记忆|记忆/i.test(text)) return "记忆";
  if (/recommendation|建议/i.test(text)) return "建议";
  if (/approval|审批/i.test(text)) return "审批";
  if (/evidence|证据/i.test(text)) return "证据";
  if (/acceptance|验收/i.test(text)) return "验收";
  if (/roi|价值记录/i.test(text)) return "价值";
  return text;
}

function isGeoJsonLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, any>;
  const type = String(obj.type ?? "");
  if (type === "FeatureCollection") return Array.isArray(obj.features) && obj.features.length > 0;
  if (type === "Feature") return isGeoJsonLike(obj.geometry);
  if (["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(type)) return Array.isArray(obj.coordinates);
  return false;
}

function firstGeoJson(...values: unknown[]): unknown | null {
  for (const value of values) {
    if (isGeoJsonLike(value)) return value;
  }
  return null;
}

function collectCoordinatePairs(raw: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(raw)) return;
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
    out.push([Number(raw[0]), Number(raw[1])]);
    return;
  }
  for (const item of raw) collectCoordinatePairs(item, out);
}

function lineStringsFromGeoJson(value: unknown): Array<Array<[number, number]>> {
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, any>;
  const type = String(obj.type ?? "");
  if (type === "Feature") return lineStringsFromGeoJson(obj.geometry);
  if (type === "FeatureCollection") return Array.isArray(obj.features) ? obj.features.flatMap((item) => lineStringsFromGeoJson(item)) : [];
  if (type === "LineString") {
    const pairs: Array<[number, number]> = [];
    collectCoordinatePairs(obj.coordinates, pairs);
    return pairs.length >= 2 ? [pairs] : [];
  }
  if (type === "MultiLineString") {
    return Array.isArray(obj.coordinates)
      ? obj.coordinates.flatMap((line: unknown) => {
        const pairs: Array<[number, number]> = [];
        collectCoordinatePairs(line, pairs);
        return pairs.length >= 2 ? [pairs] : [];
      })
      : [];
  }
  return [];
}

function trajectorySegmentsFrom(value: unknown): OperationSpatialTrajectorySegment[] {
  if (!value) return [];
  if (isGeoJsonLike(value)) {
    return lineStringsFromGeoJson(value).map((coordinates, index) => ({
      id: `trajectory_${index + 1}`,
      status: "SUCCEEDED" as const,
      color: "#2563eb",
      coordinates,
      label: `实际轨迹 ${index + 1}`,
    }));
  }
  if (Array.isArray(value)) {
    const segments: OperationSpatialTrajectorySegment[] = [];
    value.forEach((item, index) => {
      if (isGeoJsonLike(item)) {
        segments.push(...trajectorySegmentsFrom(item).map((segment, inner) => ({ ...segment, id: `trajectory_${index + 1}_${inner + 1}` })));
        return;
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, any>;
        const coordinates: Array<[number, number]> = [];
        collectCoordinatePairs(obj.coordinates ?? obj.points ?? obj.path, coordinates);
        if (coordinates.length >= 2) {
          segments.push({
            id: String(obj.id ?? obj.segment_id ?? `trajectory_${index + 1}`),
            status: String(obj.status ?? "SUCCEEDED").toUpperCase().includes("FAIL") ? "FAILED" : "SUCCEEDED",
            color: "#2563eb",
            coordinates,
            label: customerText(obj.label ?? obj.name, `实际轨迹 ${index + 1}`),
          });
        }
        return;
      }
      const coordinates: Array<[number, number]> = [];
      collectCoordinatePairs(item, coordinates);
      if (coordinates.length >= 2) {
        segments.push({ id: `trajectory_${index + 1}`, status: "SUCCEEDED", color: "#2563eb", coordinates, label: `实际轨迹 ${index + 1}` });
      }
    });
    return segments;
  }
  return [];
}

function buildOperationSpatialExecutionVm(report: OperationReportV1): OperationSpatialExecutionVm {
  const reportAny = report as any;
  const asExecuted = reportAny.as_executed ?? {};
  const asApplied = reportAny.as_applied ?? {};
  const prescription = reportAny.prescription ?? {};
  const plannedGeoJson = firstGeoJson(
    asApplied.planned_geojson,
    asApplied.plan_geojson,
    asApplied.planned_area_geojson,
    prescription.planned_geojson,
    prescription.plan_geojson,
    prescription.spatial_geojson,
    reportAny.planned_geojson,
  );
  const coverageGeoJson = firstGeoJson(
    asApplied.coverage_geojson,
    asApplied.actual_coverage_geojson,
    asApplied.as_applied_geojson,
    asApplied.applied_geojson,
    reportAny.coverage_geojson,
  );
  const trajectorySegments = [
    ...trajectorySegmentsFrom(asExecuted.trajectory_segments),
    ...trajectorySegmentsFrom(asExecuted.trajectory_geojson),
    ...trajectorySegmentsFrom(asExecuted.actual_trajectory_geojson),
    ...trajectorySegmentsFrom(asExecuted.execution_trace_geojson),
    ...trajectorySegmentsFrom(asExecuted.path_geojson),
    ...trajectorySegmentsFrom(asApplied.trajectory_geojson),
  ].filter((segment, index, all) => all.findIndex((candidate) => candidate.id === segment.id) === index);
  const evidenceRef = customerText(asApplied.evidence_ref, "");
  const deviationRaw = customerText(asApplied.planned_vs_actual_deviation, "");
  const hasDeviationEvidence = Boolean(deviationRaw && evidenceRef);
  return {
    plannedGeoJson,
    coverageGeoJson,
    trajectorySegments,
    planStatusText: plannedGeoJson ? "计划区域图层已接入。" : "暂无计划区域图层。",
    coverageStatusText: coverageGeoJson ? customerText(asApplied.coverage_status, "实际覆盖图层已接入。") : "暂无实际覆盖图层。",
    trajectoryStatusText: trajectorySegments.length ? `已接入 ${trajectorySegments.length} 条实际执行轨迹。` : "暂无执行轨迹图层。",
    deviationText: hasDeviationEvidence ? deviationRaw : "计划-实际偏差待补充证据来源。",
    deviationEvidenceText: evidenceRef || "暂无偏差证据来源。",
    hasDeviationEvidence,
    hasAnySpatialLayer: Boolean(plannedGeoJson || coverageGeoJson || trajectorySegments.length),
  };
}

function OperationSpatialExecutionPanel({ spatial }: { spatial: OperationSpatialExecutionVm }): React.ReactElement {
  return (
    <section className="operationSpatialPanel" aria-label="空间执行记录">
      <div className="operationSpatialPanelHead">
        <h4>空间执行记录</h4>
        <span>{spatial.hasAnySpatialLayer ? "空间图层已接入" : "空间图层待补充"}</span>
      </div>
      <div className="operationSpatialGrid">
        <div><strong>计划区域状态</strong><span>{spatial.planStatusText}</span></div>
        <div><strong>实际覆盖状态</strong><span>{spatial.coverageStatusText}</span></div>
        <div><strong>执行轨迹状态</strong><span>{spatial.trajectoryStatusText}</span></div>
        <div><strong>计划-实际偏差</strong><span>{spatial.deviationText}</span></div>
        <div><strong>偏差证据来源</strong><span>{spatial.deviationEvidenceText}</span></div>
      </div>
      {spatial.hasAnySpatialLayer ? (
        <div className="operationSpatialMap">
          <FieldGisMap
            polygonGeoJson={spatial.plannedGeoJson}
            coverageGeoJson={spatial.coverageGeoJson}
            heatGeoJson={null}
            markers={[]}
            trajectorySegments={spatial.trajectorySegments}
            acceptancePoints={[]}
            labels={{ fieldBoundary: "计划区域", coverageLayer: "实际覆盖", operationTrack: "实际执行轨迹" }}
          />
        </div>
      ) : (
        <div className="operationSpatialEmpty">暂无可渲染空间图层。</div>
      )}
    </section>
  );
}

function unavailableWeatherContext(operationId: string): OperationEnvironmentContext {
  return {
    status: "unavailable",
    unavailableReason: "not_ready",
    operationId,
    fieldId: null,
    history: null,
    forecast: null,
    rainfallMayExplainSoilMoistureChange: null,
    learningWeatherInterferenceExcluded: null,
    explanation: "天气源未接入或当前位置不可用，当前不参与验收判断。",
  };
}

export default function OperationReportPage(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const [prescriptionDrawerOpen, setPrescriptionDrawerOpen] = React.useState(false);
  const [roiDrawerOpen, setRoiDrawerOpen] = React.useState(false);
  const [weatherContext, setWeatherContext] = React.useState<OperationEnvironmentContext | null>(null);
  const [weatherLoading, setWeatherLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchOperationReport(operationId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [operationId]);

  React.useEffect(() => {
    let alive = true;
    const id = operationId.trim();
    setWeatherContext(null);
    if (!id) {
      setWeatherLoading(false);
      return () => {
        alive = false;
      };
    }
    setWeatherLoading(true);
    void fetchOperationEnvironmentContext({ operationId: id })
      .then((context) => {
        if (!alive) return;
        setWeatherContext(context);
      })
      .catch(() => {
        if (!alive) return;
        setWeatherContext(unavailableWeatherContext(id));
      })
      .finally(() => {
        if (!alive) return;
        setWeatherLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [operationId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);
  const spatialExecution = buildOperationSpatialExecutionVm(report);
  const canExport = Boolean(operationId.trim());
  const canBackToField = Boolean(vm.operation.fieldId && vm.operation.fieldId !== "--");
  const reportAny = report as any;
  const prescriptionId = vm.drawerRefs.prescriptionId;
  const recommendationId = vm.drawerRefs.recommendationId;
  const drawerOperationId = vm.drawerRefs.operationId;
  const drawerFieldId = vm.drawerRefs.fieldId;
  const embeddedRoi = reportAny.roi_ledger ?? reportAny.roi ?? reportAny.value_summary;
  const embeddedMemory = reportAny.field_memory ?? reportAny.field_memory_summary ?? reportAny.memory;
  const evidenceMetadata = evidencePackSafeMetadata(report);
  const displayEvidenceSummary = evidenceMetadata.downloadUrl && vm.evidenceSummary.detail === "当前展示客户可读证据包摘要，不提供文件下载入口。"
    ? { ...vm.evidenceSummary, detail: "当前展示客户可读证据包摘要。" }
    : vm.evidenceSummary;

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet operationReportSheet">
        <header className="customerHero operationHero">
          <div className="customerHeroTop">
            <div>
              <div className="customerReportLogo">GEOX / 作业闭环</div>
              <h1 className="customerTitle">{vm.operation.title}</h1>
              <p className="customerSubtitle">地块：{customerText(vm.operation.fieldName, "暂无地块信息")}</p>
              <p className="customerSubtitle">最终状态：{customerText(vm.operation.finalStatusLabel, "状态待更新")} · 更新时间：{customerText(vm.operation.updatedAtText, "暂无更新时间")}</p>
            </div>
            <div className="customerActions">
              <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
              {canBackToField ? <Link className="customerButton" to={`/customer/fields/${encodeURIComponent(vm.operation.fieldId)}`}>返回地块</Link> : <span className="muted">返回地块不可用：缺少地块标识</span>}
              {canExport ? <Link className="customerButton" to={vm.exportHref}>导出报告</Link> : <span className="muted">导出不可用：缺少作业标识</span>}
              {canExport ? <Link className="customerButton" to={`/operator/evidence?operation_id=${encodeURIComponent(operationId)}`}>查看证据导出</Link> : null}
            </div>
          </div>
        </header>

        <section className="customerCard operationTimelineStrip">
          {vm.timeline.map((item) => <span key={item.key} className="customerPill">{shortOperationLabel(item.label)}：{item.key === "EVIDENCE" ? displayEvidenceSummary.statusText : customerTimelineStatusLabel(item.status)}</span>)}
        </section>

        <section className="operationClosedLoopGrid">
          {vm.sections.map((section, index) => {
            const isExpanded = expandedKey === section.key;
            const isEvidenceSection = section.key === "EVIDENCE";
            const isPrescriptionSection = section.key === "PRESCRIPTION";
            const isExecutionSection = section.key === "EXECUTION";
            const isRoiSection = section.key === "ROI";
            const isMemorySection = section.key === "MEMORY";
            const displayItems = section.items.filter((item) => !shouldHideMainViewText(`${item.label} ${item.value}`));
            const title = shortOperationLabel(section.title);
            const statusText = isEvidenceSection ? displayEvidenceSummary.statusText : (section.statusText || customerTimelineStatusLabel(section.status));
            const detailText = section.emptyState?.description || (displayItems[0] ? `${displayItems[0].label}：${displayItems[0].value}` : "暂无摘要");
            return (
              <article
                key={section.key}
                className={`customerCard operationClosedLoopCard ${isExpanded ? "isExpanded" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setExpandedKey((prev) => prev === section.key ? null : section.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedKey((prev) => prev === section.key ? null : section.key);
                  }
                }}
              >
                <div className="operationClosedLoopHead">
                  <span className="operationStepNo">{index + 1}</span>
                  <h3 className="customerCardTitle">{title}</h3>
                  <span className="operationStatusBadge">{statusText}</span>
                </div>
                {isEvidenceSection ? (
                  <>
                    <EvidencePackSummaryPanel vm={displayEvidenceSummary} expanded={isExpanded} />
                    {isExpanded ? <EvidencePackMetadataBlock metadata={evidenceMetadata} /> : null}
                  </>
                ) : isMemorySection && isExpanded ? (
                  <FieldMemoryPanel fieldId={drawerFieldId} operationId={drawerOperationId} embeddedMemory={embeddedMemory} compact />
                ) : (
                  <>
                    <div className="operationOneLiner">{safeMainViewText(section.summary)}</div>
                    <div className="operationOneLiner muted">{safeMainViewText(detailText)}</div>
                    {isExpanded ? (
                      <>
                        <div className="customerGrid2 customerSpacingTopXs">
                          {displayItems.map((item) => <div key={`${section.key}-${item.label}`}><strong>{item.label}：</strong>{safeMainViewText(item.value, "--")}</div>)}
                          {!displayItems.length && section.emptyState ? <div className="muted">{section.emptyState.title}：{section.emptyState.description}</div> : null}
                        </div>
                        {isExecutionSection ? (
                          <>
                            <OperationSpatialExecutionPanel spatial={spatialExecution} />
                            <WeatherInterferencePanel context={weatherContext} loading={weatherLoading} />
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
                <div className="operationCardActions">
                  <button
                    type="button"
                    className="customerLinkButton customerSpacingTopXs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedKey((prev) => prev === section.key ? null : section.key);
                    }}
                  >
                    {isExpanded ? "收起详情" : "查看详情"}
                  </button>
                  {isPrescriptionSection ? (
                    <button
                      type="button"
                      className="customerLinkButton customerSpacingTopXs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrescriptionDrawerOpen(true);
                      }}
                    >
                      查看处方详情
                    </button>
                  ) : null}
                  {isRoiSection ? (
                    <button
                      type="button"
                      className="customerLinkButton customerSpacingTopXs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoiDrawerOpen(true);
                      }}
                    >
                      查看价值记录明细
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        <section className="operationTechDetailsMuted">
          <details>
            <summary className="operationTechDetailsSummary">展开技术详情</summary>
            <div className="operationTechDetailsTitle">技术详情（默认关闭）</div>
            <div className="operationTechDetailsGrid">
              {(vm.technicalFoldout?.rows ?? []).map((row) => (
                <div key={row.label}><strong>{labelCustomerTechnicalField(row.label)}：</strong>{row.value}</div>
              ))}
            </div>
          </details>
        </section>
      </div>
      <PrescriptionContractDrawer
        open={prescriptionDrawerOpen}
        prescriptionId={prescriptionId}
        recommendationId={recommendationId}
        onClose={() => setPrescriptionDrawerOpen(false)}
      />
      <RoiLedgerDrawer
        open={roiDrawerOpen}
        fieldId={drawerFieldId}
        operationId={drawerOperationId}
        embeddedRoi={embeddedRoi}
        onClose={() => setRoiDrawerOpen(false)}
      />
    </div>
  );
}
