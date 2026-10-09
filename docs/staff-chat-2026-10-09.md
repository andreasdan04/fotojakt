# Dommerteam under Diskusjon – 9. oktober 2026

En privat samtale kalt «Dommerteam» vises i eksisterende samtaleliste under Diskusjon. Den samler eier, administratorer, hoveddommere og dommere som har en aktiv rolle, godkjent konto og gjeldende signert taushetserklæring. Ingen manuelt vedlikeholdt gruppemedlemsliste er nødvendig.

Eksisterende meldings-, svar-, reaksjons-, vedleggs- og leseflyt gjenbrukes. Uleste meldinger vises på samtalekortet og i bjellen. Teamchatten bruker vanlig personlig spillinnlogging, også native bearer-token; administrasjon trenger ikke låses opp for hver chatsamtale. Bare eier/administrator kan slette andres teammeldinger. Andre teammedlemmer kan slette egne meldinger.

Sentral romautorisasjon kontrolleres på liste/meldinger, alle chatoperasjoner og vedlegg/bilder. Sending og reaksjoner kontrollerer rolle og signeringskrav igjen i selve SQL-skrivingen. Rollefjerning og vesentlig erklæringsendring sperrer nye forespørsler. Historikken beholdes for gjenværende teammedlemmer. Ingen melding, forhåndsvisning, leseliste, bjellevarsel eller vedlegg fra teamchatten gis til vanlige spillere eller usignerte teammedlemmer. Generell gruppe-/vennetilgang er uendret.

Eksisterende lagring, persondataeksport, kontosletting og ett års meldingsretensjon gjenbrukes. Privat chat sendes ikke automatisk til AI. Ingen ny pushkanal eller obligatorisk varsling er innført. Ingen databasemigrering kreves.

## Kjørte kontroller

- `tests/staff-chat.mjs`: produksjons-Worker med Miniflare/D1/R2, rollematrise/signering, native bearer, private oversikter og bjelle, deduplisert sending, svar, reaksjoner, lesestatus, vedlegg, slettetilgang, rolle-/signeringsrevokering og bevart historikk.
- `tests/chat.mjs`, `tests/chat-notifications.mjs`, `tests/chat-media.mjs`, `tests/privacy.mjs`: relevante regresjonstester.
- TypeScript `tsc --noEmit` og produksjonsbygg via Sites/Vinext.
- ESLint for den nye `staff-chat`-modulen og versjonsloggen; eksisterende øvrige lintfeil er ikke fjernet eller skjult.
- `git diff --check`.

Alle ovennevnte kontroller er bestått. Visuell nettleser-/mobil-QA er ikke utført; støttet browser-QA er ikke tilgjengelig i denne økten. Ingen separat Expo-klient er bygget.

Versjonslogg: ny dagsversjon v54 for 2026-10-09, uten å endre tidligere dagsversjoner.
