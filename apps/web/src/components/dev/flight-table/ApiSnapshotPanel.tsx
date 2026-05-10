import React from "react";
import type { FlightTableApiSnapshotV1 } from "../../../api/flightTable";

type Props = {
  snapshots: FlightTableApiSnapshotV1[];
};

export default function ApiSnapshotPanel({ snapshots }: Props): React.ReactElement {
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>API snapshots</h2>
        <span>{snapshots.length} 条</span>
      </div>
      {snapshots.length ? (
        <div className="flight-list">
          {snapshots.map((snapshot) => (
            <article key={snapshot.snapshot_id} className="flight-list-item">
              <strong>{snapshot.method} {snapshot.path}</strong>
              <span>{snapshot.ok ? "OK" : "FAIL"} · {snapshot.status_code ?? "-"} · {snapshot.created_at}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="flight-muted">尚无 API 快照。</p>
      )}
    </section>
  );
}
