import { ReactNode } from 'react'
import { RefreshControl, View } from 'react-native'
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { Heading, Text } from './Text'
import { IconButton } from './IconButton'
import { useThemeColors } from '../../lib/theme'

export interface ScreenProps {
  children: ReactNode
  /** Render content inside a ScrollView. */
  scroll?: boolean
  title?: string
  subtitle?: string
  /** Show a back button in the header. */
  back?: boolean
  /** Right-aligned header slot (actions). */
  headerRight?: ReactNode
  /** Sticky footer, e.g. a primary CTA bar. */
  footer?: ReactNode
  /** Apply horizontal page padding to content (default true). */
  padded?: boolean
  contentClassName?: string
  /** Pull-to-refresh (scroll screens only). */
  refreshing?: boolean
  onRefresh?: () => void
}

/**
 * Consistent page chrome: safe-area aware, themed background, optional header
 * and sticky footer. Replaces per-screen hand-rolled headers + hardcoded pt-14.
 */
export function Screen({
  children,
  scroll = false,
  title,
  subtitle,
  back = false,
  headerRight,
  footer,
  padded = true,
  contentClassName = '',
  refreshing = false,
  onRefresh,
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colors = useThemeColors()
  const hasHeader = back || !!title || !!headerRight
  const pad = padded ? 'px-5' : ''

  const body = (
    <View className={`${pad} ${contentClassName}`}>{children}</View>
  )

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {hasHeader ? (
        <View className={`flex-row items-center gap-2 pt-2 pb-3 ${padded ? 'px-5' : 'px-2'}`}>
          {back ? (
            <IconButton
              icon={ChevronLeft}
              accessibilityLabel="Go back"
              variant="ghost"
              onPress={() => router.back()}
            />
          ) : null}
          <View className="flex-1">
            {title ? (
              <Heading level={3} uppercase numberOfLines={1}>
                {title}
              </Heading>
            ) : null}
            {subtitle ? (
              <Text variant="bodySm" muted numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {headerRight}
        </View>
      ) : null}

      {scroll ? (
        // Scrolls the focused input above the keyboard (and above a sticky footer).
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          bottomOffset={footer ? 96 : 24}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: (footer ? 16 : insets.bottom) + 24 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {body}
        </KeyboardAwareScrollView>
      ) : (
        <View className="flex-1">{body}</View>
      )}

      {footer ? (
        // Rides up with the keyboard so the primary action stays reachable while typing.
        <KeyboardStickyView offset={{ opened: insets.bottom }}>
          <View
            className={`border-t border-border bg-surface ${padded ? 'px-5' : ''} pt-3`}
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  )
}
