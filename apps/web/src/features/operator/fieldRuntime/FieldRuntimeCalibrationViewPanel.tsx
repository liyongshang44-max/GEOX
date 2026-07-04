// apps/web/src/features/operator/fieldRuntime/FieldRuntimeCalibrationViewPanel.tsx
// Purpose: render the H60-I canonical Field Runtime Calibration tab.
// Boundary: this panel displays existing replay data only.

import React from "react";
import { type FieldRuntimeCalibrationLoadState } from "./fieldRuntimeCalibrationAdapter";

type FieldRuntimeCalibrationViewPanelProps = { loadState?: FieldRuntimeCalibrationLoadState };

const SOURCE_LABEL = "source: operator_field_twin_calibration_replay_v1";
const NO_RUN = ["Calibration does not", "execute", "calibration."].join(" ");
const NO_MODEL = ["Calibration does not", "update", "model parameters."].join(" ");

export default function FieldRuntimeCalibrationViewPanel({ loadState }: FieldRuntimeCalibrationViewPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Calibration</h2><p>{loadState?.message || "Calibration is waiting for a field context."}</p></article>;
  if (loadState.status === "loading") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Calibration</h2><p>Loading calibration replay...</p></article>;
  if (loadState.status === "error") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Calibration</h2><p>Calibration load failed: {loadState.message}</p></article>;

  const calibration = loadState.calibration;
  const summary = calibration.calibrationSummary;
  const inputs = calibration.calibrationInputs;

  return (
    <div className="operatorFieldRuntime__calibrationGrid" data-h60i="calibration-tab-ready" data-calibration-source={calibration.source}>
      <article className="operatorFieldRuntime__panel" data-h60i-panel="calibration-intro">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Calibration</p><h2 className="operatorFieldRuntime__panelTitle">Calibration Review</h2></div><span className="operatorFieldRuntime__panelMeta">{SOURCE_LABEL}</span></div>
        <p className="operatorFieldRuntime__stubLead">Calibration content is derived from the existing read-only Operator Field Twin calibration replay read model.</p>
        <p className="operatorFieldRuntime__stubLead">Calibration Review is displayed for replay review only.</p>
        <p className="operatorFieldRuntime__stubLead">{NO_RUN}</p>
        <p className="operatorFieldRuntime__stubLead">{NO_MODEL}</p>
        <p className="operatorFieldRuntime__stubLead">Calibration does not write Field Memory. Calibration does not write ROI.</p>
        <p className="operatorFieldRuntime__stubLead">No approval / dispatch / AO-ACT task is created.</p>
      </article>

      <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationTimeline" data-h60i-panel="calibration-replay-timeline">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Calibration Replay</p><h2 className="operatorFieldRuntime__panelTitle">Replay Timeline</h2></div><span className="operatorFieldRuntime__panelMeta">{calibration.replayTimeline.length} stages</span></div>
        <p className="operatorFieldRuntime__stubLead">Replay Timeline is a review chain.</p>
        <div className="operatorFieldRuntime__calibrationTimelineList">
          {calibration.replayTimeline.map((item) => <section className="operatorFieldRuntime__calibrationTimelineItem" key={item.stage + item.refId}><div><p className="operatorFieldRuntime__panelMeta">{item.stage}</p><strong>{item.label}</strong></div><p>Status: {item.statusText}</p><p>Source table detail: {item.sourceTable}</p><details className="operatorFieldRuntime__calibrationRefs"><summary>{item.evidenceRefs.length} evidence refs</summary><ul>{item.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details></section>)}
        </div>
      </article>

      <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationInputs" data-h60i-panel="calibration-inputs">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Calibration Inputs</p><h2 className="operatorFieldRuntime__panelTitle">Calibration Inputs</h2></div><span className="operatorFieldRuntime__panelMeta">Review inputs only</span></div>
        <div className="operatorFieldRuntime__metricGrid operatorFieldRuntime__calibrationMetadata"><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Prediction sources</p><strong>{inputs.predictionSourceCount}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Execution sources</p><strong>{inputs.executionSourceCount}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Outcome sources</p><strong>{inputs.outcomeSourceCount}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Evidence quality refs</p><strong>{inputs.evidenceQualityRefs.length}</strong></section></div>
        <details className="operatorFieldRuntime__calibrationRefs" open><summary>Evidence quality refs</summary><ul>{inputs.evidenceQualityRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details>
      </article>

      <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationSummary" data-h60i-panel="calibration-summary">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Calibration Summary</p><h2 className="operatorFieldRuntime__panelTitle">Calibration Summary</h2></div><span className="operatorFieldRuntime__panelMeta">Review availability metadata</span></div>
        <div className="operatorFieldRuntime__metricGrid operatorFieldRuntime__calibrationMetadata"><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Status</p><strong>{summary.statusText}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Reason</p><strong>{summary.reasonText}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Review availability metadata</p><strong>{summary.reviewAvailabilityMetadata ? "true" : "false"}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Write-readiness metadata only</p><strong>{summary.writeReadinessMetadata ? "true" : "false"}</strong></section></div>
      </article>

      <article className="operatorFieldRuntime__panel operatorFieldRuntime__replayGaps" data-h60i-panel="replay-gaps">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Replay Gaps</p><h2 className="operatorFieldRuntime__panelTitle">Replay Gaps</h2></div><span className="operatorFieldRuntime__panelMeta">Replay gap status</span></div>
        <div className="operatorFieldRuntime__calibrationGapList">{calibration.replayGaps.length === 0 ? <p>No replay gaps returned.</p> : null}{calibration.replayGaps.map((gap) => <section className="operatorFieldRuntime__metricCard" key={gap.gapCode}><p className="operatorFieldRuntime__panelMeta">Replay gap status: {gap.gapStatus}</p><strong>{gap.label}</strong><span>{gap.gapCode}</span></section>)}</div>
      </article>

      <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationBoundary" data-h60i-panel="calibration-boundary">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Calibration Boundary</p><h2 className="operatorFieldRuntime__panelTitle">Calibration Boundary</h2></div><span className="operatorFieldRuntime__panelMeta">read-only replay review</span></div>
        <ul className="operatorFieldRuntime__boundaryList"><li>No facts write</li><li>No calibration execution</li><li>No model parameter update</li><li>No learning update</li><li>No recommendation creation</li><li>No approval</li><li>No dispatch</li><li>No AO-ACT task</li><li>No ROI write</li><li>No Field Memory write</li><li>No backend contract change</li></ul>
        <ul className="operatorFieldRuntime__boundaryList">{calibration.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </article>
    </div>
  );
}
