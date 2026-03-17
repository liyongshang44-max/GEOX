import React from "react";

export default function FieldSeasonPanel({ labels, detail, selectedMapObject }: { labels: any; detail: any; selectedMapObject: any }): React.ReactElement {
  const season = detail?.latest_season || detail?.season || {};
  return (
    <section className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>{labels.seasonInfo}</h3>
      <div><b>{labels.currentSeason}：</b>{season?.name || season?.season_id || "-"}</div>
      <div><b>{labels.crop}：</b>{season?.crop || "-"}</div>
      <div><b>{labels.currentStage}：</b>{season?.stage || "-"}</div>
      <div><b>{labels.currentStatus}：</b>{season?.status || "-"}</div>
      <hr style={{ border: 0, borderTop: "1px solid #eee" }} />
      <div><b>{labels.selectedObject}</b></div>
      {!selectedMapObject ? <div className="muted">{labels.noData}</div> : (
        <div style={{ display: "grid", gap: 6 }}>
          <div><b>{labels.status}：</b>{selectedMapObject.kind}</div>
          <div><b>{labels.time}：</b>{selectedMapObject.time || "-"}</div>
          <div><b>{labels.targetObject}：</b>{selectedMapObject.name || "-"}</div>
          {selectedMapObject.related ? <div><b>{labels.source}：</b>{selectedMapObject.related}</div> : null}
        </div>
      )}
    </section>
  );
}
