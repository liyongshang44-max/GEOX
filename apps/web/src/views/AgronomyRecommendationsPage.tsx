import React from "react";
import { fetchAgronomyRecommendationDetail, fetchAgronomyRecommendations, submitRecommendationApproval, type AgronomyRecommendationItemV1 } from "../lib/api";

type RecommendationStatus = "pending" | "in_approval" | "planned" | "tasked" | "completed";

type RecommendationViewModel = {
  raw: AgronomyRecommendationItemV1;
  recommendationId: string;
  shortRecommendationId: string;
  typeLabel: string;
  status: RecommendationStatus;
  statusLabel: string;
  canSubmit: boolean;
  evidenceCount: number;
  ruleHitCount: number;
};

const TYPE_LABELS: Record<string, string> = {
  irrigation_adjustment: "灌溉调整",
  fertilization_adjustment: "施肥调整",
  pest_control: "病虫害处置",
  disease_control: "病害防治",
  alert_only: "告警提示",
};

const FLOW_STEPS: Array<{ key: keyof AgronomyRecommendationItemV1 | "recommendation"; label: string }> = [
  { key: "recommendation", label: "recommendation" },
  { key: "approval_request_id", label: "approval" },
  { key: "operation_plan_id", label: "operation plan" },
  { key: "act_task_id", label: "task" },
  { key: "receipt_fact_id", label: "receipt" },
];

function shortId(value: string | null | undefined): string {
  const id = String(value ?? "").trim();
  if (!id) return "-";
  return id.length <= 12 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function recommendationTypeLabel(value: string | null): string {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return "未标注类型";
  return TYPE_LABELS[key] ?? key.replace(/_/g, " ");
}

function deriveStatus(item: AgronomyRecommendationItemV1): RecommendationStatus {
  if (item.receipt_fact_id) return "completed";
  if (item.act_task_id) return "tasked";
  if (item.operation_plan_id) return "planned";
  if (item.approval_request_id) return "in_approval";
  return "pending";
}

function statusLabel(status: RecommendationStatus): string {
  if (status === "completed") return "已回执";
  if (status === "tasked") return "已下发任务";
  if (status === "planned") return "已生成作业计划";
  if (status === "in_approval") return "审批中";
  return "待提交审批";
}

function toViewModel(item: AgronomyRecommendationItemV1): RecommendationViewModel {
  const status = deriveStatus(item);
  return {
    raw: item,
    recommendationId: item.recommendation_id,
    shortRecommendationId: shortId(item.recommendation_id),
    typeLabel: recommendationTypeLabel(item.recommendation_type),
    status,
    statusLabel: statusLabel(status),
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

function RecommendationStatusChain({ item }: { item: RecommendationViewModel }): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {FLOW_STEPS.map((step, idx) => {
        const done = step.key === "recommendation" ? true : Boolean(item.raw[step.key]);
        return (
          <React.Fragment key={step.label}>
            <span style={{ fontSize: 11, color: done ? "#1d1d1f" : "#8a8a8f", fontWeight: done ? 600 : 400 }}>{step.label}</span>
            {idx < FLOW_STEPS.length - 1 ? <span style={{ color: "#b1b1b6", fontSize: 11 }}>→</span> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function RecommendationCard(props: {
  item: RecommendationViewModel;
  active: boolean;
  onOpen: () => void;
  onSubmit: () => void;
}): React.ReactElement {
  const { item, active, onOpen, onSubmit } = props;
  return (
    <div className="card" style={{ padding: 16, borderColor: active ? "#111" : undefined, display: "grid", gap: 10 }}>
      <button className="btn" style={{ justifyContent: "space-between", background: "transparent", border: "none", padding: 0 }} onClick={onOpen}>
        <div style={{ display: "grid", gap: 8, textAlign: "left" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, fontSize: 15 }}>{item.typeLabel}</h4>
            <StatusBadge status={item.status} statusLabel={item.statusLabel} />
          </div>
          <div className="muted">推荐单号：<span className="mono">{item.shortRecommendationId}</span></div>
          <RecommendationStatusChain item={item} />
        </div>
      </button>
      <div className="muted" style={{ display: "flex", gap: 10 }}>
        <span>证据 {item.evidenceCount}</span>
        <span>规则 {item.ruleHitCount}</span>
        <span>置信度 {item.raw.confidence ?? "-"}</span>
      </div>
      {item.canSubmit ? <button className="btn primary" onClick={onSubmit}>提交到审批链</button> : null}
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

  const viewItems = React.useMemo(() => items.map(toViewModel), [items]);

  const statusOptions = React.useMemo(() => ["all", ...Array.from(new Set(viewItems.map((v) => v.status)))], [viewItems]);
  const typeOptions = React.useMemo(() => ["all", ...Array.from(new Set(viewItems.map((v) => v.typeLabel)))], [viewItems]);

  const filteredItems = React.useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return viewItems.filter((item) => {
      if (pendingOnly && !item.canSubmit) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.typeLabel !== typeFilter) return false;
      if (!k) return true;
      return item.recommendationId.toLowerCase().includes(k)
        || item.typeLabel.toLowerCase().includes(k)
        || item.statusLabel.toLowerCase().includes(k);
    });
  }, [keyword, pendingOnly, statusFilter, typeFilter, viewItems]);

  const selectedView = React.useMemo(() => (selected ? toViewModel(selected) : null), [selected]);

  const summary = React.useMemo(() => ({
    total: viewItems.length,
    pending: viewItems.filter((x) => x.status === "pending").length,
    inApproval: viewItems.filter((x) => x.status === "in_approval").length,
    closed: viewItems.filter((x) => x.status === "completed").length,
  }), [viewItems]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>农业建议控制台</h2>
        <div className="muted" style={{ marginTop: 4 }}>主信息高对比，次信息弱化，支持快速扫列表</div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">总建议</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.total}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">待处理</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.pending}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">审批中</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.inApproval}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">已回执</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.closed}</div></div>
      </section>

      <section className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((option) => <option value={option} key={option}>{option === "all" ? "全部状态" : option}</option>)}
          </select>
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {typeOptions.map((option) => <option value={option} key={option}>{option === "all" ? "全部类型" : option}</option>)}
          </select>
          <input className="input" placeholder="关键词（ID / 类型 / 状态）" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
            只看待处理项
          </label>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>推荐列表</h3>
            <span className="muted">筛选后 {filteredItems.length} 条</span>
          </div>
          {loading ? <div>加载中…</div> : null}
          {error ? <div className="err">{error}</div> : null}
          {!loading && !filteredItems.length ? <div className="emptyState">暂无建议。</div> : null}
          <div style={{ display: "grid", gap: 12 }}>
            {filteredItems.map((item) => (
              <RecommendationCard
                key={item.recommendationId}
                item={item}
                active={selected?.recommendation_id === item.recommendationId}
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
          <h3 style={{ marginTop: 0 }}>建议详情</h3>
          {!selected ? <div className="emptyState">请选择左侧建议。</div> : (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>recommendation_id：</b><span className="mono">{selectedView?.shortRecommendationId}</span></div>
              <div><b>approval_request_id：</b><span className="mono">{shortId(selected.approval_request_id)}</span></div>
              <div><b>operation_plan_id：</b><span className="mono">{shortId(selected.operation_plan_id)}</span></div>
              <div><b>act_task_id：</b><span className="mono">{shortId(selected.act_task_id)}</span></div>
              <div><b>receipt_fact_id：</b><span className="mono">{shortId(selected.receipt_fact_id)}</span></div>
              <div><b>流程状态：</b>{selectedView?.statusLabel}</div>
              <div><b>建议类型：</b>{selectedView?.typeLabel}</div>
              <div><b>原因代码：</b>{selected.reason_codes.join(", ") || "-"}</div>
              <div><b>建议动作：</b>{selected.suggested_action?.summary || "-"}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
