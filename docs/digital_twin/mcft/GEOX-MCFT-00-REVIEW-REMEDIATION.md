<!-- docs/digital_twin/mcft/GEOX-MCFT-00-REVIEW-REMEDIATION.md -->
# GEOX MCFT-00 Review Remediation

## 0. Review identity

```text
phase: MCFT-00
review_target: PR #2304
authoritative_branch: mcft-00-reality-binding-contract
baseline_main_commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
review_status: REMEDIATION_IMPLEMENTED_PENDING_FINAL_ACCEPTANCE
repository boundary remains governance-only
```

## 1. Authority correction

PR #2305 was closed without merge and marked superseded. PR #2304 remains the only authoritative implementation line.

The source vocabulary correction remains governed by `MCFT00-AMENDMENT-01`. The post-acceptance findings below do not expand MCFT-00 runtime capability.

## 2. Post-acceptance findings

The previous `COMPLETE` closure was reopened after direct review of the implementation bytes established four additional findings:

```text
MCFT00-REVIEW-020 idempotency guard trusted declared determinism hashes
MCFT00-REVIEW-021 geometry rounding implementation diverged from half-away-from-zero policy
MCFT00-REVIEW-022 ingress adapter version was defined but not bound by Evidence bindings
MCFT00-REVIEW-023 purity scan omitted the geometry/hash helper
```

These findings invalidate the prior closure evidence for head `1e7d62a68d731a36ddc229c4cf7fff717ec75df6`.

## 3. Implemented remediations

```text
idempotency guard recomputes both semantic payload hashes
idempotency guard verifies each declared hash against its computed hash
idempotency guard verifies binding ID against the computed semantic identity
same ID plus changed payload plus stale hash returns SEMANTIC_HASH_MISMATCH
same ID plus changed payload plus correct changed hash returns IDEMPOTENCY_CONFLICT
geometry uses decimal half-away-from-zero at seven decimal places
positive and negative half-tie fixtures are executable acceptance evidence
every Evidence binding carries ingress_adapter_version
adapter definition and binding versions are compared by the authority validator
adapter version mismatch has an exact negative fixture
both private helpers are included in the purity scan
negative fixture count increased from 78 to 80
source matrix and Reality identities were deterministically rederived
```

## 4. Candidate identity after remediation

```text
binding_id: mcft_rb_bf1da664164a4fedda249bcb
determinism_hash: sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f
source_matrix_hash: sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
configuration_matrix_hash: sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5
```

The geometry identity is unchanged because the governed polygon contains no half-tie coordinates. The Reality identity changed because adapter version is now part of the governed Evidence-binding semantics.

## 5. Acceptance state

```text
closure status: PENDING_ACCEPTANCE
acceptance_status: PENDING
implementation_validated_head: PENDING
full local Gate: PENDING
negative_fixture_count: 80
final CI: PENDING
```

PR #2304 must remain Draft until the revised package passes the complete no-skip Gate, the working tree is clean, and final CI succeeds.
