# GEOX / MCFT-CAP-08 完整任务线 v0.3.8 — COMPACT PR-1 AUTHORITY CANDIDATE

```yaml
document_status: PR_1_AUTHORIZED_BOUNDARY_CANDIDATE
capability_line_id: MCFT-CAP-08
slice_id: MCFT-CAP-08.S0
pr_1_base_sha: dfda2dd55e140313598dbc2fcbc9176c8891f465
invalidated_candidate_sha: 71d607cd887833ff0062a54983c4b43895d47966
invalidated_candidate_authoritative: false
effective_freeze_gate_completion: 2 / 17
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
production_runtime_source_authorized: false
next_effective_slice_when_attested: S1
```

## 1. 本次裁决

PR-0 已由 protected merge `ade35875ff6f5ef92ec76f04ab9fc302c57f700e` 完成 Candidate Registry 预注册；CAP-07 successor gate 基础设施已由 protected merge `dfda2dd55e140313598dbc2fcbc9176c8891f465` 建立。旧 PR #2621 / head `71d607cd887833ff0062a54983c4b43895d47966` 因权限图、Progress predicates、exact-SHA 与交付边界缺陷作废，不得投影为权威证据。

本 PR 只建立 S0 authority reconciliation、contracts、dedicated database bootstrap、focused acceptance 与 exact-SHA transport。它不是 Runtime 实现，不创建生产 Runtime source，不授权 MCFT-CAP-09。

## 2. 冻结现实范围

Exact six-key scope：

```text
tenantA / projectA / groupA / field_c8_demo / season_2026_c8_corn / zone_mcft_c8_water_001
```

Formal run：B00 bootstrap root（不计成功 Tick）+ T00–T23 共 24 个成功 Tick。每 Tick 生成一个 72 点 Forecast；Scenario 固定为 `NO_ACTION`、`IRRIGATE_NOW_15MM`、`IRRIGATE_NOW_25MM`。Residual 固定 R-01–R-24；R-01–R-16 为 calibration window，R-17–R-24 为 holdout。Candidate=1，Shadow Evaluation=1，Model Activation=0，Decision=1，Action Feedback=1。最终 formal run 只能由 PR-7/S6 执行。

## 3. Late Evidence 数学

FVO-01 在 T01–T15 对 Runtime 不可见，于 T16 append-forward。禁止改写历史 State、Checkpoint、Forecast、Scenario 或 Residual。传输算子必须重新计算完整 ordinary posterior transition：

```text
g_k(x)=Assimilation_k(Dynamics_k(x), frozen Evidence, Runtime Config, quality, clipping)
a_k=(g_k(x+epsilon)-g_k(x-epsilon))/(2*epsilon)
Phi_t_tau=product(clip(a_k,-a_max,a_max))
delta_x_t=exp(-lambda*lag)*Phi_t_tau*K_tau*(y_tau-H_tau*x_tau)
```

共享 vectors 共 12 条，覆盖正/负 residual、LIMITED quality、最大 lag、lag rejection、上下 clipping、non-finite rejection、ordinary assimilation、zero sensitivity、variance floor 与 deterministic rerun。PR-1 oracle 与 PR-4 production implementation 必须消费同一 vectors 文件。

## 4. Writer Authority

S0 只允许 dedicated fresh PostgreSQL database，禁止在 shared commercial database 上 bootstrap。Runner 为 `geox_mcft_cap08_runner_v1`，NOINHERIT、非 superuser、无 CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS、无 membership、无 ownership、不可 SET ROLE。

有效权限图必须覆盖 PUBLIC、role membership、database/schema/relation/sequence/function ACL、default ACL 与 ownership。Writer allowlist 精确覆盖 30 张已存在关系。`facts` 只允许 SELECT/INSERT；CAP-07 visibility epoch/index 只允许 SELECT；禁止 DELETE/TRUNCATE/REFERENCES/TRIGGER、sequence privilege、function EXECUTE、schema CREATE、database TEMP/CREATE。

Dedicated database 完成 bootstrap 后：PUBLIC、`geox_mcft_migrator_v1` 与 `geox_runtime_v1` 均不得 CONNECT 或保留对象权限；仅 bounded runner 与外部 superuser admin path 可连接。production Runtime source 始终为 false。

## 5. 真实 schema 顺序

Focused PostgreSQL proof 必须使用生产顺序：

```text
docker/postgres/init/*.sql
→ CAP-07 external-admin platform bootstrap
→ registered legacy migrations
→ dedicated migrator 执行 CAP-07 visibility migration
→ CAP-08 effective-privilege bootstrap
```

不得遍历并盲目执行全部 migration，不得用 Runtime credential 代替 admin/migrator。

## 6. Progress Resolver

Resolver 是 read-only、deterministic、fail-closed。机器契约拆分为 state machine、SQL query catalog 与 exhaustive witness catalog 三个独立文件，三者以 SHA-256 绑定。只读取 active visibility epoch 中的 canonical facts，并同时校验 exact formal_run_id、六键 scope、lineage/revision、checkpoint pointer 与 predecessor obligations。Canonical progress payload 必含：`formal_run_id`、`phase_id`、`transaction_family`、`obligation_id`。

合同冻结 25 个互斥状态、连续 priority 1–25、6 条参数化 PostgreSQL queries，并区分 `AFTER_COMMIT` 与 `RESUME`。`FAILED_CLOSED_CONFLICT` 为最高优先级；其余 predicates 显式要求 `conflict=false`。Resolver 不写库、不修复、不抢占 writer authority。

## 7. Phase orchestration

Stable order：

```text
resolve → E → H → A → B → G → C → barrier
```

PR-2 建立 phase engine skeleton 与空 G/H/C providers；PR-3 增加 G/H；PR-4 增加 Recovery 与 late A；PR-5 增加 C residual 与 post-run D。PR-2 输出 `phase_engine_core_digest`，PR-3–PR-5 不得漂移，除非进入 Architecture Deviation Adjudication。

## 8. S0 changed-file boundary

本候选严格为 44 文件。允许：CAP-08 contracts/status、Stage-1 closure authority、CAP-04 successor reconciliation、Candidate Registry、两份 CAP-08 workflows、一个 database bootstrap、治理 acceptance 与 Runtime acceptance。禁止：Runtime domain、routes、web、business migrations、canonical Runtime data、CAP-07 workflow/status 修改。

全局 Master、Implementation Map、Vertical Matrix 与根 package.json 不在 S0 生效最小边界中；它们由后续独立 settlement 在 S0 exact-SHA 生效后更新，避免 authority candidate 与全局规划写回耦合。

## 9. Candidate / merge tree equivalence

Candidate evidence 只能投影到 protected merge，当且仅当：

```text
candidate_to_merge_tree_delta = 0
candidate_tree_sha = merge_tree_sha
attested_tree_sha = merge_tree_sha
```

Candidate head 变化使 focused evidence 失效。Merge queue 模式还必须验证 merge-group required checks。任何 tree delta 均 fail closed，并要求在刷新后的 candidate 上重跑。

## 10. Exact-SHA 与 effectiveness

Focused workflow：`mcft-cap-08-authority-reconciliation`。Standard workflow：`ci`。Exact-SHA workflow：`mcft-cap-08-exact-sha-attestation`，必须 checkout exact subject SHA；手工 dispatch 只能证明 current main。

PR-1 repository state 始终为 conditional candidate。仅当文件存在于 main、candidate/merge tree 等价、exact merge-SHA workflow PASS、R2 artifact upload/readback PASS 时，才可投影：

```text
effective_status = IN_PROGRESS
effective_next_slice = S1
bounded_replay_runner_authorized = true
bounded_canonical_transaction_authorized = true
production_runtime_source_authorized = false
```

禁止 post-merge SSOT writeback 制造 proof carrier。

## 11. S0 必过验收

1. Authority reconciliation 与 Registry object-array schema；
2. 44-file exact boundary；
3. candidate/merge tree equivalence；
4. dedicated DB platform bootstrap；
5. business schema structure digest before=after；
6. effective privilege graph exact；
7. alternate login writer paths=0；
8. real `facts` INSERT 触发 CAP-07 visibility index；
9. transaction rollback 后 facts/visibility count 零增量；
10. 25/25 Progress witnesses 与 6 条 PREPARE/EXPLAIN queries；
11. 12/12 Late Correction vectors；
12. Typecheck、standard CI、CAP-07 successor regression；
13. candidate artifact 与 exact merge-SHA artifact subject 语义正确；
14. R2 retention 730 天 upload/readback。

## 12. 后续 Slice

- S1：Base runtime + 24 Tick skeleton；
- S2：Forcing/Evidence/State/Forecast；
- S3：Decision + Action Feedback；
- S4：Late Evidence append-forward correction；
- S5：Residual + Calibration + Shadow；
- S6：正式双跑、重启恢复、tree-equivalent exact-SHA closure。

S1 之前禁止实现 Runtime source、scheduler、public HTTP writer、live ingestion、Model Activation 或 MCFT-CAP-09。

## 13. Freeze Gate

```text
1  PR-0 protected merge / Registry preregistration       COMPLETE
2  CAP-07 successor gate protected merge                 COMPLETE
3  PR-1 contracts present on main                        PENDING
4  Dedicated DB effective privilege graph                PENDING
5  25-state Progress predicates                          PENDING
6  12 shared Late vectors                                PENDING
7  Exact FVO/Residual due map                            PENDING
8  Transaction micro-sequence                            PENDING
9  Phase orchestration skeleton contract                 PENDING
10 Residual oracle                                        PENDING
11 Determinism digest policy                              PENDING
12 Schema/privilege digest split                         PENDING
13 Candidate Registry transition proof                   PENDING
14 44-file boundary                                       PENDING
15 Candidate/merge tree equality                          PENDING
16 Exact merge-SHA R2 attestation                         PENDING
17 S1 authorization projection                           PENDING
```

当前 effective Freeze Gate completion: **2 / 17**。PR-1 合并前不得声称 S0 effective；PR-1 exact-SHA attestation 前不得进入 S1。
