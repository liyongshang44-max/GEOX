import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { useProgramDetail } from "../hooks/useProgramDetail";
import { useLocale } from "../lib/locale";

function toneClass(status: "ok" | "risk" | "error" | "running"): string {
  if (status === "ok") return "bg-green-50 text-green-700";
  if (status === "risk") return "bg-amber-50 text-amber-700";
  if (status === "error") return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-700";
}

export default function ProgramDetailPage(): React.ReactElement {
  const { text } = useLocale();
  const { programId = "" } = useParams();
  const { loading, error, viewModel, reload } = useProgramDetail(programId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !viewModel) {
    return (
      <ErrorState
        title={text("经营方案详情暂不可用", "Program detail unavailable")}
        message={error || text("当前暂无经营方案详情数据", "No program detail is available right now")}
        onRetry={() => void reload()}
      />
    );
  }

  return (
    <div className="productPage geoxProgramDetail">
      <section className="card sectionBlock geoxHeroPanel">
        <div className="sectionHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 8 }}>{text("经营方案详情", "Program Detail")}</h2>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{viewModel.title}</div>
            <div className="meta wrapMeta" style={{ marginTop: 10 }}>
              <span>{text("目标", "Goal")}：{viewModel.goalSummary.slice(1, 4).map((item) => item.value).join(" / ")}</span>
              <span>{text("当前阶段", "Stage")}：{viewModel.stageLabel}</span>
              <span>{text("最近动作", "Latest Action")}：{viewModel.latestActionLabel}</span>
            </div>
          </div>
          <span className={`text-sm px-3 py-1 rounded ${toneClass(viewModel.status)}`}>{viewModel.statusLabel}</span>
        </div>
        <div className="geoxActionRow">
          <Link className="btn" to="/programs">{text("返回", "Back")}</Link>
          <button className="btn" onClick={() => void reload()}>{text("刷新", "Refresh")}</button>
        </div>
      </section>

      <section className="geoxProgramGrid">
        <section className="card sectionBlock geoxSectionCard">
          <div className="sectionTitle">{text("经营目标", "Business Goals")}</div>
          {viewModel.goalSummary.map((item) => (
            <div className="kv" key={item.label}>
              <span className="k">{item.label}</span>
              <span className="v">{item.value}</span>
            </div>
          ))}
        </section>

        <section className="card sectionBlock geoxSectionCard">
          <div className="sectionTitle">{text("当前执行", "Current Execution")}</div>
          <div className="kv"><span className="k">{text("最近建议", "Latest Recommendation")}</span><span className="v">{viewModel.currentExecution.latestRecommendation || text("暂无建议", "No recommendation")}</span></div>
          <div className="kv"><span className="k">{text("最近审批", "Latest Approval")}</span><span className="v">{viewModel.currentExecution.latestApproval || text("暂无审批", "No approval")}</span></div>
          <div className="kv"><span className="k">{text("当前作业", "Current Operation")}</span><span className="v">{viewModel.currentExecution.currentTask || text("暂无作业", "No operation")}</span></div>
          <div className="kv"><span className="k">{text("执行状态", "Execution State")}</span><span className="v">{viewModel.currentExecution.currentTaskStatus || viewModel.statusLabel}</span></div>
        </section>
      </section>

      <section className="card sectionBlock geoxSectionCard">
        <div className="sectionTitle">{text("近期结果", "Recent Outcomes")}</div>
        {viewModel.resultSummary.map((item) => (
          <div className="kv" key={item.label}>
            <span className="k">{item.label}</span>
            <span className="v">{item.value}</span>
          </div>
        ))}
      </section>

      <section className="card sectionBlock geoxSectionCard">
        <div className="sectionTitle">{text("最近执行证据", "Latest Evidence")}</div>
        {viewModel.latestEvidence?.href ? (
          <Link to={viewModel.latestEvidence.href} style={{ textDecoration: "none", color: "inherit" }}>
            <ReceiptEvidenceCard data={viewModel.latestEvidence} />
          </Link>
        ) : (
          <ReceiptEvidenceCard data={viewModel.latestEvidence} />
        )}
        {viewModel.latestEvidence ? (
          <div style={{ marginTop: 12 }}>
            <div className="kv"><span className="k">{text("时间", "Time")}</span><span className="v">{viewModel.latestEvidenceAtLabel}</span></div>
            <div className="kv"><span className="k">{text("设备", "Device")}</span><span className="v">{viewModel.latestEvidenceDeviceLabel}</span></div>
            <div className="kv"><span className="k">{text("结果", "Result")}</span><span className="v">{viewModel.latestEvidenceResultLabel || text("符合约束", "Constraint satisfied")}</span></div>
          </div>
        ) : null}
        <button className="btn" style={{ marginTop: 10 }} type="button">{text("下载证据包", "Download Bundle")}</button>
      </section>

      <section className="card sectionBlock geoxSectionCard">
        <div className="sectionTitle">{text("时间线", "Timeline")}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {viewModel.timeline.map((item) => (
            <div key={`${item.type}_${item.ts}`} className="kv">
              <span className="k">[{new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]</span>
              <span className="v">{item.label}</span>
            </div>
          ))}
          {!viewModel.timeline.length ? <div className="muted">{text("暂无时间线事件", "No timeline events yet")}</div> : null}
        </div>
      </section>
    </div>
  );
}
