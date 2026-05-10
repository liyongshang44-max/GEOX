import React from "react";
import type { FlightTableLaneV1, FlightTableSkillFailureTypeV1 } from "../../../api/flightTable";
import { flightTableLaneLabel } from "../../../viewmodels/flightTableVm";

const LANES: FlightTableLaneV1[] = ["success", "evidence_insufficient", "weather_interference", "skill_failure", "all"];
const FAILURE_TYPES: Array<{ key: FlightTableSkillFailureTypeV1; label: string }> = [
  { key: "missing_sensing_skill", label: "缺少 sensing skill" },
  { key: "device_skill_disabled", label: "device skill disabled" },
  { key: "acceptance_skill_failed", label: "acceptance skill failed" },
];

type Props = {
  selectedLane: FlightTableLaneV1;
  selectedSkillFailureType: FlightTableSkillFailureTypeV1;
  onLaneChange: (lane: FlightTableLaneV1) => void;
  onSkillFailureTypeChange: (failureType: FlightTableSkillFailureTypeV1) => void;
};

export default function LaneComposer({ selectedLane, selectedSkillFailureType, onLaneChange, onSkillFailureTypeChange }: Props): React.ReactElement {
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>航线编排</h2>
        <span>FT-D 支持 skill failure lane</span>
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
      {selectedLane === "skill_failure" || selectedLane === "all" ? (
        <div className="flight-skill-failure-picker">
          <strong>Skill failure lane 配置</strong>
          <div className="flight-lane-grid">
            {FAILURE_TYPES.map((item) => (
              <button
                type="button"
                key={item.key}
                className={item.key === selectedSkillFailureType ? "flight-lane flight-lane-active" : "flight-lane"}
                onClick={() => onSkillFailureTypeChange(item.key)}
              >
                <strong>{item.label}</strong>
                <span>{item.key}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
