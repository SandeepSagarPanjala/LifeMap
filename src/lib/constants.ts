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

/** App bundle ID — Sunrio (company) · LifeMap (app) */
export const APP_BUNDLE_ID = 'com.sunrio.lifemap';

/** Physical iPhone (Settings → General → About → Name) */
export const IOS_PHYSICAL_DEVICE_NAME = 'SandY Earth 🌎';

/** USB UDID — used by `pnpm ios` (no device name needed in the command) */
export const IOS_PHYSICAL_DEVICE_UDID = '00008140-000C75AC3C88801C';

/** Default iOS simulator */
export const IOS_SIMULATOR_NAME = 'iPhone 17 Pro Max';
