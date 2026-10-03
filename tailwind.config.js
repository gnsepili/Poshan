/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Class strategy: we mirror the system scheme into NativeWind in app/_layout.
  // (The 'media' strategy crashes NativeWind's web runtime on initial load.)
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          strong: token('surface-strong'),
        },
        foreground: token('foreground'),
        'muted-foreground': token('muted-foreground'),
        'on-surface-strong': token('on-surface-strong'),
        border: {
          DEFAULT: token('border'),
          strong: token('border-strong'),
        },
        ring: token('ring'),
        primary: {
          DEFAULT: token('primary'),
          pressed: token('primary-pressed'),
          soft: token('primary-soft'),
        },
        'on-primary': token('on-primary'),
        accent: {
          DEFAULT: token('accent'),
          pressed: token('accent-pressed'),
          soft: token('accent-soft'),
        },
        'on-accent': token('on-accent'),
        success: token('success'),
        warning: token('warning'),
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
        },
        info: token('info'),
        macro: {
          protein: token('macro-protein'),
          carbs: token('macro-carbs'),
          fat: token('macro-fat'),
          calories: token('macro-calories'),
        },
      },
      fontFamily: {
        // Barlow Condensed for impact headings; Barlow for body/UI.
        display: ['BarlowCondensed_700Bold'],
        'display-semibold': ['BarlowCondensed_600SemiBold'],
        sans: ['Barlow_400Regular'],
        medium: ['Barlow_500Medium'],
        semibold: ['Barlow_600SemiBold'],
        bold: ['Barlow_700Bold'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
}
