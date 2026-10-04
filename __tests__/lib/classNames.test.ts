import { mergeTextClasses } from '../../lib/utils/classNames'

describe('mergeTextClasses', () => {
  it('lets an explicit font family replace the variant default', () => {
    expect(mergeTextClasses('font-sans text-base text-foreground', 'font-display text-3xl')).toBe('text-foreground font-display text-3xl')
  })

  it('lets an explicit colour replace the default colour', () => {
    expect(mergeTextClasses('font-sans text-sm text-foreground', 'text-danger')).toBe('font-sans text-sm text-danger')
    expect(mergeTextClasses('font-sans text-sm text-muted-foreground', 'text-macro-calories font-semibold')).toBe('text-sm text-macro-calories font-semibold')
  })

  it('keeps defaults that are not overridden and passes other classes through', () => {
    expect(mergeTextClasses('font-medium text-xs text-foreground', 'uppercase tracking-wide mt-1')).toBe('font-medium text-xs text-foreground uppercase tracking-wide mt-1')
  })
})
