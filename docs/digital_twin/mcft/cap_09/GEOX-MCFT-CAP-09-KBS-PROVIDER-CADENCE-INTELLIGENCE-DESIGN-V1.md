# GEOX MCFT-CAP-09 KBS Provider Cadence Intelligence Design V1

Status: Draft implementation design
Authority effect: false

## Purpose

Add provider temporal behavior intelligence and a fast non-authoritative engineering validation path without weakening EA5E2 production freshness authority.

## Two-layer freshness model

### Layer 1 — Current-read authority

Production EA5E2 authority remains:

```
KBS Raw Hourly age <= 6h
```

This remains the only Raw Hourly freshness PASS condition for operational activation/effectiveness. No cadence inference and no engineering override can convert `age > 6h` into a production-authority PASS.

### Layer 2 — Provider cadence intelligence

A scheduler/readiness model classifies stale provider state from metadata-only protected-main observer evidence.

Inputs include:

- publication transitions;
- observed publication intervals once enough transitions exist;
- latest-event advance shape;
- candidate provider publication class.

No raw weather values are retained by cadence intelligence.

Decision model:

```text
if age <= 6h:
    PASS
else if cadence evidence is insufficient:
    DEFER
else if observed provider behavior supports a batch/bursty delay:
    DEFER
else if an established hourly cadence is unexpectedly stale:
    FAIL
else:
    DEFER
```

`DEFER` is not activation approval. It prevents an expensive live qualification from being spent while provider temporal readiness is unproven or temporarily incompatible.

The provider publication class remains diagnostic until the separately frozen cadence-classification evidence threshold is satisfied. This design does not lower that threshold.

## Fast engineering validation window

To avoid coupling engineering feedback speed to the production 6h gate, an explicit non-authoritative mode is allowed:

```text
qualification_mode = ENGINEERING_VALIDATION
KBS Raw Hourly age <= 24h
```

The 24h limit is an engineering test-window boundary only. It is not provider/agronomic authority and must never be used to claim EA5E2 operational activation effectiveness.

Engineering validation may:

- verify HTTPS/source identity and CSV schema;
- verify the same recent-data coverage semantics already used by EA4 (>=24 numeric rain hours and >=24 complete ET0-input hours inside the recent 36h support window);
- execute rainfall decode and ASCE hourly reference-ET0 computation on a recent complete exact-hour KBS row;
- emit metadata, counts, timestamps and hashes.

Engineering validation must not:

- change the production `<=6h` authority;
- authorize EA5E3;
- start a Formal window;
- create Formal DB writes;
- create canonical writes;
- retain provider raw bodies as public artifacts;
- emit raw or decoded weather values publicly;
- relabel a historical KBS row as a current production target.

All engineering proofs must carry at least:

```json
{
  "qualification_mode": "ENGINEERING_VALIDATION",
  "production_authority_pass": false,
  "engineering_max_age_hours": 24,
  "authority_effect": false,
  "formal_effect": false,
  "ea5e3_authorized": false,
  "formal_window_started": false
}
```

## Current implementation components

- `MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs` — pure PASS/DEFER/FAIL decision SSOT and deterministic selftests.
- `OBSERVE_MCFT_CAP_09_KBS_CURRENT_FRESHNESS_METADATA.py` — metadata-only current Raw Hourly age probe.
- `PREFLIGHT_MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE.cjs` — combines current freshness with latest successful protected-main cadence state.
- `VALIDATE_MCFT_CAP_09_KBS_ENGINEERING_WINDOW.py` — 24h engineering window and EA4-aligned 36h coverage validation.
- `EXECUTE_MCFT_CAP_09_KBS_ENGINEERING_VALUE_PATH.py` — non-authoritative recent complete-hour rainfall/ET0 value execution; emits hash/metadata only.
- `.github/workflows/mcft-cap-09-kbs-provider-cadence-intelligence.yml` — standalone fast proof before any integration into expensive EA5E2 live activation.

## Integration rule

Production EA5E2 live remains fail-closed on `age > 6h`. Cadence intelligence is used to distinguish `DEFER` from genuine unexpected-provider `FAIL` before spending a live window. The 24h engineering path remains separate from production activation and is only for rapid KBS data/value-path verification.
