import { Pressable, PressableProps, View, ViewProps } from 'react-native'

const BASE = 'bg-surface rounded-2xl border border-border'

const ELEVATED_STYLE = {
  shadowColor: '#0B1210',
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
}

export interface CardProps extends ViewProps {
  elevated?: boolean
  padded?: boolean
  className?: string
}

export function Card({ elevated, padded = true, className = '', style, ...rest }: CardProps) {
  return (
    <View
      className={`${BASE} ${padded ? 'p-4' : ''} ${className}`}
      style={[elevated ? ELEVATED_STYLE : undefined, style]}
      {...rest}
    />
  )
}

export interface PressableCardProps extends Omit<PressableProps, 'style'> {
  elevated?: boolean
  padded?: boolean
  className?: string
}

/** Tappable card with press feedback; use for list rows and quick actions. */
export function PressableCard({
  elevated,
  padded = true,
  className = '',
  ...rest
}: PressableCardProps) {
  return (
    <Pressable
      className={`${BASE} ${padded ? 'p-4' : ''} active:bg-surface-muted ${className}`}
      style={elevated ? ELEVATED_STYLE : undefined}
      {...rest}
    />
  )
}
