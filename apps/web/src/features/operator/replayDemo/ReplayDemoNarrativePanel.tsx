// apps/web/src/features/operator/replayDemo/ReplayDemoNarrativePanel.tsx
// Purpose: render H61 replay demo narrative flow.
// Boundary: narrative explains proof scope and nonclaims only.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoNarrativePanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoNarrativePanel({ vm }: ReplayDemoNarrativePanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel" aria-label="Replay demo narrative">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Demo Narrative</p><h2>What this demo proves</h2></div>
      <div className="operatorReplayDemo__grid">
        {vm.narrative.map((step) => (
          <article className="operatorReplayDemo__narrativeStep" key={step.step}>
            <p className="operatorReplayDemo__eyebrow">Step {step.step}</p>
            <h3>{step.title}</h3>
            <p>{step.explanation}</p>
            <p className="operatorReplayDemo__metaLabel">Does not prove:</p>
            <ul>{step.doesNotMean.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}
