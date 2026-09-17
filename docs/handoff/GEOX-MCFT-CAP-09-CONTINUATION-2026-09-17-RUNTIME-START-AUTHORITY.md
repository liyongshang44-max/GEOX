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
