# GEOX B-04d2r1 PostgreSQL Placeholder Correction V1

## Status

Status: **correction candidate**

Rejected prior completion head:

```text
46560a3ab3d551ab316977cce495331740edb735
```

Reason: B-04d2 source/time/scope predicates existed semantically but emitted numeric literals instead of PostgreSQL bind placeholders.

## Defect

Incorrect generated SQL shape:

```sql
project_id = 4
group_id = 5
field_id = 6
updated_ts_ms <= 7
```

and:

```sql
(payload_json ->> 'project_id') = 4
created_at <= to_timestamp(8 / 1000.0)
```

Required shape:

```sql
project_id = $3
group_id = $4
field_id = $5
updated_ts_ms <= $6
```

and:

```sql
(payload_json ->> 'project_id') = $4
(payload_json ->> 'group_id') = $5
(payload_json ->> 'field_id') = $6
sensor_id = $7
created_at <= to_timestamp($8 / 1000.0)
```

## Root cause

The B-04d2 implementation lost the literal PostgreSQL `$` prefix while constructing dynamic SQL placeholders.

The previous unit fixture verified that the predicates and argument order existed, but it did not assert the exact SQL placeholder tokens. Its fake DB therefore did not execute PostgreSQL type checking.

## Correction

B-04d2r1 restores the literal PostgreSQL parameter prefix in the TypeScript template literals and strengthens the fixture to assert the exact rendered bind placeholders and reject the numeric-literal form.

No semantic expansion is authorized by this correction.

## Completion gate

```text
exact PostgreSQL raw-sample placeholder shape        PASS
exact PostgreSQL device-health placeholder shape     PASS
B-04d2 fixtures                                      PASS
B-04d1/B-04c/B-04b/B-04a regressions                PASS
server typecheck                                     PASS
B-02 linter                                          PASS
general CI                                           PASS
MCFT governance/release lanes                        PASS
```

Only a new exact correction head satisfying this gate may replace the rejected B-04d2 completion head.
