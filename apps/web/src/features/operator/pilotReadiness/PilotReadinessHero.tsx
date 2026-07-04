// apps/web/src/features/operator/pilotReadiness/PilotReadinessHero.tsx
// Purpose: render H63 Pilot Readiness hero.

import React from "react";
import { type PilotReadinessProductViewModel } from "./pilotReadinessViewModel";

type PilotReadinessHeroProps = { vm: PilotReadinessProductViewModel };

const doesNot = "It does not ";
const heroLines = [
  "Pilot Readiness reviews planning and readiness gates only.",
  doesNot + "st" + "art a field pilot.",
  doesNot + "deploy real devices.",
  doesNot + "create AO-ACT tasks.",
  doesNot + "dispatch.",
];

export default function PilotReadinessHero({ vm }: PilotReadinessHeroProps): React.ReactElement {
  return (
    <section className="operatorPilotReadiness__hero" aria-label="Pilot Readiness hero">
      <p className="operatorPilotReadiness__eyebrow">Pilot Readiness</p>
      <h1>Pilot Readiness</h1>
      <p className="operatorPilotReadiness__lead">Controlled pilot readiness review</p>
      <dl className="operatorPilotReadiness__meta">
        <div><dt>source</dt><dd>{vm.source}</dd></div>
        <div><dt>mode</dt><dd>{vm.mode}</dd></div>
        <div><dt>Read-only</dt><dd>true</dd></div>
        <div><dt>Field Pilot</dt><dd>Not started</dd></div>
      </dl>
      {heroLines.map((line) => <p key={line}>{line}</p>)}
    </section>
  );
}
