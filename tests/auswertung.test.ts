import assert from 'node:assert/strict';
import { test } from 'node:test';
import { herstellerWertungen, kennzahlen, rangliste, sieger } from '../src/lib/auswertung.ts';
import type { Getraenk, Hersteller } from '../src/lib/model.ts';

let zaehler = 0;
function bier(name: string, herstellerId: string, bewertung: number | undefined, extra: Partial<Getraenk> = {}): Getraenk {
  zaehler++;
  const zeit = `2026-09-12T10:${String(zaehler).padStart(2, '0')}:00.000Z`;
  return {
    id: name,
    tastingId: 't',
    herstellerId,
    name,
    zustand: 'probiert',
    bewertung,
    probiertAm: zeit,
    erstelltAm: zeit,
    geaendertAm: zeit,
    ...extra,
  };
}

const hersteller: Hersteller[] = [
  { id: 'h1', tastingId: 't', name: 'Brau Kru' },
  { id: 'h2', tastingId: 't', name: 'Küstenbrauerei Nord' },
  { id: 'h3', tastingId: 't', name: 'Alpenbräu' },
];

const beispiel = [
  bier('A', 'h1', 4.5),
  bier('B', 'h1', 4),
  bier('C', 'h1', undefined), // nicht bewertet
  bier('D', 'h2', 4.5), // Gleichstand mit A, später probiert
  bier('E', 'h2', 3.75),
  bier('F', 'h2', 0), // echte 0, zählt
  bier('G', 'h3', 5, { zustand: 'vorgemerkt' }), // vorgemerkt, zählt nicht
];

test('Rangliste: nur probierte und bewertete, absteigend, Gleichstand = gleicher Platz', () => {
  const r = rangliste(beispiel);
  assert.deepEqual(r.map((p) => [p.getraenk.name, p.platz]), [['A', 1], ['D', 1], ['B', 3], ['E', 4], ['F', 5]]);
});

test('Rangliste: 0 ist ein echter Wert, nicht bewertet fehlt', () => {
  const r = rangliste(beispiel);
  assert.ok(r.some((p) => p.getraenk.name === 'F'));
  assert.ok(!r.some((p) => p.getraenk.name === 'C'));
});

test('Sieger automatisch: bester, bei Gleichstand das zuerst probierte', () => {
  const s = sieger({}, beispiel);
  assert.equal(s?.getraenk.name, 'A');
  assert.equal(s?.gewaehlt, false);
});

test('Sieger manuell gewählt', () => {
  const s = sieger({ siegerId: 'E' }, beispiel);
  assert.equal(s?.getraenk.name, 'E');
  assert.equal(s?.gewaehlt, true);
});

test('Sieger: gewähltes Bier nicht mehr bewertet oder vorgemerkt -> automatisch', () => {
  assert.equal(sieger({ siegerId: 'C' }, beispiel)?.getraenk.name, 'A');
  assert.equal(sieger({ siegerId: 'G' }, beispiel)?.getraenk.name, 'A');
  assert.equal(sieger({ siegerId: 'gibt-es-nicht' }, beispiel)?.getraenk.name, 'A');
});

test('Sieger: ohne Bewertungen kein Sieger', () => {
  assert.equal(sieger({}, [bier('X', 'h1', undefined)]), undefined);
  assert.equal(sieger({}, []), undefined);
});

test('Hersteller-Durchschnitt: nur bewertete, absteigend, ohne Bewertung ausgeblendet', () => {
  const w = herstellerWertungen(hersteller, beispiel);
  assert.deepEqual(w.map((x) => [x.hersteller.name, x.durchschnitt, x.anzahl]), [
    ['Brau Kru', 4.25, 2],
    ['Küstenbrauerei Nord', (4.5 + 3.75 + 0) / 3, 3],
  ]);
});

test('Hersteller-Durchschnitt: Gleichstand alphabetisch', () => {
  const w = herstellerWertungen(hersteller, [bier('P', 'h1', 3), bier('Q', 'h3', 3)]);
  assert.deepEqual(w.map((x) => x.hersteller.name), ['Alpenbräu', 'Brau Kru']);
});

test('Kennzahlen', () => {
  const k = kennzahlen(beispiel);
  assert.equal(k.biere, 6);
  assert.equal(k.hersteller, 2);
  assert.equal(k.durchschnitt, (4.5 + 4 + 4.5 + 3.75 + 0) / 5);
  assert.equal(kennzahlen([]).durchschnitt, undefined);
});
