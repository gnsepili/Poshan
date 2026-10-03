import { Pressable, PressableProps } from 'react-native'
import { LucideIcon } from 'lucide-react-native'
import { Text } from './Text'
import { useThemeColors } from '../../lib/theme'

export interface ChipProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string
  selected?: boolean
  icon?: LucideIcon
  className?: string
}

/** Selectable pill — meal types, activity types, filters, segmented choices. */
export function Chip({
  label,
  selected = false,
  icon: Icon,
  className = '',
  ...rest
}: ChipProps) {
  const colors = useThemeColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-1.5 h-10 px-4 rounded-full border ${
        selected
          ? 'bg-primary border-primary'
          : 'bg-surface border-border-strong active:bg-surface-muted'
      } ${className}`}
      {...rest}
    >
      {Icon ? (
        <Icon size={16} color={selected ? colors.onPrimary : colors.mutedForeground} />
      ) : null}
      <Text
        className={`font-semibold text-sm ${selected ? 'text-on-primary' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
