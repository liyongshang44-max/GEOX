import React from "react";
import { Link } from "react-router-dom";
import type { OperatorLearningClosureVm } from "../../viewmodels/operatorLearningClosureVm";
import "../../styles/operatorLearningClosure.css";

export default function LearningClosurePanel({ vm }: { vm: OperatorLearningClosureVm }): React.ReactElement {
  return (
    <section className="operatorLearningClosurePanel" aria-label="运营学习闭环">
      <header className="operatorLearningClosureHead">
        <div>
          <h2>学习闭环</h2>
          <p>请选择作业后查看完整学习链路。</p>
        </div>
        <span className={`operatorLearningClosureBadge ${vm.learningEffectiveTone}`}>{vm.learningEffectiveText}</span>
      </header>
      <div className="operatorLearningClosureGrid">
        {vm.rows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      {vm.actions.length ? (
        <div className="operatorLearningClosureActions">
          {vm.actions.map((action) => <Link key={action.label} to={action.href}>{action.label}</Link>)}
        </div>
      ) : null}
      <div className="operatorLearningClosureNotice">{vm.learningExcludedReasonText}</div>
    </section>
  );
}
