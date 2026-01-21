# Agronomy Layer v0 · Admission Freeze

Status: **FROZEN**

Scope: GEOX / Apple stack (Apple I / Apple II / Apple III)

Effective after: **Apple III Sprint 5 acceptance PASS**

Change rule: v0 is immutable. Any evolution must be published as v1+ (new file / new contract), never by retro-editing v0.

---

## 1) One-line definition

The Agronomy Layer is a recommendation-producing subsystem that reads audited evidence (facts and read-only projections) and emits agronomy advisory artifacts, while remaining incapable of changing evidence, changing control flow, or asserting truth.

## 2) Non-goals (v0)

1. No agronomy outputs may be treated as facts, measurements, or diagnoses.
2. No agronomy outputs may trigger device actions, scheduling, or automatic control.
3. No agronomy outputs may mutate Apple I / Apple II / Apple III behavior, config, or rules.
4. No agronomy outputs may be written into `raw_samples` or `markers` as a substitute for real-world evidence.

## 3) Admission criteria (when we can start Agronomy work)

Agronomy work is admitted only after all conditions below are true and demonstrable by third-party reproduction.

A. Ledger stability
- Apple I ingest is stable for at least one representative dataset (CAF009/CAF010) and produces append-only `facts` and `raw_samples`.
- Apple II Judge acceptance is frozen and tagged: `apple_i_judge_acceptance_v1`.
- Apple III control loop acceptance is passing (Sprint 1–5) and can be reproduced from a clean database.

B. Control boundary is closed
- All control intent remains expressed only as Apple III Tasks/Receipts and executor-side markers.
- Judge is treated as a frozen dependency: no UI-driven config patches, no semantics drift.

C. Language redlines are enforceable
- The repository contains and enforces the “Language Redlines” policy (Apple I freeze).
- Any new text emitted by Agronomy must be bounded by an allowlist (see Section 6).

If any of A/B/C regresses, Agronomy work is paused and cannot be used for decisions.

## 4) Inputs and outputs (v0 interface)

Inputs (read-only):
- `facts` ledger (including `raw_sample_v1`, `marker_v1`, `ao_sense_task_v1`, `ao_sense_receipt_v1`).
- Read-only projections that are explicitly declared as projections (e.g., `raw_samples`, `markers`, Apple III readonly views).
- A frozen query window anchored by `{projectId, groupId, startTs, endTs}`.

Outputs (not control, not facts):
- Agronomy advisory artifacts are produced as external files (reports) or API responses that are explicitly labeled as “advisory”.
- v0 outputs must be non-binding and must not be written into `facts`.

Rationale: keeping agronomy outputs out of the ledger prevents future misinterpretation as evidence.

## 5) What “value judgment” means in GEOX terms

Within GEOX, “value judgment” is any statement that:
- asserts a preferred action (should / must / recommend doing X),
- asserts a diagnosis (disease / deficiency / irrigation failure),
- asserts a plan (apply fertilizer, pesticide, irrigation setpoints),
- assigns blame, responsibility, or compliance.

Agronomy v0 must not output any of the above in normative form. It may only output:
- observed patterns (“trend up/down”, “variance increased”),
- uncertainty (“insufficient evidence”, “conflict”),
- requests for additional observation framed as AO-SENSE-compatible tasks (but not issuing tasks).

## 6) Allowed output language (v0 allowlist)

Agronomy v0 text is limited to the following categories:
1. Observation summary: neutral descriptions tied to concrete evidence windows.
2. Data quality / coverage notes: gaps, conflicts, QC flags, and their direct implications on uncertainty.
3. Hypothesis list: multiple candidates with explicit uncertainty; no single conclusion.
4. Next-observation suggestions: expressed only as “possible next observation” and mapped to AO-SENSE fields (`sense_kind`, `sense_focus`, `priority`).

Forbidden words (non-exhaustive): treat, apply, irrigate now, fertilize, pesticide, disease, deficiency confirmed, must, should.

## 7) Minimal deliverable (Agronomy v0)

A. A report generator (script) that:
- accepts `{projectId, groupId, startTs, endTs}`
- reads evidence through existing read-only APIs
- outputs a JSON+Markdown report
- includes a strict section for uncertainty and evidence references

B. Acceptance:
- runs on the same dataset and window as Judge/Apple III acceptance
- produces deterministic report hashes for the same input
- proves it does not write to the database (no new rows in `facts`)

## 8) When to introduce “real agronomy” and “value judgment” (post-v0)

This project can introduce normative agronomy only after:
1. A dedicated contract is published (v1+) for advisory artifacts, with explicit non-binding semantics.
2. A governance process exists for agronomy rule changes (versioning, review, rollback).
3. A user-facing boundary exists that cannot be confused with evidence (UI labeling, audit trail, provenance).

Until then, the system remains strictly evidentiary and orchestration-only.
