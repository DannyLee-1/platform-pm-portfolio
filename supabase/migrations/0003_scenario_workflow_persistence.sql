-- Persist the current single-account scenario without presenting scenario
-- candidates as real Supabase Auth users.

alter table public.invitations
  add column if not exists scenario_candidate_key text,
  add column if not exists scenario_mode boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invitations_scenario_candidate_key_check'
  ) then
    alter table public.invitations
      add constraint invitations_scenario_candidate_key_check
      check (scenario_candidate_key is null or scenario_candidate_key in ('junyoung', 'seoyeon'));
  end if;
end $$;

create index if not exists invitations_project_created_idx
  on public.invitations(project_id, created_at desc);

comment on column public.invitations.scenario_candidate_key is
  'Static candidate key used only by the explicitly labeled ORBIT scenario flow.';
comment on column public.invitations.scenario_mode is
  'True when one authenticated user is walking through both sides of the portfolio scenario.';
