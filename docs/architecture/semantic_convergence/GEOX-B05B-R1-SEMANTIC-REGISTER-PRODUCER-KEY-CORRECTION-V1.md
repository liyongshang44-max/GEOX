# GEOX B-05b-r1 Semantic Register Producer-Key Correction V1

## 0. Status

Bounded B-Line governance correction stacked on rejected B-05b completion head:

`669805d13b0dc22de0698299fdbb600cbf9cf8dc`

The earlier B-05b completion adjudication is withdrawn until this correction is qualified.

## 1. Defect

B-05b added:

`field-program-context-compatibility-projector`

to a stray semantic-entry key:

`producers`

instead of the canonical B-02 register key:

`registered_producers`.

The B-02 static path guard still passed because it is a separate mechanism. Therefore the defect did not affect the pure projector behavior, but it did leave semantic ownership registration malformed.

## 2. Correction

This correction:

- moves the projector entry into `context.declared_identity.registered_producers`;
- removes the stray `producers` key;
- leaves the existing `G-B02-11-canonical-context-instantiation` path registration intact;
- changes no runtime code.

## 3. Additional qualification invariant

B-05b-r1 exact-head validation must explicitly assert:

```text
for every semantic entry:
  no top-level "producers" key
```

This protects against the exact drift class that escaped the existing linter.

## 4. Non-effects

No route, job, rule engine, stage resolver, Decision Engine, MCFT implementation, schema, provider, scheduler, Formal, Twin persistence, CandidateDecision, Decision Eligibility, approval, AO-ACT, task, receipt, or acceptance behavior changes.
