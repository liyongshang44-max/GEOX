# F2 Responsive Viewport Smoke

## Phase

F2-C Responsive Viewport Smoke.

## Purpose

Formal surfaces should not collapse, overflow, or hide critical boundary and nonclaim text across common enterprise-console viewport widths.

F2 does not certify perfect mobile experience. It creates a repeatable smoke baseline.

## Viewport baseline

The registered viewport classes are:

- Desktop: 1440px
- Laptop: 1280px
- Tablet / narrow: 768px
- Small width smoke: 390px

## Required behavior

Formal surfaces should preserve readable shell structure, visible navigation, visible LocaleToggle, readable titles, readable boundary/nonclaim banners, wrapping cards, wrapping tables or meta rows, and long identifier containment.

No horizontal overflow should be caused by the shell. Sidebar/topbar behavior must remain documented. Cards must wrap. Tables or metadata rows must wrap. nonclaim banner readable behavior must be preserved. LocaleToggle topbar fit must be preserved.

## CSS affordances

The frontend baseline uses responsive affordances such as @media, flex-wrap, grid minmax, overflow-wrap, word-break or equivalent long-token protection, max-width safeguards, and min-width: 0 containment.

The static gate does not require every CSS file to contain every token. It verifies that formal CSS and shared primitives collectively provide responsive affordances.

## Long text and bilingual fit

F2-C covers long English nav labels, bilingual nonclaim banners, field IDs, trace IDs, hashes, report names, export labels, and metadata rows. Long ID / hash text must not break the shell.

## Visual smoke handoff

The route-level visual smoke checklist records which surfaces must be checked at the registered viewport classes. Manual screenshots can be added later without adding package dependencies.

## Non-goals

No automated browser matrix. No Playwright or screenshot package introduction. No route topology change. No runtime semantic change.
