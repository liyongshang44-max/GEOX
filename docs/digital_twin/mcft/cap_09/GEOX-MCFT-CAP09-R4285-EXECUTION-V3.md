# R4285 V3 单次 TEST_ONLY 六阶段执行后继

本版本承接操作员已成功关闭的 Windows V3 非消耗预检。既有预检结果继续作为历史事实；不重放其能力、nonce、评论、Owner、Permit 或 Final，也不修改既有 V3 预检签名域。

## 入口与真实调用关系

`MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs --session-execute-test-only --input <绝对路径>` 是唯一物理执行 CLI。直接 `--execute`、预检模式、反序列化 PASS 和调用方回调都不能进入。

共享官方 Prepare 工厂通过固定的 `prepareExecution(input)` 产生同进程能力；原 `prepare(input)` 仍产生预检能力。新工厂路径在 FD3 之前校验当前 Subject 的 Native Adoption、原始签署资源 Scope、原生 Source Approval、执行专属 Launch 和 Intent、安装材料及实际加载边界。Producer 继续复用同一进程中的真实预备能力，不再次解封凭据或重新进行 Native Adoption。

Owner 的真实观察在 WAIT 之后开始，仍受 120 秒新鲜度限制。PG 权限保持已确认合同，不增加权限或重新开展权限库存盘点。动态资源绑定、材料验证、原生资源授权刷新和 Final 的 CTO 回读保留原有顺序，最后的原生回读距原子消费不得超过 15 秒。

执行后继独立使用以下授权，旧预检材料不能满足它们：

| 材料 | 执行专属值 |
|---|---|
| Launch schema | `MCFT_CAP09_R4285_PHYSICAL_SESSION_LAUNCH_V3` |
| Launch decision | `AUTHORIZE_ONE_V3_PHYSICAL_TEST_ONLY_SESSION` |
| Intent schema | `MCFT_CAP09_R4285_PHYSICAL_EXECUTION_INTENT_V3` |
| Intent decision | `AUTHORIZE_V3_ONE_PHYSICAL_TEST_ONLY_EXECUTION_INTENT` |
| Intent flags | `permit_authorized=true`, `execute_authorized=true`, `production_authorized=false` |
| Permit schema | `MCFT_CAP09_R4285_SIGNED_EXECUTION_PERMIT_V3` |
| Permit domain | `GEOX_MCFT_CAP09_R4285_EXECUTION_PERMIT_V3` + LF |
| Permit purpose | `ORIGINAL_SIX_STAGE_PHYSICAL_EXECUTION_TEST_ONLY` |
| Permit decision | `APPROVE_R4285_V3_ONE_PHYSICAL_TEST_ONLY_PERMIT` |
| Final schema | `MCFT_CAP09_R4285_PHYSICAL_FINAL_EXECUTION_APPROVAL_V3` |
| Final domain | `GEOX_MCFT_CAP09_R4285_PHYSICAL_FINAL_EXECUTION_APPROVAL_V3` + LF |
| Final decision | `APPROVE_R4285_V3_FINAL_SINGLE_PHYSICAL_TEST_ONLY_EXECUTION` |

Source Approval、Scope 和资源观察仍使用既有 V3 原始字节合同。新会话必须绑定最终合并 Subject、安装材料、Release Binding、新 nonce、新 Scope 和新的三个原生评论，不能沿用已关闭会话的固定值。授权评论仍在既有 #3757 权威来源范围内，不能由 PR 的源码 PASS 代替真实授权。

## 原调度器与停止语义

执行入口使用新的 V3 原子消费桥接和父进程阶段能力桥接，直接调用原 `MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs`、原 `resolveStages`、原子进程收据监督器以及原 V1 子进程票据合同。不会维护第二个六阶段调度器。

阶段顺序固定为 PRODUCER → TIMING_1 → TIMING_2 → TIMING_3 → CONTROLLED_DELAY → AGGREGATE。超时依次为 60、30、30、30、20、10 分钟，总计 180 分钟；Permit 必须覆盖总预算及额外 60 秒，并且不晚于 Resource Owner 和 Adoption。

共用原始 Run 与 nonce 的排他账本目录。任何部分占用、消费后故障、子进程失败、超时、收据断链或产物缺失均停止，不能清账本、回滚占用、自动重试或继续后续阶段。部分消费写入失败时，故障摘要使用 `permit_consumed=null`、`consumption_attempted=true`，明确不能推断未消费；账本原始文件保留裁定依据。消费成功后，用 Permit 的阶段有效期管理执行；120 秒 Owner 与 15 秒 CTO 准入时钟不作为长任务的续租要求。

成功仅表示六阶段原始收据已封存。`production_authorized=false`、`qualified=false`、`formal_v5_arm=false`，不启动生产或额外 Run。

## 源码收口与实际运行

唯一集成分支为 `mcft/r4285-v3-six-stage-execution`，基线为 `8890bf950773a43a1f9238672eeb335b1526edca`。中央 QCP 保留既有 73 项检查和前 72 项原定义，为第 73 项添加独立的精确执行后继路径归属；原有 resolver 和历史证据保持不变。本项源码资格不产生实时会话权限。

离线测试使用临时密钥与临时文件；真实子进程测试仅运行 fixture，验证原子消费、子进程 claim、原调度器顺序及失败停止，不进行 Windows 资源探测或物理农业阶段。

源码审查、中央 QCP 与适用 CI 通过并合并后，才按最终 Subject 生成安装和新会话材料。Windows 启动必须重新按实际 UTC 核算现有资源剩余期限、整点 first_base、Prepare 预算和执行预算。资源不足时停止并明确报告，不静默重新签发账号。旧预检会话保持关闭；真实 TEST_ONLY 作业只安排一次。
