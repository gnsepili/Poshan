import { ActivityIndicator, Pressable, PressableProps, View } from 'react-native'
import { LucideIcon } from 'lucide-react-native'
import { Text } from './Text'
import { useThemeColors } from '../../lib/theme'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-primary active:bg-primary-pressed',
  accent: 'bg-accent active:bg-accent-pressed',
  secondary: 'bg-surface border border-border-strong active:bg-surface-muted',
  ghost: 'bg-transparent active:bg-surface-muted',
  danger: 'bg-danger active:opacity-90',
}

const LABEL: Record<Variant, string> = {
  primary: 'text-on-primary',
  accent: 'text-on-accent',
  secondary: 'text-foreground',
  ghost: 'text-primary',
  danger: 'text-white',
}

// min 44pt touch targets
const SIZE: Record<Size, string> = {
  sm: 'h-11 px-4 rounded-xl',
  md: 'h-12 px-5 rounded-2xl',
  lg: 'h-14 px-6 rounded-2xl',
}

const LABEL_SIZE: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  icon?: LucideIcon
  iconRight?: LucideIcon
  className?: string
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  icon: Icon,
  iconRight: IconRight,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const colors = useThemeColors()
  const isDisabled = disabled || loading
  const iconColor =
    variant === 'secondary'
      ? colors.foreground
      : variant === 'ghost'
        ? colors.primary
        : variant === 'danger'
          ? '#FFFFFF'
          : variant === 'accent'
            ? colors.onAccent
            : colors.onPrimary

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center ${SIZE[size]} ${CONTAINER[variant]} ${
        fullWidth ? 'w-full' : 'self-start'
      } ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {Icon ? <Icon size={size === 'sm' ? 18 : 20} color={iconColor} /> : null}
          <Text className={`font-bold ${LABEL_SIZE[size]} ${LABEL[variant]}`}>{label}</Text>
          {IconRight ? <IconRight size={size === 'sm' ? 18 : 20} color={iconColor} /> : null}
        </View>
      )}
    </Pressable>
  )
}
