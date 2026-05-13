import React from "react";
import type { FlightTableSkillAssemblyItemV1, FlightTableSkillAssemblyResponseV1, FlightTableSkillFailureTypeV1 } from "../../../api/flightTable";

type Props = {
  skillBindingIds: string[];
  skillRunIds: string[];
  skillResult: FlightTableSkillAssemblyResponseV1 | null;
  failureType: FlightTableSkillFailureTypeV1;
  loading: boolean;
  error: string | null;
  onFailureTypeChange: (next: FlightTableSkillFailureTypeV1) => void;
  onBindSkills: () => void;
  onFailOne: () => void;
  onRestore: () => void;
};

const GROUPS: Array<{ key: FlightTableSkillAssemblyItemV1["classification"]; label: string }> = [
  { key: "sensing", label: "感知技能" },
  { key: "agronomy", label: "农艺技能" },
  { key: "device", label: "设备技能" },
  { key: "acceptance", label: "验收技能" },
];

const FAILURE_LABELS: Record<FlightTableSkillFailureTypeV1, string> = {
  missing_sensing_skill: "缺少 sensing skill",
  device_skill_disabled: "device skill disabled",
  acceptance_skill_failed: "acceptance skill failed",
};

function groupedItems(items: FlightTableSkillAssemblyItemV1[], classification: FlightTableSkillAssemblyItemV1["classification"]): FlightTableSkillAssemblyItemV1[] {
  return items.filter((item) => item.classification === classification);
}

export default function SkillAssemblyCard(props: Props): React.ReactElement {
  const items = props.skillResult?.items ?? [];
  return (
    <section className="flight-card flight-skill-card">
      <div className="flight-card-head">
        <h3>技能装配</h3>
        <span>{props.skillBindingIds.length} bindings / {props.skillRunIds.length} runs</span>
      </div>
      <p className="flight-muted">技能绑定必须进入正式 /api/v1/skills/bindings 投影；failure lane 只进入 operator skill trace/performance，不暴露给 customer 页面。</p>
      <div className="flight-skill-controls">
        <label>
          <span>Skill failure lane 故障类型</span>
          <select value={props.failureType} onChange={(event) => props.onFailureTypeChange(event.target.value as FlightTableSkillFailureTypeV1)}>
            {(Object.keys(FAILURE_LABELS) as FlightTableSkillFailureTypeV1[]).map((key) => <option key={key} value={key}>{FAILURE_LABELS[key]}</option>)}
          </select>
        </label>
        <div className="flight-actions">
          <button type="button" onClick={props.onBindSkills} disabled={props.loading}>绑定技能</button>
          <button type="button" onClick={props.onFailOne} disabled={props.loading}>禁用一个技能</button>
          <button type="button" onClick={props.onRestore} disabled={props.loading}>恢复技能</button>
        </div>
      </div>
      {props.error ? <p className="flight-error-text">{props.error}</p> : null}
      {props.skillResult ? (
        <dl className="flight-field-state">
          <dt>operation_id</dt><dd>{props.skillResult.operation_id}</dd>
          <dt>bindings visible</dt><dd>{String(props.skillResult.verify.bindings_visible)}</dd>
          <dt>trace visible</dt><dd>{String(props.skillResult.verify.trace_visible)}</dd>
          <dt>performance visible</dt><dd>{String(props.skillResult.verify.performance_visible)}</dd>
          <dt>failure</dt><dd>{props.skillResult.failure ? `${props.skillResult.failure.failure_type} / ${props.skillResult.failure.failure_reason}` : "-"}</dd>
        </dl>
      ) : null}
      <div className="flight-skill-groups">
        {GROUPS.map((group) => {
          const groupItems = groupedItems(items, group.key);
          return (
            <article key={group.key} className="flight-skill-group">
              <h4>{group.label}</h4>
              {groupItems.length ? groupItems.map((item) => (
                <div key={`${item.skill_id}:${item.binding_id}`} className="flight-skill-item">
                  <strong>{item.skill_id}</strong>
                  <span>{item.classification} · {item.binding_scope}</span>
                  <span>status: {item.status}</span>
                  <span>reason: {item.missing_reason ?? "-"}</span>
                </div>
              )) : <p className="flight-muted">尚未绑定</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
