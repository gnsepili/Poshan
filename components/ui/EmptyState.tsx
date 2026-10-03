import { View } from 'react-native'
import { LucideIcon } from 'lucide-react-native'
import { Heading, Text } from './Text'
import { Button } from './Button'
import { useThemeColors } from '../../lib/theme'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  const colors = useThemeColors()
  return (
    <View className={`items-center justify-center py-12 px-6 ${className}`}>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-soft mb-4">
        <Icon size={28} color={colors.primary} />
      </View>
      <Heading level={4} className="text-center mb-1">
        {title}
      </Heading>
      {description ? (
        <Text variant="bodySm" muted className="text-center mb-5 max-w-xs">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} size="sm" />
      ) : null}
    </View>
  )
}
