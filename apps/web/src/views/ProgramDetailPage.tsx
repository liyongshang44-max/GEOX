
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
            <div className="sectionTitle">当前作物策略</div>
            <div className="detailSectionLead">把“为什么建议这样做”前置展示，帮助用户快速理解策略上下文。</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前作物</div>
              <div className="decisionItemMeta">{viewModel.strategyOverview.cropLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前阶段</div>
              <div className="decisionItemMeta">{viewModel.strategyOverview.cropStageLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前主规则</div>
              <div className="decisionItemMeta">{viewModel.strategyOverview.primaryRuleLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近一次 recommendation</div>
              <div className="decisionItemMeta">{viewModel.strategyOverview.latestRecommendationLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近一次效果 verdict</div>
              <div className="decisionItemMeta">{viewModel.strategyOverview.latestEffectVerdictLabel}</div>
            </div>
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">作物阶段卡</div>
            <div className="detailSectionLead">帮助用户快速理解当前作物所处阶段、阶段说明与目标。</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前作物</div>
              <div className="decisionItemMeta">{viewModel.programAgronomy.cropLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前阶段</div>
              <div className="decisionItemMeta">{viewModel.programAgronomy.cropStageLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">阶段说明</div>
              <div className="decisionItemMeta">{viewModel.programAgronomy.stageSummary}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">阶段目标</div>
              <div className="decisionItemMeta">{viewModel.programAgronomy.stageGoal}</div>
            </div>
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">关键指标卡</div>
            <div className="detailSectionLead">展示当前监测指标及最近更新时间。</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">土壤湿度</div>
              <div className="decisionItemMeta">{viewModel.currentMetrics.soilMoistureLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">温度</div>
              <div className="decisionItemMeta">{viewModel.currentMetrics.temperatureLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">空气湿度</div>
              <div className="decisionItemMeta">{viewModel.currentMetrics.humidityLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近更新时间</div>
              <div className="decisionItemMeta">{viewModel.currentMetrics.updatedAtLabel}</div>
            </div>
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">当前激活规则</div>
            <div className="detailSectionLead">阶段5核心表达：当前系统已触发的农学规则与风险提示。</div>
          </div>
          {!viewModel.activeRules.length ? (
            <div className="decisionItemStatic">当前暂无触发中的农学规则</div>
          ) : (
            <div className="decisionList">
              {viewModel.activeRules.map((rule) => (
                <div key={`${rule.ruleId}_${rule.reasonCodesLabel}`} className="decisionItemStatic">
                  <div className="decisionItemTitle">规则名称</div>
                  <div className="decisionItemMeta">{rule.ruleId}</div>
                  <div className="decisionItemTitle" style={{ marginTop: 10 }}>规则健康度</div>
                  <div className="decisionItemMeta">{rule.performanceLabel}（{rule.effectivenessLabel}）</div>
                  <div className="decisionItemTitle" style={{ marginTop: 10 }}>优先级</div>
                  <div className="decisionItemMeta">{rule.priorityLabel}</div>
                  <div className="decisionItemTitle" style={{ marginTop: 10 }}>触发原因</div>
                  <div className="decisionItemMeta">{rule.reasonCodesLabel}</div>
                  <div className="decisionItemTitle" style={{ marginTop: 10 }}>建议动作</div>
                  <div className="decisionItemMeta">{rule.actionLabel}</div>
                  <div className="decisionItemTitle" style={{ marginTop: 10 }}>不执行风险</div>
                  <div className="decisionItemMeta">{rule.riskIfNotExecute}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">最近农学建议</div>
            <div className="detailSectionLead">仅展示最近 3–5 条 recommendation，用于快速判断当前决策方向。</div>
          </div>
          {!viewModel.recentRecommendations.length ? (
            <div className="decisionItemStatic">暂无最近农学建议</div>
          ) : (
            <div className="decisionList">
              {viewModel.recentRecommendations.map((item, idx) => (
                <div key={`${item.timeLabel}_${item.summary}_${idx}`} className="decisionItemStatic">
                  <div className="decisionItemMeta">
                    {item.timeLabel}｜{item.stageLabel}｜{item.actionLabel}｜{item.summary}｜{item.statusLabel}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">作物阶段概览</div>
            <div className="detailSectionLead">用于快速查看当前作物、阶段、关键指标与规则激活情况。</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">作物</div>
              <div className="decisionItemMeta">{viewModel.cropInsight.cropLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前阶段</div>
              <div className="decisionItemMeta">{viewModel.cropInsight.cropStage}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">当前激活规则数量</div>
              <div className="decisionItemMeta">{viewModel.cropInsight.activeRuleCount}</div>
            </div>
            {viewModel.cropInsight.keyMetrics.map((metric) => (
              <div key={metric.label} className="decisionItemStatic">
                <div className="decisionItemTitle">{metric.label}</div>
                <div className="decisionItemMeta">{metric.value}</div>
              </div>
            ))}
          </div>
        </section>

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
