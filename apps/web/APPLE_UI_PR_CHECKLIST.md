# Apple UI PR Checklist

> 用于「监控台样板页」及后续详情页复制类 PR。

## A. 设计规范检查

- [ ] 圆角仅使用 `--radius-*` token
- [ ] 阴影仅使用 `--shadow-*` token
- [ ] 留白仅使用 `--space-*` token
- [ ] 字重仅使用 `--font-weight-*` token
- [ ] 动效仅使用 `--motion-*` token
- [ ] 状态色仅使用 `--color-status-*` token
- [ ] 未新增用于状态表达的硬编码十六进制颜色

## B. 监控台样板页视觉收口检查

- [ ] 卡片圆角/阴影/边框层级统一
- [ ] 标题与正文层级一致（标题 semibold、正文 regular）
- [ ] 关键信息块（指标/决策列表）视觉噪声降低
- [ ] hover/focus 动效轻量且一致
- [ ] 折叠信息区具有可感知但克制的交互反馈

## C. 兼容性与回归

- [ ] 1100px 以下布局正常折行/堆叠
- [ ] 无可见文本溢出与按钮遮挡
- [ ] 无新增控制台报错
- [ ] `apps/web` 构建通过

## D. 复制到详情页（评审通过后）

- [ ] Field Detail
- [ ] Device Detail
- [ ] Operation Detail

