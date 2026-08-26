-- ORBIT table definition v1.0 alignment.
-- The first migration powers the current prototype. This migration adds the
-- canonical MVP inventory without deleting prototype data.

create type public.orbit_side as enum ('demand', 'supply');
create type public.orbit_user_status as enum ('active', 'dormant', 'withdrawn');
create type public.orbit_provider as enum ('google', 'kakao', 'naver', 'email');
create type public.orbit_register_step as enum ('a_role', 'b_proof', 'c_betting', 'd_consent', 'completed');
create type public.orbit_role_type as enum ('dev_fe', 'dev_be', 'design', 'plan', 'marketing', 'manufacturing', 'domain_special');
create type public.orbit_verification as enum ('pending', 'approved', 'rejected');
create type public.orbit_intent as enum ('equity_ok', 'upfront_required');
create type public.orbit_proof_type as enum ('work_url', 'reputation_text');
create type public.orbit_consent_type as enum ('ip_nda', 'privacy_profile');
create type public.orbit_match_level as enum ('high', 'mid', 'low');
create type public.orbit_invitation_status as enum ('sent', 'opened', 'accepted', 'rejected', 'expired');
create type public.orbit_agreement_status as enum ('draft', 'one_signed', 'both_signed', 'expired');
create type public.orbit_admin_role as enum ('reviewer', 'ops');

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) not null unique,
  display_name varchar(50) not null,
  current_side public.orbit_side,
  status public.orbit_user_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider public.orbit_provider not null,
  provider_uid varchar(255) not null,
  linked_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_uid)
);

create table if not exists public.user_side_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  side public.orbit_side not null, is_first boolean not null default false, session_id varchar(64),
  selected_at timestamptz not null default timezone('utc', now()), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists user_side_logs_first_idx on public.user_side_logs(user_id) where is_first;

create table if not exists public.user_terms_consents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  terms_version varchar(20) not null, privacy_version varchar(20) not null, agreed_at timestamptz not null,
  ip_address inet, user_agent varchar(255), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

insert into public.users (id, email, display_name)
select au.id, coalesce(au.email, au.id::text), coalesce(p.display_name, split_part(coalesce(au.email, au.id::text), '@', 1))
from auth.users au left join public.profiles p on p.id = au.id
on conflict (id) do nothing;

alter table public.projects add column if not exists owner_user_id uuid references public.users(id);
alter table public.projects add column if not exists raw_idea text;
alter table public.projects add column if not exists gate_status text not null default 'passed';
alter table public.projects add column if not exists regen_count smallint not null default 0;
update public.projects set owner_user_id = owner_id where owner_user_id is null;
update public.projects set raw_idea = idea where raw_idea is null;

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  attempt_no smallint not null default 1, trigger_type text not null default 'initial', status text not null,
  duration_ms integer, fail_reason varchar(200), model_version varchar(50), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(project_id, attempt_no)
);
create table if not exists public.project_pages (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  version smallint not null default 1, is_current boolean not null default true, title varchar(60) not null,
  tagline varchar(120) not null, view_mode_default text not null default 'mockup', problem_text text, target_text text,
  core_flow_text text, first_success_text text, revenue_sketch text, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(project_id, version)
);
create unique index if not exists project_pages_current_idx on public.project_pages(project_id) where is_current;
create table if not exists public.project_mockups (
  id uuid primary key default gen_random_uuid(), project_page_id uuid not null references public.project_pages(id) on delete cascade,
  seq smallint not null check (seq between 1 and 3), image_url text not null, label varchar(20) not null default '예시 · 미리보기', created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.project_features (
  id uuid primary key default gen_random_uuid(), project_page_id uuid not null references public.project_pages(id) on delete cascade,
  seq smallint not null, feature_text varchar(120) not null, linked_role_label varchar(30), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.role_slots (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  role_type public.orbit_role_type not null, role_label varchar(30) not null, is_special boolean not null default false,
  is_active boolean not null default false, status text not null default 'preparing', capacity smallint not null default 1 check (capacity = 1), filled_count smallint not null default 0 check (filled_count <= capacity), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists role_slots_active_idx on public.role_slots(project_id) where is_active;

alter table public.matching_questions add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.matching_questions add column if not exists slot text;
alter table public.matching_questions add column if not exists question_text text;
alter table public.matching_questions add column if not exists is_optional boolean not null default false;
alter table public.matching_questions add column if not exists guardrail_flagged boolean not null default false;
alter table public.matching_questions add column if not exists guardrail_keyword varchar(50);
update public.matching_questions set question_text = prompt where question_text is null;

create table if not exists public.preliminary_matches (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  role_slot_id uuid not null references public.role_slots(id) on delete cascade, supplier_user_id uuid not null references public.users(id) on delete cascade,
  role_level public.orbit_match_level not null, domain_level public.orbit_match_level not null, betting_level public.orbit_match_level not null,
  weakness_text varchar(100) not null, why_text text not null, rank smallint not null, signal_snapshot jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(role_slot_id, supplier_user_id)
);
create table if not exists public.candidate_notify_requests (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  role_type public.orbit_role_type not null, requested_at timestamptz not null default timezone('utc', now()), notified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.supplier_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.users(id) on delete cascade,
  primary_role public.orbit_role_type not null, years_experience smallint, headline varchar(80), register_step public.orbit_register_step not null default 'a_role', is_pool_visible boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.supplier_interests (
  id uuid primary key default gen_random_uuid(), supplier_profile_id uuid not null references public.supplier_profiles(id) on delete cascade, interest_tag varchar(30) not null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(supplier_profile_id, interest_tag)
);
create table if not exists public.supplier_portfolios (
  id uuid primary key default gen_random_uuid(), supplier_profile_id uuid not null references public.supplier_profiles(id) on delete cascade,
  proof_type public.orbit_proof_type not null, url text, description text, is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.supplier_verifications (
  id uuid primary key default gen_random_uuid(), supplier_profile_id uuid not null references public.supplier_profiles(id) on delete cascade,
  attempt_no smallint not null default 1, status public.orbit_verification not null default 'pending', reviewed_by uuid, reject_reason text,
  submitted_at timestamptz not null default timezone('utc', now()), reviewed_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(supplier_profile_id, attempt_no)
);
create table if not exists public.betting_intents (
  id uuid primary key default gen_random_uuid(), supplier_profile_id uuid not null references public.supplier_profiles(id) on delete cascade,
  intent public.orbit_intent not null, condition_note varchar(120), weekly_hours smallint, is_current boolean not null default true, set_at timestamptz not null default timezone('utc', now()), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists betting_intents_current_idx on public.betting_intents(supplier_profile_id) where is_current;
create table if not exists public.supplier_consents (
  id uuid primary key default gen_random_uuid(), supplier_profile_id uuid not null references public.supplier_profiles(id) on delete cascade,
  consent_type public.orbit_consent_type not null, doc_version varchar(20) not null, agreed_at timestamptz not null, ip_address inet,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(supplier_profile_id, consent_type, doc_version)
);
create table if not exists public.candidate_pool (
  id uuid primary key default gen_random_uuid(), supplier_profile_id uuid not null unique references public.supplier_profiles(id) on delete cascade,
  role_type public.orbit_role_type not null, verification_status public.orbit_verification not null, betting_intent public.orbit_intent not null,
  work_count smallint not null default 0, reputation_level public.orbit_match_level not null, domain_tags jsonb, is_available boolean not null default true,
  last_synced_at timestamptz not null default timezone('utc', now()), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

alter table public.invitations add column if not exists role_slot_id uuid references public.role_slots(id);
alter table public.invitations add column if not exists from_user_id uuid references public.users(id);
alter table public.invitations add column if not exists to_user_id uuid references public.users(id);
alter table public.invitations add column if not exists sent_at timestamptz;
alter table public.invitations add column if not exists opened_at timestamptz;
alter table public.invitations add column if not exists responded_at timestamptz;
update public.invitations set sent_at = created_at where sent_at is null;
create unique index if not exists invitations_slot_active_idx on public.invitations(role_slot_id) where role_slot_id is not null and status in ('sent', 'opened');
create table if not exists public.invitation_answers (
  id uuid primary key default gen_random_uuid(), invitation_id uuid not null references public.invitations(id) on delete cascade,
  question_id uuid not null references public.matching_questions(id) on delete cascade, answer_text text not null, answered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(invitation_id, question_id)
);
create table if not exists public.invitation_rejections (
  id uuid primary key default gen_random_uuid(), invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  reason_code text, reason_text varchar(200), rejected_at timestamptz not null default timezone('utc', now()), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(), invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  role_score smallint not null check (role_score between 0 and 100), domain_score smallint not null check (domain_score between 0 and 100), betting_score smallint not null check (betting_score between 0 and 100),
  why_text text not null, engine_version varchar(30), computed_at timestamptz not null default timezone('utc', now()), viewed_by_demand_at timestamptz, viewed_by_supply_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

alter table public.agreements add column if not exists role_slot_id uuid references public.role_slots(id);
alter table public.agreements add column if not exists match_result_id uuid references public.match_results(id);
alter table public.agreements add column if not exists role_text text;
alter table public.agreements add column if not exists contribution_text text;
alter table public.agreements add column if not exists reward_equity_text text;
alter table public.agreements add column if not exists first_signed_at timestamptz;
alter table public.agreements add column if not exists both_signed_at timestamptz;
create table if not exists public.agreement_signatures (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.agreements(id) on delete cascade,
  side public.orbit_side not null, user_id uuid not null references public.users(id) on delete cascade, signed_at timestamptz not null default timezone('utc', now()), is_revocable boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(agreement_id, side)
);
create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null unique references public.agreements(id) on delete cascade,
  channel_name varchar(80) not null, invite_token varchar(64) not null unique, created_by_admin_id uuid, joined_demand_at timestamptz, joined_supply_at timestamptz, boundary_notice_version varchar(20) not null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notifications add column if not exists noti_type text;
alter table public.notifications add column if not exists ref_type varchar(30);
alter table public.notifications add column if not exists ref_id uuid;
alter table public.notifications add column if not exists is_read boolean not null default false;
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null default 'email', to_address varchar(255) not null, status text not null default 'queued', sent_at timestamptz, error_message varchar(255),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
alter table public.events add column if not exists session_id varchar(64);
alter table public.events add column if not exists screen_id varchar(10);
alter table public.events add column if not exists side public.orbit_side;
alter table public.events add column if not exists project_id uuid references public.projects(id);
alter table public.events add column if not exists invitation_id uuid references public.invitations(id);
alter table public.events add column if not exists hypothesis_tags text[];
alter table public.events add column if not exists occurred_at timestamptz not null default timezone('utc', now());
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(), email varchar(255) not null unique, name varchar(50) not null,
  admin_role public.orbit_admin_role not null default 'reviewer', is_active boolean not null default true, last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_orbit_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.users (id, email, display_name) values (new.id, coalesce(new.email, new.id::text), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, new.id::text), '@', 1))) on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created_orbit on auth.users;
create trigger on_auth_user_created_orbit after insert on auth.users for each row execute procedure public.handle_new_orbit_user();

do $$ declare table_name text; begin
  foreach table_name in array array['users','auth_identities','user_side_logs','user_terms_consents','translations','project_pages','project_mockups','project_features','role_slots','preliminary_matches','candidate_notify_requests','supplier_profiles','supplier_interests','supplier_portfolios','supplier_verifications','betting_intents','supplier_consents','candidate_pool','invitation_answers','invitation_rejections','match_results','agreement_signatures','handoffs','notification_deliveries','admin_users'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "orbit users own" on public.users for all using (id = auth.uid()) with check (id = auth.uid());
create policy "orbit identities own" on public.auth_identities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "orbit side logs own" on public.user_side_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "orbit terms own" on public.user_terms_consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "orbit supplier profile own" on public.supplier_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "orbit supplier interests own" on public.supplier_interests for all using (exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid())) with check (exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid()));
create policy "orbit supplier portfolios own" on public.supplier_portfolios for all using (exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid())) with check (exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid()));
create policy "orbit supplier intents own" on public.betting_intents for all using (exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid())) with check (exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid()));
create policy "orbit candidate pool approved" on public.candidate_pool for select using (verification_status = 'approved' or exists (select 1 from public.supplier_profiles p where p.id = supplier_profile_id and p.user_id = auth.uid()));
create policy "orbit match results participants" on public.match_results for all using (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (p.owner_id = auth.uid() or i.candidate_id = auth.uid()))) with check (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (p.owner_id = auth.uid() or i.candidate_id = auth.uid())));
