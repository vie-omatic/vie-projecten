# Ontwerp: VIE Projecten (teamsite)

Stand 30 september 2026. Status: stap 0 t/m 2 live, stap 3 (pagina Wat we bouwen) opgeleverd.

## Doel

Eén plek waar het team ziet wat Ryan voor VIE bouwt, waarom, hoe het technisch in elkaar zit en wat er op de planning staat. Vervangt het roadmap-dashboard op Netlify Drop.

Klein houden: twee pagina's plus een inlogscherm.

## Wie mag erin

- Zeven collega's plus Ryan. De gastenlijst staat alleen in de database, niet in de repo.
- Ryan is de enige beheerder.
- Geen zelfregistratie. Wie niet op de lijst staat, ziet niets, ook niet na inloggen.

## Pagina's

**Inlogscherm**
- E-mailadres invullen, inloglink per mail (magic link).
- Na inloggen zonder toegang: melding "Je hebt geen toegang, vraag Ryan."

**Pagina 1: Wat we bouwen** (gebouwd in stap 3)
1. Intro met de eerstvolgende mijlpaal en het verschil tussen Status en Gelanceerd (`pr_teksten`, sleutel `intro`).
2. Alle projecten: tabel per categorie (status, gelanceerd bij VIE'ers, AI, Supabase, Netlify, Git). Klik op een project voor doel, opbouw, adres, AI en open punten (`pr_projecten`).
3. viehr uitgelegd: uit de onepager, het gebouw, de rollen, wat AI doet en begrippen (`pr_teksten`, sleutel `uitleg`), plus de modules (`pr_modules`).
4. Techniek: Supabase-organisaties en projecten, Netlify, overige diensten (`pr_teksten`, sleutel `techniek`).

Teksten zijn eenvoudige markdown: `###` kopjes, `-` opsommingen, `**vet**`, tabellen met `|`. Alles wordt eerst ge-escaped, HTML in de database doet dus niets.

**Pagina 2: Roadmap**
1. Mijlpaal: 1 december, Scorecards werkend voor de pilotklant.
2. Planning per periode tot half december (uit de A4-planning van september): minimaal en als het meezit.
3. Geparkeerd, met de reden waarom.
4. Open punten en risico's.

Onderaan elke pagina: "Laatst bijgewerkt op", automatisch uit de database.

## Beveiliging

Het principe: **de site is een leeg omhulsel, de inhoud zit achter de database.**

| Laag | Wat | Waarom |
|---|---|---|
| Netlify | Alleen opmaak, inlogscherm en code. Geen projectinformatie in de bestanden | Wie de broncode opent, ziet niets |
| Supabase Auth | Persoonlijke login met magic link. Accounts maakt Ryan zelf aan, de site maakt nooit zelf accounts aan | Geen zelfregistratie |
| Gastenlijst | Tabel met account-id's van de acht mensen | Toegang hangt aan het account, niet alleen aan een e-mailadres |
| RLS | Elke tabel is alleen leesbaar als je account op de gastenlijst staat en actief is | Het echte slot. Zonder lijst geeft de database een lege lijst terug, ook als je de sleutel uit de code haalt |
| Schrijven | Geen schrijfregels voor gebruikers. Bijwerken alleen door Ryan via de Table Editor van Supabase | Minder aanvalsoppervlak |
| Zichtbaarheid | noindex en robots.txt, zodat Google de site niet opneemt | Niet vindbaar |

**Waarom toegang op account-id en niet alleen op e-mailadres.** De tabellen komen in het project VIE Chatbot, waar ook de Rekenmachine en de pollingtool draaien en waar inschrijven openstaat. E-mailbevestiging staat daar aan, maar een lijst op account-id blijft veilig, ook als die instelling ooit omgaat.

**Extra slot op de tabellen.** Naast RLS krijgen de `pr_`-tabellen geen rechten voor anon. Ingelogde gebruikers mogen alleen lezen. Mocht RLS ooit per ongeluk uit gaan, dan geeft de database nog steeds niets vrij.

**Huisregel voor de inhoud.** Projectnamen, opbouw, plannen en risico's mogen erop. Sleutels, wachtwoorden, wifi-codes en project-refs nooit.

## Waar het draait

- **Supabase:** tabellen met voorvoegsel `pr_` in het bestaande Pro-project VIE Chatbot. Geen extra kosten en geen slaapstand. Een eigen project kost circa $10 per maand extra, en in de Free-organisatie is geen plek.
- **Mail:** de inloglinks gaan via Resend (noreply@viehr.com, afzendernaam "VIE People", zie besluiten). De standaardmailer van Supabase haalt maar een paar mails per uur, dat is te krap voor acht mensen.
- **Netlify:** statische site (HTML, CSS en JS, Supabase via CDN), auto-deploy vanuit GitHub.
- **GitHub:** nieuwe private repo onder vie-omatic, vanaf dag één.
- **Adres:** subdomein van viepeople.com via Vimexx. Werknaam: projecten.viepeople.com.

## Datamodel

| Tabel | Inhoud |
|---|---|
| `pr_toegang` | account-id, e-mail (kleine letters), naam, actief |
| `pr_projecten` | naam, korte omschrijving, categorie, status, gelanceerd (ja/nee/n.v.t.), AI (ja/nee plus toelichting), Supabase, Netlify, Git, doel, opbouw, open punten, volgorde, bijgewerkt_op |
| `pr_modules` | viehr-modules: naam, status, AI, volgende stap, volgorde |
| `pr_roadmap` | titel, gekoppeld project, periode, fase (nu, volgende, geparkeerd), toelichting, volgorde |
| `pr_teksten` | vrije tekstblokken per sleutel: uitleg, techniek, mijlpaal, risico's (markdown) |

Toegangscheck in één functie, `pr_heeft_toegang()`. Deze functie krijgt `revoke all ... from public` plus een expliciete grant aan authenticated, zoals afgesproken voor alle nieuwe Postgres-functies. Alle leesregels verwijzen naar die functie.

## Bouwstappen

Elke stap eindigt met een test door Ryan. De volgende stap begint pas na "werkt".

0. **Inventaris VIE Chatbot (alleen lezen).** Welke triggers hangen aan nieuwe accounts (de Rekenmachine maakt bij elke inschrijving een profiel aan), hoe staan de auth-instellingen, is er al eigen SMTP. Geen wijzigingen.
1. **Database.** Tabellen, RLS, functie, Resend-SMTP, redirect-URL. De gastenlijst vult Ryan zelf in via de SQL Editor, na het aanmaken van de acht accounts.
   Test: ingelogd met een account dat niet op de lijst staat, komt er niets terug.
2. **Skelet.** Repo, inlogscherm, geen-toegang-melding, uitloggen, Netlify en subdomein.
   Test: Ryan komt erin, een privéadres niet.
3. **Pagina 1** met de inhoud uit het Word-document en de onepager.
4. **Pagina 2** met de roadmap en de open punten.
5. **Livegang.** Eerst één collega laten meekijken, dan de rest uitnodigen. Daarna het oude dashboard op Netlify Drop verwijderen.

## Beveiligingstest voor livegang

- Uitgelogd: in de broncode en het netwerkverkeer staat geen projectinformatie.
- Een account dat niet op de lijst staat, ziet de melding en krijgt uit de database een lege lijst.
- Een collega van de lijst ziet alles.
- Iemand op inactief zetten: bij de volgende keer laden is de toegang weg.

## Bewust niet (nu)

- Beheerscherm op de site zelf. Bijwerken gaat via de Table Editor.
- Koppeling met de roadmap-module in viehr.
- Meer dan twee pagina's.

## Besluiten (30 sept)

1. Naam en adres: VIE Projecten op projecten.viepeople.com (werknaam, kan nog wijzigen tot stap 2).
2. Inloggen met een inloglink per mail (magic link).
3. Tabellen in het bestaande Pro-project VIE Chatbot.

Gevolg van besluit 3: SMTP-instellingen en afzendernaam gelden voor het hele project, dus ook voor mails van de Rekenmachine. Afzendernaam wordt daarom neutraal: "VIE People".

## Uitkomst stap 0 (30 sept)

- Voorvoegsel `pr_` is vrij.
- Ryan en Babet hebben al een account (Rekenmachine), die worden hergebruikt. Zes nieuwe accounts.
- Trigger `handle_new_hr_user` maakt voor elk nieuw account een leeg Rekenmachine-profiel. Geaccepteerd, onschuldig.
- `sessions` en `votes` zijn van de pollingtool, die draait ook in dit project.
- Eigen SMTP stond uit. Site URL is de Rekenmachine, die blijft staan. Nog geen redirect-URL's.
- Vondst: RLS stond uit op `handbook_paginas`, terwijl anon alle rechten had. Los van de teamsite dichtgezet; de bot-functies gebruiken de service role.
