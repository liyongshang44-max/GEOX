# GEOX B-09s Decision Eligibility Policy Declaration Writer + Route V1

## Status

B-09s is stacked exactly on B-09r:

`65ac424bc663c8c8ec2f148c10bc7f2193eae255`.

B-09r authorized who may declare policy. B-09s implements the first bounded,
append-only production declaration ingress under that authority.

No actual product policy is declared by this commit.

## API

```text
POST /api/v1/decision-eligibility/policy-declarations
```

The request must pass:

```text
requireDecisionEligibilityPolicyDeclarationAuthorityV1
```

Therefore:

```text
explicit token capability = decision.eligibility.policy.declare
AND
human policy-author role = agronomist
```

Admin remains denied even if its token explicitly carries the capability.

## Caller-controlled fields

The caller may submit only policy contents and the audit reason:

- policy_id / policy_version;
- canonical decision scope + scope anchor;
- applicable_action_types;
- required_criteria;
- lifecycle_semantics;
- provenance_refs;
- effective window;
- supersedes_policy_ref;
- limitations;
- change_reason.

## Server-derived authority/provenance

The caller cannot supply:

- schema_version;
- declaration_id;
- policy_ref;
- declaration_source_type;
- declaration_source_ref;
- declared_at;
- authority_state;
- fact_id / occurred_at;
- changed_by_actor_id / changed_by_token_id / written_at.

B-09s derives these from the authenticated principal and server clock.

This prevents a policy author from using the write API to forge a different
authority state, policy provenance identity, or historical declared_at.

## Append-only persistence

B-09s uses the existing `facts` table only.

There is no DDL and no UPDATE/DELETE policy mutation.

For each derived global `policy_ref`:

1. begin transaction;
2. acquire `pg_advisory_xact_lock(hashtext(policy_ref))`;
3. read at most two existing declaration facts;
4. zero rows -> append exactly one fact;
5. one row + exact stable declaration intent -> idempotently return existing;
6. one row + changed intent -> `POLICY_REF_CONFLICT`;
7. two rows -> `POLICY_REF_AMBIGUOUS`.

There is no latest-wins behavior.

A new fact receives server `declared_at`. Because B-09m requires
`declared_at <= effective_from`, a newly written policy cannot be backdated to
an already-past effective time.

## Fact envelope

The canonical declaration remains the exact strict B-09m payload:

```text
record_json.payload = DecisionEligibilityPolicyDeclarationV1
```

Audit provenance is a sibling envelope:

```text
record_json.audit.changed_by_actor_id
record_json.audit.changed_by_token_id
record_json.audit.change_reason
record_json.audit.written_at
```

Therefore audit fields do not pollute the strict policy contract.

## Machine governance

G-B02-32 now registers exactly one production instantiation path:

```text
apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts
```

C-045 records the real route -> writer call edge.

Any second production declaration producer remains forbidden unless explicitly
registered.

## Still absent

```text
repository policy instance       NONE
default required_criteria        NONE
default applicable actions       NONE
policy selector/read model       NONE
as-of resolution                 NONE
B-07e connection                 NONE
Approval connection              NONE
Execution connection             NONE
consumer migration               NOT STARTED
authority removal                NONE
MCFT implementation              UNTOUCHED
```

The next gate is no longer writer authority. It is actual product policy
content and policy-selection semantics.
