# PFE-14 Structure Prototype v1

Status: REVIEW PROTOTYPE / STRUCTURE ONLY / NON-EFFECTIVE  
Parent truth policy: `PFE-14-PROTOTYPE-TRUTH-MATRIX-V1`  
Runtime impact: NONE  
Route impact: NONE  
API impact: NONE

## Purpose

This artifact is the first PFE-14 product prototype produced under the no-fabrication rule.

It is intentionally a static review surface, not a React implementation and not a Runtime client. It answers one question only:

> If the current repository capabilities and the already-frozen PFE-14 future read-contract labels are organized into one usable Operator product, what is the page hierarchy and information layout without inventing any runtime value?

The visual artifact is:

`docs/frontend-productization/prototypes/PFE-14-STRUCTURE-PROTOTYPE-V1.html`

## Prototype scope

Exactly 12 surfaces are represented, matching the Truth Matrix:

- P01 Runtime Overview
- P02 Exact Scope Navigator
- P03 Field Runtime Overview
- P04 Evidence
- P05 State
- P06 Forecast
- P07 Runtime Health
- P08 Audit
- P09 Scenario
- P10 Action Lifecycle
- P11 Residual
- P12 Calibration

P13/P14 are not additional pages. Error/recovery states are cross-surface states; technical detail uses progressive disclosure.

## Data policy

The prototype intentionally contains no selected six-key Scope and no current operational values.

Current static facts shown exactly from the Operator shell are limited to:

- `Replay-backed Demo`
- `Read-only`
- `Live Device: Not connected`
- `Production Gateway: Not online`
- `Field Pilot: Not started`
- `Controlled Execution: Disabled`

For current GET-backed surfaces, the prototype displays the structural message `选定 Scope 后读取` rather than inventing an API response.

For blocked PFE-14 S4 fields, the prototype displays `等待 MCFT-9 权威读合同` or an equivalent explicit unavailable-authority state.

It contains no sample field IDs, no sample season/zone IDs, no synthetic timestamps, no synthetic percentages, no synthetic scheduler slot result, no synthetic freshness/health verdict and no synthetic agronomic/State/Forecast value.

## Visual alignment

The review HTML copies only the current PFE-14 S2 design tokens and layout principles from `operatorRuntimeVisualSystem.css`:

- system font stack;
- `#f5f5f7` page background;
- white restrained panels;
- `#1d1d1f` / `#6e6e73` text hierarchy;
- restrained `#176b45` accent;
- 12 / 16 / 20px radius hierarchy;
- thin separators and minimal shadows.

No Apple trademark asset, bundled font or proprietary control is used.

## Interaction boundary

The HTML contains no JavaScript, no network request, no form submission and no clickable action surface. It is a visual review artifact.

Controls represented in the layout correspond only to current repository product concepts, such as `中文 / English` and the two primary navigation entries. Their appearance in this static artifact does not create a new route or behavior.

## Next visual iteration

A later prototype may populate a current GET-backed area only when the exact visible value can be tied to either:

- a named current API response for the exact shown scope; or
- an immutable accepted artifact with run/artifact identity.

Until then the empty/read-after-scope state remains the correct prototype state.
