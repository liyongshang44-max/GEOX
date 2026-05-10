import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
import { flightTableUiReplayUrls } from "../../../viewmodels/flightTableVm";

type Props = {
  run: FlightTableRunV1 | null;
};

export default function UiReplayLinks({ run }: Props): React.ReactElement {
  const links = flightTableUiReplayUrls(run);
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>客户/运营页面映射</h2>
        <span>复用现有 UI</span>
      </div>
      <div className="flight-list">
        {links.map((link) => (
          <article key={link.label} className="flight-list-item">
            <strong>{link.label}</strong>
            {link.enabled ? <a href={link.url}>{link.url}</a> : <span className="flight-muted">等待 manifest 对象</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
