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
      <p className="operatorEyebrow">Scenario → Recommendation</p>
      <h3>Submit Scenario to Recommendation</h3>
      <p>
        提交后只会生成 recommendation，不会自动审批，不会创建 operation
        plan，不会创建 AO-ACT task。
      </p>
      <p>
        Boundary: recommendation only; approval_created=false,
        operation_plan_created=false, task_created=false,
        dispatch_created=false.
      </p>
      <label>
        选择 option
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
          <li>confidence：{selectedOption.confidence_text ?? "n/a"}</li>
          <li>risk_delta：{selectedOption.risk_delta ?? "n/a"}</li>
          <li>evidence_refs：{evidenceRefs.join(", ") || "none"}</li>
        </ul>
      ) : null}
      <label>
        operator_id
        <input
          value={operatorId}
          onChange={(event) => setOperatorId(event.target.value)}
        />
      </label>
      <label>
        submission reason
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Irrigate 22mm option selected after evidence review"
        />
      </label>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !selectedOptionId || !reason.trim()}
      >
        Submit to Recommendation
      </button>
      {result ? (
        <div className="operatorResult">
          <p>status：{result.status}</p>
          <p>submission_id：{result.submission_id || "n/a"}</p>
          <p>recommendation_id：{result.recommendation_id ?? "n/a"}</p>
        </div>
      ) : null}
    </article>
  );
}
