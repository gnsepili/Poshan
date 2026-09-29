import { parseManualMacros } from '../../lib/utils/manualMealEntry'

describe('parseManualMacros', () => {
  it('parses valid numeric strings into a macros object', () => {
    expect(parseManualMacros({ calories: '450', protein: '30', carbs: '50', fat: '12' })).toEqual({
      total_calories: 450, protein_g: 30, carbs_g: 50, fat_g: 12, fiber_g: 0,
    })
  })

  it('parses an optional fiber value when provided', () => {
    expect(parseManualMacros({ calories: '450', protein: '30', carbs: '50', fat: '12', fiber: '5' })).toEqual({
      total_calories: 450, protein_g: 30, carbs_g: 50, fat_g: 12, fiber_g: 5,
    })
  })

  it('defaults fiber to 0 when omitted or blank', () => {
    expect(parseManualMacros({ calories: '100', protein: '1', carbs: '1', fat: '1', fiber: '' })?.fiber_g).toBe(0)
  })

  it('returns null when a required field is empty', () => {
    expect(parseManualMacros({ calories: '', protein: '30', carbs: '50', fat: '12' })).toBeNull()
  })

  it('returns null when a required field is non-numeric', () => {
    expect(parseManualMacros({ calories: 'abc', protein: '30', carbs: '50', fat: '12' })).toBeNull()
  })

  it('returns null when a required field is negative', () => {
    expect(parseManualMacros({ calories: '450', protein: '-1', carbs: '50', fat: '12' })).toBeNull()
  })

  it('returns null when the optional fiber field is provided but negative or non-numeric', () => {
    expect(parseManualMacros({ calories: '450', protein: '30', carbs: '50', fat: '12', fiber: '-1' })).toBeNull()
    expect(parseManualMacros({ calories: '450', protein: '30', carbs: '50', fat: '12', fiber: 'x' })).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    expect(parseManualMacros({ calories: ' 450 ', protein: ' 30 ', carbs: ' 50 ', fat: ' 12 ' })).toEqual({
      total_calories: 450, protein_g: 30, carbs_g: 50, fat_g: 12, fiber_g: 0,
    })
  })
})
