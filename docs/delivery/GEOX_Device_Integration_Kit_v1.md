# GEOX 设备接入手册 v1（最小交付版）

本文档面向设备厂商、网关开发者与客户集成工程师，描述 GEOX Commercial v1 当前最小可售版本的设备接入规范。目标不是覆盖所有未来能力，而是给出“今天就能接入”的最小协议面。

## 1. 接入目标

GEOX 当前支持以下设备接入闭环：

- 设备注册
- 设备凭据签发与撤销
- 心跳上报与在线状态
- 遥测写入与查询
- 下行作业指令（AO-ACT dispatch）
- 设备回执 uplink

设备接入完成后，客户可在后台中看到：

- 设备详情
- 设备接入 Topic
- 最新心跳 / 电量 / 固件版本
- 最近命令与最近回执
- 田块绑定关系

## 2. 鉴权与凭据生命周期

### 2.1 设备注册

先由管理端调用：

- `POST /api/devices`

最小请求体：

```json
{
  "device_id": "dev_001",
  "display_name": "温湿度一体节点 001"
}
```

### 2.2 凭据签发

由管理员调用：

- `POST /api/devices/{device_id}/credentials`

成功后会返回：

- `credential_id`
- `credential_secret`
- `credential_hash`

其中 `credential_secret` 只会返回一次，必须在签发当下保存到设备安全存储或工厂烧录流程中。

### 2.3 凭据撤销

- `POST /api/devices/{device_id}/credentials/{credential_id}/revoke`

撤销后，该凭据不应再用于后续设备写入。

## 3. Topic 规范

当前 Commercial v1 设备接入默认 Topic 规则如下：

- 遥测上行：由遥测写入接口接收，不强制 MQTT Topic
- 心跳上行：由心跳接口接收，不强制 MQTT Topic
- 下行指令 Topic：`downlink/{tenant_id}/{device_id}`
- 回执上行 Topic：`receipt/{tenant_id}/{device_id}`

在设备详情控制台中，可直接看到：

- telemetry_topic
- heartbeat_topic
- downlink_topic
- receipt_topic

若部署方已有既定 MQTT 主题体系，可在 dispatch / receipt 时显式传入 topic 覆盖默认规则，但推荐先遵循默认规则以降低集成摩擦。

## 4. HTTP 接入面

### 4.1 心跳

- `POST /api/v1/devices/{device_id}/heartbeat`

建议最小请求体：

```json
{
  "battery_percent": 86,
  "signal_dbm": -71,
  "fw_ver": "1.0.3"
}
```

建议频率：

- 在线设备：5 分钟一次
- 低功耗设备：10–15 分钟一次

平台当前默认以最近 15 分钟心跳判断 ONLINE / OFFLINE。

### 4.2 遥测写入

当前仓库中遥测写入链路由 ingest 侧处理，设备应按既有接入程序向 GEOX ingest 写入原始 telemetry 事实。建议 payload 至少包含：

- `device_id`
- `metric_key`
- `value`
- `ts_ms`

推荐指标键示例：

- `soil_moisture`
- `soil_temp_c`
- `air_temp_c`
- `battery_percent`

### 4.3 遥测读取

- `GET /api/v1/telemetry/latest?device_id=...`
- `GET /api/v1/telemetry/series?device_id=...&metric_key=...`

## 5. 下发与回执规范

### 5.1 下发 dispatch

AO-ACT 作业在审批通过后会进入 dispatch outbox。对设备侧而言，核心是订阅：

- `downlink/{tenant_id}/{device_id}`

下发 payload 中至少应读取：

- `act_task_id`
- `device_id`
- `action_type`
- `params`

### 5.2 回执 uplink

设备执行后，应向以下 Topic 写回执：

- `receipt/{tenant_id}/{device_id}`

建议最小回执 payload：

```json
{
  "act_task_id": "act_xxx",
  "device_id": "dev_001",
  "status": "SUCCEEDED",
  "message": "completed",
  "ts_ms": 1760000000000
}
```

状态建议值：

- `SUCCEEDED`
- `FAILED`
- `REJECTED`

## 6. 设备开发建议

### 6.1 幂等

同一个 `act_task_id` 不应重复执行多次。设备端应把 `act_task_id` 作为本地去重键。

### 6.2 弱网

设备端应能在弱网情况下：

- 本地缓存最近一次待发回执
- 恢复连接后补发回执
- 避免同一回执无限重发

### 6.3 安全

不要在日志中打印明文 `credential_secret`。不要把 secret 硬编码进公开仓库。若设备被更换或泄露，应立即撤销凭据并重新签发。

## 7. 最小联调路径

建议按以下顺序联调：

1. 注册设备
2. 签发凭据
3. 上报一次心跳
4. 写入一条 soil_moisture 遥测
5. 在后台确认设备 ONLINE 且看到最新遥测
6. 创建审批并触发一次下行作业
7. 设备订阅 downlink Topic 并回传 receipt
8. 在设备控制台与 Operations 页确认最近命令 / 最近回执

## 8. 交付物位置

- OpenAPI JSON：`GET /api/v1/openapi.json`
- 本手册：`docs/delivery/GEOX_Device_Integration_Kit_v1.md`
- 控制平面协议补充：`docs/controlplane/GEOX-Control-3-MQTT-Downlink-Adapter-v1.md`
- 执行协议补充：`docs/controlplane/Execution_Protocol_v1.md`
