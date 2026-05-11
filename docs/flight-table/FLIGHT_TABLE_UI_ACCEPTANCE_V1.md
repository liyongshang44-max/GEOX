# Flight Table UI Acceptance V1

## Purpose

This document defines the acceptance criteria for the internal `/dev/flight-table` console. The console is an object assembly and full-chain verification rig. It is not a formal customer or operator page.

## Required route

```text
/dev/flight-table
```

The route may exist in the app router, but it must not appear in customer or operator formal navigation.

## Information architecture

The page must have five tabs:

1. 对象装配
2. 航线编排
3. 运行监控
4. 验收回放
5. 诊断报告

Default tab:

```text
对象装配
```

## Left internal navigation

The left internal navigation must include:

- 飞行总览
- 对象装配
- 航线编排
- 运行监控
- 验收回放
- 诊断报告
- 客户页面映射
- 运营页面映射

This is internal navigation only. It must not be reused as customer/operator navigation.

## Header

The header must show:

- GEOX 飞行台
- 对象装配 · 真实设备接入 · 全链路验收
- Tenant
- Project
- Group
- Current Run
- Lane
- run status

Primary actions:

- 保存装配
- 导出验收包
- 启动飞行

Secondary actions:

- 只运行校验
- 重新运行失败步骤
- 清理本次数据

## Summary cards

The console must show four summary cards:

- 田块对象：已创建 / 未创建
- 田块空间：已上传 GeoJSON / 未上传
- 设备接入：N 台设备 / N 台在线
- 技能绑定：N 条已绑定 / N 缺失

These values must come from Flight Table run/manifest/device/skill state. The page must not call customer/operator APIs directly to produce these cards.

## Object assembly first screen

The first screen must focus on object assembly, not only status display.

Required assembly blocks:

- 田块创建
- 田块空间 / GIS
- 真实设备接入向导
- 技能装配

## Device onboarding wizard

The wizard must show these steps:

1. 选择设备模板
2. 创建设备
3. 签发凭证
4. 绑定田块
5. 发送 heartbeat
6. 发布 telemetry
7. 验证 observation / sensing

Credential display must use:

```text
****
```

Raw credential secret, token, private key, credential payload, or raw secret must not appear in the UI.

## Bottom console blocks

The object assembly screen must also expose these lower blocks:

- 航线编排
- 运行监控
- 验收回放

These blocks may link or switch to the full tab, but they must remain visible enough to show the full-chain nature of the rig.

## Run monitor

The run monitor must show A-I step status and allow failed-step retry. Failures must be attributable to a layer, not shown as generic page failure.

Allowed step states:

```text
PENDING
RUNNING
PASS
FAIL
SKIPPED
```

## Replay links

The UI may show links to existing customer/operator pages for verification replay:

- `/customer/reports`
- `/customer/fields/:fieldId`
- `/customer/operations/:operationId`
- `/operator/dispatch?operation_id=...`
- `/operator/acceptance?operation_id=...`
- `/operator/evidence?operation_id=...`
- `/operator/roi-ledger?operation_id=...`
- `/operator/field-memory?operation_id=...`

These are links only. They must not add Flight Table to formal customer/operator navigation.

## Diagnostics

The diagnostics tab must show:

- manifest.json
- verify.json
- API snapshots
- SQL snapshots when present
- root cause
- failed A-I layer
- suggested command

If SQL snapshots are absent, the UI must state that the current run did not return SQL snapshots. It must not fabricate SQL snapshots.

## API source boundary

The frontend must call Flight Table backend through the flight-table adapter family under:

```text
apps/web/src/api/flightTable*.ts
```

The page and components must not directly call:

- customer API
- operator API
- debug API
- admin API
- legacy API
- raw SQL API

## Acceptance command

```bash
pnpm --filter @geox/web run check:flight-table-boundary
```
