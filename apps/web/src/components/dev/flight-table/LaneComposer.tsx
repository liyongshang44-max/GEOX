import React from "react";
import type { FlightTableLaneV1, FlightTableSkillFailureTypeV1 } from "../../../api/flightTable";
import { flightTableLaneLabel } from "../../../viewmodels/flightTableVm";

const LANES: Array<{
  key: FlightTableLaneV1;
  target: string;
  prerequisites: string;
  expected: string;
  acceptancePage: string;
}> = [
  {
    key: "success",
    target: "完整闭环 PASS",
    prerequisites: "field / geometry / device / skills / evidence complete",
    expected: "PASS",
    acceptancePage: "验收回放 + customer/operator 页面点亮",
  },
  {
    key: "evidence_insufficient",
    target: "制造证据不足诊断",
    prerequisites: "field / device / operation 存在，evidence_policy=insufficient",
    expected: "FAIL at G，后续 SKIPPED",
    acceptancePage: "验收回放显示 evidence insufficient",
  },
  {
    key: "weather_interference",
    target: "制造天气干扰诊断",
    prerequisites: "field geometry 存在，weather_policy=simulate_weather_interference",
    expected: "FAIL at H，后续 SKIPPED",
    acceptancePage: "诊断报告显示 weather interference",
  },
  {
    key: "skill_failure",
    target: "制造技能失败诊断",
    prerequisites: "skills 已绑定或允许 fail-one 注入",
    expected: "FAIL at C0，operator trace 可见失败原因",
    acceptancePage: "operator skill trace/performance",
  },
  {
    key: "all",
    target: "全异常航线抽样",
    prerequisites: "尽可能装配全部对象；按异常策略优先暴露第一个失败点",
    expected: "可诊断 FAIL + SKIPPED",
    acceptancePage: "验收回放 + 诊断报告",
  },
];

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
        <span>FT-E Run Control</span>
      </div>
      <div className="flight-lane-grid flight-lane-grid-detailed">
        {LANES.map((lane) => (
          <button
            type="button"
            key={lane.key}
            className={lane.key === selectedLane ? "flight-lane flight-lane-active" : "flight-lane"}
            onClick={() => onLaneChange(lane.key)}
          >
            <strong>{flightTableLaneLabel(lane.key)}</strong>
            <span>目标：{lane.target}</span>
            <span>前置对象：{lane.prerequisites}</span>
            <span>预期终态：{lane.expected}</span>
            <span>验收页面：{lane.acceptancePage}</span>
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
