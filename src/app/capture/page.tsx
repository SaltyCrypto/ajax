// ============================================
// /capture — Bookmarklet installer
// ============================================
// Server-renders a per-user bookmarklet that scrapes the current YouTube
// page's video cards and POSTs them to /api/feed/ingest. Each user's
// bookmarklet contains their personal capture_token so it authenticates
// even when run cross-origin from youtube.com (where SameSite=Lax cookies
// are not forwarded).

import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Build the bookmarklet source. All whitespace/newlines in the IIFE body get
 * collapsed when we join as a single-line javascript: URL. The token and
 * endpoint are inlined so the resulting string is fully self-contained.
 */
function buildBookmarkletSource(endpoint: string, token: string): string {
  // NOTE: keep this function pure JS (no template-string backticks to escape);
  // we template in the literal values for endpoint + token as JSON strings.
  const body = `(async()=>{
    const ENDPOINT=${JSON.stringify(endpoint)};
    const TOKEN=${JSON.stringify(token)};
    const STEPS=10, PX=2500, SETTLE=800;
    const seen=new Map();
    const badge=document.createElement('div');
    badge.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;padding:10px 14px;background:#111;color:#fff;font:13px -apple-system,system-ui,sans-serif;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.4);pointer-events:none;';
    document.body.appendChild(badge);
    const log=(m)=>{badge.textContent=m;};
    const capture=()=>{
      const cards=document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer');
      let added=0;
      cards.forEach((el)=>{
        const a=el.querySelector('a#video-title-link, a#thumbnail, a#video-title');
        if(!a||!a.href) return;
        let id=null;
        try{id=new URL(a.href,location.origin).searchParams.get('v');}catch(e){}
        if(!id||seen.has(id)) return;
        const t=el.querySelector('#video-title, yt-formatted-string#video-title');
        const c=el.querySelector('ytd-channel-name a, #channel-name a, #text-container a');
        const thumb=el.querySelector('img');
        const meta=el.querySelectorAll('#metadata-line span');
        seen.set(id,{
          position:seen.size,
          videoId:id,
          videoUrl:a.href,
          title:t?t.textContent.trim():'',
          channel:c?c.textContent.trim():'',
          channelUrl:c?c.href:'',
          thumbnail:thumb?thumb.src:'',
          views:meta[0]?meta[0].textContent.trim():'',
          age:meta[1]?meta[1].textContent.trim():'',
        });
        added++;
      });
      return added;
    };
    for(let s=0;s<STEPS;s++){
      const added=capture();
      log('Scrolling '+(s+1)+'/'+STEPS+' \u00b7 '+seen.size+' videos (+'+added+')');
      window.scrollBy({top:PX,behavior:'smooth'});
      await new Promise(r=>setTimeout(r,SETTLE));
    }
    capture();
    log('Sending '+seen.size+' videos...');
    try{
      const res=await fetch(ENDPOINT,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          source:'bookmarklet',
          platform:'youtube',
          page:location.pathname+location.search,
          videos:[...seen.values()],
          token:TOKEN,
        }),
      });
      const j=await res.json().catch(()=>({}));
      if(res.ok){log('✓ Sent '+(j.count||seen.size)+' videos ('+j.captureType+')');}
      else{log('\u2717 '+res.status+': '+(j.hint||j.error||'error'));}
    }catch(e){log('Error: '+e.message);}
    setTimeout(()=>badge.remove(),5000);
  })();`;
  // Collapse repeated whitespace for a cleaner bookmarklet URL (still valid JS)
  const compact = body.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURIComponent(compact)}`;
}

/**
 * Ensure the current user has a capture_token. Generates one lazily if the
 * 004 backfill hasn't run, or if this user predates the migration.
 */
async function ensureCaptureToken(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('users')
    .select('capture_token')
    .eq('id', userId)
    .maybeSingle();

  if (existing?.capture_token) return existing.capture_token;

  // Generate a 48-hex-char token client-side (Node's crypto is available)
  const { randomBytes } = await import('crypto');
  const token = randomBytes(24).toString('hex');

  const { error } = await supabase
    .from('users')
    .update({ capture_token: token })
    .eq('id', userId);

  if (error) {
    // column may not exist yet (migration 004 not applied)
    console.warn('[capture] could not persist token:', error.message);
    return null;
  }
  return token;
}

export default async function CapturePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('ajax_user_id')?.value;
  if (!userId) redirect('/');

  // Derive the base URL from request headers so the bookmarklet always posts
  // to the correct origin (works for preview URLs, custom domains, and
  // localhost without relying on NEXT_PUBLIC_APP_URL).
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'ajax-yt6q.onrender.com';
  const proto = h.get('x-forwarded-proto') || 'https';
  const appUrl = `${proto}://${host}`;
  const endpoint = `${appUrl}/api/feed/ingest`;
  const token = await ensureCaptureToken(userId);

  const bookmarklet = token
    ? buildBookmarkletSource(endpoint, token)
    : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-10 flex items-baseline justify-between">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-white">
            ajax
          </Link>
          <Link href="/discover" className="text-xs text-zinc-500 hover:text-white">
            the bulletin →
          </Link>
        </div>

        <h1 className="text-2xl font-medium mb-3">Capture your YouTube feed</h1>
        <p className="text-sm text-zinc-400 mb-12 max-w-prose leading-relaxed">
          Drag the button below to your bookmarks bar. Click it on any YouTube
          page — home feed, subscriptions, or your watch history — and it will
          scroll through, scrape what you're seeing, and send it to Ajax so it
          can show up in other people's bulletins.
        </p>

        {bookmarklet ? (
          <>
            <div className="mb-10 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href={bookmarklet}
                className="inline-block px-6 py-3 rounded-lg bg-ajax-accent text-white font-medium text-sm hover:bg-ajax-accent-light transition-colors cursor-grab active:cursor-grabbing"
                onClick={(e) => e.preventDefault()}
              >
                ↓ Capture my YouTube feed
              </a>
            </div>

            <div className="text-xs text-zinc-500 text-center mb-16">
              Drag the button to your bookmarks bar. Don't click it here — it
              only works on youtube.com pages.
            </div>
          </>
        ) : (
          <div className="mb-16 p-6 rounded-lg border border-yellow-900/50 bg-yellow-950/20 text-yellow-200 text-sm">
            <strong className="block mb-1">Bookmarklet unavailable.</strong>
            Migration 004 has not been applied to the database yet —
            <code className="mx-1">capture_token</code> column is missing. Apply
            <code className="mx-1">supabase/migrations/004_feed_ingest.sql</code>
            and refresh this page.
          </div>
        )}

        <section className="space-y-8 text-sm text-zinc-400 leading-relaxed">
          <div>
            <h2 className="text-white text-base font-medium mb-2">How to install</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Make your bookmarks bar visible (<code>⌘⇧B</code> on Mac,{' '}
                <code>Ctrl+Shift+B</code> on Windows/Linux).
              </li>
              <li>Drag the purple button above onto your bookmarks bar.</li>
              <li>
                Go to <code>youtube.com</code>. Scroll a bit so the page finishes
                loading.
              </li>
              <li>Click the bookmark. A badge appears in the top-right showing progress.</li>
              <li>
                When it says <em>✓ Sent N videos</em>, the capture is done.
              </li>
            </ol>
          </div>

          <div>
            <h2 className="text-white text-base font-medium mb-2">Where to click it</h2>
            <p className="mb-3">
              Different pages give different signals. Run it on whichever you care
              about:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong className="text-white">Home</strong>{' '}
                (<code>youtube.com/</code>) — what the algorithm is feeding you
              </li>
              <li>
                <strong className="text-white">History</strong>{' '}
                (<code>youtube.com/feed/history</code>) — what you actually
                watched
              </li>
              <li>
                <strong className="text-white">Subscriptions</strong>{' '}
                (<code>youtube.com/feed/subscriptions</code>) — chronological
                feed from your subs
              </li>
              <li>
                <strong className="text-white">Trending</strong>{' '}
                (<code>youtube.com/feed/trending</code>) — what's everywhere right
                now
              </li>
              <li>
                <strong className="text-white">Search results</strong> — what the
                algo surfaces for a query
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white text-base font-medium mb-2">Privacy</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Only runs when <em>you</em> click the bookmark. Nothing passive,
                nothing in the background.
              </li>
              <li>
                Only captures video metadata that's already rendered on the page
                — same stuff you can see.
              </li>
              <li>
                The bookmarklet includes a token unique to your account. Don't
                share it; if it leaks, reinstall from this page to rotate.
              </li>
              <li>
                Captured data is stored in your <code>feed_snapshots</code> rows,
                protected by row-level security. Only you and the discovery
                ranking system read it.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white text-base font-medium mb-2">Troubleshooting</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong className="text-white">"Sent 0 videos"</strong> — the page
                hadn't finished loading cards. Scroll a few times first, then
                click the bookmarklet.
              </li>
              <li>
                <strong className="text-white">"not_signed_in"</strong> — reinstall
                the bookmarklet from this page. Your token may have rotated.
              </li>
              <li>
                <strong className="text-white">Nothing happens</strong> — the
                browser may have blocked the <code>javascript:</code> URL. Try
                Firefox or a different Chromium-based browser.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
