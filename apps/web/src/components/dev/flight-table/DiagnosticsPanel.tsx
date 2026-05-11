import React from "react";
import type { FlightTableApiSnapshotV1, FlightTableManifestV1, FlightTableRunV1 } from "../../../api/flightTable";

type Props = {
  run: FlightTableRunV1 | null;
  manifest: FlightTableManifestV1 | null;
  verifyReport: Record<string, unknown> | null;
  snapshots: FlightTableApiSnapshotV1[];
  error: string | null;
};

function firstFailedStep(run: FlightTableRunV1 | null): string | null {
  const step = run?.steps.find((item) => item.status === "FAIL") ?? null;
  return step ? `${step.step_key} · ${step.message ?? "无错误说明"}` : null;
}

function suggestedCommand(run: FlightTableRunV1 | null): string {
  if (!run) return "创建 run 后运行 verify";
  const failed = run.steps.find((step) => step.status === "FAIL") ?? null;
  if (failed) return `POST /api/v1/dev/flight-table/runs/${run.run_id}/steps/${failed.step_key}/retry`;
  return `POST /api/v1/dev/flight-table/runs/${run.run_id}/verify`;
}

export default function DiagnosticsPanel({ run, manifest, verifyReport, snapshots, error }: Props): React.ReactElement {
  const rootCause = error ?? firstFailedStep(run) ?? run?.verify_summary.errors?.[0] ?? "暂无失败根因";
  const sqlSnapshots = snapshots.filter((snapshot) => String(snapshot.label ?? snapshot.path ?? "").toLowerCase().includes("sql"));
  return (
    <section className="flight-card flight-diagnostics-panel">
      <div className="flight-card-head">
        <h2>诊断报告</h2>
        <span>manifest.json / verify.json / API snapshots / SQL snapshots / root cause</span>
      </div>
      <dl className="flight-diagnostics">
        <dt>root cause</dt>
        <dd>{rootCause}</dd>
        <dt>failed layer</dt>
        <dd>{firstFailedStep(run) ?? "未发现 A-I 失败层"}</dd>
        <dt>suggested command</dt>
        <dd>{suggestedCommand(run)}</dd>
        <dt>SQL snapshots</dt>
        <dd>{sqlSnapshots.length ? `${sqlSnapshots.length} 条` : "当前 run 未返回 SQL snapshots"}</dd>
      </dl>
      <div className="flight-diagnostics-grid">
        <details open>
          <summary>manifest.json</summary>
          <pre className="flight-json">{JSON.stringify(manifest ?? run?.manifest ?? null, null, 2)}</pre>
        </details>
        <details open>
          <summary>verify.json</summary>
          <pre className="flight-json">{JSON.stringify(verifyReport ?? run?.verify_summary ?? null, null, 2)}</pre>
        </details>
        <details>
          <summary>API snapshots</summary>
          <pre className="flight-json">{JSON.stringify(snapshots, null, 2)}</pre>
        </details>
        <details>
          <summary>SQL snapshots</summary>
          <pre className="flight-json">{JSON.stringify(sqlSnapshots, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}
