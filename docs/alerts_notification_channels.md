# 告警通知通道集成（短信 / 邮件 / 企业微信 / 钉钉）

本次实现基于 `alerts_v1`：

- 告警规则继续使用 `notify_channels` 字段（数组）定义通知通道。
- 触发告警事件时先落库为 `PENDING` 通知记录。
- 后台 `startAlertNotificationWorker()` 异步分发并回写状态：
  - `DELIVERED`
  - `FAILED`

## 支持通道

- `SMS`：Twilio
- `EMAIL`：邮件 webhook（适配你自己的邮件服务）
- `WECHAT`：企业微信机器人 webhook
- `DINGTALK`：钉钉机器人 webhook
- `WEBHOOK`：通用 webhook
- `INAPP`：站内占位（直接标记 `DELIVERED`）

## 环境变量

### SMS（Twilio）

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `ALERT_SMS_TO`

### EMAIL（Webhook 方式）

- `ALERT_EMAIL_WEBHOOK_URL`
- `ALERT_EMAIL_TO`

### 企业微信 / 钉钉 / 通用

- `ALERT_WECHAT_WEBHOOK_URL`
- `ALERT_DINGTALK_WEBHOOK_URL`
- `ALERT_WEBHOOK_URL`

## 规则示例

```json
{
  "object_type": "DEVICE",
  "object_id": "demo_device_001",
  "metric": "battery_percent",
  "operator": "LT",
  "threshold_num": 20,
  "notify_channels": ["SMS", "EMAIL", "WECHAT", "DINGTALK"]
}
```

## API

- 创建规则：`POST /api/v1/alerts/rules`
- 查询事件：`GET /api/v1/alerts/events`
- 查询通知：`GET /api/v1/alerts/notifications`
