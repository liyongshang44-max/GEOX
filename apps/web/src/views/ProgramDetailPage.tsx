import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { useProgramDetail } from "../hooks/useProgramDetail";

function toneClass(status: "ok" | "risk" | "error" | "running"): string {
  if (status === "ok") return "bg-green-50 text-green-700";
  if (status === "risk") return "bg-amber-50 text-amber-700";
  if (status === "error") return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-700";
}

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const { loading, error, viewModel, reload } = useProgramDetail(programId);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !viewModel) {
    return <ErrorState title="经营方案详情暂不可用" message={error || "当前暂无经营方案详情数据"} onRetry={() => void reload()} />;
  }

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 8 }}>{viewModel.title}</h2>
            <div className="meta wrapMeta">
              <span>目标：{viewModel.goalSummary.slice(1, 4).map((item) => item.value).join(" / ")}</span>
              <span>当前阶段：{viewModel.stageLabel}</span>
              <span>最近动作：{viewModel.latestActionLabel}</span>
            </div>
          </div>
          <span className={`text-sm px-3 py-1 rounded ${toneClass(viewModel.status)}`}>{viewModel.statusLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" to="/programs">返回</Link>
          <button className="btn" onClick={() => void reload()}>刷新</button>
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">经营目标</div>
        {viewModel.goalSummary.map((item) => (
          <div className="kv" key={item.label}>
            <span className="k">{item.label}</span>
            <span className="v">{item.value}</span>
          </div>
        ))}
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">当前执行</div>
        <div className="kv"><span className="k">最近建议</span><span className="v">{viewModel.currentExecution.latestRecommendation || "暂无建议"}</span></div>
        <div className="kv"><span className="k">最近审批</span><span className="v">{viewModel.currentExecution.latestApproval || "暂无审批"}</span></div>
        <div className="kv"><span className="k">当前作业</span><span className="v">{viewModel.currentExecution.currentTask || "暂无作业"}</span></div>
        <div className="kv"><span className="k">执行状态</span><span className="v">{viewModel.currentExecution.currentTaskStatus || viewModel.statusLabel}</span></div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">近期结果</div>
        {viewModel.resultSummary.map((item) => (
          <div className="kv" key={item.label}>
            <span className="k">{item.label}</span>
            <span className="v">{item.value}</span>
          </div>
        ))}
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">最近执行证据</div>
        <ReceiptEvidenceCard data={viewModel.latestEvidence} />
        {viewModel.latestEvidence ? (
          <div style={{ marginTop: 12 }}>
            <div className="kv"><span className="k">时间</span><span className="v">{viewModel.latestEvidenceAtLabel}</span></div>
            <div className="kv"><span className="k">设备</span><span className="v">{viewModel.latestEvidenceDeviceLabel}</span></div>
            <div className="kv"><span className="k">结果</span><span className="v">{viewModel.latestEvidenceResultLabel || "符合约束"}</span></div>
          </div>
        ) : null}
        <button className="btn" style={{ marginTop: 10 }} type="button">下载证据包</button>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">时间线</div>
        <div style={{ display: "grid", gap: 8 }}>
          {viewModel.timeline.map((item) => (
            <div key={`${item.type}_${item.ts}`} className="kv">
              <span className="k">[{new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]</span>
              <span className="v">{item.label}</span>
            </div>
          ))}
          {!viewModel.timeline.length ? <div className="muted">暂无时间线事件</div> : null}
        </div>
      </section>
    </div>
  );
}
