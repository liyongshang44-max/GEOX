import React from "react";
import { fetchAgronomyRecommendationDetail, fetchAgronomyRecommendations, submitRecommendationApproval, type AgronomyRecommendationItemV1 } from "../lib/api";

type Lang = "zh" | "en";
type RecommendationStatus = "pending" | "in_approval" | "planned" | "tasked" | "completed";

type RecommendationViewModel = {
  raw: AgronomyRecommendationItemV1;
  recommendationId: string;
  shortRecommendationId: string;
  typeLabel: string;
  status: RecommendationStatus;
  statusLabel: string;
  reasonLabels: string[];
  canSubmit: boolean;
  evidenceCount: number;
  ruleHitCount: number;
};

const I18N = {
  zh: {
    pageTitle: "农业建议控制台",
    pageDesc: "以产品语言呈现建议、审批与执行链路，便于快速识别待处理项。",
    language: "语言",
    summaryTotal: "总建议",
    summaryPending: "待处理",
    summaryApproval: "审批中",
    summaryClosed: "已回执",
    filterAllStatus: "全部状态",
    filterAllType: "全部类型",
    filterKeyword: "关键词（ID / 类型 / 状态 / 原因）",
    filterPendingOnly: "只看待处理项",
    listTitle: "推荐列表",
    listCount: "筛选后",
    listCountSuffix: "条",
    loading: "加载中…",
    empty: "暂无建议。",
    openDetailHint: "请选择左侧建议。",
    submit: "提交到审批链",
    detailTitle: "建议详情",
    recommendationId: "建议单号",
    approvalId: "审批单号",
    operationPlanId: "作业计划号",
    taskId: "作业执行号",
    receiptId: "执行回执号",
    status: "流程状态",
    type: "建议类型",
    reasons: "触发原因",
    action: "建议动作",
    evidence: "证据",
    rule: "规则",
    confidence: "置信度",
    flow: ["建议", "审批", "作业计划", "作业执行", "执行回执"],
    statusMap: {
      pending: "待提交审批",
      in_approval: "审批中",
      planned: "已生成作业计划",
      tasked: "已下发作业执行",
      completed: "已回执",
    },
    otherType: "其他建议",
    noType: "未标注类型",
    noReason: "无明确原因",
    otherReason: "其他原因",
    debugTitle: "开发调试信息（原始字段）",
    rawType: "原始类型",
    rawStatus: "原始状态",
    rawLatestStatus: "原始 latest_status",
    rawReasons: "原始 reason codes",
    idsAndFields: "完整 ID 与字段",
  },
  en: {
    pageTitle: "Agronomy Recommendation Console",
    pageDesc: "Product-facing view for recommendation, approval, and execution tracking.",
    language: "Language",
    summaryTotal: "Total",
    summaryPending: "Pending",
    summaryApproval: "In Approval",
    summaryClosed: "Completed",
    filterAllStatus: "All Status",
    filterAllType: "All Types",
    filterKeyword: "Keyword (ID / Type / Status / Reason)",
    filterPendingOnly: "Pending only",
    listTitle: "Recommendations",
    listCount: "Filtered",
    listCountSuffix: "items",
    loading: "Loading...",
    empty: "No recommendations.",
    openDetailHint: "Select an item from the list.",
    submit: "Submit to Approval",
    detailTitle: "Recommendation Details",
    recommendationId: "Recommendation ID",
    approvalId: "Approval ID",
    operationPlanId: "Operation Plan ID",
    taskId: "Task ID",
    receiptId: "Receipt ID",
    status: "Status",
    type: "Type",
    reasons: "Reasons",
    action: "Suggested Action",
    evidence: "Evidence",
    rule: "Rules",
    confidence: "Confidence",
    flow: ["Recommendation", "Approval", "Operation Plan", "Task", "Receipt"],
    statusMap: {
      pending: "Pending Approval",
      in_approval: "In Approval",
      planned: "Plan Generated",
      tasked: "Task Created",
      completed: "Receipt Recorded",
    },
    otherType: "Other Recommendation",
    noType: "Unlabeled Type",
    noReason: "No Explicit Reason",
    otherReason: "Other Reason",
    debugTitle: "Developer Debug Fields",
    rawType: "Raw Type",
    rawStatus: "Raw Status",
    rawLatestStatus: "Raw latest_status",
    rawReasons: "Raw reason codes",
    idsAndFields: "Full IDs and fields",
  },
} as const;

const TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  irrigation_adjustment: { zh: "灌溉调整", en: "Irrigation Adjustment" },
  irrigation_recommendation_v1: { zh: "灌溉建议", en: "Irrigation Recommendation" },
  fertilization_adjustment: { zh: "施肥调整", en: "Fertilization Adjustment" },
  fertilization_recommendation_v1: { zh: "施肥建议", en: "Fertilization Recommendation" },
  crop_health_alert_v1: { zh: "作物健康预警", en: "Crop Health Alert" },
  pest_control: { zh: "病虫害处置", en: "Pest Control" },
  pest_control_v1: { zh: "病虫害防治", en: "Pest & Disease Control" },
  disease_control: { zh: "病害防治", en: "Disease Control" },
  alert_only: { zh: "告警提示", en: "Alert" },
};

const REASON_LABELS: Record<string, { zh: string; en: string }> = {
  image_health_risk_high: { zh: "图像识别健康风险高", en: "High health risk from imagery" },
  canopy_temperature_high: { zh: "冠层温度偏高", en: "Canopy temperature is high" },
  soil_moisture_low: { zh: "土壤含水量偏低", en: "Soil moisture is low" },
  disease_risk_high: { zh: "病害风险高", en: "High disease risk" },
  pest_risk_high: { zh: "虫害风险高", en: "High pest risk" },
  growth_stress_detected: { zh: "检测到生长胁迫", en: "Growth stress detected" },
};

function shortId(value: string | null | undefined): string {
  const id = String(value ?? "").trim();
  if (!id) return "-";
  return id.length <= 12 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function deriveStatus(item: AgronomyRecommendationItemV1): RecommendationStatus {
  if (item.receipt_fact_id) return "completed";
  if (item.act_task_id) return "tasked";
  if (item.operation_plan_id) return "planned";
  if (item.approval_request_id) return "in_approval";
  return "pending";
}

function recommendationTypeLabel(value: string | null, lang: Lang): string {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return I18N[lang].noType;
  return TYPE_LABELS[key]?.[lang] ?? I18N[lang].otherType;
}

function reasonLabel(code: string, lang: Lang): string {
  const key = String(code ?? "").trim().toLowerCase();
  if (!key) return I18N[lang].noReason;
  return REASON_LABELS[key]?.[lang] ?? I18N[lang].otherReason;
}

function toViewModel(item: AgronomyRecommendationItemV1, lang: Lang): RecommendationViewModel {
  const status = deriveStatus(item);
  const reasons = Array.isArray(item.reason_codes) ? item.reason_codes : [];
  return {
    raw: item,
    recommendationId: item.recommendation_id,
    shortRecommendationId: shortId(item.recommendation_id),
    typeLabel: recommendationTypeLabel(item.recommendation_type, lang),
    status,
    statusLabel: I18N[lang].statusMap[status],
    reasonLabels: reasons.length ? reasons.map((code) => reasonLabel(code, lang)) : [I18N[lang].noReason],
    canSubmit: status === "pending",
    evidenceCount: Array.isArray(item.evidence_refs) ? item.evidence_refs.length : 0,
    ruleHitCount: Array.isArray(item.rule_hit) ? item.rule_hit.length : 0,
  };
}

function StatusBadge({ statusLabel, status }: { statusLabel: string; status: RecommendationStatus }): React.ReactElement {
  const tone = status === "pending" ? "#7a5a0a" : status === "in_approval" ? "#1e4b7a" : status === "completed" ? "#1d6b42" : "#495057";
  const bg = status === "pending" ? "#fff8e1" : status === "in_approval" ? "#e8f1fc" : status === "completed" ? "#e8f7ef" : "#f0f1f3";
  return <span style={{ display: "inline-flex", borderRadius: 999, padding: "2px 8px", fontSize: 12, color: tone, background: bg }}>{statusLabel}</span>;
}

function RecommendationStatusChain({ item, labels }: { item: RecommendationViewModel; labels: string[] }): React.ReactElement {
  const doneFlags = [
    true,
    Boolean(item.raw.approval_request_id),
    Boolean(item.raw.operation_plan_id),
    Boolean(item.raw.act_task_id),
    Boolean(item.raw.receipt_fact_id),
  ];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {labels.map((label, idx) => (
        <React.Fragment key={label}>
          <span style={{ fontSize: 11, color: doneFlags[idx] ? "#1d1d1f" : "#8a8a8f", fontWeight: doneFlags[idx] ? 600 : 400 }}>{label}</span>
          {idx < labels.length - 1 ? <span style={{ color: "#b1b1b6", fontSize: 11 }}>→</span> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function RecommendationCard(props: {
  item: RecommendationViewModel;
  active: boolean;
  labels: (typeof I18N)[keyof typeof I18N];
  onOpen: () => void;
  onSubmit: () => void;
}): React.ReactElement {
  const { item, active, labels, onOpen, onSubmit } = props;
  return (
    <div className="card" style={{ padding: 16, borderColor: active ? "#111" : undefined, display: "grid", gap: 10 }}>
      <button className="btn" style={{ justifyContent: "space-between", background: "transparent", border: "none", padding: 0 }} onClick={onOpen}>
        <div style={{ display: "grid", gap: 8, textAlign: "left" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, fontSize: 15 }}>{item.typeLabel}</h4>
            <StatusBadge status={item.status} statusLabel={item.statusLabel} />
          </div>
          <div className="muted">{labels.recommendationId}: <span className="mono">{item.shortRecommendationId}</span></div>
          <RecommendationStatusChain item={item} labels={labels.flow as unknown as string[]} />
        </div>
      </button>
      <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>{labels.evidence} {item.evidenceCount}</span>
        <span>{labels.rule} {item.ruleHitCount}</span>
        <span>{labels.confidence} {item.raw.confidence ?? "-"}</span>
      </div>
      {item.canSubmit ? <button className="btn primary" onClick={onSubmit}>{labels.submit}</button> : null}
    </div>
  );
}

export default function AgronomyRecommendationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<AgronomyRecommendationItemV1[]>([]);
  const [selected, setSelected] = React.useState<AgronomyRecommendationItemV1 | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [keyword, setKeyword] = React.useState<string>("");
  const [pendingOnly, setPendingOnly] = React.useState<boolean>(false);
  const [lang, setLang] = React.useState<Lang>(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"));

  const labels = I18N[lang];
  const isDev = Boolean(import.meta.env.DEV);

  async function refreshAndSelect(recommendationId?: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAgronomyRecommendations({ limit: 50 });
      const nextItems = Array.isArray(res.items) ? res.items : [];
      setItems(nextItems);
      const targetId = recommendationId || nextItems?.[0]?.recommendation_id;
      if (targetId) {
        const detail = await fetchAgronomyRecommendationDetail({ recommendation_id: targetId });
        setSelected(detail.item);
      } else {
        setSelected(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refreshAndSelect();
  }, []);

  const viewItems = React.useMemo(() => items.map((item) => toViewModel(item, lang)), [items, lang]);

  const statusOptions = React.useMemo(
    () => ["all", ...Array.from(new Set(viewItems.map((v) => v.status)))],
    [viewItems],
  );
  const typeOptions = React.useMemo(
    () => ["all", ...Array.from(new Set(viewItems.map((v) => v.typeLabel)))],
    [viewItems],
  );

  const filteredItems = React.useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return viewItems.filter((item) => {
      if (pendingOnly && !item.canSubmit) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.typeLabel !== typeFilter) return false;
      if (!k) return true;
      return item.recommendationId.toLowerCase().includes(k)
        || item.typeLabel.toLowerCase().includes(k)
        || item.statusLabel.toLowerCase().includes(k)
        || item.reasonLabels.join(" ").toLowerCase().includes(k);
    });
  }, [keyword, pendingOnly, statusFilter, typeFilter, viewItems]);

  const selectedView = React.useMemo(() => (selected ? toViewModel(selected, lang) : null), [selected, lang]);

  const summary = React.useMemo(() => ({
    total: viewItems.length,
    pending: viewItems.filter((x) => x.status === "pending").length,
    inApproval: viewItems.filter((x) => x.status === "in_approval").length,
    closed: viewItems.filter((x) => x.status === "completed").length,
  }), [viewItems]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{labels.pageTitle}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{labels.pageDesc}</div>
          </div>
          <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {labels.language}
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">{labels.summaryTotal}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.total}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{labels.summaryPending}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.pending}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{labels.summaryApproval}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.inApproval}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{labels.summaryClosed}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.closed}</div></div>
      </section>

      <section className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((option) => <option value={option} key={option}>{option === "all" ? labels.filterAllStatus : labels.statusMap[option as RecommendationStatus]}</option>)}
          </select>
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {typeOptions.map((option) => <option value={option} key={option}>{option === "all" ? labels.filterAllType : option}</option>)}
          </select>
          <input className="input" placeholder={labels.filterKeyword} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
            {labels.filterPendingOnly}
          </label>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{labels.listTitle}</h3>
            <span className="muted">{labels.listCount} {filteredItems.length} {labels.listCountSuffix}</span>
          </div>
          {loading ? <div>{labels.loading}</div> : null}
          {error ? <div className="err">{error}</div> : null}
          {!loading && !filteredItems.length ? <div className="emptyState">{labels.empty}</div> : null}
          <div style={{ display: "grid", gap: 12 }}>
            {filteredItems.map((item) => (
              <RecommendationCard
                key={item.recommendationId}
                item={item}
                active={selected?.recommendation_id === item.recommendationId}
                labels={labels}
                onOpen={() => {
                  fetchAgronomyRecommendationDetail({ recommendation_id: item.recommendationId })
                    .then((res) => setSelected(res.item))
                    .catch((e: any) => setError(String(e?.message ?? e)));
                }}
                onSubmit={() => {
                  submitRecommendationApproval({ recommendation_id: item.recommendationId })
                    .then(() => refreshAndSelect(item.recommendationId))
                    .catch((e: any) => setError(String(e?.message ?? e)));
                }}
              />
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{labels.detailTitle}</h3>
          {!selected ? <div className="emptyState">{labels.openDetailHint}</div> : (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>{labels.recommendationId}：</b><span className="mono">{selectedView?.shortRecommendationId}</span></div>
              <div><b>{labels.approvalId}：</b><span className="mono">{shortId(selected.approval_request_id)}</span></div>
              <div><b>{labels.operationPlanId}：</b><span className="mono">{shortId(selected.operation_plan_id)}</span></div>
              <div><b>{labels.taskId}：</b><span className="mono">{shortId(selected.act_task_id)}</span></div>
              <div><b>{labels.receiptId}：</b><span className="mono">{shortId(selected.receipt_fact_id)}</span></div>
              <div><b>{labels.status}：</b>{selectedView?.statusLabel}</div>
              <div><b>{labels.type}：</b>{selectedView?.typeLabel}</div>
              <div><b>{labels.reasons}：</b>{selectedView?.reasonLabels.join(" / ") || labels.noReason}</div>
              <div><b>{labels.action}：</b>{selected.suggested_action?.summary || "-"}</div>

              {isDev ? (
                <details style={{ marginTop: 8 }}>
                  <summary className="muted">{labels.debugTitle}</summary>
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    <div><b>{labels.rawType}：</b><span className="mono">{selected.recommendation_type || "-"}</span></div>
                    <div><b>{labels.rawStatus}：</b><span className="mono">{selected.status || "-"}</span></div>
                    <div><b>{labels.rawLatestStatus}：</b><span className="mono">{selected.latest_status || "-"}</span></div>
                    <div><b>{labels.rawReasons}：</b><span className="mono">{selected.reason_codes.join(", ") || "-"}</span></div>
                    <div><b>{labels.idsAndFields}：</b></div>
                    <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(selected, null, 2)}</pre>
                  </div>
                </details>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
