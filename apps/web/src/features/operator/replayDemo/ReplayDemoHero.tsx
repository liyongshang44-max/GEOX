// apps/web/src/features/operator/replayDemo/ReplayDemoHero.tsx
// Purpose: render the first-screen replay-backed demo identity.
// Boundary: this hero states replay identity and nonclaims; it does not assert production operation.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { REPLAY_DEMO_COPY, replayBoolean, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoHeroProps = {
  vm: ReplayDemoViewModel;
};

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoHero({ vm }: ReplayDemoHeroProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: { zh: string; en: string }) => replayText(locale, copy);

  return (
    <section className="operatorReplayDemo__hero" aria-label={localizedText(replayCopy.title, locale)}>
      <p className="operatorReplayDemo__eyebrow">{localizedText(replayCopy.eyebrow, locale)}</p>
      <h1 className="operatorReplayDemo__title">{localizedText(replayCopy.title, locale)}</h1>
      <p className="operatorReplayDemo__lead">{localizedText(replayCopy.heroLead, locale)}</p>
      <p className="operatorReplayDemo__lead">{localizedText(replayCopy.nonclaimLead, locale)}</p>
      <dl className="operatorReplayDemo__meta" aria-label={t(REPLAY_DEMO_COPY.hero.identity)}>
        <div><dt>{t(REPLAY_DEMO_COPY.hero.mode)}</dt><dd>{t(REPLAY_DEMO_COPY.hero.replayMode)}</dd></div>
        <div><dt>{t(REPLAY_DEMO_COPY.hero.source)}</dt><dd>{t(REPLAY_DEMO_COPY.hero.snapshotSource)}</dd></div>
        <div><dt>{t(REPLAY_DEMO_COPY.hero.route)}</dt><dd data-locale-neutral="true">{vm.route}</dd></div>
        <div><dt>{t(REPLAY_DEMO_COPY.hero.readOnly)}</dt><dd>{replayBoolean(locale, vm.boundary.readOnly)}</dd></div>
      </dl>
    </section>
  );
}
