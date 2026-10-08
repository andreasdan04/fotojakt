# Foto Jakt – jakttider, statistikk og kontroll, 8. oktober 2026

## Implementert

- Formiddag 06–17 og ettermiddag 14–00, konvertert fra hver Europe/Oslo-dato. Overlapp krever levert formiddagsbilde frem til kl. 17. Eksisterende ettermiddagsforsøk kan fortsette ved utrulling og ny fotografering på formiddagen.
- Frontend viser tilgjengelig/fullført/låst og prioriterer tilgjengelige, uferdige jakter. Backend håndhever låsen ved start, kamera og innsending. Hemmelige ord, beskrivelser, bonus og bilder skjermes i API, profil og admin.
- Dagens og fremtidige standardjakter oppdateres idempotent. Historiske datoer, manuelt endrede frister og avsluttede album endres ikke. Ord, starts, innleveringer og registrerte tider beholdes. Ubrukte kameraøkter følger forlenget frist; klienten fornyer en bufret økt ved endret frist.
- Morgenpush kl. 07, aldri kl. 06, også for sesongstart. Morgenpåminnelser kl. 10 og 16; ettermiddag kl. 14, 17, 20 og 22. Varsler kl. 14 krever tilgjengelig ettermiddagsjakt. Fullførte jakter og deaktiverte varsler filtreres bort. Leverings-ID-er hindrer duplikater. Både Web Push og Expo testes.
- Expo-dispatch og Expo-testvarsel fungerer uten Web Push-nøkler.
- Statistikksamtykke starter klientregistrering når valget faktisk er hentet, eller gitt. Databasens samtykke sjekkes i hver atomiske skriving. Ingen statistikk lagres uten opt-in. Tilbaketrekking sletter summer og midlertidig øktstatus.
- Admin får faktiske summer for samtykkende og aktive brukere, besøk, økter, funksjoner og dager, med 1/7/30/90-dagers filter. Små utvalg skjules ikke med kunstige nuller. Dager uten hendelser vises som null først etter vellykket databasehenting. Det vises ingen personliste.
- Daglige summer beholdes opptil 90 dager. Ett aktivitetstidspunkt per samtykkende konto brukes til økttelling og slettes ved opprydding etter 30 minutters inaktivitet. Ingen aktiv tid, IP, bilde-/ord-/meldingsinnhold eller ekstra sporings-ID samles inn.
- Feil i personvernlagring vises som feil, og samtykkekortet har loading og retry.
- Typecheck-feil i eksisterende JSON-lesing og en implisitt callbacktype er rettet.
- Dagens eksisterende versjonsoppføring (v53) er utvidet; ingen ny eller duplisert dagsoppføring er laget.

## Hva som faktisk er kontrollert

Produksjonsbygget med Sites/Vinext er kjørt og passerer. `tsc --noEmit` er kjørt og passerer. `git diff --check` passerer. Alle 42 testfiler er kjørt; 27 passerer og 15 feiler. Til sammenligning er hele den uendrede kildekoden (12b4c06) bygget og testet separat: 23 av 41 passerer og 18 feiler. Ingen tidligere passerende testfil har blitt en feilende testfil. Berørte tester er oppdatert for økttelling, nye tider, gjeldende adminautentisering og manuell bonusvurdering.

Nye produksjons-Worker-tester bruker lokal Miniflare med testdatabase, R2 og en deterministisk klokke. De tester Oslo/DST, 06/14/16:30/17/00-grenser, idempotent migrering og kamerafrist, start-/kameralås også for admin, skjerming av bildeendepunkt og profil, fotograferingstid og innsending på nytt, dekryptert Web Push, Expo Push, ingen 06-varsling, ingen doble leveringer, ingen påminnelse til ferdige, persistert samtykke, samtidige økter, ekte summer i små utvalg, 7/30-dagers oversikt, identitetsspoofing, tilbaketrekking og feil ved korrupt personvernvalg.

Etter siste runtime-endring er berørte integrasjoner, native push uten VAPID, personvern, regler, offline-opplasting, lokal bildekø, albumoppretting, bonus/poeng, påminnelsestider, loading, admininnleveringer, rapportvisning og leaderboard kjørt på nytt.

Sikkerhetsgjennomgangen omfatter autentisering/adminsamtykke, gruppe-/bilde-/chattilgang, serverens jaktvalidering, metadatafjerning, offline-kø og idempotens, samtykke ved skriving, pushabonnementer, duplikatnøkler, poengberegning og personvernfrister. Dette er en kode- og automatisert testgjennomgang, ikke en garanti for at hele prosjektet er feilfritt.

## Gjenstående begrensninger

- Ordinær ESLint er kjørt på både uendret og ny kode. Den feiler: uendret kode har 785 feil, hovedsakelig `no-explicit-any` og nyere React-hook-regler; oppdatert kode har omtrent 812. Eksisterende dynamisk kodeformat er beholdt fremfor en omfattende type-/arkitekturomskriving. Reglene er ikke skrudd av for å fremstille lint som grønn.
- Disse 15 eldre testfilene feiler også på uendret kode: `chat-notifications`, `chat`, `daily`, `groups`, `hunt-extras`, `invitation-notifications`, `photo-reports`, `push`, `replace-word`, `reset-submission`, `season-welcome`, `secret-words`, `system`, `upload-recovery`, `word-descriptions`. Flere bruker eldre autentiserings-/personvernforutsetninger, gamle tidsgrenser eller ufullstendige JPEG-fixtures. De er ikke rapportert som passerende.
- Visuell nettleser-/mobil-QA er ikke kjørt; støttet Sites-browser-QA var utilgjengelig i denne økten.
- Repositoryet inneholder webappen og Expo-backend, ikke en egen React Native-/Expo-klient. Native klientens bruk av nye `locked`/`available`/`unlockAt`-felt og statistikkhendelser er dokumentert i `expo-personvern.md`, men en ny native binær er ikke bygget eller publisert.
- Pushmottak på fysisk telefon er ikke testet i denne økten. Eksterne tjenester er kontrollert med realistiske testadaptere, ikke ved å sende testvarsler til spillere.
- Manglende historiske besøk rekonstrueres ikke. Besøk/økter blir riktige fremover; eksisterende funksjonstellinger beholdes.
