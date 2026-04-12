import { NextResponse } from 'next/server';
import { computeTasteProfile } from '@/lib/taste/engine';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    console.log(`[Taste] Computing profile for user ${userId}`);
    const profile = await computeTasteProfile(userId);
    console.log(`[Taste] Profile computed: ${profile.personality_compound}`);

    return NextResponse.json({
      success: true,
      personality: profile.personality_compound,
      description: profile.description,
      insights_count: profile.insights.length,
      diversity: profile.diversity_score,
      mainstream: profile.mainstream_score,
    });
  } catch (err) {
    console.error('[Taste] Compute error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Computation failed' },
      { status: 500 }
    );
  }
}
