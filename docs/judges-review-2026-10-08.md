# Dommerroller, signering og klager – 8. oktober 2026

Implementert i eksisterende Foto Jakt, med dagens adminpanel, bildesaker, bonusvurdering, poengberegning, varslingssenter og pushtransport.

## Tilgang og signering

- Eier beholder full administrativ rolle. Administrator kan bruke statistikk, brukeroversikt, person-/meldingsrapporter, bildesaker og klageoversikt, samt administrere dommer/hoveddommer. Bare eier kan administrere administratorer og spill-/erklæringsinnstillinger. Hoveddommer og dommer får et avgrenset arbeidsområde.
- Roller sjekkes på hver forespørsel. Kritiske skrivinger sjekker den eksakte adminsesjonen, aktiv rolle, godkjent konto og gjeldende signeringskrav igjen i samme D1-transaksjon som avgjørelsen. Rolleendringer avslutter både spill- og adminsesjoner, tilbakekaller tidligere aktive signeringer og krever ny innlogging/signering. Fjerning virker også for allerede blokkerte brukere.
- Tidligere administratorer og eier må signere den nye håndskrevne erklæringen. Skrevet navn fra den gamle løsningen gir ikke automatisk signeringstilgang. Eksisterende erklæringer er bevart.
- Signaturfeltet bruker Pointer Events med pointer capture og normaliserte vektorstrekdata for finger, mus og stylus. Tømming, samtidige fingre, avbrudd, grense for antall punkter og tomme/enkelttrykk-signaturer håndteres. Backend validerer data og lagrer bare koordinater, navn, bruker-ID, rolle, tid, versjon og teksten som faktisk ble signert. E-post/postadresse kreves ikke. Vilkårlig SVG eller bildefil aksepteres ikke.
- Eier kan oppdatere teksten. Vesentlige endringer krever ny underskrift før administrativt innsyn; mindre skrivefeil kan rettes uten å tilbakekalle eksisterende aksept. Historikk beholdes. Bare eier og personen selv får signaturdata; administrator ser teamets status, dato og versjon.
- Tilbakekalte signeringer slettes etter 90 dager av eksisterende timebaserte opprydding. Kontoeksport inkluderer egne signeringer, avgjørelser og klager. Kontosletting avslutter rollen og tilbakekaller signeringene. Signaturen dokumenterer kontoens aksept og fremstilles ikke som BankID eller verifisert identitet.

## Vurderinger og klager

- Bonusbilder, rapporterte bilder, egne avgjørelser og hoveddommerens klager/omgjøringer vises i dommerpanelet. Brukerne får samme lyse/mørke tema som resten av appen. Eksisterende bildekomponent gir loading/feilstatus; avgjørelsesknappene åpnes etter at bildet er lastet.
- Avslag og omgjøring krever begrunnelse. Ingen rolle kan dømme eget bilde. Dette gjelder også eldre endepunkter for innleveringer og resultatkorrigering. Eldre resultatkorrigering er begrenset til eier og bruker samme avgjørelses-/habilitetsflyt; normal vurdering endrer ikke registrert tid.
- Spilleren får «Klag på avgjørelsen» med fritekst. Klagen er knyttet til én konkret avgjørelse og kan bare opprettes av bildets eier ved et gjeldende avslag. En hoveddommer eller eier avgjør med begrunnelse. Administrator har klageoversikt, men hoveddommer/eier behandler klagen. Opprinnelig dommer og bildets eier er inhabile i klagen.
- Avgjørelser beholder historikk, mens én avgjørelse er gjeldende per bilde/sakstype. Omgjøring under en åpen klage er sperret. Parallelle avgjørelser/klagesvar kan ikke skrive over hverandre. Poeng er fortsatt avledet fra bildets gyldighet og bonusstatus; ingen nye additive poengtransaksjoner er innført.
- Dommerdata utelater e-post, innloggingsnavn og rapportørens profil. Jaktbilder/ord for aktive jakter beholder kravet om egen levering eller jaktens slutt. Også klageinnsyn følger denne sperren.
- Resultatet vises i appens varslingssenter uavhengig av push. Valgfri push bruker eksisterende Web/Expo-transport, generisk innhold, dedupliserte leveringsnøkler og kontroll av opt-out både ved kølegging og sending.
- Migrering 0033/0034 legger til rolle-, signerings-, avgjørelses-, klage- og pushlagring. Tidligere avslag/bonusavgjørelser importeres med originale begrunnelser og kjent dommer fra eksisterende revisjonslogg der den finnes. Eldre avgjørelser uten tilgjengelig revisjonslogg har ukjent dommer, ikke oppdiktet identitet. Innleveringer, bilder, tider og tidligere erklæringer endres ikke av migreringen. Sakshistorikk/push slettes sammen med bildet.
- Dagens eksisterende spillerlogg v53 er utvidet, uten ny duplisert dagsoppføring.

## Faktisk utført verifikasjon

- Produksjonsbygg via Sites/Vinext: bestått.
- TypeScript `tsc --noEmit`: bestått.
- `git diff --check`: bestått.
- Nye/omskrevne rolle-, signerings-, dommer- og klagemoduler: ESLint bestått, uten feil eller advarsler.
- Alle 45 testfiler i `tests/*.mjs` er kjørt: 30 bestått, 15 feilende eldre testfiler. Hele suiten og berørte integrasjoner er kjørt på nytt etter runtime-endringene. En tilfeldig lynjakt som forstyrret dagsvarseltesten er erstattet av en kontrollert historisk lynjakt i den testens fixture. Produksjonens lynjaktplanlegging er uendret.
- `judges.mjs` kjører den faktiske produksjons-Workeren med Miniflare/D1/R2: rollematrise, personlig dommerinnlogging, signatursperre, tom signatur, gjentatt signering, privat signaturinnsyn, erklæringsversjoner, fjerning/blokkering, gamle API-er, hemmelige aktive jakter, alle rollers egne bilder, samtidige avgjørelser og klager, uavhengig klagebehandler, bilde-/bonusomgjøring, poeng og valgfri Expo-varsling uten doble leveringer.
- `signature-pad.mjs` kjører komponentens faktiske hendelseshåndterere i en lett React-hook-harness for touch, mus og pen: capture, ekstra finger, tomme coalesced-events, fullført strek, enkelttrykk, tømming, deaktivert felt og koordinater. Dette er en test av hendelseslogikk, ikke fysisk skjerm-/nettleserverifikasjon.
- `judge-migration.mjs` starter på gammel databasestruktur med eksisterende innlevering, avslag, revisjonslogg og skrevet erklæring, og kontrollerer bevaring og import etter migrering.
- Eksisterende tester for admininnleveringer/rapporter, manuell moderering, personvern/retensjon, admininnlogging, Oslo/overlapp/samtykke/Web+Expo Push, native push, offline-kø, leaderboard, bonus/poeng og album passerer.

## Gjenstående verifikasjonsgrenser

Ordinær ESLint for hele prosjektet er kjørt og feiler med 797 feil og 79 advarsler, hovedsakelig eksisterende dynamiske typer og React-hook-regler. Reglene er ikke deaktivert. De 15 eldre feilende testfilene er `chat-notifications`, `chat`, `daily`, `groups`, `hunt-extras`, `invitation-notifications`, `photo-reports`, `push`, `replace-word`, `reset-submission`, `season-welcome`, `secret-words`, `system`, `upload-recovery`, `word-descriptions`; disse feilet også i forrige kontrollrunde og rapporteres ikke som bestått.

Støttet Sites-browser-QA er ikke tilgjengelig i denne arbeidsøkten. Fysisk testing av touch/stylus, visuell mobil-QA og kontroll på ekte enheter er ikke utført. Repositoryet har webappen og Expo-backend, men ingen separat React Native-/Expo-klient; ingen ny native binær er bygget/publisert. Backendkontrakten er oppdatert i `expo-personvern.md`.
