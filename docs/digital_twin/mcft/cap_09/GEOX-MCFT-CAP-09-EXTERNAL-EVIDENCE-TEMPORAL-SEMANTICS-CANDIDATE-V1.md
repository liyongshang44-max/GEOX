# GEOX MCFT-CAP-09 — External Evidence Temporal Semantics Candidate V1

Status: **NON-EFFECTIVE CANDIDATE**. This document is design and deterministic qualification material only. It does not modify protected-main authority, production Runtime behavior, Formal eligibility, provider freshness thresholds, scheduler timing, database schemas, or canonical persistence.

Base protected main at candidate start:

```text
0da26233e8787f6e014e21f701e3837506ba6c15
```

## 1. Problem being modeled

The current External Formal path already distinguishes role event time, `ingested_at`, and `available_to_runtime_at`. Amendment-07 additionally authorizes a fixed-lag External Formal cutoff for exact-hour KBS rainfall / historical ET0 while preserving their original logical event time.

What remains unresolved is a separate real-world question:

```text
When did the provider actually make a historical observation retrievable?
```

A source may truthfully contain an hourly event timestamp while publishing that row hours later, in bursts, or after a provider-side revision. A freshness-only model cannot represent that distinction without conflating:

```text
when the world event happened
with
when the source published it
with
when GEOX ingested it
with
when Runtime was authorized to know it
```

This candidate makes those axes explicit without granting any new operational authority.

## 2. Four-clock model

### E — event time

`E` is the role-specific real-world event or interval time already carried by canonical Evidence.

Examples:

```text
soil_moisture_observation_v1 -> observed_at
observed_rainfall_v1         -> interval_end
historical_et0_estimate_v1   -> interval_end
future_weather_assumption_v1 -> issued_at
future_et0_assumption_v1     -> issued_at
```

Rules:

```text
E is never shifted to publication time.
E is never shifted to ingestion time.
E is never relabeled to rescue a scheduler slot.
```

### A — source availability time

`A` is the time the provider first made one exact version of one source record publicly retrievable.

This is a new provider-side concept. It is **not** the existing `available_to_runtime_at` field.

Two evidence modes are allowed by the candidate:

```text
EXACT_PROVIDER_TIMESTAMP
OBSERVED_BRACKET
```

If the provider publishes a trustworthy publication timestamp, it may be used as exact `A` only when it is consistent with independent observation evidence.

Otherwise GEOX must represent availability as an interval:

```text
last_not_seen_at < A <= first_seen_at
```

A polling observation does not justify claiming that `A == first_seen_at`; it only supplies an upper bound.

### I — ingestion time

`I` is the actual canonical ingress time already represented by `role_time.ingested_at`.

Rules:

```text
I must not be backdated.
first_seen_at <= I
```

### K — Runtime knowledge time

`K` is the earliest time Runtime is authorized to treat a canonical record as known. It continues to use the existing `available_to_runtime_at` field.

Rules:

```text
I <= K
K may equal I
K may be later than I because of a governance / validation hold
```

Therefore the candidate model is:

```text
E <= A <= first_seen <= I <= K
```

when exact `A` exists, or otherwise:

```text
E <= A_upper
last_not_seen < A <= first_seen <= I <= K
```

No precise `A` is invented when only a polling bracket exists.

## 3. Relationship to Amendment-07

Amendment-07 remains unchanged.

For External Formal exact-hour rainfall and historical ET0 at logical slot `T`:

```text
E = T
K <= T + 07:12
Runtime observer nominal = T + 07:17
```

is still the current Formal slot eligibility rule.

This candidate introduces no rule that allows evidence with:

```text
K > T + 07:12
```

to retroactively satisfy or rescue that original Formal slot.

The new model instead distinguishes two questions:

```text
Was the record eligible for the original slot under current authority?

and

Did the record later become legitimate historical Evidence that may justify a new revision lineage under separate future authority?
```

Those are different lifecycle decisions.

## 4. Delayed Evidence

A record is a delayed-assimilation candidate when materially new, trustworthy Evidence becomes known after the causal cutoff of the first logical tick whose evidence window it would affect.

Conceptually:

```text
K > causal_cutoff(first_affected_tick)
```

The first affected tick must be derived from the role-specific Evidence Window contract. The candidate deliberately does not define a global `ceil(E)` shortcut because interval-end observations, instantaneous observations, actions, and future forcing have different semantics.

Examples covered by the deterministic fixtures:

```text
hourly low latency
hourly fixed latency within an authorized cutoff
6–12h delayed hourly publication
daily/batch publication
out-of-order arrival
provider revision
duplicate delivery
missing-interval backfill
```

## 5. Duplicate versus provider revision

The candidate distinguishes delivery duplication from source correction.

### Idempotent duplicate

```text
same source_record_ref
same content hash
```

or an equivalent semantic identity with the same payload hash produces:

```text
NO NEW REVISION
NO REPLAY
```

### Unproven conflict

Same semantic source/event identity with different payload and no explicit provider revision evidence produces:

```text
FAIL CLOSED
```

### Proven provider revision

A changed payload may be treated as a provider revision candidate only when the later record explicitly carries both:

```text
supersedes_source_record_ref
provider_revision_id
```

The old canonical Evidence is never rewritten or deleted. The revised source version is appended as a new Evidence record and may become an input to a later revision lineage if future authority permits it.

## 6. Delayed assimilation and existing revision architecture

The candidate does not introduce a second revision mechanism.

DT-02 Amendment-01 already freezes:

```text
E_REVISION_LINEAGE_STEP_COMMIT

E1_DECLARE_REVISION
E2_APPEND_REVISION_STATUS
E3_PROMOTE_LINEAGE
```

The candidate reuses that lifecycle:

```text
late/revised Evidence detected
-> freeze Evidence versions + K
-> declare revision run and candidate lineage
-> identify earliest affected logical tick
-> load immutable checkpoint strictly before that tick
-> recompute candidate history through the source-lineage committed head
-> validate candidate lineage
-> promote only under separate authority
```

No canonical history is modified in place.

## 7. Replay bounds

This candidate freezes the replay-start rule but deliberately does not invent a numeric maximum replay horizon.

Replay start:

```text
latest immutable checkpoint strictly before earliest affected logical tick
```

Replay end:

```text
source lineage committed head at revision declaration
```

The candidate must fail closed if either:

```text
required predecessor checkpoint is unavailable
or
future effective authority defines a maximum replay span and the candidate exceeds it
```

A numeric replay limit requires separate architecture authority.

## 8. Bitemporal consequence

After a delayed-assimilation revision, two different historical statements may both remain true:

```text
What GEOX concluded at logical time T using only Evidence known by K_old

and

What a later revision lineage concludes for logical time T after new Evidence became known at K_new
```

Therefore corrected history must not erase historical knowledge state.

A future read model should be able to distinguish:

```text
event-time / logical-time axis
knowledge-time / as-known-at axis
lineage / revision axis
```

This candidate does not alter public Runtime APIs; it only records the required semantic direction.

## 9. Publication cadence classification

The deterministic harness recognizes candidate publication patterns:

```text
HOURLY_LOW_LATENCY
HOURLY_FIXED_LATENCY
HOURLY_DELAYED_HIGH_LATENCY
HOURLY_EVENTS_VARIABLE_PUBLICATION
BATCHED_PUBLICATION
IRREGULAR_EVENT_CADENCE
INSUFFICIENT_SAMPLES
```

This classifier is intentionally conservative. It does **not** claim that current KBS behavior is daily batch. Real KBS cadence remains an external observation question and is adjudicated only from the cadence watcher evidence.

A batch pattern requires multiple distinct hourly event timestamps to become first-observed together or in a publication burst. One stale snapshot alone is insufficient.

## 10. Why this is not a freshness-threshold amendment

This candidate does not argue for changing:

```text
KBS latest age <= 6h
```

The 6h rule remains current activation authority.

The new temporal model solves a different problem. If future evidence shows that the provider's publication process is naturally delayed or batched, then increasing freshness from 6h to 7h, 14h, or another constant would only hide source latency inside a larger scalar threshold.

The architecture-level alternative is to model latency explicitly:

```text
E != A != I
```

while preserving causal Runtime knowledge through `K`.

## 11. Non-effective acceptance boundary

The candidate qualification is deterministic and read-only.

It may prove:

```text
clock-order invariants
audit-safe availability brackets
no invented exact A
cutoff-aware delayed detection
batch coalescing
out-of-order handling
provider revision proof requirements
duplicate idempotency
earliest replay-start selection
reuse of E_REVISION_LINEAGE_STEP_COMMIT
zero historical mutation
zero retroactive Formal rescue
```

It may not:

```text
change production Runtime files
change PostgreSQL schema
write Formal DB
write Formal raw objects
write scheduler state
write canonical Runtime objects
declare a real revision run
promote a lineage
change KBS freshness authority
change Amendment-07 cutoff
qualify EA5E2 operational activation
start Formal O00
claim MCFT-CAP-09 completion
```

## 12. Activation condition for a future amendment

A future effective amendment should be considered only if real provider evidence shows that the current freshness/fixed-lag model is structurally insufficient, for example:

```text
stable publication latency beyond the current causal cutoff
or
repeated multi-hour publication batches
or
source revisions/backfills that must be represented without rewriting history
```

Until such evidence exists, this candidate remains dormant design and acceptance material.
