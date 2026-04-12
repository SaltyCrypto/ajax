// ============================================
// AJAX — Taste Vector Mathematics
// 64-dimensional taste vector computation
// ============================================

import { TASTE_CATEGORIES, type TasteCategory } from './categories';
import type { AudioSignature, CategoryWeights } from '@/types';

// Compute cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// Shannon entropy (normalized 0-1)
export function shannonEntropy(weights: number[]): number {
  const nonZero = weights.filter(w => w > 0);
  if (nonZero.length <= 1) return 0;

  const maxEntropy = Math.log2(nonZero.length);
  if (maxEntropy === 0) return 0;

  const entropy = -nonZero.reduce((sum, w) => {
    return sum + w * Math.log2(w);
  }, 0);

  return entropy / maxEntropy; // Normalize to 0-1
}

// Normalize an object of weights so values sum to 1
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total === 0) return weights;

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = value / total;
  }
  return normalized;
}

// Convert category weights to a fixed-length vector aligned with TASTE_CATEGORIES
export function categoryWeightsToVector(weights: CategoryWeights): number[] {
  return TASTE_CATEGORIES.map(cat => weights[cat] || 0);
}

// Build the full 64-dimensional taste vector:
// [40 category weights | 6 audio features | diversity | mainstream | freshness | coherence | 12 temporal]
export function buildTasteVector(params: {
  categoryWeights: CategoryWeights;
  audioSignature: AudioSignature | null;
  diversityScore: number;
  mainstreamScore: number;
  freshnessScore: number;
  coherenceScore: number;
  temporalFeatures?: number[]; // 12 features for time-based patterns
}): number[] {
  const vector: number[] = [];

  // 40 category dimensions
  for (const cat of TASTE_CATEGORIES) {
    vector.push(params.categoryWeights[cat] || 0);
  }

  // 6 audio feature dimensions (0.5 default = neutral)
  if (params.audioSignature) {
    vector.push(params.audioSignature.energy);
    vector.push(params.audioSignature.valence);
    vector.push(params.audioSignature.danceability);
    vector.push(params.audioSignature.acousticness);
    vector.push(params.audioSignature.instrumentalness);
    vector.push(0); // Reserved for future audio feature
  } else {
    vector.push(0.5, 0.5, 0.5, 0.5, 0.5, 0); // Neutral defaults
  }

  // 4 meta-dimensions
  vector.push(params.diversityScore);
  vector.push(params.mainstreamScore);
  vector.push(params.freshnessScore);
  vector.push(params.coherenceScore);

  // 12 temporal dimensions (reserved for future use)
  const temporal = params.temporalFeatures || new Array(12).fill(0);
  vector.push(...temporal.slice(0, 12));

  // Pad to exactly 64 if needed
  while (vector.length < 64) vector.push(0);

  return vector.slice(0, 64);
}

// Compute cross-platform coherence
// How similar is the user's YouTube taste to their Spotify taste?
export function computeCoherence(
  youtubeWeights: CategoryWeights,
  spotifyWeights: CategoryWeights
): number {
  const ytVector = categoryWeightsToVector(youtubeWeights);
  const spVector = categoryWeightsToVector(spotifyWeights);

  // Both might be all zeros if user has only one platform
  const ytSum = ytVector.reduce((s, v) => s + v, 0);
  const spSum = spVector.reduce((s, v) => s + v, 0);

  if (ytSum === 0 || spSum === 0) return 0;

  return cosineSimilarity(ytVector, spVector);
}

// Compute diversity score from category weights
export function computeDiversity(weights: CategoryWeights): number {
  const values = Object.values(weights).filter(v => v > 0);
  return shannonEntropy(values);
}

// Compute mainstream score from popularity values
export function computeMainstream(popularities: number[]): number {
  if (popularities.length === 0) return 0.5;
  const avg = popularities.reduce((s, v) => s + v, 0) / popularities.length;
  return avg / 100; // Spotify popularity is 0-100
}

// Compute freshness: ratio of recent engagement vs. total
export function computeFreshness(
  totalItems: number,
  recentItems: number // items from last 3 months
): number {
  if (totalItems === 0) return 0;
  return Math.min(1, recentItems / totalItems);
}

// Compute audio signature from track features
export function computeAudioSignature(
  tracks: Array<{
    energy: number | null;
    valence: number | null;
    danceability: number | null;
    acousticness: number | null;
    instrumentalness: number | null;
  }>
): AudioSignature | null {
  const valid = tracks.filter(
    t => t.energy !== null && t.valence !== null
  );

  if (valid.length === 0) return null;

  const avg = (key: keyof typeof valid[0]) => {
    const values = valid.map(t => t[key]).filter((v): v is number => v !== null);
    return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0.5;
  };

  return {
    energy: avg('energy'),
    valence: avg('valence'),
    danceability: avg('danceability'),
    acousticness: avg('acousticness'),
    instrumentalness: avg('instrumentalness'),
  };
}
