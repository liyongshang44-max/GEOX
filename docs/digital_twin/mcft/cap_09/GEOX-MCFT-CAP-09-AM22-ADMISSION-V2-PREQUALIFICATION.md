# Amendment-22 admission V2 engineering prequalification

This successor is rebuilt on protected main `1ffec9696db3eb598a36f0d2e1b7b9839363c320` after the qualified retirement-only change in #3669 merged. It does not change any original V1 runtime, provider, schema, ACL, manifest, arm or A0 launcher. It does not make the Amendment-22 design proposal in #3668 production-effective.

## Implemented

The V2 clock selects the earliest UTC hour after a separately qualified complete pre-A0 preparation budget. It preserves A0 + 1h = O00 and O00 + 23h = O23, uses independent lifecycle authority, requires currently effective R5/R6 LATE/Kc=0.6 scope authority through O23, and rejects future graduation or enlarged stage validity. Neither the old 36-hour lead nor O00-minus-12h deadline is used in this V2 contract. It never chooses a date to preserve the retired ARM.

The preparation contract distinguishes measured elapsed time from an independently qualified timeout. It requires all six ordered preparation phases and an explicit safety margin. The existing V13 per-base forcing acquisition envelope is not a complete preparation envelope. Unit fixtures do not constitute real preparation measurements.

A separate V2 Evidence handoff parser and owner entry reuse the existing Evidence producer, owner leases and fencing. They accept the V2 measured-time contract. The checked-in policy blocks the entry before pool creation, lease acquisition or provider requests. The current V1 Evidence and Twin processes are unchanged.

The read-only candidate verifier binds envelope, measurement trace, qualification and stage bytes; reads the original full host retirement receipt and verifies the original archived ARM bytes. It rejects the known retired identity independently of the existence of its marker. A candidate has no ARM, A0 or O00 authority, and `--execute` is always rejected. The console retirement summary is not used to reconstruct a full receipt.

## Qualification still required

- Adopt Amendment-22 through the protected governance chain. This disabled-component successor now has its own exact-path QCP registration and bounded R6/G12/G13 continuity check; it does not use the retirement-only exception for new runtime paths. Passing these checks qualifies only inactive components, not a new production startup policy.
- Obtain a real complete pre-A0 preparation trace, independently qualify its timeout and bind the resulting artifacts to exact main/image/host/profile. No such measurement is currently available to this change.
- Wire the V2 owner cutover, fresh H5, schema/ACL/pristine proof, causal seed visibility, ARM issuance, promotion and fresh A0 prewrite checks; prove them with isolated PostgreSQL A0→O00. The candidate verifier is not a production orchestrator.
- Obtain fresh current-crop authority covering the selected A0 through O23. The adopted 2026-10-08T04Z authority expires at 2026-10-09T10Z; an A0 selected tonight cannot fit a full 24T inside that validity. No future snapshot is assumed present and no validity is extended.
- Qualify continuous production after O23 separately. The existing G12/G13 completion gates remain intact.

## Evidence limits

Local prequalification: clock 18 cases; V2 handoff 14 cases; candidate artifact binding 7 cases; server typecheck. These are deterministic unit tests, not fresh host H5, actual preparation timing, live DB permission verification, or PostgreSQL A0→O00 execution.

The policy remains PREQUALIFICATION_ONLY_NOT_EFFECTIVE. Every production/ARM/A0/completion authority flag remains false. No host command to stop services, alter databases or launch A0 is part of this change.
