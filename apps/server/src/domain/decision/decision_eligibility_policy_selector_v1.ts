import type { Pool } from "pg";

import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import {
  contextSnapshotV1Schema,
  type ContextSnapshotV1,
} from "../../contracts/canonical_context_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";
import {
  decisionEligibilityPolicyDeclarationV1Schema,
  type DecisionEligibilityPolicyDeclarationV1,
} from "../../contracts/decision_eligibility_policy_declaration_v1.js";
import { DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1 } from "./decision_eligibility_policy_declaration_fact_v1.js";

export type DecisionEligibilityPolicySelectorStateV1 =
  | "POLICY_SELECTED"
  | "POLICY_NOT_FOUND"
  | "POLICY_CONTEXT_MISSING"
  | "POLICY_SCOPE_ANCHOR_MISSING"
  | "POLICY_SCOPE_AMBIGUOUS"
  | "POLICY_TIME_BOUNDARY_MISSING"
  | "POLICY_SUPERSESSION_AMBIGUOUS"
  | "POLICY_DECLARATION_INVALID"
  | "POLICY_READ_ERROR";

export type DecisionEligibilityPolicyDeclarationFactRowV1 = {
  fact_id: string;
  occurred_at: string | Date;
  record_json: unknown;
};

export type SelectedDecisionEligibilityPolicyFactV1 = {
  fact_id: string;
  occurred_at: string;
  declaration: DecisionEligibilityPolicyDeclarationV1;
};

export type DecisionEligibilityPolicySelectorResultV1 = {
  state: DecisionEligibilityPolicySelectorStateV1;
  candidate_id: string | null;
  context_snapshot_ref: string | null;
  program_id: string | null;
  decision_time: string | null;
  selected_policy_ref: string | null;
  selected_policy_fact: SelectedDecisionEligibilityPolicyFactV1 | null;
  reason_codes: string[];
  limitations: string[];
};

type PreparedSelectorBoundaryV1 = {
  candidate: CandidateDecisionV1;
  context_snapshot: ContextSnapshotV1;
  program_id: string;
  decision_time: string;
};

type ParsedPolicyFactV1 = SelectedDecisionEligibilityPolicyFactV1;

const SCOPE_FIELDS_V1 = [
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "season_id",
  "zone_id",
] as const;

const SELECTOR_LIMITATIONS_V1 = [
  "B09V_POLICY_SELECTION_ONLY_NOT_ELIGIBILITY",
  "B09V_NO_B07E_CONNECTION",
  "B09V_NO_POLICY_CONTENT_DEFAULTS",
  "B09V_NO_APPROVAL_OR_EXECUTION_AUTHORITY",
  "B09V_NO_MCFT_ADR_OR_LLM_BINDING",
];

function resultV1(
  state: DecisionEligibilityPolicySelectorStateV1,
  detail: Partial<DecisionEligibilityPolicySelectorResultV1> = {},
): DecisionEligibilityPolicySelectorResultV1 {
  return {
    state,
    candidate_id: detail.candidate_id ?? null,
    context_snapshot_ref: detail.context_snapshot_ref ?? null,
    program_id: detail.program_id ?? null,
    decision_time: detail.decision_time ?? null,
    selected_policy_ref: detail.selected_policy_ref ?? null,
    selected_policy_fact: detail.selected_policy_fact ?? null,
    reason_codes: detail.reason_codes ?? [state],
    limitations: [
      ...SELECTOR_LIMITATIONS_V1,
      ...(detail.limitations ?? []),
    ],
  };
}

function isoV1(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function recordV1(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function exactScopeEqualV1(a: EvidenceScopeV1, b: EvidenceScopeV1): boolean {
  return SCOPE_FIELDS_V1.every((field) => a[field] === b[field]);
}

function programIdFromContextV1(
  candidate: CandidateDecisionV1,
  contextSnapshot: ContextSnapshotV1,
): { state: "OK"; program_id: string } | { state: DecisionEligibilityPolicySelectorStateV1 } {
  if (!candidate.basis.context_snapshot_ref) {
    return { state: "POLICY_CONTEXT_MISSING" };
  }
  if (candidate.basis.context_snapshot_ref !== contextSnapshot.snapshot_id) {
    return { state: "POLICY_CONTEXT_MISSING" };
  }
  if (!exactScopeEqualV1(candidate.scope, contextSnapshot.scope)) {
    return { state: "POLICY_CONTEXT_MISSING" };
  }

  const programAssertions = contextSnapshot.assertions.filter(
    (assertion) => assertion.kind === "DECLARED_FIELD_PROGRAM"
      && exactScopeEqualV1(assertion.scope, candidate.scope),
  );
  if (programAssertions.length === 0) {
    return { state: "POLICY_SCOPE_ANCHOR_MISSING" };
  }
  if (programAssertions.length !== 1) {
    return { state: "POLICY_SCOPE_AMBIGUOUS" };
  }

  const value = recordV1(programAssertions[0].value);
  const programId = value.program_id;
  if (
    typeof programId !== "string"
    || programId.length === 0
    || programId !== programId.trim()
  ) {
    return { state: "POLICY_SCOPE_ANCHOR_MISSING" };
  }
  return { state: "OK", program_id: programId };
}

function prepareSelectorBoundaryV1(
  candidateInput: CandidateDecisionV1 | Record<string, unknown>,
  contextInput: ContextSnapshotV1 | Record<string, unknown>,
): PreparedSelectorBoundaryV1 | DecisionEligibilityPolicySelectorResultV1 {
  const candidateParsed = candidateDecisionV1Schema.safeParse(candidateInput);
  const contextParsed = contextSnapshotV1Schema.safeParse(contextInput);
  if (!candidateParsed.success || !contextParsed.success) {
    return resultV1("POLICY_CONTEXT_MISSING", {
      reason_codes: [
        !candidateParsed.success
          ? "B09V_CANONICAL_CANDIDATE_INVALID"
          : "B09V_CANONICAL_CONTEXT_INVALID",
      ],
    });
  }

  const candidate = candidateParsed.data;
  const contextSnapshot = contextParsed.data;
  if (!candidate.decision_time) {
    return resultV1("POLICY_TIME_BOUNDARY_MISSING", {
      candidate_id: candidate.candidate_id,
      context_snapshot_ref: candidate.basis.context_snapshot_ref,
      reason_codes: ["B09V_CANDIDATE_DECISION_TIME_REQUIRED"],
    });
  }

  const decisionTime = isoV1(candidate.decision_time);
  if (!decisionTime) {
    return resultV1("POLICY_TIME_BOUNDARY_MISSING", {
      candidate_id: candidate.candidate_id,
      context_snapshot_ref: candidate.basis.context_snapshot_ref,
      reason_codes: ["B09V_CANDIDATE_DECISION_TIME_INVALID"],
    });
  }

  const anchor = programIdFromContextV1(candidate, contextSnapshot);
  if (anchor.state !== "OK") {
    return resultV1(anchor.state, {
      candidate_id: candidate.candidate_id,
      context_snapshot_ref: candidate.basis.context_snapshot_ref,
      decision_time: decisionTime,
      reason_codes: ["B09V_CANONICAL_PROGRAM_ANCHOR_NOT_ESTABLISHED"],
    });
  }

  return {
    candidate,
    context_snapshot: contextSnapshot,
    program_id: anchor.program_id,
    decision_time: decisionTime,
  };
}

function parsePolicyFactV1(
  row: DecisionEligibilityPolicyDeclarationFactRowV1,
): ParsedPolicyFactV1 | null | "INVALID" {
  const record = recordV1(row.record_json);
  if (record.type !== DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1) {
    return null;
  }
  const parsed = decisionEligibilityPolicyDeclarationV1Schema.safeParse(record.payload);
  const factId = String(row.fact_id ?? "").trim();
  const occurredAt = isoV1(row.occurred_at);
  if (!parsed.success || !factId || !occurredAt) {
    return "INVALID";
  }
  return {
    fact_id: factId,
    occurred_at: occurredAt,
    declaration: parsed.data,
  };
}

function declarationKnownAtBoundaryV1(
  fact: ParsedPolicyFactV1,
  decisionMs: number,
): boolean {
  const declaredMs = Date.parse(fact.declaration.declared_at);
  const occurredMs = Date.parse(fact.occurred_at);
  return declaredMs <= decisionMs && occurredMs <= decisionMs;
}

function declarationScopeMatchesV1(
  fact: ParsedPolicyFactV1,
  boundary: PreparedSelectorBoundaryV1,
): boolean {
  return exactScopeEqualV1(
    fact.declaration.scope.decision_scope,
    boundary.candidate.scope,
  )
    && fact.declaration.scope.scope_anchor_type === "PROGRAM"
    && fact.declaration.scope.scope_anchor_ref === boundary.program_id;
}

function effectiveAtBoundaryV1(
  declaration: DecisionEligibilityPolicyDeclarationV1,
  decisionMs: number,
): boolean {
  const fromMs = Date.parse(declaration.effective_from);
  const untilMs = declaration.effective_until === null
    ? null
    : Date.parse(declaration.effective_until);
  return fromMs <= decisionMs && (untilMs === null || decisionMs < untilMs);
}

function validateSupersessionV1(
  facts: ParsedPolicyFactV1[],
): { state: "OK"; deactivated_policy_refs: Set<string> }
  | { state: DecisionEligibilityPolicySelectorStateV1; reason_code: string } {
  const byPolicyRef = new Map<string, ParsedPolicyFactV1>();
  for (const fact of facts) {
    const policyRef = fact.declaration.policy_ref;
    if (byPolicyRef.has(policyRef)) {
      return {
        state: "POLICY_DECLARATION_INVALID",
        reason_code: "B09V_DUPLICATE_POLICY_REF_FACTS",
      };
    }
    byPolicyRef.set(policyRef, fact);
  }

  const successorsByPredecessor = new Map<string, ParsedPolicyFactV1[]>();
  for (const successor of facts) {
    const predecessorRef = successor.declaration.supersedes_policy_ref;
    if (predecessorRef === null) continue;

    const predecessor = byPolicyRef.get(predecessorRef);
    if (!predecessor) {
      return {
        state: "POLICY_DECLARATION_INVALID",
        reason_code: "B09V_SUPERSESSION_PREDECESSOR_NOT_FOUND_IN_EXACT_SCOPE_ANCHOR",
      };
    }
    if (
      predecessor.declaration.policy_id !== successor.declaration.policy_id
      || !exactScopeEqualV1(
        predecessor.declaration.scope.decision_scope,
        successor.declaration.scope.decision_scope,
      )
      || predecessor.declaration.scope.scope_anchor_type
        !== successor.declaration.scope.scope_anchor_type
      || predecessor.declaration.scope.scope_anchor_ref
        !== successor.declaration.scope.scope_anchor_ref
    ) {
      return {
        state: "POLICY_DECLARATION_INVALID",
        reason_code: "B09V_SUPERSESSION_ID_SCOPE_OR_ANCHOR_MISMATCH",
      };
    }

    const predecessorDeclaredMs = Date.parse(predecessor.declaration.declared_at);
    const predecessorOccurredMs = Date.parse(predecessor.occurred_at);
    const successorDeclaredMs = Date.parse(successor.declaration.declared_at);
    if (
      predecessorDeclaredMs > successorDeclaredMs
      || predecessorOccurredMs > successorDeclaredMs
    ) {
      return {
        state: "POLICY_DECLARATION_INVALID",
        reason_code: "B09V_SUPERSESSION_PREDECESSOR_NOT_KNOWN_BEFORE_SUCCESSOR",
      };
    }

    const successors = successorsByPredecessor.get(predecessorRef) ?? [];
    successors.push(successor);
    successorsByPredecessor.set(predecessorRef, successors);
  }

  for (const [predecessorRef, successors] of successorsByPredecessor) {
    if (successors.length > 1) {
      return {
        state: "POLICY_SUPERSESSION_AMBIGUOUS",
        reason_code: "B09V_MULTIPLE_SUCCESSORS_FOR_PREDECESSOR:" + predecessorRef,
      };
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const predecessorOf = new Map<string, string>();
  for (const fact of facts) {
    if (fact.declaration.supersedes_policy_ref) {
      predecessorOf.set(
        fact.declaration.policy_ref,
        fact.declaration.supersedes_policy_ref,
      );
    }
  }

  function visit(policyRef: string): boolean {
    if (visiting.has(policyRef)) return false;
    if (visited.has(policyRef)) return true;
    visiting.add(policyRef);
    const predecessorRef = predecessorOf.get(policyRef);
    if (predecessorRef && !visit(predecessorRef)) return false;
    visiting.delete(policyRef);
    visited.add(policyRef);
    return true;
  }

  for (const policyRef of byPolicyRef.keys()) {
    if (!visit(policyRef)) {
      return {
        state: "POLICY_SUPERSESSION_AMBIGUOUS",
        reason_code: "B09V_SUPERSESSION_CYCLE",
      };
    }
  }

  const deactivated = new Set<string>();
  return { state: "OK", deactivated_policy_refs: deactivated };
}

function deactivatedAtBoundaryV1(
  fact: ParsedPolicyFactV1,
  allFacts: ParsedPolicyFactV1[],
  decisionMs: number,
): boolean {
  return allFacts.some((successor) =>
    successor.declaration.supersedes_policy_ref === fact.declaration.policy_ref
    && Date.parse(successor.declaration.effective_from) <= decisionMs,
  );
}

export function selectDecisionEligibilityPolicyFromFactsV1(input: {
  candidate: CandidateDecisionV1 | Record<string, unknown>;
  context_snapshot: ContextSnapshotV1 | Record<string, unknown>;
  policy_facts: DecisionEligibilityPolicyDeclarationFactRowV1[];
}): DecisionEligibilityPolicySelectorResultV1 {
  const prepared = prepareSelectorBoundaryV1(input.candidate, input.context_snapshot);
  if ("state" in prepared) return prepared;

  const decisionMs = Date.parse(prepared.decision_time);
  const parsedFacts: ParsedPolicyFactV1[] = [];
  for (const row of input.policy_facts) {
    const parsed = parsePolicyFactV1(row);
    if (parsed === "INVALID") {
      return resultV1("POLICY_DECLARATION_INVALID", {
        candidate_id: prepared.candidate.candidate_id,
        context_snapshot_ref: prepared.context_snapshot.snapshot_id,
        program_id: prepared.program_id,
        decision_time: prepared.decision_time,
        reason_codes: ["B09V_PERSISTED_POLICY_DECLARATION_INVALID"],
      });
    }
    if (parsed !== null) parsedFacts.push(parsed);
  }

  const boundedFacts = parsedFacts.filter((fact) =>
    declarationScopeMatchesV1(fact, prepared)
    && declarationKnownAtBoundaryV1(fact, decisionMs),
  );

  const supersession = validateSupersessionV1(boundedFacts);
  if (supersession.state !== "OK") {
    return resultV1(supersession.state, {
      candidate_id: prepared.candidate.candidate_id,
      context_snapshot_ref: prepared.context_snapshot.snapshot_id,
      program_id: prepared.program_id,
      decision_time: prepared.decision_time,
      reason_codes: [supersession.reason_code],
    });
  }

  const applicable = boundedFacts.filter((fact) =>
    effectiveAtBoundaryV1(fact.declaration, decisionMs)
    && !deactivatedAtBoundaryV1(fact, boundedFacts, decisionMs)
    && fact.declaration.applicable_action_types.includes(
      prepared.candidate.proposed_action.action_type,
    ),
  );

  if (applicable.length === 0) {
    return resultV1("POLICY_NOT_FOUND", {
      candidate_id: prepared.candidate.candidate_id,
      context_snapshot_ref: prepared.context_snapshot.snapshot_id,
      program_id: prepared.program_id,
      decision_time: prepared.decision_time,
      reason_codes: ["B09V_NO_APPLICABLE_POLICY_AT_CANDIDATE_BOUNDARY"],
    });
  }
  if (applicable.length !== 1) {
    return resultV1("POLICY_SCOPE_AMBIGUOUS", {
      candidate_id: prepared.candidate.candidate_id,
      context_snapshot_ref: prepared.context_snapshot.snapshot_id,
      program_id: prepared.program_id,
      decision_time: prepared.decision_time,
      reason_codes: ["B09V_MULTIPLE_APPLICABLE_POLICIES_FAIL_CLOSED"],
    });
  }

  const selected = applicable[0];
  return resultV1("POLICY_SELECTED", {
    candidate_id: prepared.candidate.candidate_id,
    context_snapshot_ref: prepared.context_snapshot.snapshot_id,
    program_id: prepared.program_id,
    decision_time: prepared.decision_time,
    selected_policy_ref: selected.declaration.policy_ref,
    selected_policy_fact: selected,
    reason_codes: [
      "B09V_EXACT_CONTEXT_PROGRAM_ANCHOR_MATCH",
      "B09V_EXACT_NULLABLE_SCOPE_MATCH",
      "B09V_CAUSAL_AS_OF_POLICY_MATCH",
      "B09V_SINGLE_APPLICABLE_POLICY_SELECTED",
    ],
  });
}

export async function readAndSelectDecisionEligibilityPolicyV1(
  pool: Pool,
  input: {
    candidate: CandidateDecisionV1 | Record<string, unknown>;
    context_snapshot: ContextSnapshotV1 | Record<string, unknown>;
  },
): Promise<DecisionEligibilityPolicySelectorResultV1> {
  const prepared = prepareSelectorBoundaryV1(input.candidate, input.context_snapshot);
  if ("state" in prepared) return prepared;

  const scope = prepared.candidate.scope;
  try {
    const query = await pool.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = $1
          AND (record_json::jsonb#>>'{payload,scope,decision_scope,tenant_id}') IS NOT DISTINCT FROM $2
          AND (record_json::jsonb#>>'{payload,scope,decision_scope,project_id}') IS NOT DISTINCT FROM $3
          AND (record_json::jsonb#>>'{payload,scope,decision_scope,group_id}') IS NOT DISTINCT FROM $4
          AND (record_json::jsonb#>>'{payload,scope,decision_scope,field_id}') IS NOT DISTINCT FROM $5
          AND (record_json::jsonb#>>'{payload,scope,decision_scope,season_id}') IS NOT DISTINCT FROM $6
          AND (record_json::jsonb#>>'{payload,scope,decision_scope,zone_id}') IS NOT DISTINCT FROM $7
          AND (record_json::jsonb#>>'{payload,scope,scope_anchor_type}') = 'PROGRAM'
          AND (record_json::jsonb#>>'{payload,scope,scope_anchor_ref}') = $8
          AND occurred_at <= $9::timestamptz
        ORDER BY occurred_at ASC, fact_id ASC`,
      [
        DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1,
        scope.tenant_id,
        scope.project_id,
        scope.group_id,
        scope.field_id,
        scope.season_id,
        scope.zone_id,
        prepared.program_id,
        prepared.decision_time,
      ],
    );

    return selectDecisionEligibilityPolicyFromFactsV1({
      candidate: prepared.candidate,
      context_snapshot: prepared.context_snapshot,
      policy_facts: (query.rows ?? []) as DecisionEligibilityPolicyDeclarationFactRowV1[],
    });
  } catch {
    return resultV1("POLICY_READ_ERROR", {
      candidate_id: prepared.candidate.candidate_id,
      context_snapshot_ref: prepared.context_snapshot.snapshot_id,
      program_id: prepared.program_id,
      decision_time: prepared.decision_time,
      reason_codes: ["B09V_POLICY_DECLARATION_READ_FAILED"],
    });
  }
}
