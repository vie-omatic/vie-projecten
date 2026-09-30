-- VIE Projecten - stap 4: roadmap
-- Voegt aan pr_roadmap de kolom soort toe, voor de drie kolommen per periode:
--   minimaal = dit moet af, ook in een slechte maand
--   meezit   = als het meezit
--   klaar    = klaar als (één regel per periode)
-- Voor geparkeerde en afgeronde items blijft soort leeg.
-- RLS, rechten en de bijgewerkt-trigger van pr_roadmap blijven zoals in 001.

alter table public.pr_roadmap
  add column soort text check (soort in ('minimaal', 'meezit', 'klaar'));
