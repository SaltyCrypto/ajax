import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import DnaCard from '@/components/DnaCard';
import ShareButtons from '@/components/ShareButtons';
import type { CardData, TasteInsight } from '@/types';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const userId = cookieStore.get('ajax_user_id')?.value;

  // Derive base URL from request headers so share link always matches the
  // actual deployment URL (not a stale build-time env var).
  const fwdHost = headerStore.get('x-forwarded-host');
  const fwdProto = headerStore.get('x-forwarded-proto');
  const host = headerStore.get('host');
  const appUrl = fwdHost
    ? `${fwdProto || 'https'}://${fwdHost}`
    : host
    ? `https://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!userId) {
    redirect('/');
  }

  const supabase = createServiceClient();

  // Fetch user data
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!user) {
    redirect('/');
  }

  // Fetch platform connections
  const { data: connections } = await supabase
    .from('platform_connections')
    .select('platform, sync_status, last_synced_at')
    .eq('user_id', userId);

  const hasYouTube = connections?.some(c => c.platform === 'youtube');
  const hasSpotify = connections?.some(c => c.platform === 'spotify');
  const ytStatus = connections?.find(c => c.platform === 'youtube')?.sync_status;
  const spStatus = connections?.find(c => c.platform === 'spotify')?.sync_status;

  // Fetch taste profile
  const { data: profile } = await supabase
    .from('taste_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  const isSyncing = ytStatus === 'syncing' || ytStatus === 'pending' ||
                    spStatus === 'syncing' || spStatus === 'pending';

  const hasProfile = !!profile;

  // Build card data if profile exists
  let cardData: CardData | null = null;
  if (profile) {
    const insights: TasteInsight[] = (profile.insights as TasteInsight[]) || [];
    cardData = {
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      personality_compound: profile.personality_compound || 'Analyzing...',
      description: profile.description || 'Your taste DNA is being computed...',
      youtube_categories: (profile.youtube_categories as Record<string, number>) || {},
      spotify_categories: (profile.spotify_categories as Record<string, number>) || {},
      top_insight: insights[0] || null,
      diversity_score: profile.diversity_score || 0,
      mainstream_score: profile.mainstream_score || 0,
      freshness_score: profile.freshness_score || 0,
      theme: 'default',
    };
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-white">Ajax</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href={`/${user.username}`} className="btn-ghost text-sm">
            My Profile
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome message */}
        {params.welcome && (
          <div className="card-glass p-4 mb-8 border-ajax-accent/30">
            <p className="text-ajax-accent text-sm">
              {params.welcome === 'youtube'
                ? '🎬 YouTube connected! Your subscriptions and likes are syncing...'
                : '🎵 Spotify connected! Your music taste is syncing...'}
            </p>
          </div>
        )}

        {/* Error message */}
        {params.error && (
          <div className="card-glass p-4 mb-8 border-red-500/30">
            <p className="text-red-400 text-sm">
              Something went wrong: {params.error}. Please try again.
            </p>
          </div>
        )}

        {/* Platform connections */}
        <section className="mb-12">
          <h2 className="text-xl font-display font-semibold text-white mb-4">Connected Platforms</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* YouTube */}
            <div className={`card-glass p-5 ${hasYouTube ? 'border-red-500/20' : 'border-dashed border-ajax-border'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.5 6.5a3.07 3.07 0 0 0-2.16-2.17C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.34.47A3.07 3.07 0 0 0 .5 6.5 32.15 32.15 0 0 0 0 12a32.15 32.15 0 0 0 .5 5.5 3.07 3.07 0 0 0 2.16 2.17c1.84.47 9.34.47 9.34.47s7.5 0 9.34-.47a3.07 3.07 0 0 0 2.16-2.17A32.15 32.15 0 0 0 24 12a32.15 32.15 0 0 0-.5-5.5z" />
                      <polygon fill="white" points="9.75,15.02 15.5,12 9.75,8.98" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">YouTube</span>
                </div>
                {hasYouTube ? (
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                    {ytStatus === 'complete' ? 'Synced' : 'Syncing...'}
                  </span>
                ) : (
                  <Link href="/api/auth/youtube" className="text-xs text-ajax-accent hover:text-ajax-accent-light">
                    Connect
                  </Link>
                )}
              </div>
              <p className="text-ajax-text-dim text-sm">
                {hasYouTube ? 'Subscriptions and liked videos' : 'Connect to read your subscriptions and likes'}
              </p>
            </div>

            {/* Spotify */}
            <div className={`card-glass p-5 ${hasSpotify ? 'border-green-500/20' : 'border-dashed border-ajax-border'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Spotify</span>
                </div>
                {hasSpotify ? (
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                    {spStatus === 'complete' ? 'Synced' : 'Syncing...'}
                  </span>
                ) : (
                  <Link
                    href={`/api/auth/spotify?userId=${userId}`}
                    className="text-xs text-ajax-accent hover:text-ajax-accent-light"
                  >
                    Connect
                  </Link>
                )}
              </div>
              <p className="text-ajax-text-dim text-sm">
                {hasSpotify ? 'Top artists, tracks, and saved library' : 'Connect for the full cross-platform picture'}
              </p>
            </div>
          </div>

          {!hasSpotify && hasYouTube && (
            <div className="mt-4 card-glass p-4 border-ajax-accent/20">
              <p className="text-sm text-ajax-text-dim">
                <span className="text-ajax-accent font-medium">Unlock your full Taste DNA.</span>{' '}
                Your YouTube data gives us half the picture. Connect Spotify to discover
                cross-platform contradictions, audio mood analysis, and a richer personality profile.
              </p>
            </div>
          )}
        </section>

        {/* DNA Card */}
        {isSyncing && !hasProfile && (
          <section className="mb-12">
            <div className="card-glass p-12 text-center">
              <div className="animate-pulse-slow text-4xl mb-4">🧬</div>
              <h2 className="text-xl font-display font-semibold text-white mb-2">
                Reading your algorithms...
              </h2>
              <p className="text-ajax-text-dim">
                Analyzing your subscriptions, likes, and listening history.
                This takes about 30 seconds.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-ajax-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-ajax-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-ajax-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </section>
        )}

        {/* Feed-sharing loop entry points */}
        <section className="mb-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/discover"
            className="card-glass p-5 hover:border-ajax-accent/40 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-medium">The Bulletin</span>
              <span className="text-ajax-accent opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </div>
            <p className="text-xs text-ajax-text-dim leading-relaxed">
              7 things your taste neighbors saw today that you haven't.
            </p>
          </Link>
          <Link
            href="/capture"
            className="card-glass p-5 hover:border-ajax-accent/40 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-medium">Capture feeds</span>
              <span className="text-ajax-accent opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </div>
            <p className="text-xs text-ajax-text-dim leading-relaxed">
              Install the bookmarklet. Snapshot what YouTube shows you, home or
              history.
            </p>
          </Link>
        </section>

        {cardData && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-white">Your Taste DNA</h2>
              <span className="text-xs text-ajax-text-dim">
                Updated {new Date(profile?.computed_at).toLocaleDateString()}
              </span>
            </div>

            <div className="max-w-lg mx-auto mb-8">
              <DnaCard data={cardData} />
            </div>

            <ShareButtons username={user.username} />

            {/* All insights */}
            {profile?.insights && (profile.insights as TasteInsight[]).length > 1 && (
              <div className="mt-12">
                <h3 className="text-lg font-display font-semibold text-white mb-4">All Insights</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(profile.insights as TasteInsight[]).map((insight: TasteInsight, i: number) => (
                    <div key={i} className="card-glass p-5">
                      <div className="text-xs text-ajax-accent font-medium mb-1 uppercase tracking-wider">
                        {insight.title}
                      </div>
                      <p className="text-ajax-text text-sm leading-relaxed">
                        {insight.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Compare CTA */}
        {hasProfile && (
          <section className="mb-12">
            <div className="card-glass p-8 text-center glow-accent">
              <h2 className="text-2xl font-display font-bold text-white mb-2">
                Compare your taste
              </h2>
              <p className="text-ajax-text-dim mb-6">
                Send this link to a friend. When they sign in, you&apos;ll both see how your taste DNA compares.
              </p>
              <div className="flex items-center justify-center gap-3">
                <code className="bg-ajax-bg px-4 py-2 rounded-lg text-ajax-accent text-sm font-mono">
                  {appUrl}/{user.username}
                </code>
                <button className="btn-secondary text-sm">
                  Copy
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
