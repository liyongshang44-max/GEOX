// apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotPanel.tsx
// Purpose: render snapshot provenance summary.
// Boundary: hashes are provenance metadata, not production certification.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoSnapshotPanelProps = {
  vm: ReplayDemoViewModel;
};

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoSnapshotPanel({ vm }: ReplayDemoSnapshotPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const snapshot = vm.snapshot;
  const rows = [
    ["source_snapshot_ref", snapshot.sourceSnapshotRef],
    ["source_snapshot_checked_in_as", snapshot.checkedInAs],
    ["generated_by", snapshot.generatedBy],
    ["baseline_tag", snapshot.baselineTag],
    ["baseline_commit", snapshot.baselineCommit],
    ["p51_final_tag", snapshot.p51FinalTag],
    ["p51_final_commit", snapshot.p51FinalCommit],
    ["deterministic_hash", snapshot.deterministicHash],
  ];
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__snapshot" aria-label={localizedText(replayCopy.panels.snapshot, locale)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{localizedText(replayCopy.panels.snapshot, locale)}</p><h2>{localizedText(replayCopy.snapshotTitle, locale)}</h2></div>
      <p>{locale === "en-US" ? "Hashes are provenance metadata, not production certification." : "哈希是来源元数据，不是生产认证。"}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>{localizedText(replayCopy.table.label, locale)}</span><span>{localizedText(replayCopy.table.value, locale)}</span></div>
        {rows.map(([label, value]) => <div className="operatorReplayDemo__tableRow" key={label}><span>{label}</span><span>{value}</span></div>)}
      </div>
    </section>
  );
}
