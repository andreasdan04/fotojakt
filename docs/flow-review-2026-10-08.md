# Foto Jakt: dommernavigasjon, tidsflyt og 15 testfeil

Dato: 8. oktober 2026. Samme dags versjonsoppføring v53 er utvidet; ingen duplikatoppføring og ingen datamigrering.

## Rettet i appen

- Profilens administrasjonsknapp følger den faktiske approllen. Dommer/hoveddommer får «Dommerpanel», også før signering eller etter utløpt adminsesjon. Serverens rolle-, sesjons- og signeringskrav gjelder fortsatt.
- Startsvar viser ord/beskrivelse/bonus direkte, uten ekstra GET før visning. Eldre polling kan ikke overskrive den nye startresponsen. Tidligere starttid endres ikke ved ny åpning eller nytt bilde.
- UI og kamera bruker serverankret monoton klokke. Endring i enhetens dato/tidssone påvirker ikke et pågående forsøk. Serverens `now` sendes etter arbeidet med svargrunnlaget. Kameraet klargjøres på nytt på nett; en gyldig lease fra samme side kan brukes ved nettutfall, også når nettleseren feilaktig melder online.
- Utløsertid, bilde og bonusvalg følger samme lagrede forsøk. Opplasting, kø, retry og tapt svar beholder tiden. Et HTTP 200 uten gyldig `{ok:true,elapsed}` sletter aldri bildet fra enheten.
- Lynjakt-ID-er med kolon ble feilaktig delt opp ved automatisk kameraklargjøring. Køen overfører nå ID, revisjon, start og frist samlet.
- Syvdagers lokal opprydding bruker servertid; feil enhetsdato sletter ikke et ferskt usendt bilde.
- Samtidige opplastinger brukte tidligere samme R2-nøkkel. Det kunne blande bilde fra ett forsøk med tid fra et annet. Hvert forsøk bruker nå en egen fil, databasen velger én vinner, og taperfilen slettes. Bare vinneren kan lagre sitt frivillige bonusvalg.

## De 15 tidligere feilende testfilene

Testene er oppdatert til dagens sikkerhets- og spillkontrakter. Ingen produksjonskrav ble fjernet for å gjøre testene grønne.

| Testfiler | Årsak og retting |
| --- | --- |
| chat, daily, hunt-extras, photo-reports, replace-word, reset-submission, secret-words, word-descriptions, upload-recovery | Gamle privilegerte sesjoner var i klartekst, eller testkontoene manglet signert erklæring/eierrolle/regler. Bruker nå hashede sesjoner og eksplisitte aksept-fixtures der tilgangen kreves. |
| groups, system, season-welcome | Registrerings-fixtures manglet alders-/personvernbekreftelse; eier var forventet å få adminadgang før erklæringen. Fixtures følger nå faktisk onboarding. |
| daily | Én gammel jakt 07–00 var forventet. Kontrollerer nå to jakter 06–17 og 14–00, DST, 24 timers leveringslease og idempotent retry. |
| groups, system, reset-submission, upload-recovery, daily | Bilde-fixtures besto bare av JPEG-header med nullpadding. Bruker gyldig testbilde som faktisk kan metadatakontrolleres. |
| chat-notifications, invitation-notifications | Enheter hadde `updated=1` og ble korrekt slettet etter 90 dager. Fixtures fornyes som aktive enheter. Detaljert pushpreview aktiveres eksplisitt for testene som undersøker det. |
| push | Testene antok relative påminnelsestider og at opt-out beholdt enheter. Bruker fast Oslo-klokke, dagens tider, eksplisitt reaktivering/registrering og ingen backlog til nyregistrerte enheter. |
| chat, groups, secret-words | Utdaterte forventninger til felleschatens private lesestatus, skjult venneantall og egne kvitteringer for ordforslag. Kontrollerer dagens kontrakt og bevarer personvern/tilgangskontroll. |

## Validering

- Alle 47 testfiler i `tests/*.mjs` er kjørt mot produksjonsbygget og består, inkludert alle 15 tidligere feilende filer.
- Nye `hunt-clock.mjs` dekker feil mobilklokke/tidssone, monotont kameraanker, cache, offline-omstart, ny serverjustering og inngang for alle teamroller.
- Nye `upload-race.mjs` tvinger to faktiske upload-kall til samme lease til å møtes ved R2-skriving. Kontrollerer ett resultat/én fil, samsvar mellom bilde og tid, vinnerens bonusvalg, opprydding og uforanderlig retry.
- `photo-outbox.mjs` dekker lagring, account isolation, nettutfall, parallell levering, feilaktig HTTP 200, feil veggklokke, lynjaktlease og serverstyrt opprydding.
- TypeScript `--noEmit` og produksjonsbygg består.
- Målrettet lint for klokke, rollehelper, køkomponent/-modul og nye tester består.
- Full ESLint er faktisk kjørt, men består ikke: 787 feil og 78 advarsler gjenstår i eldre deler av prosjektet. Dette er ned fra 797 feil og 79 advarsler før denne endringen. Reglene er ikke deaktivert.
- `git diff --check` består.

## Begrensninger

Fysiske iOS-/Android-enheter, kamerautstyr og nettleserens bakgrunns-/OS-søvnatferd er ikke testet i denne økten. En separat Expo-klient finnes ikke i dette repoet; backendkontrakten er dokumentert i expo-personvern.md. Offline-utløsertid er klientrapportert innen serverens lease/start/frister, og er ikke kryptografisk verifisert. Etter omstart uten nett brukes lagret epoch med enhetsklokkens ikke-negative intervall; negativt avvik krever ny klargjøring på nett. Ved helt vilkårlig enhetsklokkeendring mellom offline-omstarter kan eksakt tid ikke bevises fra webklienten alene.
