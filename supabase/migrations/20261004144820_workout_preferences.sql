-- Workout plan customization: the user's training preferences (days/week, session length,
-- equipment, focus, experience, limitations) drive plan generation.
alter table public.profiles add column workout_prefs jsonb;

-- Model for the dedicated workout-plan function (backend flag, like the other features).
update public.app_config
set value = jsonb_set(value, '{models,workout_plan}', '"gpt-4o"'::jsonb, true), updated_at = now()
where key = 'ai';
