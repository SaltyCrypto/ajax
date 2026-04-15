// ============================================
// Spotify OAuth 2.0 + Web API
// ============================================

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const SCOPES = [
  'user-top-read',
  'user-library-read',
  'user-read-recently-played',
  'playlist-read-private',
  'user-read-email',
  'user-read-private',
];

export function getSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${process.env.SPOTIFY_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL + '/api/auth/spotify/callback'}`,
    scope: SCOPES.join(' '),
    state,
    show_dialog: 'true',
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: `${process.env.SPOTIFY_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL + '/api/auth/spotify/callback'}`,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  return res.json();
}

export async function refreshSpotifyToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error('Spotify token refresh failed');
  return res.json();
}

// --- Spotify API helpers ---

async function spotifyApi<T>(accessToken: string, endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${SPOTIFY_API_BASE}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error (${endpoint}): ${err}`);
  }

  return res.json();
}

export async function getSpotifyProfile(accessToken: string): Promise<{
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
}> {
  return spotifyApi(accessToken, 'me');
}

// --- Top Artists ---

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: Array<{ url: string; width: number }>;
}

export async function fetchTopArtists(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term'
): Promise<SpotifyArtist[]> {
  const data = await spotifyApi<{ items: SpotifyArtist[] }>(
    accessToken,
    'me/top/artists',
    { time_range: timeRange, limit: '50' }
  );
  return data.items || [];
}

// --- Top Tracks ---

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  popularity: number;
  duration_ms: number;
}

export async function fetchTopTracks(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term'
): Promise<SpotifyTrack[]> {
  const data = await spotifyApi<{ items: SpotifyTrack[] }>(
    accessToken,
    'me/top/tracks',
    { time_range: timeRange, limit: '50' }
  );
  return data.items || [];
}

// --- Saved Tracks ---

export interface SpotifySavedTrackItem {
  added_at: string;
  track: SpotifyTrack & {
    artists: Array<{ id: string; name: string }>;
  };
}

export async function fetchSavedTracks(accessToken: string, limit = 500): Promise<SpotifySavedTrackItem[]> {
  const items: SpotifySavedTrackItem[] = [];
  let offset = 0;

  do {
    const data = await spotifyApi<{ items: SpotifySavedTrackItem[]; total: number }>(
      accessToken,
      'me/tracks',
      { limit: '50', offset: offset.toString() }
    );
    items.push(...(data.items || []));
    offset += 50;
    if (!data.items?.length || offset >= data.total) break;
  } while (items.length < limit);

  return items;
}

// --- Audio Features ---

export interface AudioFeatures {
  id: string;
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tempo: number;
}

export async function fetchAudioFeatures(
  accessToken: string,
  trackIds: string[]
): Promise<AudioFeatures[]> {
  const results: AudioFeatures[] = [];

  // Batch 100 at a time
  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100);
    const data = await spotifyApi<{ audio_features: (AudioFeatures | null)[] }>(
      accessToken,
      'audio-features',
      { ids: batch.join(',') }
    );
    results.push(...(data.audio_features || []).filter((f): f is AudioFeatures => f !== null));
  }

  return results;
}

// --- Artist details (for genres of saved tracks) ---

export async function fetchArtistDetails(
  accessToken: string,
  artistIds: string[]
): Promise<SpotifyArtist[]> {
  const results: SpotifyArtist[] = [];

  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    const data = await spotifyApi<{ artists: SpotifyArtist[] }>(
      accessToken,
      'artists',
      { ids: batch.join(',') }
    );
    results.push(...(data.artists || []));
  }

  return results;
}
