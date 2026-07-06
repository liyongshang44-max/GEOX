<!-- docs/frontend-productization/PFE-1-PAGE-CONTRACT-TEMPLATE.md -->
# PFE-1 Page Contract Template

This template is the required schema for every PFE-1 formal page contract.

## Contract: `<Page Name>`

Route:
- `<route>`

Classification:
- `formal v1 page | formal sub-surface | export / print secondary surface`

Surface owner:
- `Customer Portal | Operator Runtime Console | Admin Console`

Primary user:
- `client user | runtime operator | internal admin | demo reviewer`

Page purpose:
- One product-facing paragraph that explains why the page exists.

Current status:
- `release surface present | incomplete product page | route ownership debt | secondary surface`

Data source / source owner:
- The read model, local adapter, checked-in snapshot, export renderer, or future source owner that the page depends on.

Allowed user actions:
- `view`
- `filter`
- `navigate`
- `export / print`
- `inspect trace`
- `review status`

Forbidden user actions:
- `dispatch`
- `AO-ACT`
- `approval`
- `facts write`
- `recommendation creation`
- `ROI write`
- `Field Memory write`
- `model update`
- `production gateway control`
- `live device control`

Must show:
- Required product sections, safe labels, visible boundaries, and core readback areas.

Must not show:
- Forbidden sections, terms, controls, claims, or internal-only wording.

Primary states:
- `default`
- `loading`
- `empty`
- `no data`
- `unavailable`
- `degraded`
- `error`
- `permission-limited`
- `replay-backed`
- `not connected / not online / disabled`, where applicable

Boundary / nonclaims:
- Explicit statements that prevent overclaiming runtime, pilot, dispatch, AO-ACT, recommendation, ROI, Field Memory, model update, facts write, live device, or gateway status.

Locale contract:
- zh-CN product copy required.
- en-US product copy required.
- Raw IDs, source names, evidence refs, fact IDs, trace IDs, hashes, and backend-returned enum values remain untranslated unless explicitly mapped.

Accessibility contract:
- Heading hierarchy.
- Landmarks.
- Keyboard reachable controls.
- Focus visible.
- Table semantics.
- aria-label where needed.
- No color-only status.

Responsive contract:
- Desktop.
- Laptop.
- Tablet.
- Mobile narrow.
- Table overflow / card fallback requirement.

Empty / loading / error contract:
- Product-safe copy requirements.
- No blank page.
- No raw stack trace.
- No internal debug leakage.

Visual / screenshot contract:
- Screenshot required later.
- No mojibake.
- No internal phase labels.
- Nonclaims visible where required.

Acceptance owner:
- `PFE-3 | PFE-4 | PFE-5 | PFE-6 | PFE-7 | PFE-8 | PFE-9 | PFE-12`

Implementation phase:
- Later PFE phase responsible for implementation.

PFE-1 decision:
- `contract closed`

## Non-contract surface handling

URL-only compatibility:
- No formal contract.
- No formal navigation.
- No page polish obligation.
- No accessibility completion obligation under PFE-1.
- Future contract required if promoted later.

Future product-contract page:
- Contract deferred.
- Do not implement.
- Do not design full UI.
- Record precondition only.

Do-not-build page:
- Explicitly prohibited.
- Not backlog.
- No PFE owner phase.
