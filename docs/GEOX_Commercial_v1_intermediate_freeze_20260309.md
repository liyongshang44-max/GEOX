# GEOX / LandOS Control Plane
## Commercial v1 中间冻结摘要（2026-03-09）

仓库路径：`C:\Users\mylr1\GEOX`

### 当前产品定位

当前仓库已经不是“控制平面 API 原型集合”，而是一套进入 **Commercial v1 中间冻结态** 的农业运营控制台。目标仍然围绕三条闭环：

- 观测闭环
- 控制闭环
- 证据闭环

### 当前已冻结基线

以下验收已通过：

- Control-4
- Control-Gov
- Sprint C3
- Sprint C4
- Sprint F1
- Sprint D1
- Sprint A1
- Sprint W1
- Sprint R1
- Sprint O1

### 当前可用商业模块

- 总览 Dashboard（中文商业壳）
- 田块与 GIS（列表、详情、边界、季节）
- 设备中心（状态、最新遥测、最小趋势）
- 作业控制（审批、任务、调度、回执）
- 告警中心（规则、事件、ACK、Close）
- 审计与导出（导出、告警、回执、审批/调度总表）
- 证据导出（evidence pack、manifest、sha256）
- 系统设置（当前会话、最小角色门禁）

### 当前已完成闭环

#### 观测闭环
- 设备注册
- 设备心跳
- 原始 telemetry ingest
- telemetry latest / series / metrics

#### 控制闭环
- approval request
- approval decide
- AO-ACT task
- dispatch
- device receipt

#### 证据闭环
- evidence export job
- bundle.json
- manifest.json
- sha256.txt
- Export Jobs 中文页面

### 当前最小权限模型

- `admin`
- `operator`

当前约束：
- operator 不可审批
- operator 不可签发 / 撤销设备凭据
- operator 不可做 TENANT 范围 evidence export
- operator 仍可做对象级查看与对象级导出

### 尚未纳入本轮冻结范围

- 复杂地图编辑器 / GIS 可视化深化
- 完整用户管理后台
- 复杂 RBAC / 组织模型
- 短信、邮件、外部通知通道
- 复杂报表和 BI 面板
- 自动调度 / 自动执行编排

### 当前阶段建议

后续开发不要再随意扩新模块。建议优先进入：

1. 商业前端细节收口（导航、空状态、错误态、跳转链）
2. 演示版冻结与迁移文档固化
3. 再决定是否进入更重的 GIS / 用户系统 / 通知通道

### 一句话结论

当前仓库已经具备“可运行、可演示、可交接”的 Commercial v1 中间态，不应再按早期 API 原型心态开发。
