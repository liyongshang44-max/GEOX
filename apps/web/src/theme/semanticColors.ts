import { themeTokens } from "../shared/styles/tokens";

export const semanticColors = {
  normal: themeTokens.color.semantic.normal,
  pending: themeTokens.color.semantic.pending,
  risk: themeTokens.color.semantic.risk,
  blocked: themeTokens.color.semantic.blocked,
  failed: themeTokens.color.semantic.failed,
  partial: themeTokens.color.semantic.partial,
} as const;
