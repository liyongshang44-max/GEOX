# GEOX B-09n Decision Eligibility Policy Source Authority Inventory V1

## Status

B-09n is stacked exactly on completed B-09m product head:

`dd39f74e4e44de9c0626c063522904f8e255e89c`.

B-09n is analysis/governance only.

It does not create a policy writer, route, policy instance, required-criteria
set, action applicability, B-07e invocation, consumer migration, or authority
removal.

## Question

B-09m froze the declaration contract, but deliberately created zero production
instances.

The next semantic question is therefore not:

> What should the IRRIGATE eligibility criteria be?

It is:

> Where can a future product policy declaration live so its authority,
> version, scope and decision-time provenance can be reproduced without
> collapsing FieldProgram, Approval, Execution, Acceptance or Twin semantics?

## Option A — embed policy contents in FieldProgram

FieldProgram already provides a useful product scope anchor:

```text
tenant / project / group
program_id
field_id
season_id
```

and the recommendation chain can resolve `program_id`.

It is also append-only at the fact level.

However FieldProgram already carries:

```text
goals
general constraints
execution_policy
acceptance_policy_ref
evidence_policy_ref
```

Adding the full DecisionEligibility policy payload there would expand the
semantic responsibility of FieldProgram and make every policy-version change a
new whole-program fact.

It would also increase the chance that legacy Program/Planner/Approval
consumers accidentally treat eligibility-policy declarations as execution or
approval authority.

Adjudication:

```text
FieldProgram
= useful scope anchor
!= recommended embedded Eligibility policy authority
```

## Option B — separate append-only policy declaration fact

Preferred topology:

```text
decision_eligibility_policy_declaration_v1 fact
  payload -> DecisionEligibilityPolicyDeclarationV1
  scope   -> canonical decision scope
  anchor  -> program_id or equivalent explicit canonical scope source
```

This keeps policy identity/version independent from FieldProgram revision
history and allows one future `policy_ref` to be bound to one immutable
declaration payload.

It also creates a clean future governance point:

`G-B02-32-decision-eligibility-policy-declaration-instantiation`.

B-09n does **not** register a production path in G-B02-32.

No writer currently exists.

No route currently exists.

No product policy instance currently exists.

The topology is therefore:

`RECOMMENDED_NOT_AUTHORIZED`.

## Option C — static repository policy file

A repository file is easy to version, but it does not by itself establish:

- tenant/program product scope;
- runtime product fact identity;
- immutable product source_ref;
- decision-time as-of binding;
- customer/product authority.

A static file may be useful as a default template or reference in another
program, but B-09n does not accept it as the current bounded product policy
authority.

## Existing policy-like families remain forbidden

B-09n preserves B-09l:

- `acceptance_policy_ref` is not Eligibility policy;
- `evidence_policy_ref` is not Eligibility policy;
- `execution_policy` is not Eligibility policy;
- manual approval is not the B-07 PERMISSION criterion;
- Twin Kernel P35/P46/TWIN_USE policies are separate authority families.

## Required governance before a writer can exist

Even with the preferred separate-fact topology, product governance still has
to explicitly decide:

```text
who/what may declare a policy
writer role / authz scope
source mechanism
immutable policy_ref semantics
duplicate conflict behavior
multiple-policy ambiguity behavior
decision-time as-of selection
candidate/policy scope matching
supersession rules
```

The future writer must be append-only and fail closed.

In particular:

```text
same policy_ref + different payload
!= latest wins

multiple equally applicable policies
!= arbitrary latest wins

missing explicit policy
!= fallback to test fixture/default policy
```

## Product policy content remains intentionally undecided

B-09n does not choose:

```text
policy_id
policy_version
policy_ref
applicable_action_types
required_criteria
source authority
writer authority
```

Therefore it does not create a real IRRIGATE policy.

## Preserved boundary

```text
B-07e runtime                      DISCONNECTED
G-B02-32 registered production paths = 0
policy writer                      NONE
policy instance                    NONE
Candidate persistence              NONE
consumer migration                 NOT PERFORMED
authority removal                  NOT PERMITTED
MCFT/Twin implementation           UNTOUCHED
```

## Next permitted step

A product-governance authority must explicitly authorize the policy-declaration
source and writer authority before B-Line may add a production declaration
path or create a real policy instance.

B-09n does not authorize that choice.
