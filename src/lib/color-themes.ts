import {
  THEME_DESTRUCTIVE_FOREGROUND_HSL,
  THEME_DESTRUCTIVE_HSL,
} from '@/lib/app-constants';

export type AccentThemeId = import('@lifemap/constants').AccentThemeId;
export type ThemeTokens = import('@lifemap/constants').ThemeTokens;
export type AccentTheme = import('@lifemap/constants').AccentTheme;

export function themeTokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--background': tokens.background,
    '--foreground': tokens.foreground,
    '--card': tokens.card,
    '--card-foreground': tokens.cardForeground,
    '--primary': tokens.primary,
    '--primary-foreground': tokens.primaryForeground,
    '--secondary': tokens.secondary,
    '--secondary-foreground': tokens.secondaryForeground,
    '--muted': tokens.muted,
    '--muted-foreground': tokens.mutedForeground,
    '--accent': tokens.accent,
    '--accent-foreground': tokens.accentForeground,
    '--border': tokens.border,
    '--input': tokens.input,
    '--ring': tokens.ring,
    '--popover': tokens.card,
    '--popover-foreground': tokens.cardForeground,
    '--destructive': THEME_DESTRUCTIVE_HSL,
    '--destructive-foreground': THEME_DESTRUCTIVE_FOREGROUND_HSL,
  };
}

export function themeTokensToColors(tokens: ThemeTokens) {
  return {
    background: `hsl(${tokens.background})`,
    foreground: `hsl(${tokens.foreground})`,
    card: `hsl(${tokens.card})`,
    cardForeground: `hsl(${tokens.cardForeground})`,
    primary: `hsl(${tokens.primary})`,
    primaryForeground: `hsl(${tokens.primaryForeground})`,
    mutedForeground: `hsl(${tokens.mutedForeground})`,
    accent: `hsl(${tokens.accent})`,
    accentForeground: `hsl(${tokens.accentForeground})`,
    border: `hsl(${tokens.border})`,
  };
}

export type ResolvedThemeColors = ReturnType<typeof themeTokensToColors>;
