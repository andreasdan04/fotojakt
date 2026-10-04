// Reviewed Norwegian Bokmål nouns. The model may only choose from this bank.
export const NORWEGIAN_WORDS = `kopp glass tallerken skål krus bestikk gaffel kniv skje teskje gryte panne lokk øse visp sil rivjern skjærefjøl brødfjøl vannflaske termos matboks brød ost egg eple pære banan appelsin gulrot potet løk agurk tomat paprika stol bord sofa seng pute dyne teppe gardin lampe lyspære lysestake stearinlys vase blomsterpotte bok avis blyant penn viskelær linjal saks lim binders konvolutt frimerke kalender klokke speil nøkkel nøkkelring hengelås kurv eske pose sekk koffert paraply lommebok mynt seddel briller solbriller fjernkontroll telefon ledning støpsel batteri lader tastatur mus høyttaler sko støvel tøffel sokk vott hanske lue skjerf jakke genser bukse skjorte kjole belte knapp glidelås kleshenger håndkle klut svamp såpe tannbørste tannkrem kam hårbørste bøtte kost feiebrett mopp vask vaskemaskin kjøleskap komfyr ovn dør vindu trapp rekkverk postkasse skilt gjerde port tak vegg pipe benk sykkel bil buss båt åre tau redningsvest anker fender fiskestang fiskekrok garn bøye hjul dekk pumpe hjelm refleks sparkesykkel ball terning puslespill bamse dukke leke brettspill hammer skrutrekker tang spiker skrue mutter målebånd spade rake trillebår vannkanne hageslange vedkubbe vedstabel kongle kvist grein bark stubbe tre bjørk gran rogn løv mose lav gress blomst løvetann kløver blåbær tyttebær stein grus sand skjell tare fjær snø istapp sølepytt bekk sky fjell strand sjø hund katt sau lam hest ku kalv høne måke kråke skjære spurv and fisk`.split(' ');
export const MOVEMENT_WORDS = new Set('postkasse skilt gjerde port benk sykkel bil buss båt åre tau anker fender bøye hjul dekk refleks spade rake trillebår hageslange vedkubbe vedstabel kongle kvist grein bark stubbe tre bjørk gran rogn mose lav stein grus sand skjell tare fjær sølepytt bekk fjell strand sjø'.split(' '));
// Repetition is allowed, with at least one week between appearances.
export const WORD_COOLDOWN_DAYS = 7;
export const normalizeWord = (word: string) => word.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('nb-NO');
export type WordHistory = {title: string; day: string};
const dayNumber = (day: string) => Date.parse(day + 'T12:00:00Z') / 86400000;
export function allowedWords(day: string, history: WordHistory[], bank: string[] = NORWEGIAN_WORDS) {
 const blocked = new Set(history.filter(item => Math.abs(dayNumber(day) - dayNumber(item.day)) < WORD_COOLDOWN_DAYS).map(item => normalizeWord(item.title)));
 return bank.filter(word => !blocked.has(word));
}
// Keep valid AI choices; repair individual collisions rather than discarding an album.
export function completeWords(input: unknown, days: string[], history: WordHistory[], movement: boolean[] = [], bank: string[] = NORWEGIAN_WORDS): string[] {
 const proposed = Array.isArray(input) ? input.map(word => typeof word === 'string' ? normalizeWord(word) : '') : [];
 const selected: WordHistory[] = [];
 const counts = new Map<string, number>();
 for (const [i, day] of days.entries()) {
  let available = allowedWords(day, [...history, ...selected], bank).filter(word => (counts.get(word) || 0) < 2);
  if(movement[i]){const outdoor=available.filter(word=>MOVEMENT_WORDS.has(word));if(outdoor.length)available=outdoor;}
  const preferred = proposed[i];
  // Common household objects provide year-round replacements on Vestvågøy.
  const alternatives = available.filter(word => bank.indexOf(word) < 100);
  const pool = alternatives.length ? alternatives : available;
  const score = (word: string) => (counts.get(word) || 0) * 1000 + history.filter(item => normalizeWord(item.title) === word).length;
  pool.sort((a,b) => score(a) - score(b));
  const word = available.includes(preferred) ? preferred : pool[0];
  if (!word) throw new Error('Ingen tilgjengelige norske ord.');
  selected.push({title: word, day});
  counts.set(word, (counts.get(word) || 0) + 1);
 }
 return selected.map(item => item.title);
}
