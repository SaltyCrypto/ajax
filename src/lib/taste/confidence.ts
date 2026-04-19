// ============================================
// AJAX — Confidence model
// ============================================
// Every downstream claim the engine makes (personality, insights, scores) is
// only as good as the data under it. This module centralises that math so
// views can surface uncertainty honestly instead of over-claiming on thin
// data. A user with 12 YT subs and zero Spotify activity shouldn't get the
// same confident personality verdict as one with 400 artists and 1k saves.

export type ConfidenceBand = 'low' | 'medium' | 'high';

/**
 * Saturating confidence curve. 0 items = 0, ~60 items = 0.5, ~500 = 0.95.
 * Shape chosen so adding 10 items when you have 10 feels very different from
 * adding 10 when you already have 500.
 */
export function dataVolumeConfidence(itemCount: number): number {
  if (itemCount <= 0) return 0;
  // 1 - exp(-x / 80); ~0.5 at 55, ~0.8 at 130, ~0.95 at 240
  return 1 - Math.exp(-itemCount / 80);
}

/** Weighted blend of two platform confidences. Boosts when BOTH have data. */
export function crossPlatformConfidence(
  ytItemCount: number,
  spItemCount: number
): { combined: number; youtube: number; spotify: number; platformsWithData: number } {
  const youtube = dataVolumeConfidence(ytItemCount);
  const spotify = dataVolumeConfidence(spItemCount);
  const platformsWithData = (ytItemCount > 0 ? 1 : 0) + (spItemCount > 0 ? 1 : 0);
  // Geometric-ish blend so weak platforms don't falsely inflate a strong one
  const base = (youtube + spotify) / 2;
  const crossBoost = platformsWithData === 2 ? Math.min(youtube, spotify) * 0.2 : 0;
  const combined = Math.min(1, base + crossBoost);
  return { combined, youtube, spotify, platformsWithData };
}

/**
 * Engagement intensity per platform: how much the user actually DOES with the
 * data, not just how much passive signal was collected. Used to blend YT vs
 * Spotify category weights — a user who liked 800 YT videos across 30
 * subscriptions is more committed to YT than one with 500 passively-saved
 * Spotify tracks.
 */
export function platformEngagement(params: {
  ytSubs: number;
  ytLikes: number;
  spArtists: number;
  spSaved: number;
}): { youtube: number; spotify: number } {
  // Engagement = active acts (likes/saves) per unit of breadth (subs/artists).
  // Plus a diminishing bonus for absolute volume so a tiny-but-engaged platform
  // doesn't dominate a broad-but-passive one.
  const ytIntensity = params.ytSubs > 0 ? params.ytLikes / Math.max(1, params.ytSubs) : 0;
  const spIntensity = params.spArtists > 0 ? params.spSaved / Math.max(1, params.spArtists) : 0;
  const ytVolumeBonus = dataVolumeConfidence(params.ytLikes + params.ytSubs) * 0.5;
  const spVolumeBonus = dataVolumeConfidence(params.spSaved + params.spArtists) * 0.5;
  // Tanh-ish clamp so extreme intensities (lots of likes, few subs) don't blow
  // up the weight. 1 like/sub and 1 save/artist feels like parity.
  const ytScore = Math.min(1, 0.5 * Math.tanh(ytIntensity) + ytVolumeBonus);
  const spScore = Math.min(1, 0.5 * Math.tanh(spIntensity) + spVolumeBonus);
  return { youtube: ytScore, spotify: spScore };
}

export function confidenceBand(value: number): ConfidenceBand {
  if (value < 0.35) return 'low';
  if (value < 0.7) return 'medium';
  return 'high';
}
