-- Coach-style goal setup: remember the user's goal and pace alongside the computed targets
-- (the coach and daily summary read goals via select *).
alter table public.goals
  add column goal_type text check (goal_type in ('lose', 'maintain', 'gain')),
  add column weekly_rate_kg float;
