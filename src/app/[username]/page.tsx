import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import DnaCard from '@/components/DnaCard';
import type { CardData, TasteInsight } from '@/types';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('users')
    .select('display_name, username')
    .eq('username', username)
    .eq('profile_public', true)
    .single();

  if (!user) return { title: 'Ajax — Profile Not Found' };

  const { data: profile } = await supabase
    .from('taste_profiles')
    .select('personality_compound, description')
    .eq('user_id', user.username) // We'll need a join or separate query
    .single();

  return {
    title: `${user.display_name}'s Taste DNA — Ajax`,
    description: profile?.description || `See ${user.display_name}'s cross-platform taste identity on Ajax.`,
    openGraph: {
      title: `${user.display_name}'s Taste DNA`,
      description: profile?.description || 'YouTube Astrology — your algorithms reveal who you really are.',
      // TODO: Dynamic OG image from /api/card/[username]
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = createServiceClient();

  // Fetch user
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('profile_public', true)
    .single();

  if (!user) notFound();

  // Fetch taste profile
  const { data: profile } = await supabase
    .from('taste_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card-glass p-12 text-center max-w-md">
          <div className="text-4xl mb-4">🧬</div>
          <h1 className="text-xl font-display font-semibold text-white mb-2">
            {user.display_name}&apos;s Taste DNA is being computed
          </h1>
          <p className="text-ajax-text-dim mb-6">
            Check back in a moment. In the meantime...
          </p>
          <Link href="/api/auth/youtube" className="btn-primary">
            Discover YOUR Taste DNA
          </Link>
        </div>
      </main>
    );
  }

  const insights: TasteInsight[] = (profile.insights as TasteInsight[]) || [];

  const cardData: CardData = {
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    personality_compound: profile.personality_compound || '',
    description: profile.description || '',
    youtube_categories: (profile.youtube_categories as Record<string, number>) || {},
    spotify_categories: (profile.spotify_categories as Record<string, number>) || {},
    top_insight: insights[0] || null,
    diversity_score: profile.diversity_score || 0,
    mainstream_score: profile.mainstream_score || 0,
    freshness_score: profile.freshness_score || 0,
    theme: 'default',
  };

  return (
    <main className="min-h-screen">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-ajax-accent/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-ajax-cool/10 rounded-full blur-[128px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-white">Ajax</span>
        </Link>
        <Link href="/api/auth/youtube" className="btn-primary text-sm">
          Get YOUR Taste DNA
        </Link>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        {/* Card */}
        <div className="mb-8">
          <DnaCard data={cardData} />
        </div>

        {/* CTA for visitors */}
        <div className="card-glass p-6 text-center mb-8">
          <h2 className="text-lg font-display font-semibold text-white mb-2">
            What&apos;s YOUR Taste DNA?
          </h2>
          <p className="text-ajax-text-dim text-sm mb-4">
            Connect your YouTube and Spotify to discover your cross-platform taste identity.
          </p>
          <Link href="/api/auth/youtube" className="btn-primary">
            Discover now
          </Link>
        </div>

        {/* Additional insights */}
        {insights.length > 1 && (
          <div>
            <h3 className="text-lg font-display font-semibold text-white mb-4">More Insights</h3>
            <div className="space-y-3">
              {insights.slice(1).map((insight, i) => (
                <div key={i} className="card-glass p-4">
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
      </div>
    </main>
  );
}
