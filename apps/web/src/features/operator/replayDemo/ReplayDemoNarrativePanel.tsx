// apps/web/src/features/operator/replayDemo/ReplayDemoNarrativePanel.tsx
// Purpose: render H61 replay demo narrative flow.
// Boundary: narrative explains proof scope and nonclaims only.

import React from "react";
import { useLocale } from "../../../lib/locale";
import { REPLAY_DEMO_COPY, replayNarrativeStep, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoNarrativePanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoNarrativePanel({ vm }: ReplayDemoNarrativePanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: { zh: string; en: string }) => replayText(locale, copy);

  return (
    <section className="operatorReplayDemo__panel" aria-label={t(REPLAY_DEMO_COPY.narrative.aria)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{t(REPLAY_DEMO_COPY.narrative.eyebrow)}</p><h2>{t(REPLAY_DEMO_COPY.narrative.title)}</h2></div>
      <div className="operatorReplayDemo__grid">
        {vm.narrative.map((step) => {
          const copy = replayNarrativeStep(locale, step.step);
          return (
            <article className="operatorReplayDemo__narrativeStep" key={step.step}>
              <p className="operatorReplayDemo__eyebrow">{t(REPLAY_DEMO_COPY.narrative.step)} {step.step}</p>
              <h3>{t(copy.title)}</h3>
              <p>{t(copy.explanation)}</p>
              <p className="operatorReplayDemo__metaLabel">{t(REPLAY_DEMO_COPY.narrative.doesNotProve)}</p>
              <ul>{copy.doesNotMean.map((item) => <li key={item.en}>{t(item)}</li>)}</ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
