# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-26

更新时间：2026-08-26 02:30（UTC+8）

> **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY.** 本文只用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / qualification / epoch / Formal write 权限。若本文与 `docs/SSOT.md`、数字孪生总任务书、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、Neon live state、immutable artifact 或 repository machine gate 冲突，以后者为准。
>
> **本 handoff 特别重要的边界：** 当前 protected `main` 仍停留在 `26c1383f...`；v13 successor implementation 位于尚未合并的 Draft PR #3289；qualification control-plane 改造位于另一个 stacked branch。不要把三层状态混成同一个“当前 main”。

---

## 0. 当前快照 / 下一对话第一步

```text
repository:
liyongshang44-max/GEOX

protected_main:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

protected_main_merge:
PR #3286 — fix(mcft-cap09): bind Graduation to fresh v12 successor

protected_main_status:
protected
NO DRIFT observed at handoff

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

mcft_cap09_completed:
false
```

### 0.1 当前真正的三个层次

#### A. Repository authority / protected main

```text
main = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

它仍然包含的是 Formal-v4 / v12 predecessor world。

#### B. Frozen v13 successor implementation subject

```text
Draft PR:
#3289 — feat(mcft-cap09): establish v13 autonomous forcing foundation

branch:
fix/mcft-cap09-v13-autonomous-forcing-foundation

base:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

frozen exact head:
3bbf096ee5cb73e8e0e0251dc400733d6cab501f

state:
OPEN / DRAFT / NOT MERGED
mergeable:
true

commits:
77

changed files:
44

additions / deletions:
+8328 / -82
```

**重要：从现在开始不要再修改 #3289。**

`3bbf096e...` 已形成一次很难得的 exact-head 全绿 successor subject。继续改一行代码就会再次改变被资格化对象、SHA、dependency digest 和 check graph，应视为破坏 freeze。

#### C. 新的 qualification control-plane 设计/实现分支

```text
branch:
fix/mcft-cap09-qualification-control-plane-v1

base / starting SHA:
3bbf096ee5cb73e8e0e0251dc400733d6cab501f

purpose:
separate qualification-control-plane repair
NOT runtime repair
NOT Formal activation
NOT v13 store provisioning
```

该 branch 已建立，但本 handoff 时尚未落下 control-plane implementation commit。

### 0.2 下一对话的第一步

**不要重新审 runtime RCA。不要继续改 #3289。**

第一步应是：

1. 确认 protected `main` 仍为 `26c1383f...`；
2. 确认 #3289 仍冻结在 `3bbf096e...`；
3. checkout / inspect `fix/mcft-cap09-qualification-control-plane-v1`；
4. 按本文第 10 节冻结方案实现：
   - `MCFT_CAP09_CHECK_APPLICABILITY_V1`
   - `MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1`
   - `MCFT_CAP09_ALL_BLOCKERS_PREFLIGHT_V1`
   - control-plane authority manifest
   - PR-only meta-gate
5. 在 control-plane 通过前，**不要 provision v13 / blocked_v13 / Formal-v5 stores，不要做 production wiring，不要 arm Formal-v5。**

---

# 1. Authority 层级与不可混淆边界

当前仍沿用：

```text
docs/SSOT.md
= 唯一 repository-level SSOT

README_MIGRATION.md
= 仅 Sprint / Tag / Freeze 领域 authority

root README
= navigation only

master task:
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md

CAP-09 taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
```

不要把本 handoff、PR body、聊天结论或 acceptance artifact 单独提升成 repository authority。

当前 v13 candidate authority 文件位于 #3289：

```text
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json
```

其状态仍是：

```text
status = CANDIDATE
purpose = FRESH_T4R1_AUTONOMOUS_CAUSAL_FORMAL_V5_SUCCESSOR_AFTER_IRREVERSIBLE_V4_O08_NO_GO
```

它明确声明：

```text
v13 stores provisioned = false
formal-v5 store provisioned = false
timing budget qualified = false
v13 qualification executed = false
graduation gate open = false
formal-v5 epoch selected = false
A0 bootstrapped = false
O00 started = false
MCFT-CAP-09 completed = false
```

所以当前所有“绿灯”仅说明 **successor implementation subject 已自洽**，不是 v13 production qualification 完成。

---

# 2. Formal-v4 事故：最终状态与禁止动作

## 2.1 v12 qualification / Graduation / Formal-v4 基线

Qualification：

```text
generation:
v12 / blocked_v12

qualification run:
32754030057

artifact:
9530919886

digest:
sha256:33fab20c00177fb59b6dae5a29da846558bf720d4a7c9b28b71d60d960eb90d3

13/13:
PASS
```

Graduation：

```text
run:
32756208090

artifact:
9530934611

digest:
sha256:af4212d310ebfcf14f3fdf97a1118e873a68a68ca8ae2bb1d8fed7e239e63895

gate:
OPEN

opened:
2026-08-24T17:22:20.204Z
```

Formal arm：

```text
run:
32802900645

artifact:
9547121835

digest:
sha256:883e41f99cbf1552a9c63aa20bc9f33348c0ffa2344365dbecd62131ac58d976

formal DB:
geox_mcft_cap09_s6_formal_t4r1_24h_v4

epoch:
mcft_cap09_am19_formal_20260825030000000_26c1383f7f45

A0:
2026-08-25T03:00:00Z

O00:
2026-08-25T04:00:00Z
```

A0：

```text
run:
32802923974

artifact:
9547325945

status:
PASS
```

## 2.2 O00–O07

Formal-v4 成功形成的可继续 terminal ticks：

```text
O00 = DEGRADED
O01 = DEGRADED
O02 = DEGRADED
O03 = DEGRADED
O04 = DEGRADED
O05 = DEGRADED
O06 = DEGRADED
O07 = DEGRADED / A2_BLOCKED continuation
```

`DEGRADED` 本身不是 NO-GO。

O07 特别重要：

```text
logical time:
2026-08-25T11:00:00Z

run:
32841036304

artifact:
9560505463

digest:
sha256:6f2d55089789c2c3460fa75c5e796f333dc372161fca45d3bf73a302b798be4d

status:
DEGRADED

operation:
CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST

reason:
AMENDMENT19_CANONICAL_CORE_BLOCKED_FUTURE_FORCING

forecast parse:
FORECAST_FORCING_PARSE_FAILED: Expected 72 future forcing rows, got 71
```

它仍完成 current interval propagation，但没有形成下一 tick 所需要的完整 forcing continuation。

## 2.3 O08 irreversible NO-GO

```text
logical slot:
O08

logical time:
2026-08-25T12:00:00Z

run:
32846668961

event:
workflow_dispatch

artifact:
9562596508

digest:
sha256:40e7b5cbf35d7a65f52f7290b5587fb55ce0bd7eb6ad19abd6c3ac5551e9fc41

status:
FAIL

result.status:
BLOCKED_TERMINAL_RECORDED

detail:
AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR

claim:
true

terminal result recorded:
true

formal_epoch_no_go:
true

mcft_cap09_completed:
false
```

在 O08 后：

```text
Formal-v4 epoch = DEAD / AUDIT-ONLY
```

严禁：

```text
- rerun O08 as repair
- continue O09+
- late insert forcing into v4
- truncate or mutate v4 DB
- repair v4 epoch
- reuse v4 database for v5
- clone failed v4 data into v5
```

---

# 3. Frozen RCA：不要重新扩大审计

本轮 RCA 已经接受并冻结。除非 implementation 直接推翻某条假设，否则下一对话不要继续泛化 RCA。

## 3.1 Amendment-19 selector 本身没有错

冻结 selector：

```text
EXACT_PROVIDER_PAIR_ELSE_PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR_NO_WAIT_V1
```

禁止：

```text
arbitrary older snapshot fallback
71-point tolerance
timestamp relabel
late repair
```

当前 interval `(T-1h,T]` 的 Mode B 要求：

```text
coherent future-weather + future-ET0 pair
already available no later than T-1h
72-point window starts exactly at T-1h
H1 covers (T-1h,T]
```

没有 pair 就应该 fail/block。

因此 O08 selector failure 是正确 fail-closed，不应通过放宽 selector 修。

## 3.2 真正的 producer failure

旧 rolling target planner 实际等价于：

```text
target_t = ceil(now + 35min)
```

这导致 :25 之后会直接跳过 next-hour base。

典型事实：

```text
10:56 + 35min = 11:31
ceil → 12:00

=> base 11:00 被永久跳过
```

但 O08@12:00 需要 predecessor base=11:00。

所以真正问题是 producer continuity authority 不存在，不是 selector 太严格。

## 3.3 GitHub workflow concurrency 不是 durable temporal authority

旧 producer path 还存在：

```text
schedule wake
→ wall-clock planner
→ long capture
→ global concurrency queue
→ downstream evidence workflow dispatch
→ artifact download / rehydrate
→ Formal promotion
```

它不能保证 exact predecessor base 连续供给。

GitHub concurrency 只能做资源保护，不能替代：

```text
durable cursor
lease
fencing
per-base idempotency
causal deadline
```

## 3.4 v12 qualification 的逃逸

旧 persistent 24T qualification 虽然复用了 production scheduler/runner/tick/persistence core，但 `insertMainFixtures()` 预插了 24 个完美 forcing pair。

所以它证明的是：

```text
consumer graph works under perfect supply
```

没有证明：

```text
production producer supply graph can continuously supply exact predecessor bases
```

这就是为何 v12 13/13 PASS 仍然可能在真实 O08 NO-GO。

---

# 4. v13 最终 repair contract（已冻结）

不要再随意加第 7、第 8 个 runtime 模块。修复范围已经冻结为以下核心：

## 4.1 Independent forcing-base continuity cursor

Runtime cursor 与 forcing cursor 必须独立。

Runtime：

```text
logical tick T consumes forcing base T-1h
```

Forcing：

```text
next_missing_required_base
= last_contiguous_eligible_base + 1h
```

A0 warm start 后：

```text
A0 supplies O00
post-A0 producer supplies O00..O22 = 23 bases

O01 consumes O00
O02 consumes O01
...
O23 consumes O22
```

这条 off-by-one 不要再改错。

## 4.2 Two-level fencing

两种 token 不能混：

```text
epoch controller fence
= exactly one orchestrator for epoch

per-base producer fence
= exactly one authoritative writer for epoch+base
```

controller takeover 不应自动篡改一个仍合法存活的 per-base producer fence。

## 4.3 Next-tick viability

在 successor slot claim 之前必须读取：

```text
runtime cursor
forcing continuity cursor
exact predecessor forcing target
physical ingress attestation
```

如果 next base 不 viable：

```text
successor slot claim = forbidden
```

并且现在已进一步做到：

```text
predecessor terminal COMMIT
→ immediately adjudicate successor viability
→ predecessor forcing target durable terminal if deadline irrecoverable
→ successor never claims
```

## 4.4 Physical visibility authority

不能再把 payload `ingested_at` 当物理写入时间。

冻结证明：

```text
append facts
COMMIT
↓
fresh read-only DB transaction
re-read exact weather/ET0/soil facts
↓
DB clock
↓
post_commit_db_readback_at < base
```

并且 attestation/cursor 自己现在也必须：

```text
writer COMMIT
release writer connection
↓
fresh REPEATABLE READ READ ONLY connection
↓
read target + cursor
↓
DB clock < base
```

## 4.5 Formal facts INSERT 本身必须 fenced

不能只 fence heartbeat/phase/attestation。

不可逆 facts mutation 的 DB transaction 必须同时锁/验证：

```text
controller lease FOR UPDATE
producer target FOR UPDATE
controller token current
producer token current
target state = PROMOTING
both leases live
DB now < base
```

然后 3 facts 在同一事务中 append + COMMIT。

## 4.6 End-to-end timing authority

旧固定 35min 不能继续做 v5 authority。

冻结：

```text
FORMAL_FORCING_ACQUISITION_BUDGET_V1
```

它必须来自：

```text
real timing samples
controlled delay matrix
wake delay
queue/start
setup
provider capture
raw retention
candidate build
soil finalization
promotion
DB commit/readback
safety margin
```

不得拍脑袋改成 60min 或其它常量。

## 4.7 Workflow lifecycle

生产角色最终必须 exact-one owner：

```text
Formal tick executor
forcing controller
forcing producer
promotion
```

旧 workflow 不能只靠 rename “historical-retired”。

真正 retired：

```text
schedule = 0
live production dispatch = 0
production secrets = 0
provider writes = 0
Formal writes = 0
downstream production dispatch = 0
```

## 4.8 Producer-driven v13 qualification

禁止再预插 24 对 forcing。

Qualification execution graph 必须是：

```text
produce exact base
→ retain raw
→ canonicalize
→ promote exact 3 facts
→ post-COMMIT visibility proof
→ viability
→ runtime tick
→ next base
```

accelerated clock 只替代等待，不替代 execution graph。

---

# 5. #3289 已完成的 v13 implementation

#3289 已经明显超出最初“foundation only”范围，所以后续不要再把它描述成只做第一阶段。

当前实际包含：

```text
forcing-base continuity cursor
controller lifecycle lease/fence
per-base claim/lease/fence
qualified acquisition budget contract
atomic supply admission
physical ingress attestation
exact-base capture shim
fenced canonical facts promotion
autonomous forcing controller service
next-tick viability
v5 gated scheduler / runner seam
immediate successor adjudication
post-COMMIT adjudication failure isolation
29-table holistic schema candidate
EA5C1 successor maintenance revalidation
EA5E2 dependency graph convergence
legacy 24t applicability repair
```

## 5.1 Schema contract

最初 V3 authority 错写：

```text
26 → 28
new relations = 2
```

但 implementation 已新增第三张：

```text
twin_external_formal_forcing_controller_lease_v1
```

已修为：

```text
predecessor public tables = 26
v13 public tables = 29
exact new relations = 3

1. twin_external_formal_forcing_base_cursor_v1
2. twin_external_formal_forcing_base_target_v1
3. twin_external_formal_forcing_controller_lease_v1
```

Holistic PostgreSQL acceptance 不是 source-string check，而是真实构造 canonical predecessor 26-table chain：

```text
001_schema.sql
→ 2026_07_09_mcft_cap_01_a0_persistence.sql
→ 2026_07_10_mcft_cap_01_closure_remediation.sql
→ continuity migration
→ admission migration
→ lifecycle migration
```

然后直接查：

```text
information_schema.tables
pg_catalog columns
constraints
indexes
```

## 5.2 DB-level controller/producer fencing

两个 P1 blocker 中最严重的一项已修：

旧 service promotion port 没有收到 controller/producer authority，理论上 stale controller 可能在 heartbeat 已失权后继续完成 Formal facts INSERT。

新 contract：

```text
promoteExactBase(...)
必须收到 controller_lease + producer_claim
```

真正 INSERT boundary 在 PostgreSQL transaction 内再次验证双 fence。

Race acceptance 已覆盖：

```text
controller A pause before insert
A lease expires
controller B takeover
resume A
→ facts delta = 0
→ cursor delta = 0
→ attestation delta = 0
```

也覆盖 producer fence takeover。

## 5.3 Promotion recovery semantics

不要把 promotion success 定义成“本次新写 3 facts”。

合法 crash recovery 可能是：

```text
3 facts 已 COMMIT
process dies before attestation
restart
3 ingress = EXISTING_IDEMPOTENT_SUCCESS
```

所以成功条件已经改成：

```text
database_fence_commit_succeeded = true
formal_fact_present_count = 3
exact identities match
```

new write count 可为 0..3。

## 5.4 Promotion failure classification

只有明确证明：

```text
NO_FORMAL_MUTATION
write_count = 0
```

才允许 `FAILED_RETRYABLE`。

如果：

```text
partial mutation
unknown COMMIT outcome
```

必须 fail-closed / terminal，不得乐观 retry。

## 5.5 Heartbeat tail

旧 loop：

```text
sleep(interval)
operation completes
stop=true
await heartbeatLoop
```

可能白耗一个 heartbeat interval。

已改为可取消 timer/wake mechanism，operation 完成可立即进入 attestation。

## 5.6 Post-COMMIT successor adjudication double-terminal hazard

发现并修掉一个重要边界：

旧组合：

```text
v3 runner try/catch
  tick execution
  recordTerminalResult

v5 scheduler recordTerminalResult
  predecessor COMMIT
  successor adjudication
```

如果 successor adjudication 在 predecessor 已 COMMIT 后抛基础设施错误，异常会穿回 v3 catch，导致尝试第二次 terminalize predecessor。

修后：

```text
predecessor terminal COMMIT
→ successor adjudication error isolated in v5 scheduler
→ v3 runner returns
→ v5 runner checks post-COMMIT adjudication outcome
→ failure propagates from v5 layer
→ predecessor terminal write count remains exactly 1
```

focused machine proof：

```text
predecessor_terminal_commit_count = 1
successor_adjudication_attempt_count = 1
post_commit_adjudication_failure_does_not_reterminalize_current_slot = true
```

---

# 6. #3289 exact-head proof status

冻结 head：

```text
3bbf096ee5cb73e8e0e0251dc400733d6cab501f
```

该 exact head 已形成：

```text
normal build/typecheck/server selfcheck = PASS
full commercial acceptance = PASS
holistic v13 schema PostgreSQL = PASS
controller contract/lifecycle = PASS
controller-fenced mutations = PASS
forcing supply admission = PASS
fenced fact promotion = PASS
autonomous controller service = PASS
exact-base capture shim = PASS
exact-base fact promotion = PASS
real PostgreSQL next-tick viability = PASS
post-COMMIT successor-adjudication failure proof = PASS
EA5C1 durable raw restricted ingress = PASS
EA5E2 runtime dependency graph = PASS
EA5E2 successor runner qualification = PASS
legacy Amendment-19 persistent-24T gate = PASS in v13-maintenance-successor mode
```

不要把 legacy gate PASS 解释成 v13 persistent qualification。

该 legacy run 中：

```text
historical persistent orchestration typecheck = SKIPPED
T3R1 credential seed proof = SKIPPED
historical orchestration selftests = SKIPPED
persistent-live = SKIPPED
```

它只是说明：

```text
v13 maintenance did not require re-executing frozen historical orchestration
```

不是：

```text
v13 qualification complete
```

---

# 7. 这轮最重要的新根因：qualification graph topology 错了

这是本 handoff 最需要下一对话继承的结论。

**真正让 MCFT-9 看起来“一直修不对”的主要原因已经不是 runtime。**

更准确地说：

```text
historical frozen qualification evidence
+
current successor maintenance
+
future v13 production qualification
```

长期混在同一套 active check graph 里。

## 7.1 典型反例：legacy persistent-24t workflow

为了让 #3289 能通过，旧 workflow 被迫加入：

```text
historical_sensitive_regex
v13_marker_regex

historical-am19
v13-maintenance-successor
t4-runtime-rebind-successor
runtime-rebind-routing-repair
```

然后 `v13-maintenance-successor` 会把旧历史步骤 SKIP。

这作为短期止血是正确的，但不应成为长期 Formal authority。

原因：真实依赖不是“几个文件名”，而是：

```text
qualification runner
→ service
→ core
→ selector
→ repository
→ schema
→ config
→ external contracts
```

手工 regex 很容易漏掉 shared dependency。

## 7.2 whack-a-mole qualification loop

这轮实际出现的开发循环：

```text
修 runtime
↓
旧 qualification gate 被触发
↓
修 applicability
↓
HEAD SHA 变化
↓
dependency digest 变化
↓
修 graph carrier
↓
后一个 serial prerequisite 第一次开始运行
↓
暴露下一条旧 SHA / fixture / generation blocker
↓
继续 commit
```

大量 commit 实际不是新业务功能，而是在追逐 machine gates：

```text
align v13 foundation machine proof
rebind EA5E2 runtime graph
converge v13 exact-head qualification
align v13 legacy acceptance routing
bind v13 post-commit visibility proof
bind exact-head successor qualification
route legacy 24t gate for v13 maintenance
keep legacy 24t routing diff scoped
```

## 7.3 checks 串行 fail-fast 导致 blocker 一个个暴露

典型：

```text
EA5E2 successor runner qualification
→ dependency graph FAIL
→ actual successor qualification SKIPPED
```

修 graph 后，后面的 qualification 才第一次真正执行。

所以开发无法在动手前看到完整 blocker set。

这不利于 development preflight。

## 7.4 historical evidence 与 current required gate 没有正确分层

EA5C1 的修复方向是正确示范。

旧模式：

```text
要求 7 月历史 exact SHA
成为今天 successor 的 exact-head requirement
```

新模式：

```text
EXACT_HISTORICAL_CANDIDATE
or
SUCCESSOR_MAINTENANCE_REVALIDATION
```

Successor 只证明：

```text
historical authority unchanged
raw adapter unchanged
historical focused acceptance unchanged
current predecessor contracts not silently mutated
restricted ingress maintenance reruns real I/O proof
```

这才是正确 carry-forward/requalification 思路。

## 7.5 PR scope creep

#3289 最初说“foundation”，实际最终包含 controller/viability/v5 seam 等第二阶段能力。

这说明完成定义在开发过程中移动。

对于普通项目只是管理问题；对 exact-SHA/digest-bound Formal 系统会直接导致：

```text
commit changes
→ subject changes
→ digest changes
→ qualification identity changes
→ more gates invalidate
```

所以以后 PR scope 必须在 coding 前冻结。

---

# 8. 工作方法必须改变

以后不要再：

```text
commit
→ 看 CI 红什么
→ 修什么
→ 再 commit
```

CI 不能继续充当 debugger。

必须先有两张不同的图：

## 8.1 ENFORCEMENT GRAPH

生产/merge enforcement 仍然允许：

```text
fail-fast
fail-closed
```

## 8.2 DIAGNOSTIC GRAPH

开发 preflight 必须：

```text
non-short-circuit
all blockers enumerated in one run
```

即使 check A FAIL，也继续计算 B/C/D/E 的 applicability 和当前 blocker。

---

# 9. 新的 qualification control-plane：冻结设计

这是下一阶段真正要实现的方案。

**不要把它塞回 #3289。**

在独立 branch：

```text
fix/mcft-cap09-qualification-control-plane-v1
```

实现以下对象。

## 9.1 `MCFT_CAP09_CHECK_APPLICABILITY_V1`

职责只有一个：

```text
给定 base/head/generation/authority/dependency/evidence
一次计算全部 checks 是否适用
```

建议输入：

```text
base_sha
head_sha
changed_paths
generation
authority_generation
store_generation
workflow_generation
dependency_graphs
historical_evidence_registry
```

输出每个 check：

```text
check_id
status:
  REQUIRED
  CARRY_FORWARD
  REQUALIFY
  NOT_APPLICABLE
  FORBIDDEN
  UNKNOWN

reason_code
authority_ref
dependency_refs[]
historical_evidence_ref
historical_digest
subject_digest
```

硬约束：

```text
UNKNOWN → FAIL_CLOSED
```

绝不能默认 N/A。

### Applicability 计算不能靠 scattered YAML regex

有正式 dependency graph 的 check：

```text
必须消费 graph closure
```

例如 EA5E2 已有：

```text
ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs
```

它会实际计算 closure 与 digest。

control plane 应复用这一类 authority，而不是另写 `historical_sensitive_regex`。

## 9.2 `MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1`

管理 historical immutable evidence。

建议字段：

```text
evidence_id
check_id
generation
subject_sha
authority_sha
dependency_digest
artifact_digest
qualification_status
superseded_by
carry_forward_policy
requalification_triggers
immutable_evidence_refs[]
```

以后 v13→v14 不再靠人工搜索旧 YAML / commit 判断能否继承。

Resolver 自动判断：

```text
dependency unchanged
→ CARRY_FORWARD

dependency affected
→ REQUALIFY

generation forbidden
→ FORBIDDEN

cannot determine
→ UNKNOWN / FAIL_CLOSED
```

## 9.3 `MCFT_CAP09_ALL_BLOCKERS_PREFLIGHT_V1`

必须故意 non-fail-fast。

目标输出示例：

```text
subject_sha: ...
generation: v13

total checks: 18
required: 12
carry_forward: 3
requalify: 2
not_applicable: 1
unknown: 0

PASS:
...

FAIL:
1. END_TO_END_TIMING_BUDGET
2. EXACT_ONE_PRODUCTION_OWNER
3. V13_STORE_ZERO_STATE

CARRY_FORWARD:
EA5C1_HISTORICAL_AUTHORITY
  digest: ...
  reason: dependency closure unchanged
```

这份 preflight 不负责执行 live qualification；它负责在开发开始前一次性列出完整 blocker inventory。

## 9.4 control-plane authority manifest

不要把 check definitions 散在几十个 workflow。

需要一个中央 machine-readable manifest，至少声明：

```text
check id
owner
generation scope
authority refs
dependency resolver
historical evidence policy
execution workflow
fail policy
carry-forward policy
requalification trigger
```

## 9.5 PR-only meta-gate

第一阶段只建立 control-plane 自证，不立刻改所有旧 workflow。

PR-only meta-gate 应验证：

```text
- planner deterministic
- unknown path fail closed
- no execution side effect
- no production workflow dispatch
- all registered check ids unique
- all dependency refs resolvable
- evidence registry immutable references resolvable
- non-fail-fast blocker inventory complete
```

然后再逐步让旧 workflows 变成：

```text
consume applicability plan
not invent applicability
```

---

# 10. control-plane 第一版的实现顺序（已决定）

下一对话不要自由发挥，按以下顺序：

## Phase CP-0 — frozen subject verification

```text
verify #3289 head = 3bbf096e...
verify #3289 still unmodified
verify control-plane branch starts from 3bbf096e...
```

## Phase CP-1 — central manifest / evidence registry

先落：

```text
MCFT_CAP09_CHECK_APPLICABILITY authority manifest
MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1
```

先只注册当前最容易验证的 check families：

```text
EA5C1 historical ingress evidence
EA5E2 runtime dependency graph
legacy Amendment-19 persistent-24T historical evidence
v13 successor implementation gates
```

不要一开始注册整个仓库所有 MCFT checks。

## Phase CP-2 — resolver

实现 deterministic resolver：

```text
base/head diff
+ dependency closure
+ evidence registry
+ generation
→ applicability plan
```

至少能证明：

```text
EA5C1 ingress changed
→ REQUALIFY

EA5E2 closure unchanged
→ CARRY_FORWARD

historical 24t source unchanged under v13 successor
→ NOT_APPLICABLE / historical evidence carry-forward

unknown shared dependency
→ UNKNOWN / FAIL_CLOSED
```

## Phase CP-3 — all-blockers preflight

不执行 live jobs，只调用/读取 machine gates 能在本地静态/isolated 环境判定的部分，汇总所有 blocker。

**关键：一个失败不能阻止其它 blocker 计算。**

## Phase CP-4 — meta acceptance

必须打这些 case：

```text
known unchanged dependency
known changed dependency
historical evidence mutated
unknown changed path
shared dependency newly introduced
check registry duplicate id
missing authority ref
missing evidence artifact ref
N/A generation
FORBIDDEN failed-v4 reuse
```

## Phase CP-5 — workflow migration

只有 control plane 自己稳定后，才逐条迁移旧 workflows：

```text
workflow reads planner output
→ REQUIRED: execute
→ CARRY_FORWARD: verify immutable evidence digest
→ REQUALIFY: execute full qualification
→ NOT_APPLICABLE: machine-recorded skip
→ FORBIDDEN/UNKNOWN: fail
```

不要一次性重写几十个 YAML。

---

# 11. #3289 之后真正的 v13 activation sequence

**control-plane 修好并不等于 v13 qualification完成。**

当前 authority 的 activation sequence 仍然是：

```text
1. MERGE_EXACT_V13_SUCCESSOR_SUBJECT
2. CAPACITY_PREFLIGHT_AND_SAFE_SUPERSEDED_GENERATION_CLEANUP_IF_REQUIRED
3. PROVISION_ZERO_STATE_V13_BLOCKED_V13_AND_FORMAL_V5_STORES
4. RUN_PRODUCER_DRIVEN_V13_QUALIFICATION
5. FREEZE_EXACT_HEAD_END_TO_END_TIMING_BUDGET
6. OPEN_NEW_MACHINE_ONLY_GRADUATION_GATE
7. PROVE_EXACT_ONE_PRODUCTION_OWNER_AND_RETIRED_TRIGGER_ZERO
8. ARM_FRESH_V5_EPOCH
9. BOOTSTRAP_FRESH_A0
10. RUN_REAL_WALL_CLOCK_O00_O23_WITH_ZERO_ROUTINE_MANUAL_RESCUE
11. RUN_AUTOMATIC_FINAL_READBACK
12. FINAL_READ_ONLY_COMPLETION_ADJUDICATION
```

本轮新增决定：

**在步骤 1/2 之间或 merge 决策前，先用 qualification control-plane 生成完整 applicability + blocker inventory。**

不要再盲目进入 fresh store/qualification 后靠 CI 一个个发现 blocker。

---

# 12. Capacity / Neon 注意事项

此前审计曾发现 Neon capacity headroom 很小（约 84 MiB 量级）。

**这个值在本 handoff 写入时没有重新实时查询 Neon，因此不要把 84 MiB 当当前精确值。**

但容量原则冻结：

```text
before v13/blocked_v13/Formal-v5 provision
→ capacity preflight mandatory
```

严禁为了容量直接删除：

```text
v12 current qualification evidence
failed Formal-v4 evidence
```

只能在 exact inventory 证明“old qualification generation 已 superseded 且不再承载 authority/evidence chain”后清理旧 generation。

---

# 13. Workflow freeze / production safety

事故后已经停掉过的生产相关 workflows 不要在 control-plane 开发时重新 enable。

Control-plane branch 的硬 non-effect：

```text
provider request = 0
Formal DB write = 0
production scheduler mutation = 0
workflow activation = 0
store provision = 0
Graduation = 0
Formal epoch selection = 0
```

新 control-plane PR 第一阶段只能是：

```text
static / isolated / read-only / PR-only
```

---

# 14. 踩过的坑与必须避免的错误模式

## Pitfall 1 — 把 CI 当 debugger

错误：

```text
commit → 看红灯 → 修一个 → 再 commit
```

正确：

```text
先 ALL_BLOCKERS_PREFLIGHT
→ 一次拿完整 blocker set
→ 一次规划变更批次
```

## Pitfall 2 — 旧 check graph 串行遮住后续 blocker

错误：

```text
A FAIL
→ B/C/D skipped
```

开发诊断必须 non-fail-fast。

## Pitfall 3 — 用 filename regex 充当 dependency authority

短期 routing 可以有 regex；长期 Formal applicability 不允许依赖手工文件列表。

必须基于：

```text
formal dependency closure
registered authority refs
historical evidence registry
```

## Pitfall 4 — historical exact SHA 被当成永恒 current-head requirement

历史证据应 immutable。

当前 successor 只做：

```text
unchanged → carry forward
changed → explicit requalification
not applicable → machine N/A
unknown → fail closed
```

## Pitfall 5 — scope creep

#3289 从 foundation 扩到 controller/v5 seam，导致完成定义移动。

以后：

```text
freeze PR contract before coding
```

超出 scope 的新模块必须 stacked PR。

## Pitfall 6 — 改一个 gate 导致 subject SHA/digest 连锁漂移

在 exact-SHA 系统中，每个 commit 都会改变资格对象。

所以要尽量：

```text
pre-audit whole graph
batch coherent changes
freeze exact head
then qualify
```

## Pitfall 7 — 为绿灯直接抄新的 digest

只有在：

```text
closure exact
missing = 0
uncovered = 0
changed closure files explained
相关 real regression proof PASS
```

后才可 rebind digest。

EA5E2 本轮就是这样处理的。

## Pitfall 8 — 为旧 historical workflow 恢复废弃 authority alias

曾考虑为了旧 24t source `_V3` import 恢复 alias，但这会制造“V3 名称 / V4 值”的假 authority。

正确做法是修 applicability，不复活废弃 production authority surface。

## Pitfall 9 — 只 fence control state，不 fence irreversible facts INSERT

必须在 Formal facts transaction 内验证 controller+producer fence。

## Pitfall 10 — 认为 payload ingested_at 是 commit time

不是。

真正物理可见性必须 fresh transaction readback + DB clock。

## Pitfall 11 — attestation timestamp 在 COMMIT 前检查就算完成

不够。

attestation/cursor 自己也必须 COMMIT 后 fresh readback。

## Pitfall 12 — successor adjudication error 导致 predecessor double-terminal

已经加 machine proof；以后 v5 seam 重构必须保留：

```text
predecessor terminal write count = exactly 1
```

## Pitfall 13 — 认为 legacy persistent-24T green = v13 qualification green

绝对错误。

`persistent-live = SKIPPED`，当前还没有 producer-driven v13 qualification。

---

# 15. 当前 GO / NO-GO 判断

## v13 runtime architecture / implementation

```text
GO as frozen successor subject
```

不是说它已 effective；只是 #3289 的 exact subject 已具备进入下一阶段的实现质量。

## #3289 further modification

```text
NO-GO
```

冻结，不再加 control-plane 代码。

## qualification control-plane redesign

```text
GO
```

必须独立 stacked branch/PR。

## v13 store provision / live qualification right now

```text
NO-GO until control-plane blocker inventory + merge/authority sequence resolved
```

## Formal-v5 arm / A0 / O00

```text
NO-GO
```

## MCFT-CAP-09 completion

```text
false
```

---

# 16. 下一对话建议执行清单

```text
[ ] verify main == 26c1383f...
[ ] verify #3289 == 3bbf096e... and do not modify
[ ] inspect fix/mcft-cap09-qualification-control-plane-v1
[ ] create central check applicability manifest
[ ] create historical qualification evidence registry
[ ] implement deterministic applicability resolver
[ ] implement non-fail-fast all-blockers preflight
[ ] add unknown-path fail-closed acceptance
[ ] add carry-forward / requalify / N/A / forbidden cases
[ ] add PR-only meta-gate
[ ] open separate Draft PR for control-plane only
[ ] do NOT migrate old workflows until planner self-proof is green
[ ] once stable, migrate one check family at a time
[ ] generate complete v13 blocker inventory before fresh store provisioning
```

---

# 17. 关键 refs / branches / PRs

```text
protected main:
26c1383f7f45abb76c99e28ec3d06714e85d1b2c

failed Formal-v4 O08 run:
32846668961

failed Formal-v4 artifact:
9562596508

failed Formal-v4 digest:
sha256:40e7b5cbf35d7a65f52f7290b5587fb55ce0bd7eb6ad19abd6c3ac5551e9fc41

v13 successor Draft PR:
#3289

v13 successor branch:
fix/mcft-cap09-v13-autonomous-forcing-foundation

frozen v13 successor head:
3bbf096ee5cb73e8e0e0251dc400733d6cab501f

qualification control-plane branch:
fix/mcft-cap09-qualification-control-plane-v1

qualification control-plane starting SHA:
3bbf096ee5cb73e8e0e0251dc400733d6cab501f
```

---

# 18. 一句话交接

**MCFT-9 当前已经不再是“runtime 修不好”的问题。Formal-v4 O08 的 producer continuity / fencing / physical visibility / successor viability 根因已经在 frozen v13 successor #3289 中形成一套扎实修复；现在真正的工程 frontier 是重构 qualification control plane，把 historical evidence、current successor maintenance、future v13 production qualification 从同一套散乱/串行/regex-driven check graph 中分层，建立中央 applicability resolver、immutable evidence registry 和 non-fail-fast all-blockers preflight。只有完成这一层，才应该进入 fresh v13 stores → producer-driven qualification → timing qualification → Graduation → Formal-v5。**
