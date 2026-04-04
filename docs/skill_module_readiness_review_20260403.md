# GEOX 代码审查：是否可支撑“Skill 板块”开发（2026-04-03）

## 结论（先说结果）

**可以支撑“Skill 板块”的第一阶段开发，但还不能直接支撑“可规模化、可商品化”的 Skill 体系。**

- 你要的农业闭环主链路（监测→建议→审批→执行→回执→验收→复盘）在仓库中已经有可运行骨架。
- 但“Skill 板块”如果目标是可配置/可复用/可审计/可多租户运营的能力中心，当前仍缺少：
  - Skill 注册与版本治理
  - Skill 与流程节点的契约化边界
  - 统一编排器（而非散落在 route/job 中）
  - 更完整的身份与权限体系（当前偏静态 token）
  - 运行观测与回放工具

---

## 与你目标闭环的映射审查

### 1) 监测（Monitor）
- 已具备遥测查询与设备状态基础能力，存在 telemetry 与 device heartbeat 路由。可满足“远程监控土地与作物状态”的基础数据读取入口。 

### 2) 建议（Suggest）
- 已具备 agronomy inference 与 decision recommendation 相关链路，能形成建议输入和建议状态的一部分基础。 

### 3) 审批（Approve）
- 已有 approval_request 与 decision 路由，并且有租户三元组隔离校验。可支撑人审节点。 

### 4) 执行（Execute）
- AO-ACT 执行域存在 action allowlist、参数校验、禁止字段扫描等 guardrail，具备面向人/设备执行的安全边界雏形。 

### 5) 回执（Receipt）
- AO-ACT receipt 已可写入并参与后续链路聚合，且有操作状态投影可读。 

### 6) 验收（Acceptance）
- acceptance_v1 已实现按任务拉取 task + receipt 并产出验收结果，闭环关键节点存在。 

### 7) 复盘（Review）
- operation_state_v1 有 rule_performance_feedback 记录与效果判定逻辑，evidence_report_v1 能生成报告与证据归档，是“复盘”最接近产品化的部分。 

---

## 对“Skill 板块”的准备度判断

## 已有可复用底座（利好）
1. **事实账本 + 投影模式明确**：你可以把 Skill 作为“事实生产者/消费者”挂在现有 facts + projections 架构中，不必推翻现有系统。
2. **流程节点齐全**：从建议到验收的关键节点都已有 API 或投影入口，便于把 Skill 作为节点增强器接入。
3. **有异步作业与 agent 雏形**：jobs runtime 已在跑 export/evidence/agronomy agent，说明可容纳 Skill 执行器进程模型。

## 当前关键短板（阻碍 Skill 产品化）
1. **缺少 Skill 一等公民模型**
   - 仓库中没有 skill_registry / skill_version / skill_binding / skill_run 这类实体。
   - 现在更像“把能力散落在 route + service + job”，复用与治理成本高。

2. **API 治理与实现存在裂缝**
   - telemetry v1 路由在代码里标记 deprecated 且需要 `__internal__=true`，对 Skill 作为外部可复用能力不友好。
   - openapi 文档与实际实现之间仍有偏差风险（历史文档也已提示）。

3. **认证授权体系偏静态**
   - 当前 token 来源为本地 JSON allowlist，适合开发/演示，不适合 Skill 市场化接入（组织级账户、审计、SSO）。

4. **编排器缺失**
   - 当前闭环虽然存在，但状态推进逻辑分散在多个路由与脚本。
   - Skill 板块若要支持“监测-建议-审批-执行-回执-验收-复盘”模板化，需要明确 workflow engine 或 state machine 抽象。

5. **部分文档仍是占位或冻结期描述**
   - 执行协议文档仍是 placeholder，不利于 Skill 开发团队做一致性实现。

---

## 结论分级（是否“现在就能做 Skill 板块”）

- **能做（MVP）**：可以。建议先做“内部 Skill 插件化”而非“开放 Skill 平台”。
- **能卖（Commercial）**：暂不建议直接对外承诺。需先补齐身份、编排、契约、治理与观测。

---

## 建议的最小落地路线（4~6 周）

### P0（1~2 周）先把 Skill 接口打通
- 新增 `skill_definition_v1`（声明输入/输出契约、触发阶段、版本）。
- 新增 `skill_run_v1`（每次执行审计记录、输入摘要、输出摘要、错误码、耗时）。
- 在 operation_state 链路中预留 hook：`before_recommendation` / `before_approval` / `before_dispatch` / `before_acceptance` / `after_acceptance`。

### P1（2~3 周）让 Skill 可治理
- 新增 Skill 注册、启停、灰度（按 tenant/field/program 绑定）。
- 增加策略：超时、重试、熔断、幂等键。
- 给 openapi 增加 Skill 相关路径并与实现一致。

### P2（1 周）让 Skill 可运营
- 增加 Skill 运行看板（成功率、耗时 P95、失败码 TopN）。
- 增加“按 operation_plan_id 回放 Skill 执行轨迹”。

