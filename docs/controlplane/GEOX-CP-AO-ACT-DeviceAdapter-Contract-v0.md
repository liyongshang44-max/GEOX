# GEOX · Sprint 21
# Apple III · AO-ACT — Device Adapter Contract v0（L2 · 冻结候选）

适用：Control Plane / Apple III（AO-ACT）

本文件仅定义：
1) AO-ACT 如何接收“设备材料”（device_ref）作为 append-only facts；
2) AO-ACT receipt 如何引用 device_ref；
3) 服务器端仅做结构校验 + 存在性校验，不解析内容。

------------------------------------------------------------

## 1. 目的（Purpose）

为真实设备接入建立最小协议骨架，使系统可以在不引入任何自动化控制能力的前提下：
- 接收设备侧日志/轨迹/片段证据（作为 facts 写入）；
- 在 receipt 中引用这些证据；
- 支持离线诊断：给定 act_task_id 能定位到相关证据。

## 2. 非目标（Negative Guarantees）

本 Sprint 明确禁止：
- ❌ 实时控制 / 下发指令
- ❌ 设备状态机 / 在线离线判断
- ❌ 解析 device_ref 内容并据此产生任何结论
- ❌ 设备结果写回 Apple II（Judge）或影响其语义
- ❌ 自动触发 / scheduler / queue

## 3. 新增事实类型：ao_act_device_ref_v0

### 3.1 语义

ao_act_device_ref_v0 表达：
“来自某个 executor（可能是 device）的、与执行相关的一段外部材料”。

它是证据载体，不承诺真实性，不承担解释，不触发任何控制语义。

### 3.2 Schema

规范真源：
- `packages/contracts/ao_act_device_ref_v0.schema.json`

关键字段：
- executor_id：材料来源（identity anchoring only）
- kind：材料类型（log_text / trace_json / sensor_snippet_json / opaque）
- content_type：MIME 或自定义类型标识（不解析）
- content：原始内容（字符串，允许 JSON 文本，服务器不解析）
- sha256：可选；若提供，仅做格式校验

## 4. Receipt 引用：payload.device_refs[]

Receipt（ao_act_receipt_v0）新增可选字段：
- payload.device_refs[]

每个 device_ref 结构：
- kind = device_ref_fact
- ref = ao_act_device_ref_v0 的 fact_id
- note（可选）

服务器端纪律：
- 仅做“存在性校验”：ref 指向的 fact_id 必须存在且 type=ao_act_device_ref_v0
- 不读取/不解析该 fact 的 content

## 5. API（最小）

新增写入入口（append-only）：
- POST `/api/control/ao_act/device_ref`
  - 写入 ao_act_device_ref_v0 fact
  - AuthZ：沿用 AO-ACT 的 `receipt.write` scope（本 Sprint 不新增 scope）

Receipt 写入补充校验：
- 若携带 device_refs，则必须全部通过存在性校验；否则请求失败。

## 6. Acceptance（冻结前）

必须覆盖：
1) 写入 device_ref 成功
2) receipt 引用存在的 device_ref → 成功
3) receipt 引用不存在的 device_ref → 必须失败（400/DEVICE_REF_NOT_FOUND）
