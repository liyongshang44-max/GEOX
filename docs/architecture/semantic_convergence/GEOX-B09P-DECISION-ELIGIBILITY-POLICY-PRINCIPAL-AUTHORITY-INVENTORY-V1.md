# GEOX B-09p Decision Eligibility Policy Principal Authority Inventory V1

## Status

B-09p is stacked exactly on completed B-09o product head:

`ff8968f5468c12fcfce30203622230bfd660d477`.

B-09p is analysis/governance only.

It does not add a role, scope, service principal, route, writer, policy
instance, B-07e connection, consumer migration or authority removal.

## Core distinction

B-09o proved that a dedicated policy-declaration write capability is required.

B-09p freezes the next distinction:

```text
having a role
!=
having product policy authorship authority
```

The repository currently contains identities and adjacent capabilities, but it
does not establish which principal may author product DecisionEligibility
policy.

## Existing roles do not answer the question

### admin

`admin` currently has wildcard scope access.

That proves technical superuser capability, not policy provenance.

B-09p explicitly rejects:

```text
admin can technically call it
therefore
admin is the product policy authority
```

### agronomist

Agronomist currently has recommendation/prescription authoring capability and
agronomic reads.

This makes agronomist a plausible product-governance participant, but does not
by itself establish authority to define the policy that later governs
Candidate eligibility.

### approver

Approver owns downstream Approval decisions.

Approval authority cannot backflow into policy-definition authority.

### operator / support

Operational and support authorities remain separate from policy governance.

## Principal models

B-09p records four viable governance patterns without selecting one.

1. Existing human role + dedicated scope.
2. New dedicated product-governance role.
3. Governed service principal that executes an already-authorized declaration.
4. Dual-control human author + separate reviewer.

No option is authorized by this phase.

## Service-principal boundary

A service principal may provide deterministic machine identity and auditability.

It cannot manufacture product judgment.

Therefore:

```text
service principal
may execute an authorized declaration workflow

service principal
must not become policy authority merely because automation is convenient
```

No MCFT service-principal implementation is imported or modified by B-09p.

## Minimum principal auditability

Any future writer authority must preserve at least:

```text
actor_id
token_id or equivalent machine principal id
change_reason
declared_at
declaration_source_ref
provenance_refs
tenant/project/group scope
immutable fact_id
```

## Separation of duties

Policy authoring remains distinct from:

- recommendation generation;
- Approval decision;
- task execution;
- security administration;
- B-07e runtime evaluation.

## Intentionally undecided

B-09p does not choose:

```text
dedicated capability scope token
authorized human roles
authorized service principals
whether dual control is mandatory
route path
writer service path
actual policy contents
```

## Preserved boundary

```text
G-B02-32 registered paths     0
policy writer                 NONE
policy instance               NONE
role matrix change            NONE
service principal change      NONE
B-07e runtime                 DISCONNECTED
consumer migration            NOT PERFORMED
authority removal             NOT PERMITTED
MCFT implementation           UNTOUCHED
```

## Next permitted step

Product governance must explicitly select and authorize the principal model
for the dedicated policy-declaration capability.

Only after that authorization exists may B-Line modify authz or implement the
writer.
