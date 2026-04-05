# APPLE_UI_GUIDELINES

> 版本：v1（2026-04-05）  
> 当前样板页：`监控台 /dashboard`（`CommercialDashboardPage`）

## 1. 目标

统一 Apple 风格视觉收口，先在监控台完成以下五项：

- 圆角（Radius）
- 阴影（Shadow）
- 留白（Spacing）
- 字体（Typography）
- 动效（Motion）

评审通过后，再将同一规范复制到：

1. 田块详情（Field Detail）
2. 设备详情（Device Detail）
3. 作业详情（Operation Detail）

## 2. Token 白名单（必须）

### 2.1 圆角

- `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` / `--radius-pill`
- 禁止新增页面级硬编码圆角值（例如 `11px`、`14px`、`20px`）

### 2.2 阴影

- `--shadow-sm`（卡片默认层级）
- `--shadow-md`（hover / elevated）
- `--shadow-inset-soft`（弱内阴影信息块）

### 2.3 留白

- `--space-1` ~ `--space-8`
- 组件间距优先 8 的倍数（8 / 12 / 16 / 20 / 24 / 32）

### 2.4 字体

- `--font-weight-regular` / `--font-weight-medium` / `--font-weight-semibold` / `--font-weight-bold`
- 标题 `semibold`，正文 `regular`，辅助说明 `regular/medium`

### 2.5 动效

- `--motion-duration-fast` / `--motion-duration-normal`
- `--motion-ease-standard`
- 动效仅用于 hover、focus、expand；禁止持续吸睛动画

## 3. 监控台样板页落地规则

- 容器卡片：`radius-xl + shadow-sm + subtle border`
- 信息子卡：`radius-lg + shadow-inset-soft`
- 交互反馈：hover 时仅做 `border / shadow / bg` 的轻微变化
- 标题层级：`h2=20px semibold`，卡片值字段突出但不使用超重字重
- 折叠区（`details/summary`）：提供 hover/focus 的颜色反馈

## 4. 状态色规则

状态表达必须使用语义 token：

- 正常：`--color-status-normal-*`
- 进行中/待处理：`--color-status-pending-*`
- 风险：`--color-status-risk-*`
- 失败：`--color-status-failed-*`
- 部分完成：`--color-status-partial-*`
- 数据缺失：`--color-status-data-*`

禁止直接用十六进制颜色表达业务状态。

## 5. 复制计划（评审通过后执行）

- [ ] 田块详情：替换详情卡、时间线条目、状态块为同一 token 体系
- [ ] 设备详情：替换设备状态卡、告警块、操作区按钮 hover 反馈
- [ ] 作业详情：替换摘要卡、风险块、执行状态 pill 与折叠区

