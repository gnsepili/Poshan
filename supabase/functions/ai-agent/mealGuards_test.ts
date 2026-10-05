import { assertEquals } from 'jsr:@std/assert@1'
import { mealLogRejection, upsertPlanDay, weekStartMonday } from './mealGuards.ts'

Deno.test('rejects logging food the user has not confirmed eating', () => {
  assertEquals(typeof mealLogRejection({ description: 'Paneer and rice', user_confirmed_eaten: false }), 'string')
  assertEquals(typeof mealLogRejection({ description: 'Paneer and rice' }), 'string')
})

Deno.test('rejects a whole day of meals squeezed into one log (the bug from 2026-10-05)', () => {
  const desc = 'Breakfast: Scrambled eggs with a small serving of rice. Lunch: Low-fat paneer and soybeans with cold rice. Dinner: Chicken curry with a choice of rice or chapati.'
  assertEquals(typeof mealLogRejection({ description: desc, user_confirmed_eaten: true }), 'string')
})

Deno.test('allows a single meal the user ate', () => {
  assertEquals(mealLogRejection({ description: 'Two-egg omelette with a teaspoon of ghee', user_confirmed_eaten: true }), null)
  assertEquals(mealLogRejection({ description: 'Leftover chicken curry from dinner with 2 chapatis', user_confirmed_eaten: true }), null)
})

Deno.test('upsertPlanDay replaces the same day and keeps the others in week order', () => {
  const days = [
    { day: 'Wednesday', meals: [] },
    { day: 'Monday', meals: [{ meal_type: 'lunch' }] },
  ]
  const out = upsertPlanDay(days, { day: 'monday', meals: [{ meal_type: 'dinner' }] })
  assertEquals(out.map((d) => d.day), ['Monday', 'Wednesday'])
  assertEquals(out[0].meals, [{ meal_type: 'dinner' }])
})

Deno.test('weekStartMonday', () => {
  assertEquals(weekStartMonday(new Date('2026-10-05T10:00:00Z')), '2026-10-05') // a Monday
  assertEquals(weekStartMonday(new Date('2026-10-11T10:00:00Z')), '2026-10-05') // Sunday
})
