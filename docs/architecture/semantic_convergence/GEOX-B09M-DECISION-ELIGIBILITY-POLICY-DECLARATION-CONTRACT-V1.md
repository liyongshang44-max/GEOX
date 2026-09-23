# GEOX B-09m Decision Eligibility Policy Declaration Contract V1

## Status

B-09m is stacked exactly on completed B-09l product head:

`90e8518571bb42c5162811bf80158981057b40c4`.

B-09m freezes a contract vocabulary only.

It creates **zero production policy declarations** and does not connect B-07e,
select a product `required_criteria` set, add a policy registry, modify
FieldProgram, or touch Twin Kernel/MCFT.

## Why a declaration contract is required

B-09l proved that the repository has no existing product
`DecisionEligibilityPolicyV1` authority for the bounded IRRIGATE path.

The repository already has B-07d/B-07e runtime types, but their policy input is
caller supplied.

Before any caller can supply such a policy responsibly, B-Line needs a
canonical declaration vocabulary that answers:

- which exact policy/version is being referenced;
- what product scope it applies to;
- which action strings it applies to;
- which B-07 criteria it explicitly requires;
- what source/provenance declared it;
- when the declaration is effective;
- which lifecycle semantics it claims;
- what authority it does **not** have.

B-09m freezes that vocabulary without creating an instance.

## Open action vocabulary

`CandidateDecisionV1.proposed_action.action_type` is:

`z.string().min(1)`.

It is not a repository-wide enum.

B-09m therefore deliberately does not invent an IRRIGATE/SPRAY/etc policy
action enum.

`applicable_action_types` is an explicit, nonempty, unique array of canonical
trimmed strings.

A later product policy declaration chooses its action strings.

## Explicit required criteria, no defaults

`required_criteria` is a nonempty unique array over the existing B-07
criterion vocabulary:

- QUALIFIED_EVIDENCE
- STATE
- FORECAST
- SCENARIO
- CONTEXT
- KNOWLEDGE_POLICY
- PERMISSION
- ACTION_WINDOW
- CONSEQUENCE
- REVERSIBILITY
- REMAINING_UNCERTAINTY
- INDEPENDENT_EVIDENCE_SUPPORT

B-09m exports no default criterion list.

Contract tests use synthetic fixture criteria only. They are not a product
policy.

In particular, B-09m does not:

- copy the B-07e test fixture criteria;
- declare QUALIFIED_EVIDENCE-only;
- infer criteria from FieldProgram;
- infer criteria from approval/execution mode;
- infer criteria from Twin Kernel policies.

## Policy identity is version-identifying

B-07d runtime carries `policy_ref`, but not a separate policy-version field.

Therefore two materially different policy versions must not share the same
runtime ref.

B-09m freezes:

```text
declaration_id
  = decision_eligibility_policy_declaration_v1:<policy_id>:<policy_version>

policy_ref
  = decision_eligibility_policy_v1:<policy_id>:<policy_version>
```

`policy_id` and `policy_version` are explicit canonical identity tokens.

This contract does not create persistence or an immutability store. A later
source/provenance phase must prove that one policy_ref resolves to one immutable
declaration.

## Scope and source provenance

The declaration carries canonical `EvidenceScopeV1` as `decision_scope`.

For minimum tenant isolation, tenant/project/group must be non-null.

Field/season/zone remain governed by the canonical scope contract and may be
null where a future policy intentionally has wider scope.

The declaration separately requires:

```text
scope_anchor_type
scope_anchor_ref
declaration_source_type
declaration_source_ref
provenance_refs
```

These are provenance descriptors only.

B-09m does not whitelist FieldProgram or any other current source as policy
authority.

B-09l only established FieldProgram as a plausible future scope anchor.

## Lifecycle semantics

The declaration fixes:

`lifecycle_semantics = B07D_LIFECYCLE_STATE_V1`.

This means later policy use must obey the already-frozen B-07d lifecycle
consistency rules.

It does not mean ACTION_WINDOW is automatically required.

Only an explicit future `required_criteria` declaration can make
ACTION_WINDOW part of a specific policy, while B-07d itself continues to
enforce its non-ACTIVE lifecycle consistency invariant.

The declaration's `effective_from/effective_until` is policy declaration
validity metadata. It is not an ActionWindow criterion and creates no
`action_window_ref`.

## Authority boundary

Every declaration has:

`authority_state = POLICY_DECLARATION_ONLY`.

The schema has no:

- eligibility verdict;
- criterion assessment result;
- candidate eligibility id;
- approval;
- plan;
- task;
- dispatch;
- execution authority.

The contract is not a final `DecisionEligibilityDecisionV1` producer.

## Machine governance

B-09m adds:

`G-B02-32-decision-eligibility-policy-declaration-instantiation`.

It permits **zero production instantiation paths**.

Tests may parse fixtures because B-02 excludes test files.

Any later product policy source must first be explicitly registered before
production code may call:

`decisionEligibilityPolicyDeclarationV1Schema.parse(...)`.

Existing guards remain unchanged:

- G-B02-16 final eligibility producer;
- G-B02-17 criterion producer;
- G-B02-18 B-07d runtime consumer.

## Repository effects

B-09m adds exactly:

1. policy declaration contract;
2. contract tests;
3. this design document;
4. one ownership-register note plus G-B02-32;
5. governance acceptance.

It changes no:

- B-07d evaluator;
- B-07e runtime;
- FieldProgram;
- planner;
- approval;
- acceptance;
- routes;
- DB/schema;
- workflow;
- Parallel Authority Graph;
- B-09 replacement readiness;
- Twin Kernel/MCFT;
- Candidate/criterion/final eligibility producer sets;
- historical authority.

All 29 grandfathered records remain unchanged.

## Completion gate

B-09m is complete only when one exact product head proves:

- version-identifying policy_ref/declaration_id;
- explicit nonempty unique action applicability;
- open Candidate action vocabulary remains open;
- explicit nonempty unique required criteria;
- zero hidden/default criterion set;
- tenant/project/group scope required;
- explicit source/provenance fields;
- declaration effective-window validation;
- B07D lifecycle semantics tag without automatic ACTION_WINDOW requirement;
- POLICY_DECLARATION_ONLY has no verdict/approval/execution authority;
- G-B02-32 has zero production registered paths;
- no production policy declaration instantiation exists;
- G-B02-16/17/18 remain unchanged;
- producer sets remain unchanged;
- graph/readiness unchanged;
- runtime/schema/workflow/Twin/MCFT untouched;
- B-02/typecheck/build/general CI/full acceptance/MCFT lanes pass.

## Next permitted step

After B-09m, a later phase may establish one **shadow-only product policy
declaration source/provenance** for the bounded IRRIGATE path.

That later phase must choose and justify the actual:

```text
policy_id/version
scope anchor
applicable_action_types
required_criteria
effective window
source/provenance
```

B-09m itself authorizes none of those product choices and does not authorize a
B-07e runtime invocation.
