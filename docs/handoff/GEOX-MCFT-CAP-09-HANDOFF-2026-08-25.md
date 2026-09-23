# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-25

更新时间：2026-08-25 15:28（UTC+8）

> **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY.** 本文只用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / qualification / epoch / Formal write 权限。若本文与 `docs/SSOT.md`、数字孪生总任务书、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、Neon live state、immutable artifact 或 repository machine gate 冲突，以后者为准。
>
> **当前尤其重要：本 handoff 所在 docs 分支/PR 在 Formal-v4 active epoch 结束前不得 merge。** 即使是 docs-only merge，也会改变 protected `main` SHA，使当前 exact-subject arm / A0 / live Formal chain fail-closed 或失去当前部署身份。

---

## 0. 当前快照 / 下一对话第一步

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

protected_main_merge:
PR #3286 — fix(mcft-cap09): bind Graduation to fresh v12 successor

protected_main_status:
protected
NO DRIFT observed at handoff

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_phase:
MCFT-9 T4R1 FORMAL-v4 REAL WALL-CLOCK O00→O23 CONTINUATION

current_frontier:
O03 terminal complete
O04 next due at 2026-08-25T08:00:00Z
= 2026-08-25 16:00 UTC+8

mcft_cap09_complete:
false
```

### 当前 qualification

```text
qualification_generation:
v12 / blocked_v12

qualification_subject:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

persistent qualification run:
32754030057

artifact:
9530919886

artifact name:
mcft-cap09-t4r1-am19-persistent24-26c1383f7f45abb76c99e28ec3d06714e85d1b2c-32754030057

digest:
sha256:33fab20c00177fb59b6dae5a29da846558bf720d4a7c9b28b71d60d960eb90d3

13/13:
PASS

static blocker count:
0
```

这一次 **不是 v11 CARRY_FORWARD 的 Formal-v4 epoch**。

必须区分：

```text
#3284 control-plane recursion repair
→ governed semantic digest unchanged
→ v11 CARRY_FORWARD 合法

但随后 #3285 主动把 actual Formal v3 → v4，qualification v11 → v12
→ governed successor boundary 改变
→ fresh qualification mandatory
→ current active qualification = v12
```

不要在下一对话把“#3284 对 control-plane-only fix 可 carry-forward v11”误写成“当前 Formal-v4 仍由 v11 资格化”。

### Graduation

```text
Graduation run:
32756208090

artifact:
9530934611

digest:
sha256:af4212d310ebfcf14f3fdf97a1118e873a68a68ca8ae2bb1d8fed7e239e63895

qualification_generation:
v12

new_machine_gate_claim:
true

formal_epoch_creation_gate:
OPEN

required_status_count:
13

static_blocker_count:
0

formal_database_write_count:
0

formal_o00_started:
false

mcft_cap09_completed:
false

gate opened:
2026-08-24T17:22:20.204Z
```

### Active Formal arm

```text
arm run:
32802900645

artifact:
9547121835

digest:
sha256:883e41f99cbf1552a9c63aa20bc9f33348c0ffa2344365dbecd62131ac58d976

subject:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

formal database:
geox_mcft_cap09_s6_formal_t4r1_24h_v4

epoch:
mcft_cap09_am19_formal_20260825030000000_26c1383f7f45

A0:
2026-08-25T03:00:00Z

O00:
2026-08-25T04:00:00Z

O23:
2026-08-26T03:00:00Z

arm_to_o00_lead_minutes:
69.44

minimum required:
35

formal writes at arm:
0

formal_a0_bootstrapped:
false

formal_o00_started:
false
```

### A0

```text
A0 run:
32802923974

artifact:
9547325945

digest:
sha256:6dd4456f796e44c2e5b2cdc3fbae86b46b0fe89f8421fd7a327304a95c18f8ab

status:
PASS

A0:
2026-08-25T03:00:00Z

formal_a0_bootstrapped:
true

formal_o00_started:
false

A0 members:
9

hourly runtime configs:
24

scheduler slots immediately after A0:
0

next tick:
2026-08-25T04:00:00Z
```

### Current Formal-v4 real wall-clock progress

```text
O00:
logical_time = 2026-08-25T04:00:00Z
run = 32807407134
event = workflow_dispatch
artifact = 9548626190
digest = sha256:d9bd62357580c334ab3e4f77a7b145ac8b48ce31b8ad686c6a44e3ae94334610
workflow status = PASS
terminal state = DEGRADED
forcing = PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
formal_epoch_no_go = false

O01:
logical_time = 2026-08-25T05:00:00Z
run = 32811065302
event = schedule
artifact = 9549813526
digest = sha256:e960f90ed44aa095fb65f97e3c866710c238a807bca5741fb2d07beab3bb6133
workflow status = PASS
terminal state = DEGRADED
formal_epoch_no_go = false

O02:
logical_time = 2026-08-25T06:00:00Z
run = 32815272810
event = schedule
artifact = 9551181479
digest = sha256:e022d9c97337566225631d2c018eabaf23bfdb3f06cd5544c935d1f40a26068c
workflow status = PASS
terminal state = DEGRADED
formal_epoch_no_go = false

O03:
logical_time = 2026-08-25T07:00:00Z
run = 32819699471
event = schedule
artifact = 9552672484
digest = sha256:5266bff29824b016900377594818f43154d189b6b1c38c89b9aec732294e206a
workflow status = PASS
terminal state = DEGRADED
health = CONTINUATION_STATE_ASSIMILATED_WITH_SUCCESSFUL_FORECAST
formal_epoch_no_go = false
terminal_at = 2026-08-25T07:03:34Z
```

当前不是 failure。

`DEGRADED` 在这一条 qualification/runtime 设计里不是自动 NO-GO；它是受治理的可解释状态。只要 terminal tick 正常形成、forecast/state/checkpoint/health 闭合、`formal_epoch_no_go=false`，就继续下一个 slot。

### Formal-v4 live DB snapshot at handoff

```text
scheduler_slots = 4
terminal_ticks = 4
state_history = 5
forecast_runs = 4
facts = 85

cursor:
last_terminal = O03 / 2026-08-25T07:00:00Z
next_slot = O04
next_logical_time = 2026-08-25T08:00:00Z
```

### O04 forcing 已提前就位

```text
O04 slot:
2026-08-25T08:00:00Z
= 2026-08-25 16:00 UTC+8

required base:
2026-08-25T07:00:00Z

soil:
observed_at = 2026-08-25T06:45:00Z
ingested_at = 2026-08-25T06:50:00Z

GFS weather:
target = 2026-08-25T07:00:00Z
available = 2026-08-25T06:30:22Z
ingested = 2026-08-25T06:30:41Z

GFS ET0:
target = 2026-08-25T07:00:00Z
available = 2026-08-25T06:30:22Z
ingested = 2026-08-25T06:30:41Z
```

所以当前：

```text
O00 ✓
O01 ✓
O02 ✓
O03 ✓

4 / 24 terminal ticks
20 remaining

O04 forcing ready
NO current blocker
NO current NO-GO
```

### 下一对话第一步必须做什么

不要改代码，不要 merge docs，不要 requalify，不要 rebuild arm。

先做 live read：

```text
1. 确认 protected main 仍 == 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
2. 读取 Formal-v4 cursor / terminal tick count
3. 看 08:00Z / 北京时间 16:00 的 O04 是否由 schedule 自动 terminal
4. 看 08:00Z base rolling/hourly promotion 是否已经为 O05=09:00Z 准备 forcing
5. 只有自动 scheduled runner 到整点后 5–10 分钟仍未形成 terminal，才允许手工 dispatch 同一个 production live-runner
6. 不要每小时机械手工触发
```

如果 `main` 已漂移，先查明是谁推进了 main。不要把本 handoff 中的 active arm / A0 / O00–O03 evidence 当成新 SHA 的 exact deployment evidence。

---

## 1. 我们现在到底在做什么

总任务仍是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
最终不可替代验收：REAL O00 → O23，24 个真实 UTC 小时
```

当前已经不再是：

```text
设计 successor
修 O01 orchestration
恢复 failed v3
建 qualification DB
做 accelerated 13/13
开 Graduation
arm
A0
```

这些都已经完成。

当前唯一主线是：

```text
守住 exact main 26c1383...
+
让 Formal-v4 在真实墙钟上连续完成 O04 → O23
+
保持每小时 causal evidence 提前 promotion
+
最终 final readback / completion candidate / adjudication
```

不要再扩大问题范围。

这轮最危险的动作不是“不开发”，而是 **在 active epoch 中为了“顺手修一个小问题”修改 main**。

因为当前：

```text
qualification subject
Graduation subject
rolling subject
arm subject
A0 subject
live runner subject
Formal DB authority
```

都已经收敛到：

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

任何 main mutation 都会把一个已经运行中的 24h Formal 重新变成 exact-subject 问题。

---

## 2. 上一版 handoff 的 frontier 已经被跨越

上一份 handoff：

```text
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-24.md
Draft PR #3282
base = 18b690e8c2d92bfdc4eeea9eece0723c4181a996
head = 6d94dbd52dce514ed26148012b55f10dbae007bd
```

记录的是：

```text
Formal v3:
A0 PASS
O00 PASS/DEGRADED
O01 BLOCKED_NO_CAUSAL_FORCING
IRREVERSIBLE NO-GO
```

那份 handoff 的直接 root cause 是：

```text
scheduled workflow
→ repository GITHUB_TOKEN dispatch rolling
→ rolling SUCCESS
→ expected implicit workflow_run hourly consumer
→ consumer run never created
→ O01 forcing not promoted
→ O01 fail-closed
```

当前已经把这个 frontier 跨过去。

不要再从 “O01 provider 缺数据” 开始排查。

---

## 3. 治理文档裁决：PR #3283 已完成

用户在本轮明确裁决：

```text
README_MIGRATION.md 的问题不是文件头 authority hierarchy 写错
而是 canonical Sprint/Tag/Freeze ledger 长期停在 P24
```

最终处理：

```text
PR #3283 — docs(governance): reconcile repository navigation and canonical freeze ledger
merge = 8908317a263a4af2e50c9503a34cf80837df5d3f
```

关键边界：

```text
root README:
只做导航

docs/SSOT.md:
唯一 repository-level SSOT

README_MIGRATION.md:
唯一 canonical Sprint / Tag / Freeze index
authority 只限 Sprint / Tag / Freeze 域
```

`README_MIGRATION.md` 的修法严格是：

```text
original blob = 1310eec79c329efd344c577c4ccad7f7736e2dcb
append-only
historical portion unchanged
+675 / -0
old EOF 前没有 modification/deletion
```

没有创建第二个 freeze index。

这条治理工作已关闭，不要重新设计 `FREEZE_INDEX_V2.md`，也不要再次重写旧 ledger。

---

## 4. #3281 → #3284：O01 control-plane root cause 与精确修复

### 4.1 #3281 是原修复 Draft

```text
#3281 — fix(mcft-cap09): close Formal hourly orchestration recursion gap
```

核心修复：

```text
旧：
rolling completion
→ workflow_run
→ formal-hourly-evidence

新：
rolling SUCCESS
→ explicit workflow_dispatch(rolling_run_id)
→ formal-hourly-evidence
```

consumer 不信任 caller 传来的 subject SHA。

只传：

```text
rolling_run_id
```

consumer 自己重新验证：

```text
workflow name exact
workflow path exact
status = completed
conclusion = success
event = workflow_dispatch
head_branch = main
head_sha = current exact subject
artifact identity exact
artifact digest valid
candidate subject == run head
producer subject == run head
```

同时短 poll upstream terminal，关闭“producer 最后一步 dispatch 时自身尚未变成 completed”的 race。

### 4.2 为什么不用 PAT / GitHub App token 做主修法

虽然 PAT / App token 可以绕过部分递归保护，但那会为一个 orchestration defect 新增 credential lifecycle。

裁决是：

```text
explicit workflow_dispatch
+
exact run identity authentication
```

优于：

```text
新增长期 credential 只为了让隐式 workflow_run 递归恢复
```

### 4.3 #3283 推进 main 后，#3281 被 exact-main supersede

治理 PR #3283 合并后 main 变为：

```text
8908317a263a4af2e50c9503a34cf80837df5d3f
```

因此旧 #3281 不能原样作为 exact-main successor。

最终由：

```text
PR #3284 — fix(mcft-cap09): recover O01 orchestration on exact post-governance main
merge = 274ce26d4f67049b891e253e148ed9be571c4bce
```

把已审计的 control-plane blobs replay 到新 exact main，并补 failed-v3 O01 recovery authority。

### 4.4 #3284 对 qualification 的裁决

这一步只有 control-plane / governance acceptance change。

machine audit 证明：

```text
governed semantic digest unchanged
governed_changed_paths = []
qualification_reexecution_required = false
qualification_database_rewrite_authorized = false
formal effect = 0
```

所以对于 **#3284 这一步本身**：

```text
v11 CARRY_FORWARD
```

是正确结论。

---

## 5. 为什么后来还是进入 v12：不要再把这件事混为一谈

用户最初裁决是：

```text
O01 control-plane bug 不应因为 workflow 修复就机械创建 v12
```

这个裁决本身没有错。

真正改变结论的是后面的 successor activation。

failed v3 已经存在：

```text
A0 state
O00 terminal
O01 failed slot
irreversible NO-GO
```

不能：

```text
补 forcing
重跑 O01
从 O02 接着跑
```

因此实际 Formal 必须 fresh successor。

仓库当时仍把 governed active Formal identity 固定在 v3。

如果只 archive old v3 后继续复用同一个 governed logical identity，虽然可减少 generation rollover，但在这次 O00 已产生实际 runtime state 的边界下，审计最终选择更严格的 successor：

```text
actual Formal v4
+
fresh qualification v12 / blocked_v12
```

PR #3285 明确把这件事定为 governed successor change：

```text
PR #3285 — fix(mcft-cap09): establish fresh v12 / Formal-v4 successor subject
merge = 10734e2377cf71f7e962fa8033050fbe4dea253b
```

其核心：

```text
new Actual Formal Store Authority V2
active Formal v4
v3 remains failed predecessor evidence
qualification stores v11 → v12
all arm/A0/hourly/live/final/completion active bindings → v4
```

因此：

```text
#3284 = v11 carry-forward for control-plane repair
#3285 = fresh v12 required for governed v4 successor
```

两者不矛盾。

---

## 6. failed Formal-v3 的正确处理：archive-first，绝不原地修补

failed v3 的核心证据仍是：

```text
O01 NO-GO run:
32660018684

artifact:
9498479992

digest:
sha256:dd531b49138ee5b9046e9cc4d8dbd458572c62995de0cc08a2cad7f64e6ee0d2
```

#3284 增加独立 O01 recovery authority，冻结：

```text
failed subject SHA
failed epoch
arm identity
O00 succeeded
O01 failed
O01 terminal artifact
failure_class = CONTROL_PLANE_ORCHESTRATION
archive mutation forbidden
active successor must be fresh
qualification DB rewrite forbidden in recovery lane
```

recovery run：

```text
32734748271
subject = 037c224038250caa0c43bebc3f719434624f008b
artifact = 9522808246
digest = sha256:c3e3905e12d9d7e2e8e6e12bb1331b2590c086ce68a692307a833ea231c1d86b
```

failed O01 physical store 被 archive-first 处理。

不要在任何后续对话建议：

```text
DROP failed DB
TRUNCATE
DELETE failed facts
UPDATE scheduler slot
reset cursor
补 O01 tick
```

failed epoch 是 evidence，不是测试垃圾。

---

## 7. 一个非常小但真实的 recovery wiring 坑：artifact extraction

PR #3285 后，O01 recovery lane 实跑时发现 immutable artifact download 的目录形状与脚本预期不一致。

精确 hotfix commit：

```text
037c224038250caa0c43bebc3f719434624f008b

fix(mcft-cap09): flatten O01 recovery artifact extraction
```

唯一代码变化：

```text
merge-multiple: true
```

目的：

```text
让 actions/download-artifact 的 immutable O01 artifact
以 recovery parser 预期的平面路径出现
```

这不是：

```text
authority change
runtime change
database semantic change
provider change
scheduler change
qualification change
```

但它说明一个重要方法论：

> GitHub Actions artifact path/shape 本身也是 control-plane contract，不能只在静态字符串层面猜。

---

## 8. Neon / store provisioning：这轮真实踩过的坑

### 8.1 Formal store 不能用本机 Postgres 替代

本地 PostgreSQL 可以做：

```text
development
reference
replay
schema comparison
```

但当前 Formal authority chain 依赖 GitHub-hosted Actions 跨多个真实小时访问同一个共享远程 Postgres。

所以当前 active Formal store 不能临时换成：

```text
C:\Users\... 本机 Postgres
```

否则会改变：

```text
reachability
credential binding
persistence boundary
real workflow execution graph
```

对当前 Formal 来说，远程持久数据库不是“品牌偏好”，而是 execution contract 的一部分。

### 8.2 Neon 容量/数据库数量问题

本轮 provision 时遇到 Neon 容量/存储限制。

用户通过 Neon 前端清理不再需要的 scratch / stale stores 后，才继续 provision。

经验：

```text
UI 上 DELETE 后仍短暂可见
!= 一定代表物理删除失败
```

最终要以：

```text
actual catalog / provision workflow / exact database connection
```

确认，而不是只看前端缓存列表。

### 8.3 final successful store provision

```text
run:
32746979916

event:
workflow_dispatch

subject:
037c224038250caa0c43bebc3f719434624f008b

conclusion:
success

artifact:
9527489895

digest:
sha256:942d1808d50416943a5a4480a02432300f9e580d58c95aa634290b4135823863
```

这一步建立/验证 fresh successor stores，为后续 exact-main v12 qualification 准备条件。

### 8.4 不要在 PowerShell 直接输入 SQL

本轮用户曾直接输入：

```text
FROM pg_stat_activity
```

PowerShell 把它当 PowerShell 语法解析，报：

```text
ReservedKeywordNotAllowed
```

以后查 DB：

```text
用 psql
或 Neon SQL editor
或 repository workflow/readback
```

不要把裸 SQL 粘进 PowerShell prompt。

---

## 9. PR #3286：fresh-v12 Graduation wiring 修复

#3285 建好 successor subject 后，exact-main audit 又发现：

```text
qualification 可以跑 v12
但 Graduation classifier 仍 hard-bind v11
```

也就是说即使 fresh v12 13/13 PASS：

```text
Graduation 也会在 classifier 前 fail-closed
```

于是有：

```text
PR #3286 — fix(mcft-cap09): bind Graduation to fresh v12 successor
merge = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

关键变化：

```text
fresh v12 qualification → new machine gate claim
v12 idempotent rerun → NO_NEW_GATE
v11 / blocked-v11 → predecessor evidence only
active Graduation no longer supports manual v11 compatible-replay route
```

从这里开始，当前 Formal-v4 的 exact deployment subject 正式冻结为：

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

之后直到 active epoch 完成，不要 merge 任何东西进 main。

---

## 10. fresh v12 qualification：真正的当前 qualification authority

v12 persistent qualification：

```text
run:
32754030057

head:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

job:
protected-main-persistent-13of13

result:
PASS

artifact:
9530919886

digest:
sha256:33fab20c00177fb59b6dae5a29da846558bf720d4a7c9b28b71d60d960eb90d3
```

核心 job steps：

```text
exact protected main and T4R1 bindings
exact rolling artifact authentication
exact 24T crop window
producer-bound retained raw rehydration
zero provider refetch proof
persistence-free canonical semantics
production-graph persistent 24T qualification
fresh v12 persistent 13/13
```

所以不要再跑 13/13，除非：

```text
main drift
or governed semantic boundary changes
or current v12 evidence is explicitly invalidated by authority
```

当前都没有发生。

---

## 11. Graduation：v12 gate 已真实 OPEN

```text
run:
32756208090

event:
workflow_run

head:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

artifact:
9530934611

digest:
sha256:af4212d310ebfcf14f3fdf97a1118e873a68a68ca8ae2bb1d8fed7e239e63895
```

artifact 已核：

```text
qualification_generation = v12
new_machine_gate_claim = true
formal_epoch_creation_gate = OPEN
required_status_count = 13
static_blocker_count = 0
formal_database_write_count = 0
formal_o00_started = false
human_override_used = false
mcft_cap09_completed = false
```

Gate open：

```text
2026-08-24T17:22:20.204Z
```

因此任何 pre-gate rolling 都不能拿来 arm。

arm admission 明确要求：

```text
rolling_completed_at > gate.opened_at
```

---

## 12. post-gate rolling：这里暴露了第二层 GitHub recursion 问题

这是本轮非常重要的新坑。

### 12.1 第一次 post-gate manual rolling 被 concurrency pending replacement 取消

用户手工发：

```text
run 32757168969
```

它还在 pending、0 jobs 时，hourly scheduler 又由 `github-actions[bot]` 发了：

```text
run 32758704400
```

结果旧 pending：

```text
32757168969 = cancelled
jobs = 0
artifacts = 0
```

即使 workflow 配置：

```text
cancel-in-progress: false
```

GitHub concurrency 仍可能：

```text
同一 group 只保留一个 pending
新 pending 替换旧 pending
```

所以：

> `cancel-in-progress:false` 只是不杀正在运行的同组 run，不保证旧 pending 永远保留。

### 12.2 bot rolling 成功，但没有产生 Formal arm

```text
32758704400
actor = github-actions[bot]
rolling = SUCCESS
```

但之后：

```text
no new formal-arm workflow_run
```

历史 bot rolling 也复现同样行为。

### 12.3 user-origin rolling 能产生 arm

用户临时 disable hourly scheduler，避免 bot pending 再抢：

```text
gh workflow disable mcft-cap-09-t4r1-rolling-hourly-scheduler.yml
```

然后用户身份手工发：

```text
rolling run = 32798091240
actor = liyongshang44-max
event = workflow_dispatch
head = 26c1383...
conclusion = success
```

这一次后续：

```text
formal-arm workflow_run = 32802900645
```

正常出现。

### 12.4 当前结论

本轮已经修掉：

```text
rolling → hourly-evidence
```

因为现在 rolling 自己 explicit dispatch hourly consumer。

但仍然存在一个 **post-Formal control-plane debt**：

```text
bot/scheduler → rolling
rolling completion → formal-arm workflow_run
```

在 bot provenance 下可能被 GitHub recursion suppression 截断。

当前 active epoch 已经 arm，所以这不阻塞 O04–O23。

**不要现在改 main 修它。**

等当前 Formal 完成后再做：

```text
显式 rolling → arm dispatch
or other machine-authenticated deterministic arm handoff
```

如果未来要启动新 epoch，在这个 debt 修复前，不能假设 bot rolling 会自动产生 arm。

---

## 13. active arm 如何真正建立

用户-origin post-gate rolling：

```text
run:
32798091240

subject:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

A0 target:
2026-08-25T03:00:00Z

O00:
2026-08-25T04:00:00Z
```

随后：

```text
arm run:
32802900645

artifact:
9547121835

digest:
sha256:883e41f99cbf1552a9c63aa20bc9f33348c0ffa2344365dbecd62131ac58d976
```

arm artifact 已实核：

```text
status = PASS
formal_database = geox_mcft_cap09_s6_formal_t4r1_24h_v4
rolling_run = 32798091240
arm_to_o00_lead_minutes = 69.44
minimum = 35
formal_database_write_count = 0
scheduler_write_count = 0
runtime_write_count = 0
formal_a0_bootstrapped = false
formal_o00_started = false
```

这是 current active epoch 的唯一 arm root。

---

## 14. A0：真实墙钟 bootstrap 已成功

```text
A0 run:
32802923974

event:
workflow_run

artifact:
9547325945

digest:
sha256:6dd4456f796e44c2e5b2cdc3fbae86b46b0fe89f8421fd7a327304a95c18f8ab
```

A0 workflow 前置检查：

```text
exact protected main
active arm exact
frozen rolling identity/digest
candidate ↔ arm binding
private DB/R2 bindings
Formal-v4 26/26 zero-state preflight
producer-bound local rehydration
durable Formal evidence promotion
```

随后严格等到：

```text
2026-08-25T03:00:00Z
```

才 canonical bootstrap mutation。

A0 结果：

```text
status = PASS
formal_a0_bootstrapped = true
formal_o00_started = false
A0 members = 9
hourly configs = 24
scheduler slots = 0
next tick = O00
```

注意：A0 前 durable evidence promotion 会让 `facts` 不再物理 0 行。

真正的 “A0 zero-state preflight” 指的是 canonical runtime/scheduler/checkpoint state 在 bootstrap 前符合 authority boundary，不是说整个 Formal DB 永远 0 facts。

---

## 15. hourly scheduler 恢复时机与 planner cliff

arm 成立后，hourly scheduler 被重新 enable：

```text
gh workflow enable mcft-cap-09-t4r1-rolling-hourly-scheduler.yml
```

但 GitHub scheduled Actions 实测存在明显延迟。

历史 cron：

```text
:17 * * * *
```

实际 scheduler 可能：

```text
:37
:45
甚至更晚
```

rolling target planner 规则：

```text
target = ceil(now + 35 minutes)
```

因此 target T 的硬 cliff 是：

```text
planner must execute <= T - 35min
```

例如要得到：

```text
T = 04:00Z
```

planner 必须在：

```text
03:25Z 之前实际执行
```

不是只要 workflow 在 03:25 前 created 就够。

这条非常重要。

---

## 16. O01 forcing 是怎样被提前救回来的

上一轮 v3 的 O01 就死在没有 causal forcing promotion。

所以本轮在 O00 前做了显式 early checkpoint。

用户在：

```text
2026-08-25T03:22:20Z
```

手工 dispatch：

```text
rolling run 32804913748
```

其 planner 在 03:25Z cliff 前已执行，所以 target 必然是：

```text
04:00Z base
```

随后 rolling SUCCESS，并产生 04:00Z candidate。

对应 hourly evidence：

```text
run 32806658068
promotion completed at 2026-08-25T03:52:09.890Z
base_target_t = 04:00Z
supported_slot_t = 05:00Z = O01
canonical facts written = 3
provider refetch = 0
scheduler writes = 0
runtime writes = 0
NO-GO marker = none
```

因此在 O00 还没执行时：

```text
O01 forcing already in Formal-v4
```

这就是本轮跨过 v3 O01 NO-GO frontier 的关键证据。

---

## 17. O00：第一颗 terminal tick

GitHub scheduled live runner 在 O00 前的 run 只会：

```text
BEFORE_O00 / outside active window
```

clean no-op。

到 04:00Z 后，scheduled run 没及时出现，因此用户使用 workflow 已正式支持的同一 production path 手工 dispatch：

```text
32807407134
created = 2026-08-25T04:02:12Z
event = workflow_dispatch
```

它不是另写 runner，也不是 bypass。

同一 workflow：

```text
resolve active arm/A0
real DB clock
oldest-due
lease/fencing
canonical runtime
immutable cycle proof
```

O00 结果：

```text
slot = O00
logical_time = 04:00Z
status = PASS
runtime_health = DEGRADED
forcing = PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
terminal_result_recorded = true
formal_epoch_no_go = false
provider_request_count = 0
r2_request_count = 0
next_logical_tick_time = 05:00Z
```

DB 从 A0：

```text
scheduler_slots 0 → 1
terminal_ticks 0 → 1
state_history 1 → 2
forecast_runs 0 → 1
```

---

## 18. O01：自动 schedule 已真正接管

O01：

```text
05:00Z
```

自动 scheduled production runner：

```text
run 32811065302
created around 05:00Z
event = schedule
head = 26c1383...
conclusion = success
```

artifact：

```text
9549813526
sha256:e960f90ed44aa095fb65f97e3c866710c238a807bca5741fb2d07beab3bb6133
```

O01：

```text
terminal recorded
state = DEGRADED
formal_epoch_no_go = false
```

这已经证明：

```text
v3 O01 failure frontier 已跨越
```

### 18.1 一个很重要的幂等性实证

用户不知道 scheduled O01 已经先执行，于 05:01Z 后又手工发：

```text
32811220397
```

这个 workflow 最终 `success`，但 artifact 是：

```text
NO_DUE_SLOT
```

原因不是失败。

因为 auto runner 已把 cursor 推到 O02。

所以第二次 production invocation：

```text
oldest-due = none
→ zero new slot
→ no duplicate tick
```

这给 Issue #3226 的 repeat-run/idempotency debt 提供了一个真实正向证据：

```text
至少 live runner 的 duplicate invocation 在这一边界没有重复执行 terminal tick
```

但不要因此宣布 #3226 全部关闭；完整 repeat-run semantics 仍需另行 adjudicate。

---

## 19. O02 / O03：自动链开始稳定

### O02

```text
logical_time = 06:00Z
scheduled run = 32815272810
artifact = 9551181479
digest = sha256:e022d9c97337566225631d2c018eabaf23bfdb3f06cd5544c935d1f40a26068c
terminal_at = 06:03:33Z
state = DEGRADED
formal_epoch_no_go = false
```

### O03

```text
logical_time = 07:00Z
scheduled run = 32819699471
artifact = 9552672484
digest = sha256:5266bff29824b016900377594818f43154d189b6b1c38c89b9aec732294e206a
terminal_at = 07:03:34Z
state = DEGRADED
health = CONTINUATION_STATE_ASSIMILATED_WITH_SUCCESSFUL_FORECAST
formal_epoch_no_go = false
```

这说明在 O01 以后：

```text
scheduled live-runner
+
rolling/hourly evidence pipeline
```

比前两个小时稳定。

当前不要把临时手工 fallback 变成默认运行方式。

---

## 20. rolling / hourly evidence 的正确 slot 映射

不要把 base target 和 terminal slot 混淆。

当前映射：

```text
A0 bootstrap
→ warm-start O00

base 04:00Z
→ supports O01 05:00Z

base 05:00Z
→ supports O02 06:00Z

base 06:00Z
→ supports O03 07:00Z

base 07:00Z
→ supports O04 08:00Z

...
```

所以每小时要看两条不同链：

```text
A. 当前到期 terminal slot
B. 下一 slot 的 causal base evidence
```

只看 live runner 不够。

只看 rolling SUCCESS 也不够。

必须最终看到：

```text
rolling candidate
→ explicit hourly evidence workflow
→ promotion PASS
→ correct supported_slot_t
```

---

## 21. 当前 O04 已经没有紧迫 forcing 风险

O04：

```text
08:00Z
16:00 UTC+8
```

其 base：

```text
07:00Z
```

当前 Formal-v4 已经有：

```text
soil observed_at = 06:45Z
soil ingested_at = 06:50Z

GFS target = 07:00Z
available = 06:30:22Z
ingested = 06:30:41Z

ET0 target = 07:00Z
available = 06:30:22Z
ingested = 06:30:41Z
```

所以 handoff 时：

```text
O04 forcing ready
```

真正下一条需要提前看的 evidence 是：

```text
08:00Z base
→ supports O05 = 09:00Z
```

北京时间大约 15:50 左右可以看 promotion 是否已经进入；16:00–16:10 看 O04 terminal。

---

## 22. 现在每小时该怎么守，不要再机械手工测试

正式策略：

```text
AUTOMATION = primary path
HUMAN = watchdog / fallback only
```

每个小时：

### T-10 到 T-5 左右

看下一 slot 的 evidence promotion：

```text
rolling completed?
hourly evidence run created?
promotion PASS?
supported_slot_t correct?
```

### T 到 T+5

先让 scheduled live-runner 自动执行。

### T+5 到 T+10

查：

```text
terminal tick count 是否 +1
cursor 是否前进
scheduled live-runner 是否产生 cycle artifact
formal_epoch_no_go 是否 false
```

### 只有 T+10 仍无 terminal

才允许：

```text
gh workflow run mcft-cap-09-amendment19-formal-live-runner.yml \
  --repo liyongshang44-max/GEOX \
  --ref main
```

这是同一 production canonical path，不是测试替身。

### 不要每个整点立即手工 dispatch

O01 已证明这样只会产生：

```text
NO_DUE_SLOT
```

并制造审计噪声。

---

## 23. rolling fallback 的硬规则

如果未来发现下一 slot 缺 base evidence，不要先盲目手工 rolling。

先看：

```text
是否已有 rolling in_progress
是否已有同 target candidate
planner 还能否选到缺失 target
```

planner：

```text
target = ceil(now + 35min)
```

因此 target T：

```text
planner must actually execute <= T-35min
```

如果已经过 cliff：

```text
新的 rolling 会直接选 T+1h
```

这时再手工 dispatch 也救不回当前 base。

### concurrency 规则

```text
cancel-in-progress: false
```

并不意味着 pending 不会被替换。

同 group：

```text
旧 pending
+
新 pending
→ GitHub 可能取消旧 pending
```

所以不要在没有查看 run list 的情况下连续 dispatch rolling。

---

## 24. success 不等于“执行了 slot”：必须看 artifact / DB

本轮多次出现：

```text
workflow conclusion = success
```

但实际是：

```text
BEFORE_O00
NO_DUE_SLOT
NO_ACTIVE_EPOCH
NOT_ARMED
```

这些都是合法 clean exits。

因此判断当前 Formal 进度必须优先：

```text
cycle artifact
+
Neon scheduler/tick/cursor readback
```

不要只看 GitHub 绿色勾。

典型：

```text
32811220397 = success
但不是 O01 terminal
而是 NO_DUE_SLOT
```

真正 O01 terminal 是：

```text
32811065302
```

---

## 25. `DEGRADED` 不是自动失败

O00–O03 当前 terminal 都是：

```text
DEGRADED
```

但外层 cycle：

```text
PASS
```

且：

```text
formal_epoch_no_go = false
```

不要因为看到 DEGRADED 就手工重跑 slot。

当前设计允许受治理 degraded continuation。

真正不能继续的是：

```text
BLOCKED_NO_CAUSAL_FORCING
FAILED
irreversible NO-GO
```

上一轮 v3 O01 就属于后者。

---

## 26. KBS / freshness：不要把旧问题重新带回来

当前 Formal-v4 O00–O03 的主线不是 KBS 发布 cadence。

已知：

```text
KBS Raw Hourly 实际是 daily batch
一次发布约 24 小时数据
```

不要重新假设：

```text
KBS 每小时发布一条
```

也不要把：

```text
6h
24h
36h
```

混成一个 freshness authority。

已冻结语义仍是：

```text
6h = historical online freshness diagnostic
24h = cadence engineering observation window
36h = rolling candidate retention/expiry context
```

当前 O04 evidence 已经是 soil + GFS weather + GFS ET0 causal pair，不要无故回到 KBS blocker 线。

---

## 27. Node.js 20 → 24 annotation

当前 GitHub Actions 反复出现：

```text
Node.js 20 is deprecated
selected actions target Node.js 20 but are forced to run on Node.js 24
```

涉及：

```text
actions/checkout@v4
actions/setup-node@v4
actions/setup-python@v5
actions/upload-artifact@v4
pnpm/action-setup@v4
```

目前它是：

```text
warning / annotation
not current Formal blocker
```

不要在 active epoch 中为了清这个 warning 升级 Actions。

等 O23 + final readback 后单独处理。

---

## 28. main freeze：当前最重要的工程纪律

当前 exact subject：

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

active Formal-v4 已经在这个 subject 上：

```text
v12 qualification
Graduation
arm
A0
O00
O01
O02
O03
```

所以当前：

```text
DO NOT merge runtime PR
DO NOT merge workflow PR
DO NOT merge docs PR
DO NOT merge this handoff PR
DO NOT merge unrelated product work into main
```

如果一定有紧急开发：

```text
branch / draft PR only
```

不要碰 protected main。

---

## 29. 当前剩余工作

### 29.1 real wall-clock ticks

已经：

```text
O00
O01
O02
O03
```

剩余：

```text
O04
O05
O06
O07
O08
O09
O10
O11
O12
O13
O14
O15
O16
O17
O18
O19
O20
O21
O22
O23
```

即：

```text
20 terminal ticks remaining
```

### 29.2 当前时间轴（UTC+8）

```text
O04  2026-08-25 16:00
O05  17:00
O06  18:00
O07  19:00
O08  20:00
O09  21:00
O10  22:00
O11  23:00
O12  2026-08-26 00:00
O13  01:00
O14  02:00
O15  03:00
O16  04:00
O17  05:00
O18  06:00
O19  07:00
O20  08:00
O21  09:00
O22  10:00
O23  11:00
```

### 29.3 O23 后仍不是立刻 COMPLETE

active final-readback workflow 当前有：

```text
earliest = O23 + 20min lease grace
```

所以按当前 arm：

```text
O23 = 2026-08-26T03:00:00Z
final readback earliest ≈ 2026-08-26T03:20:00Z
= 2026-08-26 11:20 UTC+8
```

然后仍要：

```text
final readback
completion candidate
final adjudication / machine gate
```

---

## 30. 最终 completion 必须证明什么

不能只说：

```text
24 小时到了
```

至少要证明：

```text
24 scheduler slots
24 terminal ticks
O00 → O23 连续
无 missing slot
无 duplicate terminal tick
无 irreversible NO-GO
exact subject = 26c1383...
exact Formal database = ...v4
exact qualification lineage = v12
exact active arm identity
A0 identity intact
hourly causal promotions 对应正确 slot
no provider refetch in governed rehydration path where forbidden
no future leakage
no retroactive rewrite
no source relabel
checkpoint / health / state / forecast 闭合
no unauthorized downstream effect
```

final readback / completion candidate 必须来自实际 repository workflow 和 live DB，不由 handoff 人工宣布。

---

## 31. 这一路踩过的坑：按类别归档

### 31.1 exact-SHA 自失效循环

历史错误模式：

```text
小 control-plane fix
→ main SHA changed
→ qualification stale
→ fresh DB generation
→ 又发现小 seam
→ 再滚 generation
```

避免：

```text
governed semantic digest
compatibility classification
```

但当前 active epoch 更严格：

```text
不要改变 main
```

### 31.2 v11 carry-forward 与 v12 successor 混淆

避免：

```text
control-plane-only fix 可 carry-forward
!=
新 governed Formal successor 可 carry-forward
```

当前 v4 是 v12。

### 31.3 failed epoch 原地修补

禁止：

```text
补 O01 forcing 后继续 O02
```

failed v3 已 archive/freeze。

### 31.4 GitHub `GITHUB_TOKEN` recursion suppression

第一次造成：

```text
rolling SUCCESS
但 hourly consumer 不存在
→ v3 O01 NO-GO
```

已通过：

```text
explicit workflow_dispatch(rolling_run_id)
```

修掉 hourly consumer。

### 31.5 第二层 recursion：bot rolling 不触发 arm

当前仍是 post-Formal debt。

避免未来新 epoch 假设：

```text
bot rolling SUCCESS
→ arm 一定会自动 workflow_run
```

当前 active arm 已建立，不要现在修。

### 31.6 concurrency pending replacement

```text
cancel-in-progress:false
```

不保护旧 pending。

不要连续 dispatch 同组 rolling。

### 31.7 GitHub scheduled workflow 延迟

cron 不是 hard realtime scheduler。

不能用：

```text
cron = :17
```

推导：

```text
run 一定 :17 开始
```

需要 deadline-aware watchdog。

### 31.8 planner cliff 被误解

错误：

```text
workflow 在 cliff 前 created 就安全
```

正确：

```text
planner step 必须在 cliff 前实际执行
```

### 31.9 workflow success 被误认为 slot success

必须看 artifact + DB。

### 31.10 manual runner 过多

O01 证明重复 trigger 会得到 `NO_DUE_SLOT`。

当前策略是 watchdog，不是每小时人工执行。

### 31.11 Neon capacity / UI stale display

删除 scratch DB 后 UI 可能短暂还显示。

以 catalog / provision proof 为准。

### 31.12 本机 DB 替代 Formal remote DB

不允许在 active Formal 中这么换。

### 31.13 PowerShell 直接执行 SQL

使用 psql / Neon editor / workflow readback。

### 31.14 Node CommonJS top-level await

旧 v3 prebootstrap 已踩过：

```text
shell: node {0}
+
top-level await
→ parse failure
```

必须 async IIFE / CommonJS-safe。

### 31.15 artifact directory shape

`actions/download-artifact` 的目录层级是真实 contract。

#3285 后专门用 `merge-multiple:true` 修过。

### 31.16 `DEGRADED` ≠ NO-GO

不要因为 DEGRADED 自动 rerun。

### 31.17 rolling SUCCESS ≠ evidence promotion exists

必须看到 explicit hourly consumer + promotion PASS。

### 31.18 KBS cadence 模型错误

KBS daily batch，不是 hourly publish。

不要把当前 hourly runtime cadence 绑到 KBS hourly publish 假设。

---

## 32. 不要做什么

当前直到 O23/final readback 前：

```text
DO NOT merge anything into protected main
DO NOT merge this handoff PR
DO NOT re-run v12 13/13 without a governed reason
DO NOT recreate Graduation gate
DO NOT create a second active arm
DO NOT rerun A0
DO NOT reset Formal-v4
DO NOT reset scheduler cursor
DO NOT rewrite existing terminal ticks
DO NOT manually run every hour by default
DO NOT trust green workflow without artifact/readback
DO NOT delete failed-v3 archive
DO NOT reuse failed-v3 as active
DO NOT switch Formal DB to local machine
DO NOT “fix” Node.js warnings during the epoch
DO NOT reopen crop/KBS architecture unless new live evidence proves it relevant
```

---

## 33. 下一对话推荐的 operational checklist

第一轮读取：

```text
A. protected main SHA
B. Formal-v4 cursor
C. terminal tick count
D. latest cycle artifact
E. latest rolling candidate
F. latest hourly promotion
```

如果当前时间已过 O04：

```text
1. 看 O04 scheduled live-runner 是否存在
2. 看 O04 cycle artifact 是否 PASS
3. 看 formal_epoch_no_go 是否 false
4. 看 scheduler_slots 是否 5
5. 看 terminal_ticks 是否 5
6. 看 cursor 是否 O05 / 09:00Z
7. 看 08:00Z base evidence 是否已为 O05 准备
```

只有上述 1–6 未完成且已经超过 slot +10min：

```text
manual workflow_dispatch live-runner fallback
```

不要先写代码。

---

## 34. current machine evidence ledger

### protected main

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
Merge PR #3286
```

### Governance ledger repair

```text
PR #3283
merge 8908317a263a4af2e50c9503a34cf80837df5d3f
README_MIGRATION append +675 / -0
```

### O01 orchestration exact-main repair

```text
PR #3284
merge 274ce26d4f67049b891e253e148ed9be571c4bce
```

### Formal-v4 / v12 successor

```text
PR #3285
merge 10734e2377cf71f7e962fa8033050fbe4dea253b
```

### recovery artifact flatten hotfix

```text
037c224038250caa0c43bebc3f719434624f008b
```

### v12 Graduation bind

```text
PR #3286
merge 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

### failed-v3 O01 recovery

```text
run 32734748271
artifact 9522808246
sha256:c3e3905e12d9d7e2e8e6e12bb1331b2590c086ce68a692307a833ea231c1d86b
```

### successor store provision

```text
run 32746979916
artifact 9527489895
sha256:942d1808d50416943a5a4480a02432300f9e580d58c95aa634290b4135823863
```

### v12 qualification

```text
run 32754030057
artifact 9530919886
sha256:33fab20c00177fb59b6dae5a29da846558bf720d4a7c9b28b71d60d960eb90d3
```

### v12 Graduation

```text
run 32756208090
artifact 9530934611
sha256:af4212d310ebfcf14f3fdf97a1118e873a68a68ca8ae2bb1d8fed7e239e63895
```

### active arm

```text
run 32802900645
artifact 9547121835
sha256:883e41f99cbf1552a9c63aa20bc9f33348c0ffa2344365dbecd62131ac58d976
```

### A0

```text
run 32802923974
artifact 9547325945
sha256:6dd4456f796e44c2e5b2cdc3fbae86b46b0fe89f8421fd7a327304a95c18f8ab
```

### O00

```text
run 32807407134
artifact 9548626190
sha256:d9bd62357580c334ab3e4f77a7b145ac8b48ce31b8ad686c6a44e3ae94334610
```

### O01

```text
run 32811065302
artifact 9549813526
sha256:e960f90ed44aa095fb65f97e3c866710c238a807bca5741fb2d07beab3bb6133
```

### O02

```text
run 32815272810
artifact 9551181479
sha256:e022d9c97337566225631d2c018eabaf23bfdb3f06cd5544c935d1f40a26068c
```

### O03

```text
run 32819699471
artifact 9552672484
sha256:5266bff29824b016900377594818f43154d189b6b1c38c89b9aec732294e206a
```

---

## 35. 当前已关闭 / 未关闭问题

### 已关闭

```text
README_MIGRATION canonical ledger stop-at-P24 drift
root README hierarchy wording drift
v3 O01 root-cause classification
rolling→hourly implicit workflow_run recursion gap
failed-v3 archive authority
successor v4 store authority
fresh v12 qualification
v12 Graduation gate
post-gate arm
A0 bootstrap
O00
O01
O02
O03
```

### 当前 active execution 未关闭

```text
O04 → O23
final readback
completion candidate
final CAP-09 adjudication
```

### 当前 non-blocking engineering debt

```text
bot rolling → arm workflow_run recursion provenance
GitHub scheduled workflow timing jitter
Node.js 20 action deprecation
full repeat-run/idempotency semantics (#3226)
stale old handoff/diagnostic PR cleanup
```

这些 debt 不应在 active epoch 中通过 main mutation 修。

---

## 36. 最短合法完成路径

```text
NOW
↓
keep main == 26c1383...
↓
O04 scheduled terminal
↓
O05
↓
...
↓
O23
↓
wait O23 + lease grace
↓
final readback
↓
prove 24/24 terminal continuity + exact lineage
↓
completion candidate
↓
final machine/human adjudication per repository authority
↓
only then MCFT-CAP-09 COMPLETE
```

任何更短路径，例如：

```text
accelerated replay 代替剩余 20h
人工补数据库行
从已有 O03 直接生成 completion
修改 final readback 期待值
```

都不合法。

---

## 37. 给下一位接手者的一句话

当前不是“系统还没开始 Formal”，也不是“O01 又卡住了”。

当前真实状态是：

```text
fresh v12 qualified
Graduation OPEN
Formal-v4 active
A0 PASS
O00 PASS/DEGRADED
O01 PASS/DEGRADED
O02 PASS/DEGRADED
O03 PASS/DEGRADED
O04 forcing ready
4/24 terminal complete
20 remaining
main exact and frozen at 26c1383...
```

下一位接手者最重要的工作不是开发，而是 **守住 exact main、每小时只做证据忠实的 watchdog、让自动 production path 把 O04→O23 跑完。**

在这 20 小时中，最大的风险不是“没加功能”，而是人为制造 main drift、重复 dispatch、错误解释 workflow green/no-op、或为了修非阻塞 control-plane debt破坏当前 active epoch。
