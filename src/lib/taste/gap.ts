// ============================================
// AJAX — Algorithmic Gap Analysis
// Computes the match between what YouTube shows you
// (from screenshot) vs who you actually are
// (from Spotify/OAuth/manual input)
// ============================================

import type { CategoryWeights } from '@/types';

interface ScreenshotCategories {
  top_categories: string[];
  videos: Array<{
    category: string;
    is_clickbait: boolean;
    is_shorts: boolean;
    estimated_quality: string;
  }>;
  feed_quality_score: number;
}

interface RealTasteProfile {
  category_weights: CategoryWeights;    // from OAuth taste engine
  youtube_categories: CategoryWeights;  // YouTube-specific
  spotify_categories: CategoryWeights;  // Spotify-specific
  top_genres: string[];                 // Spotify granular genres
}

interface ManualTasteInput {
  selected_topics: string[];  // topics user picked manually
}

export interface GapAnalysis {
  match_score: number;              // 0-100, the viral number
  algorithm_categories: Record<string, number>;  // what YouTube shows
  real_categories: Record<string, number>;        // who you really are
  overlapping: string[];            // categories in both
  missing_from_feed: string[];      // real taste NOT in feed
  unwanted_in_feed: string[];       // feed categories NOT in real taste
  diagnosis: string;                // human-readable explanation
  fix_suggestions: string[];        // actionable advice
}

// Normalize category names for comparison
// Screenshot categories are free-text from Vision AI
// Taste profile categories are from our fixed taxonomy
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Music': ['music', 'songs', 'musical', 'audio'],
  'Tech': ['tech', 'technology', 'software', 'programming', 'coding', 'computers'],
  'Gaming': ['gaming', 'games', 'video games', 'esports'],
  'Cooking & Food': ['cooking', 'food', 'recipe', 'recipes', 'cuisine', 'chef'],
  'Design': ['design', 'graphic design', 'ui', 'ux', 'interior design'],
  'Architecture': ['architecture', 'buildings', 'urban design', 'urban planning'],
  'Science': ['science', 'physics', 'chemistry', 'biology', 'space'],
  'Education': ['education', 'educational', 'learning', 'tutorial', 'how-to', 'how to'],
  'Comedy': ['comedy', 'funny', 'humor', 'meme', 'memes', 'entertainment'],
  'Film': ['film', 'movies', 'cinema', 'movie review'],
  'Sports': ['sports', 'football', 'basketball', 'soccer', 'athletics'],
  'News': ['news', 'politics', 'current events', 'political'],
  'Fashion': ['fashion', 'beauty', 'style', 'makeup', 'clothing'],
  'Fitness': ['fitness', 'workout', 'exercise', 'gym', 'health'],
  'Travel': ['travel', 'vlog', 'destination', 'tourism'],
  'Nature': ['nature', 'animals', 'wildlife', 'outdoors', 'pets'],
  'Art': ['art', 'painting', 'drawing', 'illustration', 'creative'],
  'History': ['history', 'historical', 'documentary', 'ancient'],
  'Philosophy': ['philosophy', 'philosophical', 'ethics', 'thinking'],
  'Business': ['business', 'finance', 'investing', 'entrepreneurship', 'startup'],
  'True Crime': ['true crime', 'crime', 'mystery', 'investigation'],
  'DIY & Crafts': ['diy', 'crafts', 'woodworking', 'maker', 'handmade'],
  'Cars & Auto': ['cars', 'automotive', 'auto', 'vehicles', 'racing'],
  'Animation': ['animation', 'anime', 'cartoon', 'animated'],
  'ASMR': ['asmr'],
  'Ambient & Chill': ['ambient', 'chill', 'relaxing', 'lofi', 'lo-fi'],
  'Viral & Clickbait': ['viral', 'clickbait', 'reaction', 'challenge', 'prank'],
};

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();

  for (const [canonical, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some(s => lower.includes(s))) {
      return canonical;
    }
  }

  // Return title-cased original if no match
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function buildScreenshotCategoryWeights(data: ScreenshotCategories): Record<string, number> {
  const counts: Record<string, number> = {};
  const videos = data.videos || [];

  for (const video of videos) {
    const normalized = normalizeCategory(video.category);
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  // Normalize to percentages
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  const weights: Record<string, number> = {};
  for (const [cat, count] of Object.entries(counts)) {
    weights[cat] = count / total;
  }

  return weights;
}

function buildRealCategoryWeights(
  profile?: RealTasteProfile | null,
  manual?: ManualTasteInput | null
): Record<string, number> {
  if (profile) {
    // Use the combined category weights from the taste engine
    return profile.category_weights;
  }

  if (manual && manual.selected_topics.length > 0) {
    // Equal weight for manually selected topics
    const weight = 1 / manual.selected_topics.length;
    const weights: Record<string, number> = {};
    for (const topic of manual.selected_topics) {
      weights[normalizeCategory(topic)] = weight;
    }
    return weights;
  }

  return {};
}

// Cosine similarity between two category weight maps
function categorySimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of allKeys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export function computeGap(params: {
  screenshot: ScreenshotCategories;
  realProfile?: RealTasteProfile | null;
  manualInput?: ManualTasteInput | null;
}): GapAnalysis {
  const { screenshot, realProfile, manualInput } = params;

  const algorithmWeights = buildScreenshotCategoryWeights(screenshot);
  const realWeights = buildRealCategoryWeights(realProfile, manualInput);

  // If no real taste data, use the screenshot's own quality score
  if (Object.keys(realWeights).length === 0) {
    return {
      match_score: screenshot.feed_quality_score || 50,
      algorithm_categories: algorithmWeights,
      real_categories: {},
      overlapping: [],
      missing_from_feed: [],
      unwanted_in_feed: [],
      diagnosis: 'Connect YouTube or Spotify to see how well your algorithm actually knows you.',
      fix_suggestions: ['Connect your accounts to unlock the full algorithmic gap analysis.'],
    };
  }

  // Compute match score via cosine similarity
  const rawSimilarity = categorySimilarity(algorithmWeights, realWeights);
  const matchScore = Math.round(rawSimilarity * 100);

  // Find overlapping categories (in both feed and real taste)
  const algoCats = new Set(Object.keys(algorithmWeights).filter(k => algorithmWeights[k] > 0.05));
  const realCats = new Set(Object.keys(realWeights).filter(k => realWeights[k] > 0.05));

  const overlapping = [...algoCats].filter(c => realCats.has(c));
  const missingFromFeed = [...realCats].filter(c => !algoCats.has(c));
  const unwantedInFeed = [...algoCats].filter(c => !realCats.has(c));

  // Clickbait/shorts ratio
  const videos = screenshot.videos || [];
  const clickbaitRatio = videos.filter(v => v.is_clickbait).length / (videos.length || 1);
  const shortsRatio = videos.filter(v => v.is_shorts).length / (videos.length || 1);

  // Generate diagnosis
  let diagnosis = '';
  if (matchScore < 25) {
    diagnosis = `Your YouTube algorithm is severely misaligned — it's showing you a completely different person's feed. Only ${matchScore}% of what it serves matches who you actually are.`;
  } else if (matchScore < 50) {
    diagnosis = `Your algorithm has a partial picture of you but it's missing major parts of your identity. ${missingFromFeed.join(', ')} — things you genuinely care about — are nowhere in your feed.`;
  } else if (matchScore < 75) {
    diagnosis = `Your algorithm knows you decently but there's room to improve. It's got your ${overlapping.join(' and ')} right, but it's also pushing ${unwantedInFeed.join(', ')} that you don't care about.`;
  } else {
    diagnosis = `Your algorithm actually knows you well — ${matchScore}% match is unusually high. Your feed reflects your real interests with minimal noise.`;
  }

  if (clickbaitRatio > 0.3) {
    diagnosis += ` Also: ${Math.round(clickbaitRatio * 100)}% of your feed is clickbait — the algorithm is optimizing for your clicks, not your interests.`;
  }

  // Fix suggestions
  const fixSuggestions: string[] = [];

  if (missingFromFeed.length > 0) {
    fixSuggestions.push(
      `Search for and watch 2-3 videos about ${missingFromFeed[0].toLowerCase()} this week. YouTube's algorithm responds quickly to new watch patterns.`
    );
  }

  if (unwantedInFeed.length > 0) {
    fixSuggestions.push(
      `Use "Not interested" on ${unwantedInFeed[0].toLowerCase()} videos in your feed. This trains the algorithm to stop showing them.`
    );
  }

  if (clickbaitRatio > 0.2) {
    fixSuggestions.push(
      'Stop clicking thumbnails with ALL CAPS titles and shocked faces. Each click reinforces the algorithm\'s clickbait model of you.'
    );
  }

  if (shortsRatio > 0.3) {
    fixSuggestions.push(
      'Shorts train a separate algorithm that bleeds into your main feed. Watch fewer Shorts to clean up your homepage.'
    );
  }

  if (missingFromFeed.length > 1) {
    fixSuggestions.push(
      `Subscribe to 3-5 channels in ${missingFromFeed.slice(0, 2).join(' and ').toLowerCase()}. Subscriptions are the strongest signal to reshape your feed.`
    );
  }

  return {
    match_score: matchScore,
    algorithm_categories: algorithmWeights,
    real_categories: realWeights,
    overlapping,
    missing_from_feed: missingFromFeed,
    unwanted_in_feed: unwantedInFeed,
    diagnosis,
    fix_suggestions: fixSuggestions,
  };
}
