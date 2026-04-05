import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { useProgramDetail } from "../hooks/useProgramDetail";

function tone(status: "ok" | "risk" | "error" | "running"): string {
  if (status === "ok") return "traceChipLive";
  if (status === "risk") return "tone-warn";
  if (status === "error") return "tone-bad";
  return "tone-neutral";
}

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { loading, error, viewModel, reload } = useProgramDetail(programId);
  const errorText = String(error ?? "").toLowerCase();
  const permissionDenied = errorText.includes("403") || errorText.includes("forbidden") || errorText.includes("permission");

  if (loading && !viewModel) return <SectionSkeleton kind="detail" />;
  if (permissionDenied) {
    return (
      <ErrorState
        title="你没有权限查看此内容"
        message="当前账号无法访问该经营方案，请联系管理员开通权限。"
        onRetry={() => window.history.back()}
        secondaryText="返回方案列表"
        onSecondary={() => window.location.assign("/programs")}
      />
    );
  }
  if (error || !viewModel) {
    return (
      <EmptyState
        title="还没有经营方案"
        description="请先初始化 Program，再回到该页面查看经营目标、阶段偏差与最近影响。"
        actionText="初始化经营"
        onAction={() => { window.location.assign("/programs/create"); }}
        secondaryActionText="返回方案列表"
        onSecondaryAction={() => { window.location.assign("/programs"); }}
      />
    );
  }

  const fieldHref = viewModel.fieldId ? `/fields/${encodeURIComponent(viewModel.fieldId)}` : "/fields";
  const operationHref = viewModel.currentOperationPlanId
    ? `/operations/${encodeURIComponent(viewModel.currentOperationPlanId)}`
    : "/operations";

  return (
    <div className="demoDashboardPage programClosurePage">
      <section className="card detailHeroCard detailHeroCardV3">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 经营方案页</div>
            <h1 className="demoHeroTitle" style={{ marginTop: 6 }}>{viewModel.title}</h1>
            <p className="demoHeroSubTitle">围绕经营目标推进，不展示实时调试细节。</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`traceChip ${tone(viewModel.status)}`}>{viewModel.statusLabel}</span>
            <Link className="btn" to={viewModel.returnPath}>返回方案列表</Link>
            <button className="btn" onClick={() => void reload()}>刷新</button>
          </div>
        </div>
      </section>

      <section className="programFixedGrid">
        <article className="card detailHeroCard">
          <div className="sectionTitle">经营目标卡</div>
          <div className="decisionList" style={{ marginTop: 8 }}>
            <div className="decisionItemStatic"><div className="decisionItemTitle">目标</div><div className="decisionItemMeta">{viewModel.goalCard.objective}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">阶段目标</div><div className="decisionItemMeta">{viewModel.goalCard.stageGoal}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">当前窗口</div><div className="decisionItemMeta">{viewModel.goalCard.expectedWindow}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">目标偏差</div><div className="decisionItemMeta">{viewModel.goalCard.deviationHint}</div></div>
          </div>
        </article>

        <article className="card detailHeroCard">
          <div className="sectionTitle">当前进度卡</div>
          <div className="decisionList" style={{ marginTop: 8 }}>
            <div className="decisionItemStatic"><div className="decisionItemTitle">当前阶段</div><div className="decisionItemMeta">{viewModel.progressCard.stage}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">最近动作</div><div className="decisionItemMeta">{viewModel.progressCard.latestAction}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">当前任务</div><div className="decisionItemMeta">{viewModel.progressCard.currentTask}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">偏差判断</div><div className="decisionItemMeta">{viewModel.progressCard.deviation}</div></div>
          </div>
        </article>

        <article className="card detailHeroCard">
          <div className="sectionTitle">当前策略卡</div>
          <div className="decisionList" style={{ marginTop: 8 }}>
            <div className="decisionItemStatic"><div className="decisionItemTitle">作物</div><div className="decisionItemMeta">{viewModel.strategyCard.crop}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">阶段</div><div className="decisionItemMeta">{viewModel.strategyCard.stage}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">主规则</div><div className="decisionItemMeta">{viewModel.strategyCard.primaryRule}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">最近建议</div><div className="decisionItemMeta">{viewModel.strategyCard.recommendation}</div></div>
          </div>
        </article>

        <article className="card detailHeroCard">
          <div className="sectionTitle">最近影响卡</div>
          <div className="decisionList" style={{ marginTop: 8 }}>
            <div className="decisionItemStatic"><div className="decisionItemTitle">最近结果</div><div className="decisionItemMeta">{viewModel.impactCard.latestResult}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">证据时间</div><div className="decisionItemMeta">{viewModel.impactCard.evidenceAt}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">影响摘要</div><div className="decisionItemMeta">{viewModel.impactCard.impactSummary}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">下一步</div><div className="decisionItemMeta">{viewModel.impactCard.nextStep}</div></div>
          </div>
          {viewModel.latestEvidence ? <div style={{ marginTop: 8 }}><ReceiptEvidenceCard data={viewModel.latestEvidence} /></div> : null}
        </article>
      </section>

      <section className="card detailHeroCard" style={{ marginTop: 12 }}>
        {searchParams.get("created") === "1" ? (
          <div className="programReturnBanner">
            Program 已创建成功。建议按“方案页 → 田块页 → 作业页”路径持续推进经营闭环。
          </div>
        ) : null}
        <div className="sectionTitle">返回路径</div>
        <div className="operationsSummaryActions" style={{ marginTop: 8 }}>
          <Link className="btn" to={fieldHref}>查看关联田块</Link>
          <Link className="btn" to={operationHref}>查看当前作业</Link>
          <Link className="btn" to={viewModel.returnPath}>返回方案列表</Link>
          <Link className="btn" to="/dashboard">返回总览</Link>
        </div>
      </section>
    </div>
  );
}
