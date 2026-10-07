# GEOX MCFT Field-State Authority Successor Taskbook V1

status: DESIGN_CANDIDATE_ONLY
effective: false
design_base_protected_main: 0e4cd036fdbebfe8118d6b7c1978572859d5a652
cap09_closure_prerequisite: REQUIRED
merge_before_cap09_closure: FORBIDDEN
runtime_change_authorized: false
database_change_authorized: false
workflow_change_authorized: false
adr_runtime_change_authorized: false
bline_runtime_change_authorized: false
product_runtime_change_authorized: false

## 0. Purpose

This taskbook defines the post-MCFT-CAP-09 successor work surface.

It does not create MCFT-CAP-10 and it does not authorize further MCFT capability
expansion. Its purpose is to turn already-governed MCFT field evidence and state
into a stable, replayable Field-State Authority boundary that downstream systems
can consume without inheriting MCFT implementation details.

The target authority chain is:

```text
MCFT qualified Field Evidence / Field State
  -> MCFT Field-State Authority
  -> ADR exact Target-Scope / Context binding
  -> ADR decision-time runtime result
  -> B-Line Approval / Execution Authorization
  -> B-Line Task / Dispatch / Receipt / Acceptance evidence
  -> MCFT evidence candidate
  -> governed state re-evaluation
```

Product Projection is a read-only observer of this chain. It is not a participant
in authority creation.

## 1. Entry condition

No implementation slice in this taskbook may start until MCFT-CAP-09 is formally
closed by its existing authority chain.

Required entry facts:

- Formal-v5 O00-O23 completed on actual UTC wall-clock boundaries;
- final readback completed;
- final adjudication completed;
- exact-SHA/R2 effectiveness established where required by CAP-09;
- CAP-09 closure claim is effective on its governing authority path;
- no unresolved CAP-09 first-red is being carried into the successor.

Before those facts exist, this document is design-only and must remain Draft /
Unmerged.

## 2. Why this successor exists

CAP-09 proves a governed shadow-online Runtime can continuously create and
preserve qualified field evidence and state under a frozen authority model.

That does not by itself define a durable downstream consumption contract.

Without a separate Field-State Authority boundary, downstream consumers can
accidentally depend on:

- a mutable "latest" row;
- an internal MCFT table layout;
- a Runtime-specific config object;
- a Product API presentation shape;
- a current state substituted for a historical decision-time state;
- a state estimate without its exact evidence/context basis;
- an execution receipt treated as direct field truth.

The successor closes that boundary without changing MCFT scientific semantics.

## 3. Authority ownership

### 3.1 MCFT owns

MCFT owns qualification and authoritative publication of field-state facts that
are actually established by MCFT.

The Field-State Authority layer may:

- identify the exact field/zone/season scope;
- identify the exact logical time or interval;
- bind exact evidence refs;
- bind exact context/configuration refs;
- bind the exact state/result ref and its determinism/content hash;
- state epistemic class, quality, limitations and uncertainty when source-owned;
- define validity / available-at / supersession semantics;
- support deterministic historical selection;
- fail closed when no unique authority is valid.

It may not invent facts absent from source authority.

### 3.2 ADR owns

ADR owns decision-time target scope, context binding, decision applicability and
decision computation/result authority.

ADR must consume an exact Field-State Authority reference. It must not infer its
decision basis from "current MCFT state" after the decision boundary has passed.

ADR may not silently promote:

- Product Projection;
- a mutable MCFT latest row;
- B-Line execution facts;
- a stale Field-State Authority revision

into decision-time field truth.

### 3.3 B-Line owns

B-Line owns Principal/caller authorization, approval, operation plan, task,
dispatch, execution authorization, execution receipt and acceptance semantics.

B-Line must preserve the exact ADR decision/basis references that authorized the
execution path.

B-Line must not recalculate MCFT field state or ADR agronomic eligibility.

### 3.4 MCFT feedback boundary

Execution and receipt records may return to MCFT only as evidence candidates.

```text
B-Line Receipt
!= MCFT Field State
```

A receipt can establish that an action was reported/executed under B-Line
semantics. Any resulting field-state change requires the applicable MCFT
evidence qualification and state-update path.

### 3.5 Product Projection owns no domain authority

Product Projection may display and compose source-owned records.

It must preserve source authority refs and limitations and must remain:

```text
DOMAIN AUTHORITY
  -> NON-AUTHORITATIVE PRODUCT PROJECTION
  -> UI
```

No Product route may become an authority source for MCFT, ADR or B-Line.

## 4. Field-State Authority minimum envelope

Every authoritative record or authority envelope must be sufficient to answer:

1. What exact subject/scope is this about?
2. What state/result is being asserted?
3. At what logical time or interval is it valid?
4. When did the authority become available to a consumer?
5. What evidence established it?
6. What context/configuration/model basis was used?
7. What epistemic class and limitations apply?
8. Which revision was valid at the requested historical time?
9. What immutable ref/hash lets a downstream consumer replay the basis?
10. Has this authority been superseded, and if so under what rule?

Minimum fields are frozen in the machine contract:

`GEOX-MCFT-FIELD-STATE-AUTHORITY-SUCCESSOR-CONTRACT-V1.json`.

## 5. Temporal semantics

Historical consumption is an as-of problem, not a latest-row problem.

For logical time T, the selector must resolve only authorities that:

- were available no later than T;
- were effective for T;
- match the exact governed scope;
- satisfy supersession rules;
- resolve to exactly one authority.

If zero or more than one authority is valid, selection fails closed.

A later revision must not rewrite what was knowable or authoritative at an
earlier decision time.

## 6. Existing field_state work

The current repository contains:

`docs/digital_twin/mcft/field_state/GEOX-MCFT-FIELDSTATE-TARGET-PARAM-AUTH-01-INVENTORY-V1.json`

and historical Draft PR #3528 for real-target subject / geometry acquisition.

They are retained as predecessor evidence, not adopted as the successor
mainline.

The useful invariants carried forward are:

- synthetic targets must not be relabelled as real targets;
- subject identity and geometry authority are distinct;
- field geometry and management-zone geometry are distinct;
- temporal availability and validity are explicit;
- exact authority refs/hashes are required;
- target-specific parameter authority cannot be invented.

However, the successor's first objective is not to complete every target
parameter gap. It is to freeze the general Field-State Authority contract and
prove exact downstream consumption.

Real-world subject/geometry onboarding remains a separate upstream authority
lane and may be consumed once independently qualified.

## 7. Successor slices

### S0 — Post-CAP-09 authority audit and design rebase

Entry: CAP-09 effective closure.

Required work:

- bind this taskbook to the actual CAP-09 closure SHA/evidence;
- re-audit all existing MCFT state-producing/read-model surfaces;
- inventory ADR consumers of field/twin state;
- inventory B-Line consumers of ADR decisions and state/context;
- inventory Product Projection consumers;
- classify historical open MCFT PRs as RETIRE / CARRY-FORWARD / SUPERSEDED.

No runtime change.

Exit:
`FIELD_STATE_SUCCESSOR_S0_AUDIT_FROZEN`.

### S1 — Field-State Authority contract and validator

Freeze:

- authoritative TypeScript/data contract;
- machine schema;
- exact temporal selector semantics;
- source-ref/hash rules;
- quality/limitation rules;
- fail-closed validation.

No database schema change and no production writer.

Exit:
`FIELD_STATE_AUTHORITY_CONTRACT_QUALIFIED`.

### S2 — Existing-MCFT read adapter

Build a read-only adapter over existing qualified MCFT state/evidence surfaces.

The adapter must not:

- change Runtime Kernel;
- change scheduler semantics;
- change state calculations;
- introduce a second MCFT truth store;
- convert Product Projection into a source;
- issue domain writes.

It must return exact authority envelopes and historical as-of selections.

Exit:
`FIELD_STATE_AUTHORITY_READ_PATH_QUALIFIED`.

### S3 — ADR exact consumption binding

ADR integration is authorized only after S2.

Required behavior:

- bind exact target scope;
- bind exact Field-State Authority ref/hash;
- freeze decision-time context basis;
- persist/replay the decision basis;
- reject stale, ambiguous or unavailable state authority.

Current-state substitution for historical decisions is forbidden.

Exit:
`ADR_FIELD_STATE_EXACT_BINDING_QUALIFIED`.

### S4 — B-Line provenance propagation

B-Line integration is authorized only after the ADR binding qualifies.

Required behavior:

- Principal/caller authorization remains B-Line-owned;
- Approval/Plan/Task/Dispatch preserve the exact ADR decision/basis refs;
- Receipt/Acceptance preserve execution provenance;
- no B-Line path re-derives MCFT state;
- no execution record is silently promoted to field truth.

Exit:
`BLINE_DECISION_TO_RECEIPT_PROVENANCE_QUALIFIED`.

### S5 — Receipt-to-evidence feedback seam

This is a separately gated slice.

It defines how eligible B-Line execution evidence can become an MCFT evidence
candidate while preserving source identity and without creating a circular
authority claim.

Required rule:

```text
Receipt -> Evidence Candidate -> MCFT Qualification -> State
```

Forbidden:

```text
Receipt -> direct State mutation
```

Exit:
`FIELD_EXECUTION_FEEDBACK_SEAM_QUALIFIED`.

### S6 — Product read projection

Only after the domain chain is qualified should Product Projection consume it.

Required behavior:

- read-only;
- exact source refs retained;
- current projection separated from decision-time snapshot;
- no browser-side authority inference;
- missing upstream authority remains unavailable/limited, not defaulted.

Exit:
`FIELD_STATE_PRODUCT_PROJECTION_QUALIFIED`.

## 8. Hard acceptance matrix

| ID | Requirement | Fail-closed condition |
| --- | --- | --- |
| FS-01 | Exact tenant/project/group/field/zone/season scope | scope ambiguity or widening |
| FS-02 | Exact logical-time / validity semantics | no unique applicable authority |
| FS-03 | `available_at` preserved | revision unavailable at requested time |
| FS-04 | Immutable state/result ref + digest | mutable or unhashed basis |
| FS-05 | Exact evidence refs | basis incomplete or non-replayable |
| FS-06 | Exact context/config refs | hidden current configuration dependency |
| FS-07 | Epistemic class / limitations preserved | derived/limited result promoted to observed/pass |
| FS-08 | Historical replay determinism | current state substituted for historical state |
| ADR-01 | ADR consumes exact Field-State Authority | latest lookup / presentation API lookup |
| ADR-02 | Decision-time basis reconstructable | basis missing or changed |
| BL-01 | Approval chain preserves ADR refs | decision provenance dropped |
| BL-02 | Receipt preserves execution provenance | caller/device/task/authorization chain incomplete |
| FB-01 | Receipt is evidence candidate only | direct field-state mutation |
| PP-01 | Product remains projection-only | product value treated as domain authority |
| SEC-01 | Caller cannot broaden scope | untrusted request scope exceeds authorized scope |

## 9. Non-goals

This successor does not authorize:

- a new MCFT weather provider;
- new crop models;
- new ET0 semantics;
- new scheduler semantics;
- Runtime Kernel redesign;
- a new generalized Land Authority;
- Product-owned field truth;
- ADR-owned field truth;
- B-Line-owned field truth;
- automatic Principal approval;
- autonomous execution;
- target-specific soil/geometry fact invention;
- reopening CAP-09 qualification defects after closure.

## 10. Old PR retirement rule

Historical MCFT PRs that predate the effective CAP-09 closure must not be merged
merely because they remain open.

During S0 each one must be classified:

- `SUPERSEDED_BY_MAIN`;
- `HISTORICAL_EVIDENCE_ONLY`;
- `CARRY_FORWARD_REBASE_REQUIRED`;
- `CLOSE_WITHOUT_MERGE`.

Old branch head SHAs are never treated as successor implementation bases.

## 11. Merge gate for this design

This design PR itself must stay Draft / Unmerged while Formal-v5 is armed and
CAP-09 remains open.

After CAP-09 closure:

1. rebase/recreate from the exact closure main;
2. replace `design_base_protected_main` with closure main;
3. bind exact CAP-09 closure authority/evidence refs;
4. run S0 repository audit;
5. only then adjudicate this taskbook for protected-main adoption.

No pre-closure merge is permitted.

## 12. Current decision

At the 2026-10-07 design base:

```text
CAP-09 final Formal-v5 execution       IN PROGRESS / ARMED
Field-State successor design           PREPARED OFF-MAIN
Field-State runtime implementation     NOT AUTHORIZED
ADR integration                        NOT AUTHORIZED
B-Line integration                     NOT AUTHORIZED
Product successor merge/deploy         NOT AUTHORIZED
```

The next protected-main action remains the CAP-09 final real-clock authority
chain, not this successor.
