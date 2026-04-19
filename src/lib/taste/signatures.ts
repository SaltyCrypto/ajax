// ============================================
// AJAX — Sonic Identity (personality 4th axis)
// ============================================
// Maps Spotify audio-feature aggregates onto a named archetype so the
// personality compound can say something concrete about how your music
// FEELS, not just what categories you consume.

import type { AudioSignature } from '@/types';

export type SonicIdentity =
  | 'Melancholic'
  | 'Euphoric'
  | 'Intense'
  | 'Cerebral'
  | 'Dreamy'
  | 'Theatrical'
  | 'Kinetic'
  | 'Balanced';

export interface SonicResult {
  label: SonicIdentity;
  confidence: number;
  reason: string;
}

/**
 * Classify by region in (energy, valence, acousticness, instrumentalness)
 * space. Every region scores the signature; we take the best. Confidence
 * encodes how cleanly the point falls inside a region vs near a boundary.
 */
export function classifySonicIdentity(sig: AudioSignature | null): SonicResult {
  if (!sig) {
    return {
      label: 'Balanced',
      confidence: 0.2,
      reason: 'Not enough music data yet',
    };
  }

  const { energy, valence, acousticness, instrumentalness, danceability } = sig;

  // Archetype prototypes in (energy, valence, acousticness, instrumentalness)
  // space. Scored by how close the signature is to each prototype.
  const archetypes: Array<{ id: SonicIdentity; proto: [number, number, number, number]; note: string }> = [
    { id: 'Melancholic', proto: [0.35, 0.25, 0.55, 0.3], note: 'low energy, low brightness' },
    { id: 'Euphoric', proto: [0.8, 0.8, 0.2, 0.1], note: 'high energy, high happiness' },
    { id: 'Intense', proto: [0.85, 0.3, 0.15, 0.2], note: 'high energy, low happiness' },
    { id: 'Cerebral', proto: [0.4, 0.5, 0.5, 0.7], note: 'mid energy, heavy on instrumentals' },
    { id: 'Dreamy', proto: [0.35, 0.55, 0.7, 0.4], note: 'low energy, acoustic, airy' },
    { id: 'Theatrical', proto: [0.7, 0.55, 0.4, 0.5], note: 'high energy with cinematic instrumentals' },
    { id: 'Kinetic', proto: [0.75, 0.65, 0.1, 0.1], note: 'made for movement' },
  ];

  const point: [number, number, number, number] = [
    energy,
    valence,
    acousticness,
    instrumentalness,
  ];

  let best = archetypes[0];
  let bestDist = Infinity;
  let secondDist = Infinity;
  for (const a of archetypes) {
    const d = Math.sqrt(
      (a.proto[0] - point[0]) ** 2 +
        (a.proto[1] - point[1]) ** 2 +
        (a.proto[2] - point[2]) ** 2 +
        (a.proto[3] - point[3]) ** 2
    );
    if (d < bestDist) {
      secondDist = bestDist;
      bestDist = d;
      best = a;
    } else if (d < secondDist) {
      secondDist = d;
    }
  }

  // If Kinetic is close and danceability is very high, promote it
  if (danceability > 0.75) {
    const kin = archetypes.find(a => a.id === 'Kinetic')!;
    const dKin = Math.sqrt(
      (kin.proto[0] - point[0]) ** 2 +
        (kin.proto[1] - point[1]) ** 2 +
        (kin.proto[2] - point[2]) ** 2 +
        (kin.proto[3] - point[3]) ** 2
    );
    if (dKin < bestDist + 0.15) {
      best = kin;
      bestDist = dKin;
    }
  }

  // Confidence = how much closer the winner is than the runner-up (margin),
  // tempered by absolute closeness.
  const margin = Math.max(0, secondDist - bestDist);
  const closeness = Math.max(0, 1 - bestDist / 1.5); // 1.5 is loose upper bound
  const confidence = Math.min(1, closeness * (0.5 + margin));

  // If everything is near the middle and no archetype wins clearly, mark Balanced
  if (confidence < 0.25) {
    return {
      label: 'Balanced',
      confidence: 0.5,
      reason: 'Audio signature sits between archetypes \u2014 no single mood dominates',
    };
  }

  return {
    label: best.id,
    confidence,
    reason: `${best.note} (energy ${Math.round(energy * 100)}, valence ${Math.round(valence * 100)})`,
  };
}

/**
 * Generate an evocative compound title from the four axes. Replaces the
 * old "Explorer x Deep Diver x Shapeshifter" concatenation with something
 * that reads like a horoscope descriptor.
 */
export function buildCompoundTitle(params: {
  tempo: string;
  novelty: string;
  identity: string;
  sonic: SonicIdentity;
}): string {
  const { tempo, novelty, identity, sonic } = params;

  // Adjectives mined from the 4 axes. The rule picks the two most
  // "informative" (non-default) labels to build a two-word title that
  // reads naturally.
  const sonicAdj: Record<SonicIdentity, string> = {
    Melancholic: 'Melancholic',
    Euphoric: 'Euphoric',
    Intense: 'Restless',
    Cerebral: 'Cerebral',
    Dreamy: 'Dreamy',
    Theatrical: 'Theatrical',
    Kinetic: 'Kinetic',
    Balanced: '',
  };

  const noveltyAdj: Record<string, string> = {
    Explorer: 'Wandering',
    Connoisseur: 'Devoted',
    Trendsetter: 'Forecasting',
    Loyalist: 'Loyal',
  };

  const tempoNoun: Record<string, string> = {
    'Deep Diver': 'Specialist',
    Grazer: 'Polymath',
    Binger: 'Obsessive',
    'Steady Stream': 'Mainstay',
  };

  const identityNoun: Record<string, string> = {
    Unified: 'Whole',
    Shapeshifter: 'Shapeshifter',
    Bridge: 'Bridgemaker',
  };

  // Prefer sonic adjective if set, else novelty adjective
  const adj = sonicAdj[sonic] || noveltyAdj[novelty] || 'Quiet';
  // Prefer tempo noun; fall back to identity noun
  const noun = tempoNoun[tempo] || identityNoun[identity] || 'Listener';

  return `The ${adj} ${noun}`.trim();
}
