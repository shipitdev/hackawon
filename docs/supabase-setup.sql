-- Hackawon: per-user state.
--
-- Run this once in Supabase → SQL Editor → New query → Run.
--
-- Only per-user data lives here. Hackathons, ideas and the toolkit stay as static files built by
-- GitHub Actions: they are identical for every visitor, so putting them in a database would add
-- cost and fragility for nothing.
--
-- Row level security is what makes it safe for the site to talk to this database directly from a
-- browser using the public anon key. Every policy below restricts rows to `auth.uid()`, the
-- signed-in user, so one user can never read or write another's rows even though everyone shares
-- the same key.

-- ---------------------------------------------------------------- favourites
create table if not exists public.favourites (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  -- The stable hackathon id from the exporter, e.g. 'devfolio:9f3e3e2e...'. Deliberately plain
  -- text with no foreign key: hackathons live in static files, not in this database, and a
  -- listing disappearing must never delete someone's saved row.
  hackathon_uid text        not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, hackathon_uid)
);

alter table public.favourites enable row level security;

-- Separate policies per action, so a future read-only view cannot accidentally grant writes.
create policy "read own favourites"
  on public.favourites for select
  using (auth.uid() = user_id);

create policy "add own favourites"
  on public.favourites for insert
  with check (auth.uid() = user_id);

create policy "remove own favourites"
  on public.favourites for delete
  using (auth.uid() = user_id);

-- Listing a user's saved hackathons is the only query the site makes here.
create index if not exists favourites_user_idx on public.favourites (user_id);


-- ---------------------------------------------------------------- later: participation
-- Not used by the site yet. Created now so the shape is agreed and adding the UI needs no
-- migration. Same pattern: owned rows, one policy per action.
create table if not exists public.participating (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  hackathon_uid text        not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, hackathon_uid)
);

alter table public.participating enable row level security;

create policy "read own participation"
  on public.participating for select
  using (auth.uid() = user_id);

create policy "add own participation"
  on public.participating for insert
  with check (auth.uid() = user_id);

create policy "remove own participation"
  on public.participating for delete
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------- later: reminders
-- Sending reminders needs something running on a schedule with nobody's browser open, which is
-- the one part of this that will need a server or a scheduled function. The preference row is
-- cheap to store now.
create table if not exists public.reminder_prefs (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  -- How many days before a registration deadline to nudge. Null disables reminders.
  days_before integer     check (days_before is null or days_before between 1 and 30),
  email       boolean     not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.reminder_prefs enable row level security;

create policy "read own reminder prefs"
  on public.reminder_prefs for select
  using (auth.uid() = user_id);

create policy "upsert own reminder prefs"
  on public.reminder_prefs for insert
  with check (auth.uid() = user_id);

create policy "update own reminder prefs"
  on public.reminder_prefs for update
  using (auth.uid() = user_id);
