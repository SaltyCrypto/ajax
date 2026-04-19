-- ============================================
-- Feed ingestion v2 — bookmarklet capture + typed feeds
-- ============================================
-- Extends feed_snapshots to support bookmarklet captures (adds to the
-- allowed source enum) and adds a capture_type column so one user can
-- have home-feed, history, subscriptions, trending, and search captures
-- stored side-by-side and queried independently.
--
-- Also adds a videos GIN index for fast "which videos have been seen"
-- lookups used by /api/discover.

-- Drop and recompose the source check to include 'bookmarklet'
alter table public.feed_snapshots drop constraint if exists feed_snapshots_source_check;
alter table public.feed_snapshots add constraint feed_snapshots_source_check
  check (source in ('screenshot', 'extension', 'paste', 'recording', 'bookmarklet'));

-- capture_type: what kind of YouTube page was captured
alter table public.feed_snapshots
  add column if not exists capture_type text default 'home'
  check (capture_type in ('home', 'history', 'subscriptions', 'trending', 'library', 'search', 'channel', 'other'));

-- Index for time-ordered lookup
create index if not exists idx_feed_snapshots_user_type_time
  on public.feed_snapshots(user_id, capture_type, captured_at desc);

-- GIN index on videos jsonb for `@>` containment queries used by discover
create index if not exists idx_feed_snapshots_videos_gin
  on public.feed_snapshots using gin (videos);

comment on column public.feed_snapshots.capture_type is
  'The kind of YouTube page captured. home = algorithmic feed, history = watch history, etc. Lets us treat different capture sources as different signals downstream.';

-- ============================================
-- Capture tokens
-- ============================================
-- Each user gets a unique token baked into their personal bookmarklet. This
-- avoids fighting SameSite=Lax cookies (the bookmarklet runs on youtube.com
-- and cross-origin fetches don't forward Lax cookies), and makes captures
-- revocable/rotatable per user.

alter table public.users
  add column if not exists capture_token text;

create unique index if not exists idx_users_capture_token
  on public.users(capture_token)
  where capture_token is not null;

-- Backfill a token for every existing user so their bookmarklet works on
-- first visit to /capture.
update public.users
  set capture_token = encode(gen_random_bytes(24), 'hex')
  where capture_token is null;

comment on column public.users.capture_token is
  'Per-user secret included in the bookmarklet URL. Authenticates /api/feed/ingest requests that come from youtube.com (where SameSite=Lax cookies are not forwarded).';
