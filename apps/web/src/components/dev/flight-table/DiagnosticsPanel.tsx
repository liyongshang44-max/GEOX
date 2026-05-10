import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";

type Props = {
  run: FlightTableRunV1 | null;
  error: string | null;
};

export default function DiagnosticsPanel({ run, error }: Props): React.ReactElement {
  const rootCause = error
    ? error
    : run?.verify_summary.errors?.[0] ?? "暂无失败根因";
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>诊断报告</h2>
        <span>root cause / suggested command</span>
      </div>
      <dl className="flight-diagnostics">
        <dt>root cause</dt>
        <dd>{rootCause}</dd>
        <dt>suggested command</dt>
        <dd>{run ? `POST /api/v1/dev/flight-table/runs/${run.run_id}/verify` : "创建 run 后运行 verify"}</dd>
        <dt>verify summary</dt>
        <dd>{run ? JSON.stringify(run.verify_summary) : "未生成"}</dd>
      </dl>
    </section>
  );
}
