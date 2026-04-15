'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import dynamic from 'next/dynamic';

const ParticleCanvas = dynamic(() => import('@/components/ParticleCanvas'), {
  ssr: false,
});

const ShaderBackground = dynamic(() => import('@/components/ShaderBackground'), {
  ssr: false,
});

const GlitchText = dynamic(() => import('@/components/GlitchText'), {
  ssr: false,
  loading: () => <span>Ajax</span>,
});

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function LandingPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const cardY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);
  const cardRotate = useTransform(scrollYProgress, [0, 0.3], [0, -2]);

  return (
    <main ref={containerRef} className="min-h-screen relative overflow-hidden">
      <ParticleCanvas />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-2">
          <GlitchText text="Ajax" className="text-2xl font-display font-bold text-white" />
          <span className="text-xs text-ajax-text-dim bg-ajax-surface/50 backdrop-blur px-2 py-0.5 rounded-full border border-ajax-border">
            beta
          </span>
        </div>
        <Link href="/api/auth/youtube" className="btn-ghost text-sm">
          Sign in
        </Link>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <div className="inline-flex items-center gap-2 text-ajax-accent text-sm font-medium bg-ajax-accent/10 border border-ajax-accent/20 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
            <motion.span
              className="w-1.5 h-1.5 bg-ajax-accent rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            YouTube Astrology
          </div>
        </motion.div>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-5xl md:text-7xl font-display font-bold text-white leading-tight mb-6"
        >
          Your YouTube is only
          <br />
          <motion.span
            className="text-gradient inline-block"
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{ duration: 5, repeat: Infinity }}
            style={{
              backgroundSize: '200% 200%',
              backgroundImage: 'linear-gradient(90deg, #f97316, #ef4444, #f97316)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ___% you
          </motion.span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-xl text-ajax-text-dim max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Upload a screenshot of your YouTube homepage. We&apos;ll show you
          what the algorithm thinks you are, what it&apos;s getting wrong,
          and how to fix it.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link href="/analyze" className="btn-primary text-lg px-10 py-5 shadow-lg shadow-ajax-accent/25">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload a screenshot
              </Link>
            </motion.div>

            <span className="text-ajax-text-dim text-sm">Takes 10 seconds. No sign-up needed.</span>

            <div className="flex items-center gap-3 mt-4">
              <span className="text-ajax-text-dim text-xs">or connect directly:</span>
              <Link href="/api/auth/youtube" className="btn-ghost text-xs px-3 py-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                YouTube
              </Link>
              <Link href="/api/auth/spotify" className="btn-ghost text-xs px-3 py-1.5">
                <svg className="w-3.5 h-3.5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Spotify
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Floating DNA Card */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          style={{ y: cardY, rotate: cardRotate }}
          className="max-w-md mx-auto"
        >
          <motion.div
            className="dna-card-cool rounded-3xl p-8 glow-accent relative overflow-hidden chromatic-hover liquid-hover glow-pulse"
            whileHover={{ scale: 1.03, y: -8 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {/* Animated shimmer */}
            <motion.div
              className="absolute inset-0 opacity-10"
              animate={{
                background: [
                  'linear-gradient(45deg, transparent 30%, rgba(139,92,246,0.3) 50%, transparent 70%)',
                  'linear-gradient(45deg, transparent 60%, rgba(139,92,246,0.3) 80%, transparent 100%)',
                  'linear-gradient(45deg, transparent 30%, rgba(139,92,246,0.3) 50%, transparent 70%)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ajax-accent to-ajax-cool" />
                <span className="text-white/50 text-sm">@you</span>
              </div>

              <motion.div
                className="inline-block px-4 py-2 rounded-xl bg-white/10 border border-white/10 mb-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
              >
                <span className="text-white font-semibold">Explorer &times; Deep Diver &times; Shapeshifter</span>
              </motion.div>

              <p className="text-white/80 text-lg mb-6 leading-relaxed">
                &ldquo;Architecture docs by day, shoegaze by night — your platforms don&apos;t know each other&rdquo;
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <div className="text-white/40 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    YouTube
                  </div>
                  {[
                    { name: 'architecture', w: 28 },
                    { name: 'design essays', w: 22 },
                    { name: 'coding', w: 18 },
                  ].map(({ name, w }, idx) => (
                    <motion.div
                      key={name}
                      className="text-xs text-white/60"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.2 + idx * 0.1 }}
                    >
                      <div className="flex justify-between mb-1">
                        <span>{name}</span>
                        <span className="text-white/30">{w}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-red-500/50 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${w}%` }}
                          transition={{ delay: 1.4 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-white/40 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Spotify
                  </div>
                  {[
                    { name: 'shoegaze', w: 26 },
                    { name: 'japanese jazz', w: 21 },
                    { name: 'ambient', w: 17 },
                  ].map(({ name, w }, idx) => (
                    <motion.div
                      key={name}
                      className="text-xs text-white/60"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.2 + idx * 0.1 }}
                    >
                      <div className="flex justify-between mb-1">
                        <span>{name}</span>
                        <span className="text-white/30">{w}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-green-500/50 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${w}%` }}
                          transition={{ delay: 1.4 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="text-center text-white/20 text-xs font-mono pt-3 border-t border-white/10">
                ajax.app
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <motion.h2
          className="text-3xl font-display font-bold text-white text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How it works
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Connect',
              desc: 'Sign in with YouTube and Spotify. We read your subscriptions, likes, top artists, and saved tracks.',
              gradient: 'from-red-500/20 to-green-500/20',
            },
            {
              step: '02',
              title: 'Reveal',
              desc: 'Our taste engine maps your data across 40 categories, detects cross-platform contradictions, and classifies your personality.',
              gradient: 'from-ajax-accent/20 to-ajax-cool/20',
            },
            {
              step: '03',
              title: 'Share',
              desc: 'Get your DNA card instantly. Share it, compare with friends, discover what your algorithms say about you.',
              gradient: 'from-ajax-warm/20 to-ajax-accent/20',
            },
          ].map(({ step, title, desc, gradient }, idx) => (
            <motion.div
              key={step}
              className={`card-glass p-6 relative overflow-hidden group cursor-default`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, duration: 0.6 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              {/* Hover gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <motion.span
                    className="text-3xl font-display font-bold text-ajax-accent/30"
                    whileHover={{ scale: 1.2, color: 'rgba(139,92,246,0.6)' }}
                  >
                    {step}
                  </motion.span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-ajax-text-dim text-sm leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What we reveal */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <motion.h2
          className="text-3xl font-display font-bold text-white text-center mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          What your algorithms reveal
        </motion.h2>
        <motion.p
          className="text-ajax-text-dim text-center mb-16 max-w-xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          YouTube knows what you watch. Spotify knows what you listen to.
          Only Ajax knows both — and the relationship between them.
        </motion.p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: 'Cross-platform contradictions', desc: 'Your YouTube says tech. Your Spotify says jazz. We find the gap between your platforms.', icon: '~' },
            { title: 'Audio mood signature', desc: 'High energy + low valence = beautiful rage. We read the emotional DNA of your music.', icon: '~' },
            { title: 'Taste personality', desc: 'Explorer, Connoisseur, Binger, or Loyalist? Deep Diver or Grazer? We classify how you consume.', icon: '~' },
            { title: 'Niche detection', desc: "47 channels under 100K subs? You don't follow the algorithm — you go looking.", icon: '~' },
            { title: 'Taste timeline', desc: 'Watch your taste evolve week by week. See who influenced your shifts.', icon: '~' },
            { title: 'Taste twins', desc: 'Find people who consume like you. Compare your DNA. Discover your blind spots.', icon: '~' },
          ].map(({ title, desc }, idx) => (
            <motion.div
              key={title}
              className="card-glass p-5 flex gap-4 group"
              initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08, duration: 0.5 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            >
              <motion.div
                className="w-2 h-2 mt-2 bg-ajax-accent rounded-full shrink-0"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
              />
              <div>
                <h3 className="text-white font-medium mb-1">{title}</h3>
                <p className="text-ajax-text-dim text-sm leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <motion.h2
          className="text-4xl font-display font-bold text-white mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          What&apos;s your Taste DNA?
        </motion.h2>
        <motion.p
          className="text-ajax-text-dim text-lg mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          30 seconds. Two platforms. One revelation.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          <Link href="/api/auth/youtube" className="btn-primary text-lg px-8 py-4 shadow-lg shadow-ajax-accent/25">
            Discover now
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-ajax-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-ajax-text-dim text-sm">
          <span>Ajax &mdash; YouTube Astrology</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
