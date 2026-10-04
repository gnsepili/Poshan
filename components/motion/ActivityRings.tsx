import { View } from 'react-native'
import Svg from 'react-native-svg'
import { AnimatedRing } from './AnimatedRing'

export interface RingSpec {
  progress: number
  color: string
  trackColor: string
}

interface Props {
  /** Outermost first. */
  rings: RingSpec[]
  size?: number
  thickness?: number
  gap?: number
}

// Concentric activity-style rings (e.g. calories / protein / steps).
export function ActivityRings({ rings, size = 132, thickness = 12, gap = 3 }: Props) {
  const c = size / 2
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {rings.map((ring, i) => (
          <AnimatedRing
            key={i}
            cx={c}
            cy={c}
            radius={c - thickness / 2 - i * (thickness + gap)}
            thickness={thickness}
            progress={ring.progress}
            color={ring.color}
            trackColor={ring.trackColor}
            delayMs={i * 120}
          />
        ))}
      </Svg>
    </View>
  )
}
