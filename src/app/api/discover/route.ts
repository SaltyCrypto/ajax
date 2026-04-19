// ============================================
// GET /api/discover
// ============================================
// The Bulletin: 5-7 videos seen by users whose taste is close to the
// requester's, that the requester has NOT already seen in their own
// feed/history captures.
//
// Algorithm (intentionally simple for v1):
//   1. Load the requester's taste_vector.
//   2. Fetch up to 30 other users' latest taste_profile; compute cosine
//      similarity against the requester; keep the top 10 neighbors.
//   3. Pull neighbors' feed_snapshots from the last 7 days (capture_type
//      in ('home', 'subscriptions')). This is what they've been shown.
//   4. Pull the requester's feed_snapshots + history from any time. This
//      is the exclusion set.
//   5. For each candidate video (appearing in at least 1 neighbor, not in
//      exclusion), score = sum(neighbor_similarity * position_weight).
//   6. Diversify: at most 2 videos per channel; mix short/long duration.
//   7. Return top N (default 7) with attribution ("seen by Alex + 3 others").

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { cosineSimilarity } from '@/lib/taste/vector';

const MAX_NEIGHBORS = 10;
const NEIGHBOR_POOL = 30;
const RECENCY_DAYS = 7;
const DEFAULT_LIMIT = 7;

interface VideoCard {
  videoId: string;
  title?: string;
  channel?: string;
  channelUrl?: string;
  thumbnail?: string;
  views?: string;
  age?: string;
  position?: number;
  videoUrl?: string;
}

interface Discovery {
  videoId: string;
  title?: string;
  channel?: string;
  channelUrl?: string;
  thumbnail?: string;
  videoUrl?: string;
  views?: string;
  age?: string;
  score: number;
  seen_by_count: number;
  seen_by_names: string[];
  best_position: number; // lower = surfaced higher in neighbor's feed
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('ajax_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(25, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT));

  const supabase = createServiceClient();

  // --- Load requester's taste vector ---
  const { data: me } = await supabase
    .from('taste_profiles')
    .select('user_id, taste_vector')
    .eq('user_id', userId)
    .maybeSingle();

  if (!me || !me.taste_vector) {
    return NextResponse.json({
      discoveries: [],
      hint: 'Connect YouTube / Spotify and sync first so we can find your neighbors.',
    });
  }

  const myVec = parseVector(me.taste_vector);
  if (!myVec) {
    return NextResponse.json({ discoveries: [], hint: 'Profile has no taste vector yet.' });
  }

  // --- Load a pool of other users' taste vectors ---
  const { data: others } = await supabase
    .from('taste_profiles')
    .select('user_id, taste_vector')
    .neq('user_id', userId)
    .limit(NEIGHBOR_POOL);

  const neighbors = (others || [])
    .map(o => ({ user_id: o.user_id, vec: parseVector(o.taste_vector) }))
    .filter((o): o is { user_id: string; vec: number[] } => o.vec !== null)
    .map(o => ({ ...o, similarity: cosineSimilarity(myVec, o.vec) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_NEIGHBORS);

  if (neighbors.length === 0) {
    return NextResponse.json({
      discoveries: [],
      hint: 'No other users yet. Invite friends so the network forms.',
    });
  }

  // --- Fetch neighbor display names for attribution ---
  const neighborIds = neighbors.map(n => n.user_id);
  const { data: neighborUsers } = await supabase
    .from('users')
    .select('id, display_name, username')
    .in('id', neighborIds);
  const nameByUserId = new Map(
    (neighborUsers || []).map(u => [u.id, u.display_name || `@${u.username}`])
  );

  // --- Load neighbors' recent feed captures ---
  const sinceIso = new Date(Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: neighborSnaps } = await supabase
    .from('feed_snapshots')
    .select('user_id, videos, captured_at, capture_type')
    .in('user_id', neighborIds)
    .gte('captured_at', sinceIso);

  // --- Load the requester's exclusion set (their own feeds + history) ---
  const { data: mineSnaps } = await supabase
    .from('feed_snapshots')
    .select('videos')
    .eq('user_id', userId);

  const excluded = new Set<string>();
  for (const snap of mineSnaps || []) {
    for (const v of (snap.videos as VideoCard[]) || []) {
      if (v.videoId) excluded.add(v.videoId);
    }
  }

  // --- Score candidates ---
  const byId = new Map<string, {
    card: VideoCard;
    totalScore: number;
    seenBy: Set<string>;
    bestPosition: number;
  }>();

  for (const snap of neighborSnaps || []) {
    const neighbor = neighbors.find(n => n.user_id === snap.user_id);
    if (!neighbor) continue;
    const videos = (snap.videos as VideoCard[]) || [];
    videos.forEach(v => {
      if (!v.videoId || excluded.has(v.videoId)) return;
      // position_weight: slot 0 gets full weight, slot 50 gets ~0.1
      const pos = Math.max(0, v.position ?? 0);
      const positionWeight = 1 / (1 + pos / 15);
      const score = neighbor.similarity * positionWeight;

      const entry = byId.get(v.videoId);
      if (entry) {
        entry.totalScore += score;
        entry.seenBy.add(snap.user_id);
        if (pos < entry.bestPosition) entry.bestPosition = pos;
      } else {
        byId.set(v.videoId, {
          card: v,
          totalScore: score,
          seenBy: new Set([snap.user_id]),
          bestPosition: pos,
        });
      }
    });
  }

  // --- Rank + diversify ---
  const ranked = [...byId.values()]
    .map(e => ({
      ...e,
      // Boost videos seen by multiple neighbors (signal > noise)
      finalScore: e.totalScore * Math.pow(e.seenBy.size, 0.7),
    }))
    .sort((a, b) => b.finalScore - a.finalScore);

  // Diversify: cap at 2 per channel
  const perChannel = new Map<string, number>();
  const picked: Discovery[] = [];
  for (const e of ranked) {
    const channel = e.card.channel || 'unknown';
    const count = perChannel.get(channel) || 0;
    if (count >= 2) continue;
    perChannel.set(channel, count + 1);
    picked.push({
      videoId: e.card.videoId,
      title: e.card.title,
      channel: e.card.channel,
      channelUrl: e.card.channelUrl,
      thumbnail: e.card.thumbnail,
      videoUrl: e.card.videoUrl || `https://www.youtube.com/watch?v=${e.card.videoId}`,
      views: e.card.views,
      age: e.card.age,
      score: e.finalScore,
      seen_by_count: e.seenBy.size,
      seen_by_names: [...e.seenBy].map(uid => nameByUserId.get(uid) || 'someone').slice(0, 3),
      best_position: e.bestPosition,
    });
    if (picked.length >= limit) break;
  }

  return NextResponse.json({
    discoveries: picked,
    meta: {
      neighbor_count: neighbors.length,
      candidate_count: byId.size,
      window_days: RECENCY_DAYS,
    },
  });
}

// pgvector returns vectors as strings like "[0.1,0.2,...]"; taste_profiles
// stores JSON.stringify()'d arrays because the schema uses vector() but our
// writer stringifies.
function parseVector(v: unknown): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(Number) : null;
    } catch {
      // pgvector string form "[1,2,3]" is already JSON, but try stripping
      return null;
    }
  }
  return null;
}
