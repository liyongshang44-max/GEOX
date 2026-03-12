import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { createFieldSeason, fetchFieldDetail } from "../lib/api";

function fmtTs(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}
function fmtIso(ts: string | null | undefined): string {
  if (!ts) return "-";
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : ts;
}
function nextSeasonId(fieldId: string): string {
  return `${fieldId}_season_${new Date().getFullYear()}`;
}

type FieldTab = "overview" | "map" | "jobs" | "alerts";

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const [token, setToken] = React.useState<string>(() => localStorage.getItem("geox_ao_act_token") || "");
  const [detail, setDetail] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<FieldTab>("overview");

  const [seasonId, setSeasonId] = React.useState(nextSeasonId(fieldId || "field"));
  const [seasonName, setSeasonName] = React.useState("春季作业季");
  const [seasonCrop, setSeasonCrop] = React.useState("水稻");
  const [seasonStatus, setSeasonStatus] = React.useState<"PLANNED" | "ACTIVE" | "CLOSED">("PLANNED");

  const persistToken = (v: string) => {
    setToken(v);
    localStorage.setItem("geox_ao_act_token", v);
  };

  const refresh = React.useCallback(async () => {
    if (!fieldId || !token) return;
    setBusy(true);
    setStatus("加载中...");
    try {
      const next = await fetchFieldDetail(token, fieldId);
      setDetail(next);
      setStatus("加载成功");
    } catch (e: any) {
      setStatus(`加载失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [fieldId, token]);

  React.useEffect(() => {
    setSeasonId(nextSeasonId(fieldId || "field"));
    void refresh();
  }, [fieldId, refresh]);

  const submitSeason = async () => {
    if (!fieldId) return;
    setBusy(true);
    try {
      await createFieldSeason(token, fieldId, {
        season_id: seasonId,
        name: seasonName,
        crop: seasonCrop,
        status: seasonStatus,
      });
      setStatus(`季节 ${seasonId} 已保存`);
      await refresh();
    } catch (e: any) {
      setStatus(`保存失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const tabs: FieldTab[] = ["overview", "map", "jobs", "alerts"];
  const polygonGeo = detail?.polygon?.geojson_json;
  const mapMarkers = detail?.map_layers?.markers || [];
  const trajectoryGeo = detail?.map_layers?.trajectory_geojson || { type: "FeatureCollection", features: [] };
  const heatGeo = detail?.map_layers?.alert_heat_geojson || { type: "FeatureCollection", features: [] };
  const jobHistory = detail?.map_layers?.job_history || [];

  return (
    <div className="layoutStack">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">田块详情</h1>
          <div className="pageSubtitle">{fieldId || "-"}</div>
        </div>
        <Link className="btn ghost" to="/fields">返回列表</Link>
      </div>

      <section className="card sectionBlock">
        <div className="fieldRow">
          <input className="input" value={token} onChange={(e) => persistToken(e.target.value)} placeholder="AO-ACT Token" />
          <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button>
          <span className="muted">{status}</span>
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="tabBar">{tabs.map((t) => (
          <button key={t} className={`tabBtn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}</div>

        {activeTab === "overview" && (
          <div className="contentGridTwo alignStart">
            <div className="infoCard">
              <div>名称：{detail?.field?.name || "-"}</div>
              <div>面积：{detail?.field?.area_ha ?? "-"} ha</div>
              <div>状态：{detail?.field?.status || "-"}</div>
              <div>设备数：{detail?.summary?.device_count ?? 0}</div>
            </div>
            <div className="infoCard">
              <div className="fieldRow">
                <input className="input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} placeholder="season_id" />
                <input className="input" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="季节名称" />
                <input className="input" value={seasonCrop} onChange={(e) => setSeasonCrop(e.target.value)} placeholder="作物" />
                <select className="input" value={seasonStatus} onChange={(e) => setSeasonStatus(e.target.value as any)}>
                  <option value="PLANNED">PLANNED</option><option value="ACTIVE">ACTIVE</option><option value="CLOSED">CLOSED</option>
                </select>
                <button className="btn" onClick={() => void submitSeason()}>保存季节</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "map" && (
          <div className="layoutStack">
            <FieldGisMap polygonGeoJson={polygonGeo} trajectoryGeoJson={trajectoryGeo} heatGeoJson={heatGeo} markers={mapMarkers} />
            <div className="meta wrapMeta">
              <span>设备轨迹：{trajectoryGeo?.features?.length || 0}</span>
              <span>设备定位点：{mapMarkers.length}</span>
              <span>告警热力点：{heatGeo?.features?.length || 0}</span>
            </div>
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="list modernList">
            {jobHistory.map((item: any) => (
              <div key={item.id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{item.task_type || "作业"}</div><div className="pill tone-default">{item.device_id || "-"}</div></div>
                <div className="meta">
                  <span>时间：{fmtTs(item.ts_ms)}</span>
                  <span>位置：{item.location ? `${item.location.lat.toFixed(5)}, ${item.location.lon.toFixed(5)}` : "-"}</span>
                  <span>轨迹点：{item.trajectory_points ?? 0}</span>
                </div>
              </div>
            ))}
            {!jobHistory.length && <div className="emptyState">暂无作业历史轨迹数据</div>}
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="list modernList">
            {(detail?.recent_alerts || []).map((event: any) => (
              <div key={event.event_id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{event.metric || "alert"}</div><div className="pill tone-warn">{event.status}</div></div>
                <div className="meta"><span>对象：{event.object_id}</span><span>触发：{fmtTs(event.raised_ts_ms)}</span><span>时间：{fmtIso(event.raised_at)}</span></div>
              </div>
            ))}
            {!detail?.recent_alerts?.length && <div className="emptyState">暂无告警</div>}
          </div>
        )}
      </section>
    </div>
  );
}
