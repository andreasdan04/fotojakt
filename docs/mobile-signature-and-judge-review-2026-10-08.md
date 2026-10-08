# Mobil signering og alle innleveringer – 8. oktober 2026

Signering bruker en HTML-tegneflate med egen høyde og et SVG-lag uten pointer-interaksjon. Den tidligere kombinasjonen av SVG-aspektforhold og minste høyde er fjernet fra tegneflaten. Formens grid og barn kan krympe til mobilbredden, lange ord brytes og navnefeltet har 16 px tekst. Vanlig sidezoom beholdes.

`touch-action: none` og native, ikke-passive `touchstart`/`touchmove`-lyttere stanser nettlesergester bare inne i signaturfeltet. Lytterne fjernes ved unmount. Pointer Events brukes for finger, mus og penn, med Touch Events som fallback der Pointer Events mangler. Ekstra fingre påvirker ikke den aktive streken. Avbrutte streker forkastes uten å slette tidligere fullførte streker. Lagringsformat og eksisterende signeringer er uendret; dette krever ikke ny signering.

Dommerpanelet åpner nå fanen «Alle innleveringer» og gjenbruker eksisterende album-, jakt- og brukerfilter, paginering og bildevisning. Signed staff-tilgang håndheves på liste-, bilde- og skrive-endepunktene. Øvrige adminendepunkter for statistikk, kontomoderering og rapportørdata er fortsatt utilgjengelige for dommere. Den ordinære spillerfeeden beholder sine egne tilgangsgrenser.

Dommere kan markere et uanmeldt bilde ugyldig med obligatorisk begrunnelse. Vurderingen bruker samme transaksjon, historikk, klageflyt, poengberegning og valgfrie varsling som rapporterte bilder. Ingen kan dømme eget bilde. Tidligere avgjørelser kan bare omgjøres av hoveddommer/eier, og dette vises også i innleveringslisten. Registrert jakttid endres ikke ved vanlig vurdering. Innleveringer fra aktive jakter åpnes etter egen levering eller jaktens slutt; fremtidige jaktord er skjult.

## Utført verifikasjon

- `tests/signature-pad.mjs`: bestått med faktisk komponent i React-hook-harness; Pointer/Touch Events, finger/mus/penn, lokale ikke-passive gesture guards, opprydding, ekstra finger, capture/cancel, ferdige/tomme streker, tømming, deaktivert felt, koordinater og CSS-grenser.
- `tests/judges.mjs`: bestått mot produksjons-Workeren med Miniflare/D1/R2. Utvidet med alle innleveringer for dommer/hoveddommer, uanmeldt bilde, begrunnelse, samtidige dommere, blokkert egenvurdering/omgjøring, klage, uendret tid og umiddelbar tilgangssperre etter rollefjerning.
- `tests/admin-submissions.mjs`, `tests/photo-reports.mjs`, `tests/manual-moderation.mjs`, `tests/privacy.mjs`, `tests/judge-migration.mjs`: bestått.
- TypeScript `tsc --noEmit`, produksjonsbygg gjennom Sites/Vinext og `git diff --check`: bestått.
- ESLint for `signature-pad`, `judge-panel`, `judging` og `releases`: bestått. Gjenbrukte eldre innleveringskomponenter/endepunkter har fortsatt eksisterende lintfeil for dynamiske typer/hooks; disse er ikke skjult ved regelendringer.
- Den fullstendige suiten ble ikke kjørt på nytt i denne avgrensede endringen. Forrige runde kjørte alle 47 testfiler med bestått resultat; se `flow-review-2026-10-08.md`.

Dette er automatiserte logikk-, API- og byggkontroller. Ingen fysisk iOS-/Android-/stylus- eller visuell nettlesertest er utført i denne økten. Ingen separat Expo-klient finnes i repositoryet.

Versjonslogg v53 er utvidet med samme dagsoppføring, uten duplikat. Ingen databasemigrering kreves for disse endringene.
