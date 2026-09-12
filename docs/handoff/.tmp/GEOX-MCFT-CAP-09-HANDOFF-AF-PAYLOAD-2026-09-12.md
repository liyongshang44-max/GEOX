# AF — 2026-09-12 CTO Gate Refinement / Bounded Run-Proof Materialization Successor / Digest-Stable No-Rerun Path

> 本 section 是 AE 之后的 authoritative continuation，并记录 CTO 对当前 proof-binding successor gate 的最新显式裁决。凡本 section 与 AE 中“successor head 变化后默认重跑 Phase3 / Phase5”的保守路径冲突，以本 AF 为准；AE 及其以下全部历史 section 原样保留，作为当时状态与 RCA 记录，不做回写改写。
>
> 本 section 不授权 Production Runtime、Production Owner cutover、Formal-v5 ARM、#3552 adoption、B-Line reopen 或 ADR construction。

## AF0. CTO 最新裁决：critical path 缩短

CTO 已明确：当前不需要先再跑一轮 `1f970cc...` QCP，也不需要因为 proof-materialization successor 形成新 git head 就机械重跑 Phase3 / Phase5。

当前已经真实成立的 fresh proofs：

```text
#3553 current exact head
= 1f970ccfc908d6ced4d44673d56206cd51087962

Phase3 fresh proof
run = 34666374039
result = SUCCESS

Phase5 accelerated-24T fresh proof
run = 34666374060
result = SUCCESS

generic CI
run = 34666374002
result = SUCCESS
```

当前应直接施工：

```text
ONE bounded run-proof materialization successor
```

而不是：

```text
re-open MinIO RCA
rerun 1f970cc QCP
rerun Phase3 immediately
rerun Phase5 immediately
```

---

## AF1. Successor parent gate：必须 direct-parent 1f970cc

新的 proof-materialization successor commit，记为：

```text
H
```

必须满足：

```text
direct parent(H)
= 1f970ccfc908d6ced4d44673d56206cd51087962
```

如果施工前发现 #3553 branch 已 drift：

```text
current branch head != 1f970cc...
```

则：

```text
STOP / FAIL CLOSED
```

不得在漂移后的 branch 上继续沿用本 AF 的 shortcut gate。

该 direct-parent requirement 是当前 successor proof ancestry 的硬边界，不得通过 merge/rebase/额外中间 commit 模糊化。

---

## AF2. Successor diff gate：只允许 registry proof materialization

H 的 diff 只能包含：

```text
current requalification contract 所要求的
Phase3 / Phase5 successful run-proof registry materialization
```

不得顺手修改：

```text
QCP logic
planner
preflight
MinIO qualification harness
application code
runtime code
current-crop authority
Production Owner
#3552
B-Line
ADR
Formal-v5
```

也不得借 proof materialization 之名：

```text
- 放宽 unknown-path rejection
- 修改 dependency ownership semantics
- 修改 applicability semantics
- 修改 baseline carry-forward policy
- 引入新的 qualification workaround
```

本 successor 是：

```text
proof materialization only
```

不是第二轮 qualification fix PR。

---

## AF3. Successor H 的第一道机器 gate：planner

H 形成后，第一步必须在新 exact head 上运行 planner，并得到：

```text
planner_status = PASS
unknown_changed_paths = 0
authority_errors = 0
```

任一不成立：

```text
STOP
```

不得进入 digest reuse / QCP adjudication。

特别注意：

```text
planner 显示 applicability = REQUALIFY
```

本身不再构成自动重跑 Phase3 / Phase5 的充分条件。

是否需要 fresh exact-head qualification，要继续看 current dependency digest 与 binding checks。

---

## AF4. CTO 明确的 dependency-digest reuse gate

在 successor H 上必须读取 **current dependency digest**。

当前已知、由 #3553 exact head fresh qualification 对应的 digest 为：

```text
Phase3 current dependency digest
= sha256:12853172ba486255d2134537a97ba0d2e8897c5c45511ee3d9553a73ef0554b9

Phase5 accelerated-24T current dependency digest
= sha256:65dee9a9db74e22bbed48ed61490a364c899e4c4a24d029efe445cb59bf95b8b
```

若 H 上 machine-computed current dependency digest 仍分别等于上述两个值：

```text
Phase3 digest unchanged = true
Phase5 digest unchanged = true
```

则即使 planner/applicability 文本仍显示：

```text
REQUALIFY
```

也：

```text
DO NOT rerun Phase3
DO NOT rerun Phase5
```

原因：本 successor 只物化已经真实成功的 run proof；若 owned dependency digest 未发生变化，则 fresh qualification 的被测依赖面没有变化。

这不是 silent carry-forward，也不是把旧任意 proof 提升到新 head；它是由当前 requalification contract + ancestor proof binding + digest identity 共同约束的 machine adjudication 路径。

---

## AF5. QCP 对 ancestor proofs 的预期 adjudication

当以下条件同时成立：

```text
H direct parent = 1f970cc...
planner PASS
unknown_changed_paths = 0
authority_errors = 0
Phase3 dependency digest unchanged
Phase5 dependency digest unchanged
run-proof registry binding materialized correctly
```

则下一步不是重新 qualification，而是：

```text
QCP @ H
→ adjudicate materialized run bindings
→ resolve 1f970cc ancestor proofs
```

QCP 必须对两项分别得到：

```text
Phase3
= exactly one valid evidence

Phase5 accelerated-24T
= exactly one valid evidence
```

并最终达到：

```text
FAIL = 0
blocker_count = 0
```

只有此时才能进入：

```text
exact-head convergence review
→ Ready / merge adjudication
```

---

## AF6. 什么时候才需要 fresh exact-head Phase3 / Phase5

只有以下任一 machine gate 失败，才停止 shortcut path 并转入 fresh exact-head qualification：

```text
1. successor dependency digest changed
2. stage machine check invalid
3. workflow identity machine check invalid
4. base machine check invalid
5. ancestor relation machine check invalid
6. binding machine check invalid
7. planner_status != PASS
8. unknown_changed_paths != 0
9. authority_errors != 0
10. QCP cannot resolve exactly one valid evidence per required stage
```

此时必须：

```text
STOP
→ classify exact failing gate
→ fresh exact-head qualification on H (or corrected successor)
```

不得因为仅看到：

```text
REQUALIFY
```

就机械 rerun。

新的决策式为：

```text
REQUALIFY string
≠ automatic rerun command

dependency digest / stage / workflow / base / ancestor / binding machine checks
= qualification reuse authority
```

---

## AF7. 本 AF 对 AE10 / AE15 的明确覆盖关系

AE10 曾采用更保守的默认：

```text
如果 proof-binding 必须产生新 commit
→ new head
→ 默认 fresh Phase3 / Phase5 rerun
```

CTO 现已重新定义该 gate。

从本 AF 起，正确规则为：

```text
proof-materialization commit produces H
→ first check parent + planner + current dependency digests + binding semantics

IF digests unchanged AND all machine bindings valid
→ reuse 1f970cc ancestor proofs through governed QCP adjudication
→ NO Phase3/Phase5 rerun

ELSE
→ STOP
→ fresh exact-head qualification
```

因此：

```text
AF supersedes conflicting rerun guidance in AE10 / AE15
```

但 AE 的 MinIO RCA、fresh run receipts、#3552 isolation、authority ceilings 与其它不冲突事实继续有效。

---

## AF8. 当前禁止做的无效工作

从现在到 H materialization + digest check 之前，禁止：

```text
- 继续查 MinIO
- 修改 MinIO harness
- rerun 1f970cc QCP
- rerun Phase3 @ 1f970cc
- rerun Phase5 @ 1f970cc
- 修改 planner 让 REQUALIFY 消失
- 修改 QCP 让 blocker 被“忽略”
- 修改 current-crop authority
- 触碰 #3552
- 触碰 Production Owner
- 启动 Production Runtime
- ARM Formal-v5
```

这些动作要么已经被 AE 的 fresh success / RCA 关闭，要么会污染当前 bounded proof-materialization successor。

---

## AF9. 当前授权施工边界

CTO 已显式授权 MCFT：

```text
现在直接施工 ONE proof-materialization successor
```

施工边界：

```text
base exact head
= 1f970ccfc908d6ced4d44673d56206cd51087962

commit count
= exactly one bounded successor commit before adjudication

purpose
= materialize successful Phase3 / Phase5 run proofs
  under current requalification contract

no unrelated changes
= required
```

此授权不等于 merge authorization。

完成 successor H 后，仍需先机器 adjudication：

```text
planner
→ dependency digest checks
→ QCP
→ exact-head convergence review
```

再决定是否：

```text
Ready / merge adjudication
```

---

## AF10. 新 critical path

当前 authoritative critical path 变为：

```text
1f970cc
  Phase3 fresh proof = SUCCESS
  Phase5 fresh proof = SUCCESS
  generic CI         = SUCCESS
        ↓
ONE bounded run-proof materialization commit
        ↓
successor H
        ↓
planner
        ↓
dependency digests unchanged?
   YES
        ↓
QCP resolves 1f970cc ancestor proofs
        ↓
Phase3 valid evidence = exactly one
Phase5 valid evidence = exactly one
FAIL = 0
blocker_count = 0
        ↓
exact-head convergence review
        ↓
Ready / merge adjudication

   NO
        ↓
STOP
        ↓
fresh exact-head qualification
```

不得在 `YES` 路径中插入一轮无必要的 Phase3 / Phase5 rerun。

---

## AF11. Successor H machine review checklist

新对话接手施工后，必须按这个顺序验：

```text
A. branch drift check
   current head == 1f970cc...

B. create exactly one bounded materialization successor H

C. parent check
   direct parent(H) == 1f970cc...

D. diff scope check
   only run-proof registry materialization

E. planner @ H
   planner_status = PASS
   unknown_changed_paths = 0
   authority_errors = 0

F. dependency digest @ H
   Phase3 == sha256:12853172...0554b9
   Phase5 == sha256:65dee9a9...95b8b

G. stage/workflow/base/ancestor/binding checks
   all valid

H. if F+G valid
   DO NOT rerun Phase3/Phase5
   run QCP @ H

I. QCP expected
   Phase3 valid evidence count = 1
   Phase5 valid evidence count = 1
   FAIL = 0
   blocker_count = 0

J. exact-head convergence review

K. only then Ready / merge adjudication
```

若 F 或 G 任一失败：

```text
STOP
→ fresh exact-head qualification
```

---

## AF12. 当前状态 machine-readable restart block

```text
MCFT_CAP09_CURRENT_HANDOFF_SECTION
= AF

AUTHORITATIVE_HANDOFF_PR
= #3298

AUTHORITATIVE_HANDOFF_PARENT_BEFORE_AF
= ffedcad99d8cd1907fd1c4f516112e0396489fea

CURRENT_ACTIVE_PR
= #3553

CURRENT_ACTIVE_HEAD
= 1f970ccfc908d6ced4d44673d56206cd51087962

CURRENT_ACTIVE_BASE
= main @ 0ac2d2cf98d553285a2051a1b0b86131a23fc413

PHASE3_RUN
= 34666374039

PHASE3_RESULT
= SUCCESS

PHASE3_DEPENDENCY_DIGEST
= sha256:12853172ba486255d2134537a97ba0d2e8897c5c45511ee3d9553a73ef0554b9

PHASE5_ACCELERATED_RUN
= 34666374060

PHASE5_RESULT
= SUCCESS

PHASE5_DEPENDENCY_DIGEST
= sha256:65dee9a9db74e22bbed48ed61490a364c899e4c4a24d029efe445cb59bf95b8b

GENERIC_CI_RUN
= 34666374002

GENERIC_CI_RESULT
= SUCCESS

OLD_QCP_RUN
= 34666374033

OLD_QCP_RESULT
= FAILURE

OLD_QCP_MEANING
= missing durable run-proof bindings

CTO_CURRENT_AUTHORIZATION
= BUILD ONE BOUNDED RUN-PROOF MATERIALIZATION SUCCESSOR

SUCCESSOR_REQUIRED_DIRECT_PARENT
= 1f970ccfc908d6ced4d44673d56206cd51087962

SUCCESSOR_ALLOWED_SCOPE
= registry proof materialization only

SUCCESSOR_FORBIDDEN_SCOPE
= QCP / planner / preflight / MinIO harness / app / runtime /
  current-crop authority / Production Owner / #3552

SUCCESSOR_PLANNER_GATE
= PASS / unknown_changed_paths=0 / authority_errors=0

UNCHANGED_DIGEST_POLICY
= DO NOT RERUN PHASE3 OR PHASE5

REQUALIFY_STRING_POLICY
= NOT SUFFICIENT TO FORCE RERUN

QCP_TARGET
= one valid Phase3 evidence
+ one valid Phase5 evidence
+ FAIL=0
+ blocker_count=0

RERUN_TRIGGER
= dependency digest changed
  OR stage/workflow/base/ancestor/binding machine check invalid
  OR planner gate invalid
  OR QCP evidence uniqueness/resolution invalid

MINIO_RCA
= CLOSED / DO NOT REOPEN

#3552
= ISOLATED / DO NOT TOUCH YET

EXACT_ONE_PRODUCTION_OWNER
= NOT LIVE-PROVEN

PRODUCTION_RUNTIME
= NOT STARTED

FORMAL_V5
= NOT ARMED

NEXT
= construct one bounded proof-materialization successor H
→ verify direct parent
→ planner @ H
→ compare current dependency digests
→ if unchanged and bindings valid: QCP @ H without Phase3/Phase5 rerun
→ require blocker_count=0
→ exact-head convergence review
→ Ready / merge adjudication
```

---

## AF13. 一句话 checkpoint

CTO 已把当前 gate 从“新 head 后默认重新 qualification”收紧为 **dependency-digest + machine-binding adjudication**：MCFT 现在被授权直接在 `1f970cc...` 上施工唯一一个 bounded run-proof materialization successor；若 successor 的 Phase3 / Phase5 current dependency digest 仍为 `128531...` / `65dee9...` 且 stage/workflow/base/ancestor/binding 全部机器成立，则禁止因 `REQUALIFY` 字样机械重跑，直接让 QCP 对 `1f970cc...` 的 fresh ancestor proofs 做唯一有效证据裁决，目标 `FAIL=0 / blocker_count=0`；只有 digest 或 binding gate 真正变化/失败时，才转 fresh exact-head qualification。

<!-- MCFT_CAP09_HANDOFF_AF_PAYLOAD_END -->