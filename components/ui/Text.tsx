import { Text as RNText, TextProps } from 'react-native'

type TextVariant = 'body' | 'bodyLg' | 'bodySm' | 'caption' | 'label' | 'number' | 'numberLg'

const VARIANT: Record<TextVariant, string> = {
  bodyLg: 'font-sans text-lg',
  body: 'font-sans text-base',
  bodySm: 'font-sans text-sm',
  caption: 'font-medium text-xs',
  label: 'font-semibold text-sm',
  number: 'font-bold text-base',
  numberLg: 'font-display text-4xl',
}

export interface AppTextProps extends TextProps {
  variant?: TextVariant
  muted?: boolean
  className?: string
}

/** Body/UI text on the Barlow family. Defaults to foreground color + body size. */
export function Text({ variant = 'body', muted, className = '', ...rest }: AppTextProps) {
  const color = muted ? 'text-muted-foreground' : 'text-foreground'
  return <RNText className={`${VARIANT[variant]} ${color} ${className}`} {...rest} />
}

type HeadingLevel = 1 | 2 | 3 | 4

const HEADING: Record<HeadingLevel, string> = {
  1: 'font-display text-4xl leading-tight tracking-tight',
  2: 'font-display text-3xl leading-tight tracking-tight',
  3: 'font-display text-2xl leading-tight',
  4: 'font-display-semibold text-xl leading-snug',
}

export interface HeadingProps extends TextProps {
  level?: HeadingLevel
  uppercase?: boolean
  muted?: boolean
  className?: string
}

/** Impact headings on Barlow Condensed. Energetic direction favors uppercase titles. */
export function Heading({
  level = 2,
  uppercase = false,
  muted,
  className = '',
  ...rest
}: HeadingProps) {
  const color = muted ? 'text-muted-foreground' : 'text-foreground'
  const transform = uppercase ? 'uppercase tracking-wide' : ''
  return <RNText className={`${HEADING[level]} ${color} ${transform} ${className}`} {...rest} />
}
