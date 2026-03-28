import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import FieldSummaryCards from "../components/field/FieldSummaryCards";
import FieldOperationList from "../components/field/FieldOperationList";
import FieldAlertList from "../components/field/FieldAlertList";
import FieldLegend from "../components/field/FieldLegend";
import { FIELD_TEXT, shortId, type FieldLang } from "../lib/fieldViewModel";
import { t } from "../lib/i18n";
import { useFieldDetail } from "../hooks/useFieldDetail";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { formatTimeOrFallback } from "../lib/presentation/time";
import { mapReceiptToVm } from "../viewmodels/evidence";

type FieldTab = "overview" | "map" | "operations" | "alerts";

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const location = useLocation();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const isolateHook = React.useMemo(() => new URLSearchParams(location.search).get("hookIsolation") === "1", [location.search]);

  if (isolateHook) {
    return <FieldDetailIsolationView fieldId={fieldId} />;
  }

  return <FieldDetailRuntimeView fieldId={fieldId} />;
}

function FieldDetailIsolationView(props: { fieldId: string }): React.ReactElement {
  const { fieldId } = props;
  return (
    <div style={{ padding: 24, color: "#111", background: "#fff" }}>
      <h1>HOOK ISOLATION ACTIVE</h1>
      <p>已启用隔离模式，当前页面未进入正常详情渲染。</p>
      <p>field_id: {fieldId}</p>
      <Link to="/fields">返回列表</Link>
    </div>
  );
}

function FieldDetailRuntimeView(props: { fieldId: string }): React.ReactElement {
  const { fieldId } = props;
  const location = useLocation();
  const focusTaskId = React.useMemo(() => {
    return new URLSearchParams(location.search).get("focusTask") || "";
  }, [location.search]);
  const [activeTab, setActiveTab] = React.useState<FieldTab>("overview");
  const [lang, setLang] = React.useState<FieldLang>(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const [selectedObject, setSelectedObject] = React.useState<any>(null);
  const [timelineIndex, setTimelineIndex] = React.useState<number>(0);
  const [playing, setPlaying] = React.useState<boolean>(false);
  const [showTrajectoryLayer, setShowTrajectoryLayer] = React.useState(true);
  const [showAlertLayer, setShowAlertLayer] = React.useState(true);
  const [showAcceptanceLayer, setShowAcceptanceLayer] = React.useState(true);
  const [seasonFilter, setSeasonFilter] = React.useState<string>("ALL");

  const labels = FIELD_TEXT[lang];
  const tt = (key: string) => t(lang, key);
  const isDev = Boolean(import.meta.env.DEV);

  const { model, busy, status, error, technical, refresh } = useFieldDetail({
    fieldId,
    lang,
    labels,
    playbackTs: playing ? Date.now() : Number.MAX_SAFE_INTEGER,
  });

  const timelineEvents = model?.timelineEvents ?? [];

  React.useEffect(() => {
    if (!playing || timelineEvents.length < 2) return;
    const timer = window.setInterval(() => {
      setTimelineIndex((prev) => (prev + 1 < timelineEvents.length ? prev + 1 : prev));
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, timelineEvents.length]);

  React.useEffect(() => {
    if (!timelineEvents.length) {
      setTimelineIndex(0);
      return;
    }
    setTimelineIndex((prev) => (prev >= timelineEvents.length ? timelineEvents.length - 1 : prev));
  }, [timelineEvents.length]);

  React.useEffect(() => {
    if (!playing && timelineEvents.length > 0 && timelineIndex === 0) {
      setTimelineIndex(timelineEvents.length - 1);
    }
  }, [playing, timelineEvents.length, timelineIndex]);

  React.useEffect(() => {
    if (!focusTaskId || !model?.operationItems?.length) return;
    const target = model.operationItems.find((item: any) => String(item.actTaskId) === focusTaskId);
    if (!target) return;
    setActiveTab("map");
    setSelectedObject({ kind: labels.operations, name: target.type, time: target.time, status: target.status, id: target.id });
  }, [focusTaskId, model?.operationItems, labels.operations]);

  const playbackTs = playing ? (timelineEvents[timelineIndex]?.ts ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;

  const mapInput = React.useMemo(() => {
    if (!model) {
      return {
        polygonGeoJson: null,
        heatGeoJson: { type: "FeatureCollection", features: [] },
        rawMarkers: [],
        playbackMarkers: [],
        trajectorySegments: [],
        acceptancePoints: [],
      };
    }
    return {
      ...model.mapInput,
      playbackMarkers: (model.mapInput.rawMarkers || []).filter((m: any) => Number(m.ts_ms ?? 0) <= playbackTs),
      trajectorySegments: (model.mapInput.trajectorySegments || []).map((segment: any) => ({
        ...segment,
        coordinates: segment.coordinates,
      })),
    };
  }, [model, playbackTs]);

  const filteredSeasonPrograms = React.useMemo(
    () => (seasonFilter === "ALL" ? (model?.programsBySeason ?? []) : (model?.programsBySeason ?? []).filter((x: any) => String(x.season_id) === seasonFilter)),
    [model?.programsBySeason, seasonFilter]
  );

  const tabs: Array<{ key: FieldTab; label: string }> = [
    { key: "overview", label: labels.overview },
    { key: "map", label: labels.map },
    { key: "operations", label: labels.operations },
    { key: "alerts", label: labels.alerts },
  ];

  const latestEvidence =
    (model?.detail as any)?.latestEvidence ||
    (model?.detail as any)?.latest_evidence ||
    (model?.detail as any)?.recent_receipts?.[0]?.receipt?.payload;
  const currentJob = model?.currentOperation;
  const actionText = React.useMemo(() => {
    const raw = String(currentJob?.action_type || "").toUpperCase();
    if (raw.includes("IRRIGATE")) return "灌溉";
    return "作业";
  }, [currentJob?.action_type]);
  const hasRecommendationRisk = React.useMemo(
    () => (model?.recentRecommendations ?? []).some((x: any) => {
      const raw = `${x?.recommendation_type || ""} ${x?.type || ""}`.toLowerCase();
      return raw.includes("alert") || raw.includes("risk") || raw.includes("health");
    }),
    [model?.recentRecommendations]
  );
  const topStatus = currentJob ? "🟡 运行中" : hasRecommendationRisk ? "🔴 异常" : "🟢 正常";
  const riskStatus = hasRecommendationRisk ? "异常" : "正常";
  const mapOperationStatus = (raw: string | null | undefined): string => {
    const status = String(raw || "").toUpperCase();
    if (status.includes("RUN")) return "执行中";
    if (status.includes("SUCC")) return "已完成";
    if (status.includes("FAIL")) return "异常";
    return "待执行";
  };

  if (busy && !model) return <SectionSkeleton kind="detail" />;
  if (!busy && !model) return <EmptyState title="田块信息暂不可用" description="当前未获取到田块详情，请稍后重试。" actionText="重试" onAction={() => void refresh()} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{labels.title}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{labels.desc}</div>
            <div className="muted" style={{ marginTop: 4 }}>field_id: <span className="mono">{shortId(fieldId)}</span></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value as FieldLang)}><option value="zh">中文</option></select>
            <Link className="btn" to="/fields">{labels.back}</Link>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>{labels.refresh}</button>
          </div>
        </div>
      </section>

      {error ? <ErrorState title="地块详情暂不可用" message={error} technical={technical || undefined} onRetry={() => void refresh()} /> : null}

      <FieldSummaryCards items={model?.summaryCards ?? []} />

      <section className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <b>季节 Program 概览</b>
            <div className="muted">同一地块跨季节 Program 运行视图。</div>
          </div>
          <select className="select" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="ALL">全部季节</option>
            {(model?.seasonOptions ?? []).map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
          {filteredSeasonPrograms.map((s: any) => (
            <div key={s.season_id} className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{s.season_id}</div>
              <div className="muted">Program 数：{s.count}</div>
              <div className="muted">运行中：{s.programs.filter((p: any) => String(p.status).toUpperCase() === "ACTIVE").length}</div>
            </div>
          ))}
          {!filteredSeasonPrograms.length ? <div className="muted">暂无季节 Program 数据</div> : null}
        </div>
      </section>

      <section className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map((tab) => <button key={tab.key} className={`btn ${activeTab === tab.key ? "primary" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
          <span className="muted">{status}</span>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          {activeTab === "overview" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>田块概览卡</div>
                <div><b>田块名称：</b>{model?.detail?.field?.name || "field_c8_demo"}</div>
                <div><b>当前状态：</b>{topStatus}</div>
                <div><b>当前作业：</b>{currentJob ? `${actionText}中（${model?.currentProgress ?? 0}%）` : "当前无作业"}</div>
                <div><b>设备：</b>{currentJob?.device_id || "dev_onboard_accept_001"}</div>
                <div><b>风险状态：</b>{riskStatus}</div>
              </div>

              <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>当前作业</div>
                {currentJob ? (
                  <div style={{ display: "grid", gap: 6, fontSize: 15 }}>
                    <div>- 类型：{actionText}</div>
                    <div>- 设备：{currentJob?.device_id || "-"}</div>
                    <div>- 状态：{mapOperationStatus(currentJob?.final_status)}</div>
                    <div>- 进度：{model?.currentProgress ?? 0}%</div>
                    <div>- 开始时间：{formatTimeOrFallback(Number(currentJob?.last_event_ts ?? 0))}</div>
                  </div>
                ) : <div className="muted">当前无作业</div>}
              </div>

              <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>最近动态</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15 }}>
                  {(model?.recentTimeline ?? []).map((x: any, idx: number) => (
                    <li key={`${x.ts}_${idx}`}>[{formatTimeOrFallback(x.ts)}] {x.text}</li>
                  ))}
                  {!(model?.recentTimeline ?? []).length ? <li className="muted">暂无最近动态</li> : null}
                </ul>
              </div>
            </div>
          ) : null}

          {activeTab === "map" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <FieldLegend labels={labels} />
              {!mapInput.polygonGeoJson ? <div className="card" style={{ padding: 10, color: "#b42318" }}>暂无轨迹数据</div> : null}
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{tt("field.layerControl")}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label><input type="checkbox" checked={showTrajectoryLayer} onChange={(e) => setShowTrajectoryLayer(e.target.checked)} /> {tt("field.layerTrajectory")}</label>
                  <label><input type="checkbox" checked={showAlertLayer} onChange={(e) => setShowAlertLayer(e.target.checked)} /> {tt("field.layerAlerts")}</label>
                  <label><input type="checkbox" checked={showAcceptanceLayer} onChange={(e) => setShowAcceptanceLayer(e.target.checked)} /> {tt("field.layerAcceptance")}</label>
                </div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div className="muted">时间线回放</div>
                <input type="range" min={0} max={Math.max(0, timelineEvents.length - 1)} value={timelineIndex} onChange={(e) => setTimelineIndex(Number(e.target.value))} style={{ width: "100%" }} />
                <div className="muted" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{timelineEvents[timelineIndex]?.label || "-"}</span>
                  <button className="btn" onClick={() => setPlaying((v) => !v)}>{playing ? "暂停" : "播放"}</button>
                </div>
              </div>
              <FieldGisMap
                polygonGeoJson={mapInput.polygonGeoJson}
                heatGeoJson={showAlertLayer ? mapInput.heatGeoJson : { type: "FeatureCollection", features: [] }}
                markers={mapInput.playbackMarkers}
                trajectorySegments={showTrajectoryLayer ? mapInput.trajectorySegments : []}
                acceptancePoints={showAcceptanceLayer ? mapInput.acceptancePoints : []}
                activeSegmentId={selectedObject?.id}
                labels={labels}
                onSelectObject={setSelectedObject}
              />
            </div>
          ) : null}

          {activeTab === "operations" ? <FieldOperationList labels={labels} items={model?.operationItems ?? []} onSelect={(item) => setSelectedObject({ kind: labels.operations, name: item.type, time: item.time, status: item.status, related: item.source, id: item.id })} /> : null}
          {activeTab === "alerts" ? <FieldAlertList labels={labels} items={model?.alertItems ?? []} onSelect={(item) => setSelectedObject({ kind: labels.alerts, name: item.type, time: item.time, status: item.status, related: item.target, id: item.id })} /> : null}

          {isDev ? (
            <details style={{ marginTop: 12 }}>
              <summary className="muted">{labels.devDebug}</summary>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify({ timelineEvents, mapInput, detail: model?.detail }, null, 2)}</pre>
            </details>
          ) : null}
        </div>

        <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "var(--shadow-sm)", alignSelf: "start" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>最近执行证据</div>
          {(model?.recentEvidence ?? []).length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15 }}>
              {(model?.recentEvidence ?? []).slice(0, 2).map((item: any) => <li key={item.id}>{item.text}</li>)}
            </ul>
          ) : latestEvidence ? <ReceiptEvidenceCard data={mapReceiptToVm(latestEvidence)} /> : <div className="muted">暂无执行证据</div>}
        </div>
      </section>
    </div>
  );
}
