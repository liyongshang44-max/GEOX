# H66 Design System Hardening

H66 hardens frontend design system only.

H66 starts after H65 Admin Console Cleanup has been merged.

H66 does not add product routes.

H66 does not change route topology.

H66 does not modify backend, DB, contracts, fixtures, or packages.

H66 cleans format debt from Field Runtime files.

H66 removes visible engineering phase copy from formal UI.

H66 strengthens replay demo CSS.

H66 adds mojibake guard.

H66 adds formal navigation pollution guard.

H66 adds shared surface CSS primitives.

H66 keeps product surfaces review-only and does not open runtime mutation surfaces.

H66 branch acceptance is scoped to H66 changed files. Historical frontend gates can be rerun on clean main after H66 merge or through a dedicated regression mode that does not apply old changed-file allowlists to the H66 branch.

Preserved boundaries:

- Operator Runtime Console remains read-only.
- Customer Portal route ownership remains unchanged.
- Admin route topology remains unchanged.
- Replay-backed demo nonclaims remain unchanged.
- Pilot readiness remains review-only.
- Runtime Health remains review-only.

Acceptance:

node scripts/frontend_acceptance/ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1.cjs
pnpm run typecheck:web
pnpm run build:web