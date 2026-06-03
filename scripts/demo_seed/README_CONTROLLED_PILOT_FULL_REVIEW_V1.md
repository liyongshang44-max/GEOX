# Controlled Pilot Full Review Seed V1

本 seed 用于本地受控试点人工验收，不是生产客户数据，也不是旧 lightweight demo seed 的扩展。

## 命令

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --dry-run --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --apply --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --verify --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --tenant tenantA
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --apply --tenant tenantA
```

默认模式是 dry-run。`--apply` 必须显式传入 `--tenant`。允许 tenant 只有 `tenantA` 和 `demo`。

## 数据范围

seed lane 为 `CONTROLLED_PILOT_FULL_REVIEW`，版本为 `v1`。它会写入：

- `facts`
- `field_index_v1`
- `field_polygon_v1`
- `device_index_v1`
- `device_binding_index_v1`
- `device_status_index_v1`
- `device_capability`
- `telemetry_index_v1`
- `device_observation_index_v1`
- `alert_event_index_v1`
- `field_memory_v1`

## 场景

1. C8 灌溉闭环成功。
2. C8 灌溉待验收。
3. 设备离线，已绑定地块。
4. 设备离线，聚合来源 / 缺少定位，只读。
5. 病虫害巡检建议，待审批。
6. 无地块绑定负例，只在验收脚本中验证，不写入长期队列。
7. 客户报告中心完整入口。

## 清理边界

cleanup 只清理 manifest 中登记的 seed-owned 记录，以及 `fact_id like 'full_review_seed_<tenant>_%'` 的 facts。禁止 truncate，禁止按 tenant 粗暴清理。

## 正式链路边界

seed 不使用 dev flight table、sim trace 或 flight-table 证据伪装 formal evidence。正式农业作业必须有真实 `field_id` 或 `spatial_scope.field_id`。aggregate-only / missing-location 只能作为只读排查入口，不生成正式 AO-ACT 成功、客户价值结论或田块记忆。
