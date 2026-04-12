-- ============================================
-- AJAX — YouTube Astrology
-- Initial Database Schema
-- ============================================
-- Run this in your Supabase SQL Editor or via CLI:
--   supabase db push

-- Enable pgvector for taste vector similarity search
create extension if not exists vector;

-- ============================================
-- USERS
-- ============================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  username text unique not null,
  avatar_url text,
  bio text,
  consent_tier1 boolean not null default true,
  consent_tier2 boolean not null default false,
  consent_tier2_at timestamptz,
  profile_public boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-generate username from display_name
create or replace function public.generate_username(name text)
returns text language plpgsql as $$
declare
  base_name text;
  candidate text;
  counter int := 0;
begin
  base_name := lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'));
  if length(base_name) < 3 then
    base_name := 'user' || base_name;
  end if;
  candidate := base_name;
  while exists(select 1 from public.users where username = candidate) loop
    counter := counter + 1;
    candidate := base_name || counter::text;
  end loop;
  return candidate;
end;
$$;

-- ============================================
-- PLATFORM CONNECTIONS
-- ============================================
create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'spotify', 'reddit')),
  platform_user_id text not null,
  platform_display_name text,
  platform_avatar_url text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'syncing', 'complete', 'error')),
  sync_error text,
  unique(user_id, platform)
);

-- ============================================
-- YOUTUBE DATA
-- ============================================
create table public.youtube_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel_id text not null,
  channel_title text not null,
  channel_description text,
  channel_thumbnail text,
  subscriber_count bigint,
  topic_categories text[] not null default '{}',
  subscribed_at timestamptz,
  synced_at timestamptz not null default now(),
  unique(user_id, channel_id)
);

create index idx_yt_subs_user on public.youtube_subscriptions(user_id);

create table public.youtube_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  video_id text not null,
  title text not null,
  channel_id text not null,
  channel_title text not null,
  category_id text,
  tags text[] not null default '{}',
  duration_seconds int,
  published_at timestamptz,
  synced_at timestamptz not null default now(),
  unique(user_id, video_id)
);

create index idx_yt_likes_user on public.youtube_likes(user_id);

-- ============================================
-- SPOTIFY DATA
-- ============================================
create table public.spotify_top_artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id text not null,
  artist_name text not null,
  genres text[] not null default '{}',
  popularity int not null default 0,
  image_url text,
  time_range text not null check (time_range in ('short_term', 'medium_term', 'long_term')),
  rank int not null,
  synced_at timestamptz not null default now(),
  unique(user_id, artist_id, time_range)
);

create index idx_sp_artists_user on public.spotify_top_artists(user_id);

create table public.spotify_top_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  track_id text not null,
  track_name text not null,
  artist_id text not null,
  artist_name text not null,
  album_name text,
  popularity int not null default 0,
  duration_ms int,
  energy float,
  valence float,
  danceability float,
  acousticness float,
  instrumentalness float,
  time_range text not null check (time_range in ('short_term', 'medium_term', 'long_term')),
  rank int not null,
  synced_at timestamptz not null default now(),
  unique(user_id, track_id, time_range)
);

create index idx_sp_tracks_user on public.spotify_top_tracks(user_id);

create table public.spotify_saved_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  track_id text not null,
  track_name text not null,
  artist_id text not null,
  artist_name text not null,
  genres text[] not null default '{}',
  saved_at timestamptz,
  synced_at timestamptz not null default now(),
  unique(user_id, track_id)
);

create index idx_sp_saved_user on public.spotify_saved_tracks(user_id);

-- ============================================
-- TASTE PROFILES
-- ============================================
create table public.taste_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.users(id) on delete cascade,
  version int not null default 1,
  category_weights jsonb not null default '{}',
  youtube_categories jsonb not null default '{}',
  spotify_categories jsonb not null default '{}',
  genre_details jsonb not null default '{}',
  audio_signature jsonb,
  taste_vector vector(64),
  diversity_score float not null default 0,
  mainstream_score float not null default 0,
  freshness_score float not null default 0,
  cross_platform_coherence float not null default 0,
  personality_tempo text,
  personality_novelty text,
  personality_identity text,
  personality_compound text,
  description text,
  insights jsonb not null default '[]',
  computed_at timestamptz not null default now()
);

-- For fast similarity search
create index idx_taste_vector on public.taste_profiles
  using ivfflat (taste_vector vector_cosine_ops)
  with (lists = 100);

-- ============================================
-- TASTE SNAPSHOTS (weekly history for timeline)
-- ============================================
create table public.taste_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  category_weights jsonb not null default '{}',
  taste_vector vector(64),
  personality_compound text,
  notable_changes jsonb not null default '{}',
  unique(user_id, snapshot_at)
);

create index idx_snapshots_user on public.taste_snapshots(user_id, snapshot_at desc);

-- ============================================
-- INTERACTIONS (future-proofed for Layer 2+)
-- ============================================
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.users(id) on delete cascade,
  feed_owner_id uuid not null references public.users(id) on delete cascade,
  content_type text not null check (content_type in (
    'youtube_video', 'spotify_track', 'spotify_artist', 'reddit_post'
  )),
  content_id text not null,
  source text not null default 'feed_browse' check (source in (
    'feed_browse', 'blind_spot', 'curator_pick', 'comparison', 'collection'
  )),
  action text not null check (action in (
    'viewed', 'clicked', 'saved', 'skipped', 'subscribed', 'deep_watched'
  )),
  dwell_seconds int,
  created_at timestamptz not null default now()
);

create index idx_interactions_viewer on public.interactions(viewer_id, created_at desc);
create index idx_interactions_owner on public.interactions(feed_owner_id, created_at desc);
create index idx_interactions_content on public.interactions(content_id);

-- ============================================
-- COMPARISONS (cached)
-- ============================================
create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  overall_match float not null,
  youtube_match float,
  spotify_match float,
  shared_channels jsonb not null default '[]',
  shared_artists jsonb not null default '[]',
  unique_to_a jsonb not null default '{}',
  unique_to_b jsonb not null default '{}',
  comparison_insight jsonb,
  computed_at timestamptz not null default now(),
  -- Always store with smaller UUID first to avoid duplicates
  unique(user_a, user_b),
  check (user_a < user_b)
);

-- ============================================
-- COMPARISON INVITES
-- ============================================
create table public.comparison_invites (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default encode(gen_random_bytes(8), 'hex'),
  inviter_id uuid not null references public.users(id) on delete cascade,
  invitee_id uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_invites_code on public.comparison_invites(code);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.users enable row level security;
alter table public.platform_connections enable row level security;
alter table public.youtube_subscriptions enable row level security;
alter table public.youtube_likes enable row level security;
alter table public.spotify_top_artists enable row level security;
alter table public.spotify_top_tracks enable row level security;
alter table public.spotify_saved_tracks enable row level security;
alter table public.taste_profiles enable row level security;
alter table public.taste_snapshots enable row level security;
alter table public.interactions enable row level security;
alter table public.comparisons enable row level security;
alter table public.comparison_invites enable row level security;

-- Users: read own + public profiles
create policy "Users can read own data" on public.users
  for select using (auth.uid() = auth_id);
create policy "Public profiles are readable" on public.users
  for select using (profile_public = true);
create policy "Users can update own data" on public.users
  for update using (auth.uid() = auth_id);

-- Platform connections: own data only
create policy "Own connections only" on public.platform_connections
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));

-- YouTube data: own data only
create policy "Own yt subs" on public.youtube_subscriptions
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Own yt likes" on public.youtube_likes
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));

-- Spotify data: own data only
create policy "Own sp artists" on public.spotify_top_artists
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Own sp tracks" on public.spotify_top_tracks
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Own sp saved" on public.spotify_saved_tracks
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));

-- Taste profiles: own + public
create policy "Own taste profile" on public.taste_profiles
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Public taste profiles" on public.taste_profiles
  for select using (user_id in (select id from public.users where profile_public = true));

-- Taste snapshots: own only
create policy "Own snapshots" on public.taste_snapshots
  for all using (user_id in (select id from public.users where auth_id = auth.uid()));

-- Interactions: own views only
create policy "Own interactions" on public.interactions
  for all using (viewer_id in (select id from public.users where auth_id = auth.uid()));

-- Comparisons: involved parties only
create policy "Own comparisons" on public.comparisons
  for select using (
    user_a in (select id from public.users where auth_id = auth.uid())
    or user_b in (select id from public.users where auth_id = auth.uid())
  );

-- Invites: creator or invitee
create policy "Own invites" on public.comparison_invites
  for all using (
    inviter_id in (select id from public.users where auth_id = auth.uid())
    or invitee_id in (select id from public.users where auth_id = auth.uid())
  );
-- Anyone can read invite by code (for the join flow)
create policy "Read invite by code" on public.comparison_invites
  for select using (true);

-- ============================================
-- SERVICE ROLE BYPASS (for API routes)
-- ============================================
-- API routes use the service role key which bypasses RLS.
-- This is intentional — server-side code handles auth checks.

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();
