export type AccentThemeId = 'verdant' | 'rose' | 'amethyst';

/** HSL components without the hsl() wrapper — matches global.css / NativeWind vars */
export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
};

export type AccentTheme = {
  id: AccentThemeId;
  name: string;
  description: string;
  light: ThemeTokens;
  dark: ThemeTokens;
};

export const ACCENT_THEMES: Record<AccentThemeId, AccentTheme> = {
  verdant: {
    id: 'verdant',
    name: 'Verdant Path',
    description: 'Forest trail — life growing over time',
    light: {
      background: '150 25% 98%',
      foreground: '152 12% 12%',
      card: '0 0% 100%',
      cardForeground: '152 12% 12%',
      primary: '152 42% 38%',
      primaryForeground: '0 0% 100%',
      secondary: '150 20% 94%',
      secondaryForeground: '152 12% 12%',
      muted: '150 15% 92%',
      mutedForeground: '152 8% 42%',
      accent: '152 35% 92%',
      accentForeground: '152 45% 30%',
      border: '150 14% 88%',
      input: '150 14% 88%',
      ring: '152 42% 38%',
    },
    dark: {
      background: '152 10% 8%',
      foreground: '150 18% 96%',
      card: '152 8% 11%',
      cardForeground: '150 18% 96%',
      primary: '152 48% 46%',
      primaryForeground: '0 0% 100%',
      secondary: '152 8% 16%',
      secondaryForeground: '150 18% 96%',
      muted: '152 8% 18%',
      mutedForeground: '150 8% 62%',
      accent: '152 30% 18%',
      accentForeground: '152 45% 65%',
      border: '152 8% 20%',
      input: '152 8% 20%',
      ring: '152 48% 46%',
    },
  },
  rose: {
    id: 'rose',
    name: 'Rose Memory',
    description: 'Soft rose — emotional, personal, human',
    light: {
      background: '350 22% 98%',
      foreground: '350 12% 13%',
      card: '0 0% 100%',
      cardForeground: '350 12% 13%',
      primary: '350 45% 48%',
      primaryForeground: '0 0% 100%',
      secondary: '350 18% 94%',
      secondaryForeground: '350 12% 13%',
      muted: '350 15% 92%',
      mutedForeground: '350 8% 46%',
      accent: '350 35% 93%',
      accentForeground: '350 48% 38%',
      border: '350 12% 88%',
      input: '350 12% 88%',
      ring: '350 45% 48%',
    },
    dark: {
      background: '350 10% 8%',
      foreground: '350 16% 96%',
      card: '350 8% 11%',
      cardForeground: '350 16% 96%',
      primary: '350 50% 58%',
      primaryForeground: '0 0% 100%',
      secondary: '350 8% 16%',
      secondaryForeground: '350 16% 96%',
      muted: '350 8% 18%',
      mutedForeground: '350 8% 62%',
      accent: '350 28% 18%',
      accentForeground: '350 45% 72%',
      border: '350 8% 20%',
      input: '350 8% 20%',
      ring: '350 50% 58%',
    },
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst Lane',
    description: 'Soft purple — creative, distinctive, memorable',
    light: {
      background: '265 20% 98%',
      foreground: '265 14% 12%',
      card: '0 0% 100%',
      cardForeground: '265 14% 12%',
      primary: '265 40% 48%',
      primaryForeground: '0 0% 100%',
      secondary: '265 16% 94%',
      secondaryForeground: '265 14% 12%',
      muted: '265 14% 92%',
      mutedForeground: '265 8% 46%',
      accent: '265 32% 93%',
      accentForeground: '265 42% 38%',
      border: '265 12% 88%',
      input: '265 12% 88%',
      ring: '265 40% 48%',
    },
    dark: {
      background: '265 10% 8%',
      foreground: '265 16% 96%',
      card: '265 8% 11%',
      cardForeground: '265 16% 96%',
      primary: '265 48% 58%',
      primaryForeground: '0 0% 100%',
      secondary: '265 8% 16%',
      secondaryForeground: '265 16% 96%',
      muted: '265 8% 18%',
      mutedForeground: '265 8% 62%',
      accent: '265 26% 18%',
      accentForeground: '265 42% 72%',
      border: '265 8% 20%',
      input: '265 8% 20%',
      ring: '265 48% 58%',
    },
  },
};

export const ACCENT_THEME_ORDER: AccentThemeId[] = ['verdant', 'rose', 'amethyst'];

export const DEFAULT_ACCENT_THEME: AccentThemeId = 'verdant';

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
    '--destructive': '0 72% 51%',
    '--destructive-foreground': '0 0% 100%',
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
