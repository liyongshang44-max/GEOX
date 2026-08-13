# GEOX MCFT-CAP-09 — Rolling KBS Intersection Delivery V1

Status: **DELIVERY / NON-AUTHORITY**

This document records the protected-main delivery boundary for the Amendment-11 rolling KBS daily-batch intersection layer.

The implementation:

- discovers recent successful rolling pre-boundary candidate artifacts;
- binds each candidate to producer workflow-run, head-SHA and artifact provenance;
- fetches one current KBS Raw Hourly daily batch;
- requires exact target timestamp presence, uniqueness and completeness;
- selects the oldest exact candidate first;
- treats `<=6h` freshness only as a diagnostic;
- returns `WAITING_FOR_DAILY_BATCH_INTERSECTION` without failure when no retained candidate target is present in the current batch;
- emits metadata-only qualification output with no KBS weather values.

This delivery does **not** change Amendment-11 or any provider, crop, scheduler, Runtime or Formal authority. It performs zero database writes, zero R2 writes/deletes, zero Runtime writes, zero scheduler writes and has `crop_authority_effect = NONE`.

The first frozen rolling causal candidate remains the protected-main capture for target `2026-08-13T15:00:00.000Z`, producer subject `37a36ba52d7ef7891d72cc1385314ec453511296`, run `31705733712`, artifact `9185700449`.

An exact KBS intersection is not claimed by this document. That claim may be made only by a successful protected-main live-intersection proof that actually observes the target timestamp in a KBS daily batch.
