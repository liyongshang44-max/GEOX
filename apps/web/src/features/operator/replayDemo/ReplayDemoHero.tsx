// apps/web/src/features/operator/replayDemo/ReplayDemoHero.tsx
// Purpose: render the first-screen replay-backed demo identity.
// Boundary: this hero states replay identity and nonclaims; it does not assert production operation.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoHeroProps = {
  vm: ReplayDemoViewModel;
};

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoHero({ vm }: ReplayDemoHeroProps): React.ReactElement {
  const { locale } = useLocale();

  return (
    <section className="operatorReplayDemo__hero" aria-label={localizedText(replayCopy.title, locale)}>
      <p className="operatorReplayDemo__eyebrow">{localizedText(replayCopy.eyebrow, locale)}</p>
      <h1 className="operatorReplayDemo__title">{localizedText(replayCopy.title, locale)}</h1>
      <p className="operatorReplayDemo__lead">{localizedText(replayCopy.heroLead, locale)}</p>
      <p className="operatorReplayDemo__lead">{localizedText(replayCopy.nonclaimLead, locale)}</p>
      <dl className="operatorReplayDemo__meta" aria-label={locale === "en-US" ? "Replay demo identity" : "回放演示身份"}>
        <div><dt>Mode</dt><dd>{vm.mode}</dd></div>
        <div><dt>Source</dt><dd>checked-in gateway viewer snapshot</dd></div>
        <div><dt>Route</dt><dd>{vm.route}</dd></div>
        <div><dt>Read-only</dt><dd>{vm.boundary.readOnly ? "true" : "false"}</dd></div>
      </dl>
    </section>
  );
}
