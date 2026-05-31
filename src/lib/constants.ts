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
