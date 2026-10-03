import { useColorScheme } from 'react-native'

/*
 * Resolved color values for contexts that can't use Tailwind classNames —
 * react-native-svg (rings, charts), the tab bar tint, StatusBar, etc.
 * Keep these in sync with the CSS variables in global.css.
 */
const light = {
  background: '#F5F6F4',
  // (string-typed on purpose so the dark map can hold different values)
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2EE',
  surfaceStrong: '#111814',
  foreground: '#0B1210',
  mutedForeground: '#5B646C',
  onSurfaceStrong: '#F5F7F5',
  border: '#E4E7E2',
  borderStrong: '#CBD0C9',
  ring: '#059669',
  primary: '#059669',
  primaryPressed: '#047857',
  primarySoft: '#D1FAE5',
  onPrimary: '#FFFFFF',
  accent: '#EA580C',
  accentPressed: '#C2410C',
  accentSoft: '#FFEDD5',
  onAccent: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  macroProtein: '#059669',
  macroCarbs: '#F59E0B',
  macroFat: '#8B5CF6',
  macroCalories: '#EA580C',
}

const dark: typeof light = {
  background: '#0B0F0E',
  surface: '#15191A',
  surfaceMuted: '#1C2122',
  surfaceStrong: '#050A08',
  foreground: '#F2F5F3',
  mutedForeground: '#9BA69F',
  onSurfaceStrong: '#F2F5F3',
  border: '#272D2B',
  borderStrong: '#373E3B',
  ring: '#10B981',
  primary: '#10B981',
  primaryPressed: '#059669',
  primarySoft: '#06281F',
  onPrimary: '#06140F',
  accent: '#F97316',
  accentPressed: '#EA580C',
  accentSoft: '#2B170A',
  onAccent: '#0A0603',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#F87171',
  info: '#60A5FA',
  macroProtein: '#10B981',
  macroCarbs: '#FBBF24',
  macroFat: '#A78BFA',
  macroCalories: '#F97316',
}

export type ThemeColors = typeof light

export function getThemeColors(scheme: string | null | undefined): ThemeColors {
  return scheme === 'dark' ? dark : light
}

/** Resolved color palette for the active system color scheme. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme()
  return getThemeColors(scheme)
}
