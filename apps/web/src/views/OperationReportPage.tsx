import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";
import { customerTimelineStatusLabel } from "../lib/customerLabels";

const MAIN_VIEW_BLOCK_PATTERNS = [
  /skill\s*run/i,
  /skill_run/i,
  /skill_trace/i,
  /irrigation_soil_moisture_threshold/i,
  /\bSUCCESS\b/i,
  /\bFAILED\b/i,
  /\bPASS\b/i,
  /\bDONE\b/i,
  /\bMISSING\b/i,
  /\bAVAILABLE\b/i,
  /\bPENDING\b/i,
];

const CUSTOMER_PATH_OR_HASH_PATTERNS = [
  /\bsha256\b/i,
  /\bmanifest\b/i,
  /s3:\/\//i,
  /https?:\/\//i,
  /(^|\s)\/[\w./-]+/,
  /[A-Z]:\\[\w\\.-]+/i,
];

type OperationEvidenceState = "NO_EVIDENCE" | "RECORDS_WITHOUT_SUMMARY" | "PACK_SUMMARY";

type OperationEvidenceDisplayVm = {
  state: OperationEvidenceState;
  statusText: string;
  summary: string;
  detail: string;
  items: Array<{ label: string; value: string }>;
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

function shortOperationLabel(value: string): string {
  const text = value.trim();
  if (/处方/.test(text)) return "处方";
  if (/as-executed|执行/i.test(text)) return "执行";
  if (/field\s*memory|田块记忆|记忆/i.test(text)) return "记忆";
  if (/recommendation|建议/i.test(text)) return "建议";
  if (/approval|审批/i.test(text)) return "审批";
  if (/evidence|证据/i.test(text)) return "证据";
  if (/acceptance|验收/i.test(text)) return "验收";
  if (/roi/i.test(text)) return "ROI";
  return text;
}

function toEvidenceCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function evidenceCountLabel(value: unknown): string {
  return toEvidenceCount(value) > 0 ? "已采集" : "暂无记录";
}

function sanitizeEvidenceSummary(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return "";
  if (CUSTOMER_PATH_OR_HASH_PATTERNS.some((pattern) => pattern.test(text))) {
    return "证据包摘要已形成，文件明细已隐藏。";
  }
  return text;
}

function sanitizedEvidenceDetail(value: unknown, fallback: string): string {
  return sanitizeEvidenceSummary(value) || fallback;
}

function buildOperationEvidenceDisplay(report: OperationReportV1): OperationEvidenceDisplayVm {
  const evidence = report.evidence ?? { artifacts_count: 0, logs_count: 0, media_count: 0, metrics_count: 0, receipt_present: false, acceptance_present: false };
  const evidenceRecordCount =
    toEvidenceCount(evidence.artifacts_count)
    + toEvidenceCount(evidence.logs_count)
    + toEvidenceCount(evidence.media_count)
    + toEvidenceCount(evidence.metrics_count);
  const hasEvidenceRecords = evidenceRecordCount > 0 || Boolean(evidence.receipt_present || evidence.acceptance_present);
  const packSummary = (report as unknown as { evidence_pack_summary?: { summary?: unknown; photos_logs_metrics_trace_summary?: unknown; status?: unknown; insufficient_reason?: unknown } }).evidence_pack_summary;
  const summaryText = sanitizeEvidenceSummary(packSummary?.photos_logs_metrics_trace_summary ?? packSummary?.summary);

  if (!hasEvidenceRecords && !summaryText) {
    return {
      state: "NO_EVIDENCE",
      statusText: "暂无证据",
      summary: "暂无有效证据。",
      detail: "当前未查询到可用于验收的证据记录。",
      items: [],
    };
  }

  if (!summaryText) {
    return {
      state: "RECORDS_WITHOUT_SUMMARY",
      statusText: "证据已记录",
      summary: "已有证据记录，暂无证据包摘要。",
      detail: "当前仅展示报告内嵌证据摘要。",
      items: [
        { label: "执行回执", value: evidence.receipt_present ? "已记录" : evidenceCountLabel(evidence.artifacts_count) },
        { label: "执行记录", value: evidenceCountLabel(evidence.logs_count) },
        { label: "现场照片", value: evidenceCountLabel(evidence.media_count) },
        { label: "监测数据", value: evidenceCountLabel(evidence.metrics_count) },
        { label: "验收记录", value: evidence.acceptance_present ? "已记录" : "暂无记录" },
      ],
    };
  }

  return {
    state: "PACK_SUMMARY",
    statusText: "证据包已形成",
    summary: "证据包已形成，可查看摘要。",
    detail: "当前仅展示报告内嵌证据摘要。",
    items: [
      { label: "证据包摘要", value: summaryText },
      { label: "证据状态", value: sanitizedEvidenceDetail(packSummary?.status, "已形成") },
      { label: "证据不足说明", value: sanitizedEvidenceDetail(packSummary?.insufficient_reason, "暂无补充说明") },
    ],
  };
}

export default function OperationReportPage(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

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

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);
  const operationEvidence = buildOperationEvidenceDisplay(report);
  const canExport = Boolean(operationId.trim());
  const canBackToField = Boolean(vm.operation.fieldId && vm.operation.fieldId !== "--");

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
            </div>
          </div>
        </header>

        <section className="customerCard operationTimelineStrip">
          {vm.timeline.map((item) => <span key={item.key} className="customerPill">{shortOperationLabel(item.label)}：{item.key === "EVIDENCE" ? operationEvidence.statusText : customerTimelineStatusLabel(item.status)}</span>)}
        </section>

        <section className="operationClosedLoopGrid">
          {vm.sections.map((section, index) => {
            const isExpanded = expandedKey === section.key;
            const isEvidenceSection = section.key === "EVIDENCE";
            const displayItems = isEvidenceSection ? operationEvidence.items : section.items.filter((item) => !shouldHideMainViewText(`${item.label} ${item.value}`));
            const title = shortOperationLabel(section.title);
            const statusText = isEvidenceSection ? operationEvidence.statusText : (section.statusText || customerTimelineStatusLabel(section.status));
            const summaryText = isEvidenceSection ? operationEvidence.summary : section.summary;
            const detailText = isEvidenceSection ? operationEvidence.detail : (section.emptyState?.description || (displayItems[0] ? `${displayItems[0].label}：${displayItems[0].value}` : "暂无摘要"));
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
                <div className="operationOneLiner">{safeMainViewText(summaryText)}</div>
                <div className="operationOneLiner muted">{safeMainViewText(detailText)}</div>
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
                {isExpanded ? (
                  <div className="customerGrid2 customerSpacingTopXs">
                    {displayItems.map((item) => <div key={`${section.key}-${item.label}`}><strong>{item.label}：</strong>{safeMainViewText(item.value, "--")}</div>)}
                    {!displayItems.length && section.emptyState && !isEvidenceSection ? <div className="muted">{section.emptyState.title}：{section.emptyState.description}</div> : null}
                    {!displayItems.length && isEvidenceSection ? <div className="muted">{operationEvidence.summary}</div> : null}
                  </div>
                ) : null}
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
                <div key={row.label}><strong>{row.label}：</strong>{row.value}</div>
              ))}
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
