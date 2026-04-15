-- ============================================
-- Feed Snapshots — captures of algorithmic output
-- ============================================

create table if not exists public.feed_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source text not null default 'screenshot' check (source in ('screenshot', 'extension', 'paste', 'recording')),
  platform text not null default 'youtube' check (platform in ('youtube', 'spotify', 'tiktok')),
  videos jsonb not null default '[]',
  algorithm_personality text,
  feed_diversity text,
  feed_quality_score float,
  top_categories jsonb not null default '[]',
  missing_categories jsonb not null default '[]',
  assessment text,
  algorithm_match_score float,  -- how well the feed matches their real taste
  captured_at timestamptz not null default now()
);

create index idx_feed_snapshots_user on public.feed_snapshots(user_id, captured_at desc);

alter table public.feed_snapshots enable row level security;

create policy "Own feed snapshots" on public.feed_snapshots
  for all using (
    user_id is null
    or user_id in (select id from public.users where auth_id = auth.uid())
  );
