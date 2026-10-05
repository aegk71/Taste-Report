import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gruppeKopf, gruppeSpalten, gruppeZeilen, type GruppeExcelTexte } from '../src/lib/export/excelGruppeDaten.ts';
import type { Getraenk, Hersteller } from '../src/lib/model.ts';
import { biereZuordnen, herstellerGruppen, type Quelle } from '../src/lib/vergleich.ts';

const t: GruppeExcelTexte = {
  vergleich: 'Vergleich', verkoster: 'Verkoster', datum: 'Datum', ort: 'Ort', hersteller: 'Hersteller', standort: 'Standort',
  getraenk: 'Getränk', stil: 'Stil', durchschnitt: 'Ø Gruppe', anzahl: 'Anzahl Bewertungen', notiz: (v) => `Notiz ${v}`,
};

const g = (tastingId: string, hid: string, name: string, bewertung?: number, notiz?: string, n = 1): Getraenk => ({
  id: `${tastingId}-${name}`, tastingId, herstellerId: `${tastingId}-${hid}`, name, zustand: 'probiert', bewertung, notiz,
  stilName: 'Weizen', erstelltAm: `2026-09-12T10:0${n}:00.000Z`, geaendertAm: 'x',
});
const h = (tastingId: string, id: string, name: string, standort?: string): Hersteller => ({ id: `${tastingId}-${id}`, tastingId, name, standort });

const quellen: Quelle[] = [
  { tastingId: 'a', verkoster: 'Alex', hersteller: [h('a', 'h1', 'Zeta Brau'), h('a', 'h2', 'Alpenbräu', 'Halle 2')], getraenke: [g('a', 'h1', 'Pils', 3, 'Sauber.', 1), g('a', 'h2', 'Weizen', 4.5, ' Banane. ', 2)] },
  { tastingId: 's', verkoster: 'Sven', hersteller: [h('s', 'h2', 'ALPENBRAU')], getraenke: [g('s', 'h2', 'weizen', 4, undefined, 3), g('s', 'h2', 'Dunkel', undefined, 'Noch offen.', 4)] },
];

test('Excel-Gruppe: eine Zeile je Bier, Hersteller alphabetisch, Werte und Notizen je Verkoster', () => {
  const gruppen = herstellerGruppen(biereZuordnen(quellen));
  const zeilen = gruppeZeilen(gruppen, ['a', 's']);
  assert.deepEqual(zeilen.map((z) => `${z.hersteller}/${z.name}`), ['Alpenbräu/Weizen', 'Alpenbräu/Dunkel', 'Zeta Brau/Pils']);
  const weizen = zeilen[0];
  assert.equal(weizen.standort, 'Halle 2');
  assert.equal(weizen.durchschnitt, 4.25);
  assert.equal(weizen.anzahl, 2);
  assert.deepEqual(weizen.werte, [4.5, 4]);
  assert.deepEqual(weizen.notizen, ['Banane.', '']);
  const dunkel = zeilen[1];
  assert.equal(dunkel.durchschnitt, undefined, 'nicht bewertet bleibt leer, nicht 0');
  assert.equal(dunkel.anzahl, 0);
  assert.deepEqual(dunkel.werte, [undefined, undefined]);
  assert.deepEqual(dunkel.notizen, ['', 'Noch offen.']);
  const pils = zeilen[2];
  assert.deepEqual(pils.werte, [3, undefined], 'Sven hat das Bier nicht probiert');
});

test('Excel-Gruppe: Spalten und Kopfbereich', () => {
  assert.deepEqual(gruppeSpalten(['Alex', 'Sven'], t), ['Hersteller', 'Standort', 'Getränk', 'Stil', 'Ø Gruppe', 'Anzahl Bewertungen', 'Alex', 'Sven', 'Notiz Alex', 'Notiz Sven']);
  assert.deepEqual(gruppeKopf('Bremen', ['Alex', 'Sven'], { datumVon: '2026-09-12', datumBis: '2026-09-14', ort: 'Messe' }, t), [
    ['Vergleich', 'Bremen'], ['Verkoster', 'Alex, Sven'], ['Datum', '12.09.2026 – 14.09.2026'], ['Ort', 'Messe'],
  ]);
  assert.deepEqual(gruppeKopf('X', ['A'], { datumVon: '2026-09-12' }, t).map((f) => f[0]), ['Vergleich', 'Verkoster', 'Datum']);
  assert.deepEqual(gruppeKopf('X', ['A'], undefined, t).map((f) => f[0]), ['Vergleich', 'Verkoster']);
});
