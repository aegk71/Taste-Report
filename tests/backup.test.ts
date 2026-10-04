import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alsKopie,
  backupPruefen,
  BackupFehler,
  hinweisNoetig,
  reihenfolgeNeu,
  stileAbgleichen,
  type BackupTasting,
} from '../src/lib/backupFormat.ts';
import type { Getraenk, Stil } from '../src/lib/model.ts';

const eintrag = (): BackupTasting => ({
  tasting: { id: 't1', name: 'Fest', datumVon: '2026-09-12', verkoster: 'Alex', siegerId: 'g2', erstelltAm: 'a', geaendertAm: 'b', hinweisAm: '2026-09-12' },
  hersteller: [{ id: 'h1', tastingId: 't1', name: 'Zeta' }],
  getraenke: [
    { id: 'g1', tastingId: 't1', herstellerId: 'h1', name: 'A', zustand: 'probiert', erstelltAm: 'a', geaendertAm: 'a' },
    { id: 'g2', tastingId: 't1', herstellerId: 'h1', name: 'B', zustand: 'vorgemerkt', stilId: 's1', erstelltAm: 'a', geaendertAm: 'a' },
  ],
  fotos: [
    { id: 'f1', art: 'cover', bezugId: 't1', reihenfolge: 1, breite: 1, hoehe: 1, erstelltAm: 'a' },
    { id: 'f2', art: 'getraenk', bezugId: 'g1', reihenfolge: 2, breite: 1, hoehe: 1, erstelltAm: 'a' },
  ],
});
const datei = (e: BackupTasting = eintrag()) => ({ schemaVersion: 1, app: 'taste-report', art: 'tasting', erstelltAm: '2026-10-01T10:00:00.000Z', stile: [], tastings: [e] });

test('Prüfung: gültige Datei', () => {
  const d = backupPruefen(datei());
  assert.equal(d.tastings.length, 1);
  assert.equal(d.art, 'tasting');
});

test('Prüfung: Fehlercodes', () => {
  const code = (x: unknown) => {
    try {
      backupPruefen(x);
      return 'ok';
    } catch (e) {
      return e instanceof BackupFehler ? e.code : 'andere';
    }
  };
  assert.equal(code(null), 'format');
  assert.equal(code({ foo: 1 }), 'format');
  assert.equal(code({ ...datei(), schemaVersion: 2 }), 'version');
  assert.equal(code({ ...datei(), tastings: [] }), 'leer');
  const ohneHersteller = eintrag();
  ohneHersteller.hersteller = [];
  assert.equal(code(datei(ohneHersteller)), 'format');
  const ohneName = eintrag();
  ohneName.tasting.name = '';
  assert.equal(code(datei(ohneName)), 'format');
  const fotoOhneBier = eintrag();
  fotoOhneBier.fotos[1].bezugId = 'gibtsnicht';
  assert.equal(code(datei(fotoOhneBier)), 'format');
  const coverFalsch = eintrag();
  coverFalsch.fotos[0].bezugId = 'anderes';
  assert.equal(code(datei(coverFalsch)), 'format');
});

test('Kopie: neue IDs, Verweise konsistent, Sieger umgeschrieben', () => {
  let n = 0;
  const k = alsKopie(eintrag(), () => `neu${++n}`, ' (Kopie)');
  assert.equal(k.tasting.name, 'Fest (Kopie)');
  assert.notEqual(k.tasting.id, 't1');
  assert.equal(k.tasting.hinweisAm, undefined);
  const ids = [k.tasting.id, ...k.hersteller.map((x) => x.id), ...k.getraenke.map((x) => x.id), ...k.fotos.map((x) => x.id)];
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('neu')));
  assert.ok(k.hersteller.every((h) => h.tastingId === k.tasting.id));
  assert.ok(k.getraenke.every((g) => g.tastingId === k.tasting.id && k.hersteller[0].id === g.herstellerId));
  assert.equal(k.tasting.siegerId, k.getraenke[1].id);
  assert.equal(k.fotos[0].bezugId, k.tasting.id);
  assert.equal(k.fotos[1].bezugId, k.getraenke[0].id);
  assert.equal(eintrag().getraenke[0].id, 'g1');
});

test('Fotos lückenlos neu nummerieren', () => {
  const r = reihenfolgeNeu([
    { id: 'a', bezugId: 'x', reihenfolge: 2 as const },
    { id: 'b', bezugId: 'x', reihenfolge: 3 as const },
    { id: 'c', bezugId: 'y', reihenfolge: 3 as const },
  ]);
  assert.deepEqual(r.map((f) => `${f.id}${f.reihenfolge}`), ['a1', 'b2', 'c1']);
});

test('Stile: Abgleich über den Namen, Fehlende werden ergänzt', () => {
  const lokal: Stil[] = [
    { id: 'L1', name: 'Pils', aktiv: true, sortierung: 0 },
    { id: 'L2', name: 'IPA', aktiv: false, sortierung: 1 },
  ];
  const backup: Stil[] = [
    { id: 'B1', name: ' pils ', aktiv: true, sortierung: 0 },
    { id: 'B2', name: 'Rauchbier', aktiv: true, sortierung: 1 },
    { id: 'L1', name: 'Gose', aktiv: false, sortierung: 2 },
  ];
  let n = 0;
  const r = stileAbgleichen(lokal, backup, () => `neu${++n}`);
  assert.equal(r.idMap.get('B1'), 'L1');
  assert.equal(r.idMap.get('B2'), 'B2');
  assert.notEqual(r.idMap.get('L1'), 'L1', 'ID-Kollision wird vermieden');
  assert.equal(r.neu, 2);
  assert.equal(r.stile.length, 4);
  assert.deepEqual(r.stile.map((s) => s.sortierung), [0, 1, 2, 3]);
  assert.equal(r.stile[3].aktiv, false);
});

const bier = (id: string, geaendertAm: string): Pick<Getraenk, 'id' | 'geaendertAm'> => ({ id, geaendertAm });
const viele = (zeit: string, n: number) => Array.from({ length: n }, (_, i) => bier(`g${i}`, zeit));

test('Backup-Hinweis: ab 10 neuen oder geänderten Bieren', () => {
  const t = { letzteSicherung: '2026-10-01T10:00:00.000Z', geaendertAm: '2026-09-01T00:00:00.000Z' };
  assert.equal(hinweisNoetig(t, viele('2026-10-02T00:00:00.000Z', 9), [], '2026-10-03'), false);
  assert.equal(hinweisNoetig(t, viele('2026-10-02T00:00:00.000Z', 10), [], '2026-10-03'), true);
  assert.equal(hinweisNoetig(t, viele('2026-09-30T00:00:00.000Z', 20), [], '2026-10-03'), false, 'schon gesichert');
  assert.equal(hinweisNoetig({ ...t, letzteSicherung: undefined }, viele('2026-10-02T00:00:00.000Z', 10), [], '2026-10-03'), true, 'nie gesichert');
});

test('Backup-Hinweis: neue Fotos zählen, doppelte Biere nur einmal', () => {
  const t = { letzteSicherung: '2026-10-01T10:00:00.000Z', geaendertAm: '2026-09-01T00:00:00.000Z' };
  const biere = viele('2026-09-30T00:00:00.000Z', 10);
  const fotos = biere.flatMap((b) => [
    { art: 'getraenk' as const, bezugId: b.id, erstelltAm: '2026-10-02T00:00:00.000Z' },
    { art: 'getraenk' as const, bezugId: b.id, erstelltAm: '2026-10-02T00:01:00.000Z' },
  ]);
  assert.equal(hinweisNoetig(t, biere, fotos.slice(0, 9), '2026-10-03'), false);
  assert.equal(hinweisNoetig(t, biere, fotos, '2026-10-03'), true);
});

test('Backup-Hinweis: Fazit ohne Sicherung, höchstens einmal pro Tag', () => {
  const t = { letzteSicherung: '2026-10-01T10:00:00.000Z', fazit: 'Toll', geaendertAm: '2026-10-02T00:00:00.000Z' };
  assert.equal(hinweisNoetig(t, [], [], '2026-10-03'), true);
  assert.equal(hinweisNoetig({ ...t, hinweisAm: '2026-10-03' }, [], [], '2026-10-03'), false);
  assert.equal(hinweisNoetig({ ...t, hinweisAm: '2026-10-02' }, [], [], '2026-10-03'), true);
  assert.equal(hinweisNoetig({ ...t, geaendertAm: '2026-09-30T00:00:00.000Z' }, [], [], '2026-10-03'), false, 'Fazit schon gesichert');
  assert.equal(hinweisNoetig({ ...t, fazit: '  ' }, [], [], '2026-10-03'), false, 'leeres Fazit');
});
