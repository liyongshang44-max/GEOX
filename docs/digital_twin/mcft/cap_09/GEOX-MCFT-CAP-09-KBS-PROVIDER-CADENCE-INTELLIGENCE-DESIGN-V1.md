# GEOX MCFT-CAP-09 KBS Provider Cadence Intelligence Design V1

Status: Draft design
Authority effect: false

## Purpose

Add provider temporal behavior intelligence without weakening EA5E2 freshness authority.

## Two-layer freshness model

### Layer 1 — Current-read authority

Production EA5E2 authority remains:

```
KBS Raw Hourly age <= 6h
```

This remains the only PASS condition for formal activation.

### Layer 2 — Provider cadence intelligence

A diagnostic model estimates whether a stale observation is consistent with known provider publication behavior.

The model consumes metadata-only observer evidence:

- publication transitions;
- observed update intervals;
- first-seen timing;
- delay distribution.

No raw values are retained.

## Decision model

```text
if age <= 6h:
    PASS
else if cadence model indicates expected provider delay:
    DEFER
else:
    FAIL
```

DEFER is not activation approval. It only prevents wasting a long live qualification window when provider recovery is plausible.

## Initial outputs

```json
{
  "provider": "KBS_RAW_HOURLY",
  "decision": "PASS|DEFER|FAIL",
  "authority_effect": false,
  "sample_count": 0,
  "median_publish_interval_hours": null,
  "p95_publish_delay_hours": null,
  "confidence": "insufficient"
}
```

## Required next implementation steps

1. Add metadata-only Raw Hourly cadence parser.
2. Add deterministic selftests for PASS/DEFER/FAIL classification.
3. Connect cadence diagnostics to EA5E2 viability preflight.
4. Keep existing <=6h authority unchanged.
