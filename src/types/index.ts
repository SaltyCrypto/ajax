// ============================================
// AJAX — Core Type Definitions
// ============================================

// --- Platform Types ---

export type Platform = 'youtube' | 'spotify' | 'reddit';

export type SyncStatus = 'pending' | 'syncing' | 'complete' | 'error';

export interface PlatformConnection {
  id: string;
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_display_name: string | null;
  platform_avatar_url: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  scopes: string[];
  connected_at: string;
  last_synced_at: string | null;
  sync_status: SyncStatus;
}

// --- YouTube Types ---

export interface YouTubeSubscription {
  user_id: string;
  channel_id: string;
  channel_title: string;
  channel_description: string | null;
  channel_thumbnail: string | null;
  subscriber_count: number | null;
  topic_categories: string[];
  subscribed_at: string | null;
  synced_at: string;
}

export interface YouTubeLike {
  user_id: string;
  video_id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  category_id: string | null;
  tags: string[];
  duration_seconds: number | null;
  published_at: string | null;
  synced_at: string;
}

// --- Spotify Types ---

export interface SpotifyTopArtist {
  user_id: string;
  artist_id: string;
  artist_name: string;
  genres: string[];
  popularity: number;
  image_url: string | null;
  time_range: 'short_term' | 'medium_term' | 'long_term';
  rank: number;
  synced_at: string;
}

export interface SpotifyTopTrack {
  user_id: string;
  track_id: string;
  track_name: string;
  artist_id: string;
  artist_name: string;
  album_name: string;
  popularity: number;
  duration_ms: number;
  energy: number | null;
  valence: number | null;
  danceability: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  time_range: 'short_term' | 'medium_term' | 'long_term';
  rank: number;
  synced_at: string;
}

export interface SpotifySaved {
  user_id: string;
  track_id: string;
  track_name: string;
  artist_id: string;
  artist_name: string;
  genres: string[];
  saved_at: string | null;
  synced_at: string;
}

// --- Taste Profile Types ---

export type PersonalityTempo = 'Deep Diver' | 'Grazer' | 'Binger' | 'Steady Stream';
export type PersonalityNovelty = 'Explorer' | 'Connoisseur' | 'Trendsetter' | 'Loyalist';
export type PersonalityIdentity = 'Unified' | 'Shapeshifter' | 'Bridge';

export interface CategoryWeights {
  [category: string]: number; // 0-1, sums to 1
}

export interface AudioSignature {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
}

export interface TasteProfile {
  user_id: string;
  version: number;
  category_weights: CategoryWeights;
  youtube_categories: CategoryWeights;
  spotify_categories: CategoryWeights;
  genre_details: Record<string, number>;
  audio_signature: AudioSignature | null;
  taste_vector: number[];
  diversity_score: number;       // 0-1, Shannon entropy normalized
  mainstream_score: number;      // 0-1, avg popularity
  freshness_score: number;       // 0-1, recency of engagement
  cross_platform_coherence: number; // 0-1, cosine sim between platform vectors
  personality_tempo: PersonalityTempo;
  personality_novelty: PersonalityNovelty;
  personality_identity: PersonalityIdentity;
  personality_compound: string;  // "Explorer x Deep Diver x Shapeshifter"
  description: string;           // AI-generated one-liner
  insights: TasteInsight[];
  computed_at: string;
}

export interface TasteInsight {
  type: 'contradiction' | 'behavior' | 'rarity' | 'temporal' | 'audio' | 'social';
  title: string;      // Short hook: "Double Life"
  body: string;       // Full insight text
  surprise_score: number; // 0-1, how surprising this is
  data?: Record<string, unknown>; // Supporting data
}

// --- Comparison Types ---

export interface TasteComparison {
  user_a: string;
  user_b: string;
  overall_match: number;       // 0-100
  youtube_match: number;       // 0-100
  spotify_match: number;       // 0-100
  shared_channels: string[];   // channel names
  shared_artists: string[];    // artist names
  unique_to_a: CategoryWeights;
  unique_to_b: CategoryWeights;
  comparison_insight: TasteInsight;
  computed_at: string;
}

// --- User Types ---

export interface AjaxUser {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  consent_tier1: boolean;
  consent_tier2: boolean;
  profile_public: boolean;
  created_at: string;
  platforms_connected: Platform[];
  taste_profile: TasteProfile | null;
}

// --- Card Types ---

export type CardTheme = 'default' | 'warm' | 'cool' | 'niche';

export interface CardData {
  username: string;
  display_name: string;
  avatar_url: string | null;
  personality_compound: string;
  description: string;
  youtube_categories: CategoryWeights;
  spotify_categories: CategoryWeights;
  top_insight: TasteInsight;
  diversity_score: number;
  mainstream_score: number;
  freshness_score: number;
  theme: CardTheme;
}

// --- Interaction Types (future-proofed for Layer 2+) ---

export type InteractionSource = 'feed_browse' | 'blind_spot' | 'curator_pick' | 'comparison' | 'collection';
export type InteractionAction = 'viewed' | 'clicked' | 'saved' | 'skipped' | 'subscribed' | 'deep_watched';

export interface Interaction {
  id: string;
  viewer_id: string;
  feed_owner_id: string;
  content_type: 'youtube_video' | 'spotify_track' | 'spotify_artist' | 'reddit_post';
  content_id: string;
  source: InteractionSource;
  action: InteractionAction;
  dwell_seconds: number | null;
  created_at: string;
}
