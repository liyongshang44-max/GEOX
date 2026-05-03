# IRRIGATION MVP0 Support Runbook

> 每个问题包含：症状 / 常见原因 / 排查命令 / 责任层 / 回退动作。

## 1) 服务启动失败
- 症状：HTTP 不可达，健康检查失败。
- 常见原因：端口占用、环境变量缺失、构建未完成。
- 排查命令：`lsof -i :3001`; `pnpm -w -r build`; `pnpm -w -r start`。
- 责任层：Report。
- 回退动作：回滚到上一个可用镜像与配置。

## 2) Postgres 连接失败
- 症状：`ECONNREFUSED` / `timeout`。
- 常见原因：`DATABASE_URL` 错误、DB 未启动、网络不通。
- 排查命令：`echo $DATABASE_URL`; `pg_isready`; `psql "$DATABASE_URL" -c 'select 1'`。
- 责任层：Execution。
- 回退动作：切换到备用库或恢复上一个连接配置。

## 3) token 缺失或权限不足
- 症状：401/403。
- 常见原因：token 未传，scope 不含必需权限。
- 排查命令：检查请求头 `Authorization`；核对 scope 配置。
- 责任层：Approval。
- 回退动作：签发临时最小权限 token 并复测。

## 4) observation 不产生 recommendation
- 症状：`recommendations` 为空。
- 常见原因：缺水信号不足、派生状态未写入、数据过旧。
- 排查命令：查询 `device_observation_index_v1` 与 `derived_sensing_state_index_v1`。
- 责任层：Sensing / Agronomy。
- 回退动作：补齐观测样本并重跑 recommendation。

## 5) prescription 生成失败
- 症状：`from-recommendation` 报错。
- 常见原因：recommendation_id 无效、参数 schema 不匹配。
- 排查命令：重放请求体；检查 recommendation 是否存在。
- 责任层：Prescription。
- 回退动作：降级使用标准参数模板。

## 6) approval 卡住
- 症状：长期无 `decide` 结果。
- 常见原因：审批人未处理、审批链配置错误。
- 排查命令：查询 approval request facts。
- 责任层：Approval。
- 回退动作：人工介入审批并记录审计。

## 7) mock valve skill_run 缺失
- 症状：无 `skill_run_id`。
- 常见原因：skill 未绑定、能力不匹配、设备离线。
- 排查命令：查 task fact `skill_binding_evidence`；调用 mock-valve run。
- 责任层：Skill。
- 回退动作：切换到手动执行并补录 evidence。

## 8) receipt 缺失
- 症状：无 receipt fact。
- 常见原因：执行器未回执、task_id 不一致。
- 排查命令：`POST /api/v1/actions/receipt` 重试；查 facts。
- 责任层：Execution。
- 回退动作：人工补录 receipt 并标记来源。

## 9) as-executed 生成失败
- 症状：`as_executed_id` 为空。
- 常见原因：receipt 字段不完整。
- 排查命令：检查 receipt payload 必填字段。
- 责任层：Execution。
- 回退动作：修正 receipt 后重建 as-executed。

## 10) acceptance 不通过
- 症状：`verdict=FAIL/PARTIAL`。
- 常见原因：post observation 无改善、证据不足。
- 排查命令：对比 pre/post soil moisture；检查 evidence_refs。
- 责任层：Acceptance。
- 回退动作：触发 fail-safe 与人工接管。

## 11) field_memory_v1 查不到记录
- 症状：field memory 查询为空。
- 常见原因：scope 不一致（tenant/project/group）、写入缺失。
- 排查命令：按 scope 查询 `field_memory_v1`；检查 `recordMemoryV1` 调用参数。
- 责任层：Memory。
- 回退动作：修复 scope 后重放写入链路。

## 12) ROI 无 baseline/confidence/evidence_refs
- 症状：ROI 可信度检查失败。
- 常见原因：as-executed 输入不足、计算降级。
- 排查命令：检查 `roi_ledger_v1` 字段完整性。
- 责任层：ROI。
- 回退动作：标记为估算并阻断对外展示“测量值”。

## 13) customer report 无 Field Memory/ROI
- 症状：客户报告缺关键章节。
- 常见原因：调用了错误 route，或 projection 输入不完整。
- 排查命令：调用 `GET /api/v1/reports/operation/{operation_id}`；检查 operation report payload。
- 责任层：Report。
- 回退动作：改用正式 report route 并重生成。

## 14) release gate FAIL 如何定位
- 症状：`irrigation_mvp0_closed_loop=FAIL`。
- 常见原因：链路 ID 存在但存储对象不存在、scope 不匹配。
- 排查命令：逐项执行 `existsSkillBinding/existsSkillRun/existsReport/existsFieldMemory/existsRoiLedger`。
- 责任层：Task / Skill / Execution / Acceptance / Memory / ROI / Report。
- 回退动作：按失败节点重跑单环，保留失败审计与复盘记录。
