'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Lighter background for analyze page (shader can be heavy on GPU)
const ParticleCanvas = dynamic(() => import('@/components/ParticleCanvas'), { ssr: false });

interface VideoAnalysis {
  title: string;
  channel: string;
  category: string;
  is_clickbait: boolean;
  is_shorts: boolean;
  estimated_quality: 'high' | 'medium' | 'low';
}

interface FeedAnalysis {
  videos: VideoAnalysis[];
  algorithm_personality: string;
  algorithm_roast: string;
  feed_diversity: string;
  feed_quality_score: number;
  top_categories: string[];
  missing_categories: string[];
  assessment: string;
}

interface GapResult {
  match_score: number;
  algorithm_categories: Record<string, number>;
  real_categories: Record<string, number>;
  overlapping: string[];
  missing_from_feed: string[];
  unwanted_in_feed: string[];
  diagnosis: string;
  fix_suggestions: string[];
}

const TOPIC_OPTIONS = [
  'Music', 'Design', 'Architecture', 'Tech', 'Science', 'Cooking & Food',
  'Gaming', 'Film', 'Comedy', 'Education', 'Fitness', 'Travel',
  'Art', 'History', 'Philosophy', 'Nature', 'Fashion', 'Sports',
  'Business', 'True Crime', 'DIY & Crafts', 'Photography',
  'Animation', 'Cars & Auto', 'Dance', 'Wellness',
];

type Stage = 'upload' | 'analyzing' | 'result' | 'pick-interests' | 'gap';

export default function AnalyzePage() {
  const [stage, setStage] = useState<Stage>('upload');
  const [analysis, setAnalysis] = useState<FeedAnalysis | null>(null);
  const [gap, setGap] = useState<GapResult | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const computeGap = useCallback(async (topics: string[]) => {
    if (!analysis) return;
    try {
      const res = await fetch('/api/analyze/gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotAnalysis: analysis,
          manualTopics: topics,
        }),
      });
      const data = await res.json();
      if (data.gap) {
        setGap(data.gap);
        setStage('gap');
      }
    } catch (err) {
      console.error('Gap analysis failed:', err);
    }
  }, [analysis]);

  const handleFile = useCallback(async (file: File) => {
    setStage('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('screenshot', file);

      const res = await fetch('/api/analyze/screenshot', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.analysis);
      setStage('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('upload');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <main className="min-h-screen relative overflow-hidden">
      <ParticleCanvas />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-white">Ajax</span>
        </Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* UPLOAD STAGE */}
          {stage === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.h1
                className="text-4xl md:text-5xl font-display font-bold text-white mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                How well does YouTube
                <br />
                <span className="text-gradient" style={{
                  backgroundImage: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #f97316)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  actually know you?
                </span>
              </motion.h1>

              <motion.p
                className="text-ajax-text-dim text-lg mb-12 max-w-xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Upload a screenshot of your YouTube homepage.
                We&apos;ll show you what the algorithm thinks you are.
              </motion.p>

              {/* How-to steps */}
              <motion.div
                className="flex items-center justify-center gap-6 mb-10 text-sm text-ajax-text-dim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-ajax-accent/20 text-ajax-accent text-xs flex items-center justify-center font-bold">1</span>
                  Open YouTube
                </div>
                <span className="text-ajax-border">&rarr;</span>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-ajax-accent/20 text-ajax-accent text-xs flex items-center justify-center font-bold">2</span>
                  Screenshot homepage
                </div>
                <span className="text-ajax-border">&rarr;</span>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-ajax-accent/20 text-ajax-accent text-xs flex items-center justify-center font-bold">3</span>
                  Upload here
                </div>
              </motion.div>

              {/* Drop zone */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className={`relative border-2 border-dashed rounded-3xl p-16 transition-all duration-300 cursor-pointer group ${
                  dragActive
                    ? 'border-ajax-accent bg-ajax-accent/10 scale-[1.02]'
                    : 'border-ajax-border hover:border-ajax-accent/50 hover:bg-ajax-surface/30'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInputChange}
                />

                <motion.div
                  animate={dragActive ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="text-5xl mb-4">
                    {dragActive ? '🎯' : '📱'}
                  </div>
                  <p className="text-white font-medium text-lg mb-2">
                    {dragActive ? 'Drop it!' : 'Drop your screenshot here'}
                  </p>
                  <p className="text-ajax-text-dim text-sm">
                    or click to browse &middot; PNG, JPG, WebP
                  </p>
                </motion.div>
              </motion.div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm mt-4"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ANALYZING STAGE */}
          {stage === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <motion.div
                className="text-6xl mb-6"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🔬
              </motion.div>
              <h2 className="text-2xl font-display font-bold text-white mb-3">
                Reading your algorithm...
              </h2>
              <p className="text-ajax-text-dim mb-8">
                Analyzing what YouTube thinks you are
              </p>
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-ajax-accent"
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* RESULT STAGE — redesigned for emotional impact */}
          {stage === 'result' && analysis && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* 1. HERO: Personality Label — the screenshot moment */}
              <motion.div
                className="text-center mb-4"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, type: 'spring' }}
              >
                <p className="text-ajax-text-dim text-xs uppercase tracking-widest mb-3">
                  YouTube thinks you&apos;re a
                </p>
                <h1
                  className="text-5xl md:text-7xl font-display font-bold mb-4 chromatic-hover"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #f97316, #ef4444, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {analysis.algorithm_personality}
                </h1>
              </motion.div>

              {/* 2. THE ROAST — the emotional gut punch */}
              <motion.div
                className="card-glass p-6 mb-8 text-center border-red-500/20 glow-accent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-white/90 text-lg leading-relaxed italic">
                  &ldquo;{analysis.algorithm_roast || analysis.assessment}&rdquo;
                </p>
              </motion.div>

              {/* 3. THE SHOCKING STAT — big, impossible to ignore */}
              {(() => {
                const videos = analysis.videos || [];
                const clickbait = videos.filter(v => v.is_clickbait).length;
                const lowQuality = videos.filter(v => v.estimated_quality === 'low').length;
                const highQuality = videos.filter(v => v.estimated_quality === 'high').length;
                const total = videos.length || 1;
                const clickbaitPct = Math.round((clickbait / total) * 100);
                const highPct = Math.round((highQuality / total) * 100);
                const worthWatching = highQuality + videos.filter(v => v.estimated_quality === 'medium').length;

                return (
                  <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <div className="inline-flex items-baseline gap-3 mb-2">
                      <span className="text-6xl md:text-7xl font-display font-bold text-red-400">
                        {clickbaitPct > 30 ? `${clickbaitPct}%` : `${highPct}%`}
                      </span>
                      <span className="text-xl text-ajax-text-dim">
                        {clickbaitPct > 30
                          ? 'of your feed is clickbait'
                          : 'is actually worth watching'}
                      </span>
                    </div>
                    <p className="text-ajax-text-dim text-sm">
                      {clickbaitPct > 30
                        ? `Only ${worthWatching} out of ${total} videos are worth your time.`
                        : `${total - worthWatching} out of ${total} videos are filler content.`}
                    </p>
                  </motion.div>
                );
              })()}

              {/* 4. CTA: "But is this really you?" — ABOVE the details */}
              <motion.div
                className="card-glass p-6 mb-8 text-center border-ajax-accent/30"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <h3 className="text-lg font-display font-bold text-white mb-2">
                  But is this really you?
                </h3>
                <p className="text-ajax-text-dim text-sm mb-4">
                  Tell us what you&apos;re actually into and we&apos;ll show you exactly how wrong YouTube has you.
                </p>
                <motion.button
                  onClick={() => setStage('pick-interests')}
                  className="btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Pick your real interests &rarr;
                </motion.button>
              </motion.div>

              {/* 5. Feed breakdown — supporting evidence, not the hero */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <motion.div
                  className="card-glass p-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 }}
                >
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <span className="text-red-500">&#9679;</span>
                    Your feed is dominated by
                  </h3>
                  <div className="space-y-2">
                    {analysis.top_categories.map((cat, i) => (
                      <motion.div key={cat} className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1 + i * 0.08 }}
                      >
                        <div className="h-2 bg-red-500/20 rounded-full flex-1">
                          <motion.div className="h-full bg-red-500/70 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${90 - i * 18}%` }}
                            transition={{ delay: 1.2 + i * 0.08, duration: 0.5 }}
                          />
                        </div>
                        <span className="text-ajax-text-dim text-sm w-28 text-right">{cat}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* What's missing — now with ACTIONABLE links */}
                <motion.div
                  className="card-glass p-6"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 }}
                >
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <span className="text-ajax-accent">&#9679;</span>
                    YouTube isn&apos;t showing you
                  </h3>
                  <div className="space-y-2">
                    {analysis.missing_categories.map((cat, i) => (
                      <motion.a
                        key={cat}
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(cat + ' channels')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-ajax-accent/10 transition-colors group cursor-pointer"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1 + i * 0.08 }}
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-ajax-accent">+</span>
                          <span className="text-ajax-text">{cat}</span>
                        </span>
                        <span className="text-ajax-accent text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          find channels &rarr;
                        </span>
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* 6. Video list — collapsible, not taking up space */}
              <motion.details
                className="card-glass mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
              >
                <summary className="p-4 cursor-pointer text-white font-semibold flex items-center justify-between">
                  <span>{analysis.videos.length} videos detected in your feed</span>
                  <span className="text-ajax-text-dim text-xs">click to expand</span>
                </summary>
                <div className="px-4 pb-4 space-y-2">
                  {analysis.videos.map((video, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-ajax-border/30 last:border-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        video.estimated_quality === 'high' ? 'bg-green-400' :
                        video.estimated_quality === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{video.title}</p>
                        <p className="text-ajax-text-dim text-xs">{video.channel} &middot; {video.category}</p>
                      </div>
                      {video.is_clickbait && (
                        <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full shrink-0">clickbait</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.details>

              {/* 7. Before/After prompt — return motivation */}
              <motion.div
                className="card-glass p-5 text-center border-ajax-cool/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                <p className="text-ajax-text-dim text-sm">
                  Follow the suggestions above for a week, then screenshot your feed again.
                  <br />
                  <span className="text-ajax-cool font-medium">Track how your algorithm changes over time.</span>
                </p>
              </motion.div>
            </motion.div>
          )}
          {/* PICK INTERESTS STAGE */}
          {stage === 'pick-interests' && (
            <motion.div
              key="pick-interests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <h2 className="text-3xl font-display font-bold text-white mb-3">
                What are you actually into?
              </h2>
              <p className="text-ajax-text-dim mb-8">
                Pick everything that genuinely interests you. Not what you click — what you care about.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {TOPIC_OPTIONS.map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <motion.button
                      key={topic}
                      onClick={() => {
                        setSelectedTopics(prev =>
                          isSelected ? prev.filter(t => t !== topic) : [...prev, topic]
                        );
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-ajax-accent text-white shadow-lg shadow-ajax-accent/25'
                          : 'bg-ajax-surface text-ajax-text-dim border border-ajax-border hover:border-ajax-accent/50'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {topic}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                onClick={() => computeGap(selectedTopics)}
                className="btn-primary text-lg px-10 py-4"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                style={{ opacity: selectedTopics.length >= 2 ? 1 : 0.5 }}
                disabled={selectedTopics.length < 2}
              >
                Show me the gap ({selectedTopics.length} selected)
              </motion.button>

              {selectedTopics.length < 2 && (
                <p className="text-ajax-text-dim text-xs mt-3">Pick at least 2 topics</p>
              )}
            </motion.div>
          )}

          {/* GAP RESULT STAGE */}
          {stage === 'gap' && gap && (
            <motion.div
              key="gap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* The Big Number */}
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, type: 'spring' }}
              >
                <p className="text-ajax-text-dim text-sm uppercase tracking-wider mb-2">
                  Your YouTube is only
                </p>
                <motion.div
                  className="text-8xl md:text-9xl font-display font-bold chromatic-hover"
                  style={{
                    backgroundImage: gap.match_score > 50
                      ? 'linear-gradient(135deg, #34d399, #06b6d4)'
                      : gap.match_score > 25
                        ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                        : 'linear-gradient(135deg, #f97316, #ef4444)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {gap.match_score}%
                </motion.div>
                <p className="text-white text-xl font-medium mt-2">you.</p>
              </motion.div>

              {/* Diagnosis */}
              <motion.div
                className="card-glass p-6 mb-8 glow-accent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-white leading-relaxed">
                  {gap.diagnosis}
                </p>
              </motion.div>

              {/* Side by side comparison */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <motion.div
                  className="card-glass p-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <span className="text-red-500">&#9679;</span>
                    What YouTube shows you
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(gap.algorithm_categories)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([cat, weight], i) => (
                        <motion.div key={cat} className="flex items-center gap-2"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 + i * 0.05 }}
                        >
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${
                                gap.unwanted_in_feed.includes(cat)
                                  ? 'bg-red-500/60'
                                  : gap.overlapping.includes(cat)
                                    ? 'bg-green-500/60'
                                    : 'bg-white/30'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(weight * 100)}%` }}
                              transition={{ delay: 0.7 + i * 0.05, duration: 0.5 }}
                            />
                          </div>
                          <span className="text-ajax-text-dim text-xs w-24 text-right">{cat}</span>
                          {gap.unwanted_in_feed.includes(cat) && (
                            <span className="text-red-400 text-xs">&#10005;</span>
                          )}
                          {gap.overlapping.includes(cat) && (
                            <span className="text-green-400 text-xs">&#10003;</span>
                          )}
                        </motion.div>
                      ))}
                  </div>
                </motion.div>

                <motion.div
                  className="card-glass p-6"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <span className="text-ajax-accent">&#9679;</span>
                    What you actually want
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(gap.real_categories)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([cat, weight], i) => (
                        <motion.div key={cat} className="flex items-center gap-2"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 + i * 0.05 }}
                        >
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${
                                gap.missing_from_feed.includes(cat)
                                  ? 'bg-ajax-accent/80'
                                  : 'bg-green-500/60'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(weight * 100)}%` }}
                              transition={{ delay: 0.7 + i * 0.05, duration: 0.5 }}
                            />
                          </div>
                          <span className="text-ajax-text-dim text-xs w-24 text-right">{cat}</span>
                          {gap.missing_from_feed.includes(cat) && (
                            <span className="text-ajax-accent text-xs">missing</span>
                          )}
                        </motion.div>
                      ))}
                  </div>
                </motion.div>
              </div>

              {/* Fix suggestions */}
              {gap.fix_suggestions.length > 0 && (
                <motion.div
                  className="card-glass p-6 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <h3 className="text-white font-semibold mb-4">
                    How to fix your feed
                  </h3>
                  <div className="space-y-3">
                    {gap.fix_suggestions.map((suggestion, i) => (
                      <motion.div
                        key={i}
                        className="flex gap-3 text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 + i * 0.1 }}
                      >
                        <span className="text-ajax-accent font-bold shrink-0">{i + 1}.</span>
                        <span className="text-ajax-text leading-relaxed">{suggestion}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Share + CTA */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3 }}
              >
                <p className="text-ajax-text-dim text-sm mb-4">
                  Share your score — challenge your friends to check theirs.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => { setStage('upload'); setAnalysis(null); setGap(null); setSelectedTopics([]); }}
                    className="btn-secondary"
                  >
                    Analyze another feed
                  </button>
                  <Link href="/api/auth/youtube" className="btn-primary">
                    Connect accounts for deeper analysis
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
