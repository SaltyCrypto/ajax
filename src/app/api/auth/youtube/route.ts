import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getYouTubeAuthUrl } from '@/lib/oauth/youtube';
import { getBaseUrl } from '@/lib/url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const baseUrl = getBaseUrl(request);

  // Generate state token for CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      csrf: crypto.randomUUID(),
      userId, // null for new users, set for connecting additional platform
      timestamp: Date.now(),
    })
  ).toString('base64url');

  // Store state in cookie for validation on callback
  const cookieStore = await cookies();
  cookieStore.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = getYouTubeAuthUrl(state, baseUrl);
  return NextResponse.redirect(authUrl);
}
