# GEOX B-09q Decision Eligibility Policy Authz Enforcement Inventory V1

## Status

B-09q is stacked exactly on completed B-09p product head:

`731fe7ef62392e46d984ceafcb1bd62b17815230`.

B-09q is governance analysis only.

It does not add a scope, role mapping, token field, helper, route, writer,
policy instance, B-07e connection, consumer migration, or authority removal.

## Corrected repository fact

The current authorization path is not:

```text
role allows scope
=> request allowed
```

It is:

```text
token explicitly contains requested scope
AND
role matrix allows requested scope
=> request may proceed
```

`requireAoActScopeV0` first checks:

```text
rec.scopes.includes(scope)
```

and then checks:

```text
isScopeAllowedForRoleV1(role, scope)
```

This corrects an earlier oversimplification.

### What admin wildcard actually means

`admin: ["*"]` does not mint a missing token scope.

Therefore a future dedicated policy-declaration scope would still fail for an
admin token that did not explicitly carry that scope.

But if an admin token is explicitly granted that scope, the admin role layer
will allow it.

So the remaining governance question is not automatic wildcard escalation.

It is:

> Should an admin principal that explicitly receives the technical scope also
> be a legitimate product policy author?

That answer is still not established.

## Enforcement options

### 1. Dedicated scope only

Use existing `requireAoActScopeV0`.

This is better than the earlier simplified model because token assignment is
explicit.

However it cannot distinguish:

```text
technical admin + explicit scope
```

from:

```text
authorized product policy author + explicit scope
```

if product governance wants those to differ.

### 2. Route-local role check

A route could require the dedicated scope and then inspect `auth.role`.

This is not recommended.

It would distribute product-authority semantics across route handlers and
would be easy to drift or bypass if more than one writer path appears.

### 3. Centralized scope + product-author allowlist

This is the recommended topology, but not authorized.

```text
valid token
  -> explicit dedicated scope on token
  -> role matrix permission
  -> centralized product-author principal allowlist
  -> tenant/project/group match
  -> narrower field/program match when applicable
  -> audit metadata
  -> append-only writer
```

The principal allowlist must come from an explicit product-governance
decision.

B-09q does not choose that list.

### 4. Remove admin wildcard globally

Not recommended for B-Line.

That would be a broad authz redesign with unrelated blast radius.

### 5. Hide a special case in the generic role helper

Not recommended.

A hard-coded exception such as "admin is denied only for this one scope"
inside `isScopeAllowedForRoleV1` would bury product governance inside a
generic helper.

### 6. Add a new policy-authority claim to token records

This could become useful later but is not required for the first bounded
implementation.

It expands the token schema and duplicates part of the role/capability model.

## Recommended enforcement topology

B-09q recommends:

```text
dedicated policy-declaration token scope
+
role matrix permission
+
centralized explicit product-author principal allowlist
```

with fail-closed scope and audit checks.

State:

`RECOMMENDED_NOT_AUTHORIZED`.

The following remain unset:

```text
exact scope token
allowed roles/principals
whether admin is allowed
helper/policy-table shape
route path
writer path
actual policy contents
```

## Preserved boundary

```text
G-B02-32 registered paths     0
policy writer                 NONE
policy instance               NONE
auth scope change             NONE
role matrix change            NONE
token schema change           NONE
B-07e runtime                 DISCONNECTED
consumer migration            NOT PERFORMED
authority removal             NOT PERMITTED
MCFT implementation           UNTOUCHED
```

## Next permitted step

Product governance must explicitly authorize both:

1. the dedicated policy-declaration scope; and
2. the product-author principal set.

Only then may B-Line add centralized authz enforcement and the append-only
writer.
