/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app is dark-only: tokens in global.css hold the dark values directly, so no
  // `dark:` variants are used. (Class strategy kept: 'media' crashes NativeWind on web.)
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
          calories: token('macro-calories'),
          'calories-soft': token('macro-calories-soft'),
          protein: token('macro-protein'),
          'protein-soft': token('macro-protein-soft'),
          carbs: token('macro-carbs'),
          'carbs-soft': token('macro-carbs-soft'),
          fat: token('macro-fat'),
          'fat-soft': token('macro-fat-soft'),
          steps: token('macro-steps'),
          'steps-soft': token('macro-steps-soft'),
        },
      },
      // One step larger than Tailwind's defaults: testers found the app's type small next
      // to other fitness apps. Every text-* class (and the Text variants) inherits this.
      fontSize: {
        xs: ['13px', { lineHeight: '18px' }],
        sm: ['15px', { lineHeight: '21px' }],
        base: ['17px', { lineHeight: '24px' }],
        lg: ['19px', { lineHeight: '27px' }],
        xl: ['22px', { lineHeight: '29px' }],
        '2xl': ['26px', { lineHeight: '32px' }],
        '3xl': ['32px', { lineHeight: '38px' }],
        '4xl': ['38px', { lineHeight: '42px' }],
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
