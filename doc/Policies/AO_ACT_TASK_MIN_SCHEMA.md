# AO_ACT_TASK 最小校验规范（v0）

## 适用范围
- 路由：`POST /api/control/ao_act/task`
- 代码锚点：`apps/server/src/routes/control_ao_act.ts` 中导出的 `AO_ACT_TASK_SCHEMA_RULES_V0`

## 1) forbidden keys 列表来源
`forbidden keys` 的单一来源是：
- `apps/server/src/routes/control_ao_act.ts`
- 常量：`AO_ACT_TASK_SCHEMA_RULES_V0.forbidden_keys`

路由在接收请求体后会递归扫描 key；若命中任一 forbidden key，直接返回 `400 FORBIDDEN_KEY:<key>`。

## 2) parameter_schema 与 parameters 一一对应
`parameter_schema.keys` 与 `parameters` 必须严格一一对应（1:1）：
- 不允许 `parameters` 出现 schema 未声明的额外键
- 不允许缺失 `parameter_schema.keys` 中声明的键
- `parameters` 值仅允许原子类型（number/boolean/string），不允许 object/array
- 当 schema 类型为 `enum` 时，`parameters` 中对应值必须在 `enum` 列表内

> 冻结口径：`parameter_schema.keys must 1:1 match parameters keys (no missing, no extras)`

## 3) IRRIGATE 最小合法示例（duration_sec）
```json
{
  "action_type": "IRRIGATE",
  "parameter_schema": {
    "keys": [
      { "name": "duration_sec", "type": "number", "min": 1 }
    ]
  },
  "parameters": {
    "duration_sec": 30
  }
}
```

该示例是 `AO_ACT_TASK_SCHEMA_RULES_V0.irrigate_minimal_example` 的文档化版本，可用于 smoke/预检脚本对齐。
