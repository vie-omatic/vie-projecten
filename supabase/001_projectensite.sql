-- VIE Projecten (teamsite) - stap 1: database
-- Project: VIE Chatbot (Supabase). Alle objecten hebben het voorvoegsel pr_.
-- Principe: de site is een leeg omhulsel, de inhoud zit achter RLS.
-- Alleen accounts op pr_toegang (actief) mogen lezen. Niemand schrijft via de API;
-- bijwerken gaat via de Table Editor (service role).

-- ---------------------------------------------------------------
-- 1. Gastenlijst
-- ---------------------------------------------------------------
create table public.pr_toegang (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  naam          text not null,
  actief        boolean not null default true,
  toegevoegd_op timestamptz not null default now()
);
alter table public.pr_toegang enable row level security;
-- Geen policies: via de API is deze tabel voor niemand leesbaar.
revoke all on table public.pr_toegang from anon, authenticated;

-- ---------------------------------------------------------------
-- 2. Toegangscheck
-- ---------------------------------------------------------------
create or replace function public.pr_heeft_toegang()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pr_toegang t
    where t.user_id = (select auth.uid()) and t.actief
  );
$$;
revoke all on function public.pr_heeft_toegang() from public, anon, authenticated;
grant execute on function public.pr_heeft_toegang() to authenticated;

-- Houdt bijgewerkt_op bij, ook bij wijzigen in de Table Editor
create or replace function public.pr_zet_bijgewerkt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.bijgewerkt_op := now();
  return new;
end;
$$;
revoke all on function public.pr_zet_bijgewerkt() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Inhoud
-- ---------------------------------------------------------------
create table public.pr_projecten (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  naam           text not null,
  omschrijving   text,
  categorie      text not null check (categorie in ('platform','intern','bot','agent','website')),
  status         text,
  gelanceerd     text not null default 'nee' check (gelanceerd in ('ja','nee','nvt')),
  ai             boolean not null default false,
  ai_toelichting text,
  adres          text,
  supabase       text,
  netlify        text,
  git            text,
  doel           text,
  opbouw         text,
  open_punten    text,
  volgorde       int not null default 0,
  bijgewerkt_op  timestamptz not null default now()
);

create table public.pr_modules (
  id            uuid primary key default gen_random_uuid(),
  naam          text not null,
  status        text,
  ai            text,
  volgende_stap text,
  volgorde      int not null default 0,
  bijgewerkt_op timestamptz not null default now()
);

create table public.pr_roadmap (
  id            uuid primary key default gen_random_uuid(),
  titel         text not null,
  project_id    uuid references public.pr_projecten(id) on delete set null,
  periode       text,
  fase          text not null default 'volgende' check (fase in ('nu','volgende','geparkeerd','afgerond')),
  toelichting   text,
  volgorde      int not null default 0,
  bijgewerkt_op timestamptz not null default now()
);

create table public.pr_teksten (
  sleutel       text primary key,
  titel         text,
  inhoud        text,
  volgorde      int not null default 0,
  bijgewerkt_op timestamptz not null default now()
);

-- RLS, rechten, leesregel en bijgewerkt-trigger voor alle inhoudstabellen
do $$
declare t text;
begin
  foreach t in array array['pr_projecten','pr_modules','pr_roadmap','pr_teksten'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.pr_heeft_toegang()))',
      t || '_lezen', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.pr_zet_bijgewerkt()',
      t || '_bijgewerkt', t);
  end loop;
end $$;
