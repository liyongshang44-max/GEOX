<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-CONTRACTS-CONFIG.md -->
# MCFT-CAP-01 S2 A0 Contracts and Runtime Config

```text
delivery_slice_id: MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1
primary_owner_work_package_id: MCFT-02
status: COMPLETE
depends_on: MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1
claim: NO_CANONICAL_WRITE
```

The production canonicalization utility rejects undefined and non-finite values, sorts object keys, preserves array order, normalizes negative zero, uses UTF-8 JSON, and applies explicit decimal half-away-from-zero rounding before semantic hashing.

Hash exclusions are explicit:

```text
source-record hash excludes source_record_hash and materialized location
member hash excludes determinism_hash, fact_id, created_at and persisted_at
aggregate hash excludes a0_record_set_determinism_hash
```

A0 cyclic references use a two-phase identity. The aggregate seed derives the record-set ID and idempotency key. Member object IDs are then derived from record-set ID, object type, and schema version. Final member hashes include those IDs and all final semantic references. The aggregate hash sorts `(object_type, object_id, member_determinism_hash)` tuples.

Runtime Config compilation consumes parsed MCFT-00 authority objects and validates the final binding, source-matrix, configuration-matrix, and geometry hashes. It does not read files or persist anything. The caller supplies `created_at`; audit time is excluded from semantic identity.

Completion evidence is recorded in `GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json`. Completion establishes contracts and deterministic config compilation only; it does not establish a canonical State write.
