# PHOTO HUNT – Family Edition

Norsk, mobiltilpasset fotojakt med navn, personlig PIN og godkjenning av medlemmer.

## Oppstart
Åpne `/admin` og bruk administrator-PIN fra Sites-hemmeligheten `ADMIN_PIN`. Det kreves ingen ChatGPT-konto. Deltakere registrerer navn og en sekssifret PIN og venter på godkjenning. Innlogging huskes i 90 dager med en HttpOnly-cookie; administratortilgang varer i 8 timer. PIN lagres som saltet PBKDF2-SHA256 (100 000 iterasjoner), og innloggingsforsøk begrenses. Eksisterende medlemmer får personlig PIN under Medlemmer → Lag PIN og beholder identitet, bilder og poeng. Ny PIN tilbakekaller gamle innlogginger og pushabonnementer. `ADMIN_EMAIL` er valgfri profilinformasjon for administrator, ikke en innloggingskontroll.

Opprett et album med navn og datoer (1–31 dager). OpenAI lager alle ordene atomisk ved opprettelse. OPENAI_API_KEY er en Sites-hemmelighet. Modellen gpt-4.1-mini instrueres om vanlige gjenstander/dyr/natur på Vestvågøy, ett norsk bokmålsord per dag fra en kontrollert ordbank. Serveren beholder gyldige AI-valg og erstatter enkeltord som er ugyldige eller gjentas for tett, uten å avvise hele albumet. Et ord kan gjentas med minst 7 kalenderdagers mellomrom, maksimalt to ganger per album. Album støtter 1–31 dager inkludert begge datoene. Både tidligere og framtidige planlagte dager kontrolleres, på tvers av album. Overlappende datoer tillates ikke. AI-feil oppretter ikke delvise album.

## Spillregler
Daglige jakter er åpne 06.00–15.00 og 15.00–00.00 Europe/Oslo med sommertid. Ordet sendes ikke til klienten før deltakeren starter (eller dagen er slutt). Starten lagres én gang og kan ikke nullstilles ved gjenåpning. Tid = serverregistrert lukkertrykk minus personlig start. Deltakeren har fra personlig start til jaktens frist (15.00 eller 00.00 norsk tid) til å ta og sende inn bildet. Ingen femminuttersgrense. Bildet må være mottatt før dagens slutt; etter midnatt avvises også bilder tatt tidligere. Nytt bilde får nytt tidspunkt. Nettleseren kan ikke kryptografisk bevise kamerakilden; admin kan underkjenne bilder. Tidligere konkurranser beholder reglene for felles slipp.

Bilder leveres fra privat R2 via autorisert endepunkt, og vises først etter egen innlevering eller avsluttet utfordring. Administrator har innsyn. Poeng: 10, 7, 5, 3, 2 og deretter 1; kun godkjente bilder fra avsluttede utfordringer teller. Ved lik tid brukes original innleveringstid, deretter stabil ID. Resultatkorreksjoner endrer poeng og statistikk automatisk. Serier beregnes fra avsluttede kvalifiserte utfordringer.

## App, nedtelling og bakgrunnsvarsler
PWA med eget ikon, maskable-ikon, apple-touch-icon, safe-area-oppsett og en privatlivsvennlig frakoblet-side. API, bilder og innloggede sider caches aldri. Medlemmer ser bare starttid og tidsgrense før start, ikke oppgavens tittel eller detaljer.

Hver deltaker aktiverer push én gang per enhet. På iPhone må appen åpnes fra hjemskjermen. Standard Web Push krypterer payload med aes128gcm og autentiserer avsender med VAPID. VAPID_PRIVATE_KEY og PUSH_SCHEDULER_SECRET er bare lagret som serverhemmeligheter. Pushabonnementer oppbevares i D1, sjekkes mot godkjent medlemskap ved hver utsending og fjernes ved HTTP 404/410. Eksterne endepunkter begrenses til nettlesernes offisielle pushleverandører; omdirigeringer følges ikke.

En separat, privat Railway-bakgrunnstjeneste kjører `infra/scheduler.mjs`. Den kontrollerer varslingstidspunkter hvert 15. sekund, også uten åpne nettlesere. Den har kun en hemmelighet for å kalle dispatcher-endepunktet, ingen tilgang til medlemsdata eller pushnøkler. Railway bruker løpende ressurser. Prosjektidentiteten ligger i `infra/railway.json`. PH_SCHEDULER_CODE må oppdateres fra filen ved kodeendringer og tjenesten republiseres.

Varsler: ved planlegging, 30 minutter før start og ved start. Ved planlegging mindre enn 30 minutter før start sendes planleggingsvarselet, uten et ekstra falskt «30 minutter»-varsel. Serveren sporer mottaker/enhet/oppgave/starttid/type for å unngå duplikater. Midlertidige feil forsøkes på nytt opptil fem ganger. Utløpte/avsluttede oppgaver varsles ikke; titler holdes hemmelige i forhåndsvarsler. Ingen gammel varselhistorikk sendes ved registrering av en ny enhet. Levering påvirkes av telefonens nettforbindelse, Fokus og operativsystemets pushleverandør.

En serverheartbeat viser om tjenesten har kontakt. «Send et testvarsel» sender et ekte pushvarsel kun til den aktuelle enheten. Den fysiske telefonens varslingstillatelse må aktiveres av brukeren; agenten kan ikke gjøre det på deres vegne.

## Lagring og verifikasjon
D1: medlemmer, sesonger, utfordringer, innleveringsmetadata, reaksjoner og administrasjonssesjoner. R2: bilder. Drizzle-migrasjoner er autoritative. Tester kjøres med `node tests/system.mjs` og `node tests/push.mjs` etter build, mot en separat midlertidig Miniflare-database og bøtte. Testdata publiseres ikke. Typesjekk: `node node_modules/typescript/bin/tsc --noEmit`.

WebMCP tilbyr et skrivebeskyttet leseverktøy med de samme tilgangskontrollene som appen. Kontrollnettleseren støttet ikke modelContext, så nettleservalidering av dette verktøyet var ikke tilgjengelig.

Hjemskjerm/varsler: registrering krever appmodus; installasjonsinstruksjoner for iPhone/Android. Pending medlemmer kan registrere push og teste varsler, men får ingen konkurranseinnhold. Admin kan først godkjenne etter registrert abonnement. Spillet krever standalone + nettlesertillatelse + serverlagret abonnement på gjeldende enhet. Status sjekkes ved tilbakekomst og hvert 30. sekund i forgrunnen. OS/Fokus kan dempe varsler, og nettlesertillatelsen kan ikke tvinges på. Daglige album varsler kl. 07, 10, 15, 18, 20 og 22 norsk tid uten å avsløre ordet. Alle videre varsler stoppes når deltakeren har en innlevering, også på andre enheter og ved nye leveringsforsøk. Serveren sjekker innlevering rett før utsending. Hvert tidspunkt har et 15-minutters leveringsvindu, så gamle påminnelser ikke hoper seg opp; ingen masseutsendelse ved albumopprettelse.

## Lynjakt, bonusoppdrag og titler
Serveren lagrer én lynjakt per norsk kalenderuke i game_hunts, inntil fem uker fremover når et åpent album dekker datoen. Tidspunkt genereres én gang (kl. 10–20.59 norsk tid) og er skjult fra deltaker-API til 30 minutters forvarsel. Første jakt: 6. oktober 2026 kl. 17.00 Europe/Oslo. Eksisterende Railway-dispatcher sender forvarsel og start, også uten nettlesere. Lynjakten varer 20 minutter med felles start; bonuspoeng er 3 til vinneren og 1 til øvrige gyldige innleveringer. Den bryter ikke vanlige streaks.

Omtrent hver fjerde fremtidige dagsjakt får et frivillig bonuskrav. Dispatcher oppdager lagrede bilder og vurderer opptil to per kjøring. Bildelevering kaller aldri AI. Strukturerte AI-svar med minst 90 % sikkerhet kan godkjenne/avslå bonus; usikkerhet eller feil havner i Admin → Bonus. Godkjenning gir 2 poeng én gang til gyldige bilder. Sletting/nullstilling fjerner vurderingen sammen med bildet.

Titler og hemmelige achievements lagres per konto med serverkontrollert opplåsing og bekreftelse av popuper. Bare opplåste titler kan velges. Låste hemmelige krav sendes ikke til klienten. Awards beholdes når bilder senere slettes; bonuspoeng beregnes alltid fra gjeldende gyldige bilder. Nye integrasjonstester: node --test tests/game.test.mjs.
