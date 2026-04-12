'use client';

import { type CardData, type CategoryWeights, type TasteInsight } from '@/types';

// Determine card theme from taste data
function getCardTheme(data: CardData): string {
  const cats = data.youtube_categories;
  const musicWeight = (cats['Music'] || 0) + (data.spotify_categories['Music'] || 0);
  const techWeight = (cats['Tech'] || 0) + (cats['Science'] || 0) + (cats['Education'] || 0);

  if (data.mainstream_score < 0.3) return 'dna-card-niche';
  if (musicWeight > techWeight * 1.5) return 'dna-card-warm';
  if (techWeight > musicWeight) return 'dna-card-cool';
  return 'dna-card';
}

// Format category weights for display
function topCategories(weights: CategoryWeights, limit = 4): Array<{ name: string; weight: number }> {
  return Object.entries(weights)
    .filter(([, w]) => w > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, weight]) => ({ name, weight }));
}

interface DnaCardProps {
  data: CardData;
  size?: 'full' | 'compact';
  showInsight?: boolean;
}

export default function DnaCard({ data, size = 'full', showInsight = true }: DnaCardProps) {
  const theme = getCardTheme(data);
  const ytCats = topCategories(data.youtube_categories);
  const spCats = topCategories(data.spotify_categories);
  const isCompact = size === 'compact';

  return (
    <div className={`${theme} relative overflow-hidden ${isCompact ? 'rounded-2xl p-5' : 'rounded-3xl p-8'}`}>
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {data.avatar_url && (
            <img
              src={data.avatar_url}
              alt=""
              className={`rounded-full border-2 border-white/20 ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}
            />
          )}
          <span className={`text-white/60 ${isCompact ? 'text-sm' : 'text-base'}`}>
            @{data.username}
          </span>
        </div>

        {/* Personality Label */}
        <div className={`mb-4 ${isCompact ? 'mb-3' : 'mb-5'}`}>
          <div className={`inline-block px-4 py-2 rounded-xl bg-white/10 border border-white/10 ${isCompact ? 'text-sm' : ''}`}>
            <span className="text-white font-semibold tracking-wide">
              {data.personality_compound}
            </span>
          </div>
        </div>

        {/* One-liner description */}
        <p className={`text-white/90 leading-relaxed mb-6 ${isCompact ? 'text-sm mb-4' : 'text-lg'}`}>
          &ldquo;{data.description}&rdquo;
        </p>

        {/* Platform breakdowns */}
        <div className={`grid grid-cols-2 gap-4 ${isCompact ? 'gap-3 mb-4' : 'mb-6'}`}>
          {/* YouTube */}
          {ytCats.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.5 6.5a3.07 3.07 0 0 0-2.16-2.17C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.34.47A3.07 3.07 0 0 0 .5 6.5 32.15 32.15 0 0 0 0 12a32.15 32.15 0 0 0 .5 5.5 3.07 3.07 0 0 0 2.16 2.17c1.84.47 9.34.47 9.34.47s7.5 0 9.34-.47a3.07 3.07 0 0 0 2.16-2.17A32.15 32.15 0 0 0 24 12a32.15 32.15 0 0 0-.5-5.5z" />
                  <polygon fill="white" points="9.75,15.02 15.5,12 9.75,8.98" />
                </svg>
                <span className={`text-white/50 font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>YouTube</span>
              </div>
              <div className="space-y-2">
                {ytCats.map(({ name, weight }) => (
                  <div key={name}>
                    <div className="flex justify-between mb-1">
                      <span className={`text-white/70 ${isCompact ? 'text-xs' : 'text-sm'}`}>{name.toLowerCase()}</span>
                      <span className={`text-white/40 ${isCompact ? 'text-xs' : 'text-sm'}`}>{Math.round(weight * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/60 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.round(weight * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spotify */}
          {spCats.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                <span className={`text-white/50 font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Spotify</span>
              </div>
              <div className="space-y-2">
                {spCats.map(({ name, weight }) => (
                  <div key={name}>
                    <div className="flex justify-between mb-1">
                      <span className={`text-white/70 ${isCompact ? 'text-xs' : 'text-sm'}`}>{name.toLowerCase()}</span>
                      <span className={`text-white/40 ${isCompact ? 'text-xs' : 'text-sm'}`}>{Math.round(weight * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500/60 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.round(weight * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insight */}
        {showInsight && data.top_insight && (
          <div className={`bg-white/5 border border-white/10 rounded-xl ${isCompact ? 'p-3 mb-3' : 'p-4 mb-6'}`}>
            <div className={`text-white/40 font-medium mb-1 ${isCompact ? 'text-xs' : 'text-xs uppercase tracking-wider'}`}>
              {data.top_insight.title}
            </div>
            <p className={`text-white/80 ${isCompact ? 'text-xs' : 'text-sm'} leading-relaxed`}>
              {data.top_insight.body}
            </p>
          </div>
        )}

        {/* Spectrum bars */}
        <div className={`space-y-2 ${isCompact ? 'mb-3' : 'mb-6'}`}>
          <SpectrumBar label="Niche" labelRight="Mainstream" value={data.mainstream_score} compact={isCompact} />
          <SpectrumBar label="Deep" labelRight="Wide" value={data.diversity_score} compact={isCompact} />
          <SpectrumBar label="Stable" labelRight="Shifting" value={data.freshness_score} compact={isCompact} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center pt-2 border-t border-white/10">
          <span className={`text-white/30 font-mono ${isCompact ? 'text-xs' : 'text-sm'}`}>
            ajax.app
          </span>
        </div>
      </div>
    </div>
  );
}

function SpectrumBar({
  label,
  labelRight,
  value,
  compact,
}: {
  label: string;
  labelRight: string;
  value: number;
  compact: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-white/40 ${compact ? 'text-[10px] w-12' : 'text-xs w-16'} text-right`}>{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full relative">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white/60 rounded-full transition-all duration-1000"
          style={{ left: `calc(${value * 100}% - 5px)` }}
        />
      </div>
      <span className={`text-white/40 ${compact ? 'text-[10px] w-16' : 'text-xs w-16'}`}>{labelRight}</span>
    </div>
  );
}
