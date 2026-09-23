# GEOX Product North Star V1

```text
document_id: GEOX-PRODUCT-NORTH-STAR-V1
status: domain reference / PRODUCT_DIRECTION_FREEZE
authority_source: docs/SSOT.md
effective_date: 2026-09-24
review_by: 2027-03-31
expires: NONE
supersession: EXPLICIT_SUCCESSOR_PLUS_SSOT_ADOPTION_ONLY
scope: GEOX_PRODUCT_DIRECTION_AND_BOUNDARY
domain_authority: NONE
runtime_authority: NONE
architecture_authority: NONE
```

## 0. Purpose

This document freezes the current GEOX product north star so implementation does not drift toward whichever temporary object is most developed in code.

It is a product-direction domain reference. It does not replace repository SSOT, MCFT, ADR, B-Line, Outcome, Identity, Asset, control-plane, migration, runtime, or qualification authority.

The product direction is intentionally narrower than an architecture redesign and broader than one execution pilot.

## 1. Product north star

GEOX remains:

```text
Trusted Agricultural Outcome Infrastructure
```

The enduring product relationship is:

```text
Principal × Land × Time
```

The operating objective is:

```text
A principal can remain able to understand, decide, authorize, act on,
verify, and learn from a piece of land even when the principal is not
physically present.
```

The customer journey remains:

```text
Observe
→ Understand
→ Decide
→ Approve
→ Act
→ Verify
→ Measure
→ Prove
→ Observe again
```

The final loop is longitudinal. An operation may close; the Principal–Land relationship does not.

## 2. Product root is not a new authority

`Principal × Land × Time` is a product-root relationship, not a new authority domain.

Permanent boundary:

```text
Product root
!= authority ownership
```

Existing authority separation remains intact:

```text
MCFT
= Field Evidence / Field State Authority

ADR
= Agronomic Knowledge / Science / Applicability /
  Runtime / Decision / Evaluation Authority

B-Line
= Principal / Caller / Approval / Execution /
  Device / Receipt / Provenance Authority
```

And permanently:

```text
Authority composition
!= Authority inheritance
```

This document does not create a `Land Authority`.

Where the product uses the word `Land`, authoritative identity/state still comes from the applicable field/zone/subject authority and explicit bindings. Product language must not silently collapse provider identity, GEOX field identity, ADR target scope, or another namespace into one universal identity.

## 3. Persistent and temporary product objects

The product should organize around persistence over time.

Persistent product context:

```text
Principal
Land
Principal–Land Relationship
Land Memory
```

Seasonal / planning context:

```text
Season
Crop
Management Plan
```

Temporary transaction objects:

```text
Decision
Approval
Operation
Task
Assignment
Execution
Receipt
Acceptance
Residual Operation
```

`temporary` means lifecycle-bounded, not disposable. Historical transaction objects and their evidence remain immutable/versioned according to their owning authority and retention rules.

A mature codebase containing many Task/Receipt records must not cause GEOX to redefine Task as the product root.

## 4. Land Memory boundary

Land Memory is the longitudinal organization of qualified or explicitly limited facts about one land context.

It is not an authority and must not mint facts merely by remembering them.

```text
Land Memory
= longitudinal product organization of source-owned records

Land Memory
!= new truth source
!= causal attribution authority
!= agronomic decision authority
!= execution authority
```

Every durable Land Memory item must preserve enough identity to recover its basis, including as applicable:

```text
land / field / zone subject ref
event time
source authority refs
source content digests / derivation identity
operation / decision / receipt / acceptance refs
evidence refs
effective time / evidence cutoff
limitations / uncertainty
```

Derived values must preserve derivation identity. A changed algorithm or changed source basis creates a new version/result; it must not silently rewrite historical meaning.

Execution facts do not automatically become land-state facts.

Example:

```text
"spray operation completed with 94.4% first-pass coverage"
```

may be retained as execution history.

It does not by itself establish:

```text
"Zone 3 has poor drainage"
"the crop improved because of this spray"
"this practice is agronomically preferred"
```

Those statements require the relevant owning authority.

## 5. Field Operations V0 position

```text
GEOX Field Operations V0 — Farm Service Closure
```

is an:

```text
EXECUTION CLOSURE PILOT / VERTICAL SLICE
```

It is not the complete definition of GEOX Product V1.

Its bounded purpose is to prove that a remote principal can hand off one real field operation and reliably know:

```text
what was planned
what was actually done
how much was covered
what was not covered
why execution stopped or diverged
who must decide next
whether residual work was re-authorized
whether the operation was finally completed
```

Current bounded engineering sequence:

```text
PHONE EXECUTION EVIDENCE
→ COVERAGE / RESIDUAL
→ EXECUTION NEEDS ATTENTION
→ RESIDUAL REAUTHORIZATION
→ MINIMAL LAND MEMORY WRITE-BACK
```

This slice must reuse existing Task / Assignment / Receipt / Evidence / Acceptance / authorization semantics instead of redesigning MCFT, ADR, or B-Line.

## 6. Operation closure does not close the product loop

The execution slice closes:

```text
Task
→ Execute
→ Evidence
→ Acceptance
→ Residual
→ Reauthorize
→ Execute
→ Complete
```

The GEOX product loop continues:

```text
Complete
→ reality changed
→ qualified field state may change
→ Land Memory accumulates
→ applicable knowledge / decision context may change
→ a new need may emerge
→ Principal decides again
```

Permanent invariant:

```text
CASE CLOSED
!=
LAND RELATIONSHIP CLOSED
```

## 7. Needs Attention is a cross-domain product concept

`Needs Attention` answers:

```text
What about this land currently requires an authorized human or governed
process to review, decide, approve, supply information, or resolve?
```

It is a non-authoritative product projection / triage concept.

```text
Needs Attention
!= domain authority
!= agronomic severity
!= risk score
!= command authorization
```

At minimum the product model must remain open to two source families.

### 7.1 Execution Attention

Field Operations V0 may implement this family first.

Examples:

```text
PARTIAL execution
NEEDS_REVIEW
INSUFFICIENT_EVIDENCE
WEATHER / MACHINE / FIELD_BLOCKED exception
assignment expired
residual work awaiting authorization
```

### 7.2 Land / Decision Attention

The product contract must not prevent future items such as:

```text
season plan unresolved
crop selection unresolved
required soil evidence missing
planting window closing
qualified field-state condition requiring review
decision awaiting Principal approval
```

These items must be sourced from the owning authority or explicit product-governance basis. Product Projection may order/present them but may not invent their domain meaning.

## 8. ADR product role

ADR is not required to prove the Spray Execution Closure E2E.

That bounded exclusion must not be generalized into `GEOX does not need ADR`.

The next intended decision-oriented product chain is:

```text
Land
→ Crop Selection
```

A future governed composition may distinguish:

```text
physically eligible
agronomically eligible
economically plausible
```

with the Principal retaining the final decision unless a separately governed authorization model says otherwise.

Economic plausibility must preserve the assumptions, source, effective time, and uncertainty of the economic basis. It must not be presented as timeless agronomic truth.

## 9. Product home direction

The long-term home experience should organize around the Principal–Land relationship and what requires attention, not around internal subsystem names.

The durable question is:

```text
What does this land need from me now?
```

A bounded early surface may show:

```text
Today
Planned
In progress
Completed
Needs attention
```

That UI is a first projection, not a permanent statement that operations are the product root.

MCFT, ADR, and B-Line may remain hidden implementation/authority domains in normal customer UX.

## 10. Product Projection boundary

The canonical product layer remains non-authoritative.

New product read construction must continue to use the governed Product Projection boundary and preserve:

```text
DOMAIN AUTHORITY
→ non-authoritative Product Projection
→ Product UI
```

Product UI and Product Projection must not create field truth, agronomic truth, approval, execution authorization, receipt truth, outcome truth, or attribution truth.

The product north star changes what the product is organized around; it does not widen the Product Projection authority ceiling.

## 11. Current engineering consequence

This north star does not interrupt the active MCFT CAP-09 closure line.

Current execution rule:

```text
MCFT CAP-09
→ finish its independently governed qualification / closure path

Field Operations V0
→ may proceed as a separate bounded product slice
→ must not mutate MCFT Runtime / Twin kernel / GFS semantics merely to satisfy UI needs
```

Field Operations V0 must stop expanding once the bounded execution-closure hypothesis can be tested in a real pilot.

Do not use this north star as authorization to start:

```text
general Land Memory platform construction
new Land Authority
whole-farm autonomous planning
new AI authority
B-Line architecture reopening
ADR expansion inside the Spray E2E
MCFT foundation redesign
```

## 12. Product success / kill discipline

The first Field Operations pilot should measure operational uncertainty and coordination cost, including as available:

```text
first-pass completion
partial / delayed / wrong execution
exception-to-manager-awareness time
exception-to-reschedule time
reassignment count
duplicate / missed work
claimed-complete but actually incomplete events
coordination calls/messages displaced
```

If real users demonstrate that existing phone/chat coordination is already sufficient, meaningful exceptions are rare, and workflow change is not worth adopting, the execution-closure product hypothesis must be reconsidered rather than hidden by adding more AI or infrastructure.

## 13. Relationship to the architecture blueprint

This document is a product-direction correction layered on top of the accepted Blueprint direction.

It preserves the Blueprint invariants:

```text
independent authorities
exact provenance / historical replay
authority ceilings
current world != decision-time world
product != authority
outcome != causal attribution
```

It adds a product organization principle the architecture blueprint did not need to own:

```text
the enduring customer relationship is Principal ↔ Land over time
```

Therefore this is not a foundational architecture redesign.

## 14. Review and supersession

This document does not expire automatically.

```text
expires = NONE
review_by = 2027-03-31
```

Review asks whether real pilot evidence still supports:

```text
Principal × Land × Time as product root
Land Memory as longitudinal organization
Needs Attention as the primary cross-domain product concept
Field Operations as one vertical slice rather than the whole product
```

A review may leave the document unchanged.

Supersession requires both:

1. an explicit successor that names this document; and
2. adoption through the repository governance layering in `docs/SSOT.md`.

A product implementation, UI redesign, taskbook, or temporary pilot may not silently supersede this north star.
