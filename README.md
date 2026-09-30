# VIE Projecten

Afgeschermde teamsite: wat Ryan voor VIE bouwt, hoe het in elkaar zit en wat er op de roadmap staat.
Alleen voor accounts op de gastenlijst. Zie `docs/ONTWERP_PROJECTENSITE.md` voor het ontwerp en de beveiliging.

## Opbouw

| Map | Wat | Online? |
|---|---|---|
| `site/` | De website zelf (HTML, CSS, JS, lettertype, supabase-js) | Ja, dit publiceert Netlify |
| `docs/` | Ontwerpdocument | Nee |
| `supabase/` | Databasemigraties voor het project VIE Chatbot | Nee |

Geen build-stap. Netlify publiceert `site/` (zie `netlify.toml`). Elke push naar `main` gaat automatisch live.

## Inhoud bijwerken

Alle inhoud staat in Supabase (project VIE Chatbot), in de tabellen `pr_projecten`, `pr_modules`, `pr_roadmap` en `pr_teksten`.
Bijwerken gaat via de Table Editor. `bijgewerkt_op` wordt automatisch gezet. Geen deploy nodig.

### Roadmap (`pr_roadmap`)

| Kolom | Waarden | Betekenis |
|---|---|---|
| `fase` | `nu`, `volgende`, `afgerond`, `geparkeerd` | Waar het item staat. De periode met `nu` krijgt het rode label |
| `periode` | vrije tekst, bijv. `Oktober` | Items met dezelfde periode komen in één rij |
| `soort` | `minimaal`, `meezit`, `klaar` | Kolom in de planning. Leeg laten bij afgerond en geparkeerd |
| `titel` | tekst | Het item zelf. Bij `klaar` is dit de "Klaar als"-zin |
| `toelichting` | tekst | Kleine grijze regel eronder. Bij geparkeerd: wanneer het weer opgepakt wordt |
| `volgorde` | getal | Sortering. Periodes volgen de volgorde van hun eerste item |

Nieuwe maand: zet de oude `nu`-items op `afgerond` (of schuif ze door) en de nieuwe periode op `nu`.

### Teksten (`pr_teksten`)

Sleutels: `intro`, `uitleg`, `techniek` (pagina 1), `roadmap_intro`, `risicos` (pagina 2).
Eenvoudige opmaak: `###` voor een kopje, `-` voor een opsomming, `**vet**`, tabellen met `|`.

## Gastenlijst beheren

Iemand toevoegen:
1. Supabase, Authentication, Users, Add user, Create new user. Willekeurig wachtwoord, **Auto Confirm User** aan.
2. In de SQL Editor:

```sql
insert into public.pr_toegang (user_id, email, naam)
select id, lower(email), 'Voornaam Achternaam' from auth.users where lower(email) = 'naam@viepeople.com'
returning email, naam;
```

Iemand de toegang afnemen (werkt bij de volgende keer laden):

```sql
update public.pr_toegang set actief = false where email = 'naam@viepeople.com' returning email, actief;
```

Wie staat erop:

```sql
select email, naam, actief from public.pr_toegang order by naam;
```

## Huisregels

- Nooit sleutels, wachtwoorden, wifi-codes of project-refs in de inhoud.
- Nooit de service role key of secret key in `site/config.js`. Daar hoort alleen de publishable/anon key.
- Gastenlijst-SQL met echte namen en adressen niet committen.
