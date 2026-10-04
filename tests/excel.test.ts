import assert from 'node:assert/strict';
import { test } from 'node:test';
import { excelKopf, excelZeilen } from '../src/lib/export/excelDaten.ts';
import type { Getraenk, Hersteller, Tasting } from '../src/lib/model.ts';
const T = { probiert: 'probiert', vorgemerkt: 'vorgemerkt', tasting: 'Tasting', untertitel: 'Untertitel', datum: 'Datum', ort: 'Ort', verkoster: 'Verkoster' };

const hersteller: Hersteller[] = [
  { id: 'h1', tastingId: 't', name: 'Zeta Brauerei', standort: 'Halle 2' },
  { id: 'h2', tastingId: 't', name: 'alpha Bräu' },
];
const bier = (id: string, herstellerId: string, extra: Partial<Getraenk> = {}): Getraenk => ({
  id, tastingId: 't', herstellerId, name: `Bier ${id}`, zustand: 'probiert',
  erstelltAm: `2026-09-12T10:0${id}:00.000Z`, geaendertAm: '', ...extra,
});

test('Zeilen: Hersteller alphabetisch, darin Erfassungsreihenfolge, vorgemerkte dabei', () => {
  const z = excelZeilen(hersteller, [
    bier('1', 'h1', { bewertung: 4.25, stilName: 'Pils', abv: 5, menge: 0.4, preis: 4.5, notiz: 'gut', probiertAm: '2026-09-12T10:01:00.000Z' }),
    bier('2', 'h2', { bewertung: 0 }),
    bier('3', 'h1', { zustand: 'vorgemerkt' }),
  ], T);
  assert.deepEqual(z.map((x) => x.name), ['Bier 2', 'Bier 1', 'Bier 3']);
  assert.equal(z[0].bewertung, 0);
  assert.equal(z[1].bewertung, 4.25);
  assert.equal(z[1].standort, 'Halle 2');
  assert.equal(z[1].probiertAm, '2026-09-12');
  assert.equal(z[1].zustand, 'probiert');
  assert.equal(z[2].zustand, 'vorgemerkt');
  assert.equal(z[2].bewertung, undefined);
});

test('Kopf: leere Felder entfallen, Zeitraum', () => {
  const t = { id: 't', name: 'Fest', datumVon: '2026-09-12', datumBis: '2026-09-14', verkoster: 'Alex', erstelltAm: '', geaendertAm: '' } as Tasting;
  assert.deepEqual(excelKopf(t, T), [['Tasting', 'Fest'], ['Datum', '12.09.2026 – 14.09.2026'], ['Verkoster', 'Alex']]);
});
