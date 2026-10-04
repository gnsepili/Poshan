-- Full InBody sheet extraction (v2). The headline trend metrics get typed columns so
-- charts and the coach can query them; everything else on the printout (segmental
-- lean/fat, body water split, research parameters, weight control, reference ranges)
-- lives in raw_extracted_json as a structured "details" object.
alter table public.inbody_reports
  add column bmi float,
  add column body_fat_mass_kg float,
  add column fat_free_mass_kg float,
  add column total_body_water_l float,
  add column ecw_tbw_ratio float,
  add column inbody_score int,
  add column smi float,
  add column phase_angle float,
  add column waist_hip_ratio float,
  add column target_weight_kg float,
  -- 1 = legacy 5-field extraction, 2 = full structured sheet
  add column extraction_version int not null default 1;
