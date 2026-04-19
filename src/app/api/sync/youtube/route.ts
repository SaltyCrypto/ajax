import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  fetchAllSubscriptions,
  fetchLikedVideos,
  fetchChannelDetails,
  parseDuration,
} from '@/lib/oauth/youtube';
import { getBaseUrl } from '@/lib/url';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const appUrl = getBaseUrl(request);

    const supabase = createServiceClient();

    // Get YouTube connection
    const { data: connection, error: connError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'No YouTube connection found' }, { status: 404 });
    }

    // Mark as syncing
    await supabase
      .from('platform_connections')
      .update({ sync_status: 'syncing' })
      .eq('id', connection.id);

    const accessToken = connection.access_token;

    try {
      // --- Fetch subscriptions ---
      console.log(`[Sync/YT] Fetching subscriptions for user ${userId}`);
      const subs = await fetchAllSubscriptions(accessToken);
      console.log(`[Sync/YT] Got ${subs.length} subscriptions`);

      // Get channel details for topic categories
      const channelIds = subs.map(s => s.snippet.resourceId.channelId);
      const channelDetails = await fetchChannelDetails(accessToken, channelIds);
      const channelMap = new Map(channelDetails.map(c => [c.id, c]));

      // Upsert subscriptions
      const subRecords = subs.map(s => {
        const details = channelMap.get(s.snippet.resourceId.channelId);
        return {
          user_id: userId,
          channel_id: s.snippet.resourceId.channelId,
          channel_title: s.snippet.title,
          channel_description: s.snippet.description?.slice(0, 500) || null,
          channel_thumbnail: s.snippet.thumbnails?.default?.url || null,
          subscriber_count: details?.statistics?.subscriberCount
            ? parseInt(details.statistics.subscriberCount)
            : null,
          topic_categories: details?.topicDetails?.topicCategories || [],
          subscribed_at: s.snippet.publishedAt,
          synced_at: new Date().toISOString(),
        };
      });

      // Batch upsert in chunks of 100
      for (let i = 0; i < subRecords.length; i += 100) {
        const batch = subRecords.slice(i, i + 100);
        await supabase
          .from('youtube_subscriptions')
          .upsert(batch, { onConflict: 'user_id,channel_id' });
      }

      // --- Fetch liked videos ---
      console.log(`[Sync/YT] Fetching liked videos for user ${userId}`);
      const likes = await fetchLikedVideos(accessToken, 500);
      console.log(`[Sync/YT] Got ${likes.length} liked videos`);

      const likeRecords = likes.map(v => ({
        user_id: userId,
        video_id: v.id,
        title: v.snippet.title,
        channel_id: v.snippet.channelId,
        channel_title: v.snippet.channelTitle,
        category_id: v.snippet.categoryId || null,
        tags: v.snippet.tags?.slice(0, 20) || [],
        duration_seconds: v.contentDetails?.duration
          ? parseDuration(v.contentDetails.duration)
          : null,
        published_at: v.snippet.publishedAt,
        synced_at: new Date().toISOString(),
      }));

      for (let i = 0; i < likeRecords.length; i += 100) {
        const batch = likeRecords.slice(i, i + 100);
        await supabase
          .from('youtube_likes')
          .upsert(batch, { onConflict: 'user_id,video_id' });
      }

      // Mark sync complete
      await supabase
        .from('platform_connections')
        .update({
          sync_status: 'complete',
          last_synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('id', connection.id);

      // Trigger taste computation (baseUrl already request-derived above)
      fetch(`${appUrl}/api/taste/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        subscriptions: subRecords.length,
        likes: likeRecords.length,
      });
    } catch (syncError) {
      // Mark sync as errored
      await supabase
        .from('platform_connections')
        .update({
          sync_status: 'error',
          sync_error: syncError instanceof Error ? syncError.message : 'Unknown error',
        })
        .eq('id', connection.id);

      throw syncError;
    }
  } catch (err) {
    console.error('[Sync/YT] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
