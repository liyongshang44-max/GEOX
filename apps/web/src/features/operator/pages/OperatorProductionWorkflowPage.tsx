// apps/web/src/features/operator/pages/OperatorProductionWorkflowPage.tsx
// Purpose: provide the TK17 production UX shell for explicit production source ingestion and explicit operator formalization workflow.
// Boundary: this page only triggers human/operator-originated workflow endpoints; it does not approve, dispatch, create AO-ACT tasks, create receipts, create acceptance records, or update model state.

import React from "react";
import { Link } from "react-router-dom";
import {
  createOperatorWorkflowFieldMemoryAction,
  createOperatorWorkflowReview,
  createOperatorWorkflowRoiAction,
  createOperatorWorkflowSession,
  fetchOperatorDecisionQueue,
  fetchTwinKernelTrace,
  ingestProductionSourceRefs,
  type ProductionSourceRefs,
  type TwinKernelWorkflowResponse,
} from "../../../api/twinKernelProductionWorkflow";

type StepState = "idle" | "loading" | "ready" | "error";

type RuntimeStep = {
  key: string;
  label: string;
  state: StepState;
  result: TwinKernelWorkflowResponse | null;
  error: string | null;
};

const DEFAULT_CANDIDATE_ID = "flc_c23a3ace34c48ce59c205110";

function nowIso(): string {
  return new Date().toISOString();
}

function refSuffix(): string {
  return String(Date.now());
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function parseRefs(value: string): ProductionSourceRefs {
  const parsed = JSON.parse(value) as ProductionSourceRefs;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("SOURCE_REFS_JSON_OBJECT_REQUIRED");
  return parsed;
}

function makeDefaultSourceRefs(): ProductionSourceRefs {
  const suffix = refSuffix();
  return {
    recommendation_ref_id: "prod_rec_ui_" + suffix,
    approval_ref_id: "prod_appr_ui_" + suffix,
    operation_plan_ref_id: "prod_plan_ui_" + suffix,
    task_ref_id: "prod_task_ui_" + suffix,
    receipt_ref_id: "prod_receipt_ui_" + suffix,
    observation_ref_id: "prod_observation_ui_" + suffix,
    acceptance_ref_id: "prod_acceptance_ui_" + suffix,
    verification_ref_id: "prod_verification_ui_" + suffix,
  };
}

function workflowStep(key: string, label: string): RuntimeStep {
  return { key, label, state: "idle", result: null, error: null };
}

function getDecisionCycleId(response: TwinKernelWorkflowResponse | null): string {
  const decisionCycle = safeObject(response?.decision_cycle);
  return safeString(decisionCycle.decision_cycle_id);
}

function getProductionEventId(response: TwinKernelWorkflowResponse | null): string {
  const event = safeObject(response?.production_ingestion_event);
  return safeString(event.production_ingestion_event_id);
}

function getSessionId(response: TwinKernelWorkflowResponse | null): string {
  const session = safeObject(response?.operator_session);
  return safeString(session.operator_session_id);
}

function getReviewId(response: TwinKernelWorkflowResponse | null): string {
  const review = safeObject(response?.operator_review);
  return safeString(review.operator_review_id);
}

function StepCard({ step }: { step: RuntimeStep }): React.ReactElement {
  return (
    <article className="operatorPanel" data-workflow-step={step.key}>
      <h3>{step.label}</h3>
      <p>state：{step.state}</p>
      {step.error ? <p>error：{step.error}</p> : null}
      {step.result ? (
        <details data-boundary="bounded-json-result">
          <summary>查看结果 JSON</summary>
          <pre style={{ maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{formatJson(step.result)}</pre>
        </details>
      ) : null}
    </article>
  );
}

export default function OperatorProductionWorkflowPage(): React.ReactElement {
  const [fieldLearningCandidateId, setFieldLearningCandidateId] = React.useState(DEFAULT_CANDIDATE_ID);
  const [sourceSystem, setSourceSystem] = React.useState("production_ui_adapter_v0");
  const [operatorId, setOperatorId] = React.useState("production_ui_operator");
  const [sourceRefsText, setSourceRefsText] = React.useState(formatJson(makeDefaultSourceRefs()));
  const [steps, setSteps] = React.useState<RuntimeStep[]>([
    workflowStep("ingestion", "1. Production source refs ingestion"),
    workflowStep("queue", "2. Operator decision queue"),
    workflowStep("session", "3. Operator session"),
    workflowStep("review", "4. Operator review"),
    workflowStep("roi", "5. Explicit ROI formalization"),
    workflowStep("field-memory", "6. Explicit Field Memory formalization"),
    workflowStep("trace", "7. Trace readback"),
  ]);

  const updateStep = React.useCallback((key: string, patch: Partial<RuntimeStep>) => {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  }, []);

  const ingestionStep = steps.find((step) => step.key === "ingestion") ?? null;
  const sessionStep = steps.find((step) => step.key === "session") ?? null;
  const reviewStep = steps.find((step) => step.key === "review") ?? null;
  const decisionCycleId = getDecisionCycleId(ingestionStep?.result ?? null);
  const productionEventId = getProductionEventId(ingestionStep?.result ?? null);
  const sessionId = getSessionId(sessionStep?.result ?? null);
  const reviewId = getReviewId(reviewStep?.result ?? null);

  async function runStep(key: string, runner: () => Promise<TwinKernelWorkflowResponse>): Promise<void> {
    updateStep(key, { state: "loading", error: null });
    try {
      const result = await runner();
      updateStep(key, { state: "ready", result, error: null });
    } catch (error) {
      updateStep(key, { state: "error", error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
    }
  }

  function resetRefs(): void {
    setSourceRefsText(formatJson(makeDefaultSourceRefs()));
  }

  function runIngestion(): void {
    void runStep("ingestion", async () => ingestProductionSourceRefs({
      field_learning_candidate_id: fieldLearningCandidateId,
      source_system: sourceSystem,
      source_event_id: "prod_ui_evt_" + refSuffix(),
      occurred_at: nowIso(),
      ingested_by: operatorId,
      ingested_at: nowIso(),
      source_refs: parseRefs(sourceRefsText),
    }));
  }

  function refreshQueue(): void {
    void runStep("queue", () => fetchOperatorDecisionQueue(25));
  }

  function openSession(): void {
    if (!decisionCycleId) return;
    void runStep("session", () => createOperatorWorkflowSession({ decision_cycle_id: decisionCycleId, operator_id: operatorId, opened_at: nowIso() }));
  }

  function writeReview(): void {
    if (!sessionId) return;
    void runStep("review", () => createOperatorWorkflowReview({
      operator_session_id: sessionId,
      reviewed_by: operatorId,
      reviewed_at: nowIso(),
      review_status: "NEEDS_FORMALIZATION",
      review_notes: { source: "tk17_production_ux_v0", production_ingestion_event_id: productionEventId },
    }));
  }

  function formalizeRoi(): void {
    if (!sessionId || !reviewId) return;
    void runStep("roi", () => createOperatorWorkflowRoiAction({
      operator_session_id: sessionId,
      operator_review_id: reviewId,
      formalized_by: operatorId,
      formalized_at: nowIso(),
      roi_summary: { source: "tk17_production_ux_v0", calculation_status: "OPERATOR_FORMALIZED" },
      evidence_refs: [{ kind: "operator_review", ref_id: reviewId }],
    }));
  }

  function formalizeFieldMemory(): void {
    if (!sessionId || !reviewId) return;
    void runStep("field-memory", () => createOperatorWorkflowFieldMemoryAction({
      operator_session_id: sessionId,
      operator_review_id: reviewId,
      formalized_by: operatorId,
      formalized_at: nowIso(),
      memory_statement: { source: "tk17_production_ux_v0", write_status: "OPERATOR_FORMAL_MEMORY_WRITTEN" },
      evidence_refs: [{ kind: "operator_review", ref_id: reviewId }],
    }));
  }

  function readTrace(): void {
    if (!decisionCycleId) return;
    void runStep("trace", () => fetchTwinKernelTrace(decisionCycleId));
  }

  return (
    <section className="operatorWorkbenchPage" data-page="tk17-production-ux-v0" data-boundary="explicit-operator-writes-no-auto-dispatch">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">TK17 Production UX v0</p>
          <h2>生产来源接入与人工 formalization 工作流</h2>
          <p>
            该页面把 TK15 ingestion、TK14 operator workflow、TK13 trace closure 串成显式人工流程。
            页面不会自动 recommendation、approval、dispatch、AO-ACT task、receipt、acceptance、ROI、Field Memory 或 model update。
          </p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <span className="operatorPill">Explicit operator actions</span>
          <span className="operatorPill">No auto dispatch</span>
          <span className="operatorPill">Trace-linked</span>
        </div>
      </div>

      <div className="operatorPanelGrid">
        <article className="operatorPanel" data-card="tk17-production-inputs">
          <h3>输入</h3>
          <label>
            field_learning_candidate_id
            <input value={fieldLearningCandidateId} onChange={(event) => setFieldLearningCandidateId(event.target.value)} />
          </label>
          <label>
            source_system
            <input value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} />
          </label>
          <label>
            operator_id
            <input value={operatorId} onChange={(event) => setOperatorId(event.target.value)} />
          </label>
          <label>
            source_refs JSON
            <textarea rows={10} value={sourceRefsText} onChange={(event) => setSourceRefsText(event.target.value)} />
          </label>
          <div className="operatorWorkbenchHeroActions">
            <button type="button" data-action="tk17-reset-source-refs" onClick={resetRefs}>重置 source refs</button>
            <button type="button" data-action="tk17-ingest-source-refs" onClick={runIngestion}>提交生产 source refs</button>
          </div>
        </article>

        <article className="operatorPanel" data-card="tk17-runtime-actions">
          <h3>人工步骤</h3>
          <p>decision_cycle_id：{decisionCycleId || "none"}</p>
          <p>operator_session_id：{sessionId || "none"}</p>
          <p>operator_review_id：{reviewId || "none"}</p>
          {decisionCycleId ? <p><Link to={`/operator/twin/traces/${decisionCycleId}`} data-link="tk17-open-read-only-trace">打开只读 trace 页面</Link></p> : null}
          <div className="operatorWorkbenchHeroActions">
            <button type="button" data-action="tk17-refresh-queue" onClick={refreshQueue}>刷新 operator queue</button>
            <button type="button" data-action="tk17-open-session" onClick={openSession} disabled={!decisionCycleId}>打开 session</button>
            <button type="button" data-action="tk17-write-review" onClick={writeReview} disabled={!sessionId}>写 review</button>
            <button type="button" data-action="tk17-formalize-roi" onClick={formalizeRoi} disabled={!sessionId || !reviewId}>显式 formalize ROI</button>
            <button type="button" data-action="tk17-formalize-field-memory" onClick={formalizeFieldMemory} disabled={!sessionId || !reviewId}>显式 formalize Field Memory</button>
            <button type="button" data-action="tk17-read-trace" onClick={readTrace} disabled={!decisionCycleId}>读取 trace</button>
          </div>
        </article>

        {steps.map((step) => <StepCard key={step.key} step={step} />)}
      </div>
    </section>
  );
}
