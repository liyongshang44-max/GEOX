# Operation / Dashboard 验证说明（2026-03-30）

> 说明：当前执行环境未提供可用的 browser_container / DevTools 截图能力，无法直接附带 Network 面板截图；以下提供代码级证据与可复现检查命令。

## 1) OperationDetail 页面：Network 仅 1 个请求 `/api/v1/operations/:id/detail`

- `useOperationDetail` 的加载流程在 `useEffect -> load()` 中只调用一次 `fetchOperationDetail(id)`。
- `fetchOperationDetail` 仅请求单一端点：`/api/v1/operations/${id}/detail`。
- 除非用户点击“刷新”按钮触发 `reload()`，否则页面初次渲染不会再发第二条详情请求。

复核命令：

```bash
sed -n '1,120p' apps/web/src/hooks/useOperationDetail.ts
sed -n '55,90p' apps/web/src/api/operations.ts
```

## 2) Dashboard 页面：6 块都可承载业务数据

- `CommercialDashboardPage` 固定渲染 6 个业务块：
  1. 地块状态
  2. 风险告警
  3. 待审批建议
  4. 执行中任务
  5. 待验收任务
  6. 今日关键动作
- 每个区块均绑定 `useDashboard` 返回的数据源（`overview/actions/risks/evidences`），且支持列表数据渲染。

复核命令：

```bash
sed -n '58,280p' apps/web/src/views/CommercialDashboardPage.tsx
```

## 3) 页面文本不出现 `sensor_group` / `marker` / `series`

- 在 `OperationDetailPage` 与 `CommercialDashboardPage` 的可见文案中，未出现以上三类术语。
- 使用关键字检索页面文件，结果为空（仅在其他后端/文档代码中存在，与该两页展示文案无关）。

复核命令：

```bash
rg -n "sensor_group|marker|series" apps/web/src/views/OperationDetailPage.tsx apps/web/src/views/CommercialDashboardPage.tsx -S
```

## 4) 任意 operation 可见完整链

- `OperationDetailPage` 的“技术追踪信息”明确展示：建议编号、审批编号、作业计划编号、执行任务编号。
- “全链路时间线”固定按顺序构建故事链，并包含“已生成作业建议 / 已提交审批 / 已批准执行 / 已创建执行计划 / 已生成执行任务 / 已下发设备 / 设备执行中 / 已记录执行回执”；终态会追加完成/失败状态，用于形成 recommendation → approval → task → receipt → acceptance 的审计闭环。

复核命令：

```bash
sed -n '90,190p' apps/web/src/views/OperationDetailPage.tsx
sed -n '150,260p' apps/web/src/viewmodels/operationDetailViewModel.ts
```
