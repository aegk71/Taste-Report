import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alsKopie, type BackupTasting } from '../src/lib/backupFormat.ts';
import {
  anfrageBauen,
  artikelAusAntwort,
  artikelBereinigen,
  ohneMarkdown,
  systemPrompt,
  WERKZEUG,
  zitatPasst,
  type AnfrageEingabe,
} from '../src/lib/ki/artikel.ts';
import type { Artikel } from '../src/lib/model.ts';

const eingabe = (extra: Partial<AnfrageEingabe> = {}): AnfrageEingabe => ({
  modell: 'test-modell',
  tasting: { name: 'Fest', datumVon: '2026-09-12', verkoster: 'Alex', fazit: 'Toll.' },
  biere: [
    { kurzId: 'B1', id: 'g-a', hersteller: 'Alpenbräu', name: 'Weizen Alp', stil: 'Weizen', bewertung: 4.5, platz: 1, notiz: 'Banane, Nelke und ein trockener Abgang.' },
    { kurzId: 'B2', id: 'g-b', hersteller: 'Zeta', name: 'Pils', bewertung: 3, platz: 2, abv: 4.9 },
    { kurzId: 'B3', id: 'g-c', hersteller: 'Zeta', name: 'Ohne Wertung' },
  ],
  siegerKurzId: 'B1',
  herstellerAnzahl: 2,
  ton: 'locker',
  laenge: 'normal',
  bilder: [
    { fuer: 'cover', beschriftung: 'Titelfoto des Tastings (Cover):', base64: 'AAAA' },
    { fuer: 'B1', beschriftung: 'Foto zu B1: Alpenbräu – Weizen Alp', base64: 'BBBB' },
  ],
  ...extra,
});

test('Anfrage: Werkzeug erzwungen, Modell, Token je Länge', () => {
  const { body } = anfrageBauen(eingabe()) as { body: any };
  assert.equal(body.model, 'test-modell');
  assert.deepEqual(body.tool_choice, { type: 'tool', name: WERKZEUG });
  assert.equal(body.tools[0].name, WERKZEUG);
  assert.deepEqual(body.tools[0].input_schema.required, ['schlagzeile', 'vorspann', 'abschnitte', 'schlusswort']);
  assert.equal(body.max_tokens, 5000);
  assert.equal((anfrageBauen(eingabe({ laenge: 'kurz' })).body as any).max_tokens, 2500);
});

test('Anfrage: Fotos mit Beschriftung davor, Daten als JSON, IDs Kurz → echt', () => {
  const { body, idMap } = anfrageBauen(eingabe()) as { body: any; idMap: Map<string, string> };
  const inhalt = body.messages[0].content;
  assert.equal(inhalt[0].type, 'text');
  assert.ok(inhalt[0].text.includes('"name": "Weizen Alp"'));
  assert.ok(inhalt[0].text.includes('"id": "B1"'));
  assert.ok(!inhalt[0].text.includes('g-a'), 'echte IDs gehen nicht an die KI');
  assert.deepEqual(inhalt.slice(1).map((x: any) => x.type), ['text', 'image', 'text', 'image']);
  assert.equal(inhalt[1].text, 'Titelfoto des Tastings (Cover):');
  assert.equal(inhalt[2].source.media_type, 'image/jpeg');
  assert.equal(inhalt[2].source.data, 'AAAA');
  assert.equal(idMap.get('B2'), 'g-b');
});

test('Anfrage: ohne Fotos kein Bildblock', () => {
  const { body } = anfrageBauen(eingabe({ bilder: [] })) as { body: any };
  assert.equal(body.messages[0].content.length, 1);
  assert.ok(body.messages[0].content[0].text.includes('Es gibt keine Fotos'));
});

test('System-Prompt: Verkoster, Ton, Länge, keine erfundenen Fakten, keine Zahlen', () => {
  const p = systemPrompt('Alex', 'feuilleton', 'kurz');
  assert.ok(p.includes('von Alex in der Ich-Form'));
  assert.ok(p.includes('Magazin-Feuilleton'));
  assert.ok(p.includes('250 bis 350 Wörter'));
  assert.ok(p.includes('Erfinde keine'));
  assert.ok(p.includes('Nenne keine Bewertungszahlen'));
  assert.ok(p.includes('wörtliche Ausschnitte'));
});

const antwort = (input: unknown, extra: object = {}) => ({ stop_reason: 'tool_use', content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', name: WERKZEUG, input }], ...extra });
const idMap = new Map([['B1', 'g-a'], ['B2', 'g-b']]);
const notizen = new Map([['g-a', 'Banane, Nelke und ein trockener Abgang.']]);

test('Antwort: gültiger Artikel, IDs werden umgesetzt', () => {
  const a = artikelAusAntwort(
    antwort({
      schlagzeile: ' Zwölf Brauer ',
      vorspann: 'Zwei Tage.',
      abschnitte: [{ ueberschrift: 'Ankunft', text: 'Es roch nach Malz.' }],
      zitate: [{ bier: 'B1', text: 'Banane, Nelke' }],
      bildunterschriften: [{ bier: 'B1', text: 'Das Weizen' }],
      schlusswort: 'Bis nächstes Jahr.',
    }),
    idMap,
    notizen,
    'locker',
    'normal',
  )!;
  assert.equal(a.schlagzeile, 'Zwölf Brauer');
  assert.deepEqual(a.zitate, [{ bier: 'g-a', text: 'Banane, Nelke' }]);
  assert.deepEqual(a.bildunterschriften, { 'g-a': 'Das Weizen' });
  assert.equal(a.ton, 'locker');
  assert.equal(a.laenge, 'normal');
});

test('Antwort: erfundene Zitate, unbekannte IDs und Zitate ohne Notiz werden verworfen', () => {
  const a = artikelAusAntwort(
    antwort({
      schlagzeile: 'S',
      vorspann: '',
      abschnitte: [{ ueberschrift: '', text: 'Text' }],
      zitate: [
        { bier: 'B1', text: 'Schmeckte nach Himbeere' },
        { bier: 'B9', text: 'Banane' },
        { bier: 'B2', text: 'Ein Pils' },
        { bier: 'B1', text: 'trockener Abgang' },
      ],
      bildunterschriften: [{ bier: 'B7', text: 'x' }, { bier: 'B2', text: 'Pils' }],
      schlusswort: '',
    }),
    idMap,
    notizen,
    'sachlich',
    'kurz',
  )!;
  assert.deepEqual(a.zitate, [{ bier: 'g-a', text: 'trockener Abgang' }]);
  assert.deepEqual(a.bildunterschriften, { 'g-b': 'Pils' });
});

test('Antwort: unvollständig oder unlesbar ergibt null', () => {
  const ok = { schlagzeile: 'S', vorspann: '', abschnitte: [{ ueberschrift: '', text: 'T' }], schlusswort: '' };
  const pruefe = (a: unknown) => artikelAusAntwort(a, idMap, notizen, 'locker', 'normal');
  assert.notEqual(pruefe(antwort(ok)), null);
  assert.equal(pruefe(null), null);
  assert.equal(pruefe({ content: [] }), null);
  assert.equal(pruefe(antwort(ok, { stop_reason: 'max_tokens' })), null);
  assert.equal(pruefe(antwort({ ...ok, schlagzeile: '' })), null);
  assert.equal(pruefe(antwort({ ...ok, abschnitte: [] })), null);
  assert.equal(pruefe(antwort({ ...ok, abschnitte: [{ ueberschrift: 'x', text: '  ' }] })), null);
  assert.equal(pruefe({ content: [{ type: 'text', text: 'nur Text' }] }), null);
  assert.equal(pruefe({ content: [{ type: 'tool_use', name: 'anderes', input: ok }] }), null);
});

test('Markdown wird entfernt', () => {
  assert.equal(ohneMarkdown('**Fett** und __auch__'), 'Fett und auch');
  assert.equal(ohneMarkdown('# Titel\nText'), 'Titel\nText');
  assert.equal(ohneMarkdown('ein *kursives* Wort.'), 'ein kursives Wort.');
  assert.equal(ohneMarkdown('Rechnung 2 * 3 bleibt'), 'Rechnung 2 * 3 bleibt');
});

test('Zitat-Prüfung: Satzzeichen und Groß-/Kleinschreibung egal, Mindestlänge', () => {
  const notiz = 'Rauch wie ein Lagerfeuer! Entweder man liebt es – oder nicht.';
  assert.equal(zitatPasst('„Rauch wie ein Lagerfeuer.“', notiz), true);
  assert.equal(zitatPasst('liebt es oder nicht', notiz), true);
  assert.equal(zitatPasst('Rauch wie ein Kaminfeuer', notiz), false);
  assert.equal(zitatPasst('Ra', notiz), false);
  assert.equal(zitatPasst('Rauch', undefined), false);
});

test('Bereinigen: Verweise auf gelöschte Biere fallen weg', () => {
  const a: Artikel = {
    schlagzeile: 'S', vorspann: '', abschnitte: [], schlusswort: '', ton: 'locker', laenge: 'normal',
    zitate: [{ bier: 'a', text: 'x' }, { bier: 'b', text: 'y' }],
    bildunterschriften: { a: '1', b: '2' },
  };
  const r = artikelBereinigen(a, new Set(['a']));
  assert.deepEqual(r.zitate, [{ bier: 'a', text: 'x' }]);
  assert.deepEqual(r.bildunterschriften, { a: '1' });
});

test('Backup-Kopie: Bier-IDs im Magazin-Text werden umgeschrieben', () => {
  const e: BackupTasting = {
    tasting: {
      id: 't1', name: 'Fest', datumVon: '2026-09-12', verkoster: 'Alex', erstelltAm: 'a', geaendertAm: 'b',
      artikel: {
        schlagzeile: 'S', vorspann: '', abschnitte: [], schlusswort: '', ton: 'locker', laenge: 'normal',
        zitate: [{ bier: 'g1', text: 'x' }, { bier: 'weg', text: 'y' }],
        bildunterschriften: { g1: 'Bild', weg: 'Nix' },
      },
    },
    hersteller: [{ id: 'h1', tastingId: 't1', name: 'Zeta' }],
    getraenke: [{ id: 'g1', tastingId: 't1', herstellerId: 'h1', name: 'A', zustand: 'probiert', erstelltAm: 'a', geaendertAm: 'a' }],
    fotos: [],
  };
  let n = 0;
  const k = alsKopie(e, () => `neu${++n}`, ' (Kopie)');
  const neueId = k.getraenke[0].id;
  assert.deepEqual(k.tasting.artikel!.zitate, [{ bier: neueId, text: 'x' }]);
  assert.deepEqual(k.tasting.artikel!.bildunterschriften, { [neueId]: 'Bild' });
  assert.equal(e.tasting.artikel!.zitate[0].bier, 'g1', 'Original bleibt unverändert');
});
