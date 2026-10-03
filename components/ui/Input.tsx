import { forwardRef } from 'react'
import { Pressable, TextInput, TextInputProps, View } from 'react-native'
import { LucideIcon } from 'lucide-react-native'
import { Text } from './Text'
import { useThemeColors } from '../../lib/theme'

export interface InputProps extends TextInputProps {
  label?: string
  error?: string | null
  helper?: string
  icon?: LucideIcon
  /** Trailing icon rendered as a pressable (e.g. password show/hide). */
  rightIcon?: LucideIcon
  onRightIconPress?: () => void
  rightIconLabel?: string
  required?: boolean
  className?: string
  containerClassName?: string
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helper,
    icon: Icon,
    rightIcon: RightIcon,
    onRightIconPress,
    rightIconLabel,
    required,
    className = '',
    containerClassName = '',
    ...rest
  },
  ref,
) {
  const colors = useThemeColors()
  const borderColor = error ? 'border-danger' : 'border-border-strong'

  return (
    <View className={containerClassName}>
      {label ? (
        <Text variant="label" className="mb-1.5">
          {label}
          {required ? <Text className="text-danger"> *</Text> : null}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center bg-surface border ${borderColor} rounded-2xl px-4 h-12`}
      >
        {Icon ? <Icon size={18} color={colors.mutedForeground} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.mutedForeground}
          className={`flex-1 font-sans text-base text-foreground ${Icon ? 'ml-2' : ''} ${className}`}
          {...rest}
        />
        {RightIcon ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightIconLabel}
            onPress={onRightIconPress}
            hitSlop={8}
            className="pl-2"
          >
            <RightIcon size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" className="mt-1 text-danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" muted className="mt-1">
          {helper}
        </Text>
      ) : null}
    </View>
  )
})
