// Shared meanings fix the intended subject, including ambiguous Norwegian words.
const meanings:Record<string,string>=Object.fromEntries(`
kopp|en kopp til drikke, med eller uten hank
krus|et drikkekrus, vanligvis større enn en kopp og med hank
glass|et drikkeglass; det kan være tomt eller inneholde drikke
tallerken|en tallerken til å servere mat på
skål|en åpen skål til mat eller andre småting
bestikk|en eller flere gafler, kniver eller skjeer til å spise med
gaffel|en spisegaffel med tenner
kniv|en kjøkkenkniv eller spisekniv som ligger trygt i ro
skje|en skje til å spise eller servere med
teskje|en liten skje, som brukes til te eller kaffe
gryte|en gryte til å koke mat i
panne|en stekepanne til matlaging
lokk|et lokk som dekker en gryte, boks eller beholder
øse|en øse med dypt skjehode til suppe eller annen væske
visp|en kjøkkenvisp til å blande eller piske mat med
sil|en kjøkkensil som slipper væske gjennom små hull
rivjern|et kjøkkenredskap med skarpe hull til å rive mat
skjærefjøl|en fjøl eller plate som brukes til å skjære mat på
brødfjøl|en fjøl som brukes til å skjære eller servere brød
vannflaske|en flaske laget for å ha drikkevann i
termos|en isolert flaske eller kanne som holder drikke varm eller kald
matboks|en boks som brukes til å oppbevare eller ta med mat
brød|et brød eller en brødskive
ost|en ostebit eller osteskiver
egg|et hønseegg, helt eller tilberedt
eple|frukten eple, helt eller delt
pære|frukten pære, ikke en lyspære
banan|frukten banan, med eller uten skall
appelsin|frukten appelsin, helt eller delt
gulrot|en gulrot, med eller uten grønt bladverk
potet|en potet, rå eller tilberedt
løk|en matløk, for eksempel gul løk eller rødløk
agurk|en agurk eller agurkskiver
tomat|en tomat eller tomatbiter
paprika|grønnsaken paprika, ikke krydderet
stol|en stol som én person kan sitte på
bord|et møbel med bordplate, som spisebord eller sofabord
sofa|en sofa med plass til flere personer
seng|en seng som brukes til å sove i
pute|en pute til sofa, stol eller seng
dyne|en dyne som brukes som sengetøy
teppe|et gulvteppe eller et pledd til å ha over seg
gardin|en gardin som henger ved et vindu
lampe|en lampe som lyser eller kan gi lys
lyspære|en lyspære som settes i en lampe
lysestake|en holder for ett eller flere stearinlys
stearinlys|et fysisk stearinlys, tent eller slukket
vase|en vase som brukes til å ha blomster i
blomsterpotte|en potte til planter eller blomster, med eller uten plante
bok|en fysisk bok, åpen eller lukket
avis|en papiravis, ikke en nyhetsside på skjerm
blyant|en blyant som skriver med grafitt
penn|en penn som skriver med blekk
viskelær|et viskelær som brukes til å fjerne blyantskrift
linjal|en rett linjal med målestreker
saks|en saks som ligger trygt i ro
lim|en limstift, limflaske eller annen beholder med lim
binders|en liten metall- eller plastklips til å holde papir sammen
konvolutt|en papirkonvolutt til brev eller kort
frimerke|et fysisk frimerke, løst eller festet på et brev
kalender|en fysisk kalender som viser dager, uker eller måneder
klokke|en armbåndsklokke, veggklokke eller annen fysisk klokke
speil|et speil med en reflekterende flate
nøkkel|en fysisk nøkkel som brukes til å åpne en lås
nøkkelring|en ring eller holder som samler nøkler
hengelås|en løs lås med bøyle, som kan låse en port eller veske
kurv|en kurv til å bære eller oppbevare ting i
eske|en eske eller boks, åpen eller lukket
pose|en pose til å bære eller oppbevare ting i
sekk|en ryggsekk eller annen sekk til å bære ting i
koffert|en reisekoffert, åpen eller lukket
paraply|en paraply som beskytter mot regn
lommebok|en lommebok til kort eller penger
mynt|en fysisk pengemynt
seddel|en fysisk pengeseddel
briller|et par briller som brukes på øynene
solbriller|et par briller med mørke glass mot sollys
fjernkontroll|en fjernkontroll til TV eller annet utstyr
telefon|en fysisk mobiltelefon eller fasttelefon
ledning|en elektrisk ledning eller kabel; ikke åpne eller flytt elektriske koblinger
støpsel|en plugg som settes i en stikkontakt; la tilkoblet utstyr være i ro
batteri|et fysisk batteri, løst eller synlig i et apparat
lader|en lader til telefon, datamaskin eller annet utstyr
tastatur|et fysisk tastatur med taster til en datamaskin
mus|en datamus som brukes til å styre en datamaskin, ikke dyret
høyttaler|en fysisk høyttaler som spiller av lyd
sko|en eller flere sko til å ha på føttene
støvel|en støvel med høyt skaft, som gummistøvel eller vinterstøvel
tøffel|en tøffel som brukes innendørs
sokk|en sokk til å ha på foten
vott|en vott som samler fingrene i ett rom
hanske|en hanske med egne rom til fingrene
lue|en lue som brukes på hodet
skjerf|et skjerf til å ha rundt halsen
jakke|en jakke som brukes som ytterplagg
genser|en genser til overkroppen
bukse|en bukse med to buksebein
skjorte|en skjorte, vanligvis med krage og knapper
kjole|en kjole som er ett sammenhengende klesplagg
belte|et belte som brukes rundt midjen
knapp|en fysisk knapp på et klesplagg, ikke en knapp på en skjerm
glidelås|en glidelås på klær, en veske eller lignende
kleshenger|en henger som brukes til å henge opp klær
håndkle|et håndkle som brukes til å tørke seg
klut|en klut til rengjøring eller vasking
svamp|en rengjøringssvamp, ikke en sopp i naturen
såpe|et såpestykke eller en beholder med flytende såpe
tannbørste|en fysisk tannbørste
tannkrem|en tube eller beholder med tannkrem
kam|en kam med tenner som brukes til hår
hårbørste|en børste som brukes til å børste hår
bøtte|en bøtte til vann eller andre ting
kost|en feiekost til rengjøring
feiebrett|et brett som brukes til å samle opp støv og smuss
mopp|en mopp til å vaske gulv med
vask|en servant eller kjøkkenvask, ikke selve vaskeaktiviteten
vaskemaskin|en maskin som vasker klær
kjøleskap|et kjøleskap som brukes til å holde mat kald
komfyr|en komfyr med kokeplater og eventuelt stekeovn
ovn|en stekeovn eller varmeovn
dør|en fysisk dør, åpen eller lukket
vindu|et fysisk vindu i en bygning
trapp|en trapp med tydelige trinn
rekkverk|et rekkverk langs en trapp, balkong eller gangvei
postkasse|en kasse som brukes til å motta brev og post
skilt|et fysisk skilt med tekst eller symboler; det er formen og skiltet som er motivet
gjerde|et gjerde som avgrenser et område
port|en port i et gjerde eller en innkjørsel
tak|taket på en bygning; ta bildet fra bakken
vegg|en vegg inne eller ute
pipe|en skorstein på en bygning; ta bildet fra bakken
benk|en benk som flere personer kan sitte på
sykkel|en vanlig tråsykkel eller elsykkel
bil|en fysisk bil; fotografer fra et trygt sted utenfor trafikken
buss|en fysisk buss; fotografer fra et trygt sted utenfor trafikken
båt|en fysisk båt; hold deg på et trygt sted
åre|en åre som brukes til å ro en båt
tau|et tau eller en tydelig del av et tau
redningsvest|en vest som brukes for å holde en person flytende
anker|et fysisk båtanker
fender|en støtpute som beskytter en båt ved kai eller mot andre båter
fiskestang|en stang som brukes til å fiske med
fiskekrok|en fysisk fiskekrok; ikke håndter spissen for bildets skyld
garn|et fiskegarn med nettmasker, ikke strikkegarn
bøye|en flytende bøye som markerer eller holder noe i sjøen
hjul|et hjul på et kjøretøy, en sykkel eller annet utstyr
dekk|et gummidekk på eller av et hjul, ikke et båtdekk
pumpe|en fysisk pumpe, som sykkelpumpe eller håndpumpe
hjelm|en hjelm til å beskytte hodet
refleks|en fysisk refleks som lyser tilbake når lys treffer den
sparkesykkel|en vanlig sparkesykkel eller elektrisk sparkesykkel
ball|en fysisk ball til lek eller sport
terning|en fysisk spillterning med tall eller prikker
puslespill|et fysisk puslespill eller tydelige puslespillbrikker
bamse|en kosebamse eller annet mykt kosedyr
dukke|en lekedukke
leke|en fysisk gjenstand laget for lek
brettspill|et fysisk brettspill, brett eller spillutstyr
hammer|en hammer som ligger trygt i ro
skrutrekker|et håndverktøy til å skru skruer med
tang|et håndverktøy som griper eller klemmer, ikke sjøplanten
spiker|en fysisk spiker, løs eller festet i noe
skrue|en fysisk skrue, løs eller festet i noe
mutter|en liten metalldel med innvendige gjenger som skrus på en bolt
målebånd|et bånd med målestreker til å måle lengde
spade|en spade som brukes til å grave med
rake|et hageredskap med tenner til løv, gress eller jord
trillebår|en trillebår med ett eller flere hjul og håndtak
vannkanne|en kanne som brukes til å vanne planter
hageslange|en slange som brukes til å føre vann i hagen
vedkubbe|en enkelt vedkubbe som brukes til fyring
vedstabel|flere vedkubber som ligger stablet sammen
kongle|en kongle fra et bartre
kvist|en liten, tynn del av en grein
grein|en grein fra et tre eller en busk
bark|det ytre laget på en trestamme eller grein
stubbe|den nederste delen som står igjen etter at et tre er felt
tre|et levende tre med stamme og greiner
bjørk|et bjørketre, gjerne med den lyse barken synlig
gran|et grantre med nåler og greiner
rogn|et rognetre; bladverk eller røde bær kan hjelpe å vise treslaget
løv|ett eller flere blader fra et løvtre
mose|mose som vokser som et grønt, mykt dekke på bakken, stein eller trær
lav|lav som vokser på stein, bark eller bakken; ofte et grått, gult eller grønnlig belegg
gress|gress som vokser på bakken
blomst|en fysisk blomst, ute eller inne
løvetann|en løvetann med gul blomst eller hvit frøball
kløver|en kløverplante, med bladene tydelig synlige
blåbær|blåbær på en plante eller plukkede bær
tyttebær|røde tyttebær på en plante eller plukkede bær
stein|en naturlig stein, liten eller stor
grus|små steiner som ligger sammen, som på en grusvei
sand|sand på bakken eller samlet i en beholder
skjell|et fysisk skjell fra sjøen, helt eller som en tydelig skallhalvdel
tare|tare eller tang fra sjøen, i vannkanten eller på land
fjær|en fysisk fuglefjær; ikke forstyrr eller fang fugler
snø|naturlig snø på bakken eller andre flater
istapp|en istapp som henger fra en kant; hold avstand og ikke stå under den
sølepytt|en liten dam med vann som ligger på bakken
bekk|et lite naturlig vannløp; fotografer fra trygg grunn
sky|en sky på himmelen
fjell|et naturlig fjell i landskapet
strand|en strand med sand, stein eller grus ved vannet
sjø|sjøen eller havet, med vannflaten tydelig synlig
hund|en ekte hund; la dyret være i fred
katt|en ekte katt; la dyret være i fred
sau|en ekte sau; fotografer uten å gå inn på privat beite
lam|en ekte ung sau; fotografer uten å gå inn på privat beite
hest|en ekte hest; la dyret være i fred
ku|en ekte ku; fotografer uten å gå inn på privat beite
kalv|en ekte ung ku eller okse; la dyret være i fred
høne|en ekte høne; la dyret være i fred
måke|en ekte måke; fotografer uten å jage fuglen
kråke|en ekte kråke; fotografer uten å jage fuglen
skjære|en ekte skjære, fuglen med svart og hvit fjærdrakt
spurv|en ekte spurv; ikke jag fuglen
and|en ekte and; fotografer uten å jage fuglen
fisk|en fysisk fisk, levende eller som mat; ikke fang et dyr bare for bildet
laptop|en bærbar datamaskin med skjerm og tastatur
hus|en bygning som brukes som bolig
gult hus|et hus med tydelig gul fasade
`.trim().split('\n').map(line=>line.split('|')));
export function wordMeaning(word:string){const key=word.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('nb-NO');return meanings[key]?'Ta bilde av '+meanings[key]+'.':null}
