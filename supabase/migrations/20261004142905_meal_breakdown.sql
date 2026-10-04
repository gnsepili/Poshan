-- Richer meal results: per-item breakdown and a 1-10 meal score with a short label,
-- so a logged meal can be shown again in the same detail view as right after the snap.
alter table public.meals
  add column items jsonb,          -- [{ name, portion, calories, protein_g, carbs_g, fat_g }]
  add column score int check (score between 1 and 10),
  add column score_label text;
