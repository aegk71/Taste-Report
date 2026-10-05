import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Getraenk, Hersteller } from '../src/lib/model.ts';
import {
  anzeigename,
  biereZuordnen,
  bierSchluessel,
  einzelneBiere,
  entkoppeln,
  herstellerGruppen,
  namenVorschlag,
  normalisiere,
  verkosterUebersicht,
  vergleichsRangliste,
  vergleichsSieger,
  zielBiere,
  zusammenfuehren,
  type Quelle,
} from '../src/lib/vergleich.ts';

let zaehler = 0;
const g = (tastingId: string, herstellerId: string, name: string, bewertung?: number, extra: Partial<Getraenk> = {}): Getraenk => {
  zaehler++;
  const zeit = `2026-09-12T10:${String(zaehler % 60).padStart(2, '0')}:00.000Z`;
  return { id: `${tastingId}-${zaehler}`, tastingId, herstellerId, name, zustand: 'probiert', bewertung, erstelltAm: zeit, geaendertAm: zeit, probiertAm: zeit, ...extra };
};
const h = (tastingId: string, id: string, name: string, standort?: string): Hersteller => ({ id: `${tastingId}-${id}`, tastingId, name, standort });

function szenario(): { quellen: Quelle[]; ids: Record<string, string> } {
  zaehler = 0;
  const alex: Quelle = {
    tastingId: 'a', verkoster: 'Alex',
    hersteller: [h('a', 'h1', 'Alpenbräu', 'Halle 2'), h('a', 'h2', 'Zeta Brau'), h('a', 'h3', 'Kettel Brau')],
    getraenke: [],
  };
  alex.getraenke = [
    g('a', 'a-h1', 'Weizen Alp', 4.5), g('a', 'a-h1', 'Dunkel 1888', 3), g('a', 'a-h2', 'Pils Nord', 3), g('a', 'a-h3', 'Rauchbier', 4),
    g('a', 'a-h3', 'Vorgemerkt', 5, { zustand: 'vorgemerkt' }),
  ];
  const sven: Quelle = {
    tastingId: 's', verkoster: 'Sven',
    hersteller: [h('s', 'h1', 'ALPENBRAU'), h('s', 'h2', 'Zeta Brau')],
    getraenke: [],
  };
  sven.getraenke = [g('s', 's-h1', 'weizen alp', 4), g('s', 's-h1', 'Dunkel-1888', 3.25), g('s', 's-h2', 'Pilsner Nord', 3.5)];
  const mira: Quelle = {
    tastingId: 'm', verkoster: 'Mira',
    hersteller: [h('m', 'h1', 'Alpenbräu'), h('m', 'h2', 'Zeta Brau'), h('m', 'h3', 'Beerenwerk')],
    getraenke: [],
  };
  mira.getraenke = [g('m', 'm-h1', 'Weizen Alp', 4.75), g('m', 'm-h1', 'Dunkel 1888', 2.75), g('m', 'm-h2', 'Pils Nord'), g('m', 'm-h3', 'Kirsch-Gose', 2)];
  const ids = {
    weizenA: alex.getraenke[0].id, pilsA: alex.getraenke[2].id, pilsS: sven.getraenke[2].id, pilsM: mira.getraenke[2].id,
  };
  return { quellen: [alex, sven, mira], ids };
}

const bier = (biere: ReturnType<typeof biereZuordnen>, name: string) => biere.find((b) => b.name === name)!;

test('Normalisieren: Akzente, Groß-/Kleinschreibung, Satzzeichen und Leerzeichen egal', () => {
  assert.equal(normalisiere('Alpenbräu – Weizen Alp'), 'alpenbrauweizenalp');
  assert.equal(normalisiere('Weiß-Bier'), 'weissbier');
  assert.equal(bierSchluessel('Alpenbräu', 'Weizen Alp'), bierSchluessel('ALPENBRAU', 'weizen  alp'));
  assert.equal(bierSchluessel('', ''), '');
});

test('Zuordnung automatisch: gleicher Hersteller + Name, Reihenfolge der Tastings, Vorgemerkte zählen nicht', () => {
  const { quellen } = szenario();
  const biere = biereZuordnen(quellen);
  const weizen = bier(biere, 'Weizen Alp');
  assert.deepEqual(weizen.eintraege.map((e) => e.verkoster), ['Alex', 'Sven', 'Mira']);
  assert.equal(weizen.durchschnitt, (4.5 + 4 + 4.75) / 3);
  assert.equal(weizen.anzahl, 3);
  assert.equal(bier(biere, 'Dunkel 1888').eintraege.length, 3, 'Satzzeichen im Namen egal');
  assert.equal(biere.find((b) => b.name === 'Vorgemerkt'), undefined);
  // Pils Nord (Alex, Mira) ist zusammen, Pilsner Nord (Sven) bleibt allein
  assert.equal(bier(biere, 'Pils Nord').eintraege.length, 2);
  assert.equal(bier(biere, 'Pilsner Nord').eintraege.length, 1);
});

test('Nicht bewertet zählt nicht: Durchschnitt und Anzahl nur über vorhandene Bewertungen', () => {
  const { quellen } = szenario();
  const pils = bier(biereZuordnen(quellen), 'Pils Nord');
  assert.equal(pils.durchschnitt, 3);
  assert.equal(pils.anzahl, 1);
  assert.equal(pils.eintraege.length, 2);
  const ohne = biereZuordnen([{ ...quellen[0], getraenke: [g('a', 'a-h1', 'X')] }]);
  assert.equal(ohne[0].durchschnitt, undefined);
  assert.deepEqual(vergleichsRangliste(ohne), []);
});

test('Zwei gleiche Biere im selben Tasting werden nie automatisch vereinigt', () => {
  zaehler = 0;
  const a: Quelle = { tastingId: 'a', verkoster: 'Alex', hersteller: [h('a', 'h', 'Zeta')], getraenke: [g('a', 'a-h', 'Pils', 3), g('a', 'a-h', 'Pils', 4)] };
  const s: Quelle = { tastingId: 's', verkoster: 'Sven', hersteller: [h('s', 'h', 'Zeta')], getraenke: [g('s', 's-h', 'Pils', 5)] };
  const biere = biereZuordnen([a, s]);
  assert.equal(biere.length, 2);
  assert.deepEqual(biere[0].eintraege.map((e) => e.verkoster), ['Alex', 'Sven']);
  assert.deepEqual(biere[1].eintraege.map((e) => e.verkoster), ['Alex']);
});

test('Rangliste: Gruppen-Durchschnitt, Gleichstand = gleicher Platz (Dunkel 3,0 = Pils Nord 3,0), dann zuerst probiert', () => {
  const { quellen } = szenario();
  const liste = vergleichsRangliste(biereZuordnen(quellen));
  assert.deepEqual(liste.map((p) => [p.bier.name, p.platz]), [
    ['Weizen Alp', 1],
    ['Rauchbier', 2],
    ['Pilsner Nord', 3],
    ['Dunkel 1888', 4],
    ['Pils Nord', 4],
    ['Kirsch-Gose', 6],
  ]);
  zaehler = 0;
  const a: Quelle = { tastingId: 'a', verkoster: 'A', hersteller: [h('a', 'h', 'Z')], getraenke: [g('a', 'a-h', 'Eins', 4), g('a', 'a-h', 'Zwei', 4), g('a', 'a-h', 'Drei', 3)] };
  const platz = vergleichsRangliste(biereZuordnen([a])).map((p) => [p.bier.name, p.platz]);
  assert.deepEqual(platz, [['Eins', 1], ['Zwei', 1], ['Drei', 3]]);
});

test('Sieger: von Hand gewählt, sonst das beste; ungültige Wahl fällt auf das beste zurück', () => {
  const { quellen } = szenario();
  const biere = biereZuordnen(quellen);
  assert.equal(vergleichsSieger(undefined, biere)!.bier.name, 'Weizen Alp');
  assert.equal(vergleichsSieger(undefined, biere)!.gewaehlt, false);
  const rauch = bier(biere, 'Rauchbier');
  const s = vergleichsSieger(rauch.schluessel, biere)!;
  assert.equal(s.bier.name, 'Rauchbier');
  assert.equal(s.gewaehlt, true);
  assert.equal(vergleichsSieger('gibt-es-nicht', biere)!.gewaehlt, false);
  assert.equal(vergleichsSieger(undefined, []), undefined);
});

test('Handkorrektur: zusammenführen, Anker, entkoppeln', () => {
  const { quellen, ids } = szenario();
  const vorher = biereZuordnen(quellen);
  const pilsner = bier(vorher, 'Pilsner Nord');
  const pils = bier(vorher, 'Pils Nord');
  // Kandidaten: nur Biere, die kein Tasting mit dem Pilsner (Sven) gemeinsam haben
  assert.deepEqual(zielBiere(pilsner, vorher).map((b) => b.name).sort(), ['Kirsch-Gose', 'Pils Nord', 'Rauchbier']);

  const zuordnung = zusammenfuehren({}, pilsner, pils);
  assert.equal(zuordnung[ids.pilsS], ids.pilsA);
  const danach = biereZuordnen(quellen, zuordnung);
  const gruppe = bier(danach, 'Pils Nord');
  assert.deepEqual(gruppe.eintraege.map((e) => e.verkoster), ['Alex', 'Sven', 'Mira']);
  assert.equal(gruppe.durchschnitt, (3 + 3.5) / 2);
  assert.equal(danach.find((b) => b.name === 'Pilsner Nord'), undefined);

  // Sven wieder lösen
  const gel = entkoppeln(zuordnung, ids.pilsS, gruppe);
  const getrennt = biereZuordnen(quellen, gel);
  assert.equal(bier(getrennt, 'Pilsner Nord').eintraege.length, 1);
  assert.equal(bier(getrennt, 'Pils Nord').eintraege.length, 2);
});

test('Handkorrektur: Anker lösen zieht die Mitglieder nicht mit', () => {
  const { quellen, ids } = szenario();
  const pilsner = bier(biereZuordnen(quellen), 'Pilsner Nord');
  const z1 = zusammenfuehren({}, pilsner, bier(biereZuordnen(quellen), 'Pils Nord'));
  const gruppe = bier(biereZuordnen(quellen, z1), 'Pils Nord');
  // den Anker (Alex) aus der Gruppe lösen: Sven hängt sich an Mira
  const z2 = entkoppeln(z1, ids.pilsA, gruppe);
  const neu = biereZuordnen(quellen, z2);
  const einzel = neu.find((b) => b.eintraege.length === 1 && b.eintraege[0].getraenk.id === ids.pilsA)!;
  assert.ok(einzel);
  const rest = neu.find((b) => b.eintraege.some((e) => e.getraenk.id === ids.pilsS))!;
  assert.deepEqual(rest.eintraege.map((e) => e.verkoster), ['Sven', 'Mira']);
});

test('Handkorrektur: einzeln erzwingen und tote Verweise ignorieren', () => {
  const { quellen, ids } = szenario();
  const einzeln = biereZuordnen(quellen, { [ids.weizenA]: ids.weizenA });
  const weizen = einzeln.filter((b) => b.name.toLowerCase() === 'weizen alp');
  assert.equal(weizen.length, 2);
  assert.equal(weizen.find((b) => b.eintraege.length === 1)!.eintraege[0].verkoster, 'Alex');
  // Verweis auf ein gelöschtes Bier: Automatik greift wieder
  const tot = biereZuordnen(quellen, { [ids.pilsS]: 'geloescht' });
  assert.equal(bier(tot, 'Pilsner Nord').eintraege.length, 1);
  // Zyklus bricht ab statt zu hängen
  const zyklus = biereZuordnen(quellen, { [ids.pilsS]: ids.pilsA, [ids.pilsA]: ids.pilsS });
  assert.ok(zyklus.length > 0);
});

test('Einzelne Biere: nur ab zwei Tastings', () => {
  const { quellen } = szenario();
  const biere = biereZuordnen(quellen);
  assert.deepEqual(einzelneBiere(biere, 3).map((b) => b.name).sort(), ['Kirsch-Gose', 'Pilsner Nord', 'Rauchbier']);
  assert.deepEqual(einzelneBiere(biere, 1), []);
});

test('Hersteller: gruppiert über Schreibweisen, Durchschnitt = Mittel der Bier-Durchschnitte', () => {
  const { quellen } = szenario();
  const gruppen = herstellerGruppen(biereZuordnen(quellen));
  const alpen = gruppen.find((x) => x.name === 'Alpenbräu')!;
  assert.equal(alpen.biere.length, 2);
  assert.equal(alpen.standort, 'Halle 2');
  assert.equal(alpen.durchschnitt, ((4.5 + 4 + 4.75) / 3 + (3 + 3.25 + 2.75) / 3) / 2);
  assert.deepEqual(gruppen.map((x) => x.name), ['Alpenbräu', 'Beerenwerk', 'Kettel Brau', 'Zeta Brau']);
});

test('Verkoster-Übersicht: probiert, bewertet, Durchschnitt, bestes Bier', () => {
  const { quellen } = szenario();
  const u = verkosterUebersicht(quellen);
  assert.deepEqual(u.map((x) => [x.verkoster, x.biere, x.bewertet]), [['Alex', 4, 4], ['Sven', 3, 3], ['Mira', 4, 3]]);
  assert.equal(u[0].durchschnitt, (4.5 + 3 + 3 + 4) / 4);
  assert.equal(u[0].bestes!.name, 'Weizen Alp');
  assert.equal(u[2].bestes!.name, 'Weizen Alp');
});

test('Namen: Doppelungen bekommen das Datum, sonst bleibt der Verkoster', () => {
  assert.deepEqual(
    namenVorschlag([
      { id: '1', verkoster: 'Alex', datumVon: '2026-09-12' },
      { id: '2', verkoster: 'alex', datumVon: '2026-09-13' },
      { id: '3', verkoster: 'Sven', datumVon: '2026-09-12' },
      { id: '4', verkoster: '', datumVon: '2026-09-12' },
    ]),
    { '1': 'Alex (12.09.)', '2': 'alex (13.09.)', '3': 'Sven', '4': 'Verkoster' },
  );
  assert.deepEqual(
    namenVorschlag([{ id: '1', verkoster: 'Alex', datumVon: '2026-09-12' }, { id: '2', verkoster: 'Alex', datumVon: '2026-09-12' }]),
    { '1': 'Alex (12.09.)', '2': 'Alex (12.09.) 2' },
  );
  assert.equal(anzeigename({ anzeigenamen: { t: ' Chef ' } }, { id: 't', verkoster: 'Alex' }), 'Chef');
  assert.equal(anzeigename({ anzeigenamen: {} }, { id: 't', verkoster: 'Alex' }), 'Alex');
});
