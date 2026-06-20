# Operator Twin Presentation Surface V1

## Scope

Operator Twin is an operator workbench presentation surface for `/operator/twin/*`. It is not a customer report surface and must not reuse customer report presentation class names for its page, hero, panels, tables, lists, pills, notices, or action links.

The expected Operator Twin presentation vocabulary is:

- `operatorWorkbenchPage`
- `operatorWorkbenchHero`
- `operatorPanel`
- `operatorPanelGrid`
- `operatorTable`
- `operatorList`
- `operatorPill`
- `operatorBoundaryNotice`
- `operatorActionLink`

## Boundary

Operator Twin pages may show technical fields, evidence chains, request scope, scope policy, source index inventory, forecast window limits, and scenario comparison diagnostics.

Operator Twin pages must not:

- execute actions directly;
- bypass approval;
- treat forecast output as fact;
- treat scenario options as tasks;
- submit recommendations;
- dispatch work;
- create AO-ACT tasks.

## Presentation Ownership

Operator-specific styles live in `apps/web/src/styles/operatorTwin.css`. Customer report styles remain owned by customer report pages and must not become the styling source for `/operator/twin/*`.

## Acceptance

Run:

```text
pnpm run ci:frontend:operator-twin-presentation-surface
pnpm run ci:operator-twin-runtime-suite
pnpm run ci:governance:pr-metadata-contract
```
