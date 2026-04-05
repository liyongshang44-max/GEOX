# Shared Styles · Apple 风格规范（Detail 页）

> 适用范围：`apps/web/src/styles/*` 以及田块/设备/作业详情页。

## 1) 设计目标

- **低噪声**：弱化大面积渐变、强对比纯色块、重投影。
- **层级可读**：用留白、字重、轻边框表达信息优先级。
- **状态优先**：风险/异常只通过语义色 token 表达，不叠加额外视觉特效。

## 2) Token 使用约束（必须）

### 圆角（Radius）

只允许以下 token：

- `--radius-sm`（8px）
- `--radius-md`（10px）
- `--radius-lg`（12px）
- `--radius-xl`（16px）
- `--radius-pill`（胶囊）

禁止在详情页新增任意硬编码圆角值（例如 `11px`、`22px`）。

### 阴影（Shadow）

只允许以下 token：

- `--shadow-sm`：默认卡片与按钮交互层
- `--shadow-md`：仅用于悬浮层或需要强调的浮层
- `--shadow-inset-soft`：内嵌信息区

详情页卡片默认优先 `--shadow-sm`，避免重阴影造成视觉噪声。

### 字重（Font Weight）

统一使用 token：

- `--font-weight-regular`（400）
- `--font-weight-medium`（500）
- `--font-weight-semibold`（600）
- `--font-weight-bold`（700）

状态标签、按钮文案默认使用 `medium/semibold`，避免不必要的 `800+`。

### 动效（Motion）

只允许以下 token：

- `--motion-duration-fast`（120ms）
- `--motion-duration-normal`（180ms）
- `--motion-ease-standard`

动效只用于交互反馈（hover/focus/expand），不得用于持续闪烁或吸引注意的动画。

### 状态色（Semantic Status）

状态必须从语义 token 获取：

- 正常：`--color-status-normal-*`
- 待处理/进行中：`--color-status-pending-*`
- 风险提醒：`--color-status-risk-*`
- 失败/错误：`--color-status-failed-*`
- 部分完成：`--color-status-partial-*`
- 数据缺失：`--color-status-data-*`

禁止在详情页直接写十六进制状态色（`#...`）表达业务状态。

## 3) 详情页视觉降噪基线

- Hero 区与内容区优先纯色面板（`--color-bg-surface`），避免强渐变。
- 告警模块使用「轻底色 + 边框 + 文案」三要素，不叠加阴影/发光。
- 状态 Pill 使用语义状态 token，不额外叠加图案或高饱和背景。

## 4) 本次落地顺序

1. 田块详情页（样板页）先完成状态色与卡片视觉收敛。
2. 验收通过后，复制同一套 token 约束到设备详情页。
3. 最后同步到作业详情页（重点是告警块、状态 pill、折叠模块）。
