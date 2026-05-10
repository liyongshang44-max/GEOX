import React from "react";
import type { FlightTableLaneV1 } from "../../../api/flightTable";
import { flightTableLaneLabel } from "../../../viewmodels/flightTableVm";

const LANES: FlightTableLaneV1[] = ["success", "evidence_insufficient", "weather_interference", "skill_failure", "all"];

type Props = {
  selectedLane: FlightTableLaneV1;
  onLaneChange: (lane: FlightTableLaneV1) => void;
};

export default function LaneComposer({ selectedLane, onLaneChange }: Props): React.ReactElement {
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>航线编排</h2>
        <span>FT-E 后启动真实航线</span>
      </div>
      <div className="flight-lane-grid">
        {LANES.map((lane) => (
          <button
            type="button"
            key={lane}
            className={lane === selectedLane ? "flight-lane flight-lane-active" : "flight-lane"}
            onClick={() => onLaneChange(lane)}
          >
            <strong>{flightTableLaneLabel(lane)}</strong>
            <span>{lane === "success" ? "预期终态：PASS" : "预期终态：可诊断异常"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
