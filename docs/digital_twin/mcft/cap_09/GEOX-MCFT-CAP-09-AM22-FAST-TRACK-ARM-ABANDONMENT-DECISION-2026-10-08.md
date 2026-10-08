# MCFT CAP-09 — Operator-Directed Fast-Track Decision (2026-10-08)

**Decision recorded: abandon preservation of the previously scheduled Formal-v5 arm as a project objective, and prioritize the earliest governed continuous field-state operation with a 24T qualification window drawn from real execution.**

**This document records the operator's instruction. It is not a host-side retirement receipt, not a retroactive arm rewrite, not an authorization to bypass producer/authority causality, and not an A0 execution proof.**

## 1. Operator intent

> 尽早启动 MCFT，持续获取真实数据，并从运行结果中完成 24T 资格验收。旧 ARM 对系统本身没有价值；时间更宝贵。

The frozen subject in the existing arm is `a60aa6858662ce87b989ff752c50969f21ad4619`, with historical arm identity `sha256:8826cccdbb9aebd8c5e563119fdd3f52772f77cd9d12c718270655c3f03e940f`. Its previous planned A0/O00/O23 were 2026-10-10 05:00Z / 06:00Z through 2026-10-11 05:00Z. These times are **not** to be carried into a successor arm.

**Decision:** do not optimize for keeping or executing that previously scheduled epoch. No sunk-cost value is assigned to the old arm. The new start-admission contract is the preferred path even if it invalidates the old arm. Preserve only immutable historical artifacts for audit.

## 2. Immediate operational scope and safety

- Keep the currently lawful operational preformal Evidence/Twin processes alive and gathering source evidence. Do **not** stop leases or erase DB to expedite qualification.
- Do not execute the old Formal-v5 A0. Treat it as **OPERATOR NO-GO, HOST RETIREMENT PENDING**.
- Do not claim that old arm is physically or cryptographically retired until the independent local operator/host proof has been captured and verified.
- Do not start a second Formal-v5 Twin owner or forcing writer while a previous owner is live; no double-ownership interval.
- Do not backdate A0, seed synthetic provider evidence, relax CAS/lease/schema/ACL, or treat historical operation as Formal qualified.
- Do not edit an existing signed/hashed arm artifact in place. Formal arm V2 must be newly minted from a newly adopted exact-main policy.
- Current main and the currently live container must stay pinned until an explicitly authorized, tested cutover.

## 3. Fastest legitimate implementation frontier

**P0-A — single clean cancellation receipt:** a host-local, immutable, independently verified old-arm abandonment/retirement receipt, with old arm identity, protected subject, actual database UTC, epoch, exact machine owner/container/image/lease bindings, no prior A0, confirmation no Formal V5 ACTIVE writer and no partial Formal V5 target effect. If any effect already occurred, abort cancellation and adjudicate; do not call the target pristine. Store evidence and pin digest; do not wipe tables.

**P0-B — make evidence-based admission real:** implement versioned selector V2, pre-A0 preparation measurement + safety margin proof, Evidence handoff V2, owner-cutover V2, immutable arm V2, new effective governance contract, and just-in-time A0/viability guards. All these consumers must be qualified on the same exact-main subject. Maintain the existing V1 evidence/arm verifier for historical audit; do not mutate V1.

**P0-C — prove isolated real A0→O00:** real isolated PostgreSQL with exact new evidence/owner/clock chain, negative tests for missing readiness, expired R6, prior A0, duplicate owner, stale image, non-visible forcing, causal deadline failure and clock drift. No mock PASS substitution.

**P0-D — production cutover:** fresh exact-main/current runtime image/H5/schema ACL/role scopes, capture Stage authority physically valid through candidate O23, explicit operator GO, then use the earliest real-UTC future A0 that fits the independently qualified preparation envelope. If any proof is missing, do not start; preserve operational preformal service.

**P1 — continuous operation separate from 24T:** the current Formal-v5 scheduler and final readback are 24-slot bounded. Continuous production beyond O23 needs separately governed successor semantics (incremental slot range, forcing cursors, epoch/authority handoff, terminal readback without requiring process stop). Do not claim P0 replaces P1.

**P1 — customer portal read model:** the Product API is not implicitly connected by starting a Formal DB. Introduce a governed read-only state projection and scope/identity mapping separately; do not directly couple the website to Qualification store.

## 4. Measurable project goals

The first viable achievement is **a legally started Formal-v5 O00 with real, physically visible A0 forcing and durable field state**, without 36-hour waiting and without compromising governance. The next is **24 consecutive, causally qualified terminal ticks** and independent G12/G13 adjudication. The final is **uninterrupted production after the 24T acceptance**, only when separately authorized continuous-run semantics are available.

**No invented deadline.** Speed means eliminating unnecessary waiting, not removing evidence or retroactively authorizing past times.

## 5. Status of the operator decision

- `legacy_arm_preservation_priority = ABANDONED`
- `old_arm_use = OPERATOR_NO_GO`
- `old_arm_host_retirement_receipt = NOT_YET_VERIFIED`
- `AM22_effective_in_production = false`
- `new_A0_authorized = false`
- `main_changed = false`
- `preformal_current_owner_must_remain_safe = true`

This decision belongs to the unmerged Amendment-22 proposal, **not** protected main. It may be implemented after the proper revocation/adoption governance gates; it does not itself waive continuity protections.
