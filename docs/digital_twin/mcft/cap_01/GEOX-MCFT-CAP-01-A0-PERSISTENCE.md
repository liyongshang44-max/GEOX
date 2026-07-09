<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-PERSISTENCE.md -->
# MCFT-CAP-01 S3A A0 Persistence Foundation

```text
delivery_slice_id: MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1
primary_owner_work_package_id: MCFT-03
status: COMPLETE
depends_on: MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1
claim: NO_A0_RUNTIME_EXECUTION
```

Canonical history remains the existing append-only `facts` table. All new tables are operational guards or rebuildable projections. No second canonical State store is introduced.

Lease expiry authority is PostgreSQL `transaction_timestamp()`. Lease audit timestamps and fencing tokens are operational coordination fields and never participate in object identity or semantic hashes.

The repository order is fixed:

```text
verify aggregate hashes
lookup idempotency record
return complete existing set on same key/hash
reject key/hash conflict
for a new key only: lock lease and verify owner/expiry/fence
verify canonical INITIAL uniqueness
verify expected-null pointers
append nine facts
write projections/pointers
insert idempotency guard
commit
```

Controlled failure checks are exposed at every append, projection, pointer, idempotency, and pre-commit stage. Any triggered failure rolls back the entire SQL transaction.
