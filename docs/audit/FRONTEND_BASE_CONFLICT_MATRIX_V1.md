# Frontend vs Base Contract Conflict Matrix V1

Status: audit baseline  
Scope: customer UI, operator workbench, export pages, frontend release gates, and official report APIs.

## Purpose

Frontend rules are valid only when the official backend payload has already been aligned with the base contracts. This matrix records where frontend documentation is aligned with Apple I / Apple II / Apple III / Controlplane, where it is weaker than those base contracts, and where implementation can still drift.

## Classification

- **Aligned**: frontend rule directly reinforces a base contract.
- **Weaker**: frontend rule is directionally correct but does not prove the base contract is honored.
- **Potential conflict**: frontend wording or implementation could cause a base-contract violation unless constrained by backend guards.

---

## Matrix

| Frontend / API rule | Base contract relation | Classification | Risk | Required guard |
| --- | --- | --- | --- | --- |
| Customer pages use `/api/v1/customer/*` and `/api/v1/reports/*` official APIs | Matches API inventory and customer-safe boundary | Aligned | Official payload may itself be semantically wrong | Official report API must emit backend-owned contract/chain validation |
| Customer export uses the same VM/source as the page | Prevents page/export drift | Aligned but weaker | Same-source can preserve an invalid conclusion consistently | Export same-source gate must be paired with report contract-alignment gate |
| Frontend must not infer final status locally | Matches acceptance/AO-ACT boundary | Aligned | VM can still display backend-projected invalid status if report is wrong | Backend report must not infer acceptance/final_status from receipt/task/helper facts |
| Customer fallback must not fabricate geometry/weather/evidence/ROI/final_status | Matches Apple I evidence and fallback retirement | Aligned | fallback may still appear stronger than official if not labeled | fallback path must carry explicit data scope and formal empty state |
| Operator fallback is read-only and disables writes | Matches operator write API boundary | Aligned | fallback data may still influence operator next-action copy | fallback pages must avoid backend-readiness claims unless official operator facade provides them |
| OperationReport displays as-executed/as-applied and evidence metadata | AO-ACT facts may be shown as execution evidence | Potential conflict | UI may imply execution success, acceptance pass, or agronomy effect | copy and VM must label execution evidence separately from acceptance/effect |
| OperationReport displays skill trace / learning closure | Skill trace is audit/explain support only | Potential conflict | skill_run success may be read as operation success | frontend must keep skill trace in technical disclosure and never use it as status source |
| Flight Table can probe formal report APIs | Allowed only as dev rig snapshots | Potential conflict | ft_op helper chain may appear in customer formal report | report payload must mark helper/simulated chain; customer UI must not present it as production conclusion |
| RuleSet status may be displayed | Ruleset status is audit-only | Potential conflict | UI may treat `MISSING/INVALID` as readiness/action signal | display only in audit disclosure; no queue, priority, next-action, or gating from ruleset_status |
| Uncertainty/ProblemState can be displayed | Apple II says uncertainty describes unknowns only | Potential conflict | frontend may convert uncertainty into risk, next step, or recommendation | UI must not rank, prioritize, or action uncertainty unless a formal allowed layer outputs that state |
| Operator workbench shows next action | Operator page needs operational guidance | Weaker / risk-bearing | guidance may be derived from frontend aggregation rather than backend-owned action state | next action must come from official operator facade or be phrased as static help, not as system decision |

---

## Required frontend assumptions

Every customer-facing page must assume the following backend contract before rendering a business conclusion:

1. Report payload has separated official facts from fallback/helper/simulated facts.
2. Report payload has not inferred acceptance/final_status from AO-ACT receipt success.
3. Report payload has not inferred formal recommendation from raw metrics or skill trace alone.
4. Report payload has not treated skill_run success as operation success.
5. Report payload has exposed backend-owned `chain_validation` or equivalent contract guard.

If these assumptions are not true, the frontend must render a safe state such as `链路需复核`, `模拟链路`, `依据待补充`, or `仅作审计线索`; it must not render the section as a customer business conclusion.

## Existing frontend gates and coverage gap

| Gate | Covers | Gap |
| --- | --- | --- |
| `check-customer-export-same-source` | page/export same-source, forbidden business refetches, some fabrication tokens | cannot prove official report payload follows Apple/Controlplane contracts |
| `check-operation-status-convergence` | obvious receipt/task/error to PASS/SUCCESS inference patterns | cannot detect backend report semantic drift or subtle VM-derived conclusions |
| `check:no-raw-enum-customer` | customer language safety | cannot prove raw enum was semantically valid before mapping |
| `check:operator-boundary` | operator UI/write boundary | cannot prove operator facade readiness is backend-owned unless paired with API contract checks |

## Required new gates

1. Backend report contract-alignment gate.
2. Flight Table simulated-chain negative gate.
3. Stage-1 formal trigger provenance gate.
4. Frontend consumes backend `chain_validation` gate.
5. Operator next-action backend-owned gate.

## Verdict

Frontend governance is mostly aligned in intent, but it currently assumes official backend reports are already contract-correct. This assumption is unsafe. The next governance layer must verify official report semantics before frontend same-source/export checks are considered sufficient.
