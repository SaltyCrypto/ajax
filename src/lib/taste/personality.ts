// ============================================
// AJAX — Personality Classifier v2
// ============================================
// Replaces the v1 threshold-ladder with smooth probability scoring. Each
// archetype is defined by a target region in signal space; the label is the
// highest-scoring archetype, and confidence = how much that archetype wins
// by (margin). This gives stable classifications and honest confidence.

import type {
  PersonalityTempo,
  PersonalityNovelty,
  PersonalityIdentity,
  CategoryWeights,
} from '@/types';

// --- helpers ---

function significantCount(weights: CategoryWeights, threshold = 0.05): number {
  return Object.values(weights).filter(w => w > threshold).length;
}

function topWeight(weights: CategoryWeights): number {
  const values = Object.values(weights);
  return values.length ? Math.max(...values) : 0;
}

function driftL1(a: CategoryWeights, b: CategoryWeights): number {
  // L1 distance between two normalized distributions \u2208 [0, 2].
  // Returns the value normalized to [0, 1].
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let total = 0;
  for (const k of keys) total += Math.abs((a[k] || 0) - (b[k] || 0));
  return Math.min(1, total / 2);
}

function marginConfidence(scores: Array<{ label: string; score: number }>): { label: string; confidence: number } {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const runner = sorted[1] || { score: 0 };
  const margin = best.score - runner.score;
  // Confidence combines absolute score and margin over runner-up.
  const confidence = Math.min(1, Math.max(0, best.score * 0.6 + margin * 0.8));
  return { label: best.label, confidence };
}

// ================================================================
// TEMPO \u2014 how you consume (Deep Diver / Grazer / Binger / Steady Stream)
// ================================================================

export function classifyTempo(params: {
  categoryWeights: CategoryWeights;
  shortTermWeights?: CategoryWeights;
  longTermWeights?: CategoryWeights;
}): { label: PersonalityTempo; confidence: number; reason: string } {
  const n = significantCount(params.categoryWeights);
  const top = topWeight(params.categoryWeights);

  // Drift signal (0-1) when both short and long term are present
  const drift =
    params.shortTermWeights && params.longTermWeights
      ? driftL1(params.shortTermWeights, params.longTermWeights)
      : 0;

  const scores = [
    {
      // Deep Diver: few categories, one dominant
      label: 'Deep Diver' as const,
      score:
        Math.max(0, 1 - n / 10) * 0.6 + // fewer = higher, knee around 10
        Math.min(1, top * 2) * 0.4, // top weight contributes
    },
    {
      // Grazer: many categories, nothing dominant
      label: 'Grazer' as const,
      score: Math.min(1, n / 15) * 0.6 + Math.max(0, 1 - top * 2) * 0.4,
    },
    {
      // Binger: sharp recent pivot from long-term
      label: 'Binger' as const,
      score: drift > 0 ? Math.min(1, drift * 2) : 0,
    },
    {
      // Steady Stream: moderate breadth + low drift
      label: 'Steady Stream' as const,
      score:
        (1 - Math.abs(n / 15 - 0.5) * 2) * 0.5 + // peaks at n ~ 7-8
        (1 - drift) * 0.5,
    },
  ];

  const { label, confidence } = marginConfidence(scores);

  const reasons: Record<PersonalityTempo, string> = {
    'Deep Diver': `Focused on ${n} categories with ${Math.round(top * 100)}% concentration`,
    Grazer: `Spread across ${n} significant categories \u2014 nothing dominates`,
    Binger: `Recent taste has shifted ${Math.round(drift * 100)}% from your long-term pattern`,
    'Steady Stream': 'Balanced breadth and consistency over time',
  };

  return {
    label: label as PersonalityTempo,
    confidence,
    reason: reasons[label as PersonalityTempo],
  };
}

// ================================================================
// NOVELTY \u2014 what you seek (Explorer / Connoisseur / Trendsetter / Loyalist)
// ================================================================

export function classifyNovelty(params: {
  mainstreamScore: number;
  freshnessScore: number;
  smallChannelRatio?: number;
}): { label: PersonalityNovelty; confidence: number; reason: string } {
  const { mainstreamScore, freshnessScore } = params;
  const nicheRatio = params.smallChannelRatio ?? 0;

  const scores = [
    {
      label: 'Explorer' as const,
      // fresh + niche + small channels
      score:
        freshnessScore * 0.5 + (1 - mainstreamScore) * 0.3 + nicheRatio * 0.2,
    },
    {
      label: 'Trendsetter' as const,
      // fresh + mainstream
      score: freshnessScore * 0.5 + mainstreamScore * 0.5,
    },
    {
      label: 'Connoisseur' as const,
      // old taste + niche
      score:
        (1 - freshnessScore) * 0.5 +
        (1 - mainstreamScore) * 0.35 +
        nicheRatio * 0.15,
    },
    {
      label: 'Loyalist' as const,
      // old + mainstream
      score: (1 - freshnessScore) * 0.5 + mainstreamScore * 0.5,
    },
  ];

  const { label, confidence } = marginConfidence(scores);

  const reasons: Record<PersonalityNovelty, string> = {
    Explorer: 'Always finding things nobody else has heard of',
    Connoisseur: "Deep in your niche \u2014 you've been here for years",
    Trendsetter: 'Fresh taste that the rest of the world is catching up to',
    Loyalist: 'Found your people and stay with them',
  };

  return {
    label: label as PersonalityNovelty,
    confidence,
    reason: reasons[label as PersonalityNovelty],
  };
}

// ================================================================
// IDENTITY \u2014 cross-platform coherence (Unified / Shapeshifter / Bridge)
// ================================================================

export function classifyIdentity(params: {
  coherence: number;
  youtubeWeights: CategoryWeights;
  spotifyWeights: CategoryWeights;
}): { label: PersonalityIdentity; confidence: number; reason: string; bridge?: string } {
  const { coherence, youtubeWeights, spotifyWeights } = params;

  const ytHasData = Object.values(youtubeWeights).some(v => v > 0);
  const spHasData = Object.values(spotifyWeights).some(v => v > 0);

  if (!ytHasData || !spHasData) {
    return {
      label: 'Unified',
      confidence: 0.2,
      reason: 'Connect both platforms to reveal your cross-platform identity',
    };
  }

  // Find shared bridge categories (both > 0.1)
  const bridgeCategories: Array<{ cat: string; sharedWeight: number }> = [];
  const allCats = new Set([...Object.keys(youtubeWeights), ...Object.keys(spotifyWeights)]);
  for (const cat of allCats) {
    const y = youtubeWeights[cat] || 0;
    const s = spotifyWeights[cat] || 0;
    if (y > 0.08 && s > 0.08) {
      bridgeCategories.push({ cat, sharedWeight: Math.min(y, s) });
    }
  }
  bridgeCategories.sort((a, b) => b.sharedWeight - a.sharedWeight);

  const scores = [
    {
      label: 'Unified' as const,
      // Coherence near 1, many bridge categories
      score: Math.max(0, coherence - 0.5) * 1.5 + Math.min(1, bridgeCategories.length / 5) * 0.3,
    },
    {
      label: 'Shapeshifter' as const,
      // Coherence near 0
      score: Math.max(0, 0.5 - coherence) * 1.5 + (bridgeCategories.length === 0 ? 0.2 : 0),
    },
    {
      label: 'Bridge' as const,
      // Mid coherence with at least one strong bridge category
      score:
        (1 - Math.abs(coherence - 0.55) * 2) * 0.6 +
        (bridgeCategories.length > 0 ? Math.min(0.4, bridgeCategories[0].sharedWeight * 2) : 0),
    },
  ];

  const { label, confidence } = marginConfidence(scores);
  const bridge = bridgeCategories[0]?.cat;

  const reasons: Record<PersonalityIdentity, string> = {
    Unified: `${Math.round(coherence * 100)}% coherent \u2014 same taste everywhere`,
    Shapeshifter: `Only ${Math.round(coherence * 100)}% overlap \u2014 different person on each platform`,
    Bridge: bridge
      ? `Connected through ${bridge.toLowerCase()} \u2014 everything else diverges`
      : 'Connected at a partial overlap, diverging elsewhere',
  };

  return {
    label: label as PersonalityIdentity,
    confidence,
    reason: reasons[label as PersonalityIdentity],
    bridge,
  };
}

// ================================================================
// COMPOUND PERSONALITY
// ================================================================

export function buildCompoundPersonality(
  tempo: PersonalityTempo,
  novelty: PersonalityNovelty,
  identity: PersonalityIdentity
): string {
  // Preserve the old "Explorer \u00d7 Deep Diver \u00d7 Shapeshifter" format for
  // back-compat. The new evocative title is in signatures.buildCompoundTitle.
  return `${novelty} \u00d7 ${tempo} \u00d7 ${identity}`;
}
