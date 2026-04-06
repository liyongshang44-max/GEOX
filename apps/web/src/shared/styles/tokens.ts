const semantic = {
  normal: { bg: "#ecfdf3", fg: "#067647", border: "#abefc6" },
  pending: { bg: "#eff8ff", fg: "#175cd3", border: "#b2ddff" },
  risk: { bg: "#fffaeb", fg: "#b54708", border: "#fedf89" },
  blocked: { bg: "#f4f3ff", fg: "#5925dc", border: "#d9d6fe" },
  failed: { bg: "#fef3f2", fg: "#b42318", border: "#fecdca" },
  partial: { bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" },
  data: { bg: "#f2f4f7", fg: "#475467", border: "#d0d5dd" },
  online: { bg: "#ecfdf3", fg: "#067647", border: "#abefc6" },
  offline: { bg: "#fef3f2", fg: "#b42318", border: "#fecdca" },
  info: { bg: "#eff8ff", fg: "#175cd3", border: "#b2ddff" },
} as const;

export const themeTokens = {
  color: {
    surface: {
      primary: "#f5f5f7",
      secondary: "#f8fafc",
      card: "#ffffff",
      overlay: "rgba(255, 255, 255, 0.72)",
    },
    border: {
      subtle: "rgba(15, 23, 42, 0.05)",
      primary: "#d0d5dd",
      strong: "#98a2b3",
      accent: "rgba(15, 23, 42, 0.12)",
    },
    text: {
      primary: "#101828",
      secondary: "#475467",
      weak: "#64748b",
      inverse: "#ffffff",
      emphasis: "#0f172a",
    },
    semantic,
    state: {
      success: semantic.normal,
      info: semantic.pending,
      warning: semantic.risk,
      // Danger/red is reserved for blocking or explicit failure states.
      danger: semantic.failed,
    },
    action: {
      primaryBg: "#111111",
      primaryFg: "#ffffff",
      secondaryBg: "#ffffff",
      secondaryFg: "#111111",
    },
    // Backward compatibility
    bg: {
      canvas: "#f5f5f7",
      subtle: "#f8fafc",
      surface: "#ffffff",
      elevated: "#ffffff",
      overlay: "rgba(255, 255, 255, 0.72)",
    },
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
  },
  radius: {
    none: 0,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    xxl: 20,
    pill: 999,
  },
  shadow: {
    sm: "0 1px 2px rgba(16, 24, 40, 0.08)",
    md: "0 6px 18px rgba(16, 24, 40, 0.08)",
    lg: "0 16px 40px rgba(15, 23, 42, 0.12)",
    insetSoft: "0 0 0 1px rgba(16, 24, 40, 0.06) inset",
  },
} as const;

export const cssVarTokens = {
  color: {
    surface: {
      primary: "--color-surface-primary",
      secondary: "--color-surface-secondary",
      card: "--color-surface-card",
    },
    text: {
      primary: "--color-text-primary",
      secondary: "--color-text-secondary",
      weak: "--color-text-weak",
      inverse: "--color-text-inverse",
      emphasis: "--color-text-emphasis",
    },
    border: {
      subtle: "--color-border-subtle",
      primary: "--color-border-primary",
      strong: "--color-border-strong",
      accent: "--color-border-accent",
    },
    state: {
      success: {
        bg: "--state-success-bg",
        fg: "--state-success-fg",
        border: "--state-success-border",
      },
      info: { bg: "--state-info-bg", fg: "--state-info-fg", border: "--state-info-border" },
      warning: {
        bg: "--state-warning-bg",
        fg: "--state-warning-fg",
        border: "--state-warning-border",
      },
      danger: {
        bg: "--state-danger-bg",
        fg: "--state-danger-fg",
        border: "--state-danger-border",
      },
    },
    // Backward compatibility
    bg: {
      canvas: "--color-bg-canvas",
      subtle: "--color-bg-subtle",
      surface: "--color-bg-surface",
      elevated: "--color-bg-elevated",
      overlay: "--color-bg-overlay",
    },
  },
} as const;
