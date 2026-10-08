// One player-facing version per Oslo calendar day. Add same-day work to its summary.
// Keep the player-facing version number stable during each Oslo calendar day.
export const releases=[
 {version:53,date:'2026-10-08',summary:'Fleksible jakttider, fungerende frivillig statistikk, dommerroller, håndskrevet taushetserklæring og klagebehandling.',changes:[
  {type:'Bugfiks' as const,text:'Dommere og hoveddommere finner nå Dommerpanel fra profilen. Ordet vises direkte ved start. Jaktklokken bruker servertid og en monoton teller, og bildet beholder tiden fra utløseren gjennom offline-kø og nye leveringsforsøk.'},
  {type:'Bugfiks' as const,text:'Samtidig opplasting kan ikke lenger blande ett bilde med tiden fra et annet forsøk. Bildekøen krever bekreftet levering før lokal sletting, og lynjakter klargjøres korrekt for offline-bruk.'},
  {type:'Nyhet' as const,text:'Dommer og hoveddommer har et eget arbeidsområde i administrasjonen med bonusbilder, rapporterte bilder og egne vurderinger. Team og roller viser rolle og signeringsstatus; administrator kan utnevne dommere, og bare eier kan utnevne administratorer.'},
  {type:'Nyhet' as const,text:'Taushetserklæringen signeres med faktisk underskrift på skjermen. Navn, signatur, tidspunkt og versjon lagres privat. Vesentlige endringer krever ny underskrift; tidligere signeringer beholdes etter oppbevaringsreglene. Signaturen er dokumentasjon på aksept, ikke BankID-verifisert.'},
  {type:'Bugfiks' as const,text:'Ingen kan dømme sitt eget bilde. Spillere kan klage på avslag med begrunnelse; en habil hoveddommer avgjør klagen. Poeng oppdateres uten dobbeltføring, og resultatet vises i varsler. Push sendes bare når varsler er valgt.'},
  {type:'Endring' as const,text:'Formiddagsjakt 06.00–17.00, med første frivillige pushvarsel kl. 07.00. Ettermiddagsjakt 14.00–00.00 åpnes etter levert formiddagsbilde, eller for alle kl. 17.00. Jaktkort viser tilgjengelig, fullført eller låst.'},
  {type:'Bugfiks' as const,text:'Frivillig statistikk starter etter at samtykket er hentet. Admin ser reelle summer for samtykke, aktive brukere, besøk, økter og funksjoner per dag og periode, også ved små utvalg. Tilbaketrekking stopper registrering og sletter tidligere tellinger.'},
  {type:'Bugfiks' as const,text:'Expo-testvarsler fungerer også uten Web Push-nøkler. Kameraøkter følger oppdatert frist, og feil ved lesing av personvernvalg vises tydelig.'},
  {type:'Bugfiks' as const,text:'Popupen for nytt jaktord med knappen Til dagens ord er fjernet. Jakten vises fortsatt på forsiden, og frivillige varsler beholdes.'},
  {type:'Nyhet' as const,text:'Poengtavlen har nye filtre for Alle mine grupper og Lynjakt. Felles gruppetavle teller hver spiller én gang. Lynjakttavlen er flyttet fra toppen til poengtavlen.'},
  {type:'Nyhet' as const,text:'Glemte du bonusvalget? Send ditt leverte bilde til manuell bonusvurdering fra jaktkortet eller Se bilder, også etter jaktens slutt. Bilde og registrert tid beholdes.'},
  {type:'Bugfiks' as const,text:'Hemmelig jaktinnhold skjermes også for admin i feed, profiler og bildevisning frem til egen innlevering eller jaktens slutt.'},
 {type:'Bugfiks' as const,text:'Adminlisten viser også rapporter sendt gjennom bildeavstemning, inkludert eldre klienter. Rapportlisten oppdateres automatisk. Låste rapporter vises som mottatt, mens bilde, begrunnelse og jaktord åpnes etter egen innlevering eller jaktens slutt.'},
 {type:'Bugfiks' as const,text:'Ordforslag lagres nå også når ordet finnes i ordbanken eller allerede er foreslått av en annen spiller. Gjentatt innsending av ditt eget forslag gir en tydelig beskjed, uten duplikater.'},
 {type:'Bugfiks' as const,text:'Innlogget admin ser forslagene også i ordkassen på forsiden. Oppdater-knapp og tidspunkt for innsending gjør nye forslag enklere å finne. Spillere ser en mottakskvittering uten å få avslørt ordene eller vurderingene.'}
 ]},
 {version:52,date:'2026-10-07',summary:'Tydelige regler, frivillig statistikk og enklere rapportering og adminkontroll.',changes:[
 {type:'Nyhet' as const,text:'Kort regelbekreftelse før din neste jaktstart, med utvidbart regelverk og avkrysning. Aksept lagres på kontoen én gang per regelversjon. Klokken starter først når jakten starter.'},
 {type:'Endring' as const,text:'Bruksstatistikk har et separat og helt frivillig ja/nei-valg. Valget kan endres under Innstillinger → Personvern. Nei eller ubesvart valg hindrer ikke spillet.'},
 {type:'Endring' as const,text:'Bare admin kan se hvem som har lest meldinger i felleschatten. To navn vises først; trykk for å åpne hele leselisten. Private chatter beholder lesestatus.'},
 {type:'Nyhet' as const,text:'Rapporter jaktbilder til admin fra ⋯-menyen, også når bildet har en avstemning. Begrunnelse er obligatorisk. Admin ser bildet, jaktordet, beskrivelsen og rapporten, og kan merke det gyldig eller ugyldig med begrunnelse.'},
 {type:'Endring' as const,text:'Bonusoppdrag vurderes manuelt. Felleschat bruker en lokal ordliste for flagging, uten automatisk bildeanalyse. Admininnsyn krever personlig innlogging og godkjent taushetserklæring.'},
 {type:'Bugfiks' as const,text:'Ordkassen viser om AI faktisk vurderte forslagene eller var utilgjengelig. Ordforslag kan slås opp i Bokmålsordboka; ordbokforklaringer og AI-vurderinger vises separat.'}
 ]},
 {version:51,date:'2026-10-06',summary:'Gruppe- og vennechatter, bildedeling, adminoppdateringer og morgenjakt fra kl. 06.00.',changes:[
 {type:'Endring' as const,text:'Personvernside, frivillig statistikk og AI-bonus, innsyn og kontosletting, generiske pushvarsler og tryggere bildedeling. Private chatter sendes ikke automatisk til AI. Nye kontoer krever 13-årsbekreftelse.'},
 {type:'Endring' as const,text:'Bildeavstemninger varer nå opptil 3 timer og trenger minst 3 svar. Over 50 % av svarene må være gyldig eller ugyldig for å avgjøre bildet. Uten flertall beholdes bildet. Et underkjent bilde kan tas på nytt før jaktens frist; den opprinnelige starttiden beholdes.'},
 {type:'Endring' as const,text:'Morgenjakten åpner nå kl. 06.00 norsk tid og varer til kl. 15.00. Morgenvarsel, nedtelling og planlagte jakter følger den nye tiden.'},
 {type:'Bugfiks' as const,text:'Gruppedeling, kopierte invitasjoner og feltet Gruppelenke bruker nå foto-jakt.no, også når appen åpnes fra det gamle domenet. Eksisterende gruppeinvitasjoner beholder samme invitasjonskode.'},
 {type:'Nyhet' as const,text:'Admin kan skrive /update i felleschatten og publisere en uthevet oppdatering med overskrift, informasjon og valgfritt ikon. Kompakte kort viser avsender og tidspunkt, og passer lys og mørk modus.'},
 {type:'Nyhet' as const,text:'Del jaktbilder til chattene i appen etter avsluttet jakt. Chat støtter bilder fra galleri og opptil tre vedlegg per melding, med lenker som klikkbare kort. Vedlegg følger chattilgangen.'},
 {type:'Nyhet' as const,text:'AI kontrollerer nye chatmeldinger og bilder i bakgrunnen. Mulig rasisme, trusler og farlig innhold, usikre vurderinger og innhold som ikke kan leses fullt ut sendes til Chatkontroll i admin. Meldinger fjernes aldri automatisk.'},
 {type:'Bugfiks' as const,text:'Samtalekort passer nå til mobilbredden. Siste melding kuttes med … uten å utvide siden. Lesestatus vises bare inne i chatten; uleste samtaler har et rødt varselmerke på chatikonet.'},
 {type:'Nyhet' as const,text:'Samtalelisten viser siste melding og avsender, med tydelig markering av uleste meldinger. Begge sider kan se lesestatus; grupper viser hvem som har lest. Varslingssenteret viser «FJ har mottatt en melding fra [navn]» og åpner den aktuelle meldingen ved trykk.'},
 {type:'Nyhet' as const,text:'Diskusjon har knapper for Gruppechatter og Vennechatter. Private samtaler med godkjente venner, med ulest-teller og meldinger i bjellen. Sist aktive samtale ligger øverst, også når du selv sender.'},
 {type:'Endring' as const,text:'Ekstern bildedeling og nedlasting fra delingsknappen er erstattet med Del til chat. Deling oppretter ingen offentlig bildelenke. Sesongkort som deles utenfor appen inneholder bare statistikk, ikke jaktbilder.'},
 {type:'Endring' as const,text:'Invitasjoner til Foto Jakt bruker foto-jakt.no.'}
 ]},
 {version:50,date:'2026-10-05',summary:'Ukentlig lynjakt, frivillige bonusoppdrag, titler og hemmelige achievements.',changes:[
 {type:'Endring' as const,text:'Copyright med foto-jakt.no nederst på alle sidene. Rapporter en bug og Administrer på profilen har tydelige knapperammer. Bildefeeden har bedre avstand mellom overskriftsrader, bilder og jakter.'},
 {type:'Nyhet' as const,text:'Ukentlig lynjakt på et serverlagret, tilfeldig tidspunkt, med 30 minutters forvarsel, 20 minutters jakt, egen toppliste og 1–3 bonuspoeng. Første lynjakt er 6. oktober kl. 17.00. Push er frivillig.'},
 {type:'Nyhet' as const,text:'Enkelte dagsjakter får et frivillig bonusoppdrag verdt 2 poeng. Bildet leveres som vanlig; AI vurderer bonusen etterpå. Usikre vurderinger og AI-feil sendes til manuell vurdering hos admin.'},
 {type:'Nyhet' as const,text:'Lås opp sjeldne titler og velg én på profilen. Tittelen vises ved navnet i poengtavlen, kommentarer og profil. Hemmelige achievements skjuler navn og krav som ??? til de låses opp med en popup.'},
 {type:'Bugfiks' as const,text:'Fjernet et gammelt varslingskrav som hindret deltakere uten pushabonnement i å trykke «Start og vis ordet». Du kan nå starte jakten, ta bilde og levere uten å aktivere varsler. Varsler velges frivillig i innstillingene.'}
 ]},
 {version:49,date:'2026-10-04',summary:'Tryggere levering og enklere jaktord.',changes:[
 {type:'Bugfiks' as const,text:'Administratorkontoen kan nå logge inn fra den vanlige innloggingssiden med samme PIN som på adminsiden. Andre kontoer beholder sin personlige PIN.'},
 {type:'Endring' as const,text:'Den blå FJ-logoen brukes nå i appens topp, på innlogging, som app- og nettleserikon og i varsler. Delte gruppeinvitasjoner viser navnet på gruppen og forklarer hvordan man blir med, også ved kopiering.'},
 {type:'Endring' as const,text:'Profilen har fått en kompakt utforming med resultater, bilder og merker. Avsluttede jakter viser tilgjengelige vinnerbilder i listen. Venneforespørsler og gruppeinvitasjoner kan godtas eller avslås direkte i varslingssenteret. Varslingsinnstillinger åpnes direkte fra bjellen, og venneforespørsler og gruppeinvitasjoner kan sende push når varsler er aktivert.'},
 {type:'Nyhet' as const,text:'Hovedpoengtavlen rangerer alle spillerne i appen. Du kan velge en egen poengtavle for gruppene dine, med plasseringer og poeng innen gruppen. Filtervalget lagres på kontoen din.'},
 {type:'Endring' as const,text:'Avsluttede avstemninger om vanskelige jaktord skjules fra forsiden tre timer etter at de er avsluttet.'},
 {type:'Endring' as const,text:'Ingen spørsmål eller påminnelser om å aktivere varsler ved oppstart. Varsler velges selv i profilinnstillingene, og kameraet kan brukes uten pushvarsler.'},
 {type:'Nyhet' as const,text:'Gruppechatter viser en rød teller for uleste meldinger, opptil 9+. Hver deltaker kan slå pushvarsler av eller på for hver gruppe. Uleste meldinger vises fortsatt i appen og i bjellen.'},
 {type:'Nyhet' as const,text:'Gruppeeiere og gruppeadministratorer kan dele en gruppelenke fra gruppeinnstillingene. Innloggede deltakere som åpner lenken blir lagt til automatisk. Lenken kan deaktiveres.'},
 {type:'Endring' as const,text:'Egne bilder kan slettes eller tas på nytt fra menyen med tre prikker. Tiden fortsetter fra da ordet først ble åpnet.'},
 {type:'Endring' as const,text:'Diskusjon får en oversikt over samtaler og chat som fyller skjermen. Egne meldinger vises til høyre, andres til venstre. Du kan svare på meldinger og bruke reaksjoner.'},
 {type:'Nyhet' as const,text:'Poengtavlen ligger nå på Dagens med topp 5. Vis mer åpner alle plasseringer og tidligere album. Den tidligere Poeng-fanen er erstattet med Diskusjon, med felles chat for alle deltakere og private gruppechatter.'},
 {type:'Nyhet' as const,text:'Jaktord får en kort forklaring som sier hvilket motiv du skal ta bilde av. Forklaringen vises etter at ordet er avslørt og følger med når admin bytter ord.'},
 {type:'Nyhet' as const,text:'Admin kan bytte vanskelige jaktord direkte eller åpne en 60-minutters avstemning på forsiden. Flertall avgjør; likt resultat eller ingen stemmer beholder ordet. Bilder og tider i den berørte jakten nullstilles, fristen beholdes, og deltakerne får en beskjed i bjellen. Push følger brukerens varselvalg. Avstemningen vises for deltakere som har startet og sett jaktordet. De får beskjed i bjellen, også når de starter underveis i avstemningen. Push følger egne varselvalg. Nye ord holdes hemmelige til jakten startes.'},
 {type:'Endring' as const,text:'Versjonsloggen viser bare siste oppdatering. Eldre oppdateringer åpnes med knappen Vis tidligere oppdateringer.'},
 {type:'Endring' as const,text:'Ordkassen støtter låneord, korte uttrykk og andre vanlige ord som tidligere kanskje ikke ble godkjent. AI vurderer fortsatt trygghet og familievennlighet. Admin kan godkjenne selv etter AI-avslag. Forslagene holdes hemmelige.'},
 {type:'Bugfiks' as const,text:'Kamerabilder og tiden ved fotografering lagres på enheten før innsending. Ved nettbrudd eller nettverksbytte settes bekreftet innsending i kø og prøves igjen når appen har forbindelse. Gjenåpning gjenopptar køen uten ny fotografering eller doble leveringer. Bildet må tas før jaktens frist; opplastingen kan gjenopptas i inntil 24 timer etter fristen.'}
 ]},
 {version:48,date:'2026-10-03',summary:'Jaktoppsummeringer, favorittavstemning, AI-vurderte jaktord, funksjonsforslag og et ryddigere design.',changes:[
 {type:'Endring' as const,text:'Snarveiene Siste resultat og Favorittbilde er fjernet fra Dagens. Ordkassen og Foreslå funksjon ligger på én kompakt rad.'},
 {type:'Nyhet' as const,text:'Svar på dine kommentarer vises alltid i bjellen, også på andres bilder. Velg selv om svar også skal gi pushvarsler. Svar går til riktig kommentator uten doble varsler.'},
 {type:'Nyhet' as const,text:'Avsluttede jakter viser vinnerbildet, vinnerens tid, dine poeng og endring på poengtavlen.'},
 {type:'Nyhet' as const,text:'Dagens favorittbilde kåres i hver gruppe etter begge dagsjaktene. Avstemningen varer 24 timer, med én låst stemme per deltaker i gruppen og ingen stemme på eget bilde. Fotograf, bildetekst og stemmetall skjules frem til kåringen. Favorittstemmer gir ikke jaktpoeng.'},
 {type:'Nyhet' as const,text:'Legg til eller rediger bildetekst etter levering uten å endre tiden. Send ord til ordkassen; admin godkjenner eller avslår, og godkjente ord kan dukke opp i fremtidige jakter.'},
 {type:'Nyhet' as const,text:'Avsluttede sesonger får personlig oppsummering på profilen: beste plassering, raskeste gyldige bilde, seire, lengste jaktrekke og mest populære bilde. Lagre eller del sesongkortet som bilde.'},
 {type:'Endring' as const,text:'Deltakernes ordkasse viser kun innsendingsfeltet. Etter sending vises en kort beskjed: Ordforslag registrert. Listen med tidligere kvitteringer er fjernet.'},
 {type:'Endring' as const,text:'Ord og AI-vurderinger i ordkassen er skjult for deltakerne etter innsending. Nye godkjente ord erstatter noen uåpnede fremtidige formiddagsord automatisk, med kontroll mot eksisterende ord og tidligere forslag.'},
 {type:'Nyhet' as const,text:'AI vurderer nye jaktord automatisk. Bare norske, trygge, familievennlige ord med konkrete motiver godkjennes. Ved feil eller usikkerhet godkjennes ikke ordet. Admin kan vurdere igjen eller avslå.'},
 {type:'Nyhet' as const,text:'Foreslå funksjoner fra Dagens. Følg status på egne forslag; admin kan sette dem som mottatt, planlagt, lagt til eller avslått.'},
 {type:'Bugfiks' as const,text:'Adminmenyen er lavere, har lesbare farger i mørk modus og kan scrolles sideveis på mobil. Fire kompakte snarveier på Dagens med ensartede ikoner.'},
 {type:'Endring' as const,text:'Kompakte innganger på Dagens og mobiltilpassede kort i samme tema. Nye bilder og resultater følger eksisterende gruppe- og bildetilgang.'}
 ]},
 {version:46,date:'2026-10-02',summary:'En ryddigere Foto Jakt med gruppe- og vennebilder, enklere deling, varselinnboks, profilinnstillinger, mørk modus og flere merker.',changes:[
  {type:'Nyhet' as const,text:'Egne feeder for gruppebilder og vennebilder. Venner kan følge hverandre uten felles gruppe.'},
  {type:'Nyhet' as const,text:'Varselinnboks for venneforespørsler, gruppeinvitasjoner, kommentarer og reaksjoner. Del Foto Jakt med en kort invitasjon, brukernavnet ditt og lenken.'},
  {type:'Nyhet' as const,text:'Profilen samler dine bilder, merker og statistikk. Innstillinger for navn, brukernavn, profilbilde, bio, fremhevet merke, venneantall, app og varsler. Velg lys, mørk eller automatisk modus.'},
  {type:'Nyhet' as const,text:'Nye merker for seire på rad, flere seire og blinkskudd, pallplasser og begge dagsjaktene. Rapporter bugs med valgfritt skjermbilde fra Profil.'},
  {type:'Endring' as const,text:'Reaksjonen ligger til venstre for Kommentarer. Tid og ord vises på bildet, og bare ugyldige bilder merkes. Poeng, Venner og Dagens er ryddet og mer kompakte; regler, neste jakt og gruppeoppretting kan foldes ut. Ryddigere jaktoverskrifter og større, lettere trykkbare menyknapper. Filter er samlet bak én knapp. Rammefrie bilder i like store utsnitt, helt ut til kanten på mobil og tettere innlegg. Pågår eller Fullført vises ved jaktordet. Ordet vises også i en liten gjennomsiktig boks nederst til venstre på bildet.'},
  {type:'Endring' as const,text:'Rosa sløyfe på logoen, rosa–blå gradienter helt ut i menyens kanter og tydelige statusmerker gjennom oktober, også i mørk modus. Endringsloggen samler dagens oppdateringer i én dagsversjon, med én tag og punktliste per kategori.'},
  {type:'Bugfiks' as const,text:'Kamerazoom påvirker bare bildet, ikke hele appen. Deling sender melding og lenke samlet. Se bilder etter levering åpner riktig bildefeed, og den ekstra glipen under menyen er fjernet. Mørk modus er lysnet, med bedre kontrast på Rosa sløyfe-kort og nedtelling. Dagsversjonen viser også versjonsnummer.'}
 ]},
 {version:35,date:'2026-10-01',summary:'To daglige jakter, private grupper og venner, flere sosiale funksjoner og bedre mobilopplevelse.',changes:[
  {type:'Nyhet' as const,text:'To daglige jakter kl. 07–15 og 15–00, med individuell start. Nye jakt- og dagsrekker, sesongmerker, større profilbilder og venneforespørsler.'},
  {type:'Nyhet' as const,text:'Private grupper med gruppeeiere og administratorer, søk etter brukernavn og navn, åpen registrering og rapportering til admin.'},
  {type:'Endring' as const,text:'Tilpassede påminnelser som stopper når du har levert. Valgfri varsling, profilbilder i vennelisten, en felles bildediskusjon, én likerknapp med reaksjonsvalg og svartråder.'},
  {type:'Endring' as const,text:'Bedre mobilmeny og profilinnstillinger, gruppefilter i feeden og dra ned for å oppdatere uten å miste valgt fane. Endringsloggen og oppdateringsbeskjeden er samlet på startsiden.'}
 ]}
];
