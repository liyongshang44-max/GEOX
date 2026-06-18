// apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
// Purpose: render the first view-only Operator Twin overview shell.
// Boundary: H18-B intentionally does not run forecasts, submit recommendations, approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link } from "react-router-dom";

type TwinStatusRow = {
  fieldId: string;
  fieldName: string;
  currentState: string;
  confidence: string;
  dataCoverage: string;
  forecastWindow: string;
  nextStep: string;
};

const DEMO_ROWS: TwinStatusRow[] = [
  {
    fieldId: "field_c8_demo",
    fieldName: "C8 示范田",
    currentState: "水分状态：中度缺水",
    confidence: "中等置信",
    dataCoverage: "土壤水分窗口与天气版本可用于灌溉判断",
    forecastWindow: "短期窗口可用；7d/30d 标记为未开放",
    nextStep: "复核情景比较并进入人工确认",
  },
];

const DATA_GAPS = [
  "7 天风险预测尚未作为正式 forecast_run_v1 固化",
  "30 天趋势尚未建模",
  "氮素状态、病害风险、经济比较尚未接入",
  "Submit Scenario to Recommendation 尚未开放",
];

const BOUNDARY_RULES = [
  "本页面不创建 AO-ACT task",
  "本页面不 dispatch",
  "本页面不绕过 approval",
  "Forecast 不能当作 Fact",
  "Scenario 不能当作 Task",
  "no_action baseline 后续情景比较必须保留",
];

export default function OperatorTwinOverviewPage(): React.ReactElement {
  return (
    <section className="customerReportPage" data-surface="operator-twin" data-page="operator-twin-overview">
      <div className="customerReportHero">
        <div>
          <p className="customerEyebrow">Operator Twin Workbench</p>
          <h2>田块预测与情景推演入口</h2>
          <p>
            该页面用于操作员查看田块状态、数据缺口、低置信判断和人工确认入口。
            当前版本为只读壳，不运行预测、不提交 recommendation、不审批、不执行。
          </p>
        </div>
        <div className="customerReportHeroActions">
          <span className="customerStatusPill">View-only</span>
          <span className="customerStatusPill">No direct execution</span>
        </div>
      </div>

      <div className="customerSectionGrid">
        <article className="customerCard">
          <h3>田块状态矩阵</h3>
          <div className="customerTableWrap">
            <table className="customerTable">
              <thead>
                <tr>
                  <th>田块</th>
                  <th>当前状态</th>
                  <th>置信度</th>
                  <th>数据覆盖</th>
                  <th>预测窗口</th>
                  <th>入口</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ROWS.map((row) => (
                  <tr key={row.fieldId}>
                    <td>
                      <strong>{row.fieldName}</strong>
                      <br />
                      <small>{row.fieldId}</small>
                    </td>
                    <td>{row.currentState}</td>
                    <td>{row.confidence}</td>
                    <td>{row.dataCoverage}</td>
                    <td>{row.forecastWindow}</td>
                    <td>
                      <Link to={"/operator/twin/fields/" + row.fieldId}>进入 Field Twin</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="customerCard">
          <h3>数据缺口</h3>
          <ul className="customerList">
            {DATA_GAPS.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </article>

        <article className="customerCard">
          <h3>人工确认边界</h3>
          <ul className="customerList">
            {BOUNDARY_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
