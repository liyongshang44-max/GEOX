
import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import FieldGisMap from "../../../components/FieldGisMap";
import { FIELD_TEXT, type FieldLang } from "../../../lib/fieldViewModel";
import { getUiLocale } from "../../../lib/operationLabels";
import { useFieldDetail } from "../../../hooks/useFieldDetail";
import ErrorState from "../../../components/common/ErrorState";
import EmptyState from "../../../components/common/EmptyState";
import SectionSkeleton from "../../../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../../../components/evidence/ReceiptEvidenceCard";
import { apiRequestOptional } from "../../../api/client";
import { bindDeviceToField } from "../../../api/devices";
import { shouldShowRecommendationBiasWarning, toneCardClass, toneHintText } from "../../../lib/fieldReadModelV1";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  ok: { color: "var(--color-status-normal-fg)", bg: "var(--color-status-normal-bg)", border: "var(--color-status-normal-border)" },
  risk: { color: "var(--color-status-risk-fg)", bg: "var(--color-status-risk-bg)", border: "var(--color-status-risk-border)" },
  error: { color: "var(--color-status-failed-fg)", bg: "var(--color-status-failed-bg)", border: "var(--color-status-failed-border)" },
};

function timelineTypeLabel(type: string): string {
  if (type === "alert") return "告警";
  if (type === "recommendation") return "建议";
  if (type === "operation") return "作业";
  return "事件";
}

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const [lang] = React.useState<FieldLang>(() => (getUiLocale() === "en" ? "en" : "zh"));
  const labels = FIELD_TEXT[lang];
  const [selectedMapObject, setSelectedMapObject] = React.useState<any | null>(null);
  const { model, busy, error, technical, hasControlPlane, hasCurrentProgram, hasGeometry, fieldReadModelV1, refresh } = useFieldDetail({ fieldId, lang });
  const [deviceOptions, setDeviceOptions] = React.useState<Array<{ device_id: string; connection_status?: string; field_id?: string; last_telemetry_ts_ms?: number | null }>>([]);
  const [bindDeviceId, setBindDeviceId] = React.useState("");
  const [bindMessage, setBindMessage] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"overview" | "realtime" | "trajectory" | "config">("overview");

  React.useEffect(() => {
    let mounted = true;
    void apiRequestOptional<{ ok?: boolean; items?: any[]; devices?: any[] }>("/api/v1/devices")
      .then((res) => {
        if (!mounted) return;
        const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res?.devices) ? res.devices : []);
        setDeviceOptions(items.map((item: any) => ({
          device_id: String(item?.device_id ?? ""),
          connection_status: String(item?.connection_status ?? ""),
          field_id: typeof item?.field_id === "string" ? item.field_id : "",
          last_telemetry_ts_ms: Number(item?.last_telemetry_ts_ms ?? 0) || null,
        })).filter((item) => item.device_id));
      })
      .catch(() => setDeviceOptions([]));
    return () => { mounted = false; };
  }, []);

  if (busy && !model) return <SectionSkeleton kind="detail" />;
  if (!busy && !model) return <EmptyState title="对象不存在或暂不可用" description="该田块可能尚未创建，或读模型尚未生成。" actionText="重新加载" onAction={() => void refresh()} secondaryActionText="返回田块列表" onSecondaryAction={() => { window.location.assign("/fields"); }} />;

  const statusStyle = STATUS_STYLE[model?.status || "ok"];
  const headerStatusLabel = model?.currentTask ? "进行中" : (model?.statusLabel || "正常");
  const rawCurrentPlanText = model?.currentPlanText || "--";
  const hasCurrentPlan = rawCurrentPlanText !== "--" && hasCurrentProgram;
  const currentPlanText = hasCurrentPlan ? rawCurrentPlanText : "暂无当前经营方案";
  const fieldSubline = `${model?.areaText || "--"} · ${(model?.currentCropText || "--")}/${currentPlanText}`;
  const hasServerTrajectory = Boolean(model?.map?.hasTrajectory);
  const activeTrackId = model?.currentTask?.operationPlanId || model?.map?.trajectorySegments?.[0]?.id || undefined;
  const operationHref = model?.currentTask?.operationPlanId ? `/operations/${encodeURIComponent(model.currentTask.operationPlanId)}` : "/operations";
  const programHref = "/programs";
  const recommendationsHref = fieldId
    ? `/agronomy/recommendations?field_id=${encodeURIComponent(fieldId)}&from=field_detail`
    : "/agronomy/recommendations";
  const hasBoundDevice = deviceOptions.some((item) => item.field_id === fieldId);
  const hasOnlineDevice = deviceOptions.some((item) => item.field_id === fieldId && String(item.connection_status).toUpperCase() === "ONLINE");
  const hasTelemetry = deviceOptions.some((item) => item.field_id === fieldId && Number(item.last_telemetry_ts_ms ?? 0) > 0);
  const hasRecommendations = String(model?.currentStatus?.latestSuggestion ?? "").trim() !== "" && !String(model?.currentStatus?.latestSuggestion ?? "").includes("暂无");
  const hasOperations = Boolean(model?.currentTask || (model?.timeline ?? []).some((item) => item.type === "operation"));
  const riskEvents = (model?.timeline ?? []).filter((item) => item.type === "alert").slice(0, 3);
  const recommendationEvents = (model?.timeline ?? []).filter((item) => item.type === "recommendation").slice(0, 3);
  const recentOperationEvents = (model?.timeline ?? []).filter((item) => item.type === "operation").slice(0, 5);
  const hasInitializedProgram = hasCurrentPlan;
  const enableReadModelV1 = String((import.meta as any)?.env?.VITE_ENABLE_FIELD_READ_MODEL_V1 ?? "1") !== "0";
  const sensingV1 = enableReadModelV1 ? fieldReadModelV1?.sensing : null;
  const fertilityV1 = enableReadModelV1 ? fieldReadModelV1?.fertility : null;
  const recommendationBias = fertilityV1?.recommendationBias ?? null;
  const showBiasWarning = shouldShowRecommendationBiasWarning(recommendationBias);
  const checklist = [
    { label: "田块是否已创建", status: Boolean(fieldId) ? "已完成" : "待完成", action: <Link to="/fields">查看田块列表</Link> },
    {
      label: "是否已绑定设备",
      status: hasBoundDevice ? "已完成" : (Boolean(fieldId) ? "待完成" : "待前置完成"),
      action: hasBoundDevice ? <Link to="/devices">查看已绑定设备</Link> : (Boolean(fieldId) ? <Link to="/devices">去绑定设备</Link> : <Link to="/fields/new">先新建田块</Link>),
    },
    {
      label: "设备是否在线",
      status: hasOnlineDevice ? "已完成" : (hasBoundDevice ? "需要处理" : "待前置完成"),
      action: hasBoundDevice ? <Link to="/devices">查看设备状态</Link> : <Link to="/devices">先绑定设备</Link>,
    },
    {
      label: "是否收到首条数据",
      status: hasTelemetry ? "已完成" : (hasOnlineDevice ? "等待数据" : "待前置完成"),
      action: hasTelemetry ? <Link to="/fields">查看田块状态</Link> : (hasOnlineDevice ? <Link to="/devices/onboarding">查看接入说明</Link> : <Link to="/devices">先恢复在线</Link>),
    },
    {
      label: "是否已有建议",
      status: hasRecommendations ? "已完成" : (hasTelemetry ? "待完成" : "待前置完成"),
      action: hasRecommendations ? <Link to={recommendationsHref}>查看建议</Link> : <Link to={recommendationsHref}>刷新评估</Link>,
    },
    {
      label: "是否已有作业",
      status: hasOperations ? "已完成" : (hasRecommendations ? "待完成" : "待前置完成"),
      action: hasOperations ? <Link to="/operations">查看作业</Link> : (hasRecommendations ? <Link to="/operations">创建/查看作业</Link> : <Link to={recommendationsHref}>先完成建议评估</Link>),
    },
  ];

  return (
    <div className="demoDashboardPage">
      <section className="card demoHero detailHeroCard">
        <div className="eyebrow">GEOX / 田块现场页</div>
        <div className="demoCardTopRow" style={{ alignItems: "flex-start", marginTop: 8 }}>
          <div>
            <h1 className="demoHeroTitle">{model?.fieldName || "field_c8_demo"}</h1>
            <p className="demoHeroSubTitle">{fieldSubline}</p>
            <div className="demoMetricHint">田块编号：{model?.fieldId || fieldId || "--"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <span className="traceChip" style={{ color: statusStyle.color, background: statusStyle.bg, borderColor: statusStyle.border, fontWeight: 700 }}>{headerStatusLabel}</span>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button>
            <Link className="btn" to="/fields">返回田块列表</Link>
          </div>
        </div>
        <div className="operationsSummaryGrid" style={{ marginTop: 16 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">土壤湿度</span><strong>{model?.currentStatus?.soilMoisture || "--"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">温度</span><strong>{model?.currentStatus?.temperature || "--"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备状态</span><strong>{model?.currentStatus?.deviceOnline || "--"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近心跳</span><strong>{model?.currentStatus?.recentHeartbeat || "--"}</strong></div>
        </div>
        <div className="operationsSummaryActions">
          {hasCurrentPlan ? <Link className="btn" to={programHref}>主入口：查看经营方案</Link> : <Link className="btn primary" to={`/programs/create?field_id=${encodeURIComponent(fieldId)}`}>创建经营方案</Link>}
          <Link className="btn" to={operationHref}>次入口：查看当前作业</Link>
          <Link className="btn" to="/devices">次入口：查看设备</Link>
        </div>
        {(searchParams.get("created") === "1" || !hasCurrentPlan) ? (
          <div className="decisionItemStatic onboardingHintCard fieldInitBanner" style={{ marginTop: 12 }}>
            <div className="onboardingHintTitle">尚未完成初始化经营</div>
            <div className="onboardingHintDesc">这块田还没有经营方案。创建经营方案后，系统才能根据目标生成建议与作业。</div>
            <div className="onboardingActions">
              <Link className="btn primary" to={`/programs/create?field_id=${encodeURIComponent(fieldId)}`}>初始化经营</Link>
              <Link className="btn" to="/devices">去绑定设备</Link>
              <Link className="btn" to="/fields">返回田块列表</Link>
            </div>
          </div>
        ) : null}
        {!hasControlPlane ? <div className="demoMetricHint" style={{ marginTop: 8 }}>暂无控制信息</div> : null}
      </section>
      <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
        <div className="toolbarFilters" style={{ marginBottom: 10 }}>
          <button className={`btn ${activeTab === "overview" ? "primary" : ""}`} onClick={() => setActiveTab("overview")}>概览</button>
          <button className={`btn ${activeTab === "realtime" ? "primary" : ""}`} onClick={() => setActiveTab("realtime")}>实时状态</button>
          <button className={`btn ${activeTab === "trajectory" ? "primary" : ""}`} onClick={() => setActiveTab("trajectory")}>作业与轨迹</button>
          <button className={`btn ${activeTab === "config" ? "primary" : ""}`} onClick={() => setActiveTab("config")}>经营配置</button>
        </div>
        <div className="sectionTitle">首次数据可见性检查</div>
        <div className="decisionList" style={{ marginTop: 8 }}>
          {checklist.map((item) => (
            <div key={item.label} className="decisionItemStatic" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>{item.label} · <strong>{item.status}</strong></div>
              <div>{item.action}</div>
            </div>
          ))}
        </div>
      </section>
      {activeTab === "overview" ? (
      <section className="card detailHeroCard fieldBattleSection" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">当前状态区</div>
        <div className="detailSectionLead">先看当前经营是否完成初始化，再确认设备、遥测与执行状态。</div>
        <div className="fieldBattleMetrics">
          <div className="fieldBattleMetric"><span>当前状态</span><strong>{headerStatusLabel}</strong></div>
          <div className="fieldBattleMetric"><span>当前作物</span><strong>{model?.currentCropText || "--"}</strong></div>
          <div className="fieldBattleMetric"><span>当前经营方案</span><strong>{currentPlanText}</strong></div>
          <div className="fieldBattleMetric"><span>设备在线</span><strong>{model?.currentStatus?.deviceOnline || "--"}</strong></div>
          <div className="fieldBattleMetric"><span>最近心跳</span><strong>{model?.currentStatus?.recentHeartbeat || "--"}</strong></div>
          <div className="fieldBattleMetric"><span>当前执行</span><strong>{model?.currentTask ? `${model.currentTask.action} · ${model.currentTask.status}` : "暂无执行任务"}</strong></div>
        </div>
        {!hasInitializedProgram ? (
          <div className="decisionItemStatic onboardingHintCard fieldInitBanner" style={{ marginTop: 10 }}>
            <div className="onboardingHintTitle">尚未初始化经营方案</div>
            <div className="onboardingHintDesc">请先创建经营方案，再进入建议→作业→验收闭环。</div>
            <div className="onboardingActions">
              <Link className="btn primary" to={`/programs/create?field_id=${encodeURIComponent(fieldId)}`}>立即初始化经营</Link>
              <Link className="btn" to="/programs">查看已有方案</Link>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}
      {activeTab === "overview" && (sensingV1 || fertilityV1) ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12, borderColor: showBiasWarning ? "var(--color-status-risk-border)" : undefined }}>
          <div className="sectionTitle">监测/肥力读模型（V1）</div>
          {sensingV1 ? (
            <div className={`decisionItemStatic ${toneCardClass(sensingV1.tone)}`}>
              <div className="decisionItemTitle">技术附录：监测概览</div>
              <div className="decisionItemMeta">状态：{sensingV1.statusLabel}</div>
              <div className="decisionItemMeta">数据可信度/质量：{sensingV1.sensorQuality || "--"}</div>
              <div className="decisionItemMeta">updated_at：{sensingV1.updatedAtLabel}</div>
              <div className="decisionItemMeta">解释码：{sensingV1.explainCodeLabels.length ? sensingV1.explainCodeLabels.join(" / ") : "--"}</div>
              <div className="decisionItemMeta">专家信息：观测来源：{sensingV1.sourceObservationIds.length ? sensingV1.sourceObservationIds.join(" / ") : "--"}</div>
              <div className="decisionItemMeta">来源设备：{sensingV1.sourceDevices.length ? sensingV1.sourceDevices.join(" / ") : "--"}</div>
              {toneHintText(sensingV1.tone) ? <div className="decisionItemMeta">提示：{toneHintText(sensingV1.tone)}</div> : null}
            </div>
          ) : null}
          {fertilityV1 ? (
            <div className={`decisionItemStatic ${toneCardClass(fertilityV1.tone)}`} style={{ marginTop: 8 }}>
              <div className="decisionItemTitle">技术附录：肥力状态</div>
              <div className="decisionItemMeta">状态：{fertilityV1.statusLabel !== "--" ? fertilityV1.statusLabel : fertilityV1.fertilityStateLabel}</div>
              <div className="decisionItemMeta">recommendation_bias：{fertilityV1.recommendationBiasLabel}</div>
              <div className="decisionItemMeta">salinity_risk：{fertilityV1.salinityRiskLabel}</div>
              <div className="decisionItemMeta">confidence：{fertilityV1.confidenceLabel}</div>
              <div className="decisionItemMeta">updated_at：{fertilityV1.updatedAtLabel}</div>
              <div className="decisionItemMeta">解释码：{fertilityV1.explainCodeLabels.length ? fertilityV1.explainCodeLabels.join(" / ") : "--"}</div>
              <div className="decisionItemMeta">专家信息：观测来源：{fertilityV1.sourceObservationIds.length ? fertilityV1.sourceObservationIds.join(" / ") : "--"}</div>
              <div className="decisionItemMeta">来源设备：{fertilityV1.sourceDevices.length ? fertilityV1.sourceDevices.join(" / ") : "--"}</div>
              {toneHintText(fertilityV1.tone) ? <div className="decisionItemMeta">提示：{toneHintText(fertilityV1.tone)}</div> : null}
            </div>
          ) : null}
          {showBiasWarning ? (
            <div className="decisionItemStatic" style={{ marginTop: 8, borderColor: "var(--color-status-risk-border)", background: "var(--color-status-risk-bg)" }}>
              <div className="decisionItemTitle">⚠️ 当前建议偏置提示</div>
              <div className="decisionItemMeta">
                recommendation_bias = <strong>{fertilityV1?.recommendationBiasLabel}</strong>，建议优先人工复核现场并谨慎推进自动动作。
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {!hasBoundDevice ? (
      activeTab === "config" ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">接入并绑定设备</div>
          <div className="detailSectionLead">当前田块还没有绑定设备，建议先完成接入与绑定。</div>
          <div style={{ marginTop: 8 }}><Link className="btn" to="/devices">去设备中心绑定</Link></div>
        </section>
      ) : null
      ) : null}
      {activeTab === "overview" ? (
      <section className="card detailHeroCard fieldBattleSection" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">当前风险与建议区</div>
        <div className="detailSectionLead">聚焦这块田当前最需要关注的风险，以及系统建议的下一步动作。</div>
        <div className="decisionList" style={{ marginTop: 8 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">风险结论</div>
            <div className="decisionItemMeta">{model?.statusReason || "当前未发现高优先风险"}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">最新建议</div>
            <div className="decisionItemMeta">{model?.currentStatus?.latestSuggestion || "暂无建议"}</div>
          </div>
          {riskEvents.length ? riskEvents.map((item) => (
            <div key={item.id} className="decisionItemStatic">
              <div className="decisionItemTitle">风险事件</div>
              <div className="decisionItemMeta">{item.time} · {item.label}</div>
            </div>
          )) : <div className="decisionItemStatic">当前暂无风险事件。</div>}
          {recommendationEvents.length ? recommendationEvents.map((item) => (
            <div key={item.id} className="decisionItemStatic">
              <div className="decisionItemTitle">建议事件</div>
              <div className="decisionItemMeta">{item.time} · {item.label}</div>
            </div>
          )) : null}
        </div>
        <div className="operationsSummaryActions">
          <Link className="btn" to={recommendationsHref}>查看建议中心</Link>
          <Link className="btn" to="/operations">转为作业</Link>
        </div>
      </section>
      ) : null}
      {hasBoundDevice && !hasTelemetry ? (
        activeTab === "realtime" ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">等待首条数据</div>
          <div className="detailSectionLead">设备已绑定，但还未收到首条遥测。可先检查设备在线状态与接入日志。</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Link className="btn" to="/devices">查看设备状态</Link>
            <Link className="btn" to="/devices/onboarding">查看接入说明</Link>
          </div>
        </section>
        ) : null
      ) : null}
      {hasBoundDevice && !hasOnlineDevice ? (
        activeTab === "realtime" ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">设备当前离线</div>
          <div className="detailSectionLead">系统暂时无法获取最新状态，建议先检查设备在线情况或等待恢复连接。</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Link className="btn" to="/devices">查看设备状态</Link>
            <Link className="btn" to={`/fields/${encodeURIComponent(fieldId)}`}>返回田块详情</Link>
          </div>
        </section>
        ) : null
      ) : null}

      {activeTab === "config" ? (
      <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">从田块绑定设备</div>
        <div className="sectionDesc">支持从田块详情直接完成设备绑定；若设备离线，仍允许绑定并提示先校验在线状态。</div>
        <div className="toolbarFilters" style={{ marginTop: 8 }}>
          <select className="select" value={bindDeviceId} onChange={(e) => setBindDeviceId(e.target.value)}>
            <option value="">请选择设备</option>
            {deviceOptions.map((item) => (
              <option key={item.device_id} value={item.device_id}>
                {item.device_id} · {String(item.connection_status || "UNKNOWN").toUpperCase()} {item.field_id ? `(已绑定:${item.field_id})` : "(未绑定)"}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!bindDeviceId}
            onClick={() => {
              void (async () => {
                const target = deviceOptions.find((item) => item.device_id === bindDeviceId);
                try {
                  const res = await bindDeviceToField({ device_id: bindDeviceId, field_id: fieldId });
                  if (res?.ok) {
                    const warn = String(target?.connection_status ?? "").toUpperCase() === "ONLINE" ? "" : "；当前设备离线，建议先校验在线状态";
                    setBindMessage(`绑定成功：${res.device_id} → ${res.field_id}${warn}`);
                    await refresh();
                  } else {
                    setBindMessage(`绑定失败：${res?.error ?? "UNKNOWN_ERROR"}`);
                  }
                } catch (e: any) {
                  setBindMessage(`绑定失败：${e?.bodyText || e?.message || String(e)}`);
                }
              })();
            }}
          >
            绑定到当前田块
          </button>
        </div>
        {bindMessage ? <div className="metaText" style={{ marginTop: 8 }}>{bindMessage}</div> : null}
      </section>
      ) : null}

      {error ? <ErrorState title="田块详情暂不可用" message={error} technical={technical || undefined} onRetry={() => void refresh()} /> : null}

      {activeTab === "realtime" ? (
      <section className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">最近作业与验收区</div>
            <div className="detailSectionLead">先看当前正在执行什么，再看最近一次结果和验收状态。</div>
          </div>
          {model?.currentTask ? (
            <div className="decisionList">
              <div className="decisionItemStatic"><div className="decisionItemTitle">当前动作</div><div className="decisionItemMeta">{model.currentTask.action} · 状态：{model.currentTask.status} · 进度：{model.currentTask.progress}%</div></div>
              <div className="decisionItemStatic"><div className="decisionItemTitle">最近事件</div><div className="decisionItemMeta">{model.lastEvent?.action || "暂无"} · {model.lastEvent?.relativeText || "刚刚"}</div></div>
            </div>
          ) : <div className="decisionItemStatic">暂无执行任务</div>}
          {model?.currentTask?.operationPlanId ? <div className="operationsSummaryActions"><Link className="btn" to={operationHref}>查看作业详情 →</Link></div> : null}
          {recentOperationEvents.length ? (
            <div className="decisionList" style={{ marginTop: 8 }}>
              {recentOperationEvents.map((item) => (
                <div key={item.id} className="decisionItemStatic">
                  <div className="decisionItemTitle">最近动作</div>
                  <div className="decisionItemMeta">{item.time} · {item.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">执行证据摘要</div>
            <div className="detailSectionLead">先确认最近一次回执与约束校验，再进入地图查看现场轨迹。</div>
          </div>
          {model?.latestEvidence?.href ? <Link to={model.latestEvidence.href} style={{ textDecoration: "none", color: "inherit" }}><ReceiptEvidenceCard data={model.latestEvidence} /></Link> : (model?.latestEvidence ? <ReceiptEvidenceCard data={model.latestEvidence} /> : <div className="decisionItemStatic">暂无执行证据</div>)}
        </section>
      </section>
      ) : null}

      {activeTab === "trajectory" ? (
      <section className="card detailHeroCard">
        <div className="demoCardTopRow">
          <div>
            <div className="sectionTitle">GIS 与轨迹区</div>
            <div className="detailSectionLead">{hasServerTrajectory ? "已收到现场轨迹数据，可直接查看设备路径、作业点和热区。" : "暂未收到后端 simulator/device 的真实 geo telemetry。"}</div>
          </div>
          {hasServerTrajectory ? <span className="traceChip traceChipLive">真实轨迹</span> : <span className="traceChip">等待后端 telemetry</span>}
        </div>
        {!hasGeometry ? (
          <div className="decisionItemStatic">边界尚未补充，可先完成设备与方案初始化。</div>
        ) : (
          <>
            <FieldGisMap
              polygonGeoJson={model?.map?.polygonGeoJson}
              heatGeoJson={model?.map?.heatGeoJson}
              markers={model?.map?.markers || []}
              trajectorySegments={model?.map?.trajectorySegments || []}
              acceptancePoints={model?.map?.acceptancePoints || []}
              activeSegmentId={activeTrackId}
              labels={labels}
              onSelectObject={setSelectedMapObject}
            />
            <div className="traceChipRow" style={{ marginTop: 12 }}>
              {hasServerTrajectory ? (<><span className="traceChip traceChipLive">真实 GPS 轨迹</span><span className="traceChip">最近作业定位点</span><span className="traceChip">告警 / 热区叠加</span></>) : (<><span className="traceChip">暂无轨迹</span><span className="traceChip">请先启动后端 simulator runner 或接入真实设备</span></>)}
            </div>
          </>
        )}
      </section>
      ) : null}

      {activeTab === "trajectory" ? (
      <section className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">现场时间轴</div>
            <div className="detailSectionLead">把最近的建议、作业、告警放回时间顺序里，方便判断今天发生了什么。</div>
          </div>
          <div className="fieldTimeline">
            {(model?.timeline || []).map((item) => (
              <div key={item.id} className="fieldTimelineItem">
                <div className="fieldTimelineTime">{item.time}</div>
                <div className="fieldTimelineDot">{item.icon}</div>
                <div className="fieldTimelineContent">{item.label} · {timelineTypeLabel(item.type)}</div>
              </div>
            ))}
            {!(model?.timeline || []).length ? <div className="decisionItemStatic">当前还没有可展示的现场事件。</div> : null}
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">地图对象详情</div>
            <div className="detailSectionLead">点击轨迹、热区、设备点或验收点后，在这里看对象的业务含义。</div>
          </div>
          {selectedMapObject ? (
            <div className="fieldObjectPanel">
              <div className="decisionItemStatic"><div className="decisionItemTitle">类型</div><div className="decisionItemMeta">{selectedMapObject.kind || "地图对象"}</div></div>
              <div className="decisionItemStatic"><div className="decisionItemTitle">名称</div><div className="decisionItemMeta">{selectedMapObject.name || "-"}</div></div>
              {selectedMapObject.id ? <div className="decisionItemStatic"><div className="decisionItemTitle">编号</div><div className="decisionItemMeta">{selectedMapObject.id}</div></div> : null}
              {selectedMapObject.time ? <div className="decisionItemStatic"><div className="decisionItemTitle">时间</div><div className="decisionItemMeta">{selectedMapObject.time}</div></div> : null}
              {selectedMapObject.related ? <div className="decisionItemStatic"><div className="decisionItemTitle">关联</div><div className="decisionItemMeta">{selectedMapObject.related}</div></div> : null}
            </div>
          ) : <div className="decisionItemStatic">点击地图中的对象后，这里会展示它对应的业务含义。</div>}
        </section>
      </section>
      ) : null}
      {activeTab === "config" ? (
      <section className="card detailHeroCard fieldBattleSection">
        <div className="sectionTitle">相关方案与设备区</div>
        <div className="detailSectionLead">围绕当前田块，集中查看经营方案与设备连接关系。</div>
        <div className="fieldBattleMetrics">
          <div className="fieldBattleMetric"><span>经营方案</span><strong>{hasCurrentPlan ? currentPlanText : "未初始化"}</strong></div>
          <div className="fieldBattleMetric"><span>设备绑定</span><strong>{hasBoundDevice ? "已绑定" : "未绑定"}</strong></div>
          <div className="fieldBattleMetric"><span>设备在线</span><strong>{hasOnlineDevice ? "在线" : "离线/未知"}</strong></div>
          <div className="fieldBattleMetric"><span>首条遥测</span><strong>{hasTelemetry ? "已接收" : "未接收"}</strong></div>
        </div>
        <div className="operationsSummaryActions">
          <Link className="btn" to="/programs">查看方案列表</Link>
          <Link className="btn" to={hasCurrentPlan ? programHref : `/programs/create?field_id=${encodeURIComponent(fieldId)}`}>{hasCurrentPlan ? "查看当前方案" : "创建经营方案"}</Link>
          <Link className="btn" to="/devices">查看设备中心</Link>
        </div>
      </section>
      ) : null}
    </div>
  );
}
