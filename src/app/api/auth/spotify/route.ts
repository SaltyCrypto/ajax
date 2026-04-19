import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSpotifyAuthUrl } from '@/lib/oauth/spotify';
import { getBaseUrl } from '@/lib/url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const baseUrl = getBaseUrl(request);

  const state = Buffer.from(
    JSON.stringify({
      csrf: crypto.randomUUID(),
      userId,
      timestamp: Date.now(),
    })
  ).toString('base64url');

  const cookieStore = await cookies();
  cookieStore.set('spotify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const authUrl = getSpotifyAuthUrl(state, baseUrl);
  return NextResponse.redirect(authUrl);
}
