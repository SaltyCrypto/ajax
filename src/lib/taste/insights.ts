// ============================================
// AJAX — Insight / Revelation Generators
// The "how did you know that about me?" engine
//
// These are the secret sauce. Category percentages
// are boring. Contradictions, patterns, and specific
// behavioral observations are what make people
// screenshot the card.
// ============================================

import type { TasteInsight, CategoryWeights, AudioSignature } from '@/types';

interface InsightContext {
  // Category data
  youtubeCategories: CategoryWeights;
  spotifyCategories: CategoryWeights;
  combinedCategories: CategoryWeights;
  genreDetails: Record<string, number>;  // Spotify granular genres

  // Scores
  diversityScore: number;
  mainstreamScore: number;
  freshnessScore: number;
  coherenceScore: number;

  // Audio
  audioSignature: AudioSignature | null;

  // Raw counts
  youtubeSubCount: number;
  youtubeLikeCount: number;
  spotifyArtistCount: number;
  spotifyTrackCount: number;
  spotifySavedCount: number;

  // Derived
  smallChannelCount: number;     // YT channels with <100K subs
  totalChannelCount: number;     // Total YT subscriptions
  avgLikesPerChannel: number;    // How deep they go per channel
  topYoutubeCategory: string;
  topSpotifyCategory: string;
  topSpotifyGenres: string[];    // Actual Spotify genre names

  // Temporal (from Spotify short vs long term)
  shortTermTopCategory?: string;
  longTermTopCategory?: string;
  categoryDrift?: number;         // How much taste shifted recently

  // Personality
  personalityTempo: string;
  personalityNovelty: string;
  personalityIdentity: string;
}

type InsightGenerator = (ctx: InsightContext) => TasteInsight | null;

// ============================================
// THE GENERATORS
// Each returns null if the insight doesn't apply
// ============================================

const crossPlatformContradiction: InsightGenerator = (ctx) => {
  if (ctx.coherenceScore > 0.6) return null; // Too similar, no contradiction
  if (!ctx.topYoutubeCategory || !ctx.topSpotifyCategory) return null;

  const yt = ctx.topYoutubeCategory;
  const sp = ctx.topSpotifyCategory;

  if (yt === sp) return null; // Same top category

  return {
    type: 'contradiction',
    title: 'Double Life',
    body: `Your YouTube is ${yt.toLowerCase()} but your Spotify is ${sp.toLowerCase()}. Your platforms don't know each other exists.`,
    surprise_score: 0.9,
    data: { youtube: yt, spotify: sp, coherence: ctx.coherenceScore },
  };
};

const guiltyPleasureDetector: InsightGenerator = (ctx) => {
  // Categories that appear in likes but barely in subscriptions
  // = they enjoy it but don't commit
  const ytCats = ctx.youtubeCategories;
  const spCats = ctx.spotifyCategories;

  // Find categories present in one platform but absent in the other
  for (const [cat, weight] of Object.entries(ytCats)) {
    if (weight > 0.1 && (!spCats[cat] || spCats[cat] < 0.03)) {
      return {
        type: 'behavior',
        title: 'Secret Side',
        body: `${cat} takes up ${Math.round(weight * 100)}% of your YouTube but barely registers on your Spotify. You watch it but you don't soundtrack it.`,
        surprise_score: 0.75,
        data: { category: cat, youtube_weight: weight, spotify_weight: spCats[cat] || 0 },
      };
    }
  }

  for (const [cat, weight] of Object.entries(spCats)) {
    if (weight > 0.1 && (!ytCats[cat] || ytCats[cat] < 0.03)) {
      return {
        type: 'behavior',
        title: 'Hidden Listener',
        body: `${cat} runs ${Math.round(weight * 100)}% of your Spotify but you never watch it on YouTube. It's a purely sonic obsession.`,
        surprise_score: 0.75,
        data: { category: cat, spotify_weight: weight, youtube_weight: ytCats[cat] || 0 },
      };
    }
  }

  return null;
};

const mainstreamParadox: InsightGenerator = (ctx) => {
  // Different mainstream scores across platforms
  // This is a proxy — we use category variety as indicator
  if (ctx.mainstreamScore < 0.25) {
    return {
      type: 'rarity',
      title: 'Underground Dweller',
      body: `Your average content popularity is in the bottom ${Math.round(ctx.mainstreamScore * 100)}%. You don't consume what's trending — you go looking for what's hidden.`,
      surprise_score: 0.8,
      data: { mainstream_score: ctx.mainstreamScore },
    };
  }

  if (ctx.mainstreamScore > 0.75) {
    return {
      type: 'behavior',
      title: 'Pulse Reader',
      body: `Your taste runs ${Math.round(ctx.mainstreamScore * 100)}% mainstream. You're not following trends — you ARE the trend. What you like today, everyone likes tomorrow.`,
      surprise_score: 0.6,
      data: { mainstream_score: ctx.mainstreamScore },
    };
  }

  return null;
};

const timeRangeDrift: InsightGenerator = (ctx) => {
  if (!ctx.shortTermTopCategory || !ctx.longTermTopCategory) return null;
  if (ctx.shortTermTopCategory === ctx.longTermTopCategory) return null;
  if (!ctx.categoryDrift || ctx.categoryDrift < 0.2) return null;

  return {
    type: 'temporal',
    title: 'Taste in Motion',
    body: `You used to be about ${ctx.longTermTopCategory.toLowerCase()}. Lately you're shifting toward ${ctx.shortTermTopCategory.toLowerCase()}. Something changed recently.`,
    surprise_score: 0.85,
    data: {
      from: ctx.longTermTopCategory,
      to: ctx.shortTermTopCategory,
      drift: ctx.categoryDrift,
    },
  };
};

const audioMoodDetector: InsightGenerator = (ctx) => {
  if (!ctx.audioSignature) return null;

  const { energy, valence, acousticness, instrumentalness } = ctx.audioSignature;

  // Angry music: high energy, low happiness
  if (energy > 0.65 && valence < 0.35) {
    return {
      type: 'audio',
      title: 'Beautiful Rage',
      body: `Your music is intense — high energy but low happiness. You don't listen to feel good. You listen to feel something real.`,
      surprise_score: 0.8,
      data: { energy, valence },
    };
  }

  // Melancholic: low energy, low valence
  if (energy < 0.4 && valence < 0.35) {
    return {
      type: 'audio',
      title: 'Rainy Window',
      body: `Your Spotify sounds like staring out a window on a grey day. Low energy, low brightness — every day is a quiet emotional landscape.`,
      surprise_score: 0.75,
      data: { energy, valence },
    };
  }

  // Pure euphoria: high energy, high valence
  if (energy > 0.7 && valence > 0.65) {
    return {
      type: 'audio',
      title: 'Serotonin Machine',
      body: `Your music is pure dopamine — high energy AND high happiness. Your Spotify is a party that never stops.`,
      surprise_score: 0.65,
      data: { energy, valence },
    };
  }

  // Ambient: high acousticness, low energy
  if (acousticness > 0.6 && energy < 0.4) {
    return {
      type: 'audio',
      title: 'Analog Soul',
      body: `${Math.round(acousticness * 100)}% acoustic, ${Math.round(energy * 100)}% energy. Your music tastes like warm wood and old vinyl. Everything synthetic has been filtered out.`,
      surprise_score: 0.7,
      data: { acousticness, energy },
    };
  }

  // Instrumental listener
  if (instrumentalness > 0.4) {
    return {
      type: 'audio',
      title: 'Beyond Words',
      body: `${Math.round(instrumentalness * 100)}% of your music has no vocals. You don't need someone to tell you how to feel — the instruments do that.`,
      surprise_score: 0.8,
      data: { instrumentalness },
    };
  }

  return null;
};

const rarityDetector: InsightGenerator = (ctx) => {
  if (ctx.totalChannelCount === 0) return null;

  const smallRatio = ctx.smallChannelCount / ctx.totalChannelCount;

  if (smallRatio > 0.5 && ctx.totalChannelCount > 20) {
    return {
      type: 'rarity',
      title: 'Crate Digger',
      body: `${ctx.smallChannelCount} of your ${ctx.totalChannelCount} subscriptions have under 100K subscribers. You don't follow the algorithm — you go looking.`,
      surprise_score: 0.85,
      data: { small_count: ctx.smallChannelCount, total: ctx.totalChannelCount, ratio: smallRatio },
    };
  }

  return null;
};

const depthDetector: InsightGenerator = (ctx) => {
  if (ctx.avgLikesPerChannel < 1 || ctx.youtubeSubCount === 0) return null;

  if (ctx.avgLikesPerChannel > 5) {
    return {
      type: 'behavior',
      title: 'Completionist',
      body: `When you find a channel, you go ALL in. You've liked an average of ${Math.round(ctx.avgLikesPerChannel)} videos per subscription. Most people: 1-2.`,
      surprise_score: 0.7,
      data: { avg_likes_per_channel: ctx.avgLikesPerChannel },
    };
  }

  if (ctx.avgLikesPerChannel < 0.5 && ctx.youtubeSubCount > 100) {
    return {
      type: 'behavior',
      title: 'Collector',
      body: `${ctx.youtubeSubCount} subscriptions but you barely like anything. You collect channels like bookmarks — subscribing is your way of saving something for later.`,
      surprise_score: 0.65,
      data: { sub_count: ctx.youtubeSubCount, avg_likes: ctx.avgLikesPerChannel },
    };
  }

  return null;
};

const diversityInsight: InsightGenerator = (ctx) => {
  if (ctx.diversityScore > 0.85) {
    return {
      type: 'behavior',
      title: 'Taste Polymath',
      body: `Your diversity score is in the top ${Math.round((1 - ctx.diversityScore) * 100)}%. Most people specialize. You refuse to be one thing.`,
      surprise_score: 0.7,
      data: { diversity: ctx.diversityScore },
    };
  }

  if (ctx.diversityScore < 0.3 && Object.values(ctx.combinedCategories).some(v => v > 0.3)) {
    const topCat = Object.entries(ctx.combinedCategories).sort((a, b) => b[1] - a[1])[0];
    return {
      type: 'behavior',
      title: 'Monolith',
      body: `${Math.round(topCat[1] * 100)}% of everything you consume is ${topCat[0].toLowerCase()}. Your algorithm isn't diverse because YOU aren't diverse — and that's not a bad thing.`,
      surprise_score: 0.75,
      data: { diversity: ctx.diversityScore, top: topCat[0], weight: topCat[1] },
    };
  }

  return null;
};

const genreSpecificity: InsightGenerator = (ctx) => {
  if (ctx.topSpotifyGenres.length === 0) return null;

  // Find very specific/niche genres
  const nicheGenres = ctx.topSpotifyGenres.filter(g =>
    g.includes('japanese') || g.includes('korean') || g.includes('brazilian') ||
    g.includes('shoegaze') || g.includes('post-') || g.includes('neo-') ||
    g.includes('city pop') || g.includes('vapor') || g.includes('lo-fi') ||
    g.includes('math') || g.includes('prog') || g.includes('doom') ||
    g.includes('trip') || g.includes('art ')
  );

  if (nicheGenres.length >= 3) {
    const genreList = nicheGenres.slice(0, 3).join(', ');
    return {
      type: 'rarity',
      title: 'Genre Archaeologist',
      body: `${genreList} — your top genres read like a Wikipedia rabbit hole. These aren't algorithmic suggestions, these are deliberate excavations.`,
      surprise_score: 0.85,
      data: { genres: nicheGenres },
    };
  }

  return null;
};

// ============================================
// INSIGHT ENGINE
// ============================================

const ALL_GENERATORS: InsightGenerator[] = [
  crossPlatformContradiction,  // Highest surprise potential
  audioMoodDetector,
  guiltyPleasureDetector,
  timeRangeDrift,
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
      const insight = generator(ctx);
      if (insight) {
        insights.push(insight);
      }
    } catch (err) {
      console.error('[Insights] Generator error:', err);
      // Don't let one failed generator kill all insights
    }
  }

  // Sort by surprise score (most surprising first)
  insights.sort((a, b) => b.surprise_score - a.surprise_score);

  return insights;
}

// Pick the top N insights for card display
export function selectCardInsights(insights: TasteInsight[], count = 3): TasteInsight[] {
  if (insights.length <= count) return insights;

  // Ensure variety: pick from different types if possible
  const selected: TasteInsight[] = [];
  const usedTypes = new Set<string>();

  for (const insight of insights) {
    if (selected.length >= count) break;
    if (!usedTypes.has(insight.type) || selected.length >= count - 1) {
      selected.push(insight);
      usedTypes.add(insight.type);
    }
  }

  // Fill remaining with highest surprise regardless of type
  if (selected.length < count) {
    for (const insight of insights) {
      if (selected.length >= count) break;
      if (!selected.includes(insight)) {
        selected.push(insight);
      }
    }
  }

  return selected;
}

// ============================================
// DESCRIPTION GENERATOR (template-based fallback)
// Used when Anthropic API key is not available
// ============================================

export function generateTemplateDescription(ctx: InsightContext): string {
  const yt = ctx.topYoutubeCategory?.toLowerCase() || '';
  const sp = ctx.topSpotifyCategory?.toLowerCase() || '';
  const genres = ctx.topSpotifyGenres.slice(0, 2).join(' and ');

  // Cross-platform contradiction (most interesting)
  if (ctx.coherenceScore < 0.4 && yt && sp && yt !== sp) {
    const templates = [
      `${yt} on screen, ${genres || sp} in the headphones \u2014 your platforms live parallel lives`,
      `YouTube says ${yt}. Spotify says ${genres || sp}. Both are telling the truth about different versions of you.`,
      `${yt} by day, ${genres || sp} by night \u2014 two algorithms, two identities, one person`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Niche taste
  if (ctx.mainstreamScore < 0.3 && genres) {
    const templates = [
      `Deep in the ${genres} underground, where the algorithm can't reach you`,
      `Your taste is a map of places most people don't know exist \u2014 ${genres} and beyond`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // High diversity
  if (ctx.diversityScore > 0.8) {
    return `Impossible to pin down \u2014 you consume everything and commit to nothing, and that's exactly the point`;
  }

  // Audio-driven
  if (ctx.audioSignature) {
    if (ctx.audioSignature.valence < 0.35 && ctx.audioSignature.energy > 0.6) {
      return `High intensity, low happiness \u2014 your soundtrack runs on controlled fury and ${genres || 'pure energy'}`;
    }
    if (ctx.audioSignature.acousticness > 0.65) {
      return `Your world sounds handmade \u2014 acoustic, warm, and deliberately unplugged from the digital noise`;
    }
  }

  // Default: genre-focused
  if (genres) {
    return `${genres} at the core, with ${yt || 'a visual world'} layered on top \u2014 your taste has texture`;
  }

  return `A taste profile that refuses easy labels \u2014 connect more platforms to reveal the full picture`;
}
