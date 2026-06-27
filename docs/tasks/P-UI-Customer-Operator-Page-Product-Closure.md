# P-UI — Customer / Operator Page Product Closure

## Purpose

This task closes the page-product gap found after H57 and H58.

The runtime page audit already proves the pages can load. This task is about product-language acceptance, not backend chain implementation.

## Scope

This PR must remain one UI closure PR.

It does not add new backend business logic.

It does not change H57 ROI governance or H58 Field Memory governance.

It does not create a new H-line.

## Customer page rules

Customer-facing main visual sections must not show raw engineering codes.

Customer pages must not show internal identifiers such as recommendation, prescription, execution, acceptance, operation, field, approval, or receipt identifier labels in the main visual.

Customer pages must not show internal module names such as AO-ACT, ROI, or Field Memory in the main visual.

Customer pages should say:

```text
正式报告尚未形成
仍缺少正式验收与价值记录
建议记录
处方记录
执行记录
验收记录
价值记录
田块记忆
```

Customer pages must not say:

```text
正式 report API 条件不足
NO_* code
*_MISSING code
recommendation_id
prescription_id
as_executed_id
acceptance_id
AO-ACT
ROI
Field Memory
```

## Technical details

Technical details may remain available only as a folded troubleshooting area.

They must not become the customer main visual.

## Operator page rules

ROI and Field Memory operator pages may keep internal traceability, but their default empty state must not show backend fallback judgment as the main visual.

When no operation is selected, the learning closure panel must show only:

```text
请选择作业查看学习闭环
```

## Acceptance commands

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PAGE_PRODUCT_CLOSURE_V1.cjs
pnpm run typecheck:web
pnpm run ci:frontend:runtime-page-audit
```

Expected result:

```text
[P-UI-page-product-closure] PASS
```
