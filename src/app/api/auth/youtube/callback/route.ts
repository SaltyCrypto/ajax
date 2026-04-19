import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeYouTubeCode, getGoogleUserInfo } from '@/lib/oauth/youtube';
import { createServiceClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = getBaseUrl(request);

  if (error) {
    return NextResponse.redirect(`${appUrl}/?error=youtube_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?error=youtube_missing_params`);
  }

  // Validate state
  const cookieStore = await cookies();
  const savedState = cookieStore.get('youtube_oauth_state')?.value;
  if (state !== savedState) {
    return NextResponse.redirect(`${appUrl}/?error=youtube_invalid_state`);
  }
  cookieStore.delete('youtube_oauth_state');

  try {
    // Exchange code for tokens
    const tokens = await exchangeYouTubeCode(code, appUrl);

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    const supabase = createServiceClient();

    // Parse state to check if this is a new user or connecting additional platform
    let userId: string | null = null;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = stateData.userId;
    } catch {
      // Invalid state data, treat as new user
    }

    if (!userId) {
      // New user flow: create or find user
      // First check if this Google account already has a user
      const { data: existingConnection } = await supabase
        .from('platform_connections')
        .select('user_id')
        .eq('platform', 'youtube')
        .eq('platform_user_id', googleUser.id)
        .single();

      if (existingConnection) {
        userId = existingConnection.user_id;

        // Update tokens
        await supabase
          .from('platform_connections')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || undefined,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            sync_status: 'pending',
          })
          .eq('user_id', userId)
          .eq('platform', 'youtube');
      } else {
        // Create Supabase auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: googleUser.email,
          email_confirm: true,
          user_metadata: {
            name: googleUser.name,
            avatar_url: googleUser.picture,
            provider: 'google',
          },
        });

        if (authError) {
          // User might already exist in auth but not in our users table
          // Try to find by email
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existingAuth = users?.find(u => u.email === googleUser.email);
          if (!existingAuth) throw authError;

          // Check if they have a user record
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', existingAuth.id)
            .single();

          if (existingUser) {
            userId = existingUser.id;
          } else {
            // Create user record for existing auth user
            const username = await generateUniqueUsername(supabase, googleUser.name);
            const { data: newUser, error: userError } = await supabase
              .from('users')
              .insert({
                auth_id: existingAuth.id,
                display_name: googleUser.name,
                username,
                avatar_url: googleUser.picture,
              })
              .select('id')
              .single();

            if (userError) throw userError;
            userId = newUser.id;
          }
        } else {
          // Create user record
          const username = await generateUniqueUsername(supabase, googleUser.name);
          const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
              auth_id: authData.user.id,
              display_name: googleUser.name,
              username,
              avatar_url: googleUser.picture,
            })
            .select('id')
            .single();

          if (userError) throw userError;
          userId = newUser.id;
        }

        // Create platform connection
        await supabase.from('platform_connections').insert({
          user_id: userId,
          platform: 'youtube',
          platform_user_id: googleUser.id,
          platform_display_name: googleUser.name,
          platform_avatar_url: googleUser.picture,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: ['youtube.readonly', 'userinfo.profile', 'userinfo.email'],
          sync_status: 'pending',
        });
      }
    } else {
      // Existing user connecting YouTube
      // Upsert the platform connection
      await supabase.from('platform_connections').upsert({
        user_id: userId,
        platform: 'youtube',
        platform_user_id: googleUser.id,
        platform_display_name: googleUser.name,
        platform_avatar_url: googleUser.picture,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: ['youtube.readonly', 'userinfo.profile', 'userinfo.email'],
        sync_status: 'pending',
      }, {
        onConflict: 'user_id,platform',
      });
    }

    // Set a session cookie with the user ID
    cookieStore.set('ajax_user_id', userId!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Trigger async sync (fire and forget) — baseUrl already request-derived
    fetch(`${appUrl}/api/sync/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {}); // Don't await, don't fail

    return NextResponse.redirect(`${appUrl}/dashboard?welcome=youtube`);
  } catch (err) {
    console.error('YouTube callback error:', err);
    return NextResponse.redirect(`${appUrl}/?error=youtube_callback_failed`);
  }
}

async function generateUniqueUsername(supabase: ReturnType<typeof createServiceClient>, name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
  let candidate = base;
  let counter = 0;

  while (true) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('username', candidate)
      .single();

    if (!data) return candidate;
    counter++;
    candidate = `${base}${counter}`;
  }
}
