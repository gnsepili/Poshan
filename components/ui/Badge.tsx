import { View } from 'react-native'
import { Text } from './Text'

type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger'

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-muted',
  primary: 'bg-primary-soft',
  accent: 'bg-accent-soft',
  success: 'bg-primary-soft',
  warning: 'bg-accent-soft',
  danger: 'bg-danger-soft',
}

const TEXT: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

export interface BadgeProps {
  label: string
  tone?: Tone
  className?: string
}

export function Badge({ label, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${TONE[tone]} ${className}`}>
      <Text className={`font-semibold text-xs ${TEXT[tone]}`}>{label}</Text>
    </View>
  )
}
