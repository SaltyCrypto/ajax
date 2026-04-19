// ============================================
// /discover — The Bulletin
// ============================================
// Server-rendered list of 7 items surfaced by the user's taste neighbors
// that the user has not already seen. Styled intentionally like a short
// daily newsletter so this doesn't become yet another infinite feed.

import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { cosineSimilarity } from '@/lib/taste/vector';

export const dynamic = 'force-dynamic';

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
  best_position: number;
}

// Re-implemented server-side to avoid a self-fetch; same logic as
// /api/discover but runs in-process.
async function computeDiscoveries(userId: string): Promise<{ discoveries: Discovery[]; meta: Record<string, number | string> }> {
  const supabase = createServiceClient();

  const { data: me } = await supabase
    .from('taste_profiles')
    .select('taste_vector')
    .eq('user_id', userId)
    .maybeSingle();
  if (!me?.taste_vector) return { discoveries: [], meta: { note: 'no_profile' } };

  const myVec = parseVector(me.taste_vector);
  if (!myVec) return { discoveries: [], meta: { note: 'no_vector' } };

  const { data: others } = await supabase
    .from('taste_profiles')
    .select('user_id, taste_vector')
    .neq('user_id', userId)
    .limit(30);

  const neighbors = (others || [])
    .map(o => ({ user_id: o.user_id, vec: parseVector(o.taste_vector) }))
    .filter((o): o is { user_id: string; vec: number[] } => o.vec !== null)
    .map(o => ({ ...o, similarity: cosineSimilarity(myVec, o.vec) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  if (neighbors.length === 0) return { discoveries: [], meta: { note: 'no_neighbors' } };

  const neighborIds = neighbors.map(n => n.user_id);
  const { data: neighborUsers } = await supabase
    .from('users')
    .select('id, display_name, username')
    .in('id', neighborIds);
  const nameByUserId = new Map(
    (neighborUsers || []).map(u => [u.id, u.display_name || `@${u.username}`])
  );

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: neighborSnaps } = await supabase
    .from('feed_snapshots')
    .select('user_id, videos, captured_at, capture_type')
    .in('user_id', neighborIds)
    .gte('captured_at', sinceIso);

  const { data: mineSnaps } = await supabase
    .from('feed_snapshots')
    .select('videos')
    .eq('user_id', userId);

  const excluded = new Set<string>();
  for (const snap of mineSnaps || []) {
    for (const v of (snap.videos as Discovery[]) || []) {
      if (v.videoId) excluded.add(v.videoId);
    }
  }

  const byId = new Map<string, {
    card: Discovery;
    totalScore: number;
    seenBy: Set<string>;
    bestPosition: number;
  }>();

  for (const snap of neighborSnaps || []) {
    const neighbor = neighbors.find(n => n.user_id === snap.user_id);
    if (!neighbor) continue;
    const videos = (snap.videos as Discovery[]) || [];
    videos.forEach(v => {
      if (!v.videoId || excluded.has(v.videoId)) return;
      const pos = Math.max(0, v.best_position ?? (v as Discovery & { position?: number }).position ?? 0);
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

  const ranked = [...byId.values()]
    .map(e => ({ ...e, finalScore: e.totalScore * Math.pow(e.seenBy.size, 0.7) }))
    .sort((a, b) => b.finalScore - a.finalScore);

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
    if (picked.length >= 7) break;
  }

  return {
    discoveries: picked,
    meta: {
      neighbor_count: neighbors.length,
      candidate_count: byId.size,
    },
  };
}

function parseVector(v: unknown): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(Number) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function attribution(names: string[], total: number) {
  if (total === 0) return '';
  if (total === 1) return `seen by ${names[0]}`;
  if (total === 2) return `seen by ${names[0]} and ${names[1]}`;
  return `seen by ${names[0]}, ${names[1]}, and ${total - 2} other${total - 2 === 1 ? '' : 's'}`;
}

export default async function DiscoverPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('ajax_user_id')?.value;
  if (!userId) redirect('/');

  const { discoveries, meta } = await computeDiscoveries(userId);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="mb-10 flex items-baseline justify-between">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-white">
            ajax
          </Link>
          <span className="text-xs text-zinc-500">{today}</span>
        </div>

        <h1 className="text-2xl font-medium mb-2">The Bulletin</h1>
        <p className="text-sm text-zinc-400 mb-12">
          {discoveries.length === 0
            ? "Today's bulletin is empty."
            : `${discoveries.length} thing${discoveries.length === 1 ? '' : 's'} your taste neighbors saw that you haven't.`}
        </p>

        {discoveries.length === 0 && (
          <div className="text-sm text-zinc-500 space-y-4 leading-relaxed">
            <p>A bulletin appears when:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>You've connected YouTube and synced at least once.</li>
              <li>Other users of Ajax have captured their YouTube feeds recently.</li>
              <li>Their feeds contain videos yours doesn't.</li>
            </ol>
            <p>
              <Link href="/capture" className="text-ajax-accent underline">
                Install the capture bookmarklet
              </Link>{' '}
              and share it with a friend who's signed up. The network forms as people capture.
            </p>
            {meta.note && <p className="text-xs text-zinc-600 pt-4">diagnostic: {String(meta.note)}</p>}
          </div>
        )}

        <ol className="space-y-10">
          {discoveries.map((d, i) => (
            <li key={d.videoId} className="border-b border-zinc-900 pb-8 last:border-b-0">
              <div className="flex gap-4">
                <span className="text-xs text-zinc-600 font-mono pt-1 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={d.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[15px] leading-snug text-white hover:text-ajax-accent transition-colors"
                  >
                    {d.title || '(untitled)'}
                  </a>
                  <div className="mt-1 text-xs text-zinc-500">
                    {d.channel}
                    {d.views && <span className="text-zinc-700"> · {d.views}</span>}
                    {d.age && <span className="text-zinc-700"> · {d.age}</span>}
                  </div>
                  <div className="mt-3 text-xs text-zinc-600">
                    {attribution(d.seen_by_names, d.seen_by_count)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {discoveries.length > 0 && (
          <div className="mt-12 pt-6 border-t border-zinc-900 text-xs text-zinc-600 leading-relaxed">
            That's all for today. {meta.neighbor_count} taste neighbors considered,{' '}
            {meta.candidate_count} candidates filtered. Come back tomorrow.
          </div>
        )}
      </div>
    </main>
  );
}
