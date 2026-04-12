# Ajax — YouTube Astrology

## Setup Guide

### Prerequisites
- Node.js 18+
- A Supabase account (free tier works)
- A Google Cloud account
- A Spotify Developer account

---

### Step 1: Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings > API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret key` → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql`
4. Go to **Authentication > Providers** and make sure Email auth is enabled (for the auth.users table)

> **Note:** The pgvector extension must be enabled. The migration does this automatically, but if it fails, go to **Database > Extensions** and enable `vector`.

---

### Step 2: Google / YouTube

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Library** and enable:
   - **YouTube Data API v3**
4. Go to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/youtube/callback`
5. Copy the **Client ID** → `GOOGLE_CLIENT_ID`
6. Copy the **Client Secret** → `GOOGLE_CLIENT_SECRET`
7. Go to **APIs & Services > OAuth consent screen**:
   - User type: **External**
   - Fill in app name, email, etc.
   - Add scopes: `youtube.readonly`, `userinfo.profile`, `userinfo.email`
   - Add yourself as a test user
   - **Submit for verification** (takes 2-6 weeks for public access, but test users work immediately)

> **Important:** While in "Testing" mode, only users you add as test users can sign in. You can add up to 100 test users.

---

### Step 3: Spotify

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:
   - App name: `Ajax`
   - Redirect URI: `http://localhost:3000/api/auth/spotify/callback`
   - APIs: select **Web API**
4. Copy the **Client ID** → `SPOTIFY_CLIENT_ID`
5. Copy the **Client Secret** → `SPOTIFY_CLIENT_SECRET`

> Spotify doesn't require a verification process. Anyone with a Spotify account can sign in immediately.

---

### Step 4: Environment Variables

```bash
cp .env.example .env.local
```

Fill in all the values from steps 1-3.

---

### Step 5: Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### Step 6: Deploy (Vercel)

1. Push to GitHub
2. Connect repo to [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local`
4. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
5. Update Google OAuth redirect URI to `https://your-app.vercel.app/api/auth/youtube/callback`
6. Update Spotify redirect URI to `https://your-app.vercel.app/api/auth/spotify/callback`
7. Deploy

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                    Landing page
│   ├── dashboard/page.tsx          User dashboard (post-login)
│   ├── [username]/page.tsx         Public profile
│   └── api/
│       ├── auth/youtube/           OAuth flow start + callback
│       ├── auth/spotify/           OAuth flow start + callback
│       ├── sync/youtube/           Pull subs + likes from YouTube API
│       ├── sync/spotify/           Pull artists + tracks from Spotify API
│       └── taste/compute/          Run the taste engine
├── lib/
│   ├── oauth/youtube.ts            YouTube OAuth + API helpers
│   ├── oauth/spotify.ts            Spotify OAuth + API helpers
│   ├── supabase/                   Supabase client setup
│   └── taste/
│       ├── engine.ts               Main orchestrator
│       ├── categories.ts           YouTube/Spotify → 40 unified categories
│       ├── vector.ts               64-dim taste vector math
│       ├── personality.ts          3-axis personality classifier
│       └── insights.ts             Revelation generators (the secret sauce)
├── components/
│   ├── DnaCard.tsx                 The taste DNA card
│   └── ShareButtons.tsx            Share to social platforms
└── types/index.ts                  TypeScript type definitions
```

## Data Flow

```
User signs in with Google
  → YouTube OAuth callback
  → Create/find user in Supabase
  → Trigger YouTube sync (background)
    → Fetch subscriptions (paginated)
    → Fetch liked videos (paginated)
    → Fetch channel details (topic categories)
    → Store in Supabase
    → Trigger taste computation

User connects Spotify
  → Spotify OAuth callback
  → Trigger Spotify sync (background)
    → Fetch top artists (3 time ranges)
    → Fetch top tracks (3 time ranges)
    → Fetch audio features for tracks
    → Fetch saved tracks
    → Store in Supabase
    → Trigger taste computation

Taste computation
  → Map YouTube topics → 40 categories
  → Map Spotify genres → 40 categories
  → Combine with platform weighting
  → Compute audio signature
  → Compute scores (diversity, mainstream, freshness, coherence)
  → Build 64-dim taste vector
  → Classify personality (3 axes)
  → Generate insights (9 generators)
  → Generate description (template or AI)
  → Store profile + snapshot
```
