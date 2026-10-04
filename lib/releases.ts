// One player-facing version per Oslo calendar day. Add same-day work to its summary.
// Keep the player-facing version number stable during each Oslo calendar day.
export const releases=[
 {version:49,date:'2026-10-04',summary:'Tryggere levering og enklere jaktord.',changes:[
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
