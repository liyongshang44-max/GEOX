# GEOX B-09l Eligibility Policy Provenance Inventory V1

## Status

B-09l is stacked exactly on completed B-09k product head:

`f8f8c45c696bbabbbddb5a859597663d30c60223`.

B-09l is analysis/governance only.

It does not create an eligibility policy, change FieldProgram, connect B-07e,
add a route/schema/workflow/graph edge, migrate consumers, remove authority, or
touch MCFT/Twin Kernel implementation.

## Question

B-09k established the next real blocker:

`EXPLICIT_PRODUCT_ELIGIBILITY_POLICY_NOT_BOUND`.

B-09l asks:

> Does the repository already contain a product policy that can legitimately
> become B-07d/B-07e `policy_ref + required_criteria +
> applicable_action_types` for the bounded IRRIGATE path?

The answer is **no**.

Several existing objects use the word `policy`, but none is semantically
equivalent to the B-07 policy contract.

## B-07 policy contract

B-07d defines:

```text
DecisionEligibilityPolicyV1 {
  policy_ref
  required_criteria
}
```

B-07e additionally requires:

`applicable_action_types`.

B-07d enforces:

- non-empty policy_ref;
- non-empty unique required criteria;
- policy_ref must appear in canonical `policy_refs`;
- no hidden default required-criterion list;
- eligibility PASS is not approval;
- no Approval/Plan/Task/Execution authority.

That is the contract B-09 migration must satisfy.

## FieldProgram is a scope anchor, not an existing eligibility policy

`field_program_v1` contains stable product scope:

- tenant;
- project;
- group;
- program_id;
- field_id;
- season_id;
- crop_code.

The decision-engine recommendation path resolves a `program_id` onto the
persisted recommendation chain.

Therefore FieldProgram is a plausible future **scope/provenance anchor** for an
eligibility policy declaration.

But the current FieldProgram has no B-07 policy object.

### acceptance_policy_ref

This ref belongs to post-execution acceptance/program planning semantics.

The acceptance engine evaluates:

- action-specific acceptance skills;
- formal evidence derived from the receipt;
- execution-window presence;
- non-development chain;
- variable-zone evidence when applicable.

It does not map `acceptance_policy_ref` to B-07 required criteria.

The planner also uses `acceptance_policy_ref` when describing candidate
actions.

Neither usage establishes B-07 eligibility policy authority.

### evidence_policy_ref

FieldProgram persists `evidence_policy_ref`, but repository search finds no
runtime consumer for this field.

A persisted-but-unconsumed ref cannot be promoted into B-07 authority.

### execution_policy

FieldProgram execution policy contains:

```text
mode = approval_required | auto_allowed
auto_execute_allowed_task_types
```

The planner maps this to:

```text
AUTO
APPROVAL_REQUIRED
BLOCKED
```

That answers an execution-governance question after an action exists.

It does not answer B-07's semantic question:

> Is this candidate sufficiently eligible to be considered now?

Execution authorization mode is not Decision Eligibility.

### manual approval / irrigation constraints

`manual_approval_required_for`,
`allow_night_irrigation`, and
`max_irrigation_mm_per_day` are Program constraints.

The recommendation-generation endpoint does not read these fields.

In particular, `/api/v1/recommendations/generate` does not read:

- execution_policy;
- manual_approval_required_for;
- allow_night_irrigation;
- max_irrigation_mm_per_day;
- acceptance_policy_ref;
- evidence_policy_ref.

It builds the recommendation first, then resolves `program_id` for chain
linkage.

Therefore these Program values did not establish eligibility for the current
recommendation source.

## Approval is downstream, not a substitute for PERMISSION

The operator recommendation approval-request builder declares:

```text
human_approval_required = true
no_direct_execution = true
request-only
approval_decision_created = false
operation_plan_created = false
task_created = false
dispatch_created = false
```

This is a post-candidate governance boundary.

B-07d explicitly states that an eligibility PASS is not approval.

B-09l therefore does not reinterpret
`human_approval_required=true` as the B-07 `PERMISSION` criterion.

Doing so would collapse decision eligibility and downstream approval into one
authority and invert their lifecycle ordering.

## Twin Kernel eligibility policies are not reusable B-Line authority

Repository search also finds:

- `P35_CANDIDATE_ELIGIBILITY_POLICY_V0`;
- `P46_RECOMMENDATION_ELIGIBILITY_POLICY_V0`;
- `TWIN_USE_ELIGIBILITY_POLICY_CONTRACT_V0`.

These are Twin Kernel policy families, not B-07d policies.

P35 governs Twin forecast-review candidacy.

P46 governs a later Twin recommendation-governance boundary and itself requires
separate recommendation/scope/safety/human-governance policy refs.

The Twin-use policy explicitly says:

```text
recommendation_generation_allowed = false
recommendation_approval_allowed = false
action_approval_allowed = false
ao_act_authority_allowed = false
```

They may be semantically informative, but they cannot be directly imported
into B-Line product eligibility.

B-09l does not change, connect, or reinterpret Twin Kernel/MCFT authority.

## Repository search result

For the bounded product path, repository search finds no product implementation
of:

- `applicable_action_types`;
- a `policy_ref + required_criteria` declaration;
- an eligibility-policy registry.

The only B-07 product policy shape is the evaluator contract itself.

Therefore there is no existing canonical product policy authority to bind.

## Readiness adjudication

```text
FieldProgram as future scope anchor     READY

existing B07 product policy             ABSENT
acceptance_policy_ref reuse             FORBIDDEN
evidence_policy_ref reuse               FORBIDDEN
execution_policy reuse                  FORBIDDEN
approval-request-as-PERMISSION          FORBIDDEN
Twin Kernel P35/P46 direct reuse        FORBIDDEN

required_criteria binding               NOT READY
applicable_action_types binding         NOT READY
B-07e runtime invocation                NOT READY
consumer migration                      NOT PERFORMED
authority removal                       NOT PERMITTED
```

## What the next step may do

A later B-Line phase may define a new shadow-only eligibility-policy declaration
contract, scoped by FieldProgram or another explicit canonical product source.

At minimum that declaration must make these fields explicit and auditable:

```text
policy_ref
scope
applicable_action_types
required_criteria
version / identity
provenance
lifecycle semantics where required
```

That future policy must not silently derive required criteria from:

- B-07 contract tests;
- acceptance policy;
- execution policy;
- approval state;
- Twin Kernel policy names.

B-09l itself does not create that contract.

## Repository effects

B-09l changes only:

1. this document;
2. the machine-readable provenance inventory;
3. two notes under `decision.eligibility`;
4. the B-09l governance acceptance.

It does not change:

- runtime code;
- FieldProgram contract;
- Program routes;
- planner;
- approval;
- acceptance;
- B-07 evaluator/runtime;
- Parallel Authority Graph;
- B-09 replacement readiness;
- MCFT/Twin Kernel;
- any of the 29 grandfathered authorities.

## Completion gate

B-09l is complete only when one exact head proves:

- FieldProgram policy-like fields are classified by their actual consumers;
- recommendation generation does not consume them as eligibility policy;
- acceptance_policy_ref is not promoted;
- evidence_policy_ref remains unconsumed;
- execution policy remains downstream action-mode governance;
- approval remains downstream request/authority governance;
- Twin Kernel policies remain a separate authority domain;
- no existing product B-07 policy registry/declaration is claimed;
- no eligibility policy is created;
- B-07e remains disconnected;
- register change is notes-only;
- graph and replacement-readiness are unchanged;
- all 29 grandfathered authorities remain exact;
- B-02/typecheck/build/general CI/full acceptance and MCFT boundary lanes pass.

## Next permitted step

Define a new B-Line shadow-only Decision Eligibility Policy Declaration
contract with explicit provenance and scope.

That definition must occur before any policy-required criterion binding or
B-07e runtime invocation.
