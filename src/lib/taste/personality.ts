// ============================================
// AJAX — Personality Classifier
// Three axes that define your taste identity
// ============================================

import type {
  PersonalityTempo,
  PersonalityNovelty,
  PersonalityIdentity,
  CategoryWeights,
} from '@/types';

// --- TEMPO: How you consume ---

export function classifyTempo(params: {
  categoryWeights: CategoryWeights;
  shortTermWeights?: CategoryWeights;  // From Spotify short_term
  longTermWeights?: CategoryWeights;   // From Spotify long_term
}): { label: PersonalityTempo; confidence: number; reason: string } {
  const weights = params.categoryWeights;
  const significantCategories = Object.values(weights).filter(w => w > 0.05).length;
  const topWeight = Math.max(...Object.values(weights), 0);

  // Check for Binger: big shifts between short and long term
  if (params.shortTermWeights && params.longTermWeights) {
    let drift = 0;
    const allCats = new Set([
      ...Object.keys(params.shortTermWeights),
      ...Object.keys(params.longTermWeights),
    ]);
    for (const cat of allCats) {
      const short = params.shortTermWeights[cat] || 0;
      const long = params.longTermWeights[cat] || 0;
      drift += Math.abs(short - long);
    }

    if (drift > 0.4) {
      return {
        label: 'Binger',
        confidence: Math.min(1, drift / 0.8),
        reason: `Your recent taste has shifted ${Math.round(drift * 100)}% from your long-term pattern`,
      };
    }
  }

  // Deep Diver: few categories, high concentration
  if (significantCategories <= 6 && topWeight > 0.2) {
    return {
      label: 'Deep Diver',
      confidence: Math.min(1, (0.3 - Math.min(significantCategories / 20, 0.3)) * 3 + topWeight),
      reason: `${significantCategories} focused categories, with ${Math.round(topWeight * 100)}% in your top`,
    };
  }

  // Grazer: many categories, spread thin
  if (significantCategories > 12) {
    return {
      label: 'Grazer',
      confidence: Math.min(1, significantCategories / 20),
      reason: `Spread across ${significantCategories} categories — you taste everything`,
    };
  }

  // Steady Stream: moderate, consistent
  return {
    label: 'Steady Stream',
    confidence: 0.6,
    reason: 'Balanced and consistent across your interests',
  };
}

// --- NOVELTY: What you seek ---

export function classifyNovelty(params: {
  mainstreamScore: number;   // 0-1
  freshnessScore: number;    // 0-1
  avgChannelSize?: number;   // Average subscriber count of YT channels
  smallChannelRatio?: number; // % of channels under 100K subs
}): { label: PersonalityNovelty; confidence: number; reason: string } {
  const { mainstreamScore, freshnessScore } = params;

  // Explorer: fresh + niche
  if (freshnessScore > 0.5 && mainstreamScore < 0.4) {
    return {
      label: 'Explorer',
      confidence: Math.min(1, freshnessScore + (1 - mainstreamScore)) / 2,
      reason: 'Always finding new things nobody else has heard of',
    };
  }

  // Trendsetter: fresh + mainstream
  if (freshnessScore > 0.5 && mainstreamScore >= 0.4) {
    return {
      label: 'Trendsetter',
      confidence: Math.min(1, freshnessScore * mainstreamScore * 2),
      reason: 'First to find what everyone will love',
    };
  }

  // Connoisseur: deep niche, not chasing new
  if (freshnessScore <= 0.5 && mainstreamScore < 0.4) {
    return {
      label: 'Connoisseur',
      confidence: Math.min(1, (1 - freshnessScore) + (1 - mainstreamScore)) / 2,
      reason: 'Deep in your niche, you\'ve been here for years',
    };
  }

  // Loyalist: stable, follows what they know
  return {
    label: 'Loyalist',
    confidence: Math.min(1, (1 - freshnessScore) * 1.5),
    reason: 'Found your people, you stay with them',
  };
}

// --- CROSS-PLATFORM IDENTITY ---

export function classifyIdentity(params: {
  coherence: number;  // 0-1 cosine similarity between platform vectors
  youtubeWeights: CategoryWeights;
  spotifyWeights: CategoryWeights;
}): { label: PersonalityIdentity; confidence: number; reason: string; bridge?: string } {
  const { coherence, youtubeWeights, spotifyWeights } = params;

  // Not enough data for cross-platform comparison
  const ytHasData = Object.values(youtubeWeights).some(v => v > 0);
  const spHasData = Object.values(spotifyWeights).some(v => v > 0);

  if (!ytHasData || !spHasData) {
    return {
      label: 'Unified',
      confidence: 0.3,
      reason: 'Connect both platforms to discover your cross-platform identity',
    };
  }

  // Shapeshifter: low coherence
  if (coherence < 0.4) {
    return {
      label: 'Shapeshifter',
      confidence: Math.min(1, (0.4 - coherence) * 3),
      reason: `Only ${Math.round(coherence * 100)}% overlap — you're a different person on each platform`,
    };
  }

  // Unified: high coherence
  if (coherence > 0.7) {
    return {
      label: 'Unified',
      confidence: Math.min(1, (coherence - 0.7) * 3 + 0.5),
      reason: `${Math.round(coherence * 100)}% coherent — same taste everywhere`,
    };
  }

  // Bridge: moderate coherence, find the connecting category
  const bridgeCategories: string[] = [];
  for (const cat of Object.keys(youtubeWeights)) {
    const ytW = youtubeWeights[cat] || 0;
    const spW = spotifyWeights[cat] || 0;
    if (ytW > 0.1 && spW > 0.1) {
      bridgeCategories.push(cat);
    }
  }

  const bridgeName = bridgeCategories[0] || 'music';

  return {
    label: 'Bridge',
    confidence: 0.7,
    reason: `Connected by ${bridgeName.toLowerCase()} — everything else diverges`,
    bridge: bridgeName,
  };
}

// --- COMPOUND PERSONALITY ---

export function buildCompoundPersonality(
  tempo: PersonalityTempo,
  novelty: PersonalityNovelty,
  identity: PersonalityIdentity
): string {
  return `${novelty} \u00d7 ${tempo} \u00d7 ${identity}`;
}
