import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { customerTimelineStatusLabel } from "../lib/customerLabels";
import { customerSafeName, customerSafeTitle } from "../lib/customerSafeText";
import { customerChainIntegrityLabel, customerSemanticLabel, customerSourceLabel, isCustomerChainComplete } from "../lib/customerSemanticLabels";
import { buildOperationReportVm, type CustomerReportSectionVm, type OperationReportPageVm } from "../viewmodels/operationReportVm";

type BackendChainItem = {
  key: string;
  label: string;
  status: "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE" | string;
  reason?: string | null;
  source?: string | null;
};

const CHAIN_LABELS: Record<string, string> = {
  diagnosis: "诊断",
  recommendation: "建议",
  prescription: "处方",
  approval: "审批",
  operation_plan: "作业计划",
  execution: "执行",
  receipt: "回执",
  evidence: "证据",
  acceptance: "验收",
  roi: "价值记录",
  field_memory: "田块记忆",
};

function customerText(value: unknown, fallback = "暂无可展示信息"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "[object Object]" || /1970\s*[\/-]/.test(text)) return fallback;
  return customerSemanticLabel(text, fallback);
}

function toCustomerStatus(status: unknown): "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE" {
  const raw = String(status ?? "").trim().toUpperCase();
  if (raw === "DONE" || raw === "COMPLETE" || raw === "COMPLETED" || raw === "PASS") return "DONE";
  if (raw === "AVAILABLE") return "AVAILABLE";
  if (raw === "PENDING" || raw === "RUNNING") return "PENDING";
  if (raw === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  return "MISSING";
}

function chainLabel(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase();
  return CHAIN_LABELS[key] ?? customerSemanticLabel(raw, fallback);
}

function normalizeChain(report: OperationReportV1): BackendChainItem[] {
  const raw = (report as any).status_chain;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((item, index) => {
      const key = String(item?.key ?? `chain_${index}`).trim() || `chain_${index}`;
      return {
        key,
        label: chainLabel(item?.label ?? key, `链路 ${index + 1}`),
        status: toCustomerStatus(item?.status),
        reason: item?.reason ?? null,
        source: item?.source ?? null,
      };
    });
  }
  return [{ key: "legacy", label: "历史链路", status: "MISSING", reason: "该作业为历史/人工链路，缺少正式建议或处方记录。", source: "frontend_legacy_guard" }];
}

function renderScalar(value: unknown): string {
  if (value == null) return "暂无记录";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return customerText(value, "暂无记录");
  if (Array.isArray(value)) return value.length ? value.map((item) => renderScalar(item)).join("；") : "暂无记录";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferred = obj.customer_text ?? obj.customer_safe_text ?? obj.summary_text ?? obj.summary ?? obj.status ?? obj.verdict;
    if (preferred != null) return renderScalar(preferred);
    return "详见技术详情";
  }
  return "暂无记录";
}

function sectionForChain(vm: OperationReportPageVm, key: string): CustomerReportSectionVm | undefined {
  const normalized = key.toLowerCase();
  if (normalized === "recommendation") return vm.sections.find((item) => item.key === "RECOMMENDATION");
  if (normalized === "prescription") return vm.sections.find((item) => item.key === "PRESCRIPTION");
  if (normalized === "approval") return vm.sections.find((item) => item.key === "APPROVAL");
  if (["operation_plan", "execution", "receipt"].includes(normalized)) return vm.sections.find((item) => item.key === "EXECUTION");
  if (normalized === "evidence") return vm.sections.find((item) => item.key === "EVIDENCE");
  if (normalized === "acceptance") return vm.sections.find((item) => item.key === "ACCEPTANCE");
  if (normalized === "roi") return vm.sections.find((item) => item.key === "ROI");
  if (normalized === "field_memory") return vm.sections.find((item) => item.key === "MEMORY");
  return undefined;
}

function missingLinksText(report: OperationReportV1): string {
  const links = (report as any).missing_links;
  return Array.isArray(links) && links.length ? links.map((x) => chainLabel(x, "待补充环节")).join("、") : "无";
}

function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "暂无可信数值";
  return `${Number(n.toFixed(2))}`;
}

function roiStatusLabel(value: unknown): string {
  const status = String(value ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    HYPOTHESIS_ONLY: "仅形成价值假设，待后续证据验证",
    PROJECTED: "已有投入产出预测，待执行结果验证",
    EXECUTED_PENDING_RESPONSE: "已执行，等待响应证据",
    INTERIM_SUPPORTED: "阶段性证据支持",
    INTERIM_NOT_SUPPORTED: "阶段性证据暂不支持",
    BASELINE_MISSING: "缺少收益基线，暂不形成可信收益结论",
    EVIDENCE_INSUFFICIENT: "证据不足，暂不能形成可信结论",
    EXCLUDED_WEATHER: "受天气干扰，本次不进入效果学习",
    REALIZED: "收获后已形成结果记录",
  };
  return map[status] ?? "价值状态待确认";
}

function OperationValueChainRoiPanel({ report }: { report: OperationReportV1 }): React.ReactElement {
  const roi = (report as any).roi ?? {};
  const hypothesis = roi.hypothesis ?? (report as any).recommendation?.value_hypothesis ?? null;
  const projection = roi.projection ?? (report as any).prescription?.value_projection ?? null;
  const interim = roi.interim_evidence ?? null;
  const safeText = customerText(roi.customer_safe_text, "当前展示建议阶段价值假设与处方阶段投入产出预测，最终收益待后续证据验证。");
  return (
    <section className="customerCard operationValueChainRoi" aria-label="价值链记录">
      <div className="operationClosedLoopHead">
        <span className="operationStepNo">价值</span>
        <h3 className="customerCardTitle">价值链记录</h3>
        <span className="operationStatusBadge">{roiStatusLabel(roi.status)}</span>
      </div>
      <div className="operationOneLiner">{safeText}</div>
      <div className="customerGrid3 customerSpacingTopXs">
        <div>
          <strong>为什么值得做</strong>
          <p>价值类型：{customerText(hypothesis?.value_type, "价值假设待生成")}</p>
          <p>预计产量影响：{renderScalar(hypothesis?.expected_yield_effect)}</p>
          <p>基线来源：{customerSourceLabel(hypothesis?.baseline_source, "暂无基线")}</p>
          <p>可信度：{customerText(hypothesis?.confidence, "可信度待确认")}</p>
        </div>
        <div>
          <strong>预计投入产出</strong>
          <p>计划成本：{formatMoney(projection?.planned_cost)}</p>
          <p>预期收益：{formatMoney(projection?.expected_benefit)}</p>
          <p>预期净值：{formatMoney(projection?.expected_net_value)}</p>
          <p>预测依据：{customerText(projection?.projection_basis, "预测依据待确认")}</p>
        </div>
        <div>
          <strong>执行后证据是否支持</strong>
          <p>证据状态：{customerText(interim?.evidence_status, "暂无阶段证据")}</p>
          <p>验收结论：{customerText(interim?.acceptance_verdict, "待验收")}</p>
          <p>账本条目：{customerText(interim?.ledger_count, "0")}</p>
          <p>排除原因：{customerText(roi.exclusion_reason, "无")}</p>
        </div>
      </div>
    </section>
  );
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
      .then((res) => { if (alive) setReport(res); })
      .catch((e: unknown) => { if (alive) setError(String(e instanceof Error ? e.message : "加载失败")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [operationId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);
  const chain = normalizeChain(report);
  const reportAny = report as any;
  const chainIntegrityRaw = reportAny.chain_integrity;
  const chainIntegrity = customerChainIntegrityLabel(chainIntegrityRaw, "历史/人工链路");
  const legacyWarning = customerText(reportAny.legacy_warning, isCustomerChainComplete(chainIntegrityRaw) ? "" : "该作业为历史/人工链路，缺少正式建议或处方记录。");
  const canBackToField = Boolean(vm.operation.fieldId && vm.operation.fieldId !== "--");
  const safeOperationTitle = customerSafeTitle(vm.operation.title, "作业名称待补充");
  const safeFieldName = customerSafeName(vm.operation.fieldName, "地块名称待补充");

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet operationReportSheet">
        <header className="customerHero operationHero">
          <div className="customerHeroTop">
            <div>
              <div className="customerReportLogo">GEOX / 作业闭环</div>
              <h1 className="customerTitle">{safeOperationTitle}</h1>
              <p className="customerSubtitle">地块：{safeFieldName}</p>
              <p className="customerSubtitle">链路完整性：{chainIntegrity} · 缺失环节：{missingLinksText(report)}</p>
            </div>
            <div className="customerActions">
              <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
              {canBackToField ? <Link className="customerButton" to={`/customer/fields/${encodeURIComponent(vm.operation.fieldId)}`}>返回地块</Link> : null}
              <Link className="customerButton" to={vm.exportHref}>导出报告</Link>
            </div>
          </div>
        </header>

        {legacyWarning ? (
          <section className="customerCard customerScopeWarning">
            {legacyWarning}
          </section>
        ) : null}

        <OperationValueChainRoiPanel report={report} />

        <section className="customerCard operationTimelineStrip">
          {chain.map((item) => (
            <span key={item.key} className="customerPill">
              {item.label}：{customerTimelineStatusLabel(toCustomerStatus(item.status))}
            </span>
          ))}
        </section>

        <section className="operationClosedLoopGrid">
          {chain.map((item, index) => {
            const section = sectionForChain(vm, item.key);
            const isExpanded = expandedKey === item.key;
            return (
              <article
                key={item.key}
                className={`customerCard operationClosedLoopCard ${isExpanded ? "isExpanded" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setExpandedKey((prev) => prev === item.key ? null : item.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedKey((prev) => prev === item.key ? null : item.key);
                  }
                }}
              >
                <div className="operationClosedLoopHead">
                  <span className="operationStepNo">{index + 1}</span>
                  <h3 className="customerCardTitle">{item.label}</h3>
                  <span className="operationStatusBadge">{customerTimelineStatusLabel(toCustomerStatus(item.status))}</span>
                </div>
                <div className="operationOneLiner">{section?.summary || customerText(item.reason, "暂无链路说明")}</div>
                <div className="operationOneLiner muted">来源：{customerSourceLabel(item.source, "作业报告摘要")}</div>
                {isExpanded ? (
                  <div className="customerGrid2 customerSpacingTopXs">
                    {section?.items.length ? section.items.map((row) => (
                      <div key={`${item.key}-${row.label}`}><strong>{row.label}：</strong>{row.value}</div>
                    )) : <div className="muted">该环节暂无客户可读明细，技术字段请查看底部技术详情。</div>}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="customerLinkButton customerSpacingTopXs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedKey((prev) => prev === item.key ? null : item.key);
                  }}
                >
                  {isExpanded ? "收起详情" : "查看详情"}
                </button>
              </article>
            );
          })}
        </section>

        <section className="operationTechDetailsMuted">
          <details>
            <summary className="operationTechDetailsSummary">展开技术详情</summary>
            <div className="operationTechDetailsGrid">
              <div><strong>operation_id：</strong>{customerText(reportAny.operation_id ?? report.identifiers?.operation_id)}</div>
              <div><strong>recommendation_id：</strong>{customerText(reportAny.recommendation?.recommendation_id ?? report.identifiers?.recommendation_id)}</div>
              <div><strong>prescription_id：</strong>{customerText(reportAny.prescription?.prescription_id ?? report.identifiers?.prescription_id)}</div>
              <div><strong>approval_request_id：</strong>{customerText(reportAny.approval?.approval_request_id ?? report.identifiers?.approval_id)}</div>
              <div><strong>act_task_id：</strong>{customerText(reportAny.execution?.act_task_id ?? report.identifiers?.act_task_id)}</div>
              <div><strong>receipt_id：</strong>{customerText(reportAny.execution?.receipt_id ?? report.identifiers?.receipt_id)}</div>
              <div><strong>roi_status：</strong>{roiStatusLabel(reportAny.roi?.status)}</div>
              <div><strong>chain_integrity：</strong>{chainIntegrity}</div>
              <div><strong>missing_links：</strong>{missingLinksText(report)}</div>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
