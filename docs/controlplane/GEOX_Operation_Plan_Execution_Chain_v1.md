# GEOX Operation Plan Execution Chain v1

Status: derived design note. README_MIGRATION.md remains the SSOT for sprint/freeze state.

## Purpose

`operation_plan_v1` is the chain object that binds agronomy recommendation outputs to approval, task dispatch, and receipt evidence.

It exists so the system can expose one auditable lifecycle object in the operations console and in evidence export bundles.

## Canonical chain

The only valid execution chain for agronomy recommendations is:

```text
recommendation
â†’ approval_request
â†’ approval_decision
â†’ operation_plan_v1
â†’ ao_act_task_v0
â†’ ao_act_dispatch_outbox_v1 / ao_act_downlink_published_v1
â†’ ao_act_receipt_v0
```

`operation_plan_transition_v1` records lifecycle state changes for the same `operation_plan_id`.

## Hard boundaries

- recommendation facts are advisory only
- recommendation facts have no execution authority
- no route may dispatch a device command directly from a recommendation
- execution may start only after approval has produced an AO-ACT task
- receipts must use idempotency metadata and must not be accepted before publish
- operation plan reads must remain tenant-triple isolated and non-enumerable

## Minimum exported evidence chain

Any evidence export that includes the task/receipt chain for an agronomy-triggered execution must also include:

- `operation_plan_v1`
- `operation_plan_transition_v1`
- `approval_request_v1`
- `approval_decision_v1`
- `decision_recommendation_approval_link_v1`
- `decision_recommendation_v1`

## Acceptance expectations

At minimum, acceptance must prove:

- submit-approval returns `operation_plan_id`
- pre-approval plan status is `APPROVAL_PENDING`
- pre-approval plan does not yet expose `act_task_id`
- cross-tenant plan reads return 404
- duplicate receipts are rejected
- evidence export bundle includes `operation_plan_v1` and `operation_plan_transition_v1`

## Execution Boundary (Normative Rules)

- recommendation ÊÇ½¨Òé¶ÔÏó£¬±¾ÉíÃ»ÓÐÖ´ÐÐÈ¨
- recommendation ±ØÐë¾­¹ý approval ²ÅÄÜ½øÈë operation_plan / AO-ACT task
- executor Ö»Ïû·Ñ AO-ACT task£¬²»Ïû·Ñ recommendation

## Negative Acceptance Requirements

- Î´ÊÚÈ¨·ÃÎÊ£¨401£©
- ¿ç×â»§·ÃÎÊ£¨403/404£©
- ²»´æÔÚ recommendation£¨fail£©
- Î´ÉóÅúÖ´ÐÐ£¨forbidden£©
- ÖØ¸´ dispatch£¨idempotent, no duplicate execution£©

