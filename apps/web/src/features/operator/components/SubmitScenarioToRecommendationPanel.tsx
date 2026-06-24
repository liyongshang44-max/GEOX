// apps/web/src/features/operator/components/SubmitScenarioToRecommendationPanel.tsx
// Purpose: render the recommendation-only scenario submission panel for Operator Twin.
// Boundary: this component can submit a selected scenario into recommendation only; it does not approve, dispatch, create an operation plan, or create AO-ACT tasks.
import React from "react";
import {
  submitOperatorScenarioRecommendation,
  type OperatorScenarioCompareOption,
  type OperatorScenarioRecommendationSubmissionV1,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";

type Props = {
  fieldId: string;
  scenarioSetId: string;
  options: OperatorScenarioCompareOption[];
  evidenceRefs: string[];
  scope: OperatorTwinRequestScope;
};

function emptyText(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none" || raw === "n/a") return "无";
  return raw;
}

function listText(values: string[]): string {
  return values.length > 0 ? values.join("、") : "无";
}

export function SubmitScenarioToRecommendationPanel({
  fieldId,
  scenarioSetId,
  options,
  evidenceRefs,
  scope,
}: Props): React.ReactElement {
  const selectableOptions = options.filter(
    (option) => option.option_id !== "no_action",
  );
  const [selectedOptionId, setSelectedOptionId] = React.useState(
    selectableOptions[0]?.option_id ?? "",
  );
  const [reason, setReason] = React.useState("");
  const [operatorId, setOperatorId] = React.useState("operator_demo");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] =
    React.useState<OperatorScenarioRecommendationSubmissionV1 | null>(null);
  const selectedOption =
    options.find((option) => option.option_id === selectedOptionId) ?? null;

  async function onSubmit() {
    if (!selectedOptionId || !reason.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await submitOperatorScenarioRecommendation(
        fieldId,
        scenarioSetId,
        selectedOptionId,
        {
          ...scope,
          operator_id: operatorId.trim() || "operator_demo",
          submission_reason: reason.trim(),
          idempotency_key: `operator-scenario-${fieldId}-${scenarioSetId}-${selectedOptionId}-${reason.trim()}`,
        },
      );
      setResult(response.operator_scenario_recommendation_submission_v1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      className="operatorPanel"
      data-card="SubmitScenarioToRecommendationPanel"
    >
      <p className="operatorEyebrow">情景 → 建议候选</p>
      <h3>提交情景为建议候选</h3>
      <p>提交后只会生成建议候选，不会自动审批，不会创建作业计划，不会创建 AO-ACT 任务。</p>
      <p>边界：仅生成建议候选；approval_created=false，operation_plan_created=false，task_created=false，dispatch_created=false。</p>
      <label>
        选择情景选项
        <select
          value={selectedOptionId}
          onChange={(event) => setSelectedOptionId(event.target.value)}
        >
          {selectableOptions.map((option) => (
            <option key={option.option_id} value={option.option_id}>
              {option.option_id} · {option.label}
            </option>
          ))}
        </select>
      </label>
      {selectedOption ? (
        <ul className="operatorList">
          <li>置信度：{emptyText(selectedOption.confidence_text)}</li>
          <li>风险变化：{emptyText(selectedOption.risk_delta)}</li>
          <li>证据引用：{listText(evidenceRefs)}</li>
        </ul>
      ) : null}
      <label>
        操作员 ID
        <input
          value={operatorId}
          onChange={(event) => setOperatorId(event.target.value)}
        />
      </label>
      <label>
        提交理由
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="基于证据审查，选择该灌溉情景作为建议候选"
        />
      </label>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !selectedOptionId || !reason.trim()}
      >
        提交为建议候选
      </button>
      {result ? (
        <div className="operatorResult">
          <p>状态：{result.status}</p>
          <p>提交 ID：{result.submission_id || "无"}</p>
          <p>建议候选 ID：{result.recommendation_id ?? "无"}</p>
        </div>
      ) : null}
    </article>
  );
}
