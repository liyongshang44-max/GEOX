# P1最小闭环初始化

本文档说明如何通过 `docker/postgres/init/003_p1_skill_seed.sql` 在初始化阶段写入最小技能定义数据，保证 demo 租户在启动后调用 `/api/v1/skills` 返回非空。

## 1) 最小租户样例约定

- `tenant_id`: `tenantA`
- `project_id`: `projectA`
- `group_id`: `groupA`
- 认证 token（示例）：`config/auth/ao_act_tokens_v0.json` 中 `tok_dev_ao_act_admin_v0`

> 说明：seed 数据与默认 dev token 的租户三元组保持一致，避免出现跨租户 404。

## 2) 初始化写入内容（skill_definition_v1）

`003_p1_skill_seed.sql` 会向 `facts` 追加 4 条 `skill_definition_v1` 记录，且每条记录均明确以下字段：

- `tenant_id`
- `project_id`
- `group_id`
- `skill_id`
- `version`
- `category`
- `status`
- `trigger_stage`
- `scope_type`
- `rollout_mode`

## 3) 启动后验证

> 假设 server 在本机 `http://127.0.0.1:8787`。

### curl 验证命令

```bash
curl -sS 'http://127.0.0.1:8787/api/v1/skills?tenant_id=tenantA&project_id=projectA&group_id=groupA' \
  -H 'Authorization: Bearer geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4' \
  -H 'Accept: application/json'
```

### 预期响应关键字段

- 顶层：
  - `ok: true`
  - `api_contract_version`（存在）
  - `items`（数组，且长度 `>= 1`）
- `items[*]` 中应可见：
  - `skill_id`
  - `version`
  - `category`
  - `status`
  - `trigger_stage`
  - `scope_type`
  - `rollout_mode`
  - `binding_status`
  - `updated_at`

示例（字段示意，非严格值）：

```json
{
  "ok": true,
  "api_contract_version": "2026-04-06",
  "items": [
    {
      "skill_id": "soil_moisture_inference_v1",
      "version": "1.0.0",
      "category": "sensing",
      "status": "ACTIVE",
      "trigger_stage": "before_recommendation",
      "scope_type": "FIELD",
      "rollout_mode": "DIRECT",
      "binding_status": "UNBOUND",
      "updated_at": "2026-04-10T00:00:01.000Z"
    }
  ]
}
```
