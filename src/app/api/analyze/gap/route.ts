import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeGap } from '@/lib/taste/gap';

// Compute the gap between algorithm output (screenshot) and real taste (profile)
export async function POST(request: Request) {
  try {
    const { screenshotAnalysis, userId, manualTopics } = await request.json();

    if (!screenshotAnalysis) {
      return NextResponse.json({ error: 'Missing screenshot analysis' }, { status: 400 });
    }

    // Try to fetch the user's real taste profile if they have one
    let realProfile = null;
    if (userId) {
      const supabase = createServiceClient();
      const { data: profile } = await supabase
        .from('taste_profiles')
        .select('category_weights, youtube_categories, spotify_categories, genre_details')
        .eq('user_id', userId)
        .single();

      if (profile) {
        realProfile = {
          category_weights: profile.category_weights as Record<string, number>,
          youtube_categories: profile.youtube_categories as Record<string, number>,
          spotify_categories: profile.spotify_categories as Record<string, number>,
          top_genres: Object.keys(profile.genre_details as Record<string, number> || {}).slice(0, 10),
        };
      }
    }

    // Manual topics as fallback if no OAuth profile
    const manualInput = manualTopics?.length > 0
      ? { selected_topics: manualTopics }
      : null;

    const gap = computeGap({
      screenshot: screenshotAnalysis,
      realProfile,
      manualInput,
    });

    return NextResponse.json({ success: true, gap });
  } catch (err) {
    console.error('[Gap] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gap analysis failed' },
      { status: 500 }
    );
  }
}
