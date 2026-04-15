import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Analyze a YouTube homepage screenshot using Claude Vision
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('screenshot') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No screenshot provided' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/png';

    // Call Claude Vision to extract videos from screenshot
    const anthropicKey = process.env.AJAX_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey || anthropicKey.length < 20) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local to enable screenshot analysis.',
      }, { status: 500 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analyze this YouTube homepage screenshot. Extract every video recommendation visible.

IMPORTANT: Category and quality are SEPARATE dimensions. A documentary with a dramatic title is still a documentary, not clickbait. Clickbait means: misleading thumbnail/title designed to bait clicks, not deliver on its promise. ALL CAPS alone doesn't make something clickbait if the content is genuine.

For each video, provide:
- title: the full video title
- channel: the channel name
- category: the CONTENT topic (choose from: comedy, documentary, news, finance, entertainment, gaming, music, education, cooking, tech, sports, lifestyle, beauty, fitness, travel, science, politics, automotive, design, architecture, animation, true crime, podcast, how-to, review, vlog, reaction). Never use "clickbait" as a category — that's a quality signal, not a topic.
- is_clickbait: true/false — ONLY true if the title/thumbnail is genuinely misleading or uses extreme engagement bait (excessive caps, false promises, rage bait). A compelling title on quality content is NOT clickbait.
- is_shorts: true/false — is this a YouTube Short?
- estimated_quality: "high" (educational, well-produced, thoughtful) | "medium" (decent entertainment, informative) | "low" (low-effort, rage bait, misleading)

Also provide:
- algorithm_personality: a provocative 2-3 word label for what YouTube THINKS this person is (make it feel like a horoscope reading — e.g., "Rage Scroller", "Clickbait Magnet", "Passive Consumer", "Chaos Browser", "Late Night Doomscroller", "Algorithm's Pet", "Content Zombie", "Niche Explorer", "Deep Diver", "Taste Architect")
- algorithm_roast: a single punchy sentence ROASTING what this feed says about the viewer. Be witty and slightly mean, like a friend calling you out. (e.g., "YouTube thinks your attention span is shorter than a TikTok and your taste is whatever Mr Beast uploaded today.")
- feed_diversity: "narrow" | "moderate" | "diverse"
- feed_quality_score: 0-100, what percentage of this feed actually serves the viewer's growth vs just keeping them scrolling
- top_categories: the 3-5 dominant CONTENT categories (not quality labels)
- missing_categories: categories notably ABSENT that a well-rounded algorithm should include
- assessment: 2 sentences about what this algorithm reveals about how YouTube models this person

Respond ONLY with JSON (no markdown, no code blocks):
{
  "videos": [...],
  "algorithm_personality": "...",
  "algorithm_roast": "...",
  "feed_diversity": "...",
  "feed_quality_score": 0-100,
  "top_categories": [...],
  "missing_categories": [...],
  "assessment": "..."
}`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Analyze] Claude API error:', err);
      return NextResponse.json({ error: 'Vision analysis failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON from Claude's response
    let analysis;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error('[Analyze] Failed to parse Claude response:', content);
      return NextResponse.json({ error: 'Failed to parse analysis', raw: content }, { status: 500 });
    }

    // Store the feed snapshot if we have a userId
    if (userId) {
      const supabase = createServiceClient();

      // Store as a feed snapshot with source = 'screenshot'
      await supabase.from('feed_snapshots').insert({
        user_id: userId,
        source: 'screenshot',
        platform: 'youtube',
        videos: analysis.videos || [],
        algorithm_personality: analysis.algorithm_personality,
        feed_diversity: analysis.feed_diversity,
        feed_quality_score: analysis.feed_quality_score,
        top_categories: analysis.top_categories,
        missing_categories: analysis.missing_categories,
        assessment: analysis.assessment,
        captured_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      analysis,
      video_count: analysis.videos?.length || 0,
    });
  } catch (err) {
    console.error('[Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
