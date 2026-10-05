import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seiteAufteilen } from '../src/lib/export/magazinSatz.ts';

const zeilen = (n: number, h = 5) => Array.from({ length: n }, () => h);

test('Spalten: alles passt, wird ausgeglichen', () => {
  assert.deepEqual(seiteAufteilen(zeilen(10), 100), { anzahl: 10, links: 5 });
  assert.deepEqual(seiteAufteilen(zeilen(7), 100), { anzahl: 7, links: 3 });
  assert.deepEqual(seiteAufteilen(zeilen(1), 100), { anzahl: 1, links: 0 });
});

test('Spalten: zu viel für die Seite, linke Spalte wird gefüllt', () => {
  const r = seiteAufteilen(zeilen(100), 50);
  assert.equal(r.anzahl, 20);
  assert.equal(r.links, 10);
});

test('Spalten: Absatzlücken zählen mit, keine Spalte wird zu hoch', () => {
  const h = [5, 5, 2.4, 5, 5, 5, 2.4, 5, 5];
  const r = seiteAufteilen(h, 20);
  const links = h.slice(0, r.links).reduce((s, x) => s + x, 0);
  const rechts = h.slice(r.links, r.anzahl).reduce((s, x) => s + x, 0);
  assert.ok(links <= 20 && rechts <= 20);
  assert.ok(r.anzahl >= 7);
});

test('Spalten: erstes Element passt nicht ergibt 0', () => {
  assert.deepEqual(seiteAufteilen([30, 5], 20), { anzahl: 0, links: 0 });
  assert.deepEqual(seiteAufteilen([], 20), { anzahl: 0, links: 0 });
});

test('Spalten: passende Elemente vor einem zu großen werden genommen', () => {
  const r = seiteAufteilen([5, 5, 30, 5], 20);
  assert.equal(r.anzahl, 2);
});
