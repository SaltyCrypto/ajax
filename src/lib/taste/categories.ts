// ============================================
// AJAX — Category Mapping System
// Maps YouTube topics + Spotify genres to
// unified taste categories
// ============================================

// The 40 unified taste categories
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

const SPOTIFY_GENRE_RULES: GenreRule[] = [
  // Music mood/energy
  { pattern: /ambient|chillwave|lo-?fi|downtempo|drone|new age|sleep/i, categories: ['Ambient & Chill'] },
  { pattern: /punk|hardcore|metal|thrash|grindcore|death|doom|sludge/i, categories: ['High Energy', 'Intense & Dark'] },
  { pattern: /edm|house|techno|trance|drum and bass|dubstep|rave|hardstyle/i, categories: ['High Energy'] },
  { pattern: /sad|melanchol|emo[^t]|depressive|dark/i, categories: ['Emotional', 'Intense & Dark'] },
  { pattern: /happy|party|fun|summer|beach/i, categories: ['High Energy', 'Funny & Light'] },
  { pattern: /romantic|love|ballad|serenade/i, categories: ['Romantic', 'Emotional'] },
  { pattern: /nostalg|retro|vintage|old school|classic/i, categories: ['Nostalgic'] },
  { pattern: /experimental|avant|noise|glitch|abstract|art /i, categories: ['Experimental'] },
  { pattern: /spiritual|gospel|worship|christian|devotional|chant/i, categories: ['Spiritual'] },

  // Genre families
  { pattern: /jazz|bop|swing|dixieland|fusion/i, categories: ['Music', 'Intellectual'] },
  { pattern: /classical|orchestra|symphony|chamber|baroque|opera/i, categories: ['Music', 'Intellectual'] },
  { pattern: /hip hop|rap|trap|drill|boom bap|grime/i, categories: ['Music', 'High Energy'] },
  { pattern: /rock|grunge|garage|psychedelic|shoegaze|post-rock/i, categories: ['Music'] },
  { pattern: /pop|synth-?pop|electro-?pop|dream pop|indie pop/i, categories: ['Music'] },
  { pattern: /r&b|soul|funk|neo-?soul|motown/i, categories: ['Music', 'Emotional'] },
  { pattern: /folk|acoustic|singer-songwriter|americana/i, categories: ['Music', 'Nostalgic'] },
  { pattern: /country|bluegrass|honky/i, categories: ['Music', 'Nostalgic'] },
  { pattern: /reggae|ska|dub|dancehall/i, categories: ['Music'] },
  { pattern: /latin|salsa|reggaeton|bachata|cumbia|bossa/i, categories: ['Music', 'Dance'] },
  { pattern: /african|afrobeat|highlife|soukous/i, categories: ['Music'] },
  { pattern: /k-?pop|j-?pop|c-?pop|anime|city pop/i, categories: ['Music'] },
  { pattern: /world|ethnic|tribal|traditional/i, categories: ['Music'] },
  { pattern: /soundtrack|score|cinematic|film/i, categories: ['Music', 'Film'] },
  { pattern: /dance|disco|groove/i, categories: ['Music', 'Dance', 'High Energy'] },

  // Non-music
  { pattern: /podcast|talk|spoken/i, categories: ['Education'] },
  { pattern: /comedy|humor|funny/i, categories: ['Comedy', 'Funny & Light'] },
  { pattern: /meditat|mindful|yoga|relaxation/i, categories: ['Wellness', 'Ambient & Chill'] },
  { pattern: /nature|rain|ocean|forest|birds/i, categories: ['Nature', 'Ambient & Chill'] },
  { pattern: /asmr/i, categories: ['ASMR', 'Ambient & Chill'] },
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

export function mapSpotifyGenresToCategories(genres: string[]): Map<TasteCategory, number> {
  const counts = new Map<TasteCategory, number>();

  for (const genre of genres) {
    const categories = mapSpotifyGenreToCategories(genre);
    for (const cat of categories) {
      counts.set(cat, (counts.get(cat) || 0) + 1);
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
