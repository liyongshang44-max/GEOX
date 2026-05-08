import React from "react";
import { buildCustomerSkillTraceFoldoutVm, type SkillTraceInput } from "../../viewmodels/skillTraceVm";

type SkillTraceFoldoutProps = {
  trace?: SkillTraceInput;
  defaultOpen?: boolean;
};

export default function SkillTraceFoldout({ trace, defaultOpen = false }: SkillTraceFoldoutProps): React.ReactElement {
  const vm = React.useMemo(() => buildCustomerSkillTraceFoldoutVm(trace), [trace]);

  return (
    <details className="customerSkillTraceFoldout" open={defaultOpen}>
      <summary>{vm.title}</summary>
      <div className="customerSkillTraceBody">
        <p>{vm.summary}</p>
        {vm.sources.length ? (
          <div className="customerSkillTraceSources">
            {vm.sources.map((source, index) => (
              <div key={`${source.label}-${index}`} className="customerSkillTraceSource">
                <strong>{source.label}</strong>
                <span>{source.summary}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="customerSkillTraceEmpty">{vm.emptyText}</div>
        )}
      </div>
    </details>
  );
}
