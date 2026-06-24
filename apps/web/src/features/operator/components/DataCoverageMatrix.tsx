// apps/web/src/features/operator/components/DataCoverageMatrix.tsx
// Purpose: render read-only data coverage rows in Chinese for Operator Twin review.
import React from "react";
import type { OperatorDataCoverageRow } from "../../../api/operatorTwin";

function boolText(value: boolean): string {
  return value ? "是" : "否";
}

function emptyText(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "无";
  return String(value);
}

function timeText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function metricText(value: string): string {
  const labels: Record<string, string> = {
    field: "地块",
    water_state_estimate: "水分状态估计",
    soil_moisture_sensing_window: "土壤水分感知窗口",
    weather_forecast: "天气预测",
    irrigation_scenario_set: "灌溉情景集",
    decision_recommendation: "决策建议",
  };
  const label = labels[value] ?? value;
  return label === value ? value : label + "（" + value + "）";
}

export default function DataCoverageMatrix({ rows }: { rows: OperatorDataCoverageRow[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="数据覆盖矩阵">
      <p className="operatorEyebrow">数据覆盖</p>
      <h3>数据覆盖矩阵</h3>
      <table className="operatorTable">
        <thead><tr><th>指标</th><th>可用</th><th>行数</th><th>最新时间</th><th>缺口说明</th><th>证据数</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.source_table}>
              <td>{metricText(row.metric)}</td>
              <td>{boolText(row.available)}</td>
              <td>{row.row_count}</td>
              <td>{timeText(row.latest_ts_ms)}</td>
              <td>{emptyText(row.quality_flags.concat(row.missing_windows).join("，"))}</td>
              <td>{row.evidence_refs.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
