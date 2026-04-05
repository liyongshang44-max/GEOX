
import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { FIELD_TEXT, type FieldLang } from "../lib/fieldViewModel";
import { getUiLocale } from "../lib/operationLabels";
import { useFieldDetail } from "../hooks/useFieldDetail";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { apiRequestOptional } from "../api/client";
import { bindDeviceToField } from "../api/devices";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  ok: { color: "#067647", bg: "#ecfdf3", border: "#abefc6" },
  risk: { color: "#b54708", bg: "#fffaeb", border: "#fedf89" },
  error: { color: "#b42318", bg: "#fef3f2", border: "#fecdca" },
};

function collectPairs(raw: any, out: Array<[number, number]>): void {
  if (!Array.isArray(raw)) return;
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
    out.push([Number(raw[0]), Number(raw[1])]);
    return;
  }
  for (const item of raw) collectPairs(item, out);
}

function extractPairs(geo: any): Array<[number, number]> {
  if (!geo || typeof geo !== "object") return [];
  const type = String(geo?.type ?? "");
  if (type === "Feature") return extractPairs(geo?.geometry);
  if (type === "FeatureCollection") return Array.isArray(geo?.features) ? geo.features.flatMap((f: any) => extractPairs(f)) : [];
  if (type === "Polygon" || type === "MultiPolygon") {
    const pairs: Array<[number, number]> = [];
    collectPairs(geo?.coordinates, pairs);
    return pairs;
  }
  return [];
}

function buildMockMapLayers(model: any) {
  const basePairs = extractPairs(model?.map?.polygonGeoJson);
  const seed = basePairs[0] ?? [121.012, 23.102];
  const second = basePairs[Math.max(1, Math.floor(basePairs.length / 3))] ?? [seed[0] + 0.0025, seed[1] + 0.0018];
  const third = basePairs[Math.max(2, Math.floor(basePairs.length / 2))] ?? [seed[0] + 0.0048, seed[1] + 0.0031];
  const deviceId = model?.device || model?.currentTask?.deviceId || "dev_onboard_accept_001";
  return {
    polygonGeoJson: model?.map?.polygonGeoJson ?? { type: "Feature", geometry: { type: "Polygon", coordinates: [[[seed[0]-0.0015, seed[1]-0.0012],[seed[0]+0.0045, seed[1]-0.0012],[seed[0]+0.0045, seed[1]+0.0038],[seed[0]-0.0015, seed[1]+0.0038],[seed[0]-0.0015, seed[1]-0.0012]]] } },
    heatGeoJson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [second[0], second[1]] }, properties: { intensity: 2, event_id: "demo_attention", metric: "soil_moisture", status: "OPEN", time: model?.lastEvent?.relativeText || "刚刚" } }] },
    markers: [{ device_id: deviceId, lon: seed[0], lat: seed[1], ts_ms: Date.now() - 15 * 60 * 1000 }],
    trajectorySegments: [{ id: "demo_track_1", status: "SUCCEEDED", color: "#2563eb", label: `${deviceId} · 演示轨迹`, coordinates: [seed, second, third] }],
    acceptancePoints: [{ id: "demo_accept_1", status: "PASS", lon: third[0], lat: third[1] }],
  };
}

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
  const { model, busy, error, technical, hasControlPlane, hasCurrentProgram, hasGeometry, refresh } = useFieldDetail({ fieldId, lang });
  const [deviceOptions, setDeviceOptions] = React.useState<Array<{ device_id: string; connection_status?: string; field_id?: string; last_telemetry_ts_ms?: number | null }>>([]);
  const [bindDeviceId, setBindDeviceId] = React.useState("");
  const [bindMessage, setBindMessage] = React.useState("");

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
  const mockMap = buildMockMapLayers(model);
  const showMockMap = !(model?.map?.hasTrajectory);
  const activeTrackId = showMockMap ? mockMap.trajectorySegments[0]?.id : (model?.currentTask?.operationPlanId || model?.map?.trajectorySegments?.[0]?.id || undefined);
  const operationHref = model?.currentTask?.operationPlanId ? `/operations/${encodeURIComponent(model.currentTask.operationPlanId)}` : "/operations";
  const programHref = "/programs";
  const hasBoundDevice = deviceOptions.some((item) => item.field_id === fieldId);
  const hasOnlineDevice = deviceOptions.some((item) => item.field_id === fieldId && String(item.connection_status).toUpperCase() === "ONLINE");
  const hasTelemetry = deviceOptions.some((item) => item.field_id === fieldId && Number(item.last_telemetry_ts_ms ?? 0) > 0);
  const hasRecommendations = String(model?.currentStatus?.latestSuggestion ?? "").trim() !== "" && !String(model?.currentStatus?.latestSuggestion ?? "").includes("暂无");
  const hasOperations = Boolean(model?.currentTask || (model?.timeline ?? []).some((item) => item.type === "operation"));
  const checklist = [
    { label: "田块已创建", ok: Boolean(fieldId), action: <Link to="/fields">查看田块列表</Link> },
    { label: "设备已绑定", ok: hasBoundDevice, action: hasBoundDevice ? <Link to="/devices">查看已绑定设备</Link> : <span><Link to="/devices">去绑定设备</Link></span> },
    { label: "设备在线", ok: hasOnlineDevice, action: hasOnlineDevice ? <Link to="/devices">查看设备状态</Link> : <span><Link to="/devices">设备离线，去查看状态</Link></span> },
    { label: "首条数据已到达", ok: hasTelemetry, action: hasTelemetry ? <span>已收到遥测</span> : <Link to="/devices/onboarding">查看接入说明</Link> },
    { label: "系统建议已生成", ok: hasRecommendations, action: hasRecommendations ? <Link to="/agronomy/recommendations">查看建议</Link> : <Link to="/agronomy/recommendations">刷新评估</Link> },
    { label: "作业链路已开始", ok: hasOperations, action: hasOperations ? <Link to="/operations">查看作业</Link> : <Link to="/operations">查看推荐动作</Link> },
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
          {hasCurrentPlan ? <Link className="btn" to={programHref}>主入口：查看经营方案</Link> : <Link className="btn primary" to={`/programs/new?field_id=${encodeURIComponent(fieldId)}`}>创建经营方案</Link>}
          <Link className="btn" to={operationHref}>次入口：查看当前作业</Link>
          <Link className="btn" to="/devices">次入口：查看设备</Link>
        </div>
        {(searchParams.get("created") === "1" || !hasCurrentPlan) ? (
          <div className="decisionItemStatic" style={{ marginTop: 12 }}>
            <div className="decisionItemTitle">这块田还没有经营方案</div>
            <div className="decisionItemMeta">创建经营方案后，系统才能根据目标生成建议与作业。</div>
            <div style={{ marginTop: 8 }}>
              <Link className="btn primary" to={`/programs/new?field_id=${encodeURIComponent(fieldId)}`}>初始化经营</Link>
              <Link className="btn" style={{ marginLeft: 8 }} to="/fields">返回田块列表</Link>
            </div>
          </div>
        ) : null}
        {!hasControlPlane ? <div className="demoMetricHint" style={{ marginTop: 8 }}>暂无控制信息</div> : null}
      </section>
      <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">首次数据可见性检查</div>
        <div className="decisionList" style={{ marginTop: 8 }}>
          {checklist.map((item) => (
            <div key={item.label} className="decisionItemStatic" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>{item.ok ? "✅" : "⚪"} {item.label}</div>
              <div>{item.action}</div>
            </div>
          ))}
        </div>
      </section>
      {!hasBoundDevice ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">接入并绑定设备</div>
          <div className="detailSectionLead">当前田块还没有绑定设备，建议先完成接入与绑定。</div>
          <div style={{ marginTop: 8 }}><Link className="btn" to="/devices">去设备中心绑定</Link></div>
        </section>
      ) : null}
      {hasBoundDevice && !hasTelemetry ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">等待首条数据</div>
          <div className="detailSectionLead">设备已绑定，但还未收到首条遥测。可先检查设备在线状态与接入日志。</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Link className="btn" to="/devices">查看设备状态</Link>
            <Link className="btn" to="/devices/onboarding">查看接入说明</Link>
          </div>
        </section>
      ) : null}
      {hasBoundDevice && !hasOnlineDevice ? (
        <section className="card detailHeroCard" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">设备当前离线</div>
          <div className="detailSectionLead">系统暂时无法获取最新状态，建议先检查设备在线情况或等待恢复连接。</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Link className="btn" to="/devices">查看设备状态</Link>
            <Link className="btn" to={`/fields/${encodeURIComponent(fieldId)}`}>返回田块详情</Link>
          </div>
        </section>
      ) : null}

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

      {error ? <ErrorState title="田块详情暂不可用" message={error} technical={technical || undefined} onRetry={() => void refresh()} /> : null}

      <section className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">最近作业与结果</div>
            <div className="detailSectionLead">先看当前正在执行什么，再看最近一次结果和验收状态。</div>
          </div>
          {model?.currentTask ? (
            <div className="decisionList">
              <div className="decisionItemStatic"><div className="decisionItemTitle">当前动作</div><div className="decisionItemMeta">{model.currentTask.action} · 状态：{model.currentTask.status} · 进度：{model.currentTask.progress}%</div></div>
              <div className="decisionItemStatic"><div className="decisionItemTitle">最近事件</div><div className="decisionItemMeta">{model.lastEvent?.action || "暂无"} · {model.lastEvent?.relativeText || "刚刚"}</div></div>
            </div>
          ) : <div className="decisionItemStatic">暂无执行任务</div>}
          {model?.currentTask?.operationPlanId ? <div className="operationsSummaryActions"><Link className="btn" to={operationHref}>查看作业详情 →</Link></div> : null}
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">执行证据摘要</div>
            <div className="detailSectionLead">先确认最近一次回执与约束校验，再进入地图查看现场轨迹。</div>
          </div>
          {model?.latestEvidence?.href ? <Link to={model.latestEvidence.href} style={{ textDecoration: "none", color: "inherit" }}><ReceiptEvidenceCard data={model.latestEvidence} /></Link> : (model?.latestEvidence ? <ReceiptEvidenceCard data={model.latestEvidence} /> : <div className="decisionItemStatic">暂无执行证据</div>)}
        </section>
      </section>

      <section className="card detailHeroCard">
        <div className="demoCardTopRow">
          <div>
            <div className="sectionTitle">现场地图 / 轨迹</div>
            <div className="detailSectionLead">{showMockMap ? "当前真实 geo telemetry 尚未进入，页面先使用演示轨迹承接设备路径、作业点与热区表达。" : "已收到现场轨迹数据，可直接查看设备路径、作业点和热区。"}</div>
          </div>
          {showMockMap ? <span className="traceChip">当前为演示轨迹</span> : <span className="traceChip traceChipLive">真实轨迹</span>}
        </div>
        {!hasGeometry ? (
          <div className="decisionItemStatic">边界尚未补充，可先完成设备与方案初始化。</div>
        ) : (
          <>
            <FieldGisMap
              polygonGeoJson={showMockMap ? mockMap.polygonGeoJson : model?.map?.polygonGeoJson}
              heatGeoJson={showMockMap ? mockMap.heatGeoJson : model?.map?.heatGeoJson}
              markers={showMockMap ? mockMap.markers : model?.map?.markers}
              trajectorySegments={showMockMap ? mockMap.trajectorySegments : model?.map?.trajectorySegments}
              acceptancePoints={showMockMap ? mockMap.acceptancePoints : model?.map?.acceptancePoints}
              activeSegmentId={activeTrackId}
              labels={labels}
              onSelectObject={setSelectedMapObject}
            />
            <div className="traceChipRow" style={{ marginTop: 12 }}>
              {showMockMap ? (<><span className="traceChip">演示设备路径</span><span className="traceChip">演示作业定位点</span><span className="traceChip">演示热区</span></>) : (<><span className="traceChip traceChipLive">真实 GPS 轨迹</span><span className="traceChip">最近作业定位点</span><span className="traceChip">告警 / 热区叠加</span></>)}
            </div>
          </>
        )}
      </section>

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
    </div>
  );
}
