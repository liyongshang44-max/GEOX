// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditBoundaryMatrixPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditBoundaryMatrixPanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const lines = [t("noFactsWrite"), t("noRecommendation"), text("No Scenario Submission", "不提交情景"), t("noApproval"), t("noDispatch"), t("noAoAct"), t("noRoi"), t("noFieldMemory"), t("noModelUpdate"), t("noCalibrationRun"), text("No Production Monitoring Claim", "不声明生产监控"), text("No Product Conclusion", "不形成产品结论")];
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditBoundaryMatrix" data-h60k-panel="audit-boundary-matrix">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Boundary Matrix", "边界矩阵")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Audit Matrix Only", "仅审计矩阵")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Boundary information, not an action matrix.", "边界信息，不是行动矩阵。")}</p>
    <ul className="operatorFieldRuntime__boundaryList">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
    <div className="operatorFieldRuntime__auditTable" role="table" aria-label={text("No-write Boundary Matrix", "无写入边界矩阵")}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Tab", "标签页")}</span><span>Facts</span><span>Recommendation</span><span>Approval</span><span>Dispatch</span><span>AO-ACT</span><span>ROI</span><span>Field Memory</span><span>Model</span></div>{audit.boundaryMatrix.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.tab}><span>{row.tab}</span><span>{row.noFactsWrite ? t("noFactsWrite") : "false"}</span><span>{row.noRecommendationCreation ? t("noRecommendation") : "false"}</span><span>{row.noApproval ? t("noApproval") : "false"}</span><span>{row.noDispatch ? t("noDispatch") : "false"}</span><span>{row.noAoActTask ? t("noAoAct") : "false"}</span><span>{row.noRoiWrite ? t("noRoi") : "false"}</span><span>{row.noFieldMemoryWrite ? t("noFieldMemory") : "false"}</span><span>{row.noModelUpdate ? t("noModelUpdate") : "false"}</span></div>)}</div>
  </article>;
}
