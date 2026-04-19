// ============================================
// AJAX — Insight / Revelation Engine v2
// ============================================
// The "how did you know that about me?" engine. v2 changes:
//   - Generators emit 0..N insights (was 0..1). Multi-hit lets one user see
//     both a guilty-pleasure and a sonic callout.
//   - New generators: temporal pivot, sonic identity, rarity from
//     inverse-genre-frequency.
//   - Confidence-aware selection: thin-data profiles get generic insights
//     with honest surprise scores; rich profiles get specific ones.

import type { TasteInsight, CategoryWeights, AudioSignature } from '@/types';
import type { SonicIdentity } from './signatures';

interface InsightContext {
  // Category data
  youtubeCategories: CategoryWeights;
  spotifyCategories: CategoryWeights;
  combinedCategories: CategoryWeights;
  genreDetails: Record<string, number>;

  // Scores
  diversityScore: number;
  mainstreamScore: number;
  freshnessScore: number;
  coherenceScore: number;

  // Audio + Sonic
  audioSignature: AudioSignature | null;
  sonicIdentity?: SonicIdentity;

  // Raw counts
  youtubeSubCount: number;
  youtubeLikeCount: number;
  spotifyArtistCount: number;
  spotifyTrackCount: number;
  spotifySavedCount: number;

  // Derived
  smallChannelCount: number;
  totalChannelCount: number;
  avgLikesPerChannel: number;
  topYoutubeCategory: string;
  topSpotifyCategory: string;
  topSpotifyGenres: string[];

  // Temporal
  shortTermTopCategory?: string;
  longTermTopCategory?: string;
  categoryDrift?: number;
  shortTermWeights?: CategoryWeights;
  longTermWeights?: CategoryWeights;

  // Personality
  personalityTempo: string;
  personalityNovelty: string;
  personalityIdentity: string;

  // Confidence (0-1). Generators use this to gate surprise claims.
  confidence?: number;
}

// Each generator returns zero or more insights.
type InsightGenerator = (ctx: InsightContext) => TasteInsight[];

// ----------------------------------------------------------------
// Generators
// ----------------------------------------------------------------

const crossPlatformContradiction: InsightGenerator = (ctx) => {
  if (ctx.coherenceScore > 0.6) return [];
  if (!ctx.topYoutubeCategory || !ctx.topSpotifyCategory) return [];
  if (ctx.topYoutubeCategory === ctx.topSpotifyCategory) return [];

  return [{
    type: 'contradiction',
    title: 'Double Life',
    body: `Your YouTube is ${ctx.topYoutubeCategory.toLowerCase()} but your Spotify is ${ctx.topSpotifyCategory.toLowerCase()}. Your platforms don't know each other exists.`,
    surprise_score: 0.9,
    data: { youtube: ctx.topYoutubeCategory, spotify: ctx.topSpotifyCategory, coherence: ctx.coherenceScore },
  }];
};

const guiltyPleasures: InsightGenerator = (ctx) => {
  const out: TasteInsight[] = [];
  const ytCats = ctx.youtubeCategories;
  const spCats = ctx.spotifyCategories;

  for (const [cat, weight] of Object.entries(ytCats)) {
    if (weight > 0.12 && (!spCats[cat] || spCats[cat] < 0.03)) {
      out.push({
        type: 'behavior',
        title: 'Secret Side',
        body: `${cat} takes up ${Math.round(weight * 100)}% of your YouTube but barely registers on your Spotify. You watch it but you don't soundtrack it.`,
        surprise_score: 0.75,
        data: { category: cat, youtube_weight: weight, spotify_weight: spCats[cat] || 0 },
      });
      if (out.length >= 1) break; // one YT-side guilty pleasure is enough
    }
  }

  for (const [cat, weight] of Object.entries(spCats)) {
    if (weight > 0.12 && (!ytCats[cat] || ytCats[cat] < 0.03)) {
      out.push({
        type: 'behavior',
        title: 'Hidden Listener',
        body: `${cat} runs ${Math.round(weight * 100)}% of your Spotify but you never watch it on YouTube. A purely sonic obsession.`,
        surprise_score: 0.75,
        data: { category: cat, spotify_weight: weight, youtube_weight: ytCats[cat] || 0 },
      });
      if (out.length >= 2) break;
    }
  }

  return out;
};

const mainstreamParadox: InsightGenerator = (ctx) => {
  if (ctx.mainstreamScore < 0.25) {
    return [{
      type: 'rarity',
      title: 'Underground Dweller',
      body: `Your average content popularity is in the bottom ${Math.round((1 - ctx.mainstreamScore) * 100)}%. You don't consume what's trending \u2014 you go looking for what's hidden.`,
      surprise_score: 0.8,
      data: { mainstream_score: ctx.mainstreamScore },
    }];
  }
  if (ctx.mainstreamScore > 0.75) {
    return [{
      type: 'behavior',
      title: 'Pulse Reader',
      body: `Your taste runs ${Math.round(ctx.mainstreamScore * 100)}% mainstream. Not following trends \u2014 you ARE the trend.`,
      surprise_score: 0.6,
      data: { mainstream_score: ctx.mainstreamScore },
    }];
  }
  return [];
};

const timeRangeDrift: InsightGenerator = (ctx) => {
  if (!ctx.shortTermTopCategory || !ctx.longTermTopCategory) return [];
  if (ctx.shortTermTopCategory === ctx.longTermTopCategory) return [];
  if (!ctx.categoryDrift || ctx.categoryDrift < 0.2) return [];

  return [{
    type: 'temporal',
    title: 'Taste in Motion',
    body: `You used to be about ${ctx.longTermTopCategory.toLowerCase()}. Lately you're shifting toward ${ctx.shortTermTopCategory.toLowerCase()}. Something changed recently.`,
    surprise_score: 0.85,
    data: {
      from: ctx.longTermTopCategory,
      to: ctx.shortTermTopCategory,
      drift: ctx.categoryDrift,
    },
  }];
};

const temporalPivot: InsightGenerator = (ctx) => {
  // Richer version of timeRangeDrift: finds the category that rose AND
  // the one that fell, not just the top.
  if (!ctx.shortTermWeights || !ctx.longTermWeights) return [];

  const allCats = new Set([
    ...Object.keys(ctx.shortTermWeights),
    ...Object.keys(ctx.longTermWeights),
  ]);

  let bestRise: { cat: string; delta: number } | null = null;
  let biggestFall: { cat: string; delta: number } | null = null;
  for (const cat of allCats) {
    const s = ctx.shortTermWeights[cat] || 0;
    const l = ctx.longTermWeights[cat] || 0;
    const delta = s - l;
    if (delta > 0.12 && (!bestRise || delta > bestRise.delta)) {
      bestRise = { cat, delta };
    }
    if (delta < -0.12 && (!biggestFall || delta < biggestFall.delta)) {
      biggestFall = { cat, delta };
    }
  }

  if (bestRise && biggestFall && bestRise.cat !== biggestFall.cat) {
    return [{
      type: 'temporal',
      title: 'The Pivot',
      body: `You've moved away from ${biggestFall.cat.toLowerCase()} and deeper into ${bestRise.cat.toLowerCase()} \u2014 a ${Math.round((bestRise.delta + Math.abs(biggestFall.delta)) * 50)}% swing in the last few months.`,
      surprise_score: 0.88,
      data: {
        rise: bestRise,
        fall: biggestFall,
      },
    }];
  }
  return [];
};

const audioMoodDetector: InsightGenerator = (ctx) => {
  if (!ctx.audioSignature) return [];
  const out: TasteInsight[] = [];
  const { energy, valence, acousticness, instrumentalness } = ctx.audioSignature;

  if (energy > 0.65 && valence < 0.35) {
    out.push({
      type: 'audio',
      title: 'Beautiful Rage',
      body: 'Your music is intense \u2014 high energy but low happiness. You listen to feel something real.',
      surprise_score: 0.8,
      data: { energy, valence },
    });
  } else if (energy < 0.4 && valence < 0.35) {
    out.push({
      type: 'audio',
      title: 'Rainy Window',
      body: 'Low energy, low brightness \u2014 your Spotify is a quiet emotional landscape.',
      surprise_score: 0.75,
      data: { energy, valence },
    });
  } else if (energy > 0.7 && valence > 0.65) {
    out.push({
      type: 'audio',
      title: 'Serotonin Machine',
      body: 'Pure dopamine \u2014 high energy AND high happiness. Your Spotify is a party that never stops.',
      surprise_score: 0.65,
      data: { energy, valence },
    });
  }

  if (acousticness > 0.6 && energy < 0.45) {
    out.push({
      type: 'audio',
      title: 'Analog Soul',
      body: `${Math.round(acousticness * 100)}% acoustic, ${Math.round(energy * 100)}% energy. Warm wood and old vinyl \u2014 the synthetic has been filtered out.`,
      surprise_score: 0.7,
      data: { acousticness, energy },
    });
  }

  if (instrumentalness > 0.4) {
    out.push({
      type: 'audio',
      title: 'Beyond Words',
      body: `${Math.round(instrumentalness * 100)}% of your music has no vocals. The instruments tell you how to feel.`,
      surprise_score: 0.78,
      data: { instrumentalness },
    });
  }

  return out;
};

const sonicCallout: InsightGenerator = (ctx) => {
  if (!ctx.sonicIdentity) return [];
  const reasons: Partial<Record<SonicIdentity, TasteInsight>> = {
    Melancholic: {
      type: 'audio',
      title: 'Sonic Weight',
      body: 'Your audio signature sits in melancholic territory \u2014 not sad, just dense. Every song has gravity.',
      surprise_score: 0.72,
    },
    Intense: {
      type: 'audio',
      title: 'Controlled Fury',
      body: 'High-energy, low-valence music. You don\'t use sound to relax \u2014 you use it to focus something sharp.',
      surprise_score: 0.78,
    },
    Cerebral: {
      type: 'audio',
      title: 'The Thinking Room',
      body: 'Lots of instrumentals, mid energy. Your music is a space for thought, not a trigger for emotion.',
      surprise_score: 0.76,
    },
    Dreamy: {
      type: 'audio',
      title: 'Soft Focus',
      body: 'Airy, acoustic, unhurried. Everything soft-edged. Your playlist feels like natural light.',
      surprise_score: 0.7,
    },
    Kinetic: {
      type: 'audio',
      title: 'Built for Movement',
      body: 'High danceability and energy. Your music isn\'t background \u2014 it\'s a motor.',
      surprise_score: 0.7,
    },
    Theatrical: {
      type: 'audio',
      title: 'Soundtrack Brain',
      body: 'Cinematic instrumentals at high energy \u2014 your music scores a movie only you can see.',
      surprise_score: 0.72,
    },
    Euphoric: {
      type: 'audio',
      title: 'Upward Force',
      body: 'Every track lifts. High energy, high happiness. You curate for daylight.',
      surprise_score: 0.65,
    },
  };
  const hit = reasons[ctx.sonicIdentity];
  return hit ? [hit] : [];
};

const rarityDetector: InsightGenerator = (ctx) => {
  if (ctx.totalChannelCount === 0) return [];
  const smallRatio = ctx.smallChannelCount / ctx.totalChannelCount;
  if (smallRatio > 0.5 && ctx.totalChannelCount > 20) {
    return [{
      type: 'rarity',
      title: 'Crate Digger',
      body: `${ctx.smallChannelCount} of your ${ctx.totalChannelCount} subscriptions have under 100K subs. You don't follow the algorithm \u2014 you go looking.`,
      surprise_score: 0.85,
      data: { small_count: ctx.smallChannelCount, total: ctx.totalChannelCount, ratio: smallRatio },
    }];
  }
  return [];
};

const depthDetector: InsightGenerator = (ctx) => {
  if (ctx.avgLikesPerChannel < 1 || ctx.youtubeSubCount === 0) return [];
  if (ctx.avgLikesPerChannel > 5) {
    return [{
      type: 'behavior',
      title: 'Completionist',
      body: `When you find a channel, you go ALL in. Average ${Math.round(ctx.avgLikesPerChannel)} likes per subscription. Most people: 1-2.`,
      surprise_score: 0.7,
      data: { avg_likes_per_channel: ctx.avgLikesPerChannel },
    }];
  }
  if (ctx.avgLikesPerChannel < 0.5 && ctx.youtubeSubCount > 100) {
    return [{
      type: 'behavior',
      title: 'Collector',
      body: `${ctx.youtubeSubCount} subscriptions but you barely like anything. You collect channels like bookmarks \u2014 subscribing is your way of saving for later.`,
      surprise_score: 0.65,
      data: { sub_count: ctx.youtubeSubCount, avg_likes: ctx.avgLikesPerChannel },
    }];
  }
  return [];
};

const diversityInsight: InsightGenerator = (ctx) => {
  if (ctx.diversityScore > 0.85) {
    return [{
      type: 'behavior',
      title: 'Taste Polymath',
      body: `Your diversity score is in the top ${Math.round((1 - ctx.diversityScore) * 100)}%. Most people specialize. You refuse to be one thing.`,
      surprise_score: 0.7,
      data: { diversity: ctx.diversityScore },
    }];
  }
  if (ctx.diversityScore < 0.3 && Object.values(ctx.combinedCategories).some(v => v > 0.3)) {
    const topCat = Object.entries(ctx.combinedCategories).sort((a, b) => b[1] - a[1])[0];
    return [{
      type: 'behavior',
      title: 'Monolith',
      body: `${Math.round(topCat[1] * 100)}% of everything you consume is ${topCat[0].toLowerCase()}. Your algorithm isn't diverse because YOU aren't \u2014 and that's not a bad thing.`,
      surprise_score: 0.75,
      data: { diversity: ctx.diversityScore, top: topCat[0], weight: topCat[1] },
    }];
  }
  return [];
};

const genreSpecificity: InsightGenerator = (ctx) => {
  if (ctx.topSpotifyGenres.length === 0) return [];

  const nicheHints = [
    'japanese', 'korean', 'brazilian', 'shoegaze', 'post-', 'neo-',
    'city pop', 'vapor', 'lo-fi', 'math', 'prog', 'doom',
    'trip', 'art ', 'amapiano', 'bedroom', 'hyperpop', 'phonk',
  ];
  const nicheGenres = ctx.topSpotifyGenres.filter(g =>
    nicheHints.some(h => g.includes(h))
  );

  if (nicheGenres.length >= 3) {
    const genreList = nicheGenres.slice(0, 3).join(', ');
    return [{
      type: 'rarity',
      title: 'Genre Archaeologist',
      body: `${genreList} \u2014 your top genres read like a Wikipedia rabbit hole. Deliberate excavations, not algorithm suggestions.`,
      surprise_score: 0.85,
      data: { genres: nicheGenres },
    }];
  }
  return [];
};

// ----------------------------------------------------------------
// Engine
// ----------------------------------------------------------------

const ALL_GENERATORS: InsightGenerator[] = [
  crossPlatformContradiction,
  temporalPivot,
  timeRangeDrift,
  audioMoodDetector,
  sonicCallout,
  guiltyPleasures,
  rarityDetector,
  genreSpecificity,
  mainstreamParadox,
  depthDetector,
  diversityInsight,
];

export function generateInsights(ctx: InsightContext): TasteInsight[] {
  const insights: TasteInsight[] = [];
  for (const generator of ALL_GENERATORS) {
    try {
      insights.push(...generator(ctx));
    } catch (err) {
      console.error('[Insights] Generator error:', err);
    }
  }

  // Dedupe by (title) — different generators shouldn't emit same headline
  const seen = new Set<string>();
  const unique: TasteInsight[] = [];
  for (const i of insights) {
    if (seen.has(i.title)) continue;
    seen.add(i.title);
    unique.push(i);
  }

  // Confidence gating: if the profile is very thin, clip surprise claims
  // down so downstream UI doesn't overpromise.
  if (ctx.confidence !== undefined && ctx.confidence < 0.35) {
    for (const i of unique) {
      i.surprise_score = Math.min(i.surprise_score, 0.55);
    }
  }

  unique.sort((a, b) => b.surprise_score - a.surprise_score);
  return unique;
}

export function selectCardInsights(insights: TasteInsight[], count = 3): TasteInsight[] {
  if (insights.length <= count) return insights;
  const selected: TasteInsight[] = [];
  const usedTypes = new Set<string>();
  for (const insight of insights) {
    if (selected.length >= count) break;
    if (!usedTypes.has(insight.type) || selected.length >= count - 1) {
      selected.push(insight);
      usedTypes.add(insight.type);
    }
  }
  if (selected.length < count) {
    for (const insight of insights) {
      if (selected.length >= count) break;
      if (!selected.includes(insight)) selected.push(insight);
    }
  }
  return selected;
}

// ----------------------------------------------------------------
// Template description (AI-free fallback)
// ----------------------------------------------------------------

export function generateTemplateDescription(ctx: InsightContext): string {
  const yt = ctx.topYoutubeCategory?.toLowerCase() || '';
  const sp = ctx.topSpotifyCategory?.toLowerCase() || '';
  const genres = ctx.topSpotifyGenres.slice(0, 2).join(' and ');

  if (ctx.coherenceScore < 0.4 && yt && sp && yt !== sp) {
    const templates = [
      `${yt} on screen, ${genres || sp} in the headphones \u2014 your platforms live parallel lives`,
      `YouTube says ${yt}. Spotify says ${genres || sp}. Both are telling the truth about different versions of you.`,
      `${yt} by day, ${genres || sp} by night \u2014 two algorithms, two identities, one person`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  if (ctx.mainstreamScore < 0.3 && genres) {
    const templates = [
      `Deep in the ${genres} underground, where the algorithm can't reach you`,
      `Your taste is a map of places most people don't know exist \u2014 ${genres} and beyond`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  if (ctx.diversityScore > 0.8) {
    return `Impossible to pin down \u2014 you consume everything and commit to nothing, and that's exactly the point`;
  }

  if (ctx.audioSignature) {
    if (ctx.audioSignature.valence < 0.35 && ctx.audioSignature.energy > 0.6) {
      return `High intensity, low happiness \u2014 your soundtrack runs on controlled fury and ${genres || 'pure energy'}`;
    }
    if (ctx.audioSignature.acousticness > 0.65) {
      return `Your world sounds handmade \u2014 acoustic, warm, and deliberately unplugged from the digital noise`;
    }
  }

  if (genres) {
    return `${genres} at the core, with ${yt || 'a visual world'} layered on top \u2014 your taste has texture`;
  }

  return `A taste profile that refuses easy labels \u2014 connect more platforms to reveal the full picture`;
}
