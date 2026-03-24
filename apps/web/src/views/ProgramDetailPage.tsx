import React from "react";
import { useParams } from "react-router-dom";
import { ProgramActionsPanel } from "../components/program/ProgramActionsPanel";
import { ProgramEvidencePanel } from "../components/program/ProgramEvidencePanel";
import { ProgramHero } from "../components/program/ProgramHero";
import { ProgramMetricsPanel } from "../components/program/ProgramMetricsPanel";
import { ProgramTimeline } from "../components/program/ProgramTimeline";
import { useProgramDetail } from "../hooks/useProgramDetail";

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const { loading, error, viewModel } = useProgramDetail(programId);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败：{error}</div>;
  if (!viewModel) return <div>未找到 Program</div>;

  return (
    <div className="program-detail" style={{ display: "grid", gap: 12 }}>
      <ProgramHero vm={viewModel} />
      <ProgramActionsPanel
        actions={viewModel.actions}
        noActionExpectation={viewModel.noActionExpectation}
      />
      <ProgramTimeline timeline={viewModel.timeline} />
      <ProgramMetricsPanel metrics={viewModel.metrics} />
      <ProgramEvidencePanel programId={programId} />
    </div>
  );
}
