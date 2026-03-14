import React from "react"; // React hooks and JSX.
import { Link, useParams } from "react-router-dom"; // Router params/back link.

import FieldGisMap from "../components/FieldGisMap"; // Field GIS renderer with canvas heat layer.
import { createFieldSeason, fetchFieldAlertHeat, fetchFieldDetail, fetchFieldTrajectorySeries, readStoredAoActToken, type FieldAlertHeatResponse } from "../lib/api"; // Field APIs.
import { applyLiveEventToMarkers, applyLiveEventToReplayState, applyLiveEventToTrajectoryGeoJson, buildFieldLiveUrl, buildReplayMarkers, buildReplayTrajectoryGeoJson, buildVisibleReplayDevices, createInitialReplayState, getReplayTimelineBounds, trajectorySeriesToReplayState, type FieldLiveEventV1, type FieldLiveMarker, type FieldReplayState } from "../lib/field_live"; // Live/replay helpers.

function fmtTs(ms: number | null | undefined): string { // Format millisecond timestamps for labels.
  if (!ms || !Number.isFinite(ms)) return "-"; // Missing timestamps render as a dash.
  return new Date(ms).toLocaleString(); // Browser-local readable time.
} // End helper.

function fmtIso(ts: string | null | undefined): string { // Format ISO strings when present.
  if (!ts) return "-"; // Missing timestamps render as a dash.
  const ms = Date.parse(ts); // Parse the ISO string into milliseconds.
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : ts; // Fall back to the raw string if parsing fails.
} // End helper.

function nextSeasonId(fieldId: string): string { // Seed a deterministic default season id.
  return `${fieldId}_season_${new Date().getFullYear()}`; // Field-specific current-year season id.
} // End helper.

function normalizeInitialMarkers(detail: any): FieldLiveMarker[] { // Normalize the initial field detail markers into live-marker state.
  return (Array.isArray(detail?.map_layers?.markers) ? detail.map_layers.markers : []).map((marker: any) => ({ // Normalize each marker.
    device_id: String(marker?.device_id ?? ""),
    lat: Number(marker?.lat ?? 0),
    lon: Number(marker?.lon ?? 0),
    ts_ms: Number(marker?.ts_ms ?? 0) || null,
  })).filter((marker: FieldLiveMarker) => !!marker.device_id && Number.isFinite(marker.lat) && Number.isFinite(marker.lon)); // Keep only valid markers.
} // End helper.

type SharedTimeRange = { from_ts_ms: number; to_ts_ms: number }; // Shared time window used by replay and heat.

type FieldTab = "overview" | "map" | "jobs" | "alerts"; // Top-level page tabs.
type MapMode = "live" | "replay"; // GIS sub-mode between live stream and replay timeline.
type HeatObjectType = "ALL" | "FIELD" | "DEVICE"; // Alert heat object scope filter.

function presetHoursToRange(hours: number): SharedTimeRange { // Convert a preset hour window into absolute timestamps.
  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(24 * 30, Math.floor(hours))) : 24; // Clamp to 1h..30d.
  const to_ts_ms = Date.now(); // Upper bound defaults to now.
  const from_ts_ms = to_ts_ms - safeHours * 60 * 60 * 1000; // Lower bound derived from the preset hours.
  return { from_ts_ms, to_ts_ms }; // Final preset window.
} // End helper.

function normalizeSharedTimeRange(range: SharedTimeRange): SharedTimeRange { // Enforce a valid and bounded shared time range.
  const now = Date.now(); // Used as an upper-bound fallback.
  const rawFrom = Number(range?.from_ts_ms ?? 0) || now - 24 * 60 * 60 * 1000; // Lower bound candidate.
  const rawTo = Number(range?.to_ts_ms ?? 0) || now; // Upper bound candidate.
  const minSpanMs = 60 * 1000; // Require at least one minute so the slider and queries stay sane.
  const maxSpanMs = 30 * 24 * 60 * 60 * 1000; // Cap at 30 days for this stage.
  const to_ts_ms = Math.max(rawFrom + minSpanMs, rawTo); // Ensure to >= from + min span.
  let from_ts_ms = rawFrom; // Start with the raw lower bound.
  if (to_ts_ms - from_ts_ms > maxSpanMs) from_ts_ms = to_ts_ms - maxSpanMs; // Clamp overly wide windows.
  return { from_ts_ms, to_ts_ms }; // Normalized time window.
} // End helper.

function toDateTimeLocalValue(ms: number | null | undefined): string { // Convert an absolute timestamp to a datetime-local input value.
  if (!ms || !Number.isFinite(ms)) return ""; // Guard missing timestamps.
  const d = new Date(ms); // Input date.
  const offsetMs = d.getTimezoneOffset() * 60 * 1000; // Browser local offset.
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm in local time.
} // End helper.

function parseDateTimeLocalValue(value: string, fallback: number): number { // Parse a datetime-local input value back into milliseconds.
  if (!value) return fallback; // Keep previous value on empty input.
  const ms = Date.parse(value); // Browser parses it in local time.
  return Number.isFinite(ms) ? ms : fallback; // Fall back when parsing fails.
} // End helper.

function describeTimeRange(range: SharedTimeRange): string { // Produce a compact label for the shared time controls.
  const spanHours = Math.max(1, Math.round((range.to_ts_ms - range.from_ts_ms) / (60 * 60 * 1000))); // Rounded hour span.
  return `${fmtTs(range.from_ts_ms)} ~ ${fmtTs(range.to_ts_ms)}（${spanHours}h）`; // Human-readable range summary.
} // End helper.

function createEmptyHeatResponse(field_id: string): FieldAlertHeatResponse { // Stable empty heat response used before the first dedicated load.
  return { ok: true, field_id, from_ts_ms: 0, to_ts_ms: 0, metric: null, object_type: "ALL", precision: 3, points: [], heat_geojson: { type: "FeatureCollection", features: [] } }; // Empty response envelope.
} // End helper.

const FIELD_TAB_LABELS: Record<FieldTab, string> = { // Tab label copy.
  overview: "概览",
  map: "地图",
  jobs: "作业",
  alerts: "告警",
};

const REPLAY_SPEED_OPTIONS = [1, 2, 4, 8]; // Conservative playback multipliers for replay.
const SHARED_TIME_PRESET_OPTIONS = [24, 168, 720]; // Shared replay + heat windows (1d / 7d / 30d).
const HEAT_PRECISION_OPTIONS = [2, 3, 4, 5]; // Alert heat spatial bucket precision options.

export default function FieldDetailPage(): React.ReactElement { // Field detail page with live telemetry, replay, and shared time controls.
  const params = useParams(); // Route params.
  const fieldId = decodeURIComponent(params.fieldId || ""); // Decode the field id from the URL.
  const [token, setToken] = React.useState<string>(() => readStoredAoActToken()); // Shared AO-ACT token state.
  const [detail, setDetail] = React.useState<any>(null); // Full field detail payload.
  const [busy, setBusy] = React.useState(false); // Page-level loading indicator.
  const [status, setStatus] = React.useState(""); // Page-level status text.
  const [activeTab, setActiveTab] = React.useState<FieldTab>("overview"); // Selected top tab.
  const [mapMode, setMapMode] = React.useState<MapMode>("live"); // GIS sub-mode selector.
  const [liveStatus, setLiveStatus] = React.useState("未连接"); // WebSocket connection state label.
  const [lastLiveTsMs, setLastLiveTsMs] = React.useState<number | null>(null); // Last live point timestamp.
  const [liveMarkers, setLiveMarkers] = React.useState<FieldLiveMarker[]>([]); // Incremental live marker state.
  const [liveTrajectoryGeoJson, setLiveTrajectoryGeoJson] = React.useState<any>({ type: "FeatureCollection", features: [] }); // Incremental live trajectory state.
  const [timePresetHours, setTimePresetHours] = React.useState<number>(24); // Shared preset window selector.
  const [timeRange, setTimeRange] = React.useState<SharedTimeRange>(() => presetHoursToRange(24)); // Shared replay + heat time window.
  const [timeControlStatus, setTimeControlStatus] = React.useState<string>(() => `共享时间窗口：${describeTimeRange(presetHoursToRange(24))}`); // Shared control status.
  const [replay, setReplay] = React.useState<FieldReplayState>(() => createInitialReplayState()); // Local replay controller state.
  const [heatMetric, setHeatMetric] = React.useState<string>(""); // Optional metric filter for heat map reloads.
  const [heatObjectType, setHeatObjectType] = React.useState<HeatObjectType>("ALL"); // Field/device object filter.
  const [heatPrecision, setHeatPrecision] = React.useState<number>(3); // Spatial bucketing precision.
  const [heatStatus, setHeatStatus] = React.useState<string>("未加载"); // Heat overlay loading state.
  const [heatResponse, setHeatResponse] = React.useState<FieldAlertHeatResponse>(() => createEmptyHeatResponse(fieldId)); // Dedicated heat overlay response.
  const [layerVisibility, setLayerVisibility] = React.useState({ polygon: true, trajectory: true, markers: true, heat: true }); // GIS layer toggles.

  const [seasonId, setSeasonId] = React.useState(nextSeasonId(fieldId || "field")); // Season form season_id.
  const [seasonName, setSeasonName] = React.useState("春季作业季"); // Season form name.
  const [seasonCrop, setSeasonCrop] = React.useState("水稻"); // Season form crop.
  const [seasonStatus, setSeasonStatus] = React.useState<"PLANNED" | "ACTIVE" | "CLOSED">("PLANNED"); // Season form status.

  const persistToken = (value: string) => { // Keep AO-ACT token in both React state and browser storage.
    const next = String(value ?? ""); // Normalize input.
    setToken(next); // Update component state.
    localStorage.setItem("geox_ao_act_token", next); // Persist for subsequent pages/tabs.
  }; // End helper.

  const refresh = React.useCallback(async () => { // Reload the field detail payload.
    if (!fieldId || !token) return; // Require both field id and token.
    setBusy(true); // Mark the page busy while loading.
    setStatus("加载中..."); // User-visible loading text.
    try { // Fetch field detail.
      const next = await fetchFieldDetail(token, fieldId); // Load the field detail payload.
      setDetail(next); // Store the full response.
      setLiveMarkers(normalizeInitialMarkers(next)); // Seed live markers from the server snapshot.
      setLiveTrajectoryGeoJson(next?.map_layers?.trajectory_geojson || { type: "FeatureCollection", features: [] }); // Seed live trajectory from the latest snapshot.
      setLastLiveTsMs(null); // Reset live last-event time so the next pushed point is obvious.
      setHeatResponse(createEmptyHeatResponse(fieldId)); // Reset dedicated heat overlay until the filtered endpoint is loaded.
      setHeatStatus("未加载"); // Dedicated heat overlay should refresh for the new field snapshot.
      setStatus("加载成功"); // User-visible success state.
    } catch (e: any) { // Error path.
      setStatus(`加载失败：${e?.message || String(e)}`); // Surface the fetch failure.
    } finally { // Always clear the spinner.
      setBusy(false); // End busy state.
    }
  }, [fieldId, token]); // Recompute when field or token changes.

  const loadReplay = React.useCallback(async (rangeOverride?: SharedTimeRange) => { // Load the replay trajectory window for the shared time range.
    if (!fieldId || !token) return; // Require both field id and token.
    const range = normalizeSharedTimeRange(rangeOverride ?? timeRange); // Use the shared time window.
    setReplay((prev) => ({ ...prev, status: "loading", error_text: "", playing: false })); // Enter loading state and stop playback.
    try { // Fetch replay data.
      const series = await fetchFieldTrajectorySeries(token, fieldId, { from_ts_ms: range.from_ts_ms, to_ts_ms: range.to_ts_ms, limit_points_per_device: 2000 }); // Load ordered replay points.
      setReplay((prev) => ({ ...trajectorySeriesToReplayState(series, prev), from_ts_ms: range.from_ts_ms, to_ts_ms: range.to_ts_ms, current_ts_ms: range.from_ts_ms })); // Normalize into local replay state with the shared range.
    } catch (e: any) { // Error path.
      setReplay((prev) => ({ ...prev, status: "error", error_text: e?.message || String(e), playing: false })); // Surface replay loading failure.
    }
  }, [fieldId, timeRange, token]); // Recompute when field/token/shared range changes.

  const loadHeat = React.useCallback(async (rangeOverride?: SharedTimeRange) => { // Load the dedicated alert heat overlay for the shared time range.
    if (!fieldId || !token) return; // Require both field id and token.
    const range = normalizeSharedTimeRange(rangeOverride ?? timeRange); // Use the shared time window.
    setHeatStatus("加载中..."); // Surface in-flight state to the operator.
    try { // Call the dedicated alert-heat endpoint.
      const next = await fetchFieldAlertHeat(token, fieldId, { from_ts_ms: range.from_ts_ms, to_ts_ms: range.to_ts_ms, metric: heatMetric.trim() || undefined, object_type: heatObjectType, precision: heatPrecision }); // Fetch filtered heat buckets.
      setHeatResponse(next); // Store the fetched overlay payload.
      setHeatStatus(next.points.length > 0 ? `已加载 ${next.points.length} 个热力桶` : "当前窗口无告警热力数据"); // Render a meaningful empty state too.
    } catch (e: any) { // Error path.
      setHeatResponse(createEmptyHeatResponse(fieldId)); // Reset the heat overlay on failure.
      setHeatStatus(`加载失败：${e?.message || String(e)}`); // Surface the failure reason.
    }
  }, [fieldId, heatMetric, heatObjectType, heatPrecision, timeRange, token]); // Recompute when field/token/filters/shared range change.

  const reloadMapWindow = React.useCallback(async (rangeOverride?: SharedTimeRange) => { // Reload replay and heat together from the same time window.
    const range = normalizeSharedTimeRange(rangeOverride ?? timeRange); // Effective shared time window.
    setTimeRange(range); // Persist the normalized range.
    setTimeControlStatus(`共享时间窗口：${describeTimeRange(range)}`); // Surface the effective range.
    await Promise.all([loadReplay(range), loadHeat(range)]); // Refresh both data sources together.
  }, [loadHeat, loadReplay, timeRange]); // Shared loader dependencies.

  React.useEffect(() => { // Refresh field detail whenever the route field changes.
    setSeasonId(nextSeasonId(fieldId || "field")); // Reset the season id seed for the new field.
    void refresh(); // Load the latest field detail snapshot.
  }, [fieldId, refresh]); // Re-run when the route changes.

  React.useEffect(() => { // Load replay points and heat overlay when the map tab becomes active.
    if (activeTab !== "map") return; // Only load GIS-side data when the user is on the map tab.
    void Promise.all([loadReplay(timeRange), loadHeat(timeRange)]); // Pull replay + heat from the current shared window.
  }, [activeTab, fieldId, token]); // Re-run when the map tab, field, or token changes.

  React.useEffect(() => { // Auto-refresh heat buckets when non-time heat filters change inside the map tab.
    if (activeTab !== "map" || !fieldId || !token) return; // Require the map context and auth.
    const timer = window.setTimeout(() => { // Simple debounce to avoid burst reloads while the user is still typing/selecting.
      void loadHeat(timeRange); // Recompute heat buckets within the current shared time window.
    }, 250); // Small debounce keeps the UI responsive without spamming requests.
    return () => window.clearTimeout(timer); // Cancel pending reload when inputs change again.
  }, [activeTab, fieldId, token, heatMetric, heatObjectType, heatPrecision, loadHeat, timeRange]); // Heat filters only; time uses the explicit apply action.

  React.useEffect(() => { // Open the field-scoped live WebSocket while the map tab is visible.
    if (activeTab !== "map" || !fieldId || !token) return; // Only connect when the map tab is actually in use.
    const ws = new WebSocket(buildFieldLiveUrl(fieldId, token)); // Build and open the field live stream URL.
    setLiveStatus("连接中..."); // User-visible intermediate state.

    ws.onopen = () => { // Upgrade success.
      setLiveStatus("已连接"); // Mark the live stream as connected.
    };
    ws.onmessage = (message) => { // Handle live telemetry frames.
      try { // Parse server JSON frames.
        const payload = JSON.parse(String(message.data ?? "{}")); // Parse the frame payload.
        if (payload?.type === "telemetry_stream_ready_v1") return; // Ignore the stream-ready control frame.
        if (payload?.type !== "device_geo_update_v1") return; // Only handle stage 1 geo updates.
        const event = payload as FieldLiveEventV1; // Narrow to the live event shape.
        if (event.field_id !== fieldId) return; // Defensive field filter.
        setLastLiveTsMs(event.ts_ms); // Remember the most recent pushed timestamp.
        setLiveMarkers((prev) => applyLiveEventToMarkers(prev, event)); // Incrementally move the device marker.
        setLiveTrajectoryGeoJson((prev: any) => applyLiveEventToTrajectoryGeoJson(prev, event)); // Incrementally extend the live trajectory line.
        setReplay((prev) => applyLiveEventToReplayState(prev, event)); // Fold live points into replay state.
      } catch { // Ignore malformed frames.
        setLiveStatus("消息解析失败"); // Surface protocol issues without crashing the page.
      }
    };
    ws.onerror = () => { // Browser-level socket error.
      setLiveStatus("连接异常"); // Reflect the failure in the UI.
    };
    ws.onclose = () => { // Socket closed by either side.
      setLiveStatus("已断开"); // Reflect disconnect state.
    };

    return () => { // Cleanup when leaving the map tab or field page.
      ws.close(); // Close the live socket explicitly.
    };
  }, [activeTab, fieldId, token]); // Re-open when map visibility, field id, or token changes.

  React.useEffect(() => { // Advance the replay timeline locally while playback is running.
    if (!replay.playing) return; // Idle when replay is paused.
    const bounds = getReplayTimelineBounds(replay); // Need valid timeline bounds to play.
    if (!bounds || replay.current_ts_ms == null) return; // No replay data loaded yet.
    const timer = window.setInterval(() => { // Local playback clock.
      setReplay((prev) => { // Use functional state update so the timer always sees fresh state.
        const current = prev.current_ts_ms ?? prev.from_ts_ms ?? null; // Current playback cursor.
        if (current == null || prev.to_ts_ms == null || prev.from_ts_ms == null) return prev; // Missing bounds => keep state unchanged.
        const next = current + 1000 * Math.max(1, prev.speed); // Replay advances in one-second chunks scaled by speed.
        if (next >= prev.to_ts_ms) return { ...prev, current_ts_ms: prev.to_ts_ms, playing: false }; // Stop at the end of the replay window.
        return { ...prev, current_ts_ms: next }; // Advance the cursor.
      });
    }, 250); // Update four times per second for reasonably smooth motion.
    return () => window.clearInterval(timer); // Clear the timer on pause/unmount.
  }, [replay.playing, replay.speed, replay.from_ts_ms, replay.to_ts_ms, replay.current_ts_ms]); // Rebuild timer when playback parameters change.

  const submitSeason = async () => { // Save a field season using the existing API.
    if (!fieldId) return; // Require a field id.
    setBusy(true); // Busy while saving.
    try { // Save the season.
      await createFieldSeason(token, fieldId, { season_id: seasonId, name: seasonName, crop: seasonCrop, status: seasonStatus }); // Persist the season.
      setStatus(`季节 ${seasonId} 已保存`); // User-visible success message.
      await refresh(); // Refresh the field detail snapshot.
    } catch (e: any) { // Error path.
      setStatus(`保存失败：${e?.message || String(e)}`); // User-visible failure message.
    } finally { // Always clear busy state.
      setBusy(false); // End busy state.
    }
  }; // End helper.

  const tabs: FieldTab[] = ["overview", "map", "jobs", "alerts"]; // Stable tab order.
  const polygonGeo = detail?.polygon?.geojson_json; // Field polygon geojson.
  const fallbackHeatGeo = detail?.map_layers?.alert_heat_geojson || { type: "FeatureCollection", features: [] }; // Snapshot heat layer from the field detail payload.
  const heatGeo = heatResponse?.heat_geojson?.features?.length ? heatResponse.heat_geojson : fallbackHeatGeo; // Prefer dedicated filtered heat buckets when loaded.
  const jobHistory = detail?.map_layers?.job_history || []; // Existing job history snapshot.
  const replayBounds = getReplayTimelineBounds(replay) ?? { min: timeRange.from_ts_ms, max: timeRange.to_ts_ms }; // Slider bounds for the shared replay controls.
  const visibleReplayDevices = buildVisibleReplayDevices(replay); // Replay-visible device trajectories.
  const replayMarkers = buildReplayMarkers(visibleReplayDevices); // Replay-mode device markers.
  const replayTrajectoryGeoJson = buildReplayTrajectoryGeoJson(visibleReplayDevices); // Replay-mode trajectory lines.
  const mapMarkers = mapMode === "live" ? liveMarkers : replayMarkers; // GIS markers for the active sub-mode.
  const trajectoryGeo = mapMode === "live" ? liveTrajectoryGeoJson : replayTrajectoryGeoJson; // GIS trajectories for the active sub-mode.
  const heatBucketCount = Array.isArray(heatResponse?.points) ? heatResponse.points.length : (heatGeo?.features?.length || 0); // Current alert heat bucket count.
  const strongestHeatWeight = Array.isArray(heatResponse?.points) && heatResponse.points.length > 0 ? Math.max(...heatResponse.points.map((point) => Number(point.weight ?? 0) || 0)) : 0; // Strongest visible heat bucket.

  return (
    <div className="layoutStack"> {/* Field detail page stack. */}
      <div className="pageHeaderRow"> {/* Page header row. */}
        <div> {/* Title block. */}
          <h1 className="pageTitle">田块详情</h1> {/* Page title. */}
          <div className="pageSubtitle">{fieldId || "-"}</div> {/* Field id subtitle. */}
        </div>
        <Link className="btn ghost" to="/fields">返回列表</Link> {/* Back to field list. */}
      </div>

      <section className="card sectionBlock"> {/* Token/refresh controls. */}
        <div className="fieldRow"> {/* Inline form row. */}
          <input className="input" value={token} onChange={(e) => persistToken(e.target.value)} placeholder="AO-ACT Token" /> {/* Token input. */}
          <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button> {/* Refresh detail snapshot. */}
          <span className="muted">{status}</span> {/* Status label. */}
        </div>
      </section>

      <section className="card sectionBlock"> {/* Main field detail card. */}
        <div className="tabBar"> {/* Top tab bar. */}
          {tabs.map((tab) => (
            <button key={tab} className={`tabBtn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>{FIELD_TAB_LABELS[tab]}</button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="contentGridTwo alignStart"> {/* Two-column overview layout. */}
            <div className="infoCard"> {/* Field summary. */}
              <div>名称：{detail?.field?.name || "-"}</div>
              <div>面积：{detail?.field?.area_ha ?? "-"} ha</div>
              <div>状态：{detail?.field?.status || "-"}</div>
              <div>设备数：{detail?.summary?.device_count ?? 0}</div>
            </div>
            <div className="infoCard"> {/* Season editor. */}
              <div className="fieldRow"> {/* Season form row. */}
                <input className="input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} placeholder="season_id" />
                <input className="input" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="季节名称" />
                <input className="input" value={seasonCrop} onChange={(e) => setSeasonCrop(e.target.value)} placeholder="作物" />
                <select className="input" value={seasonStatus} onChange={(e) => setSeasonStatus(e.target.value as any)}>
                  <option value="PLANNED">PLANNED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <button className="btn" onClick={() => void submitSeason()}>保存季节</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "map" && (
          <div className="layoutStack"> {/* Map tab stack. */}
            <div className="infoCard" style={{ display: "grid", gap: 14 }}> {/* Unified GIS control panel. */}
              <div style={{ display: "grid", gap: 10 }}> {/* Panel section: mode + status. */}
                <div className="jobTitleRow"> {/* Section title row. */}
                  <div className="title">地图控制台</div>
                  <div className="meta wrapMeta">
                    <span>统一时间窗口 + 回放控制 + 图层筛选</span>
                  </div>
                </div>
                <div className="fieldRow" style={{ flexWrap: "wrap", gap: 8 }}> {/* Mode and live status. */}
                  <button className={`btn ${mapMode === "live" ? "" : "ghost"}`} onClick={() => setMapMode("live")}>实时轨迹</button>
                  <button className={`btn ${mapMode === "replay" ? "" : "ghost"}`} onClick={() => setMapMode("replay")}>时间轴回放</button>
                  <span className="pill tone-default">实时流：{liveStatus}</span>
                  <span className="pill tone-default">最近推送：{fmtTs(lastLiveTsMs)}</span>
                  <span className="pill tone-default">当前模式：{mapMode === "live" ? "实时" : "回放"}</span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, paddingTop: 6, borderTop: "1px solid rgba(15,23,42,0.08)" }}> {/* Panel section: shared time window. */}
                <div className="jobTitleRow">
                  <div className="title">统一时间窗口</div>
                  <div className="meta wrapMeta">
                    <span>{describeTimeRange(timeRange)}</span>
                  </div>
                </div>
                <div className="fieldRow" style={{ flexWrap: "wrap", gap: 8 }}>
                  <select className="input" style={{ width: 120 }} value={timePresetHours} onChange={(e) => {
                    const hours = Number(e.target.value) || 24; // Selected preset.
                    setTimePresetHours(hours); // Persist the new preset.
                    setTimeRange(presetHoursToRange(hours)); // Update the editable shared window.
                    setTimeControlStatus(`待应用：${describeTimeRange(presetHoursToRange(hours))}`); // Surface pending change.
                  }}>
                    {SHARED_TIME_PRESET_OPTIONS.map((hours) => <option key={hours} value={hours}>{hours === 24 ? "24 小时" : hours === 168 ? "7 天" : "30 天"}</option>)}
                  </select>
                  <input className="input" style={{ width: 210 }} type="datetime-local" value={toDateTimeLocalValue(timeRange.from_ts_ms)} onChange={(e) => setTimeRange((prev) => ({ ...prev, from_ts_ms: parseDateTimeLocalValue(e.target.value, prev.from_ts_ms) }))} />
                  <span className="muted">至</span>
                  <input className="input" style={{ width: 210 }} type="datetime-local" value={toDateTimeLocalValue(timeRange.to_ts_ms)} onChange={(e) => setTimeRange((prev) => ({ ...prev, to_ts_ms: parseDateTimeLocalValue(e.target.value, prev.to_ts_ms) }))} />
                  <button className="btn ghost" onClick={() => void reloadMapWindow()}>应用时间窗口</button>
                </div>
                <div className="meta wrapMeta">
                  <span>{timeControlStatus}</span>
                  <span>应用时统一刷新轨迹与热力</span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, paddingTop: 6, borderTop: "1px solid rgba(15,23,42,0.08)" }}> {/* Panel section: replay controls. */}
                <div className="jobTitleRow">
                  <div className="title">回放控制</div>
                  <div className="meta wrapMeta">
                    <span>当前：{fmtTs(replay.current_ts_ms)}</span>
                    <span>回放状态：{replay.status === "loading" ? "加载中" : replay.status === "error" ? `失败：${replay.error_text}` : replay.status === "ready" ? "已就绪" : "未加载"}</span>
                  </div>
                </div>
                <div className="fieldRow" style={{ flexWrap: "wrap", gap: 8 }}>
                  <button className="btn ghost" onClick={() => setReplay((prev) => ({ ...prev, current_ts_ms: prev.from_ts_ms, playing: false }))} disabled={!replayBounds || mapMode !== "replay"}>起点</button>
                  <button className="btn ghost" onClick={() => setReplay((prev) => ({ ...prev, playing: !prev.playing }))} disabled={!replayBounds || mapMode !== "replay"}>{replay.playing ? "暂停" : "播放"}</button>
                  <button className="btn ghost" onClick={() => setReplay((prev) => ({ ...prev, current_ts_ms: prev.to_ts_ms, playing: false }))} disabled={!replayBounds || mapMode !== "replay"}>终点</button>
                  <label className="muted">倍速</label>
                  <select className="input" style={{ width: 100 }} value={replay.speed} onChange={(e) => setReplay((prev) => ({ ...prev, speed: Number(e.target.value) || 1 }))} disabled={mapMode !== "replay"}>
                    {REPLAY_SPEED_OPTIONS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
                  </select>
                  <label className="muted">设备</label>
                  <select className="input" style={{ width: 220 }} value={replay.selected_device_id} onChange={(e) => setReplay((prev) => ({ ...prev, selected_device_id: e.target.value }))}>
                    <option value="">全部设备</option>
                    {replay.devices.map((device) => <option key={device.device_id} value={device.device_id}>{device.device_id}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <input type="range" min={replayBounds?.min ?? timeRange.from_ts_ms} max={replayBounds?.max ?? timeRange.to_ts_ms} value={replay.current_ts_ms ?? replayBounds?.min ?? timeRange.from_ts_ms} onChange={(e) => setReplay((prev) => ({ ...prev, current_ts_ms: Number(e.target.value), playing: false }))} disabled={!replayBounds || mapMode !== "replay"} />
                  <div className="meta wrapMeta">
                    <span>窗口：{fmtTs(timeRange.from_ts_ms)} ~ {fmtTs(timeRange.to_ts_ms)}</span>
                    <span>回放设备：{visibleReplayDevices.length}</span>
                    <span>实时设备：{liveMarkers.length}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, paddingTop: 6, borderTop: "1px solid rgba(15,23,42,0.08)" }}> {/* Panel section: layer and heat filters. */}
                <div className="jobTitleRow">
                  <div className="title">图层与热力筛选</div>
                  <div className="meta wrapMeta">
                    <span>{heatStatus}</span>
                    <span>热力桶：{heatBucketCount}</span>
                    <span>最大权重：{strongestHeatWeight}</span>
                  </div>
                </div>
                <div className="fieldRow" style={{ flexWrap: "wrap", gap: 8 }}>
                  <button className={`btn ${layerVisibility.polygon ? "" : "ghost"}`} onClick={() => setLayerVisibility((prev) => ({ ...prev, polygon: !prev.polygon }))}>地块边界</button>
                  <button className={`btn ${layerVisibility.markers ? "" : "ghost"}`} onClick={() => setLayerVisibility((prev) => ({ ...prev, markers: !prev.markers }))}>{mapMode === "live" ? "实时设备" : "回放设备"}</button>
                  <button className={`btn ${layerVisibility.trajectory ? "" : "ghost"}`} onClick={() => setLayerVisibility((prev) => ({ ...prev, trajectory: !prev.trajectory }))}>历史轨迹</button>
                  <button className={`btn ${layerVisibility.heat ? "" : "ghost"}`} onClick={() => setLayerVisibility((prev) => ({ ...prev, heat: !prev.heat }))}>告警热力</button>
                </div>
                <div className="fieldRow" style={{ flexWrap: "wrap", gap: 8 }}>
                  <label className="muted">metric</label>
                  <input className="input" style={{ width: 200 }} value={heatMetric} onChange={(e) => setHeatMetric(e.target.value)} placeholder="全部 metric" />
                  <label className="muted">对象</label>
                  <select className="input" style={{ width: 120 }} value={heatObjectType} onChange={(e) => setHeatObjectType(e.target.value as HeatObjectType)}>
                    <option value="ALL">全部</option>
                    <option value="FIELD">FIELD</option>
                    <option value="DEVICE">DEVICE</option>
                  </select>
                  <label className="muted">聚合精度</label>
                  <select className="input" style={{ width: 110 }} value={heatPrecision} onChange={(e) => setHeatPrecision(Number(e.target.value) || 3)}>
                    {HEAT_PRECISION_OPTIONS.map((precision) => <option key={precision} value={precision}>{precision}</option>)}
                  </select>
                  <span className="muted">筛选修改后自动刷新热力</span>
                </div>
              </div>
            </div>

            <FieldGisMap polygonGeoJson={polygonGeo} trajectoryGeoJson={trajectoryGeo} heatGeoJson={heatGeo} markers={mapMarkers} layerVisibility={layerVisibility} /> {/* Shared GIS renderer. */}
            <div className="meta wrapMeta"> {/* GIS map stats. */}
              <span>轨迹线：{trajectoryGeo?.features?.length || 0}</span>
              <span>设备定位点：{mapMarkers.length}</span>
              <span>告警热力桶：{heatBucketCount}</span>
              <span>热力状态：{heatStatus}</span>
            </div>
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="list modernList"> {/* Job cards. */}
            {jobHistory.map((item: any) => (
              <div key={item.id} className="infoCard"> {/* Job card. */}
                <div className="jobTitleRow"><div className="title">{item.task_type || "作业"}</div><div className="pill tone-default">{item.device_id || "-"}</div></div>
                <div className="meta">
                  <span>时间：{fmtTs(item.ts_ms)}</span>
                  <span>位置：{item.location ? `${item.location.lat.toFixed(5)}, ${item.location.lon.toFixed(5)}` : "-"}</span>
                  <span>轨迹点：{item.trajectory_points ?? 0}</span>
                  <span>轨迹窗口：{item.trajectory_window_start_ts_ms ? `${fmtTs(item.trajectory_window_start_ts_ms)} ~ ${fmtTs(item.trajectory_window_end_ts_ms)}` : "-"}</span>
                  <span>时间来源：{item.timing_source || "-"}</span>
                </div>
              </div>
            ))}
            {!jobHistory.length && <div className="emptyState">暂无作业历史轨迹数据</div>} {/* Empty state. */}
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="list modernList"> {/* Alert cards. */}
            {(detail?.recent_alerts || []).map((event: any) => (
              <div key={event.event_id} className="infoCard"> {/* Alert card. */}
                <div className="jobTitleRow"><div className="title">{event.metric || "alert"}</div><div className="pill tone-warn">{event.status}</div></div>
                <div className="meta"><span>对象：{event.object_id}</span><span>触发：{fmtTs(event.raised_ts_ms)}</span><span>时间：{fmtIso(event.raised_at)}</span></div>
              </div>
            ))}
            {!detail?.recent_alerts?.length && <div className="emptyState">暂无告警</div>} {/* Empty state. */}
          </div>
        )}
      </section>
    </div>
  ); // End page render.
} // End FieldDetailPage.
