# GEOX MCFT-CAP-09 Amendment-19 — Provider / Runtime Cadence Decoupling Authority

Status: **CANDIDATE — EFFECTIVE ONLY AFTER EXACT-HEAD QUALIFICATION AND PROTECTED-MAIN MERGE**

## 1. Problem being corrected

KBS Raw Hourly has an hourly observation resolution but a daily-batch publication cadence. Amendment-11 correctly replaced fixed freshness/lag authority with `PROVIDER_AVAILABILITY_WATERMARK_V1`, but the later Formal runner wiring still made the delayed exact-T rainfall / historical-ET0 pair a pre-claim scheduler readiness condition.

That operational binding has an unintended consequence: the hourly Shadow-online Runtime waits for a provider that is known to publish roughly one daily batch. In the worst case, proving twenty-four hourly Runtime slots becomes a multi-day or multi-week exercise even though the Runtime scheduler itself is healthy.

This amendment corrects only that binding.

## 2. Authority split

The following clocks are independent authorities:

```text
Runtime execution clock:
  actual UTC PT1H scheduler boundaries

External Evidence admission clock:
  provider availability watermark / real first-seen chronology

KBS observation identity:
  exact hourly interval identity

KBS publication cadence:
  DAILY_BATCH
```

Normative rule:

```text
provider_watermark_controls_evidence_admission = true
provider_watermark_controls_runtime_scheduler_eligibility = false
runtime_tick_waits_for_delayed_exact_kbs_pair = false
```

`PROVIDER_AVAILABILITY_WATERMARK_V1` remains the authority for admitting delayed exact KBS Evidence. It is not a scheduler clock.

## 3. Current-interval State forcing authority

At logical tick `T`, State propagation covers the exact interval `(T-1h, T]`.

The External Formal adapter must resolve exactly one coherent current-interval forcing mode before canonical State propagation.

Normative mode enum:

```text
current_interval_forcing_mode =
  EXACT_PROVIDER_INTERVAL_PAIR
  | PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
```

### Mode A — exact provider interval pair

Use the exact KBS rainfall + historical ET0 pair only when both records:

- have exact interval `(T-1h, T]`;
- satisfy their frozen binding and epistemic classes;
- satisfy quality policy;
- are actually available and ingested by the caller-supplied scheduler snapshot;
- do not conflict or require interpolation, fill, timestamp relabel, or source substitution.

Mode A is observational/estimated process forcing and does not degrade Runtime solely because of cadence.

### Mode B — prior-step causal assumption pair

If Mode A is not available at the scheduler boundary, Runtime does **not** wait.

Instead, it may consume one coherent GFS future-weather + future-ET0 assumption pair that was already available and ingested no later than `T-1h`, whose frozen 72-point window starts at `T-1h`, and whose horizon-1 point covers exactly `(T-1h, T]`.

The pair remains epistemically:

```text
precipitation = ASSUMED
reference ET0 = ASSUMED
```

It must never be relabeled as:

```text
RAINFALL_OBSERVATION
HISTORICAL_ET0_INPUT
KBS exact-T Evidence
```

Mode B is an explicit process-forcing fallback, not source substitution inside KBS Evidence authority. A tick using Mode B must surface degraded Runtime provenance/health for missing current exact provider forcing while still allowing State/checkpoint continuity.

If neither Mode A nor Mode B is available, the tick fails/blocks explicitly. Waiting for a future KBS batch is not an authorized third mode.

## 4. O00 warm start

A fresh Formal epoch has no previous successful hourly Runtime tick. Therefore O00 cannot depend on a previous canonical Forecast existing.

Before A0 / O00 activation, the prewindow causal capture must freeze one complete GFS + future-ET0 assumption pair whose:

```text
valid_from = A0
available_to_runtime_at <= A0
ingested_at <= A0
point H1 interval = (A0, O00]
```

This is the O00 warm-start process-forcing authority. It is the same already-qualified GFS/future-ET0 source family, not a new provider and not synthetic Replay data.

For O01 and later, the preceding hourly preboundary forcing capture naturally provides a causal pair whose window covers the next interval. A prior canonical Forecast may reference the same assumptions, but Forecast success is not required to establish the assumption pair's source identity.

## 5. Delayed exact KBS arrival

When the daily KBS batch later makes an exact historical interval available:

```text
raw retention first
→ decode/canonicalize with real provider chronology
→ append exact-T Evidence
→ residual / verification / later correction pathways as authorized
```

The already-terminal historical Runtime tick is immutable:

```text
completed_tick_retroactive_rewrite = false
late_exact_t_handling = APPEND_FORWARD
```

Late exact-T Evidence does not rewrite `event_time`, does not pretend it existed at the old scheduler boundary, and does not mutate the past State/checkpoint graph in place.

## 6. Formal and engineering lanes

### Engineering qualification lane

An accelerated 24-tick engineering proof is authorized to exercise this selector, scheduler/canonical wiring, persistence, restart, degradation, and late-arrival behavior without waiting twenty-four wall-clock hours.

It must carry the hard nonclaim:

```text
NOT_STAGE_1B_FORMAL_CLOSURE
NOT_FORMAL_O00_O23_EFFECTIVENESS
```

### Final Formal lane

The final MCFT-CAP-09 Stage 1B closure still requires one real wall-clock O00–O23 run across twenty-four actual UTC hourly scheduler boundaries. No accelerated or Replay clock is authorized for that final claim.

The efficiency change is therefore:

```text
iterate quickly in accelerated engineering qualification
→ run one final real 24h Formal window after engineering is green
```

not:

```text
replace the final 24h Formal with replay
```

## 7. Amendment-11 rules retained unchanged

This amendment does not weaken:

```text
same-source exact-T identity for KBS delayed Evidence
exact interval_start / interval_end
real provider availability chronology
real retrieved_at / available_to_runtime_at / ingested_at
raw-retention-before-canonicalization
quality gating
conflict fail-closed
no future leakage
no interpolation
no persistence fill
no timestamp relabel
no source substitution within KBS exact-Evidence authority
HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS = 6 remains diagnostic only
```

It also does not revive the superseded fixed-lag rules:

```text
scheduler_eligibility_lag_hours = 7
T+06:30 late collector authority
T+07:12 exact evidence cutoff authority
T+07:17 runtime observer authority
```

## 8. Current implementation frontier

This amendment's first implementation unit is a pure current-interval forcing selector and accelerated 24-tick engineering proof.

It does **not** by itself switch the production Formal runner. Production effectiveness additionally requires:

1. database source loading that permits delayed exact KBS families to be absent at boundary without weakening the other causal families;
2. External Formal current-interval State source construction that records Mode A vs Mode B honestly;
3. persistent tick/runner wiring that terminalizes the hourly slot instead of pre-claim waiting;
4. explicit degraded Runtime health/provenance for Mode B;
5. late exact-T append-forward verification with no retroactive State rewrite;
6. exact-head focused qualification and repository-wide CI.

Until that implementation is effective, no new Formal epoch may be selected under Amendment-19.

## 9. Hard nonclaims

```text
NO_NEW_FORMAL_EPOCH_SELECTED
NO_A0_STARTED
NO_RUNTIME_CONFIG_CHAIN_STARTED
NO_FORMAL_RUNNER_CUTOVER_BY_THIS_DOCUMENT_ALONE
NO_FORMAL_O00_STARTED
NO_ACCELERATED_CLOCK_AS_FORMAL_AUTHORITY
NO_KBS_OBSERVATION_RELABEL_AS_ASSUMPTION
NO_ASSUMPTION_RELABEL_AS_KBS_OBSERVATION
NO_RETROACTIVE_TICK_REWRITE
NO_SOURCE_SUBSTITUTION_INSIDE_KBS_EXACT_EVIDENCE_AUTHORITY
NO_INTERPOLATION
NO_PERSISTENCE_FILL
NO_MCFT_CAP09_COMPLETION
```
