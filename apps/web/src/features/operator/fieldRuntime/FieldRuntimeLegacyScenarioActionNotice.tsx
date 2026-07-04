// apps/web/src/features/operator/fieldRuntime/FieldRuntimeLegacyScenarioActionNotice.tsx
// Purpose: mark the legacy Operator Twin scenario route as a governed action surface before its existing submission panel.
// Boundary: this notice does not alter legacy behavior and does not perform any mutation.

import React from "react";

type FieldRuntimeLegacyScenarioActionNoticeProps = {
  canonicalPath: string;
};

export default function FieldRuntimeLegacyScenarioActionNotice({ canonicalPath }: FieldRuntimeLegacyScenarioActionNoticeProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__legacyActionNotice" data-h60g="legacy-scenario-action-notice">
      <p className="operatorFieldRuntime__eyebrow">Legacy / governed action surface</p>
      <h3>Legacy scenario route</h3>
      <p>This page may submit a scenario option into a recommendation candidate.</p>
      <p>This is not canonical Field Runtime.</p>
      <p>This does not approve, dispatch, create AO-ACT, or create an operation plan.</p>
      <p>Canonical Field Runtime Scenario remains read-only at {canonicalPath}.</p>
    </article>
  );
}
