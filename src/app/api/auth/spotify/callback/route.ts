import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeSpotifyCode, getSpotifyProfile } from '@/lib/oauth/spotify';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=spotify_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=spotify_missing_params`);
  }

  // Validate state
  const cookieStore = await cookies();
  const savedState = cookieStore.get('spotify_oauth_state')?.value;
  if (state !== savedState) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=spotify_invalid_state`);
  }
  cookieStore.delete('spotify_oauth_state');

  try {
    const tokens = await exchangeSpotifyCode(code);
    const spotifyUser = await getSpotifyProfile(tokens.access_token);
    const supabase = createServiceClient();

    // Get user ID from cookie (they should already be signed in via YouTube)
    let userId = cookieStore.get('ajax_user_id')?.value;

    // Parse state for userId fallback
    if (!userId) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        userId = stateData.userId;
      } catch {
        // No user ID available
      }
    }

    if (!userId) {
      // User connecting Spotify without YouTube first
      // Check if they have an existing connection
      const { data: existing } = await supabase
        .from('platform_connections')
        .select('user_id')
        .eq('platform', 'spotify')
        .eq('platform_user_id', spotifyUser.id)
        .single();

      if (existing) {
        userId = existing.user_id;
      } else {
        return NextResponse.redirect(`${appUrl}/?error=spotify_no_user`);
      }
    }

    // Upsert platform connection
    await supabase.from('platform_connections').upsert({
      user_id: userId,
      platform: 'spotify',
      platform_user_id: spotifyUser.id,
      platform_display_name: spotifyUser.display_name,
      platform_avatar_url: spotifyUser.images?.[0]?.url || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: ['user-top-read', 'user-library-read', 'user-read-recently-played', 'playlist-read-private'],
      sync_status: 'pending',
    }, {
      onConflict: 'user_id,platform',
    });

    // Update cookie
    cookieStore.set('ajax_user_id', userId!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    // Trigger async sync
    fetch(`${appUrl}/api/sync/spotify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});

    return NextResponse.redirect(`${appUrl}/dashboard?welcome=spotify`);
  } catch (err) {
    console.error('Spotify callback error:', err);
    return NextResponse.redirect(`${appUrl}/dashboard?error=spotify_callback_failed`);
  }
}
