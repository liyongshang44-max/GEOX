
import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchAgronomyRecommendationDetail,
  fetchAgronomyRecommendationDetailControlPlane,
  fetchAgronomyRecommendations,
  fetchAgronomyRecommendationsControlPlane,
  submitRecommendationApproval,
} from "../../../api/programs";
import ErrorState from "../../../components/common/ErrorState";
import EmptyState from "../../../components/common/EmptyState";
import StatusBadge from "../../../components/common/StatusBadge";
import { RelativeTime } from "../../../components/RelativeTime";
import { parseFieldReadModelV1, shouldShowRecommendationBiasWarning, toneCardClass, toneHintText } from "../../../lib/fieldReadModelV1";

type ListItem = any;
type DetailItem = any;

function toFieldId(value: any): string {
  const direct = String(value?.field_id ?? "").trim();
  if (direct) return direct;
  return String(value?.technical_details?.field_id ?? value?.refs?.field_id ?? "").trim();
}

function buildSummaryFromItems(nextItems: ListItem[]): { total: number; pending: number; in_approval: number; receipted: number } {
  return nextItems.reduce((acc, item) => {
    const code = String(item?.status?.code || item?.status?.label || item?.status || "").toUpperCase();
    acc.total += 1;
    if (code.includes("APPROVAL") || code.includes("IN_APPROVAL")) acc.in_approval += 1;
    else if (code.includes("RECEIPT") || code.includes("RECEIPTED") || code.includes("DONE") || code.includes("COMPLETED")) acc.receipted += 1;
    else acc.pending += 1;
    return acc;
  }, { total: 0, pending: 0, in_approval: 0, receipted: 0 });
}

function shortId(value: string | null | undefined): string {
  const id = String(value ?? "").trim();
  if (!id) return "-";
  return id.length <= 16 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function StepChain({ steps }: { steps: Array<{ label: string; done: boolean }> }): React.ReactElement {
  return (
    <div className="traceChipRow">
      {steps.map((step) => (
        <span key={step.label} className={`traceChip ${step.done ? "traceChipLive" : "traceChipMuted"}`}>{step.label}</span>
      ))}
    </div>
  );
}

export default function AgronomyRecommendationsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = React.useState<ListItem[]>([]);
  const [summary, setSummary] = React.useState<{ total: number; pending: number; in_approval: number; receipted: number }>({ total: 0, pending: 0, in_approval: 0, receipted: 0 });
  const [selected, setSelected] = React.useState<DetailItem | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const fieldIdFilter = React.useMemo(() => String(searchParams.get("field_id") ?? "").trim(), [searchParams]);
  const enableReadModelV1 = String((import.meta as any)?.env?.VITE_ENABLE_FIELD_READ_MODEL_V1 ?? "1") !== "0";
  const enableLegacyFallback = String((import.meta as any)?.env?.VITE_ENABLE_LEGACY_AGRONOMY_FALLBACK ?? "1") !== "0";

  const visibleItems = React.useMemo(() => {
    if (!fieldIdFilter) return items;
    return items.filter((item) => toFieldId(item) === fieldIdFilter);
  }, [items, fieldIdFilter]);

  const visibleSummary = React.useMemo(() => {
    if (!fieldIdFilter) return summary;
    return buildSummaryFromItems(visibleItems);
  }, [fieldIdFilter, summary, visibleItems]);

  async function refreshAndSelect(recommendationId?: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      let nextItems: ListItem[] = [];
      let nextSummary = { total: 0, pending: 0, in_approval: 0, receipted: 0 };
      try {
        const res = await fetchAgronomyRecommendationsControlPlane({ limit: 50, field_id: fieldIdFilter || undefined });
        nextItems = Array.isArray(res.items) ? res.items : [];
        nextSummary = res.summary ?? { total: nextItems.length, pending: 0, in_approval: 0, receipted: 0 };
      } catch (cpError) {
        if (!enableLegacyFallback) throw cpError;
        const legacyRes = await fetchAgronomyRecommendations({ limit: 50 });
        const legacyItems = Array.isArray(legacyRes.items) ? legacyRes.items : [];
        nextItems = fieldIdFilter ? legacyItems.filter((item) => toFieldId(item) === fieldIdFilter) : legacyItems;
        nextSummary = buildSummaryFromItems(nextItems);
      }
      setItems(nextItems);
      setSummary(nextSummary);
      const candidates = fieldIdFilter ? nextItems.filter((item) => toFieldId(item) === fieldIdFilter) : nextItems;
      const targetId = recommendationId || candidates?.[0]?.recommendation_id;
      if (targetId) {
        try {
          const detail = await fetchAgronomyRecommendationDetailControlPlane({ recommendation_id: targetId });
          setSelected(detail.item);
        } catch (cpDetailError) {
          if (!enableLegacyFallback) throw cpDetailError;
          const legacyDetail = await fetchAgronomyRecommendationDetail({ recommendation_id: targetId });
          setSelected(legacyDetail.item);
        }
      } else {
        setSelected(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void refreshAndSelect(); }, [fieldIdFilter]);

  return (
    <div className="demoDashboardPage">
      <section className="card demoHero dashboardHeroV2">
        <div className="eyebrow">GEOX / 农业建议页</div>
        <h1 className="demoHeroTitle">今天哪些建议要推进到审批链</h1>
        <p className="demoHeroSubTitle">
          这里不是算法明细页，而是建议推进入口。先看哪些建议要立刻推进，再决定是否进入审批和执行链。
        </p>
      </section>

      <section className="summaryGrid4 demoSummaryGrid">
        <article className="card demoMetricCard"><div className="demoMetricLabel">总建议</div><div className="demoMetricValue">{visibleSummary.total}</div><div className="demoMetricHint">当前查询范围内的建议总数。</div></article>
        <article className="card demoMetricCard"><div className="demoMetricLabel">待处理</div><div className="demoMetricValue">{visibleSummary.pending}</div><div className="demoMetricHint">建议优先进入人工判断或审批链。</div></article>
        <article className="card demoMetricCard"><div className="demoMetricLabel">审批中</div><div className="demoMetricValue">{visibleSummary.in_approval}</div><div className="demoMetricHint">已经进入审批流，等待进一步动作。</div></article>
        <article className="card demoMetricCard"><div className="demoMetricLabel">已回执</div><div className="demoMetricValue">{visibleSummary.receipted}</div><div className="demoMetricHint">已有结果和执行回执的建议链。</div></article>
      </section>

      {loading ? <div className="muted">加载中…</div> : null}
      {error ? <ErrorState title="建议数据加载失败" message="请稍后重试，或检查后端服务状态。" technical={error} onRetry={() => void refreshAndSelect()} /> : null}

      <section className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">建议队列</div>
            <div className="detailSectionLead">左侧专门用于挑出今天要推进的建议，不需要先看技术细节。</div>
          </div>
          {fieldIdFilter ? (
            <div className="card" style={{ marginBottom: 12, borderStyle: "dashed" }}>
              <div className="decisionItemMeta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span>当前仅展示田块 {fieldIdFilter} 的建议。</span>
                <button
                  className="btn"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("field_id");
                    setSearchParams(next);
                  }}
                >
                  查看全部建议
                </button>
              </div>
            </div>
          ) : null}
          {!loading && !visibleItems.length ? (
            <EmptyState
              title={fieldIdFilter ? "该田块暂无建议" : "当前暂无农业建议"}
              description={fieldIdFilter ? "可点击“查看全部建议”恢复全量列表" : "系统会在下一轮规则评估后补充建议"}
            />
          ) : null}
          <div className="demoList">
            {visibleItems.map((item) => (
              (() => {
                const parsedReadModel = parseFieldReadModelV1(item);
                const sensingV1 = enableReadModelV1 ? parsedReadModel.sensing : null;
                const fertilityV1 = enableReadModelV1 ? parsedReadModel.fertility : null;
                const recommendationBias = fertilityV1?.recommendationBias ?? null;
                const showBiasWarning = shouldShowRecommendationBiasWarning(recommendationBias);
                return (
              <div key={item.recommendation_id} className="card demoInfoCard">
                <button
                  className="btn"
                  style={{ justifyContent: "space-between", background: "transparent", border: "none", padding: 0, textAlign: "left", width: "100%" }}
                  onClick={() => {
                    fetchAgronomyRecommendationDetailControlPlane({ recommendation_id: item.recommendation_id })
                      .then((res) => setSelected(res.item))
                      .catch(async () => {
                        if (!enableLegacyFallback) return;
                        try {
                          const legacy = await fetchAgronomyRecommendationDetail({ recommendation_id: item.recommendation_id });
                          setSelected(legacy.item);
                        } catch (e: any) {
                          setError(String(e?.message ?? e));
                        }
                      });
                  }}
                >
                  <div style={{ display: "grid", gap: 8, width: "100%" }}>
                    <div className="demoCardTopRow">
                      <div>
                        <div className="decisionItemTitle">{item.title}</div>
                        <div className="decisionItemMeta">建议单号：{shortId(item.recommendation_id)}</div>
                      </div>
                      <StatusBadge status={item?.status?.code || item?.status?.label || "PENDING"} />
                    </div>
                    <div className="decisionItemMeta">{item.reason_summary || "-"}</div>
                    {sensingV1 ? (
                      <div className={`decisionItemMeta ${toneCardClass(sensingV1.tone)}`}>field_sensing_overview_v1 · 状态：{sensingV1.statusLabel} · 数据可信度/质量：{sensingV1.sensorQuality || "--"} · updated_at：{sensingV1.updatedAtLabel} · 解释码：{sensingV1.explainCodeLabels.join(" / ") || "--"}{toneHintText(sensingV1.tone) ? ` · 提示：${toneHintText(sensingV1.tone)}` : ""}</div>
                    ) : null}
                    {fertilityV1 ? (
                      <div className={`decisionItemMeta ${toneCardClass(fertilityV1.tone)}`}>field_fertility_state_v1 · 状态：{fertilityV1.statusLabel !== "--" ? fertilityV1.statusLabel : fertilityV1.fertilityStateLabel} · recommendation_bias：{fertilityV1.recommendationBiasLabel} · salinity_risk：{fertilityV1.salinityRiskLabel} · confidence：{fertilityV1.confidenceLabel} · updated_at：{fertilityV1.updatedAtLabel} · 解释码：{fertilityV1.explainCodeLabels.join(" / ") || "--"}{toneHintText(fertilityV1.tone) ? ` · 提示：${toneHintText(fertilityV1.tone)}` : ""}</div>
                    ) : null}
                    {showBiasWarning ? (
                      <div className="decisionItemMeta" style={{ color: "var(--color-status-risk-fg)", fontWeight: 700 }}>
                        ⚠️ recommendation_bias={fertilityV1?.recommendationBiasLabel}，建议优先人工复核现场并谨慎推进自动动作。
                      </div>
                    ) : null}
                    <StepChain steps={Array.isArray(item?.progress?.steps) ? item.progress.steps : []} />
                    <div className="decisionItemMeta">
                      证据数 {item.evidence_count ?? 0} · 规则数 {item.rule_count ?? 0} · 置信度 {item.confidence ?? "-"} · 更新时间 <RelativeTime value={item.updated_ts_ms || item.updated_at} />
                    </div>
                  </div>
                </button>
                {!item.linked_refs?.approval_request_id ? (
                  <div className="operationsSummaryActions">
                    <button
                      className="btn"
                      onClick={() => {
                        submitRecommendationApproval({ recommendation_id: item.recommendation_id })
                          .then(() => refreshAndSelect(item.recommendation_id))
                          .catch((e: any) => setError(String(e?.message ?? e)));
                      }}
                    >
                      提交到审批链
                    </button>
                  </div>
                ) : null}
              </div>
                );
              })()
            ))}
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">建议详情</div>
            <div className="detailSectionLead">右侧只回答四个问题：建议做什么、为什么做、现在推进到哪、有哪些技术编号。</div>
          </div>

          {!selected ? <EmptyState title="请选择左侧建议" description="可查看建议原因、链路状态与关联审批信息" /> : (
            (() => {
              const parsedReadModel = parseFieldReadModelV1(selected);
              const sensingV1 = enableReadModelV1 ? parsedReadModel.sensing : null;
              const fertilityV1 = enableReadModelV1 ? parsedReadModel.fertility : null;
              const recommendationBias = fertilityV1?.recommendationBias ?? null;
              const showBiasWarning = shouldShowRecommendationBiasWarning(recommendationBias);
              return (
            <div className="decisionList">
              <div className="decisionItemStatic">
                <div className="decisionItemTitle">建议动作</div>
                <div className="decisionItemMeta">{selected?.suggested_action?.title || "建议动作"} · {selected?.suggested_action?.summary || "-"}</div>
              </div>
              <div className="decisionItemStatic">
                <div className="decisionItemTitle">触发原因</div>
                <div className="decisionItemMeta">{selected?.reasoning?.trigger_reason && selected.reasoning.trigger_reason !== "其他原因" ? selected.reasoning.trigger_reason : "监测指标出现异常波动"}</div>
                <div className="decisionItemMeta" style={{ marginTop: 6 }}>{(selected?.reasoning?.rule_hits || []).map((hit: any) => `${hit.label}: ${hit.summary}`).join("；") || "暂无规则说明"}</div>
              </div>
              <div className="decisionItemStatic">
                <div className="decisionItemTitle">当前链路状态</div>
                <div className="decisionItemMeta">审批：{selected?.pipeline?.approval?.status?.label || "-"} · 执行：{selected?.pipeline?.execution?.status?.label || "-"}</div>
              </div>
              {sensingV1 ? (
                <div className={`decisionItemStatic ${toneCardClass(sensingV1.tone)}`}>
                  <div className="decisionItemTitle">field_sensing_overview_v1</div>
                  <div className="decisionItemMeta">状态：{sensingV1.statusLabel} · 数据可信度/质量：{sensingV1.sensorQuality || "--"} · updated_at：{sensingV1.updatedAtLabel} · 解释码：{sensingV1.explainCodeLabels.join(" / ") || "--"}</div>
                  {toneHintText(sensingV1.tone) ? <div className="decisionItemMeta">提示：{toneHintText(sensingV1.tone)}</div> : null}
                </div>
              ) : null}
              {fertilityV1 ? (
                <div className={`decisionItemStatic ${toneCardClass(fertilityV1.tone)}`}>
                  <div className="decisionItemTitle">field_fertility_state_v1</div>
                  <div className="decisionItemMeta">状态：{fertilityV1.statusLabel !== "--" ? fertilityV1.statusLabel : fertilityV1.fertilityStateLabel} · 解释码：{fertilityV1.explainCodeLabels.join(" / ") || "--"}</div>
                  <div className="decisionItemMeta">recommendation_bias：{fertilityV1.recommendationBiasLabel}</div>
                  <div className="decisionItemMeta">salinity_risk：{fertilityV1.salinityRiskLabel} · confidence：{fertilityV1.confidenceLabel} · updated_at：{fertilityV1.updatedAtLabel}</div>
                  {toneHintText(fertilityV1.tone) ? <div className="decisionItemMeta">提示：{toneHintText(fertilityV1.tone)}</div> : null}
                </div>
              ) : null}
              {showBiasWarning ? (
                <div className="decisionItemStatic" style={{ borderColor: "var(--color-status-risk-border)", background: "var(--color-status-risk-bg)" }}>
                  <div className="decisionItemTitle">⚠️ 偏置提示</div>
                  <div className="decisionItemMeta">recommendation_bias={fertilityV1?.recommendationBiasLabel}，建议优先人工复核现场并谨慎推进自动动作。</div>
                </div>
              ) : null}
              <details className="traceDetails">
                <summary>技术折叠区</summary>
                <div className="traceGrid">
                  <span>recommendation_id：{selected?.technical_details?.recommendation_id || "-"}</span>
                  <span>approval_request_id：{selected?.technical_details?.approval_request_id || "-"}</span>
                  <span>operation_plan_id：{selected?.technical_details?.operation_plan_id || "-"}</span>
                  <span>act_task_id：{selected?.technical_details?.act_task_id || "-"}</span>
                  <span>raw_status：{selected?.technical_details?.raw_status || "-"}</span>
                </div>
              </details>
            </div>
              );
            })()
          )}
        </section>
      </section>
    </div>
  );
}
