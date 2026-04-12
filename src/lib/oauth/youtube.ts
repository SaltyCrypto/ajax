// ============================================
// YouTube OAuth 2.0 + Data API v3
// ============================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function getYouTubeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeYouTubeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token exchange failed: ${err}`);
  }

  return res.json();
}

export async function refreshYouTubeToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) throw new Error('YouTube token refresh failed');
  return res.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  email: string;
  picture: string;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to get Google user info');
  return res.json();
}

// --- YouTube Data API helpers ---

interface YouTubeApiOptions {
  accessToken: string;
  endpoint: string;
  params?: Record<string, string>;
}

async function youtubeApi<T>(opts: YouTubeApiOptions): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${opts.endpoint}`);
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API error (${opts.endpoint}): ${err}`);
  }

  return res.json();
}

export interface YouTubeSubscriptionItem {
  snippet: {
    resourceId: { channelId: string };
    title: string;
    description: string;
    thumbnails: { default?: { url: string } };
    publishedAt: string;
  };
}

export async function fetchAllSubscriptions(accessToken: string): Promise<YouTubeSubscriptionItem[]> {
  const items: YouTubeSubscriptionItem[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeApi<{
      items: YouTubeSubscriptionItem[];
      nextPageToken?: string;
    }>({ accessToken, endpoint: 'subscriptions', params });

    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < 2000); // Cap to save quota

  return items;
}

export interface YouTubeLikedItem {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    categoryId: string;
    tags?: string[];
    publishedAt: string;
  };
  contentDetails?: {
    duration: string; // ISO 8601 duration
  };
}

export async function fetchLikedVideos(accessToken: string, maxResults = 500): Promise<YouTubeLikedItem[]> {
  const items: YouTubeLikedItem[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      myRating: 'like',
      maxResults: '50',
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeApi<{
      items: YouTubeLikedItem[];
      nextPageToken?: string;
    }>({ accessToken, endpoint: 'videos', params });

    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < maxResults);

  return items;
}

export interface YouTubeChannelDetails {
  id: string;
  topicDetails?: {
    topicCategories?: string[];
  };
  statistics?: {
    subscriberCount?: string;
  };
}

export async function fetchChannelDetails(
  accessToken: string,
  channelIds: string[]
): Promise<YouTubeChannelDetails[]> {
  // Batch up to 50 IDs per request
  const results: YouTubeChannelDetails[] = [];

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await youtubeApi<{ items: YouTubeChannelDetails[] }>({
      accessToken,
      endpoint: 'channels',
      params: {
        part: 'topicDetails,statistics',
        id: batch.join(','),
      },
    });
    results.push(...(data.items || []));
  }

  return results;
}

// Parse ISO 8601 duration (PT1H2M3S) to seconds
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}
