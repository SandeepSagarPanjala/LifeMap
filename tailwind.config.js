/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: 'hsl(30 12% 88%)',
        input: 'hsl(30 12% 88%)',
        ring: 'hsl(16 65% 45%)',
        background: 'hsl(30 33% 98%)',
        foreground: 'hsl(24 10% 10%)',
        primary: {
          DEFAULT: 'hsl(16 65% 45%)',
          foreground: 'hsl(0 0% 100%)',
        },
        secondary: {
          DEFAULT: 'hsl(30 20% 94%)',
          foreground: 'hsl(24 10% 10%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 72% 51%)',
          foreground: 'hsl(0 0% 100%)',
        },
        muted: {
          DEFAULT: 'hsl(30 15% 92%)',
          foreground: 'hsl(24 8% 45%)',
        },
        accent: {
          DEFAULT: 'hsl(16 55% 92%)',
          foreground: 'hsl(16 65% 35%)',
        },
        card: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(24 10% 10%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(24 10% 10%)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
