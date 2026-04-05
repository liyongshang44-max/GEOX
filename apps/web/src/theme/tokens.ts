import { themeTokens } from "../shared/styles/tokens";

export const tokens = {
  color: {
    bg: themeTokens.color.bg.canvas,
    panel: themeTokens.color.bg.surface,
    text: themeTokens.color.text.primary,
    muted: themeTokens.color.text.secondary,
    border: themeTokens.color.border.accent,
    background: themeTokens.color.bg,
    foreground: themeTokens.color.text,
    semantic: themeTokens.color.semantic,
  },
  spacing: {
    xs: themeTokens.spacing[1],
    sm: themeTokens.spacing[2],
    md: themeTokens.spacing[3],
    lg: themeTokens.spacing[4],
    xl: themeTokens.spacing[6],
    scale: themeTokens.spacing,
  },
  radius: {
    sm: themeTokens.radius.sm,
    md: themeTokens.radius.md,
    lg: themeTokens.radius.lg,
    xl: themeTokens.radius.xxl,
    scale: themeTokens.radius,
  },
  shadow: themeTokens.shadow,
} as const;
