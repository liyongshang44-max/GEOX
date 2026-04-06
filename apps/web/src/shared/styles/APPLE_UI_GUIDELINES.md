# GEOX Apple 风格 UI 规范（Day-1）

## 目标
在农业远程经营控制台中采用“冷静、克制、层级清晰”的 Apple 风格，而不是装饰性视觉。

## 设计原则
1. **信息优先**：首屏仅展示状态与行动，不堆叠说明性文本。
2. **留白优先**：模块间距遵循 8pt 体系，避免视觉拥挤。
3. **弱边界与轻阴影**：边框低对比，阴影仅用于层级分离。
4. **状态克制**：红色仅用于阻断态；常规提示使用蓝/黄/灰。
5. **动效轻量**：120~180ms 的淡入与位移，不使用夸张动画。

## Token 约束
- 必须通过 `shared/styles/tokens.ts` 与 CSS 变量引用颜色、圆角、阴影、间距。
- 禁止在页面中硬编码品牌色、间距和圆角。

## 组件约束
- 页面必须优先使用共享组件：`PageHeader`、`SectionCard`、`StatusPill`、`EmptyGuide`、`DetailAside`、`Stepper`。
- 详情页优先采用 `主内容 + 右侧摘要栏` 模式。

## 文案约束
- 一行一句，动词开头（去处理、去审批、去验收）。
- 避免中英文混杂；必须出现英文时仅保留领域术语。

## Day-1 样板页
- 监控台（Dashboard）
- 设备接入向导（Device Onboarding）

## 状态映射（统一）
- success → `--state-success-*`（映射 normal）
- info → `--state-info-*`（映射 pending）
- warning → `--state-warning-*`（映射 risk）
- danger → `--state-danger-*`（映射 failed，红色仅用于阻断/失败）

## 组件最小规范
- 参考：`shared/styles/COMPONENT_USAGE_MIN_SPEC.md`。
