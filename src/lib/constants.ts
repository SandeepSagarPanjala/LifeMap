export const THEME = {
  light: {
    background: 'hsl(30 33% 98%)',
    foreground: 'hsl(24 10% 10%)',
    card: 'hsl(0 0% 100%)',
    primary: 'hsl(16 65% 45%)',
    mutedForeground: 'hsl(24 8% 45%)',
    border: 'hsl(30 12% 88%)',
  },
  dark: {
    background: 'hsl(24 10% 8%)',
    foreground: 'hsl(30 20% 96%)',
    card: 'hsl(24 10% 11%)',
    primary: 'hsl(16 70% 55%)',
    mutedForeground: 'hsl(30 10% 65%)',
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
