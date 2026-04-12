import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-ajax-accent/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-ajax-cool/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-ajax-warm/5 rounded-full blur-[200px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-white">Ajax</span>
          <span className="text-xs text-ajax-text-dim bg-ajax-surface px-2 py-0.5 rounded-full border border-ajax-border">
            beta
          </span>
        </div>
        <Link href="/api/auth/youtube" className="btn-ghost text-sm">
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="animate-in">
          <div className="inline-flex items-center gap-2 text-ajax-accent text-sm font-medium bg-ajax-accent/10 border border-ajax-accent/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 bg-ajax-accent rounded-full animate-pulse" />
            YouTube Astrology
          </div>
        </div>

        <h1 className="animate-in stagger-1 text-5xl md:text-7xl font-display font-bold text-white leading-tight mb-6">
          Your algorithms know
          <br />
          <span className="text-gradient">who you really are</span>
        </h1>

        <p className="animate-in stagger-2 text-xl text-ajax-text-dim max-w-2xl mx-auto mb-12 leading-relaxed">
          Connect your YouTube and Spotify. We&apos;ll read your subscriptions, likes, and
          listening history to reveal your cross-platform taste identity.
          It&apos;s a personality test — but with real data.
        </p>

        <div className="animate-in stagger-3 flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/api/auth/youtube" className="btn-primary text-lg px-8 py-4">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </Link>
          <span className="text-ajax-text-dim text-sm">Takes 30 seconds. No credit card.</span>
        </div>

        {/* Preview card mockup */}
        <div className="animate-in stagger-4 max-w-md mx-auto">
          <div className="dna-card-cool rounded-3xl p-8 glow-accent">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-white/20" />
              <span className="text-white/50 text-sm">@you</span>
            </div>
            <div className="inline-block px-4 py-2 rounded-xl bg-white/10 border border-white/10 mb-4">
              <span className="text-white font-semibold">Explorer &times; Deep Diver &times; Shapeshifter</span>
            </div>
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
                ].map(({ name, w }) => (
                  <div key={name} className="text-xs text-white/60 flex justify-between">
                    <span>{name}</span>
                    <span className="text-white/30">{w}%</span>
                  </div>
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
                ].map(({ name, w }) => (
                  <div key={name} className="text-xs text-white/60 flex justify-between">
                    <span>{name}</span>
                    <span className="text-white/30">{w}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center text-white/20 text-xs font-mono pt-3 border-t border-white/10">
              ajax.app
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-display font-bold text-white text-center mb-16">
          How it works
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Connect',
              desc: 'Sign in with YouTube and Spotify. We read your subscriptions, likes, top artists, and saved tracks.',
              icon: '🔗',
            },
            {
              step: '02',
              title: 'Reveal',
              desc: 'Our taste engine maps your data across 40 categories, detects cross-platform contradictions, and classifies your personality.',
              icon: '🧬',
            },
            {
              step: '03',
              title: 'Share',
              desc: 'Get your DNA card instantly. Share it, compare with friends, discover what your algorithms say about you.',
              icon: '📡',
            },
          ].map(({ step, title, desc, icon }) => (
            <div key={step} className="card-glass p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{icon}</span>
                <span className="text-ajax-accent font-mono text-sm">{step}</span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
              <p className="text-ajax-text-dim text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we reveal */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-display font-bold text-white text-center mb-4">
          What your algorithms reveal
        </h2>
        <p className="text-ajax-text-dim text-center mb-16 max-w-xl mx-auto">
          YouTube knows what you watch. Spotify knows what you listen to.
          Only Ajax knows both — and the relationship between them.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: 'Cross-platform contradictions', desc: 'Your YouTube says tech. Your Spotify says jazz. We find the gap between your platforms.' },
            { title: 'Audio mood signature', desc: 'High energy + low valence = beautiful rage. We read the emotional DNA of your music.' },
            { title: 'Taste personality', desc: 'Explorer, Connoisseur, Binger, or Loyalist? Deep Diver or Grazer? We classify how you consume.' },
            { title: 'Niche detection', desc: '47 channels under 100K subs? You don\'t follow the algorithm — you go looking.' },
            { title: 'Taste timeline', desc: 'Watch your taste evolve week by week. See who influenced your shifts.' },
            { title: 'Taste twins', desc: 'Find people who consume like you. Compare your DNA. Discover your blind spots.' },
          ].map(({ title, desc }) => (
            <div key={title} className="card-glass p-5 flex gap-4">
              <div className="w-2 h-2 mt-2 bg-ajax-accent rounded-full shrink-0" />
              <div>
                <h3 className="text-white font-medium mb-1">{title}</h3>
                <p className="text-ajax-text-dim text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-display font-bold text-white mb-4">
          What&apos;s your Taste DNA?
        </h2>
        <p className="text-ajax-text-dim text-lg mb-8">
          30 seconds. Two platforms. One revelation.
        </p>
        <Link href="/api/auth/youtube" className="btn-primary text-lg px-8 py-4">
          Discover now
        </Link>
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
