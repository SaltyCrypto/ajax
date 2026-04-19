-- ============================================
-- Prediction Engine v2 — new profile columns
-- ============================================
-- Adds the Sonic Identity axis, the evocative compound title, and the
-- three confidence scores computed by the v2 engine. All are optional
-- (NULL-able) so existing profiles remain valid until recomputed.

alter table if exists taste_profiles
  add column if not exists personality_sonic text,
  add column if not exists compound_title text,
  add column if not exists confidence numeric,
  add column if not exists confidence_youtube numeric,
  add column if not exists confidence_spotify numeric;

comment on column taste_profiles.personality_sonic is
  'Sonic Identity (4th personality axis): Melancholic/Euphoric/Intense/Cerebral/Dreamy/Theatrical/Kinetic/Balanced';

comment on column taste_profiles.compound_title is
  'Evocative 2-3 word title derived from the four personality axes, e.g. "The Restless Specialist"';

comment on column taste_profiles.confidence is
  'Overall confidence (0-1) in the profile based on data volume and cross-platform coverage';
