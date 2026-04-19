// ============================================
// AJAX \u2014 Main Taste Engine (v2)
// Orchestrates: data fetching \u2192 category mapping \u2192
// vector computation \u2192 personality \u2192 sonic id \u2192
// insights \u2192 profile storage.
//
// v2 changes vs v1:
//   - Engagement-weighted platform blend (likes/subs) instead of raw count
//   - Real freshness from saved_at timestamps
//   - Logistic mainstream normalization
//   - Confidence model propagates to insights
//   - 4th personality axis (Sonic Identity)
//   - Evocative compound title
// ============================================

import { createServiceClient } from '@/lib/supabase/server';
import {
  mapYouTubeTopicToCategories,
  mapYouTubeCategoryIdToCategories,
  mapSpotifyGenresToCategories,
  getTopSpotifyGenres,
} from './categories';
import {
  normalizeWeights,
  buildTasteVector,
  computeCoherence,
  computeDiversity,
  computeMainstream,
  computeFreshnessFromDates,
  computeAudioSignature,
} from './vector';
import { classifyTempo, classifyNovelty, classifyIdentity, buildCompoundPersonality } from './personality';
import { classifySonicIdentity, buildCompoundTitle } from './signatures';
import { crossPlatformConfidence, platformEngagement } from './confidence';
import { generateInsights, selectCardInsights, generateTemplateDescription } from './insights';
import type { CategoryWeights, TasteProfile } from '@/types';

export async function computeTasteProfile(userId: string): Promise<TasteProfile> {
  const supabase = createServiceClient();

  // --- Fetch all user data ---

  const [
    { data: ytSubs },
    { data: ytLikes },
    { data: spArtistsShort },
    { data: spArtistsMedium },
    { data: spArtistsLong },
    { data: spTracksShort },
    { data: spTracksMedium },
    { data: spTracksLong },
    { data: spSaved },
  ] = await Promise.all([
    supabase.from('youtube_subscriptions').select('*').eq('user_id', userId),
    supabase.from('youtube_likes').select('*').eq('user_id', userId),
    supabase.from('spotify_top_artists').select('*').eq('user_id', userId).eq('time_range', 'short_term').order('rank'),
    supabase.from('spotify_top_artists').select('*').eq('user_id', userId).eq('time_range', 'medium_term').order('rank'),
    supabase.from('spotify_top_artists').select('*').eq('user_id', userId).eq('time_range', 'long_term').order('rank'),
    supabase.from('spotify_top_tracks').select('*').eq('user_id', userId).eq('time_range', 'short_term').order('rank'),
    supabase.from('spotify_top_tracks').select('*').eq('user_id', userId).eq('time_range', 'medium_term').order('rank'),
    supabase.from('spotify_top_tracks').select('*').eq('user_id', userId).eq('time_range', 'long_term').order('rank'),
    supabase.from('spotify_saved_tracks').select('*').eq('user_id', userId).order('saved_at', { ascending: false }).limit(500),
  ]);

  const subs = ytSubs || [];
  const likes = ytLikes || [];
  const allSpArtists = [...(spArtistsShort || []), ...(spArtistsMedium || []), ...(spArtistsLong || [])];
  const allSpTracks = [...(spTracksShort || []), ...(spTracksMedium || []), ...(spTracksLong || [])];
  const saved = spSaved || [];

  // --- YouTube Category Mapping ---

  const ytCategoryCounts: Record<string, number> = {};

  // From subscription topic categories
  for (const sub of subs) {
    const topics: string[] = sub.topic_categories || [];
    for (const topicUrl of topics) {
      const cats = mapYouTubeTopicToCategories(topicUrl);
      for (const cat of cats) {
        ytCategoryCounts[cat] = (ytCategoryCounts[cat] || 0) + 1;
      }
    }
    // If no topics, try to infer from other signals
    if (topics.length === 0) {
      ytCategoryCounts['Education'] = (ytCategoryCounts['Education'] || 0) + 0.5;
    }
  }

  // From liked video categories (weighted 2x — likes are stronger signal)
  for (const like of likes) {
    if (like.category_id) {
      const cats = mapYouTubeCategoryIdToCategories(like.category_id);
      for (const cat of cats) {
        ytCategoryCounts[cat] = (ytCategoryCounts[cat] || 0) + 2;
      }
    }
  }

  const youtubeCategories = normalizeWeights(ytCategoryCounts) as CategoryWeights;

  // --- Spotify Category Mapping ---

  // Collect all genres (from artists across time ranges, weighted by rank and recency)
  const allGenres: string[] = [];
  const mediumArtists = spArtistsMedium || [];
  const shortArtists = spArtistsShort || [];
  const longArtists = spArtistsLong || [];

  // Medium term gets highest weight (most representative)
  for (const artist of mediumArtists) {
    const genres: string[] = artist.genres || [];
    for (const g of genres) {
      allGenres.push(g, g); // 2x weight
    }
  }

  // Short term (recent taste)
  for (const artist of shortArtists) {
    const genres: string[] = artist.genres || [];
    for (const g of genres) {
      allGenres.push(g, g, g); // 3x weight (recency bonus)
    }
  }

  // Long term (stable taste)
  for (const artist of longArtists) {
    const genres: string[] = artist.genres || [];
    allGenres.push(...genres); // 1x weight
  }

  // From saved tracks
  for (const track of saved) {
    const genres: string[] = track.genres || [];
    allGenres.push(...genres);
  }

  const spCategoryMap = mapSpotifyGenresToCategories(allGenres);
  const spCategoryCounts: Record<string, number> = {};
  for (const [cat, count] of spCategoryMap) {
    spCategoryCounts[cat] = count;
  }
  const spotifyCategories = normalizeWeights(spCategoryCounts) as CategoryWeights;

  // --- Combined Categories (v2: engagement-weighted blend) ---
  // Raw item count was a bad proxy because Spotify saves scale differently
  // from YT subs; a user with 500 passively saved tracks and 20 heavily
  // engaged YT channels deserves YT to weigh more than 4%. Engagement =
  // committed acts per breadth unit + a volume tempering factor.
  const engagement = platformEngagement({
    ytSubs: subs.length,
    ytLikes: likes.length,
    spArtists: allSpArtists.length,
    spSaved: saved.length,
  });
  const totalEngagement = engagement.youtube + engagement.spotify || 1;
  const ytWeight = engagement.youtube / totalEngagement;
  const spWeight = engagement.spotify / totalEngagement;

  const combinedCounts: Record<string, number> = {};
  for (const [cat, w] of Object.entries(youtubeCategories)) {
    combinedCounts[cat] = (combinedCounts[cat] || 0) + w * ytWeight;
  }
  for (const [cat, w] of Object.entries(spotifyCategories)) {
    combinedCounts[cat] = (combinedCounts[cat] || 0) + w * spWeight;
  }
  const categoryWeights = normalizeWeights(combinedCounts) as CategoryWeights;

  // --- Genre Details (Spotify granular) ---
  const topGenres = getTopSpotifyGenres(allGenres, 30);
  const genreDetails: Record<string, number> = {};
  const totalGenreCounts = topGenres.reduce((s, g) => s + g.count, 0) || 1;
  for (const { genre, count } of topGenres) {
    genreDetails[genre] = count / totalGenreCounts;
  }

  // --- Audio Signature ---
  const mediumTracks = spTracksMedium || [];
  const audioSignature = computeAudioSignature(
    mediumTracks.map(t => ({
      energy: t.energy,
      valence: t.valence,
      danceability: t.danceability,
      acousticness: t.acousticness,
      instrumentalness: t.instrumentalness,
    }))
  );

  // --- Scores ---
  const diversityScore = computeDiversity(categoryWeights);

  const popularities = [
    ...mediumArtists.map(a => a.popularity),
    ...(spTracksMedium || []).map(t => t.popularity),
  ];
  const mainstreamScore = computeMainstream(popularities);

  // Freshness (v2): actual saved_at timestamps. The old short/long count
  // ratio was ~1.0 for nearly every user because Spotify returns 50 items
  // per time_range regardless of engagement level.
  const freshnessScore = computeFreshnessFromDates(
    saved.map(s => s.saved_at)
  );

  const coherenceScore = computeCoherence(youtubeCategories, spotifyCategories);

  // --- Taste Vector ---
  const tasteVector = buildTasteVector({
    categoryWeights,
    audioSignature,
    diversityScore,
    mainstreamScore,
    freshnessScore,
    coherenceScore,
  });

  // --- Personality ---

  // Build short-term and long-term category weights for tempo classification
  const shortTermGenres = (spArtistsShort || []).flatMap(a => a.genres || []);
  const longTermGenres = (spArtistsLong || []).flatMap(a => a.genres || []);
  const shortTermMap = mapSpotifyGenresToCategories(shortTermGenres);
  const longTermMap = mapSpotifyGenresToCategories(longTermGenres);
  const shortTermCounts: Record<string, number> = {};
  const longTermCounts: Record<string, number> = {};
  for (const [cat, count] of shortTermMap) shortTermCounts[cat] = count;
  for (const [cat, count] of longTermMap) longTermCounts[cat] = count;
  const shortTermWeights = normalizeWeights(shortTermCounts) as CategoryWeights;
  const longTermWeights = normalizeWeights(longTermCounts) as CategoryWeights;

  // Compute confidence first so classifiers can later be gated on it.
  const ytItemCount = subs.length + likes.length;
  const spItemCount = allSpArtists.length + allSpTracks.length + saved.length;
  const confidence = crossPlatformConfidence(ytItemCount, spItemCount);

  const tempo = classifyTempo({ categoryWeights, shortTermWeights, longTermWeights });

  // Small-channel ratio feeds novelty (Explorer bias)
  const smallChannelRatio =
    subs.length > 0
      ? subs.filter(s => s.subscriber_count !== null && s.subscriber_count < 100000).length /
        subs.length
      : 0;

  const novelty = classifyNovelty({ mainstreamScore, freshnessScore, smallChannelRatio });
  const identity = classifyIdentity({ coherence: coherenceScore, youtubeWeights: youtubeCategories, spotifyWeights: spotifyCategories });

  const sonic = classifySonicIdentity(audioSignature);

  const personalityCompound = buildCompoundPersonality(tempo.label, novelty.label, identity.label);
  const compoundTitle = buildCompoundTitle({
    tempo: tempo.label,
    novelty: novelty.label,
    identity: identity.label,
    sonic: sonic.label,
  });

  // --- Compute category drift for insights ---
  const topSorted = (w: CategoryWeights) => Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const shortTopCat = topSorted(shortTermWeights);
  const longTopCat = topSorted(longTermWeights);
  let categoryDrift = 0;
  const allCatKeys = new Set([...Object.keys(shortTermWeights), ...Object.keys(longTermWeights)]);
  for (const cat of allCatKeys) {
    categoryDrift += Math.abs((shortTermWeights[cat] || 0) - (longTermWeights[cat] || 0));
  }

  // --- Small channel detection ---
  const smallChannelCount = subs.filter(s => s.subscriber_count && s.subscriber_count < 100000).length;
  const channelsWithData = subs.filter(s => s.subscriber_count !== null).length;

  // --- Avg likes per channel ---
  const uniqueLikeChannels = new Set(likes.map(l => l.channel_id));
  const avgLikesPerChannel = uniqueLikeChannels.size > 0 ? likes.length / uniqueLikeChannels.size : 0;

  // --- Insights ---
  const topYtCat = topSorted(youtubeCategories);
  const topSpCat = topSorted(spotifyCategories);
  const topSpGenres = topGenres.slice(0, 5).map(g => g.genre);

  const allInsights = generateInsights({
    youtubeCategories,
    spotifyCategories,
    combinedCategories: categoryWeights,
    genreDetails,
    diversityScore,
    mainstreamScore,
    freshnessScore,
    coherenceScore,
    audioSignature,
    sonicIdentity: sonic.label,
    youtubeSubCount: subs.length,
    youtubeLikeCount: likes.length,
    spotifyArtistCount: allSpArtists.length,
    spotifyTrackCount: allSpTracks.length,
    spotifySavedCount: saved.length,
    smallChannelCount,
    totalChannelCount: channelsWithData,
    avgLikesPerChannel,
    topYoutubeCategory: topYtCat,
    topSpotifyCategory: topSpCat,
    topSpotifyGenres: topSpGenres,
    shortTermTopCategory: shortTopCat,
    longTermTopCategory: longTopCat,
    categoryDrift,
    shortTermWeights,
    longTermWeights,
    personalityTempo: tempo.label,
    personalityNovelty: novelty.label,
    personalityIdentity: identity.label,
    confidence: confidence.combined,
  });

  const cardInsights = selectCardInsights(allInsights, 3);

  // --- Description ---
  // TODO: Use Anthropic API for AI-generated descriptions when ANTHROPIC_API_KEY is set
  const description = generateTemplateDescription({
    youtubeCategories,
    spotifyCategories,
    combinedCategories: categoryWeights,
    genreDetails,
    diversityScore,
    mainstreamScore,
    freshnessScore,
    coherenceScore,
    audioSignature,
    youtubeSubCount: subs.length,
    youtubeLikeCount: likes.length,
    spotifyArtistCount: allSpArtists.length,
    spotifyTrackCount: allSpTracks.length,
    spotifySavedCount: saved.length,
    smallChannelCount,
    totalChannelCount: channelsWithData,
    avgLikesPerChannel,
    topYoutubeCategory: topYtCat,
    topSpotifyCategory: topSpCat,
    topSpotifyGenres: topSpGenres,
    shortTermTopCategory: shortTopCat,
    longTermTopCategory: longTopCat,
    categoryDrift,
    personalityTempo: tempo.label,
    personalityNovelty: novelty.label,
    personalityIdentity: identity.label,
  });

  // --- Build profile ---
  const profile: TasteProfile = {
    user_id: userId,
    version: 2,
    category_weights: categoryWeights,
    youtube_categories: youtubeCategories,
    spotify_categories: spotifyCategories,
    genre_details: genreDetails,
    audio_signature: audioSignature,
    taste_vector: tasteVector,
    diversity_score: diversityScore,
    mainstream_score: mainstreamScore,
    freshness_score: freshnessScore,
    cross_platform_coherence: coherenceScore,
    personality_tempo: tempo.label,
    personality_novelty: novelty.label,
    personality_identity: identity.label,
    personality_compound: personalityCompound,
    personality_sonic: sonic.label,
    compound_title: compoundTitle,
    confidence: confidence.combined,
    confidence_youtube: confidence.youtube,
    confidence_spotify: confidence.spotify,
    description,
    insights: allInsights,
    computed_at: new Date().toISOString(),
  };

  // --- Save to database ---
  // v2 columns (personality_sonic, compound_title, confidence*) added by
  // migration 003_prediction_engine_v2.sql. Attempt the full v2 upsert;
  // if the migration hasn't been applied yet on this environment, gracefully
  // retry without the new columns so the compute still persists.
  const v1Row = {
    user_id: userId,
    version: 2,
    category_weights: categoryWeights,
    youtube_categories: youtubeCategories,
    spotify_categories: spotifyCategories,
    genre_details: genreDetails,
    audio_signature: audioSignature,
    taste_vector: JSON.stringify(tasteVector), // pgvector needs special handling
    diversity_score: diversityScore,
    mainstream_score: mainstreamScore,
    freshness_score: freshnessScore,
    cross_platform_coherence: coherenceScore,
    personality_tempo: tempo.label,
    personality_novelty: novelty.label,
    personality_identity: identity.label,
    personality_compound: personalityCompound,
    description,
    insights: allInsights,
    computed_at: new Date().toISOString(),
  };
  const v2Row = {
    ...v1Row,
    personality_sonic: sonic.label,
    compound_title: compoundTitle,
    confidence: confidence.combined,
    confidence_youtube: confidence.youtube,
    confidence_spotify: confidence.spotify,
  };
  const { error: v2Err } = await supabase
    .from('taste_profiles')
    .upsert(v2Row, { onConflict: 'user_id' });
  if (v2Err) {
    // Most likely cause: migration 003 hasn't been applied on this env.
    // Log once, retry with the v1 column set, and let the in-memory profile
    // still carry the v2 fields back to the caller.
    console.warn('[engine] v2 upsert failed, retrying with v1 columns:', v2Err.message);
    const { error: v1Err } = await supabase
      .from('taste_profiles')
      .upsert(v1Row, { onConflict: 'user_id' });
    if (v1Err) {
      console.error('[engine] v1 upsert also failed:', v1Err);
    }
  }

  // Save weekly snapshot
  await supabase.from('taste_snapshots').insert({
    user_id: userId,
    snapshot_at: new Date().toISOString(),
    category_weights: categoryWeights,
    taste_vector: JSON.stringify(tasteVector),
    personality_compound: personalityCompound,
    notable_changes: {}, // TODO: compare with previous snapshot
  });

  return profile;
}
