/*
 * Resolved colour values for contexts that can't use Tailwind classNames —
 * react-native-svg (rings, charts), the tab bar, StatusBar, etc.
 * The app is dark-only; keep these in sync with the CSS variables in global.css.
 */
const palette = {
  background: '#000000',
  surface: '#121214',
  surfaceMuted: '#1A1A1D',
  surfaceStrong: '#0A0A0B',
  foreground: '#F5F5F5',
  mutedForeground: '#9A9AA0',
  onSurfaceStrong: '#F5F5F5',
  border: '#1F1F22',
  borderStrong: '#2A2A2E',
  ring: '#10B981',
  primary: '#10B981',
  primaryPressed: '#059669',
  primarySoft: '#0F2E22',
  onPrimary: '#04130D',
  accent: '#FF7A1A',
  accentPressed: '#EA620C',
  accentSoft: '#3A1F0D',
  onAccent: '#140800',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#38BDF8',
  macroCalories: '#FF7A1A',
  macroCaloriesSoft: '#3A1F0D',
  macroProtein: '#A3E635',
  macroProteinSoft: '#26330F',
  macroCarbs: '#38BDF8',
  macroCarbsSoft: '#0D2A38',
  macroFat: '#A78BFA',
  macroFatSoft: '#241C3D',
  macroSteps: '#F472B6',
  macroStepsSoft: '#3A1428',
}

export type ThemeColors = typeof palette

export function getThemeColors(): ThemeColors {
  return palette
}

/** The app's (dark-only) colour palette for SVG and native props. */
export function useThemeColors(): ThemeColors {
  return palette
}
