import { Pressable, PressableProps } from 'react-native'
import { LucideIcon } from 'lucide-react-native'
import { useThemeColors } from '../../lib/theme'

type Variant = 'ghost' | 'soft' | 'primary' | 'surface'
type Size = 'sm' | 'md' | 'lg'

const CONTAINER: Record<Variant, string> = {
  ghost: 'bg-transparent active:bg-surface-muted',
  soft: 'bg-primary-soft active:opacity-80',
  primary: 'bg-primary active:bg-primary-pressed',
  surface: 'bg-surface border border-border active:bg-surface-muted',
}

const DIM: Record<Size, { box: string; icon: number }> = {
  sm: { box: 'h-9 w-9', icon: 18 },
  md: { box: 'h-11 w-11', icon: 22 },
  lg: { box: 'h-12 w-12', icon: 24 },
}

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: LucideIcon
  accessibilityLabel: string
  variant?: Variant
  size?: Size
  className?: string
}

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  variant = 'ghost',
  size = 'md',
  disabled,
  className = '',
  ...rest
}: IconButtonProps) {
  const colors = useThemeColors()
  const dim = DIM[size]
  const iconColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'soft'
        ? colors.primary
        : colors.foreground

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={`items-center justify-center rounded-full ${dim.box} ${CONTAINER[variant]} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
      {...rest}
    >
      <Icon size={dim.icon} color={iconColor} />
    </Pressable>
  )
}
