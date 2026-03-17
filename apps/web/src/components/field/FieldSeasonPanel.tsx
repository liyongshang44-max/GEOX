import React from "react";

export default function FieldSeasonPanel({ labels, selectedMapObject }: { labels: any; selectedMapObject: any }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>{labels.selectedObject}</h3>
      {!selectedMapObject ? <div className="muted">{labels.noData}</div> : (
        <div style={{ display: "grid", gap: 6 }}>
          <div><b>{labels.status}：</b>{selectedMapObject.kind || "-"}</div>
          <div><b>{labels.targetObject}：</b>{selectedMapObject.name || selectedMapObject.id || "-"}</div>
          <div><b>{labels.time}：</b>{selectedMapObject.time || "-"}</div>
          <div><b>{labels.currentStatus}：</b>{selectedMapObject.status || "-"}</div>
          {selectedMapObject.related ? <div><b>{labels.source}：</b>{selectedMapObject.related}</div> : null}
        </div>
      )}
    </section>
  );
}
