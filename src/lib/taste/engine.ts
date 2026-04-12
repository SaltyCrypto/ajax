// ============================================
// AJAX — Main Taste Engine
// Orchestrates: data fetching → category mapping →
// vector computation → personality → insights →
// profile storage
// ============================================

import { createServiceClient } from '@/lib/supabase/server';
import {
  mapYouTubeTopicToCategories,
  mapYouTubeCategoryIdToCategories,
  mapSpotifyGenresToCategories,
  getTopSpotifyGenres,
  type TasteCategory,
} from './categories';
import {
  normalizeWeights,
  buildTasteVector,
  computeCoherence,
  computeDiversity,
  computeMainstream,
  computeFreshness,
  computeAudioSignature,
} from './vector';
import { classifyTempo, classifyNovelty, classifyIdentity, buildCompoundPersonality } from './personality';
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

  // --- Combined Categories ---
  // Weight YouTube and Spotify proportionally to data volume
  const ytDataPoints = subs.length + likes.length;
  const spDataPoints = allSpArtists.length + saved.length;
  const totalDataPoints = ytDataPoints + spDataPoints || 1;
  const ytWeight = ytDataPoints / totalDataPoints;
  const spWeight = spDataPoints / totalDataPoints;

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

  // Freshness: ratio of short-term to long-term data
  const shortCount = (spArtistsShort?.length || 0) + (spTracksShort?.length || 0);
  const longCount = (spArtistsLong?.length || 0) + (spTracksLong?.length || 0);
  const freshnessScore = computeFreshness(longCount || 1, shortCount);

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

  const tempo = classifyTempo({ categoryWeights, shortTermWeights, longTermWeights });
  const novelty = classifyNovelty({ mainstreamScore, freshnessScore });
  const identity = classifyIdentity({ coherence: coherenceScore, youtubeWeights: youtubeCategories, spotifyWeights: spotifyCategories });

  const personalityCompound = buildCompoundPersonality(tempo.label, novelty.label, identity.label);

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
    version: 1,
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
    description,
    insights: allInsights,
    computed_at: new Date().toISOString(),
  };

  // --- Save to database ---
  await supabase.from('taste_profiles').upsert({
    user_id: userId,
    version: 1,
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
  }, {
    onConflict: 'user_id',
  });

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
