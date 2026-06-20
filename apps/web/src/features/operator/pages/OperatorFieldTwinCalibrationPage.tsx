// apps/web/src/features/operator/pages/OperatorFieldTwinCalibrationPage.tsx
// Purpose: render the H26 read-only calibration replay page for Operator Twin.
// Boundary: replay visibility only; read-only replay visibility; no state-changing actions.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinCalibrationReplay,
  type OperatorFieldTwinCalibrationReplayV1,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";
import ReplayTimelinePanel from "../components/ReplayTimelinePanel";
import CalibrationInputsPanel from "../components/CalibrationInputsPanel";
import CalibrationSummaryPanel from "../components/CalibrationSummaryPanel";
import ReplayGapList from "../components/ReplayGapList";

type RuntimeState = "loading" | "ready" | "error";

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return { tenant_id: searchParams.get("tenant_id"), project_id: searchParams.get("project_id"), group_id: searchParams.get("group_id") };
}

function BoundaryRulesPanel({ replay }: { replay: OperatorFieldTwinCalibrationReplayV1 }): React.ReactElement {
  return (
    <article className="operatorPanel operatorBoundaryNotice" data-card="BoundaryRules">
      <h3>Boundary Rules</h3>
      <ul className="operatorList">
        {replay.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.rule_code}：{rule.label}</li>)}
      </ul>
    </article>
  );
}

export default function OperatorFieldTwinCalibrationPage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [replay, setReplay] = React.useState<OperatorFieldTwinCalibrationReplayV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setReplay(null);
    setErrorText("");
    void fetchOperatorFieldTwinCalibrationReplay(fieldId, scope)
      .then((response) => { if (!alive) return; setReplay(response.operator_field_twin_calibration_replay_v1); setState("ready"); })
      .catch((error: unknown) => { if (!alive) return; setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_CALIBRATION_REPLAY_LOAD_FAILED"); setState("error"); });
    return () => { alive = false; };
  }, [fieldId, scope]);

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-field-twin-calibration-replay" data-contract="operator_field_twin_calibration_replay_v1">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Operator Calibration Replay</p>
          <h2>校准与回放</h2>
          <p>本页只读，用于回放判断链与执行链，不写入 Field Memory，不执行校准，不创建任务。</p>
          <span className="operatorPill">read-only calibration replay</span>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>Workspace</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/forecast" + scopeQueryString}>Forecast</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/scenarios" + scopeQueryString}>Scenarios</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>Evidence</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/calibration" + scopeQueryString}>Calibration</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Calibration Replay 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Calibration Replay 数据加载失败：{errorText}</div> : null}
      {replay ? (
        <div className="operatorPanelGrid">
          <ReplayTimelinePanel items={replay.replay_timeline_v1.items} />
          <CalibrationInputsPanel inputs={replay.calibration_inputs_v1} />
          <CalibrationSummaryPanel summary={replay.calibration_summary} />
          <ReplayGapList gaps={replay.replay_gaps} />
          <BoundaryRulesPanel replay={replay} />
        </div>
      ) : null}
    </section>
  );
}
