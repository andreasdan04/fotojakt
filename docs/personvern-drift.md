# Foto Jakt – personvern og drift

Dato: 7. oktober 2026. Eier/kontakt valgt av Andreas: Andreas Danielsen, anddan2004@icloud.com. Fremtidig kontaktadresse: kontakt@foto-jakt.no (tas i bruk når postkassen er aktivert). Produktmålgruppe valgt: minst 13 år. Rapportens kodepunkter er behandlet, men avtaler og faktisk leverandørdrift kan ikke verifiseres fra kildekoden alene.

| Rapportpunkt | Gjennomført | Gjenstår / driftskontroll |
|---|---|---|
| 4.1 Informasjon | Offentlig personvernside og lenker før registrering, footer, innstillinger og chat; versjonert alders-/lesebekreftelse. | Kontaktadressen må følges opp. Erklæringen må oppdateres med verifiserte avtaleledd/regioner. |
| 4.2 Statistikk | Serverhåndhevet opt-in, historikk fjernes ved nei, ingen aktiv tid/sist aktiv/personoversikt, 90 dager, små utvalg skjules. | Vurder nødvendighet for nye analysefelter før de legges til. Tellingene er personopplysninger, ikke bevist anonyme. |
| 4.3 Chatkontroll | Lokal tekstliste i felleschat; private rapporter manuelle. Ingen ekstern AI eller automatisk bildeanalyse. Innsyn loggføres. | Dokumenter interesseavveining, barn, feiltreff og saksrutiner. Ingen garanti for trygt innhold. |
| 4.4 Bonus | Valgfri manuell vurdering med begrunnelse, adminavtale, klage og tilbaketrekking. Pending flyttes til manual. | Kontroller Expo-tekst og habilitet ved vurdering. |
| 4.5 Rettigheter | PIN-verifisert JSON-eksport og kontosletting også for blokkerte kontoer; gruppeoverføring; offentlig kontakt for øvrige forespørsler. | Medier/utvidet innsyn/administratorrettigheter via kontakt. Forespørselslogg, identitetskontroll og svarfrist må følges av operatør. |
| 4.6 Sletterester | Flere settings-røtter, push-token/kø og reviewer/aktørreferanser ryddes; beholdte rapporters fritekst fjernes for slettet rapportør; pseudonymisering omtales korrekt. | Providerlogger/backup, copies på andre enheter og gjenoppretting er separate flater. Fritekst skrevet av andre kan fortsatt identifisere; manuell gjennomgang av konkrete krav nødvendig. |
| 4.7 Frister | Worker scheduled-opprydding hver time, reserve i push-tick; bilder/chat/statistikk/sesjoner/push/vurderinger/feilrapporter/vedlegg har tekniske frister. | Inaktive kontoer, resultatarkiv og åpne saker trenger årlig behovsvurdering/forvarsel. Ingen uvarslet automatisk kontosletting. Verifiser hosted cron og backupfrister. |
| 4.8 Deling | Bare egne bilder, historiske delinger fra andre gjøres utilgjengelige; målgruppe forklares, bekreftelse før felleschat; sletting tilbakekaller referanse. | Nye gruppemedlemmer ser historikk etter valgt modell. Kontroller rettigheter ved enhver endring av medlemsmodell. |
| 4.9 Profil | Private innstillinger som tema fjernes fra andres profilsvar; vennantall er av som standard; kallenavn tillates; innlogget publikum opplyses. | Eksisterende bruker-valgte vennantall bevares; vurder strengere profilmodell for ungdom ved vekst. |
| 4.10 Metadata | Serverparser fjerner EXIF/GPS/XMP/tekstmetadata fra nye JPG/PNG/WebP og eldre støttede filer i bakgrunn. Ustøttede dokumentformater er satt på pause. | Parser er ikke en full rasteromkoder. Kontroller orientering, dimensjoner/dekompresjonsgrenser og eventuelle feil i gammel bestand; native må omkode lokalt. Bilder/tekst kan i seg selv identifisere tredjepersoner. |
| 4.11 Barn | 13-årsbekreftelse ved ny registrering uten fødselsdato/ID; enklere forklaring og forsiktige standarder. | Eksisterende brukeres alder må vurderes. Ingen foreldreprosess for under 13. DPIA-screening nedenfor må ferdigstilles med faktiske forhold. |
| 4.12 Leverandører | Faktiske kodeleverandører opplyses, ekstern bonus-/chat-AI er fjernet. Ingen løfte om EU/Norge. | Innhent DPA, juridiske enheter, regioner, supporttilgang, underleverandører, logg/backup og overføringsgrunnlag per mottaker. Kan ikke signeres/verifiseres av kildekodeendring. |
| 4.13 Push/lokalt | Generiske pushvarsler som standard, enhetsoversikt, token/kø fjernes ved avregistrering/nei, 90-dagers enhetsfrist. Lokal tømming/logout og 7-dagers kø. | Native SecureStore/tømming/background tasks/SDK må implementeres og prøves på fysisk delt enhet. |
| 4.14 Admin/sikkerhet | Hashede adminsesjoner, personlig passordmigrering med tilbakekalling, TOTP-støtte, modereringsinnsynslogg, generiske serverfeil, oppryddingsstatus. | Andreas må velge eget sterkt passord i admin og sette opp MFA. Rotering/tilgang, backuprestore og avvik må driftes. Gammel PIN er kun overgang før passordet settes. |

## Lagringsbeslutninger i kode

Bilder/innleveringer: 730 dager (2 år); chat/vedlegg: 365 dager (1 år); bruksstatistikk: 90 dager; klare chatvurderinger: 7 dager; avsluttede modereringssaker: 90 dager; bonusbegrunnelser: 90 dager; avsluttede feilrapporter: 90 dager; innsynslogg: 30 dager; usendte servervedlegg: ett døgn; aktive push-token uten ny registrering: 90 dager; leveringslogger: 30 dager. Utløpte sesjoner/forsøk/kameraøkter slettes periodisk. Opprydding skjer i begrensede retrybare batcher; store backlog kan bruke flere kjøringer. `GET /api/privacy/maintenance` krever admin og viser status. `worker-entry.ts` har egen scheduled-handler; cron konfigureres i byggekonfigurasjonen. Kontroller at Sites/hosting faktisk installerer denne triggeren etter publisering; ellers må egen autorisert scheduler kalle det beskyttede tick-endepunktet uavhengig av pushfunksjon.

## Behandlingsprotokoll – utgangspunkt

| Formål | Data | Teknisk grunnlag/modell | Tiltak |
|---|---|---|---|
| Konto/spill/ønsket sosial funksjon | Konto, profil, jakt, chat, relasjoner og poeng | Nødvendig tjenesteavtale, art. 6(1)(b) | Innlogging, publikumsgrenser, dataminimering, frister, rettigheter. |
| Drift, innloggingsvern og manuelle rapporter | Forsøk, rapportinnhold, tilgangs-/vurderingsmetadata | Berettiget interesse, art. 6(1)(f), etter konkret vurdering | Begrenset innsyn, logs uten innhold, ingen automatisk straff. |
| Frivillig statistikk | Daglige personknyttede tellinger | Frivillig opt-in art. 6(1)(a) | Av som standard, serverfilter, sletting ved tilbaketrekking, bare summer i admin. |
| Valgt manuell bonus | Valgt bilde, bonusresultat og begrunnelse | Bestilt valgfri spillfunksjon art. 6(1)(b) | Nei som standard, taushetserklæring, innsynslogg, begrunnelse, klage og tilbaketrekking. |
| Bestilte pushvarsler | Device token, kø og minimal payload | Uttrykkelig bestilt frivillig tjenestefunksjon | Ingen spillkrav, generisk standard, avregistrering og tokenfrist. |
| Rettighets-/avviksbehandling | Minimum for forespørsel, identitet og oppfølging | Konkret lovplikt art. 6(1)(c) der den gjelder | Kontakt, dokumentert frist og sikker håndtering. |

Dette er en arbeidsprotokoll, ikke ferdig leverandør-/juridisk godkjenning. Utfyll per mottaker med rettssubjekt, rolle, kontrakt, regioner, tilgang, garantier og faktisk lagringstid.

## Interesseavveining og DPIA-screening

Formål med moderering er å håndtere rapporter og beskytte brukerne mot krenkelser og trusler. Rutinemessig ekstern AI i alle private rom er fjernet fordi manuelle rapporter gir en mindre inngripende løsning. Ingen admin-personoversikt eller personvis aktivtid beholdes. Ekstern bonus-/chat-AI er fjernet. Lokal tekstkontroll gir treff til menneskelig vurdering; bilder og vedlegg har ingen automatisk innholdskontroll. Samtykke til bonus/statistikk er ikke grunnlag for enhver behandling av innhold eller tredjepersoners sensitive opplysninger.

Risikoindikatorer: ungdom fra 13 år, bilder av tredjepersoner, scoring/merker, AI, mulig sensitiv fritekst, låseskjermvarsler og tredjelandstilgang. Tiltak reduserer risiko, men ukjent faktisk brukeraldersfordeling, datamengde, regioner/avtaler og native SDK-er hindrer endelig screening. Operatøren må dokumentere screening, gjøre full DPIA dersom sannsynlig høy risiko, og ta stilling før gjenaktivering av ekstern innholdsanalyse. Vurder særlig artikkel 9/10; vanlig samtykke til tjenesten er utilstrekkelig.

## Rettighetsrutine

Ta imot krav via personvernkontakt også fra blokkerte og avbildede ikke-brukere. Registrer dato, kravtype, nødvendig identitetskontroll, ansvarlig, frist og avslutning i et tilgangsbegrenset saksregister. Normal svarfrist er én måned; informer før frist ved lovlig forlengelse. Bruk egen PIN-verifisert eksport som utgangspunkt; kompletter medier/øvrige data sikkert, og beskytt andres rettigheter. Ikke krev ID-kopi uten konkret nødvendighet. Gruppeeier og admin må avklare overføring før sletting; dette må ikke bli en praktisk sperre for lovpålagte rettigheter.

## Avvik og backup

1. Begrens hendelsen: tilbakekall berørte sesjoner/token, stans aktuell datarute, bevar minimal nødvendig hendelsesinformasjon.
2. Kartlegg data, berørte, tidspunkt, årsak, tiltak og risiko; før tilgangsbegrenset hendelseslogg.
3. Vurder meldeplikt til Datatilsynet innen 72 timer fra kjennskap, og varsling av berørte uten ugrunnet opphold ved høy risiko. Dokumenter vurderingen også når varsling ikke er påkrevd.
4. Innhent hostingens faktiske backupvindu. Kontoslettinger må føres i et separat beskyttet slettingsregister som ikke overskrives av databasegjenoppretting. Gjenbruk teknisk sletterutine for relevante ID-er etter restore, før gamle data blir tilgjengelige. Koden alene kan ikke bevise dette.
5. Øv på sikker gjenoppretting med syntetiske kontoer, filkøfeil og reapplisering av slettinger. Kontroller native lokaldata separat.

## Innstillinger operatøren må fullføre

- Passordoppsettsfeltet er fjernet fra adminmenyen etter Andreas sitt ønske. Eksisterende passord og innloggingsbeskyttelse beholdes. Eierens beskyttede `admin-password`-API finnes fortsatt; gammel eier-PIN deaktiveres etter passordoppsett. Sørg for sterk eierinnlogging og vurder sterkere autentisering/MFA for tildelte administratorer før omfattende saksinnsyn.
- Konfigurer `ADMIN_TOTP_SECRET` via runtime-secret fra egen autentiseringsapp. Ikke lagre secret i git, nettleserlagring, chat eller dette dokumentet.
- `GDPR_AI_APPROVED` aktiverer ikke bonus/chat-AI; eksterne innholdskall er fjernet. AI for jaktord består. Eieren redigerer ordlisten under Admin → Chatkontroll. Tom liste stanser flagging. Bilder/private rom/filer kontrolleres ikke automatisk.
- Kontroller faktisk hosted cron, køstatus og metadata-backlog. Gammel bildemetadata saneres gradvis; feil krever oppfølging.
- Avklar eksakte underleverandører, backup-/loggfrister, eksisterende mindreårige og inaktive kontoer. Revider offentlig erklæring når disse forholdene er kjent.
- Kontroller native-appens faktiske nettverk, lagring og butikkdeklarasjoner.

Kilder: GDPR https://eur-lex.europa.eu/eli/reg/2016/679 ; barns samtykke https://lovdata.no/lov/2018-06-15-38 ; informasjon https://www.datatilsynet.no/rettigheter-og-plikter/ ; barn og bilder https://www.datatilsynet.no/personvern-pa-ulike-omrader/skole-barn-unge/ . Leverandøravtaler må verifiseres for den aktuelle kontoen, ikke bare fra generell dokumentasjon.

## Nye adminrutiner

Adminfanen «Innleveringer» gir saks-/jukskontroll av jaktbilder fra alle brukere på tvers av venner og grupper. Det er en egen beskyttet kontrollvisning, ikke en endring av normalt galleri eller chatpublikum. Aktiv adminsesjon og gjeldende taushetserklæring kreves. Listetilgang og hver bilderute kontrollerer egen innlevering eller jaktens slutt; ingen eieromgåelse. Liste- og bildeinnsyn loggføres med aktør og innleverings-ID-er og følger 30-dagersfristen for innsynslogger. Serverens mottakstid og beregnet bildetid vises separat; de er ikke sikkert bevis på faktisk fotografering. Operatøren må inkludere det konkrete kontrollformålet og behovsvurderingen i behandlingsprotokollen. Ingen automatisk juksavgjørelse er innført.

Eieren tildeler/fjerner adminroller. Alle administratorer må registrere fullt navn, e-post, postadresse og skrevet navn som elektronisk underskrift før saksinnsyn. Gjeldende taushetstekst og versjon lagres med aksepttid. Dette er en elektronisk aksept, ikke BankID eller verifisert identitet. Bare personen selv og eieren kan hente opplysningene. Opplysningene slettes normalt 90 dager etter tilbakekalling; øvrige kontorettigheter og sletting består. Tilgangsendringer loggføres uten adresse/underskrift, og aktive sesjoner tilbakekalles. Operatøren må vurdere adressebehovet, interesseavveining, erklæringsteksten og om innloggingsstyrke/MFA er tilstrekkelig for hver admin. Godkjenningsflyten erstatter ikke opplæring eller databehandleravtaler.

Alle valgte bonusoppdrag vurderes manuelt av signerte administratorer med begrunnelse. +2 poeng ved godkjenning; tid beholdes. Kø, bilde og vurdering krever egen innlevering/jaktens slutt. Bonusvalget må være aktivt og bildet gyldig. Lokal ordliste flagger hele ord/fraser til admin; den forstår ikke sammenhengen. Gamle pending-chatkontroller dreneres lokalt i avgrensede batcher. Ferdige saker bevares etter eksisterende frister.
