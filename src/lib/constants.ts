export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
};

export const THEME: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: 'hsl(30 33% 98%)',
    foreground: 'hsl(24 10% 10%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(24 10% 10%)',
    primary: 'hsl(16 65% 45%)',
    primaryForeground: 'hsl(0 0% 100%)',
    mutedForeground: 'hsl(24 8% 45%)',
    accent: 'hsl(16 55% 92%)',
    accentForeground: 'hsl(16 65% 35%)',
    border: 'hsl(30 12% 88%)',
  },
  dark: {
    background: 'hsl(24 10% 8%)',
    foreground: 'hsl(30 20% 96%)',
    card: 'hsl(24 10% 11%)',
    cardForeground: 'hsl(30 20% 96%)',
    primary: 'hsl(16 70% 55%)',
    primaryForeground: 'hsl(0 0% 100%)',
    mutedForeground: 'hsl(30 10% 65%)',
    accent: 'hsl(16 40% 18%)',
    accentForeground: 'hsl(16 70% 70%)',
    border: 'hsl(24 8% 20%)',
  },
} as const;

export type TabRoute = 'Home' | 'Map' | 'Timeline' | 'Settings';

export const TAB_ROUTES: {name: TabRoute; label: string}[] = [
  {name: 'Home', label: 'Today'},
  {name: 'Map', label: 'Map'},
  {name: 'Timeline', label: 'Timeline'},
  {name: 'Settings', label: 'Settings'},
];

/** Physical device name — update if you rename your iPhone in Finder/Xcode */
export const IOS_PHYSICAL_DEVICE_NAME = 'SandY Earth 🌎';

/** Default iOS simulator (closest to iPhone 16 Pro Max in current Xcode runtime) */
export const IOS_SIMULATOR_NAME = 'iPhone 17 Pro Max';
