// ============================================
// AJAX — Category Mapping System
// Maps YouTube topics + Spotify genres to
// unified taste categories
// ============================================

// The 46 unified taste categories (v2: +6 mood categories for finer
// emotional granularity — many signals used to collapse to 'Intellectual'
// or 'Emotional' too aggressively).
export const TASTE_CATEGORIES = [
  // Content categories
  'Music', 'Film', 'TV & Series', 'Gaming', 'Tech', 'Science',
  'Design', 'Architecture', 'Art', 'Photography', 'Fashion',
  'Cooking & Food', 'Travel', 'Nature', 'Fitness', 'Sports',
  'History', 'Philosophy', 'Politics', 'Business', 'Education',
  'Comedy', 'True Crime', 'ASMR', 'DIY & Crafts', 'Cars & Auto',
  'Dance', 'Animation', 'Languages', 'Wellness',
  // Mood categories
  'Ambient & Chill', 'High Energy', 'Intellectual', 'Emotional',
  'Funny & Light', 'Intense & Dark', 'Nostalgic', 'Experimental',
  'Spiritual', 'Romantic',
  // New mood categories (v2)
  'Melancholic', 'Euphoric', 'Kinetic', 'Cinematic', 'Meditative', 'Absurdist',
] as const;

export type TasteCategory = typeof TASTE_CATEGORIES[number];

// --- YouTube Topic Category Mapping ---
// YouTube API returns Freebase/Wikipedia topic URLs
// https://developers.google.com/youtube/v3/docs/channels#topicDetails

const YOUTUBE_TOPIC_MAP: Record<string, TasteCategory[]> = {
  // Direct topic URLs
  'https://en.wikipedia.org/wiki/Music': ['Music'],
  'https://en.wikipedia.org/wiki/Electronic_music': ['Music', 'Ambient & Chill'],
  'https://en.wikipedia.org/wiki/Hip_hop_music': ['Music', 'High Energy'],
  'https://en.wikipedia.org/wiki/Rock_music': ['Music', 'High Energy'],
  'https://en.wikipedia.org/wiki/Jazz': ['Music', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Classical_music': ['Music', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Country_music': ['Music', 'Nostalgic'],
  'https://en.wikipedia.org/wiki/Pop_music': ['Music'],
  'https://en.wikipedia.org/wiki/Rhythm_and_blues': ['Music', 'Emotional'],
  'https://en.wikipedia.org/wiki/Soul_music': ['Music', 'Emotional'],
  'https://en.wikipedia.org/wiki/Independent_music': ['Music', 'Experimental'],
  'https://en.wikipedia.org/wiki/Film': ['Film'],
  'https://en.wikipedia.org/wiki/Television': ['TV & Series'],
  'https://en.wikipedia.org/wiki/Video_game': ['Gaming'],
  'https://en.wikipedia.org/wiki/Technology': ['Tech'],
  'https://en.wikipedia.org/wiki/Science': ['Science', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Knowledge': ['Education', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Lifestyle_(sociology)': ['Wellness'],
  'https://en.wikipedia.org/wiki/Health': ['Fitness', 'Wellness'],
  'https://en.wikipedia.org/wiki/Fitness': ['Fitness', 'High Energy'],
  'https://en.wikipedia.org/wiki/Sport': ['Sports', 'High Energy'],
  'https://en.wikipedia.org/wiki/Food': ['Cooking & Food'],
  'https://en.wikipedia.org/wiki/Cooking': ['Cooking & Food'],
  'https://en.wikipedia.org/wiki/Tourism': ['Travel'],
  'https://en.wikipedia.org/wiki/Pet': ['Nature'],
  'https://en.wikipedia.org/wiki/Animal': ['Nature'],
  'https://en.wikipedia.org/wiki/Entertainment': ['Comedy', 'Funny & Light'],
  'https://en.wikipedia.org/wiki/Humor': ['Comedy', 'Funny & Light'],
  'https://en.wikipedia.org/wiki/Society': ['Politics', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Politics': ['Politics'],
  'https://en.wikipedia.org/wiki/Business': ['Business'],
  'https://en.wikipedia.org/wiki/Fashion': ['Fashion'],
  'https://en.wikipedia.org/wiki/Beauty': ['Fashion'],
  'https://en.wikipedia.org/wiki/Automobile': ['Cars & Auto'],
  'https://en.wikipedia.org/wiki/Motorsport': ['Cars & Auto', 'High Energy'],
  'https://en.wikipedia.org/wiki/History': ['History', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Philosophy': ['Philosophy', 'Intellectual'],
  'https://en.wikipedia.org/wiki/Religion': ['Spiritual'],
  'https://en.wikipedia.org/wiki/Art': ['Art'],
  'https://en.wikipedia.org/wiki/Design': ['Design'],
  'https://en.wikipedia.org/wiki/Architecture': ['Architecture', 'Design'],
  'https://en.wikipedia.org/wiki/Photography': ['Photography', 'Art'],
  'https://en.wikipedia.org/wiki/Animation': ['Animation'],
  'https://en.wikipedia.org/wiki/Dance': ['Dance', 'High Energy'],
};

// YouTube video category IDs (from API)
const YOUTUBE_CATEGORY_ID_MAP: Record<string, TasteCategory[]> = {
  '1': ['Film'],                    // Film & Animation
  '2': ['Cars & Auto'],             // Autos & Vehicles
  '10': ['Music'],                  // Music
  '15': ['Nature'],                 // Pets & Animals
  '17': ['Sports', 'High Energy'],  // Sports
  '18': ['Film'],                   // Short Movies
  '19': ['Travel'],                 // Travel & Events
  '20': ['Gaming'],                 // Gaming
  '22': ['Education', 'Intellectual'], // People & Blogs (broad, defaults)
  '23': ['Comedy', 'Funny & Light'],  // Comedy
  '24': ['Comedy', 'Funny & Light'],  // Entertainment
  '25': ['Education', 'Intellectual'], // News & Politics
  '26': ['Fashion'],                // Howto & Style
  '27': ['Education'],              // Education
  '28': ['Science', 'Tech'],        // Science & Technology
  '29': ['Philosophy', 'Intellectual'], // Nonprofits & Activism
  '30': ['Film'],                   // Movies
  '31': ['Animation'],              // Anime/Animation
  '32': ['Comedy'],                 // Action/Adventure
  '33': ['Film'],                   // Classics
  '34': ['Comedy'],                 // Comedy (movies)
  '35': ['Film'],                   // Documentary
  '36': ['Film'],                   // Drama
  '37': ['Film'],                   // Family
  '38': ['Film'],                   // Foreign
  '39': ['Film', 'Intense & Dark'], // Horror
  '40': ['Film'],                   // Sci-Fi/Fantasy
  '41': ['Film', 'Intense & Dark'], // Thriller
  '42': ['Film'],                   // Shorts
  '43': ['TV & Series'],            // Shows
  '44': ['Film'],                   // Trailers
};

// --- Spotify Genre Mapping ---
// Spotify has 5000+ micro-genres. We map patterns to categories.

interface GenreRule {
  pattern: RegExp;
  categories: TasteCategory[];
}

// Rules are evaluated in order. The FIRST matching rule for a given genre
// contributes full weight; subsequent matches contribute with decay (see
// mapSpotifyGenreToCategories). This prevents a single micro-genre like
// "dream pop" from triple-counting 'Music' + 'Emotional' + 'Dreamy' with
// equal weight.
const SPOTIFY_GENRE_RULES: GenreRule[] = [
  // Mood/energy (most specific first)
  { pattern: /shoegaze|dream pop|slowcore|post-rock|math rock/i, categories: ['Music', 'Cinematic', 'Experimental'] },
  { pattern: /ambient|chillwave|lo-?fi|downtempo|drone|new age|sleep/i, categories: ['Ambient & Chill', 'Meditative'] },
  { pattern: /punk|hardcore|metal|thrash|grindcore|death metal|doom|sludge|black metal/i, categories: ['High Energy', 'Intense & Dark'] },
  { pattern: /edm|house|techno|trance|drum and bass|dubstep|rave|hardstyle|breakbeat/i, categories: ['High Energy', 'Kinetic'] },
  { pattern: /sad|melanchol|emo[^t]|depressive|gloom/i, categories: ['Emotional', 'Melancholic'] },
  { pattern: /happy|party|fun|summer|beach|feel-good/i, categories: ['Euphoric', 'Funny & Light'] },
  { pattern: /romantic|love songs|ballad|serenade/i, categories: ['Romantic', 'Emotional'] },
  { pattern: /nostalg|retro|vintage|old school|oldies/i, categories: ['Nostalgic'] },
  { pattern: /experimental|avant[- ]?garde|noise|glitch|abstract|musique concrete/i, categories: ['Experimental', 'Cinematic'] },
  { pattern: /spiritual|gospel|worship|christian|devotional|chant|sacred/i, categories: ['Spiritual'] },
  { pattern: /vaporwave|synthwave|retrowave|darkwave|coldwave/i, categories: ['Nostalgic', 'Experimental', 'Cinematic'] },
  { pattern: /weirdcore|hyperpop|digicore|dariacore/i, categories: ['Experimental', 'Absurdist', 'Kinetic'] },

  // Genre families
  { pattern: /jazz|bebop|bop|swing|dixieland|fusion/i, categories: ['Music', 'Intellectual'] },
  { pattern: /classical|orchestra|symphony|chamber|baroque|opera|romantic era/i, categories: ['Music', 'Intellectual', 'Cinematic'] },
  { pattern: /hip hop|rap|trap|drill|boom bap|grime|phonk/i, categories: ['Music', 'High Energy', 'Kinetic'] },
  { pattern: /(^|\W)rock(\W|$)|grunge|garage rock|psychedelic rock|stoner rock/i, categories: ['Music'] },
  { pattern: /(^|\W)pop(\W|$)|synth-?pop|electro-?pop|art pop|bubblegum/i, categories: ['Music'] },
  { pattern: /indie pop|indie rock|indie folk|bedroom pop/i, categories: ['Music', 'Experimental'] },
  { pattern: /r&b|soul|funk|neo-?soul|motown/i, categories: ['Music', 'Emotional'] },
  { pattern: /folk|acoustic|singer-songwriter|americana/i, categories: ['Music', 'Nostalgic', 'Melancholic'] },
  { pattern: /country|bluegrass|honky|alt-country/i, categories: ['Music', 'Nostalgic'] },
  { pattern: /reggae|ska|dub|dancehall/i, categories: ['Music', 'Kinetic'] },
  { pattern: /latin|salsa|reggaeton|bachata|cumbia|bossa|merengue|tango/i, categories: ['Music', 'Dance', 'Kinetic'] },
  { pattern: /african|afrobeat|afropop|highlife|soukous|amapiano/i, categories: ['Music', 'Kinetic'] },
  { pattern: /k-?pop|j-?pop|c-?pop|city pop|anime/i, categories: ['Music', 'Euphoric'] },
  { pattern: /world|ethnic|tribal|traditional|folkloric/i, categories: ['Music'] },
  { pattern: /soundtrack|score|cinematic|film music|post-minimalism/i, categories: ['Music', 'Film', 'Cinematic'] },
  { pattern: /dance|disco|groove|funky house|nu-disco/i, categories: ['Music', 'Dance', 'Kinetic'] },
  { pattern: /blues|delta|chicago blues/i, categories: ['Music', 'Nostalgic', 'Melancholic'] },

  // Non-music
  { pattern: /podcast|talk show|spoken word/i, categories: ['Education'] },
  { pattern: /comedy|humor|stand-?up/i, categories: ['Comedy', 'Funny & Light', 'Absurdist'] },
  { pattern: /meditat|mindful|yoga|relaxation|binaural/i, categories: ['Wellness', 'Meditative', 'Ambient & Chill'] },
  { pattern: /nature sounds|rain|ocean|forest|birds|ASMR nature/i, categories: ['Nature', 'Ambient & Chill', 'Meditative'] },
  { pattern: /\bASMR\b|tingles/i, categories: ['ASMR', 'Ambient & Chill', 'Meditative'] },
];

// --- Mapping Functions ---

export function mapYouTubeTopicToCategories(topicUrl: string): TasteCategory[] {
  return YOUTUBE_TOPIC_MAP[topicUrl] || [];
}

export function mapYouTubeCategoryIdToCategories(categoryId: string): TasteCategory[] {
  return YOUTUBE_CATEGORY_ID_MAP[categoryId] || ['Education']; // Default fallback
}

export function mapSpotifyGenreToCategories(genre: string): TasteCategory[] {
  const matched: TasteCategory[] = [];

  for (const rule of SPOTIFY_GENRE_RULES) {
    if (rule.pattern.test(genre)) {
      matched.push(...rule.categories);
    }
  }

  // If no specific match, it's still music
  if (matched.length === 0) {
    matched.push('Music');
  }

  return [...new Set(matched)]; // Deduplicate
}

/**
 * Map a genre to weighted category contributions. The first matched rule
 * contributes full weight 1.0 per category; the second 0.6; third 0.36 (0.6
 * geometric decay). This keeps multi-faceted genres (e.g. "progressive
 * psychedelic metal") from triple-dominating the primary signal.
 */
export function mapSpotifyGenreToWeighted(genre: string): Map<TasteCategory, number> {
  const weights = new Map<TasteCategory, number>();
  let ruleHit = 0;
  const decay = 0.6;

  for (const rule of SPOTIFY_GENRE_RULES) {
    if (rule.pattern.test(genre)) {
      const ruleWeight = Math.pow(decay, ruleHit);
      for (const cat of rule.categories) {
        weights.set(cat, (weights.get(cat) || 0) + ruleWeight);
      }
      ruleHit++;
    }
  }

  if (weights.size === 0) weights.set('Music', 1);
  return weights;
}

export function mapSpotifyGenresToCategories(genres: string[]): Map<TasteCategory, number> {
  const counts = new Map<TasteCategory, number>();

  for (const genre of genres) {
    const weighted = mapSpotifyGenreToWeighted(genre);
    for (const [cat, w] of weighted) {
      counts.set(cat, (counts.get(cat) || 0) + w);
    }
  }

  return counts;
}

// Returns the Spotify genre string itself (for fine-grained display)
export function getTopSpotifyGenres(genres: string[], limit = 10): Array<{ genre: string; count: number }> {
  const counts = new Map<string, number>();
  for (const g of genres) {
    // Normalize: lowercase, trim
    const normalized = g.toLowerCase().trim();
    if (normalized) {
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, count]) => ({ genre, count }));
}
