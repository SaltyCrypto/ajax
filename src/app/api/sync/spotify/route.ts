import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  fetchTopArtists,
  fetchTopTracks,
  fetchSavedTracks,
  fetchAudioFeatures,
  fetchArtistDetails,
} from '@/lib/oauth/spotify';
import { getBaseUrl } from '@/lib/url';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const appUrl = getBaseUrl(request);

    const supabase = createServiceClient();

    const { data: connection, error: connError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'spotify')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'No Spotify connection found' }, { status: 404 });
    }

    await supabase
      .from('platform_connections')
      .update({ sync_status: 'syncing' })
      .eq('id', connection.id);

    const accessToken = connection.access_token;

    try {
      // --- Fetch top artists across all time ranges ---
      console.log(`[Sync/SP] Fetching top artists for user ${userId}`);
      const timeRanges = ['short_term', 'medium_term', 'long_term'] as const;
      const allArtists = [];

      for (const timeRange of timeRanges) {
        const artists = await fetchTopArtists(accessToken, timeRange);
        const records = artists.map((a, idx) => ({
          user_id: userId,
          artist_id: a.id,
          artist_name: a.name,
          genres: a.genres,
          popularity: a.popularity,
          image_url: a.images?.[0]?.url || null,
          time_range: timeRange,
          rank: idx + 1,
          synced_at: new Date().toISOString(),
        }));
        allArtists.push(...records);
      }

      console.log(`[Sync/SP] Got ${allArtists.length} top artist entries`);

      // Clear existing and insert fresh (time-range data should be replaced, not merged)
      await supabase
        .from('spotify_top_artists')
        .delete()
        .eq('user_id', userId);

      for (let i = 0; i < allArtists.length; i += 100) {
        await supabase
          .from('spotify_top_artists')
          .insert(allArtists.slice(i, i + 100));
      }

      // --- Fetch top tracks across all time ranges ---
      console.log(`[Sync/SP] Fetching top tracks for user ${userId}`);
      const allTracks = [];

      for (const timeRange of timeRanges) {
        const tracks = await fetchTopTracks(accessToken, timeRange);

        // Get audio features for these tracks
        const trackIds = tracks.map(t => t.id);
        const audioFeatures = await fetchAudioFeatures(accessToken, trackIds);
        const audioMap = new Map(audioFeatures.map(f => [f.id, f]));

        const records = tracks.map((t, idx) => {
          const af = audioMap.get(t.id);
          return {
            user_id: userId,
            track_id: t.id,
            track_name: t.name,
            artist_id: t.artists[0]?.id || '',
            artist_name: t.artists[0]?.name || '',
            album_name: t.album?.name || null,
            popularity: t.popularity,
            duration_ms: t.duration_ms,
            energy: af?.energy ?? null,
            valence: af?.valence ?? null,
            danceability: af?.danceability ?? null,
            acousticness: af?.acousticness ?? null,
            instrumentalness: af?.instrumentalness ?? null,
            time_range: timeRange,
            rank: idx + 1,
            synced_at: new Date().toISOString(),
          };
        });
        allTracks.push(...records);
      }

      console.log(`[Sync/SP] Got ${allTracks.length} top track entries`);

      await supabase
        .from('spotify_top_tracks')
        .delete()
        .eq('user_id', userId);

      for (let i = 0; i < allTracks.length; i += 100) {
        await supabase
          .from('spotify_top_tracks')
          .insert(allTracks.slice(i, i + 100));
      }

      // --- Fetch saved tracks ---
      console.log(`[Sync/SP] Fetching saved tracks for user ${userId}`);
      const savedTracks = await fetchSavedTracks(accessToken, 500);

      // Get artist details for genres
      const artistIdSet = new Set(savedTracks.map(s => s.track.artists[0]?.id).filter(Boolean));
      const artistIds = Array.from(artistIdSet);
      const artistDetails = await fetchArtistDetails(accessToken, artistIds);
      const artistGenreMap = new Map(artistDetails.map(a => [a.id, a.genres]));

      const savedRecords = savedTracks.map(s => ({
        user_id: userId,
        track_id: s.track.id,
        track_name: s.track.name,
        artist_id: s.track.artists[0]?.id || '',
        artist_name: s.track.artists[0]?.name || '',
        genres: artistGenreMap.get(s.track.artists[0]?.id || '') || [],
        saved_at: s.added_at,
        synced_at: new Date().toISOString(),
      }));

      console.log(`[Sync/SP] Got ${savedRecords.length} saved tracks`);

      // Upsert saved tracks (these accumulate, don't replace)
      for (let i = 0; i < savedRecords.length; i += 100) {
        await supabase
          .from('spotify_saved_tracks')
          .upsert(savedRecords.slice(i, i + 100), { onConflict: 'user_id,track_id' });
      }

      // Mark complete
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
        topArtists: allArtists.length,
        topTracks: allTracks.length,
        savedTracks: savedRecords.length,
      });
    } catch (syncError) {
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
    console.error('[Sync/SP] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
