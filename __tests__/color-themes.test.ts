import {
  ACCENT_THEMES,
  ACCENT_THEME_ORDER,
  DEFAULT_ACCENT_THEME,
} from '@/lib/app-constants';
import { themeTokensToColors, themeTokensToCssVars } from '@/lib/color-themes';

describe('color-themes', () => {
  it('defaults to Verdant Path', () => {
    expect(DEFAULT_ACCENT_THEME).toBe('verdant');
  });

  it('defines exactly three user-selectable accent themes', () => {
    expect(ACCENT_THEME_ORDER).toEqual(['verdant', 'rose', 'amethyst']);
    expect(Object.keys(ACCENT_THEMES)).toHaveLength(3);
  });

  it('maps theme tokens to NativeWind CSS variables', () => {
    const cssVars = themeTokensToCssVars(ACCENT_THEMES.verdant.light);
    expect(cssVars['--primary']).toBe('152 42% 38%');
    expect(cssVars['--background']).toBe('150 25% 98%');
  });

  it('maps theme tokens to hsl() colors for icons and navigation', () => {
    const colors = themeTokensToColors(ACCENT_THEMES.rose.dark);
    expect(colors.primary).toBe('hsl(350 50% 58%)');
    expect(colors.background).toBe('hsl(350 10% 8%)');
  });

  it.each(ACCENT_THEME_ORDER)(
    '%s theme has light and dark primary tokens',
    themeId => {
      const theme = ACCENT_THEMES[themeId];
      expect(theme.light.primary).toMatch(/^\d+ \d+% \d+%$/);
      expect(theme.dark.primary).toMatch(/^\d+ \d+% \d+%$/);
    },
  );
});
