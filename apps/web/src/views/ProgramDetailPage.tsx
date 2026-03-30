
import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { useProgramDetail } from "../hooks/useProgramDetail";
import { useLocale } from "../lib/locale";

function tone(status: "ok" | "risk" | "error" | "running"): string {
  if (status === "ok") return "traceChipLive";
  if (status === "risk") return "tone-warn";
  if (status === "error") return "tone-bad";
  return "tone-neutral";
}

export default function ProgramDetailPage(): React.ReactElement {
  const { text } = useLocale();
  const { programId = "" } = useParams();
  const { loading, error, viewModel, reload } = useProgramDetail(programId);

  if (loading && !viewModel) return <SectionSkeleton kind="detail" />;
  if (error || !viewModel) {
    return (
      <ErrorState
        title={text("经营方案详情暂不可用", "Program detail unavailable")}
        message={error || text("当前暂无经营方案详情数据", "No program detail is available right now")}
        onRetry={() => void reload()}
      />
    );
  }

  const fieldHref = viewModel.fieldId ? `/fields/${encodeURIComponent(viewModel.fieldId)}` : "/fields";
  const operationHref = viewModel.currentOperationPlanId
    ? `/operations/${encodeURIComponent(viewModel.currentOperationPlanId)}`
    : "/operations";

  return (
    <div className="demoDashboardPage">
      <section className="card detailHeroCard detailHeroCardV3">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 经营方案详情</div>
            <h1 className="demoHeroTitle" style={{ marginTop: 6 }}>{viewModel.title}</h1>
            <p className="demoHeroSubTitle">
              先看这块田想种成什么样，再看现在推进到哪，最后判断最近一次执行结果是否符合预期。
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`traceChip ${tone(viewModel.status)}`}>{viewModel.statusLabel}</span>
            <Link className="btn" to="/programs">{text("返回方案列表", "Back to programs")}</Link>
            <button className="btn" onClick={() => void reload()}>{text("刷新", "Refresh")}</button>
          </div>
        </div>

        <div className="operationsSummaryGrid detailSummaryGridV3">
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">当前阶段</span><strong>{viewModel.stageLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近动作</span><strong>{viewModel.latestActionLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近结果</span><strong>{viewModel.latestEvidenceResultLabel || "等待结果"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">证据时间</span><strong>{viewModel.latestEvidenceAtLabel || "-"}</strong></div>
        </div>

        <div className="operationsSummaryActions">
          <Link className="btn" to={fieldHref}>主入口：查看当前田块</Link>
          <Link className="btn" to={operationHref}>次入口：查看当前作业</Link>
          <Link className="btn" to="/agronomy">次入口：查看农业建议</Link>
        </div>
      </section>

      <div className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">经营目标</div>
            <div className="detailSectionLead">后面的建议、审批和执行，都围绕这些目标展开。</div>
          </div>
          <div className="decisionList">
            {viewModel.goalSummary.map((item) => (
              <div key={item.label} className="decisionItemStatic">
                <div className="decisionItemTitle">{item.label}</div>
                <div className="decisionItemMeta">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">当前推进状态</div>
            <div className="detailSectionLead">这块主要用来判断现在更接近“待决策”还是“待执行”。</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近建议</div>
              <div className="decisionItemMeta">{viewModel.currentExecution.latestRecommendation || "暂无建议"}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近审批</div>
              <div className="decisionItemMeta">{viewModel.currentExecution.latestApproval || "暂无审批"}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前作业</div>
              <div className="decisionItemMeta">{viewModel.currentExecution.currentTask || "暂无作业"} · {viewModel.currentExecution.currentTaskStatus || "待生成"}</div>
            </div>
          </div>
        </section>
      </div>

      <div className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">经营结果摘要</div>
            <div className="detailSectionLead">用于判断方案是否值得继续推进，还是需要重新调整经营策略。</div>
          </div>
          <div className="decisionList">
            {viewModel.resultSummary.map((item) => (
              <div key={item.label} className="decisionItemStatic">
                <div className="decisionItemTitle">{item.label}</div>
                <div className="decisionItemMeta">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">最近一次执行证据</div>
            <div className="detailSectionLead">证据是继续推进方案与否的最后判断依据。</div>
          </div>
          {viewModel.latestEvidence ? <ReceiptEvidenceCard data={viewModel.latestEvidence} /> : <div className="decisionItemStatic">当前还没有最近一次执行证据。</div>}
        </section>
      </div>

      <section className="card detailHeroCard">
        <div className="demoSectionHeader">
          <div className="sectionTitle">方案推进时间轴</div>
          <div className="detailSectionLead">从建议、审批到执行与证据，按时间顺序复盘当前经营方案是如何推进的。</div>
        </div>
        <div className="fieldTimeline">
          {viewModel.timeline.map((item, idx) => (
            <div key={`${item.type}_${item.ts}_${idx}`} className="fieldTimelineItem">
              <div className="fieldTimelineTime">{new Date(item.ts).toLocaleString()}</div>
              <div className="fieldTimelineDot">•</div>
              <div className="fieldTimelineContent">{item.label}</div>
            </div>
          ))}
          {!viewModel.timeline.length ? <div className="decisionItemStatic">暂无时间线事件</div> : null}
        </div>
      </section>
    </div>
  );
}
