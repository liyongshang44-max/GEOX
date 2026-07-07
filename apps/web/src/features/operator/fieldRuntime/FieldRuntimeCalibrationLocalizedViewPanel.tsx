// apps/web/src/features/operator/fieldRuntime/FieldRuntimeCalibrationLocalizedViewPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { operatorSafeDisplay } from "../../../lib/productCopy/operatorLocale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeCalibrationLoadState } from "./fieldRuntimeCalibrationAdapter";

const COPY = {
  boundaryRule: { zh: "只读校准边界规则", en: "Read-only Calibration Boundary Rule" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeCalibrationLocalizedViewPanel({ loadState }: { loadState?: FieldRuntimeCalibrationLoadState }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const copy = (value: LocalizedCopy) => localizedText(value, locale);

  if (!loadState || loadState.status === "idle") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("calibration")}</h2><p>{loadState?.message || t("calibrationWaiting")}</p></article>;
  if (loadState.status === "loading") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("calibration")}</h2><p>{t("calibrationLoading")}</p></article>;
  if (loadState.status === "error") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("calibration")}</h2><p>{t("calibrationFailed")}: {loadState.message}</p></article>;

  const calibration = loadState.calibration;
  const summary = calibration.calibrationSummary;
  const inputs = calibration.calibrationInputs;
  const boundaryKeys: FieldRuntimeCopyKey[] = ["noFactsWrite", "noRecommendation", "noApproval", "noDispatch", "noAoAct", "noRoi", "noFieldMemory", "noBackendChange"];

  return <div className="operatorFieldRuntime__calibrationGrid" data-h60i="calibration-tab-ready" data-calibration-source={calibration.source}>
    <article className="operatorFieldRuntime__panel" data-h60i-panel="calibration-intro">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("calibration")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("calibrationReview")}</h2></div><span className="operatorFieldRuntime__panelMeta">operator_field_twin_calibration_replay_v1</span></div>
      <p className="operatorFieldRuntime__stubLead">{t("calibrationIntro")}</p><p className="operatorFieldRuntime__stubLead">{t("calibrationReplayOnly")}</p><p className="operatorFieldRuntime__stubLead">{t("noCalibrationRun")}</p><p className="operatorFieldRuntime__stubLead">{t("noModelUpdate")}</p><p className="operatorFieldRuntime__stubLead">{t("noCalibrationWrites")}</p>
    </article>

    <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationTimeline" data-h60i-panel="calibration-replay-timeline">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("calibrationReplay")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("replayTimeline")}</h2></div><span className="operatorFieldRuntime__panelMeta">{calibration.replayTimeline.length} {text("stages", "个阶段")}</span></div>
      <div className="operatorFieldRuntime__calibrationTimelineList">{calibration.replayTimeline.map((item) => <section className="operatorFieldRuntime__calibrationTimelineItem" key={item.stage + item.refId}><div><p className="operatorFieldRuntime__panelMeta">{item.stage}</p><strong>{item.label}</strong></div><p>{t("status")}: {item.statusText}</p><p>{t("sourceTable")}: {item.sourceTable}</p><details className="operatorFieldRuntime__calibrationRefs"><summary>{item.evidenceRefs.length} {t("evidenceRefs")}</summary><ul>{item.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details></section>)}</div>
    </article>

    <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationInputs" data-h60i-panel="calibration-inputs">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("calibrationInputs")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("calibrationInputs")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Review inputs only", "仅审查输入")}</span></div>
      <div className="operatorFieldRuntime__metricGrid operatorFieldRuntime__calibrationMetadata"><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{text("Prediction Sources", "预测来源")}</p><strong>{inputs.predictionSourceCount}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{text("Execution Sources", "执行来源")}</p><strong>{inputs.executionSourceCount}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{text("Outcome Sources", "结果来源")}</p><strong>{inputs.outcomeSourceCount}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("evidenceRefs")}</p><strong>{inputs.evidenceQualityRefs.length}</strong></section></div>
    </article>

    <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationSummary" data-h60i-panel="calibration-summary">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("calibrationSummary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("calibrationSummary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Review availability metadata", "审查可用性元数据")}</span></div>
      <div className="operatorFieldRuntime__metricGrid operatorFieldRuntime__calibrationMetadata"><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("status")}</p><strong>{summary.statusText}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{text("Reason", "原因")}</p><strong>{summary.reasonText}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{text("Review Availability Metadata", "审查可用性元数据")}</p><strong>{summary.reviewAvailabilityMetadata ? "true" : "false"}</strong></section><section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{text("Write-readiness Metadata Only", "仅写入准备度元数据")}</p><strong>{summary.writeReadinessMetadata ? "true" : "false"}</strong></section></div>
    </article>

    <article className="operatorFieldRuntime__panel operatorFieldRuntime__replayGaps" data-h60i-panel="replay-gaps"><div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("replayGaps")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("replayGaps")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Replay Gap Status", "回放缺口状态")}</span></div><div className="operatorFieldRuntime__calibrationGapList">{calibration.replayGaps.length === 0 ? <p>{text("No replay gaps returned.", "未返回回放缺口。")}</p> : null}{calibration.replayGaps.map((gap) => <section className="operatorFieldRuntime__metricCard" key={gap.gapCode}><p className="operatorFieldRuntime__panelMeta">{text("Replay Gap Status", "回放缺口状态")}: {gap.gapStatus}</p><strong>{gap.label}</strong><span>{gap.gapCode}</span></section>)}</div></article>

    <article className="operatorFieldRuntime__panel operatorFieldRuntime__calibrationBoundary" data-h60i-panel="calibration-boundary">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("calibrationBoundary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("calibrationBoundary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("readOnly")} {t("reviewOnly")}</span></div>
      <ul className="operatorFieldRuntime__boundaryList">{boundaryKeys.map((key) => <li key={key}>{t(key)}</li>)}<li>{t("noCalibrationRun")}</li><li>{t("noModelUpdate")}</li></ul>
      <ul className="operatorFieldRuntime__boundaryList">{calibration.boundaryRules.map((rule, index) => <li key={`${index}:${rule}`}>{operatorSafeDisplay(rule, locale, COPY.boundaryRule)}</li>)}</ul>
    </article>
  </div>;
}
