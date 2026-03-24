import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import FieldSummaryCards from "../components/field/FieldSummaryCards";
import FieldOperationList from "../components/field/FieldOperationList";
import FieldAlertList from "../components/field/FieldAlertList";
import FieldLegend from "../components/field/FieldLegend";
import FieldSeasonPanel from "../components/field/FieldSeasonPanel";
import { FIELD_TEXT, getRiskColor, mapFieldStatusToLabel, riskKey, shortId, type FieldLang } from "../lib/fieldViewModel";
import { mapStatusToText, t } from "../lib/i18n";
import { useFieldDetail } from "../hooks/useFieldDetail";

type FieldTab = "overview" | "map" | "operations" | "alerts";

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const focusTaskId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("focusTask") || "";
  }, []);
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

  const { model, busy, status, refresh } = useFieldDetail({
    fieldId,
    lang,
    labels,
    playbackTs: playing ? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
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

  const risk = riskKey(model?.detail);

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
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value as FieldLang)}><option value="zh">中文</option><option value="en">English</option></select>
            <Link className="btn" to="/fields">{labels.back}</Link>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>{labels.refresh}</button>
          </div>
        </div>
      </section>

      <FieldSummaryCards items={model?.summaryCards ?? []} />

      <section className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <b>Season Program Summary</b>
            <div className="muted">同一地块跨 season 的 program 视图。</div>
          </div>
          <select className="select" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="ALL">全部 Season</option>
            {(model?.seasonOptions ?? []).map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
          {filteredSeasonPrograms.map((s: any) => (
            <div key={s.season_id} className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{s.season_id}</div>
              <div className="muted">Programs: {s.count}</div>
              <div className="muted">Active: {s.programs.filter((p: any) => String(p.status).toUpperCase() === "ACTIVE").length}</div>
            </div>
          ))}
          {!filteredSeasonPrograms.length ? <div className="muted">暂无 season program 数据</div> : null}
        </div>
      </section>

      <section className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map((tab) => <button key={tab.key} className={`btn ${activeTab === tab.key ? "primary" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
          <span className="muted">{status}</span>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          {activeTab === "overview" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>{labels.fieldName}：</b>{model?.detail?.field?.name || "-"}</div>
              <div><b>{labels.area}：</b>{model?.detail?.field?.area_ha ? `${model.detail.field.area_ha} ha` : "-"}</div>
              <div><b>{labels.currentSeason}：</b>{model?.detail?.latest_season?.name || model?.detail?.latest_season?.season_id || "-"}</div>
              <div><b>当前 active program：</b>{String(model?.currentProgram?.program_id ?? "-")}</div>
              <div><b>{labels.currentStatus}：</b>{mapFieldStatusToLabel(model?.detail?.field?.status, lang)}</div>
              <div><b>{labels.devices}：</b>{model?.detail?.summary?.device_count ?? 0}</div>
              <div><b>{labels.lastOperation}：</b>{model?.operationItems?.[0]?.type || "-"}</div>
              <div><b>{labels.activeAlerts}：</b>{model?.alertItems?.length ?? 0}</div>
              <div><b>{labels.riskStatus}：</b><span style={{ color: getRiskColor(risk), fontWeight: 700 }}>{model?.summaryCards?.[5]?.value ?? "-"}</span></div>

              <div style={{ marginTop: 12 }}><b>{tt("field.currentOperation")}</b></div>
              <div className="card" style={{ padding: 10 }}>
                <div>{tt("operation.labels.action")}：{model?.currentOperation?.action_type || tt("common.none")}</div>
                <div>{tt("operation.labels.device")}：{model?.currentOperation?.device_id || tt("common.none")}</div>
                <div>{tt("operation.filters.status")}：{model?.currentOperation ? mapStatusToText(String(model.currentOperation.final_status), tt) : tt("common.none")}</div>
                <div>{tt("field.progress")}：{model?.currentProgress ?? 0}%</div>
              </div>

              <div style={{ marginTop: 12 }}><b>{tt("field.recentTimeline")}</b></div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(model?.recentTimeline ?? []).map((x: any, idx: number) => (
                  <li key={`${x.ts}_${idx}`}>[{new Date(x.ts).toLocaleTimeString()}] {x.text}</li>
                ))}
                {!(model?.recentTimeline ?? []).length ? <li className="muted">-</li> : null}
              </ul>
            </div>
          ) : null}

          {activeTab === "map" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <FieldLegend labels={labels} />
              {!mapInput.polygonGeoJson ? <div className="card" style={{ padding: 10, color: "#b42318" }}>Geometry unavailable for this field.</div> : null}
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{tt("field.layerControl")}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label><input type="checkbox" checked={showTrajectoryLayer} onChange={(e) => setShowTrajectoryLayer(e.target.checked)} /> {tt("field.layerTrajectory")}</label>
                  <label><input type="checkbox" checked={showAlertLayer} onChange={(e) => setShowAlertLayer(e.target.checked)} /> {tt("field.layerAlerts")}</label>
                  <label><input type="checkbox" checked={showAcceptanceLayer} onChange={(e) => setShowAcceptanceLayer(e.target.checked)} /> {tt("field.layerAcceptance")}</label>
                </div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div className="muted">Timeline</div>
                <input type="range" min={0} max={Math.max(0, timelineEvents.length - 1)} value={timelineIndex} onChange={(e) => setTimelineIndex(Number(e.target.value))} style={{ width: "100%" }} />
                <div className="muted" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{timelineEvents[timelineIndex]?.label || "-"}</span>
                  <button className="btn" onClick={() => setPlaying((v) => !v)}>{playing ? "Pause" : "Play"}</button>
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

        <FieldSeasonPanel labels={labels} selectedMapObject={selectedObject} />
      </section>
    </div>
  );
}
