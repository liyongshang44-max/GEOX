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

function declarationScopeMatchesV1(fact: ParsedPolicyFactV1, boundary: PreparedSelectorBoundaryV1): boolean {
  return exactScopeEqualV1(fact.declaration.scope.decision_scope, boundary.candidate.scope)
    && fact.declaration.scope.scope_anchor_type === "PROGRAM"
    && fact.declaration.scope.scope_anchor_ref === boundary.program_id;
}

function effectiveAtBoundaryV1(declaration: DecisionEligibilityPolicyDeclarationV1, decisionMs: number): boolean {
  const fromMs = Date.parse(declaration.effective_from);
  const untilMs = declaration.effective_until === null ?  null : Date.parse(declaration.effective_until);
  return fromMs <= decisionMs && (untilMs === null || decisionMs < untilMs);
}

function validateSupersessionV1(facts: ParsedPolicyFactV1 []): { state: "OK"; deactivated_policy_refs: Set<string> } | { state: DecisionEligibilityPolicySelectorStateV1; reason_code: string } {
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
        $ôôôÍÕ•ÍÍ½È¹‘•±…É…Ñ¥½¸¹Í½Á”¹Í½Á•}…¹¡½É}ÑåÁ”(€€€€€ñğÁÉ•‘••ÍÍ½È¹‘•±…É…Ñ¥½¸¹Í½Á”¹Í½Á•}…¹¡½É}É•˜(€€€€€€€€“ÓÓÒ7V66W76÷"æFV6Æ&F–öâç66÷Rç66÷Uöæ6†÷%÷&V`¢’°¢&WGW&â°¢7FFS¢%ôÄ”5•ôDT4Ä$D”ôåô”ådÄ”B"À¢&V6öåö6öFS¢$#•eõ5UU%4U54”ôåô”Eõ44õUôõ%ôä4„õ%ôÔ•4ÔD4‚"À¢Ó°¢Ğ ¢6öç7B&VFV6W76÷$FV6Æ&VD×2ÒFFRç'6R‡&VFV6W76÷"æFV6Æ&F–öâæFV6Æ&VEöB“°¢6öç7B&VFV6W76÷$ö67W'&VD×2ÒFFRç'6R‡&VFV6W76÷"æö67W'&VEöB“°¢6öç7B7V66W76÷$FV6Æ&VD×2ÒFFRç'6R‡7V66W76÷"æFV6Æ&F–öâæFV6Æ&VEöB“°¢–b€¢&VFV6W76÷$FV6Æ&VD×2â7V66W76÷$FV6Æ&VD×0¢ÇÂ&VFV6W76÷$ö67W'&VD×2â7V66W76÷$FV6Æ&VD×0¢’°¢&WGW&â°¢7FFS¢%ôÄ”5•ôDT4Ä$D”ôåô”ådÄ”B"À¢&V6öåö6öFS¢$#•eõ5UU%4U54”ôåõ$TDT4U54õ%ôäõEô´äõtåô$Tdõ$Uõ5T44U54õ""À¢Ó°¢Ğ ¢6öç7B7V66W76÷'2Ò7V66W76÷'4'•&VFV6W76÷"ævWB‡&VFV6W76÷%&Vb’óòµÓ°¢7V66W76÷'2çW6‚‡7V66W76÷"“°¢7V66W76÷'4'•&VFV6W76÷"ç6WB‡&VFV6W76÷%&VbÂ7V66W76÷'2“°¢Ğ ¢f÷"†6öç7B·&VFV6W76÷%&VbÂ7V66W76÷'5Òöb7V66W76÷'4'•&VFV6W76÷"’°¢–b‡7V66W76÷'2æÆVæwF‚â’°¢&WGW&â°¢7FFS¢%ôÄ”5•õ5UU%4U54”ôåôÔ$”uTõU2"À¢&V6öåö6öFS¢$#•eôÕTÅD•ÄUõ5T44U54õ%5ôdõ%õ$TDT4U54õ#¢"²&VFV6W76÷%&VbÀ¢Ó°¢Ğ¢Ğ ¢6öç7Bf—6—F–ærÒæWr6WCÇ7G&–æsâ‚“°¢6öç7Bf—6—FVBÒæWr6WCÇ7G&–æsâ‚“°¢6öç7B&VFV6W76÷$öbÒæWrÖÇ7G&–ærÂ7G&–æsâ‚“°¢f÷"†6öç7Bf7Böbf7G2’°¢–b†f7BæFV6Æ&F–öâç7WW'6VFW5÷öÆ–7•÷&Vb’°¢&VFV6W76÷$öbç6WB€¢f7BæFV6Æ&F–öâçöÆ–7•÷&VbÀ¢f7BæFV6Æ&F–öâç7WW'6VFW5÷öÆ–7•÷&VbÀ¢“°¢Ğ¢Ğ ¢gVæ7F–öâf—6—B‡öÆ–7•&Vc¢7G&–ær“¢&ööÆVâ°¢–b‡f—6—F–æræ†2‡öÆ–7•&Vb’’&WGW&âfÇ6S°¢–b‡f—6—FVBæ†2‡öÆ–7•&Vb’’&WGW&âG'VS°¢f—6—F–æræFB‡öÆ–7•&Vb“°¢6öç7B&VFV6W76÷%&VbÒ&VFV6W76÷$öbævWB‡öÆ–7•&Vb“°¢–b‡&VFV6W76÷%&Vbbbf—6—B‡&VFV6W76÷%&Vb’’&WGW&âfÇ6S°¢f—6—F–æræFVÆWFR‡öÆ–7•&Vb“°¢f—6—FVBæFB‡öÆ–7•&Vb“°¢&WGW&âG'VS°¢Ğ ¢f÷"†6öç7BöÆ–7•&Vböb'•öÆ–7•&Vbæ¶W—2‚’’°¢–b‚f—6—B‡öÆ–7•&Vb’’°¢&WGW&â°¢7FFS¢%ôÄ”5•õ5UU%4U54”ôåôÔ$”uTõU2"À¢&V6öåö6öFS¢$#•eõ5UU%4U54”ôåô5”4ÄR"À¢Ó°¢Ğ¢Ğ ¢6öç7BFV7F—fFVBÒæWr6WCÇ7G&–æsâ‚“°¢&WGW&â²7FFS¢$ô²"ÂFV7F—fFVE÷öÆ–7•÷&Vg3¢FV7F—fFVBÓ°§Ğ ¦gVæ7F–öâFV7F—fFVDD&÷VæF'•c€¢f7C¢'6VEöÆ–7”f7EcÀ¢ÆÄf7G3¢'6VEöÆ–7”f7EcµÒÀ¢FV6—6–öä×3¢çVÖ&W"À¢“¢&ööÆVâ°¢&WGW&âÆÄf7G2ç6öÖR‚‡7V66W76÷"’Óà¢7V66W76÷"æFV6Æ&F–öâç7WW'6VFW5÷öÆ–7•÷&VbÓÓÒf7BæFV6Æ&F–öâçöÆ–7•÷&V`¢bbFFRç'6R‡7V66W76÷"æFV6Æ&F–öâæVffV7F—fUög&öÒ’ÃÒFV6—6–öä×2À¢“°§Ğ ¦W‡÷'BgVæ7F–öâ6VÆV7DFV6—6–öäVÆ–v–&–Æ—G•öÆ–7”g&öÔf7G5c†–çWC¢°¢6æF–FFS¢6æF–FFTFV6—6–öåcÂ&V6÷&CÇ7G&–ærÂVæ¶æ÷vãã°¢6öçFW‡E÷6æ6†÷C¢6öçFW‡E6æ6†÷EcÂ&V6÷&CÇ7G&–ærÂVæ¶æ÷vãã°¢öÆ–7•öf7G3¢FV6—6–öäVÆ–v–&–Æ—G•öÆ–7”FV6Æ&F–öäf7E&÷ucµÓ°§Ò“¢FV6—6–öäVÆ–v–&–Æ—G•öÆ–7•6VÆV7F÷%&W7VÇEc°¢6öç7B&W&VBÒ&W&U6VÆV7F÷$&÷VæF'•c†–çWBæ6æF–FFRÂ–çWBæ6öçFW‡E÷6æ6†÷B“°¢–b‚'7FFR"–â&W&VB’&WGW&â&W&VC° ¢6öç7BFV6—6–öä×2ÒFFRç'6R‡&W&VBæFV6—6–öå÷F–ÖR“°¢6öç7B'6VDf7G3¢'6VEöÆ–7”f7EcµÒÒµÓ°¢f÷"†6öç7B&÷röb–çWBçöÆ–7•öf7G2’°¢6öç7B'6VBÒ'6UöÆ–7”f7Ec‡&÷r“°¢–b‡'6VBÓÓÒ$”ådÄ”B"’°¢&WGW&â&W7VÇEc‚%ôÄ”5•ôDT4Ä$D”ôåô”ådÄ”B"Â°¢6æF–FFUö–C¢&W&VBæ6æF–FFRæ6æF–FFUö–BÀ¢6öçFW‡E÷6æ6†÷E÷&Vc¢&W&VBæ6öçFW‡E÷6æ6†÷Bç6æ6†÷Eö–BÀ¢&öw&Õö–C¢&W&VBç&öw&Õö–BÀ¢FV6—6–öå÷F–ÖS¢&W&VBæFV6—6–öå÷F–ÖRÀ¢&V6öåö6öFW3¢²$#•eõU%4•5DTEõôÄ”5•ôDT4Ä$D”ôåô”ådÄ”B%ÒÀ¢Ò“°¢Ğ¢–b‡'6VBÓÒçVÆÂ’'6VDf7G2çW6‚‡'6VB“°¢Ğ ¢6öç7B&÷VæFVDf7G2Ò'6VDf7G2æf–ÇFW"‚†f7B’Óà¢FV6Æ&F–öå66÷TÖF6†W5c†f7BÂ&W&VB¢bbFV6Æ&F–öä¶æ÷väD&÷VæF'•c†f7BÂFV6—6–öä×2’À¢“° ¢6öç7B7WW'6W76–öâÒfÆ–FFU7WW'6W76–öåc†&÷VæFVDf7G2“°¢–b‡7WW'6W76–öâç7FFRÓÒ$ô²"’°¢&WGW&â&W7VÇEc‡7WW'6W76–öâç7FFRÂ°¢6æF–FFUö–C¢&W&VBæ6æF–FFRæ6æF–FFUö–BÀ¢6öçFW‡E÷6æ6†÷E÷&Vc¢&W&VBæ6öçFW‡E÷6æ6†÷Bç6æ6†÷Eö–BÀ¢&öw&Õö–C¢&W&VBç&öw&Õö–BÀ¢FV6—6–öå÷F–ÖS¢&W&VBæFV6—6–öå÷F–ÖRÀ¢&V6öåö6öFW3¢·7WW'6W76–öâç&V6öåö6öFUÒÀ¢Ò“°¢Ğ ¢6öç7BÆ–6&ÆRÒ&÷VæFVDf7G2æf–ÇFW"‚†f7B’Óà¢VffV7F—fTD&÷VæF'•c†f7BæFV6Æ&F–öâÂFV6—6–öä×2¢bbFV7F—fFVDD&÷VæF'•c†f7BÂ&÷VæFVDf7G2ÂFV6—6–öä×2¢bbf7BæFV6Æ&F–öâæÆ–6&ÆUö7F–öå÷G—W2æ–æ6ÇVFW2€¢&W&VBæ6æF–FFRç&÷÷6VEö7F–öâæ7F–öå÷G—RÀ¢’À¢“° ¢–b†Æ–6&ÆRæÆVæwF‚ÓÓÒ’°¢&WGW&â&W7VÇEc‚%ôÄ”5•ôäõEôdõTäB"Â°¢6æF–FFUö–C¢&W&VBæ6æF–FFRæ6æF–FFUö–BÀ¢6öçFW‡E÷6æ6†÷E÷&Vc¢&W&VBæ6öçFW‡E÷6æ6†÷Bç6æ6†÷Eö–BÀ¢&öw&Õö–C¢&W&VBç&öw&Õö–BÀ¢FV6—6–öå÷F–ÖS¢&W&VBæFV6—6–öå÷F–ÖRÀ¢&V6öåö6öFW3¢²$#•eôäõôÄ”4$ÄUõôÄ”5•ôEô4äD”DDUô$õTäD%’%ÒÀ¢Ò“°¢Ğ¢–b†Æ–6&ÆRæÆVæwF‚ÓÒ’°¢&WGW&â&W7VÇEc‚%ôÄ”5•õ44õUôÔ$”uTõU2"Â°¢6æF–FFUö–C¢&W&VBæ6æF–FFRæ6æF–FFUö–BÀ¢6öçFW‡E÷6æ6†÷E÷&Vc¢&W&VBæ6öçFW‡E÷6æ6†÷Bç6æ6†÷Eö–BÀ¢&öw&Õö–C¢&W&VBç&öw&Õö–BÀ¢FV6—6–öå÷F–ÖS¢&W&VBæFV6—6–öå÷F–ÖRÀ¢&V6öåö6öFW3¢²$#•eôÕTÅD•ÄUôÄ”4$ÄUõôÄ”4”U5ôd”Åô4Äõ4TB%ÒÀ¢Ò“°¢Ğ ¢6öç7B6VÆV7FVBÒÆ–6&ÆU³Ó°¢&WGW&â&W7VÇEc‚%ôÄ”5•õ4TÄT5DTB"Â°¢6æF–FFUö–C¢&W&VBæ6æF–FFRæ6æF–FFUö–BÀ¢6öçFW‡E÷6æ6†÷E÷&Vc¢&W&VBæ6öçFW‡E÷6æ6†÷Bç6æ6†÷Eö–BÀ¢&öw&Õö–C¢&W&VBç&öw&Õö–BÀ¢FV6—6–öå÷F–ÖS¢&W&VBæFV6—6–öå÷F–ÖRÀ¢6VÆV7FVE÷öÆ–7•÷&Vc¢6VÆV7FVBæFV6Æ&F–öâçöÆ–7•÷&VbÀ¢6VÆV7FVE÷öÆ–7•öf7C¢6VÆV7FVBÀ¢&V6öåö6öFW3¢°¢$#•eôU„5Eô4ôåDU…Eõ$ôu$Õôä4„õ%ôÔD4‚"À¢$#•eôU„5EôåTÄÄ$ÄUõ44õUôÔD4‚"À¢$#•eô4U4Åô5ôôeõôÄ”5•ôÔD4‚"À¢$#•eõ4”ätÄUôÄ”4$ÄUõôÄ”5•õ4TÄT5DTB"À¢ÒÀ¢Ò“°§Ğ ¦W‡÷'B7–æ2gVæ7F–öâ&VDæE6VÆV7DFV6—6–öäVÆ–v–&–Æ—G•öÆ–7•c€¢ööÃ¢ööÂÀ¢–çWC¢°¢6æF–FFS¢6æF–FFTFV6—6–öåcÂ&V6÷&CÇ7G&–ærÂVæ¶æ÷vãã°¢6öçFW‡E÷6æ6†÷C¢6öçFW‡E6æ6†÷EcÂ&V6÷&CÇ7G&–ærÂVæ¶æ÷vãã°¢ÒÀ¢“¢&öÖ—6SÄFV6—6–öäVÆ–v–&–Æ—G•öÆ–7•6VÆV7F÷%&W7VÇEcâ°¢6öç7B&W&VBÒ&W&U6VÆV7F÷$&÷VæF'•c†–çWBæ6æF–FFRÂ–çWBæ6öçFW‡E÷6æ6†÷B“°¢–b‚'7FFR"–â&W&VB’&WGW&â&W&VC° ¢6öç7B66÷RÒ&W&VBæ6æF–FFRç66÷S°¢G'’°¢6öç7BVW'’Òv—BööÂçVW'’€¢4TÄT5Bf7Eö–BÂö67W'&VEöBÂ&V6÷&Eö§6öã£¦§6öæ"2&V6÷&Eö§6öà¢e$ôÒf7G0¢t„U$R‡&V6÷&Eö§6öã£¦§6öæ"ÓãâwG—Rr’ÒC¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÆFV6—6–öå÷66÷RÇFVæçEö–GÒr’•2äõBD•5D”ä5Be$ôÒC ¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÆFV6—6–öå÷66÷RÇ&ö¦V7Eö–GÒr’•2äõBD•5D”ä5Be$ôÒC0¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÆFV6—6–öå÷66÷RÆw&÷Wö–GÒr’•2äõBD•5D”ä5Be$ôÒC@¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÆFV6—6–öå÷66÷RÆf–VÆEö–GÒr’•2äõBD•5D”ä5Be$ôÒCP¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÆFV6—6–öå÷66÷RÇ6V6öåö–GÒr’•2äõBD•5D”ä5Be$ôÒC`¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÆFV6—6–öå÷66÷RÇ¦öæUö–GÒr’•2äõBD•5D”ä5Be$ôÒCp¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÇ66÷Uöæ6†÷%÷G—WÒr’Òu$ôu$Òp¢äB‡&V6÷&Eö§6öã£¦§6öæ"3ãâw·–ÆöBÇ66÷RÇ66÷Uöæ6†÷%÷&VgÒr’ÒC€¢äBö67W'&VEöBÃÒC“£§F–ÖW7F×G ¢õ$DU"%’ö67W'&VEöB42Âf7Eö–B46À¢°¢DT4•4”ôåôTÄ”t”$”Ä•E•õôÄ”5•ôDT4Ä$D”ôåôd5EõE•UõcÀ¢66÷RçFVæçEö–BÀ¢66÷Rç&ö¦V7Eö–BÀ¢66÷Ræw&÷Wö–BÀ¢66÷Ræf–VÆEö–BÀ¢66÷Rç6V6öåö–BÀ¢66÷Rç¦öæUö–BÀ¢&W&VBç&öw&Õö–BÀ¢&W&VBæFV6—6–öå÷F–ÖRÀ¢ÒÀ¢“° ¢&WGW&â6VÆV7DFV6—6–öäVÆ–v–&–Æ—G•öÆ–7”g&öÔf7G5c‡°¢6æF–FFS¢&W&VBæ6æF–FFRÀ¢6öçFW‡E÷6æ6†÷C¢&W&VBæ6öçFW‡E÷6æ6†÷BÀ¢öÆ–7•öf7G3¢‡VW'’ç&÷w2óòµÒ’2FV6—6–öäVÆ–v–&–Æ—G•öÆ–7”FV6Æ&F–öäf7E&÷ucµÒÀ¢Ò“°¢Ò6F6‚°¢&WGW&â&W7VÇEc‚%ôÄ”5•õ$TEôU%$õ""Â°¢6æF–FFUö–C¢&W&VBæ6æF–FFRæ6æF–FFUö–BÀ¢6öçFW‡E÷6æ6†÷E÷&Vc¢&W&VBæ6öçFW‡E÷6æ6†÷Bç6æ6†÷Eö–BÀ¢&öw&Õö–C¢&W&VBç&öw&Õö–BÀ¢FV6—6–öå÷F–ÖS¢&W&VBæFV6—6–öå÷F–ÖRÀ¢&V6öåö6öFW3¢²$#•eõôÄ”5•ôDT4Ä$D”ôåõ$TEôd”ÄTB%ÒÀ¢Ò“°¢Ğ§Ğ 