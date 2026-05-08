import React from "react";
import "../../styles/skillTrace.css";
import { buildOperatorSkillTracePanelVm, type SkillTraceInput } from "../../viewmodels/skillTraceVm";

type SkillTracePanelProps = {
  trace?: SkillTraceInput;
  defaultOpen?: boolean;
};

export default function SkillTracePanel({ trace, defaultOpen = false }: SkillTracePanelProps): React.ReactElement {
  const vm = React.useMemo(() => buildOperatorSkillTracePanelVm(trace), [trace]);

  return (
    <details className="operatorSkillTracePanel" open={defaultOpen}>
      <summary>
        <span>{vm.title}</span>
        <small>{vm.summary}</small>
      </summary>
      {vm.runs.length ? (
        <div className="operatorSkillTraceRuns">
          {vm.runs.map((run) => (
            <article key={run.key} className={vm.failureRuns.some((item) => item.key === run.key) ? "operatorSkillTraceRun hasFailure" : "operatorSkillTraceRun"}>
              <div><span>skill_id</span><strong>{run.skillId}</strong></div>
              <div><span>skill_version</span><strong>{run.skillVersion}</strong></div>
              <div><span>classification</span><strong>{run.classification}</strong></div>
              <div><span>binding scope</span><strong>{run.bindingScope}</strong></div>
              <div><span>last run status</span><strong>{run.lastRunStatus}</strong></div>
              <div><span>failure reason</span><strong>{run.failureReason}</strong></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="operatorSkillTraceEmpty">{vm.emptyText}</div>
      )}
    </details>
  );
}
