// ============================================
// POST /api/feed/ingest
// ============================================
// Accepts scraped YouTube feed data from the bookmarklet (or any future
// capture tool). Authed by the ajax_user_id cookie — the bookmarklet runs
// in the user's browser so cookies for ajax-yt6q.onrender.com are
// available when they've used `credentials: 'include'`.
//
// Payload shape:
// {
//   source: 'bookmarklet' | 'extension' | ...,
//   platform: 'youtube',
//   page: '/', '/feed/history', '/feed/subscriptions', '/results?...',
//   videos: [{ videoId, title, channel, channelUrl, thumbnail, views, age, position }]
// }
//
// The server infers capture_type from `page`:
//   /                    -> home
//   /feed/history        -> history
//   /feed/subscriptions  -> subscriptions
//   /feed/trending       -> trending
//   /feed/library        -> library
//   /results             -> search
//   /@channel/videos     -> channel
//   other                -> other

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

type CaptureType =
  | 'home'
  | 'history'
  | 'subscriptions'
  | 'trending'
  | 'library'
  | 'search'
  | 'channel'
  | 'other';

function inferCaptureType(page: string | undefined): CaptureType {
  if (!page) return 'home';
  const p = page.toLowerCase();
  if (p === '/' || p === '') return 'home';
  if (p.startsWith('/feed/history')) return 'history';
  if (p.startsWith('/feed/subscriptions')) return 'subscriptions';
  if (p.startsWith('/feed/trending')) return 'trending';
  if (p.startsWith('/feed/library') || p.startsWith('/feed/you')) return 'library';
  if (p.startsWith('/results')) return 'search';
  if (p.startsWith('/@') || p.startsWith('/channel/') || p.startsWith('/c/')) return 'channel';
  return 'other';
}

// CORS preflight so the bookmarklet running on youtube.com can POST here
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://www.youtube.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://www.youtube.com',
    'Access-Control-Allow-Credentials': 'true',
  };

  let body: {
    source?: string;
    platform?: string;
    page?: string;
    videos?: unknown[];
    token?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: corsHeaders });
  }

  // Auth: prefer capture_token in payload (works cross-site from youtube.com);
  // fall back to ajax_user_id cookie (works when called from ajax-yt6q.onrender.com itself)
  const supabase = createServiceClient();
  let userId: string | undefined;
  if (body.token) {
    const { data: u } = await supabase
      .from('users')
      .select('id')
      .eq('capture_token', body.token)
      .maybeSingle();
    if (u?.id) userId = u.id;
  }
  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get('ajax_user_id')?.value;
  }
  if (!userId) {
    return NextResponse.json(
      { error: 'not_signed_in', hint: 'Your bookmarklet token is missing or expired. Reinstall from https://ajax-yt6q.onrender.com/capture' },
      { status: 401, headers: corsHeaders }
    );
  }

  const videos = Array.isArray(body.videos) ? body.videos : [];
  if (videos.length === 0) {
    return NextResponse.json(
      { error: 'no_videos', hint: 'Scroll the page first so cards render, then click the bookmarklet' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Cap to prevent pathological payloads (100 items/scroll × ~10 scrolls = 1000 ceiling)
  const capped = videos.slice(0, 1000);
  const source = body.source === 'bookmarklet' ? 'bookmarklet' : 'bookmarklet';
  const platform = body.platform === 'spotify' ? 'spotify' : 'youtube';
  const captureType = inferCaptureType(body.page);

  const { data, error } = await supabase
    .from('feed_snapshots')
    .insert({
      user_id: userId,
      source,
      platform,
      capture_type: captureType,
      videos: capped,
      captured_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    // Graceful degrade: if capture_type column doesn't exist yet (migration 004
    // not applied), retry without it.
    if (/capture_type/i.test(error.message)) {
      const { data: d2, error: e2 } = await supabase
        .from('feed_snapshots')
        .insert({
          user_id: userId,
          source,
          platform,
          videos: capped,
          captured_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (e2) {
        console.error('[feed/ingest] insert failed (v1 fallback):', e2);
        return NextResponse.json({ error: 'db_error', detail: e2.message }, { status: 500, headers: corsHeaders });
      }
      return NextResponse.json({ id: d2.id, count: capped.length, captureType, note: 'stored without capture_type — apply migration 004' }, { headers: corsHeaders });
    }
    console.error('[feed/ingest] insert failed:', error);
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ id: data.id, count: capped.length, captureType }, { headers: corsHeaders });
}
