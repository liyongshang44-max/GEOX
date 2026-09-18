# 2026-09-18 H3/H4/H5 CLOSURE — FORMAL-V5 ARM READY / EXPLICIT OPERATOR AUTHORIZATION RECEIVED

> 用途：conversation continuation only。
> 本节不是 architecture authority、production runtime authority、production-owner authority、Formal-v5 arm authority、A0 authority 或 O00-O23 authority。
> 落库纪律：PURE PREPEND 到既有 continuation 文件；下方既有全文保持 exact suffix；原 8/27 canonical handoff（含 AH）继续不动；本次不改工程文件。
> 本节记录的是截至 2026-09-18T17:44Z 左右已经机器证明的最新现场事实；优先于下方所有历史 SHA、blocker、container 状态与 next-step 快照。

## A. 当前结论

MCFT-CAP-09 已完成 production owner graduation 与 Formal-v5 post-graduation arm readiness，当前 exact protected main 为：

```text
2ce0c90ef30b3c04ed112639c87926ac19be4e03
```

当前机器裁决：

```text
H2A non-owner standby materialization
= PASS

local production-host machine admission
= PASS

H2B production host secret-binding physical proof
= PASS

H3 current-main production owner cutover
= PASS

H4 live fenced-owner provenance + renewal
= PASS

H4 legal current-main GFS in-flight >300s
= PASS

H5 Formal-v5 post-graduation arm readiness
= PASS

formal_v5_arm_ready
= true

separate_explicit_operator_authorization_still_required
= true
```

同时仍严格保持：

```text
Formal-v5 arm
= FALSE

Formal-v5 epoch selected
= FALSE

formal database mutation
= FALSE

A0 bootstrap
= FALSE

O00 started
= FALSE

MCFT-CAP-09 complete
= FALSE
```

因此 H5 所要求的 HARD STOP 已经命中。

在本次 handoff 更新请求中，operator 已随后明确给出新的独立指令：

```text
先补进handoff，然后开始formalv5
```

这构成后续 Formal-v5 arm 的 separate explicit operator authorization，但本 handoff 文档本身不构成该 authority，也不表示 Formal-v5 已经执行。实际 arm 必须在本次 handoff 提交完成后重新绑定 protected main、current-crop、live owners、zero-state 与 repo-native Formal-v5 arm 入口后再执行。

## B. 从旧 production stale state 到 H5 的闭合证据

### B1. stale production runtime 已被确认为旧 subject 并受控清除

最初 local exact-main guard 命中两个遗留 production containers，但两者实际 subject 均为旧 main：

```text
running stale subject
= 1137e327df07011ec54186feb88d7a544301fe70

current protected main
= 2ce0c90ef30b3c04ed112639c87926ac19be4e03
```

旧 Evidence container：

```text
restart_count = 492
status = restarting
first deterministic durable-log red =
PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW:2026-09-18T16:00:00.000Z
```

旧 Twin container 保持 PRE_FORMAL_OWNER_STANDBY / OWNER_LEASE_HEALTHY。

两个旧 containers 被严格按 compose project
`geox-mcft-cap09-production-v1` 清除；没有 docker prune，没有 DB UPDATE/DELETE，没有 retry schedule mutation。

旧 Evidence/Twin leases 随后按各自 expires_at 自然失效：

```text
PRODUCTION_CONTAINERS=0
EVIDENCE_LIVE_LEASES=0
TWIN_LIVE_LEASES=0
STALE_RUNTIME_CLEAR=PASS
```

### B2. H2A / host admission / H2B

exact main：

```text
2ce0c90ef30b3c04ed112639c87926ac19be4e03
```

H2A materialization：

```text
status = PASS
materialization_only = true
runtime_started = false
activation_fence_time = 2026-09-18T17:21:34.138Z
formal_a0_logical_time = 2026-09-18T18:00:00.000Z
production_owner_activation_authorized = false
formal_v5_arm_authorized = false
a0_authorized = false
o00_authorized = false
```

第一次 local host admission 唯一 first-red 为 Windows Time service 停止：

```text
LOCAL_PREFLIGHT_WINDOWS_TIME_SERVICE_RUNNING_REQUIRED
LOCAL_PREFLIGHT_TIME_SOURCE_REQUIRED
LOCAL_PREFLIGHT_TIME_STATUS_REQUIRED
```

只修主机时间服务，不改仓库、不改 NTP authority；启动 W32Time 后：

```text
source = time.windows.com,0x9
status readable = true
local host machine admission = PASS
```

H2B physical proof：

```text
status = PASS
stage = PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY
exact_two_runtime_service_identities_bound = true
runtime_secret_binding_count = 7
evidence_database_connectivity_proven = true
twin_database_connectivity_proven = true
exact_one_privilege_membership_each_proven_by_current_credentials = true
cross_plane_privilege_forbidden_proven = true
r2_bucket = geox-mcft-cap09-evidence-runtime-v1
r2_formal_bucket_reused = false
PUT/HEAD/DELETE/post-delete HEAD = 200/200/204/404
compose_render_only_pass = true
production_container_count_before/after = 0/0
pre_owner_cutover_ready = true
```

### B3. H3 — current-main production owner cutover

repo-native cutover result：

```text
status = PASS
deployment_subject_sha = 2ce0c90ef30b3c04ed112639c87926ac19be4e03
host_id = fae5f756-ef25-40d5-9777-5b2c3d4837a1
activation_fence_time = 2026-09-18T17:25:56.774Z
formal_a0_planning_time = 2026-09-18T19:00:00.000Z
runtime_processes_started = true
evidence_owner_activation_observed = true
twin_owner_activation_observed = true
twin_mode = PRE_FORMAL_OWNER_STANDBY
formal_v5_arm = false
a0_execution = false
o00_started = false
mcft_cap09_completed = false
```

两个 live containers：

```text
Evidence container = 4a4b78d40a09
Twin container     = e17a50773bb3
image tag          = geox-mcft-cap09-runtime:2ce0c90ef30b3c04ed112639c87926ac19be4e03
restart_count      = 0 / 0
```

immutable local image：

```text
sha256:4443a7a02570efd20cfd5ae6ad40c2bf924144bd1b6468796a6521563e880714
```

### B4. H4 — exact-one live fenced owners + legitimate current-main GFS >300s

repo-native live owner verifier：

```text
status = PASS
adjudication =
EXACT_ONE_EFFECTIVE_OWNER_PER_RUNTIME_ROLE_WITH_CONTAINER_IMAGE_HOST_AND_RENEWAL_PROVEN
```

Evidence T1→T2：

```text
same effective owner = true
same container       = true
same image           = true
heartbeat advanced   = true
expiry advanced      = true
health               = HEALTHY
```

Twin T1→T2：

```text
same effective owner = true
same container       = true
same image           = true
heartbeat advanced   = true
expiry advanced      = true
health               = OWNER_LEASE_HEALTHY
mode                 = PRE_FORMAL_OWNER_STANDBY
```

current-main GFS durable state：

```text
target = 2026-09-18T19:00:00Z
attempt_count = 1
last_attempt_started = 2026-09-18T17:29:51.917Z
target_class = CURRENT_RUNTIME_WARM_START_A0_TARGET
writer owner/fence = current live Evidence owner/fence
```

在 read-only 观察时：

```text
Evidence structured health
= HEALTHY / ATTEMPT_IN_PROGRESS

same attempt age
= 527s

H4_GFS_OBSERVATION
= LEGAL_TARGET_WITH_RUNTIME_ATTEMPT_IN_PROGRESS
```

没有强制 provider attempt，没有 retry reset，没有制造 attempt #4。

该证明应精确表述为：合法 current-main GFS canonical attempt/cycle 在 live Evidence owner 下持续 in-flight 超过 300 秒。不要扩大成“单个 HTTP 请求持续 >300 秒”的未经单独建立的事实。

### B5. H5 — Formal-v5 post-graduation arm readiness

exact-main GitHub zero-state workflow：

```text
run_id = 35370329903
job = formal-v5-post-graduation-readiness
conclusion = success
```

zero-state artifact：

```text
artifact_id = 10558076380
name = mcft-cap09-formal-v5-post-graduation-zero-state-2ce0c90ef30b3c04ed112639c87926ac19be4e03
digest = sha256:16d1d864d21fd0afe8532585346a6ad1fe3c6922bb719c423e87ac76228bc2ef
expired = false
```

artifact 内容：

```text
formal_database_name = geox_mcft_cap09_s6_formal_t4r1_24h_v5
required_role = FRESH_FORMAL_STORE_ONLY
required_pre_arm_state = ZERO_STATE_PRE_ARM
transaction_read_only = true
public_base_table_count = 0
public_routine_count = 0
formal_database_mutation = false
formal_v5_arm = false
formal_v5_epoch_selected = false
a0_bootstrap = false
o00_started = false
```

local repo-native H5 verifier 又重新执行 live owner proof，并最终输出：

```text
status = PASS
deployment_subject_sha = 2ce0c90ef30b3c04ed112639c87926ac19be4e03
zero_state_proof_subject_sha = 2ce0c90ef30b3c04ed112639c87926ac19be4e03
public_base_table_count = 0
public_routine_count = 0
exact_one_live_fenced_owner_per_runtime_role_reverified = true
formal_v5_arm_ready = true
separate_explicit_operator_authorization_still_required = true
formal_v5_arm = false
formal_v5_epoch_selected = false
formal_database_mutation = false
a0_bootstrap = false
o00_started = false
mcft_cap09_completed = false
```

## C. 当前下一步 — operator 已显式授权开始 Formal-v5

handoff 更新之后，执行顺序必须是：

```text
re-fetch protected main
-> require exact main = 2ce0c90e...
-> require clean worktree
-> require both production containers still exact-main/running
-> require live Evidence/Twin owner re-verification
-> require current-crop authority still covers newly selected Formal-v5 A0
-> require Formal-v5 zero-state still true
-> use repo-native Formal-v5 arm path only
-> capture exact first effect / first red
-> do NOT skip directly to O00
```

如果 protected main、crop authority、live owner、zero-state 任一项漂移，必须 fail closed 并重新裁决；不得沿用本节历史 PASS 绕过执行时检查。

特别禁止：

```text
manual DB schema/bootstrap mutation
manual lease edits
manual GFS retry reset
manual epoch invention
reuse failed Formal-v4 store
skip repo-native arm path
declare MCFT-CAP-09 complete
```

Formal-v5 arm 之后仍必须按 taskbook/Amendment-19 的正式执行链继续 A0 -> O00-O23；仅 arm 本身不构成 Stage 1B closure。

---

# 2026-09-18 接手更新 — #3599 GFS EXHAUSTED-TARGET PLANNER CLOSURE / FINAL PRE-FORMAL-V5 ARM PATH

> 用途：conversation continuation only。
> 本节不是 architecture authority、production runtime authority、production-owner authority、Formal-v5 arm authority、A0 authority 或 O00-O23 authority。
> 落库纪律：继续 PURE PREPEND 到既有 continuation 文件；下方既有全文保持 exact suffix；原 8/27 canonical handoff（含 AH）继续不动；不新建 handoff，不绕到 main，不修改工程文件。
> 核验时点：2026-09-18T15:57Z 左右（UTC）。
> 本节优先于下方所有历史快照；历史 SHA、blocker、container 状态和 next step 不得重新当作当前事实。

## A. 当前正在做什么

MCFT-CAP-09 当前唯一 active frontier 仍是：

```text
FINAL PRE-FORMAL-V5 ARM CLOSURE
```

但当前最前面的工程子任务已经具体收敛为：

```text
close exhausted-current-target GFS planner defect
-> exact-head #3599 qualification
-> exact-head merge only after all required gates green
-> new protected-main post-merge qualification / zero-state
-> local exact-main rematerialization + H3
-> real legitimate GFS in-flight >300s physical proof
-> H4 live fenced-owner proof
-> H5 formal_v5_arm_ready=true
-> HARD STOP
```

当前仍严禁：

```text
Formal-v5 arm
A0
O00-O23
MCFT-CAP-09 completion declaration
```

B-Line 继续 ENGINEERING CLOSED / FROZEN；ADR 继续 PARKED。不要重新打开其它工程线。

## B. 已经完成的关键事实

### B1. #3597 — Evidence long in-flight owner keepalive 已取得真实 production proof

此前已修复 Evidence runtime 在单次长 provider/GFS attempt 内无法回到 host loop、导致 300 秒 owner lease/structured health 过期的问题。

#3597 已合并，runtime 现在在 in-flight attempt 内执行 bounded keepalive：

```text
300s lease
-> renew every 60s
-> emit HEALTHY / ATTEMPT_IN_PROGRESS
-> preserve same-owner / same-fence freshest claim
```

该修复不是只靠 CI 证明；在真实 Windows production host + real Neon + real GFS attempt 上已经观测到：

```text
GFS started_at
= 2026-09-18T14:46:19.178Z

same attempt age
= 306s

health
= ATTEMPT_IN_PROGRESS

Evidence heartbeat
= 2026-09-18T14:50:38.495737Z

Evidence expires
= 2026-09-18T14:55:38.495737Z

GFS_INFLIGHT_GT_300_SECONDS
= PASS
```

因此原始“长 GFS attempt 导致 Evidence lease 过期”的 runtime defect 已被真实 physical proof 命中并证明修复。

但是该旧 physical proof 绑定的 subject 不是当前最终 main，不能直接作为最终 H4/H5 closure subject。

### B2. #3598 — H4 Twin health predicate harness defect 已修并合并

#3597 physical proof 后，H4 first-red 转为：

```text
OWNER_TWIN_T1_PROVENANCE_REQUIRED
```

现场 Neon 表明 Twin lease 实际仍 live 并持续 heartbeat/expiry；根因是 production Twin 在：

```text
PRE_FORMAL_OWNER_STANDBY
```

合法输出：

```text
status = OWNER_LEASE_HEALTHY
```

而旧 H4 verifier 只接受：

```text
HEALTHY
BACKPRESSURE
```

#3598 已将 `OWNER_LEASE_HEALTHY` 纳入 Twin ready health predicate，同时保留对 `LEASE_HELD_BY_OTHER_OWNER` 的 negative rejection；并修复 Formal-v5 readiness harness 错误要求 workflow 自身必须出现在 changed_dependencies 的断言。

#3598 已 exact-head merge，形成当前 #3599 的 base main：

```text
1137e327df07011ec54186feb88d7a544301fe70
```

#3598 不改变 Twin runtime、Evidence runtime、数据库、lease cadence、current-crop、Formal-v5、A0 或 O00 语义。

### B3. 新 production first-red — exhausted current GFS target 被重复规划

在 #3598 后续 production 诊断中，Evidence runtime 出现 crash/restart；Twin runtime 保持稳定。

用户 Windows durable log 已反复记录确定性 first-red：

```text
FATAL_ATTEMPT_FAILURE
Error: GFS_RETRY_TARGET_SKIP_FORBIDDEN
```

调用链稳定落在：

```text
PostgresGfsRetryScheduleV1.claimGfsAttemptBeforeProviderFetch
-> production provider attempt fence
-> EvidenceRuntimeCycleServiceV1.executeCycle
-> EvidenceRuntimeHostV1.run
-> pre-Formal owner runtime crash
```

现场根因已经闭合：

```text
current GFS target durable attempt budget
= 3 / 3 exhausted

canonical pair
= not yet formed

old host planner
= still constructs the same GFS target

provider fence
= correctly fail-closed

result
= GFS_RETRY_TARGET_SKIP_FORBIDDEN
-> Evidence runtime crash/restart
-> repeated owner reacquisition
-> fencing-token churn
```

必须强调：

```text
provider fence is NOT the defect
```

provider fence 对第 4 次非法 attempt 的拒绝是正确 fail-closed 行为。缺陷在 planner 上游没有读取 durable retry schedule、没有在当前 target budget exhausted 时停止构造该 GFS action。

此前物理观察还出现：

```text
Twin container
= running / restart=0

Evidence container
= restarting / restart=18
```

随后 exact production compose project containers 已 force remove 并明确验证：

```text
PRODUCTION_CONTAINERS=0
```

旧 crash-loop 不能靠“再启动一次”处理。

### B4. #3599 — planner 修复已落库

当前修复 PR：

```text
PR
= #3599
= OPEN
= NOT MERGED

exact head
= e7fbdcc6e6f043b226b34a4497d9f3c4bb2fce25

base main
= 1137e327df07011ec54186feb88d7a544301fe70

ahead
= 6 commits

changed files
= 4

diff
= +19 / -5
```

核心修复：

```text
production Evidence host planner
-> reads durable GFS retry schedule

if current target durable budget is exhausted
-> suppress ONLY the GFS action
-> do NOT construct provider attempt #4
-> continue planning KBS Soil / KBS Raw independently
```

保留的 fail-closed 语义：

```text
ATTEMPT_BUDGET_EXHAUSTED provider-fence rejection
= retained

MISSED_WINDOW
= not relaxed

target gap
= not relaxed

target skip
= not relaxed

provider fence
= not bypassed
```

该修复的设计目标不是“让第 4 次请求通过”，而是“planner 不再构造本来就不允许执行的第 4 次请求”。

## C. #3599 当前 exact-head qualification 状态

以下状态为 2026-09-18T15:57Z 左右的远端回读；优先于更早的“QCP / Owner Cutover in_progress”快照。

### C1. 已通过

```text
CI build-test
run = 35365065650
status = SUCCESS

Production Runtime Owner Cutover qualification
run = 35365065682
status = SUCCESS

delivery policy
= SUCCESS

release lane
= SUCCESS

EA5E2 successor runner
= SUCCESS

EA5E2 runtime dependency graph
= SUCCESS

current-main re-anchor
= SUCCESS

main ruleset readiness
= SUCCESS

candidate declaration selftest
= SUCCESS

EA5E2 live-window preflight hardening
= SUCCESS
```

target-planner readiness：

```text
run = 35365065672
conclusion = SKIPPED
```

这是 skipped，不是 failure；不得伪写为已执行 PASS，也不得当作 first-red。

### C2. CI acceptance 仍在运行

```text
CI
run = 35365065650

acceptance job
= IN_PROGRESS

current observed step
= Run frontend runtime page audit
```

当前没有 acceptance first-red，但其最终 conclusion 尚未形成。

### C3. QCP 已从 in-progress 转为 FAILURE — 当前真正 blocker

```text
QCP
run = 35365065566
status = FAILURE

first failed step
= Enumerate all blockers without fail-fast

blocker_count
= 2
```

两个 blocker 精确为：

```text
1.
blocker_class
= INVALID_OR_MISSING_REQUALIFICATION_EVIDENCE

check_id
= PHASE3_EVIDENCE_RUNTIME_FOUNDATION

reason_code
= NO_VALID_REQUALIFICATION_EVIDENCE

observed detail
= prior durable evidence binding exists
  but dependency_digest_match=false


2.
blocker_class
= INVALID_OR_MISSING_SUCCESSOR_CHAIN_PHASE5_REQUALIFICATION_EVIDENCE

check_id
= PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS

reason_code
= SUCCESSOR_CHAIN_PHASE5_EXACT_RUN_OR_DEPENDENCY_DIGEST_INVALID

observed detail
= prior exact run remains success
  but dependency_digest_match=false
```

QCP artifact：

```text
artifact id
= 10556267527

artifact zip sha256
= 1f23eab368b86762f2560fb1ef620c19dc765f40cd95aaa59ef0fa6d95898b1
```

因此当前准确判断：

```text
#3599 runtime semantic fix
= QUALIFICATION NOT CLOSED

QCP
= RED

merge
= FORBIDDEN

repair declaration
= FORBIDDEN
```

这两个 QCP red 当前表现为 successor requalification evidence / dependency-digest 绑定缺口，不是新的 production runtime semantic first-red。不得为消除它们去放宽 GFS attempt budget、provider fence 或 planner fail-closed 语义。

## D. 当前卡在哪里

当前唯一明确 blocker：

```text
QCP successor requalification evidence convergence
```

更具体地：

```text
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
-> needs exact successor requalification evidence
-> dependency digest must match current #3599 dependency set

PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS
-> needs exact successor-chain Phase5 requalification binding
-> exact run + dependency digest must match current #3599 dependency set
```

Owner Cutover qualification 已绿，不能拿它覆盖 QCP failure。

CI acceptance 尚未结束；即使它绿，QCP 仍然阻止 merge。

如果为了闭合 QCP evidence 产生任何新 commit：

```text
e7fbdcc6...
= immediately historical

new commit
= new exact head
```

之后必须重新按新 exact head 判断所有 required gates，不能拼接旧 head 的 success。

## E. 下一步严格执行计划

### E1. 先闭合两个 QCP evidence blocker

以 QCP run `35365065566` / artifact `10556267527` 为当前机器裁决基准。

只处理：

```text
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS
```

的 exact successor requalification evidence / dependency digest。

不要扩大 runtime 修复范围，除非新的 machine first-red 明确指出 runtime semantic defect。

### E2. 形成新的 exact head 后重新资格化

如果 evidence binding 需要提交：

```text
new exact head
-> QCP blocker_count=0
-> CI build-test SUCCESS
-> CI acceptance SUCCESS
-> Production Runtime Owner Cutover qualification SUCCESS
-> applicable EA5E2 / delivery / release / ruleset gates SUCCESS
```

target-planner readiness 若按 applicability 合法 skipped，继续记录为 skipped，不伪造 PASS。

只有 final exact head 全绿才可 merge #3599。

### E3. exact-head guard merge #3599

合并前重新证明：

```text
PR #3599
= OPEN
= clean / mergeable under required rules
= exact expected head

QCP
= SUCCESS
= blocker_count 0

required CI / qualification
= SUCCESS
```

使用 expected-head guard merge；任何 head 漂移先 STOP。

### E4. 新 protected-main post-merge qualification

merge 后立即取得：

```text
new protected-main SHA
```

然后只接受该 exact main 的：

```text
post-merge CI
Formal-v5 readiness / zero-state
EA5E2 successor qualification
required runtime qualification
```

旧 subject 的 runtime-start authority、image attestation、zero-state、H3/H4 均不能直接继承。

### E5. 本机重新进入 exact-main production proof

严格：

```text
fetch / ff-only pull
-> HEAD == origin/main == new protected main
-> clean worktree
-> production containers = 0
-> old live leases released/expired
-> fresh H2A rematerialization
-> H2B host binding
-> new H3 owner cutover
```

必须重新检查 current-crop freshness 和 planned-A0 coverage；不得继承 handoff 时钟。

### E6. 新 H3 后的 GFS physical proof

目标仍要求真实 GFS in-flight 跨过原 300 秒 lease window，再做 H4。

但是 #3599 的语义意味着：

```text
current exhausted target
= MUST remain suppressed

do not manufacture attempt #4
do not reset durable attempt budget
do not bypass provider fence
```

要证明 >300 秒 GFS in-flight，必须等待/使用**下一次合法 eligible GFS target**。当前 exhausted target 只能作为“planner 应跳过 GFS action”的证明。

在等待下一合法 GFS target 时：

```text
KBS Soil / KBS Raw
= must remain independently plannable
= must not be blocked by exhausted GFS target
```

### E7. H4

在新 exact-main image / container / host / Neon lease 上证明：

```text
Evidence
= exact one effective owner
= same exact-main image
= lease renewal / heartbeat live
= long legitimate GFS in-flight survives >300s

Twin
= exact one effective owner
= PRE_FORMAL_OWNER_STANDBY
= OWNER_LEASE_HEALTHY accepted by fixed verifier

Formal-v5
= false

A0
= false

O00
= false
```

### E8. H5 readiness only

消费**新 protected-main exact-subject** zero-state proof，运行：

```text
VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs
```

唯一目标：

```text
status = PASS
formal_v5_arm_ready = true
separate_explicit_operator_authorization_still_required = true

formal_v5_arm = false
A0 = false
O00 = false
```

### E9. HARD STOP

一旦：

```text
formal_v5_arm_ready=true
```

立即停止。

**不要执行真正 Formal-v5 arm。**

## F. 本轮踩过的坑 — 后续必须避免

### F1. 不要把 provider fence 的 fail-closed 当成 defect

本轮 `GFS_RETRY_TARGET_SKIP_FORBIDDEN` 证明 provider fence 正确阻止非法 attempt。

正确修复层：

```text
planner
```

不是：

```text
relax fence
increase attempt budget
allow target skip
force attempt #4
```

### F2. exhausted GFS target 不能拖死 KBS

#3599 的关键合同：

```text
GFS exhausted
-> suppress GFS only

KBS Soil / KBS Raw
-> continue independently
```

以后 acceptance 必须防止把 provider-specific suppression 提升成整个 Evidence cycle suppression。

### F3. 不得人为制造第 4 次 provider attempt 来做 >300 秒证明

当前 target 已是：

```text
3 / 3
```

最终 production proof 必须使用下一合法 target；不能 reset schedule、改 DB、删 retry row 或绕过 fence。

### F4. QCP dependency digest red 不等于 runtime semantic red

当前两个 QCP blocker 的共同特征：

```text
dependency_digest_match=false
```

先修 successor evidence binding。没有新的 runtime first-red 时，不要继续改 production planner/provider semantics。

### F5. 每次 commit 都使 exact-head 资格重新开始

任何 evidence-only commit 也会改变：

```text
exact head
dependency digest
QCP applicability
CI subject
```

所以不能把：

```text
old-head QCP
+ new-head CI
+ older Owner Cutover
```

拼成一次“全绿”。

### F6. old physical proof 有价值，但不能冒充 final exact-main closure

#3597 已取得真实 >300 秒 GFS keepalive proof，这是 runtime defect 的重要证据。

但最终 H4/H5 仍必须绑定 #3599 merge 后的新 protected main。

### F7. restart-loop 必须先归零，再读 durable first-red

本轮 production 曾出现 Evidence restart churn。正确做法已经再次证明：

```text
observe
-> capture durable log
-> remove exact compose project containers
-> verify container count=0
-> classify deterministic first-red
-> fix upstream semantic source
```

不要靠重复 restart 碰运气。

### F8. PowerShell / psql launcher 作用域不要再踩

曾出现 helper 内使用：

```powershell
& $script:Psql
```

但调用者只定义 local `$Psql`，导致：

```text
管道元素中的 "&" 后面的表达式生成无效对象
```

可靠做法：

```powershell
Invoke-PsqlRow -CommandPath $Psql ...
```

并在函数内部显式：

```powershell
& $CommandPath
```

### F9. pg SSL warning 不是本轮 root cause

`pg` / `pg-connection-string` 关于 future SSL semantics 的 warning 不等于连接失败。

必须按 exit code / query result / machine verifier 判断，不要为了消 warning 放宽 TLS。

### F10. target-planner readiness skipped 不是失败，也不是 PASS

始终按实际 applicability 记录：

```text
SKIPPED
```

不要升级为 success proof；也不要因为 skipped 自行制造补跑，除非 QCP / workflow contract 明确要求。

## G. 当前接手一句话

```text
MCFT-CAP-09 is still in FINAL PRE-FORMAL-V5 ARM CLOSURE.

#3599 exact head e7fbdcc6... contains the exhausted-GFS-target planner fix:
read durable retry schedule, suppress only exhausted GFS action, preserve provider-fence fail-closed semantics, and keep KBS Soil / KBS Raw independent.

Owner Cutover qualification and build-test are green, but QCP 35365065566 is RED with exactly two successor requalification evidence/dependency-digest blockers; CI acceptance is still in progress.

Do NOT merge #3599 yet.
First close the two QCP evidence blockers, then rerun all required gates on the new exact head.
Only after exact-head all-green may #3599 merge.
Then: new protected main -> post-merge zero-state/readiness -> local exact-main H3 -> next legitimate GFS in-flight >300s -> H4 -> H5 formal_v5_arm_ready=true -> HARD STOP.

Formal-v5 / A0 / O00 remain NOT STARTED.
```

---

# 2026-09-18 接手更新 — FINAL PRE-FORMAL-V5 ARM CLOSURE

> 用途：conversation continuation only。
> 本节不是 architecture authority、production runtime authority、production-owner authority、Formal-v5 arm authority、A0 authority 或 O00-O23 authority。
> 落库纪律：PURE PREPEND 到既有 continuation 文件；下方既有全文保持 exact suffix；原 8/27 canonical handoff（含 AH）继续不动；不新建更多 continuation 文件。
> 核验时点：2026-09-18 约 05:02Z（UTC）。

## A. 当前正在做什么

MCFT-CAP-09 当前唯一 active frontier 已从 runtime-start/production-owner implementation hardening 前移到：

```text
FINAL PRE-FORMAL-V5 ARM CLOSURE
=
final protected-main exact binding
-> local exact-main rematerialization
-> production-owner cutover rebuild
-> sustained live fenced-owner proof
-> exact-subject Formal-v5 zero-state proof consumption
-> formal_v5_arm_ready=true
-> STOP
```

目标仍然是**停在真正 Formal-v5 arm 之前**。

不得把本 handoff、任何 CI success、任何 zero-state artifact 或任何 owner-cutover proof解释为已经授权 Formal-v5 arm。

当前权限边界：

```text
production runtime containers
= 0（最后一次本地主机明确观测；后续未重新启动）

production owner
= NOT CURRENTLY RUNNING / REBUILD REQUIRED ON FINAL MAIN

Formal-v5
= NOT ARMED

A0
= NOT STARTED

O00-O23
= NOT STARTED

MCFT-CAP-09
= NOT COMPLETED
```

B-Line 保持 ENGINEERING CLOSED / FROZEN；ADR 保持 PARKED。不要重开其它工程线。

## B. 最终 protected main 与 post-merge qualification

最新 protected main 已前移到：

```text
protected main
= 1444ad55e92b6c519fc61fde7119013be9881721
```

这是 #3589 merge 后的 current main。

该 exact main 的 post-merge qualification 已全部 GREEN：

```text
Formal-v5 post-graduation readiness
run = 35306743185
status = SUCCESS

EA5E2 successor runner qualification
run = 35306743233
status = SUCCESS

CI
run = 35306743057
status = SUCCESS
```

因此，之前绑定于以下 subject 的本地 runtime-start authority、owner-cutover authority、image attestation、zero-state proof 都只能作为历史证据，不能直接复用：

```text
c69d27cfb5fe2b45c2c82570e4b2be0f6d81348a
4b85cce43739e75540be202dbc78b0ed646e4505
59e2fb4e6f0c4864f04fab607d8ab6850c92f767
```

下一次本地执行必须从 `1444ad55...` 重新 rematerialize。

## C. 最终 exact-subject Formal-v5 zero-state proof

新 main 已产生新的 exact-subject zero-state artifact：

```text
workflow
= mcft-cap-09-formal-v5-post-graduation-readiness

run
= 35306743185

subject
= 1444ad55e92b6c519fc61fde7119013be9881721

artifact id
= 10531771454

artifact name
= mcft-cap09-formal-v5-post-graduation-zero-state-1444ad55e92b6c519fc61fde7119013be9881721

artifact digest
= sha256:f576e100c32ea14627e925985ea8cab2a769c5d70d0a0d940c3ae7d820284130

workflow conclusion
= SUCCESS
```

该 artifact 是下一轮 final arm-readiness verifier 应消费的 zero-state proof。

它**不是 Formal-v5 arm authority**。final verifier 仍必须证明：

```text
exact protected-main subject
+ fresh/rebuilt production owner
+ live fenced lease proof
+ zero-state proof exact-subject match
+ Formal-v5 still unarmed
+ A0=false
+ O00=false
```

## D. 本轮完成的重要工程修复

### D1. #3587 — owner-cutover mode pin

本地曾出现两个 production runtime 同时 restart-loop。

Evidence 与 Twin durable logs 的 first deterministic fatal 均为：

```text
MCFT_CAP09_PRODUCTION_RUNTIME_START_MODE_MISMATCH
```

根因不是数据库、current-crop 或 lease，而是：

```text
runtime-start authority.runtime_mode
= OWNER_CUTOVER

actual container mode inherited from operator PowerShell
= NON_OWNER_STANDBY
```

owner-cutover runner 当时使用 `env={...process.env,...}`，却没有显式覆盖：

```text
GEOX_MCFT_CAP09_PREFORMAL_MODE
```

此前同一 PowerShell 会话中的 `NON_OWNER_STANDBY` 残留被继承进 production owner launch，触发 runtime authority fail-closed。

#3587 已修复：

```text
owner-cutover runner
=> explicitly pins
GEOX_MCFT_CAP09_PREFORMAL_MODE="OWNER_CUTOVER"
```

并增加 static acceptance，要求该 pin 位于 cutover env 内且只出现一次。

#3587 已 MERGED，且 exact-head / post-merge qualification 均已通过。

### D2. #3588 — exact-main Formal-v5 readiness dispatch

final Formal-v5 verifier 要求 zero-state proof 与 exact protected-main subject 一致。

此前 readiness workflow 只有窄 path trigger；合法 main 前移后，可能产生：

```text
new protected main
+
old zero-state artifact
=
FINAL VERIFIER MUST REJECT
```

同时 connector 没有可直接 dispatch 该 workflow 的能力。

#3588 已增加：

```yaml
workflow_dispatch:
```

并增加 static acceptance，确保该入口不会被后续删掉。

它只允许重新执行现有 read-only zero-state readiness，不授予 Formal-v5/A0/O00 权限。

#3588 已 MERGED。

### D3. #3589 — owner cutover exact-subject image attestation self-containment

继续核查 final live owner verifier 时发现：

```text
VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs
requires
GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH
```

但 owner-cutover runner 原来没有自行生成并绑定该 exact-subject image attestation。

这会让 live verifier 潜在依赖：

```text
stale shell env
or
stale acceptance-output
```

不能接受。

#3589 已将 owner cutover 顺序固定为：

```text
single shared image build
-> exact-subject / clean-worktree image attestation
-> explicit attestation-path + image-tag binding
-> dual-service --no-build start
-> live fenced-owner verifier
```

新增 acceptance 证明：

```text
attestation occurs after build
attestation occurs before runtime start
attestation path is explicitly bound
runtime image tag is exact-subject bound
```

#3589：

```text
PR head
= 78a5604dd21ff03a03ef9e1306405a6313fbfc35

changed files
= 2

diff
= +15 / -1
```

其 exact-head checks 已完成：

```text
Owner Cutover qualification
run = 35304776305
SUCCESS

QCP
run = 35304776259
SUCCESS

CI
run = 35304776329
SUCCESS

EA5E2 runtime dependency graph
run = 35304776250
SUCCESS

Ready-triggered candidate/release checks
= SUCCESS
```

#3589 已 MERGED；merge 后 current protected main 即 `1444ad55...`，并且 post-merge三条核心 qualification 再次全绿。

## E. 本地主机最后一次明确状态

在发现 restart-loop 后，已执行：

```powershell
docker compose -f docker-compose.mcft-cap09-production-preformal.yml down --remove-orphans
docker compose -f docker-compose.mcft-cap09-production-preformal.yml ps -a
```

明确得到：

```text
NAME IMAGE COMMAND SERVICE CREATED STATUS PORTS
(empty)
```

因此最后一次明确生产容器状态：

```text
production container count
= 0
```

在那之后，本对话没有再次执行 production owner start。

此前绑定旧 main 的本地：

```text
runtime-start-authority.json
owner-cutover-authority.json
```

均不得直接复用到 `1444ad55...`。

## F. Current-crop freshness 边界

最近已知 selected current-crop authority：

```text
ref
= docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-17T04Z-V1.json

authority_as_of
= 2026-09-17T04:00:00.000Z

stage/current-crop valid until
= 2026-09-18T10:00:00.000Z
```

本 handoff 核验时点约为 2026-09-18T05:02Z，因此该窗口**在 handoff 时仍未过期**。

但是：

```text
HANDOFF-TIME FRESH
!=
EXECUTION-TIME FRESH
```

下一任执行者必须在：

1. rematerialization；
2. owner-cutover admission；
3. final Formal-v5 arm-readiness；

各自依赖的实际执行时刻重新检查 freshness。

如 `2026-09-18T10:00:00Z` 已过去或 runner 的 planned-A0 coverage 不再成立，必须 fail-closed，先取得新的 effective current-crop authority，不得延长旧 authority。

## G. 当前“卡点”准确表述

仓库侧目前**没有已知红灯 blocker**：

```text
#3587 merged
#3588 merged
#3589 merged
final main post-merge qualifications green
exact-subject zero-state proof available
```

当前尚未完成的是**本地 physical production execution proof**：

```text
final-main local rematerialization
-> production-owner cutover rebuild
-> sustained live fenced-owner proof
-> final arm-readiness verification
```

所以当前 frontier 不是：

```text
FIX MORE REPO CODE
```

而是：

```text
EXECUTE FINAL MAIN LOCAL PROOF CHAIN
```

但任何本地 first-red 都必须先分类；不得为了“赶到 Formal-v5”绕过 fail-closed gate。

## H. 下一步严格执行计划

下一任接手后按以下顺序，不重新扫描已关闭历史链：

### H1. Bind final protected main

```text
git fetch origin main
git switch main
git pull --ff-only origin main

HEAD
= origin/main
= 1444ad55e92b6c519fc61fde7119013be9881721

worktree
= clean

production containers
= 0
```

任一不成立则 STOP。

### H2. Final-main rematerialization

在 exact main 上重新运行：

```text
MATERIALIZE_MCFT_CAP_09_PRODUCTION_RUNTIME_NON_OWNER_STANDBY_V1.cjs
```

随后重新运行 non-GitHub production host secret-binding preflight。

不得继承旧 main 的 runtime-start authority。

### H3. Production-owner cutover rebuild

运行修复后的：

```text
RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs
```

新的 runner 必须自己完成：

```text
OWNER_CUTOVER mode pin
single shared image build
exact-subject image attestation
dual --no-build start
live owner verification
```

不要手工预填旧 attestation path。

### H4. Sustained owner proof

确认至少：

```text
Evidence runtime
= running
= restart_count 0
= owner lease healthy / correct fenced ownership

Twin runtime
= running
= restart_count 0
= scheduler owner lease healthy
= correct fenced token progression

subject
= exact 1444ad55...

image id
= both services exact same built image

Formal-v5
= false

A0
= false

O00
= false
```

必须跨至少一个真实 renewal interval 复核，不接受只看启动瞬间。

### H5. Consume final zero-state proof

使用 artifact：

```text
10531771454
sha256:f576e100c32ea14627e925985ea8cab2a769c5d70d0a0d940c3ae7d820284130
```

运行：

```text
VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs
```

目标结果：

```text
status = PASS
formal_v5_arm_ready = true
separate_explicit_operator_authorization_still_required = true

formal_v5_arm = false
formal_v5_epoch_selected = false
A0 = false
O00 = false
```

### H6. HARD STOP

一旦得到：

```text
formal_v5_arm_ready=true
```

立即 STOP。

**不要执行真正 Formal-v5 arm。**

真正 arm 必须由用户再次显式授权。

## I. 这轮踩过的坑 — 必须避免

### I1. PowerShell 环境变量会跨命令残留

不要假设 compose 默认值会覆盖调用者环境。

已经真实发生：

```text
old shell:
GEOX_MCFT_CAP09_PREFORMAL_MODE=NON_OWNER_STANDBY

owner authority:
OWNER_CUTOVER

result:
both runtimes restart-loop
MCFT_CAP09_PRODUCTION_RUNTIME_START_MODE_MISMATCH
```

owner runner 现在已修为显式 pin，但后续新 mode-dependent runner 也必须遵循相同原则：

```text
authority-critical env
must be explicitly set by runner
not implicitly inherited
```

### I2. 不要把旧 exact-subject artifact 带到新 main

任何 main merge 都会使以下 proof 需要重新绑定：

```text
runtime-start authority
owner-cutover authority
runtime image attestation
Formal-v5 zero-state proof
```

final verifier 应拒绝旧 subject，这是正确的 fail-closed 行为。

### I3. owner live verifier 不得依赖旧 shell attestation path

#3589 已修为 runner 自包含。

后续不要再手工用：

```text
GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH
```

指向旧 acceptance-output 来“让 verifier 通过”。

### I4. 两个 compose services 共用同一个 image tag 时，不要并行 build 两次

此前执行：

```text
docker compose ... up -d --build evidence twin
```

曾发生：

```text
image "...:<subject>" already exists
```

原因是两个 target 同时导出到同一 tag。

可靠路径：

```text
build once
-> attest exact image
-> up both --no-build
```

现在 owner runner 已按该纪律固化。

### I5. CI runtime dependency startup 要看 first-red，不要凭 warning 下结论

历史 CI 在 dependency startup 会出现类似：

```text
pull access denied for geox/server-runtime
```

但 compose 可能随后本地 build/继续完成；warning 不等于 deterministic failure。

必须以最终 step conclusion 和 diagnostic first-red 为准。

### I6. QCP success 不能被泛化为“所有历史子证据都重新执行”

QCP applicability 输出会区分 REQUIRED / carry-forward / successor execution。

只陈述机器实际运行并成功的 workflow/step，不把 skipped 或历史 missing digest 解释成新执行 proof。

例如 Formal-v5 readiness 中，`BIOLOGICAL_STAGE_EFFECTIVENESS_GRADUATION` 等仍按 QCP resolver / successor-head语义处理；不能自行晋升为新的 live authority。

### I7. current-crop freshness 是 wall-clock gate

```text
fresh at handoff
!= fresh at owner cutover
!= fresh at Formal-v5 readiness
```

每次 admission 必须重新判断。

### I8. 不要重新创建已经存在的 production resources

继续禁止无必要的：

```text
Neon role recreation
ACL rebuild
R2 bucket recreation
credential reprovisioning
```

除非新的 machine gate 明确证明资源失效并要求独立 remediation。

### I9. 不要把 restart-loop 当作“再启动一次就好”

本轮正确流程是：

```text
observe restart loop
-> down to zero
-> read durable logs
-> identify deterministic mode mismatch
-> repair runner + acceptance
-> exact-head qualification
-> merge + post-merge qualification
```

以后同类问题继续这样处理。

## J. 接手一句话

```text
MCFT-CAP-09 repo-side pre-Formal-v5 control surface is now green on protected main 1444ad55... .
The remaining work is one final local exact-main proof chain:
rematerialize -> rebuild production owner -> prove sustained fenced ownership -> consume exact-main zero-state proof -> reach formal_v5_arm_ready=true -> STOP.
Do not arm Formal-v5 without a new explicit user authorization.
```

---

# 2026-09-17 补充核验 — 当前接手入口（优先于下方历史快照）

> 本次为用户要求的直接落库 handoff 更新。仅记录任务、完成项、阻塞、计划与踩坑；不授予 runtime / owner / Formal-v5 权限。
> 核验时间：2026-09-17T03:41Z 左右。以下内容 PURE PREPEND 到既有 continuation 文件；其原全文保留为 exact suffix。原 8/27 canonical handoff（含 AH）不动，不新建更多 continuation 文件。

## A. 我们正在做什么

MCFT-CAP-09 当前唯一工程边界：把独立的 PRODUCTION_RUNTIME_START_AUTHORITY 限定为 TRUE NON_OWNER_STANDBY，并机器强制 mode、exact Gate-A/host-proof binding、actual process-admission wall-clock freshness。

总推进边界仍止于 Formal-v5 arm 之前；B-Line 保持冻结，ADR 保持 PARKED。Gate A 完成不等于获得启动权。此 handoff 也不构成启动裁决。

## B. 已完成与本次远端核验

- protected main 本次重新读取仍为 `f9cdeb4eddb1801a339149a592ee41f9cf120257`。
- [#3577](https://github.com/liyongshang44-max/GEOX/pull/3577) 已 closed / merged；head `faf42498789ed31156888e8a0d8270b97048adf6`；4 files / +9 / -9；merge SHA 即上述 main。不应再次 merge 或重开该 PR。
- Gate A 物理 Windows host proof 的用户原始 verifier 输出为 PASS，subject `d1db5463d1363eb5f9efacc13425b75a7c8b7ee8`；host `fae5f756-ef25-40d5-9777-5b2c3d4837a1`。两 plane DB connectivity、exact-one membership 与 cross-plane isolation 均通过；R2 PUT/HEAD/DELETE/post-delete HEAD=200/200/204/404；production containers before/after=0/0。本轮未重新在用户主机执行此 proof。
- [post-merge CI 35125065838](https://github.com/liyongshang44-max/GEOX/actions/runs/35125065838) 本次读取 jobs：build-test、acceptance 均 completed/success；Run acceptance suite、runtime hygiene、artifact upload、dependency cleanup 均 success。
- [EA5E2 35125065957](https://github.com/liyongshang44-max/GEOX/actions/runs/35125065957) job completed/success。准确限定：Route Phase6 retirement successor 与 proof upload 成功；steps 14–18 为 skipped，不能把 job 成功扩写为每条 rolling-runner 子证明都重新执行成功。
- credential rematerialization、独立 Evidence R2 bucket、#3575 current-crop、#3576 standby seam 的前轮事实与索引继续见下方原文；本轮未轮换凭据、重建资源或执行生产进程。

```text
Gate A = CANONICAL / MERGED / POST-MERGE GREEN
PRE_RUNTIME_START_READY = MACHINE-CLOSED
PRODUCTION_RUNTIME_START_AUTHORITY = HOLD / UNARMED
PRODUCTION_RUNTIME = NOT STARTED (last observed host state)
PRODUCTION_OWNER = NOT ACTIVATED (last observed host state)
Formal-v5 / A0 / O00-O23 = HOLD
```

## C. 当前卡在哪：治理绑定缺口 + 未验收 WIP

治理 intent 接受，但 implementation enforcement 未闭合；不能把窄治理意图提升为 AUTHORIZED。

远端 WIP 本次读取仍为：

```text
branch = work/runtime-start-non-owner-hardening-v1
head = b357918194d89a9f250624769322d7c0e89e24c6
base recorded by prior handoff = f9cdeb4eddb1801a339149a592ee41f9cf120257
changed files = 5
status = NOT QUALIFIED / DO NOT MERGE / DO NOT START
```

**新发现的确定问题（优先于下方“先修 typo”的旧顺序）：**

远端 `scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs` 在 WIP exact head 上的 blob 为 `e9f5ddaeaa47a3de3dd9494710ce83fd42d37ecb`。本次 fetch_file 与 commit patch 都显示文件在检查 proof 字段的 for-loop 中途结束，尾部为 `req(proofZ...`，包含 U+0001 / U+0003 / U+0014 等异常控制字符，缺少函数/脚本后续闭合内容。这是远端源码完整性缺陷；成因尚未确认，不能仅归因于显示问题，也不能将旧的 temporary draft acceptance 视为该远端文件已通过。

另有已知 Evidence entrypoint env-key typo：

```text
WRONG   GEOX_MCFT_CAP09_EVIDNCE_S3_ACCESS_KEY_ID
CORRECT GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID
```

本次没有修改工程分支，没有运行完整 server build，也没有为 WIP 赋予新资格。

## D. 下一步严格顺序

1. 重新绑定 protected main、WIP exact head 与当前 UTC；若 main 漂移，先重新裁决 successor base。
2. 先检查全部 5 个远端文件的完整性，修复截断 builder 与 env-key typo。以 main 完整文件和冻结语义为依据作最小修复，不盲目沿用压缩重写；不能以本地 draft 代替 remote exact-head。
3. 审查 mode 双向隔离、Gate A proof ref/digest、canonicalization SHA、host proof subject/id、deployment subject、current-crop as-of/valid-until 的真实校验，不能只检查字段存在。
4. 执行 node syntax check、repo-native TypeScript/server build、runtime-start builder acceptance、standby acceptance 和既有 owner-path compatibility。负例至少覆盖缺失/错误 mode、standby authority 被 owner path 消费、错误 proof/digest/host/subject、未生效或已过期 current-crop。
5. 明确 QCP applicability 与合法 carrier；修正 head 后 Draft PR，完成 exact-head CI / acceptance / applicable successor gates；全部满足再 Ready，复核 Ready-triggered checks 后按既定授权边界处理 merge，随后验证 post-merge adoption。
6. 单独重新裁决 runtime-start authority，仅允许 NON_OWNER_STANDBY；Owner/Formal-v5/A0/O00-O23 全部 false。不得把本 handoff 当作 arm。
7. 裁决与实际 process admission 两个时刻分别检查 freshness。旧窗口截止 `2026-09-17T10:00:00.000Z`；本次 03:41Z 核验尚未越过该上界，但这不证明未来启动仍 fresh。超过上界必须先取得新的 fresh T4R1 current-crop authority。
8. 仅在窄授权明确成立且全部执行前提满足后才进入 standby；独立证明 liveness、credentials usable、mounts valid、EvidenceProducerLease 未取得、TwinRuntimeSchedulerLease 未取得、scheduler 未执行、production writes=ZERO、owner=false。
9. STOP / HOLD；Gate B owner activation 独立裁决。Formal-v5 持续 HOLD。

## E. 必须避开的坑

- 不重开 Gate A / readiness / #3577；不重建已有 Neon roles/ACL/database 或 R2 bucket。
- PowerShell → node -e quoting 曾吃掉引号；用临时 .cjs 文件。C# shim 必须转发 stdout/stderr，EXIT=0 且空输出不能证明 DB identity 正确。
- SQL 显式 `::text` 的布尔结果实际为 `true|false`；此前要求必须 `t|f` 的预期不准确。canonical verifier 已接受实际输出并 PASS，不改 DB role 去迎合错误预期。
- pg SSL warning 本身不是该次 DB proof 失败，不应为消除 warning 放宽 TLS。
- 必须显式检查 native command exit code；无条件 Write-Host PASS 不算证明。
- local HEAD 与 fetched origin/main 都要 exact-bind；保留用户 sensor-sim/、sensor-sim-kbs/，需要 clean tree 时移出保存，不删除。
- 当前源码缺陷属于确定性错误，不套用 CI transient rerun 策略。只有确认 first-red 为 transient 才可同一 head 无效应重跑。
- GitHub 写入成功不代表代码完整：必须回读远端全文、核对预期内容与语法。WIP builder 截断是本次新增的反例。
- 历史 PASS 不自动继承到 successor；missing/skipped QCP 不是 PASS；job-level success 不代表 skipped steps 执行成功。
- handoff #3298 保持 OPEN / DRAFT / UNMERGED，docs-only；历史全文不得删除或改写。本次只 prepend 此既有 continuation 文件。

---

# MCFT-CAP-09 Continuation Handoff — 2026-09-17 — Runtime-Start Authority Frontier

> 用途：conversation continuation only。
>
> 状态：NOT ARCHITECTURE AUTHORITY / NOT PRODUCTION START AUTHORIZATION / NOT OWNER AUTHORIZATION / NOT FORMAL-v5 ARM。
>
> 本文件是 #3298 当前最新 continuation entry point。原 `GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md` 的 AH 与此前全部历史继续保留，禁止把旧段落中的 SHA、blocker 或 next step 重新当成当前事实。
>
> 本 handoff 不授权 runtime start，不授权 production owner activation，不授权 Formal-v5 / A0 / O00-O23。

---

## 0. 一句话接手结论

MCFT-CAP-09 当前已经完成 credential rematerialization、production-host secret binding、TRUE NON_OWNER_STANDBY executable seam 和 Gate A physical-host proof；protected main 已推进到：

```text
protected main
= f9cdeb4eddb1801a339149a592ee41f9cf120257

Gate A host proof
= CANONICAL
= MERGED
= POST-MERGE GREEN

PRE_RUNTIME_START_READY
= MACHINE-CLOSED

PRODUCTION_RUNTIME_START_AUTHORITY
= UNARMED / HOLD

PRODUCTION_RUNTIME
= NOT STARTED

PRODUCTION_OWNER
= NOT ACTIVATED

FORMAL-v5
= HOLD

A0
= NOT STARTED

O00-O23
= NOT STARTED
```

当前唯一 active governance / engineering frontier 已收窄为：

```text
PRODUCTION_RUNTIME_START_AUTHORITY
```

它只回答：

```text
是否允许 exact protected main
进入 TRUE NON_OWNER_STANDBY？
```

不能顺带授权 owner activation，不能顺带 arm Formal-v5。

---

## 1. 当前任务的冻结语义

runtime-start authority 必须是一个窄授权：

```text
runtime_process_start_authorized = true

allowed runtime mode
= NON_OWNER_STANDBY ONLY

production_owner_activation_authorized = false
formal_v5_authorized = false
a0_authorized = false
o00_o23_authorized = false
```

并且必须 exact-bind：

```text
protected_main_sha
= current exact protected main

pre_runtime_start_ready_proof
= canonical Gate A merged proof + digest

host proof
= exact canonical host proof subject + host id

fresh current-crop authority
= still fresh at adjudication time
= still fresh again at process-admission / actual start time
```

必须继续维护这些不变量：

```text
READY != AUTHORIZED
AUTHORIZED != STARTED
STARTED != OWNER
OWNER != FORMAL-v5
FORMAL-v5 != A0
A0 != O00-O23
```

---

## 2. 已完成：credential rematerialization

canonical rematerialization：

```text
run_id
= 35054759709

artifact_id
= 10430112693

artifact_digest
= sha256:a0e55a96947d43437b3fb51443d9ccc0cf0838fc56cdcbcfe851e669fc30a0a9

authority_sha256
= sha256:a81ad681535cd2e30516449bd94486a7dfbc81f882898572400399dbc824fed3
```

真实操作中：

- 保留现有 Neon database / schema / ACL / roles / memberships；
- 只轮换 / rematerialize Evidence 与 Twin login credential；
- 不重建 login role；
- role-specific password connectivity 已证明；
- exact-one own-plane membership each；
- cross-plane membership forbidden；
- Evidence R2 使用独立 bucket `geox-mcft-cap09-evidence-runtime-v1`；
- Formal Raw bucket 未复用；
- authenticated R2 PUT=200 / HEAD=200 / DELETE=204 / post-delete HEAD=404；
- 没有 runtime start，没有 owner activation，没有 Formal-v5 arm。

生产数据库 current-state readback 当时证明：

```text
public tables
= 41

non-lease tables
= 39 / all zero rows

external_evidence_producer_lease_v1
= total 1 / live 0 / expired 1

twin_runtime_lease_v1
= total 1 / live 0 / expired 1
```

历史 expired lease residue 被允许；live owner 必须为 0；39 张非 lease 表必须仍为 0 production-state rows。

---

## 3. 已完成：production host secret binding / Gate A

canonical physical host：

```text
host_id
= fae5f756-ef25-40d5-9777-5b2c3d4837a1
```

fresh exact-main host proof 最终成功绑定：

```text
subject_sha
= d1db5463d1363eb5f9efacc13425b75a7c8b7ee8

status
= PASS

stage
= PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY

runtime_secret_binding_count
= 7

repository_secret_materialized
= false

github_secret_materialized
= false

evidence_database_connectivity_proven
= true

twin_database_connectivity_proven
= true

exact_one_privilege_membership_each_proven_by_current_credentials
= true

cross_plane_privilege_forbidden_proven
= true

R2 bucket
= geox-mcft-cap09-evidence-runtime-v1

R2 Formal bucket reused
= false

R2 statuses
= PUT 200 / HEAD 200 / DELETE 204 / post-delete HEAD 404

compose_render_only_pass
= true

production_container_count_before
= 0

production_container_count_after
= 0

pre_owner_cutover_ready
= true

remaining_blockers
= [PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED]

runtime_process_start
= false

production_owner_activation
= false

formal_v5_arm
= false
```

#3577 将 fresh host proof canonicalize 到 repo；exact-head merge 后：

```text
#3577
= MERGED

merge SHA / protected main
= f9cdeb4eddb1801a339149a592ee41f9cf120257

post-merge EA5E2 successor qualification
= run 35125065957 / SUCCESS

post-merge CI
= run 35125065838 / SUCCESS
= build-test SUCCESS
= acceptance SUCCESS
= final runtime hygiene SUCCESS
```

因此 Gate A 不再是 blocker，不要再重开 readiness / host proof / #3577。

---

## 4. 已完成：TRUE NON_OWNER_STANDBY executable seam

#3576 已合并，建立了真实的：

```text
STARTED != OWNER
```

执行 seam。

Evidence standby 路径设计：

- service principal check；
- live Evidence owner lease count 必须为 0；
- R2 authenticated HEAD only；
- 不 claim EvidenceProducerLease；
- 不写 production evidence；
- 不写 R2 object；
- 只发 host-local standby heartbeat。

Twin standby 路径设计：

- service principal check；
- mounted current-crop / stage authorities validation；
- live Twin scheduler lease count 必须为 0；
- 不 claim TwinRuntimeSchedulerLease；
- 不改 scheduler cursor / slot；
- 不启动 Formal runner；
- 只发 host-local standby heartbeat。

第一次真实 standby run 后必须独立证明以下四项，才能说 NON_OWNER_STANDBY closure：

```text
EvidenceProducerLease
= NOT ACQUIRED

TwinRuntimeSchedulerLease
= NOT ACQUIRED

production writes
= ZERO

production owner
= FALSE
```

---

## 5. current-crop 时间边界

最新已合并 current-crop authority：

```text
authority_as_of
= 2026-09-16T04:00:00.000Z

authority_valid_until
= 2026-09-17T10:00:00.000Z

architecture_effective
= true

runtime_consumption_authorized
= true
```

来源：#3575 / T4R1 run `35098713981`。

关键规则：

```text
historically fresh
!=
currently fresh
```

Runtime-start authority adjudication 与 actual process admission 必须分别重新判断 freshness。

如果执行 runtime start 时已超过：

```text
2026-09-17T10:00:00.000Z
```

必须先取得新的 fresh T4R1 current-crop authority；禁止复用 9/16 的 historical freshness。

---

## 6. 为什么 runtime-start authority 当前仍 HOLD

Gate A 已满足，但现有 runtime-start implementation 在本轮检查中仍发现 3 个需要编码的 enforcement gap：

```text
1. mode binding
2. exact Gate-A / host-proof binding
3. execution-time freshness binding
```

具体是：

1. runtime-start authority parser 以前主要校验 armed/start booleans 与 Owner/Formal ceilings，没有要求 authority 必须是 `NON_OWNER_STANDBY`；
2. Evidence / Twin preformal entrypoint 的 mode 缺省仍能落到 `OWNER_CUTOVER`，因此 standby-only authority 不能只靠 operator intent；
3. builder 会校验 current-crop / formal-A0 关系，但真正 process admission 还需要 wall-clock 再检查 current-crop `valid_until`；
4. runtime-start authority 需要 exact-bind Gate A canonical proof、canonical protected-main、host-proof subject 和 host id。

因此当前裁决：

```text
PRE_RUNTIME_START_READY
= PASS / MACHINE-CLOSED

RUNTIME_START GOVERNANCE INTENT
= ACCEPT

CURRENT IMPLEMENTATION ENFORCEMENT
= INCOMPLETE

PRODUCTION_RUNTIME_START_AUTHORITY
= HOLD / UNARMED
```

---

## 7. 当前 WIP branch — 非最终、禁止 merge

本轮已经建立 WIP branch：

```text
branch
= work/runtime-start-non-owner-hardening-v1

base
= f9cdeb4eddb1801a339149a592ee41f9cf120257

head
= b357918194d89a9f250624769322d7c0e89e24c6

ahead / behind
= 1 / 0

commit
= fix(mcft-cap09): bind runtime start to non-owner standby

changed files
= 5
```

当前 5-file diff：

```text
apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts
apps/server/src/runtime/mcft_cap09_production_runtime_start_authority_v1.ts
apps/server/src/runtime/mcft_cap09_twin_preformal_owner_runtime_v1.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_BUILDER_V1.cjs
scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs
```

统计：

```text
+388 / -590
```

这个 WIP commit 只是 construction snapshot，**当前不得开 Ready PR / 不得 merge**。

已发现至少一个确定 defect：

```text
apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts

错误 env key
= GEOX_MCFT_CAP09_EVIDNCE_S3_ACCESS_KEY_ID

正确应为
= GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID
```

这是拼写回归，必须先修。

另外该 commit 把 builder / acceptance 大幅压缩重写，虽然 standalone temporary acceptance draft 曾通过，但尚未在真实 GEOX exact-head 上完成：

```text
pnpm / TypeScript build
repo-native acceptance
QCP applicability
full CI
successor qualification
```

因此不要把 `b357918...` 当 qualified head。

---

## 8. WIP hardening 的目标设计

当前 implementation target 应维持 5-file 或更小 boundary，不要借此修改 Owner / Formal / readiness / credential provisioning。

### 8.1 shared parser

`mcft_cap09_production_runtime_start_authority_v1.ts` 应新增 / 强制：

```text
runtime_mode
= NON_OWNER_STANDBY | OWNER_CUTOVER

expected runtime_mode
= process entrypoint must supply exact expected mode

current_crop_authority_as_of
current_crop_authority_valid_until

pre_runtime_start_ready_proof_ref
pre_runtime_start_ready_proof_sha256
pre_runtime_start_ready_canonical_protected_main_sha
host_proof_subject_sha
host_id
```

对 NON_OWNER_STANDBY admission：

```text
wall clock >= current_crop_authority_as_of
wall clock <= current_crop_authority_valid_until
```

否则 fail closed。

### 8.2 Evidence / Twin entrypoints

两个 process entrypoint 都应显式传：

```text
NON_OWNER_STANDBY path
-> expected runtime_mode = NON_OWNER_STANDBY

OWNER_CUTOVER path
-> expected runtime_mode = OWNER_CUTOVER
```

standby-only authority 不得被 owner path 消费；owner authority 不得被 standby path 静默消费。

### 8.3 builder

runtime-start authority builder 应：

- exact head bind；
- current activation fence 必须贴近 adjudication wall clock；
- validate effective current-crop authority；
- validate biological-stage effectiveness certificate；
- current-crop fresh at adjudication；
- bind canonical Gate A proof ref + digest；
- bind `f9cdeb4e...` Gate A canonical protected-main；
- bind host proof subject `d1db5463...`；
- bind host id `fae5f756-...`；
- carry current-crop `as_of` / `valid_until` into runtime authority；
- keep owner/Formal/A0/O00 ceilings false。

OWNER_CUTOVER historical builder compatibility 要谨慎保留；不能因为新增 standby mode 破坏已有 governed owner-cutover qualification path。

---

## 9. 下一步 exact order

下一任接手后不要直接 runtime start。按以下顺序：

```text
1. re-bind protected main
   expect f9cdeb4eddb1801a339149a592ee41f9cf120257
   if drifted -> stop and re-adjudicate successor base

2. inspect WIP branch
   work/runtime-start-non-owner-hardening-v1
   head b357918194d89a9f250624769322d7c0e89e24c6

3. first fix deterministic defect
   EVIDNCE -> EVIDENCE env key typo

4. review 5-file diff semantically
   do not accept compact rewrite merely because node --check passes

5. run focused local/static qualification
   - node --check builder + acceptance
   - TypeScript server build
   - runtime-start builder acceptance
   - existing standby acceptance
   - owner-cutover compatibility acceptance

6. inspect QCP applicability / governed dependencies
   if new paths/dependencies already governed -> do not widen registry unnecessarily
   if QCP first-red -> classify exact assertion before repair

7. push corrected exact head
   open DRAFT PR only

8. run exact-head qualification
   ci build-test
   ci acceptance
   runtime-start focused acceptance
   EA5E2 / successor carrier as applicable
   QCP if path-triggered
   release/candidate integrity if required

9. only all-green -> Ready -> Ready-triggered checks -> exact-head merge

10. post-merge adoption on new protected main

11. re-check current-crop freshness
    if expired -> obtain new T4R1 authority FIRST

12. perform separate runtime-start authority adjudication
    NON_OWNER_STANDBY ONLY

13. only after authority explicitly armed and all time-sensitive prerequisites fresh:
    start TRUE NON_OWNER_STANDBY

14. prove negative effects:
    EvidenceProducerLease NOT ACQUIRED
    TwinRuntimeSchedulerLease NOT ACQUIRED
    production writes ZERO
    production owner FALSE

15. STOP / HOLD
    then separate Gate B owner-activation adjudication
```

Formal-v5 remains HOLD through all steps above。

---

## 10. 关键踩坑记录 — 必须避免重复

### 10.1 本地 HEAD stale

一次 Gate A 机器证明失败不是 authority file 缺失，而是：

```text
origin/main = d1db5463...
local HEAD  = older commit
```

结果：

```text
HEAD_NOT_EXACT_GATE_A_SUBJECT
HOST_SECRET_BINDING_EXACT_SUBJECT_REQUIRED
current-crop file not found
compose render failed
```

规则：

```text
git fetch origin main
verify origin/main exact
checkout/switch exact subject
then machine proof
```

### 10.2 不要用 unconditional PASS print

一次 PowerShell 脚本前面已经 fail，但后面的：

```text
Write-Host "GATE_A_LOCAL_EXACT_MAIN_PROOF=PASS"
```

仍被执行，产生伪 PASS。

以后必须把整套 proof 放在：

```powershell
& {
  $ErrorActionPreference = "Stop"
  ...
  PASS 只在所有 assertion 后打印
}
```

机器 verifier JSON 才是 authority evidence，不认手工打印字符串。

### 10.3 Windows psql 缺失与 shim

Windows host 没有 native `psql.exe`。最终可用方案：

- `%TEMP%/geox-mcft-cap09-psql-shim-v2`；
- Node implementation 使用 repo-local `pg@8.18.0`；
- C# `psql.exe` launcher；
- launcher 必须 `RedirectStandardOutput/RedirectStandardError=true` 并回传 stdout/stderr。

两个历史错误：

```text
node -e PowerShell quoting
-> require(node:path) SyntaxError
```

以及：

```text
C# launcher 未转发 stdout
-> query EXIT=0 但 verifier 读到空 output
-> HOST_SECRET_BINDING_CONNECTED_DB_MISMATCH
```

修正后 probe：

```text
Evidence:
geox_mcft_cap09_production_runtime_v1
| geox_mcft_cap09_evidence_runtime_login_v1
| true | false

Twin:
geox_mcft_cap09_production_runtime_v1
| geox_mcft_cap09_twin_runtime_login_v1
| true | false
```

不要再恢复第一版带 `channel_binding` quoting 问题的 shim。

### 10.4 untracked simulator dirs

本地曾有：

```text
sensor-sim/
sensor-sim-kbs/
```

clean-worktree verifier 会拒绝。

正确处理：移到 repo 外临时保管，**不要删除用户内容**。

### 10.5 Node / CLI version

本机历史版本：

```text
Node v20.11.1
```

当时：

```text
neon@4.18.0 requires >=20.19.0
wrangler@4.132.0 requires >=22
```

不要假定 `npx ...@latest` 在此 Node 上可执行。除非确实需要 CLI，否则优先已有 API / direct proof；需要 CLI 时先升级 Node。

### 10.6 CI dependency startup transient

#3576 exact-head 曾出现 acceptance dependency startup 红灯。日志证明：Postgres / bootstrap / migration / MinIO 基本已成功，真正 first-red 是 `geox-v1-server` Fastify `onReady` timeout；pool error 是 shutdown 后次生错误。exact no-effect rerun 随后完整通过。

规则：

```text
first-red -> classify
transient -> exact no-effect rerun
deterministic -> minimal repair
```

不要看到一次 generic CI red 就扩大 semantic scope。

### 10.7 QCP absent / skipped != PASS

QCP 并非所有 path 都有 push carrier；某些 PR 中没有触发 QCP 是 path filter 结果。

必须区分：

```text
run missing
run skipped
run success
```

只有合法 carrier + exact subject/base + dependency binding 才能用于 admission。

### 10.8 fresh current-crop 不能历史继承

任何：

```text
was fresh at T0
```

都不能证明：

```text
is fresh at T1
```

runtime-start adjudication和 actual process admission 都必须重新用 wall clock 判断。

---

## 11. Cloudflare R2 / Neon 不要重复建设

已经存在并验证的 Evidence runtime R2：

```text
bucket
= geox-mcft-cap09-evidence-runtime-v1

Formal Raw bucket reuse
= false
```

不要因为换对话就重新创建 bucket 或重新设计 credential namespace。

Neon 也不要重建数据库、roles、ACL 或 login principals；credential rematerialization 已完成。后续如需要 readback，只做当前 gate 要求的最小证明。

---

## 12. Handoff 落库纪律 — 下一次必须沿用

#3298 是长期 conversation handoff PR：

```text
PR
= #3298

state
= OPEN / DRAFT / UNMERGED
```

标准落库方法：

```text
1. 不把 handoff 合并进 main
2. handoff update 与工程 PR 分离
3. 历史 handoff 内容不可改写 / 不可删除
4. 正常情况下对 canonical handoff 文件做 PURE PREPEND
5. 新 section 放最上方，旧全文作为 exact suffix
6. commit 只改 handoff 文档
7. additions-only，deletions=0
8. 验证 previous bytes 逐字节仍为新文件 suffix
9. 验证 remote content == prepared content
10. 更新 #3298 PR body，把最新 continuation section/file 指为 entry point
11. 保持 #3298 DRAFT / UNMERGED
```

历史 AH materialization 已使用过并验证：

```text
PURE_PREPEND = VERIFIED
AG_AND_EARLIER_EXACT_SUFFIX = VERIFIED
```

本轮由于当前工具无法安全地对约 1MB 的 canonical handoff 文件执行原子 pure-prepend 而不重传整文件，采用了保守方式：**新增本 continuation 文件到同一个 #3298 handoff branch，并把 PR body 指向本文件；原 AH 文件零修改。**

下一次如果有完整 local checkout / 可原子修改大文件的执行环境，应恢复 canonical `PURE PREPEND` 方法，而不是继续无限增加 continuation 文件。

禁止：

- 手工复制旧 handoff 后重新排版；
- 为省事删除历史 section；
- 把 code change 混进 #3298；
- merge #3298；
- 把 handoff 文案当 architecture authority。

---

## 13. 当前 frozen boundaries

当前没有任何授权允许：

```text
runtime start
production owner activation
Formal-v5 ARM
A0 bootstrap
O00-O23
B-Line semantic reopening
ADR construction reopening
credential / bucket / DB reprovisioning
```

当前只允许继续：

```text
RUNTIME-START AUTHORITY HARDENING
-> exact-head qualification
-> merge only after green
-> post-merge requalification
-> fresh temporal check
-> narrow NON_OWNER_STANDBY runtime-start adjudication
```

---

## 14. 接手者第一屏应看到的状态

```text
MCFT-CAP-09
= ACTIVE

protected main
= f9cdeb4eddb1801a339149a592ee41f9cf120257

Gate A
= CLOSED

TRUE NON_OWNER_STANDBY SEAM
= MERGED

WIP HARDENING BRANCH
= work/runtime-start-non-owner-hardening-v1

WIP HEAD
= b357918194d89a9f250624769322d7c0e89e24c6

WIP STATUS
= NOT QUALIFIED
= KNOWN ENV-KEY TYPO
= DO NOT MERGE

CURRENT BLOCKER
= runtime-start authority mode/proof/execution-time-freshness enforcement

PRODUCTION_RUNTIME_START_AUTHORITY
= UNARMED / HOLD

RUNTIME
= NOT STARTED

OWNER
= FALSE

FORMAL-v5
= HOLD
```

下一任应从 WIP branch 的 deterministic typo + semantic review 开始，而不是重新做 credential / R2 / Gate A。
