create extension if not exists pgcrypto;

create type public.verification_status as enum ('not-started', 'pending', 'approved');
create type public.betting_intent as enum ('equity', 'paid');
create type public.project_status as enum ('draft', 'translating', 'recruiting', 'in_progress', 'completed');
create type public.invitation_status as enum ('sent', 'opened', 'accepted', 'rejected', 'expired');
create type public.agreement_status as enum ('draft', 'partially-signed', 'signed', 'cancelled');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text,
  interest text,
  proof_url text,
  proof_summary text,
  betting_intent public.betting_intent,
  verification_status public.verification_status not null default 'not-started',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  idea text not null,
  title text,
  summary text,
  status public.project_status not null default 'draft',
  regeneration_count integer not null default 0 check (regeneration_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role_name text not null,
  status text not null default 'active',
  is_mvp boolean not null default false,
  unique (project_id, role_name)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  status public.invitation_status not null default 'sent',
  q3 text,
  reject_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, candidate_id)
);

create table public.matching_questions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  question_no smallint not null check (question_no between 1 and 3),
  source text not null check (source in ('orbit', 'demand')),
  prompt text not null,
  unique (invitation_id, question_no)
);

create table public.matching_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.matching_questions(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (question_id, responder_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  role_score numeric(5,2) not null default 0,
  domain_score numeric(5,2) not null default 0,
  betting_score numeric(5,2) not null default 0,
  why_match text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  contribution text,
  compensation text,
  demand_signed_at timestamptz,
  supply_signed_at timestamptz,
  status public.agreement_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  detail text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index projects_owner_id_idx on public.projects(owner_id);
create index invitations_candidate_id_idx on public.invitations(candidate_id);
create index notifications_user_id_idx on public.notifications(user_id, created_at desc);
create index events_user_id_idx on public.events(user_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
create trigger invitations_updated_at before update on public.invitations for each row execute procedure public.set_updated_at();
create trigger agreements_updated_at before update on public.agreements for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email)); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_roles enable row level security;
alter table public.invitations enable row level security;
alter table public.matching_questions enable row level security;
alter table public.matching_answers enable row level security;
alter table public.matches enable row level security;
alter table public.agreements enable row level security;
alter table public.notifications enable row level security;
alter table public.events enable row level security;

create policy "profiles own" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "projects owner" on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "project roles owner" on public.project_roles for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "invitations participants" on public.invitations for all using (candidate_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())) with check (candidate_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "questions participants" on public.matching_questions for all using (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (i.candidate_id = auth.uid() or p.owner_id = auth.uid()))) with check (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (i.candidate_id = auth.uid() or p.owner_id = auth.uid())));
create policy "answers participants" on public.matching_answers for all using (responder_id = auth.uid() or exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and p.owner_id = auth.uid())) with check (responder_id = auth.uid());
create policy "matches participants" on public.matches for all using (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (i.candidate_id = auth.uid() or p.owner_id = auth.uid()))) with check (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (i.candidate_id = auth.uid() or p.owner_id = auth.uid())));
create policy "agreements participants" on public.agreements for all using (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where i.id = invitation_id and (i.candidate_id = auth.uid() or p.owner_id = auth.uid()))) with check (exists (select 1 from public.invitations i join public.projects p on p.id = i.project_id where p.id = project_id and (i.candidate_id = auth.uid() or p.owner_id = auth.uid())));
create policy "notifications own" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "events own" on public.events for select using (user_id = auth.uid());
create policy "events insert" on public.events for insert with check (user_id = auth.uid() or user_id is null);
