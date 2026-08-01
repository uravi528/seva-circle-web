-- Seva Circle database schema
-- Run this once in your Vercel Postgres (Neon) database's SQL console
-- (Vercel dashboard -> your project -> Storage -> your database -> Query)

create table if not exists teams (
  id text primary key,
  name text not null,
  color text not null,
  description text default '',
  motto text default '',
  passcode text not null,
  roles text[] not null default '{}'
);

create table if not exists members (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  name text not null,
  role text not null,
  color text not null,
  seva text default '',
  email text default ''
);

create table if not exists events (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  date text not null,
  title text not null
);

create table if not exists attendance (
  team_id text references teams(id) on delete cascade,
  date text not null,
  member_id text not null,
  status text not null,
  primary key (team_id, date, member_id)
);

create table if not exists ekadashi (
  date text primary key,
  name text not null
);

create table if not exists swaps (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  member_id text not null,
  member text not null,
  seva text default '',
  date text not null,
  reason text default '',
  status text not null default 'open',
  covered_by text
);

create table if not exists ideas (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  category text not null,
  text text not null,
  anonymous boolean default false,
  author text not null,
  date text not null,
  votes int default 0,
  executing boolean default false,
  executors text[] default '{}'
);

create table if not exists feedback_notes (
  id text primary key,
  member_id text not null,
  team_id text references teams(id) on delete cascade,
  text text not null,
  date text not null,
  read boolean default false
);

create table if not exists leader_tasks (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  text text not null,
  date text not null,
  done boolean default false
);

-- Powers the "Recent activity" feed in the app
create table if not exists activity_log (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  actor text not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- Tracks which day-of / week-ahead reminders have already been sent, so the
-- daily cron job never emails the same reminder twice
create table if not exists reminders_sent (
  event_id text not null,
  kind text not null, -- 'today' or 'week'
  primary key (event_id, kind)
);

-- Starting teams (safe to edit afterwards from inside the app, in Team Settings)
insert into teams (id, name, color, passcode, roles) values
  ('kishori', 'Kishori Karyakar Team', '#8B1E3F', 'KKT1234',
    array['Main','Co','Admin','PC']),
  ('balika', 'Balika Karyakar Team', '#E85D9E', 'BKT1234',
    array['Main','Co','Group 0 Karyakar','Group 1 Karyakar','Group 2 Karyakar','Group 3 Karyakar','Admin','PC'])
on conflict (id) do nothing;
